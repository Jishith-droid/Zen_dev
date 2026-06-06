import { Lexer } from "../../lexer/lexer.js";
import { Parser } from "../../parser/parser.js";
import { CodeGen } from "../codegen.js";
import fs from "fs";
import path from "path";

export class Module {
  constructor(IRB) {
    this.IRB = IRB;
    this.moduleImports = new Map();
    this.c = 0;
    
    // GLOBAL MODULE REGISTRY
    // shared export metadata only
    this.modules = new Map();
    
    // generated .ll files
    this.generatedModules = new Map();
  }

loadFile(source) {
  return fs.readFileSync(source, "utf8");
}
  
  // MAIN ENTRY
  moduleAnalyser(node) {
    const source = node.source;
    const imports = node.names;
    
    if (!source) {
      this.IRB.emitError("ImportError", `'import' requires a source file path`, node)
    }
    
    // already compiled
    if (this.modules.has(source)) {
      this.resolveImports(imports, source);
      return;
    }
    
    // 1. load source
    const file = this.loadFile(source);
    
    // 2. lex
    const lexer = new Lexer(file);
    const tokens = lexer.tokenize();
    
    // 3. parse
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    // 4. separate compilation
    const moduleCodegen = new CodeGen(ast, this);
    
    const { ir, symbolTable, functionTable } = moduleCodegen.generateLLVM();
    
    console.log(ir) // for getting export file generated llvm
    
    // store generated llvm
    this.generatedModules.set(
      source,
      ir
    );
    
    // optional browser download
    this.writeLLFile(source, ir);
    
    const tables = { symbolTable: symbolTable[0], functionTable }
    
    // 5. collect exports ONLY
    this.collectExports(ast, source, tables);
    
    // 6. resolve imports into current IR
    this.resolveImports(imports, source);
    
  }
  
  // EXPORT ANALYSIS
  collectExports(ast, moduleName, tables) {
    
    const functions = new Map();
    const variables = new Map();
    
    const exportNode = ast.find(
      n => n.type === "EXPORT"
    );
    
    if (!exportNode) {
      this.IRB.emitError(
        "ModuleError",
        `${moduleName} does not provide any exports`, ast
      );
      return;
    }
    
    const exportSet = new Set(exportNode?.names);
    
    for (const name of exportSet) {
      const exists = ast.some(n =>
        n.name === name
      );
      
      if (!exists) {
        this.IRB.emitError(
          "ExportError",
          `${name} is not defined`, ast
        );
      }
    }
    
    this.validateDuplicates(
      exportNode.names,
      "Export"
    );
    
    for (const node of ast) {
      
      // FUNCTION EXPORT
      if (
        node.type === "FUNCTION_DECLARATION" &&
        exportSet.has(node.name)) {
        
        if (!tables.functionTable.has(node.name)) {
          this.IRB.emitError(
            "InternalError",
            `Missing function table entry for ${node.name}`,
            node
          );
        }
        
        const table = tables.functionTable.get(node.name);
        
        functions.set(node.name, {
          name: table.name,
          llvmType: this.IRB.getLLVMType(table.returnType),
          kind: "function",
          returnType: table.returnType,
          params: table.params,
          fromParam: true
        });
      }
      
      // VARIABLE EXPORT
      if (
        node.type === "VARIABLE_DECLARATION" &&
        exportSet.has(node.name)) {
        
        if (!tables.symbolTable.has(node.name)) {
          this.IRB.emitError(
            "InternalError",
            `Missing symbol table entry for '${node.name}'`,
            node
          );
        }
        
        const table = tables.symbolTable.get(node.name);
        
        variables.set(node.name, {
          ptr: table.ptr,
          llvmType: table.llvmType,
          type: table.type,
          kind: "variable",
          isConstant: table?.isConstant,
          needsLoad: true
        });
        
      }
      
    }
    
    // SAVE ONLY METADATA
    this.modules.set(moduleName, {
      functions,
      variables
    });
    
  }
  
