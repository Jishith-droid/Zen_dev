
import { Lexer } from '/src/lexer/lexer.js';
import { Parser } from '/src/parser/parser.js';
import { CodeGen } from '/src/codegen/codegen.js';

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
  
  // TEMP browser simulation
  loadFile(source) {
    return `
    int const a = 10
    int b = 20
    export (a)
    export (b)
    `;
  }
  
  // MAIN ENTRY
  moduleAnalyser(node) {
    const source = node.source;
    const imports = node.names;
    
    if (!source) {
      this.IRB.emitError(
        "SyntaxError",
        "import requires source path", node
      );
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
    
    console.log(ir)
    
    // store generated llvm
    this.generatedModules.set(
      source,
      ir
    );
    
    // optional browser download
    this.writeLLFile(source, ir);
    
    const tables = {symbolTable: symbolTable[0], functionTable}
    
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
        `${moduleName} does not provide any exports`
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
          `${name} is not defined`
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
        
        if (!tables.functionTable.has(node.name)) return;
        
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
        
        if (!tables.symbolTable.has(node.name)) return;
        
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
        this.IRB.emitError(
          `${type}Error`,
          `duplicate ${type.toLowerCase()} ${name}`
        );
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
      this.IRB.emitError(
        "ModuleError",
        `Unknown module ${source}`
      );
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
    
    const out = [];
    
    for (const p of params) {
      
     if (p?.isRest) {
      return `(...)`;
    } 
      
      out.push(
        this.IRB.getLLVMType(p.type)
      );
    }
    
    return `(${out.join(", ")})`;
  }
  
  // browser simulation
  writeLLFile(source, llvm) {
    
    const blob = new Blob(
      [llvm], { type: "text/plain" }
    );
    
    const url =
      URL.createObjectURL(blob);
    
    const a =
      document.createElement("a");
    
    a.href = url;
    
    a.download =
      source.replace(".zen", ".ll");
    
    // optional auto download
    // a.click();
    
    URL.revokeObjectURL(url);
  }
  
}