  validateDuplicates(names, type) {
    
    const seen = new Set();
    
    for (const name of names) {
      
      if (seen.has(name)) {
        this.IRB.emitError("DeclarationError", `Duplicate ${type.toLowerCase()} '${name}' is already defined`, node)
      }
      
      seen.add(name);
    }
  }
  
  // IMPORT RESOLUTION
  resolveImports(imports, source) {
    
    const imported = this.moduleImports.get(source) || new Set();
    this.moduleImports.set(source, imported);
    
    this.validateDuplicates(
      imports,
      "Import"
    );
    
    const moduleData =
      this.modules.get(source);
    
    if (!moduleData) {
      this.IRB.emitError("ImportError", `Cannot resolve module '${source}' — file not found`, node)
    }
    
    imports.forEach(name => {
      
      if (imported.has(name)) {
        this.IRB.emitError(
          "ImportError",
          `${name} already imported from ${source}`
        );
      }
      
      imported.add(name);
      
      // FUNCTION IMPORT
      if (
        moduleData.functions.has(name)
      ) {
        
        const fn =
          moduleData.functions.get(name);
        
        const params =
          this.buildParams(fn.params);
        
        this.IRB.globals.push(
          `declare ${fn.llvmType} @${fn.name}${params}`
        );
        
        // register locally
        this.IRB.functions.set(
          fn.name,
          fn
        );
        
        return;
      }
      
      // VARIABLE IMPORT
      if (
        moduleData.variables.has(name)
      ) {
        
        const variable =
          moduleData.variables.get(name);
        
        this.IRB.globals.push(
          `${variable.ptr} = external global ${variable.llvmType}`
        );
        
        // register locally
        this.IRB.setVar(name, {
          ptr: `${variable.ptr}`,
          llvmType: variable.llvmType,
          external: true,
          type: variable.type,
          needsLoad: true,
          isConstant: variable?.isConstant
        });
        this.IRB.logSymbolTable()
        return;
      }
      
      this.IRB.emitError(
        "ImportError",
        `${name} not exported from ${source}`
      );
    });
  }
  
  buildParams(params) {
    
    const paramStr = [];
    const paramData = [];
    
    for (const p of params) {
      const temp = this.IRB.newTemp();
      
      // REST PARAM
      
      if (p.isRest) {
        
        
        paramStr.push(`%ZenList* ${temp}`);
        
        paramData.push({
          ptr: temp,
          name: p.name,
          type: p.type.type,
          llvmType: "ptr",
          isRest: true
        });
        
        continue;
      }
      
      if (p.type.type === "List") {
        paramStr.push(`%ZenList* ${temp}`);
        
        paramData.push({
          ptr: temp,
          name: p.name,
          type: p.type.generic.type,
          generic: { generic: p.type.generic },
          llvmType: "%ZenList*",
          isList: true
        });
        
        continue;
      }
      
      if (p.type.type === "Map") {
        paramStr.push(`ptr  ${temp}`);
        
        paramData.push({
          ptr: temp,
          name: p.name,
          type: "ptr",
          llvmType: "ptr",
          isMap: true
        });
        
        continue;
      }
      
      // ARRAY CHECK (use type tree safely)
      
      const isArray =
        p.type?.dimensions?.length > 0;
      
      if (isArray) {
        this.IRB.emitError("TypeError", `Fixed-size arrays cannot be passed as function parameters`)
      }
      
      // FLATTEN TYPE → LLVM TYPE
      
      const llvmType = this.IRB.getLLVMType(p.type.type);
      
      paramStr.push(`${llvmType} ${temp}`);
      
      paramData.push({
        name: p.name,
        
        // incoming SSA value
        temp,
        
        // LLVM type (flat)
        llvmType,
        
        // FULL TYPE TREE (IMPORTANT)
        type: p.type.type,
        
        ptr: null
      });
    }
    
    return `(${paramStr.join(", ")})`
  }
  
writeLLFile(source, llvm) {
  const outFile =
    source.replace(/\.zen$/, ".ll");

  fs.writeFileSync(outFile, llvm);
}
  
}