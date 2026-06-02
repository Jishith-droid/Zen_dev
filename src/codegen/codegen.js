import { IRBuilder } from './helper/helper.js';
import { Conditional } from '/src/codegen/lib/conditional.js';
import { Block } from '/src/codegen/lib/block.js';
import { Variable } from './lib/variable.js';
import { Loop } from './lib/loop.js';
import { Ternary } from './lib/ternary.js';
import { HandleFunction } from './lib/function.js';
import { Call } from './lib/call.js';
import { Switch } from './lib/switch.js';
import { Module } from './lib/moduleAnalyser.js';
import { Expression } from './lib/expression.js';
import { ZenMap } from './lib/map.js';
import { ZenList } from './lib/list.js';
import { Struct } from './lib/struct.js';
import { Type } from './lib/builtins/type/type.js';
import { ZenHttp } from './lib/builtins/http/http.js';
import { ZenSys } from './lib/builtins/sys/sys.js';
import { OS } from './lib/builtins/os/os.js';
import { Time } from './lib/builtins/time/time.js';
import { ZenNetwork } from './lib/builtins/network/network.js';
import { InferType } from '/src/codegen/infer/infer.js';
import { ZenError } from './lib/builtins/error/error.js';
import { ZenFileSystem } from './lib/builtins/fileSystem/file.js';
import { IO } from './lib/builtins/io/io.js';
import { ZenString } from './lib/builtins/string/string.js';

import { SCALAR_TYPES, VOID_BUILTIN_FUNCTIONS, GLOBAL_EXTERNAL, STD_FUNCTIONS_SCHEMA, BUILTIN_FUNCTIONS, BUILTIN_MAP, RESERVED_FUNCTIONS, COMPOUND_OPERATORS } from '/src/config/config.js';

export class CodeGen {
  constructor(ast) {
    this.ast = ast;
    this.IRB = new IRBuilder();
    this.expr = new Expression(this.IRB);
    this.time = new Time(this.IRB, this.expr);
    this.map = new ZenMap(this.IRB, this.expr);
    this.network = new ZenNetwork(this.IRB, this.expr);
    this.infer = new InferType(this.IRB);
    this.file = new ZenFileSystem(this.IRB, this.expr);
    this.module = new Module(this.IRB, this);
    this.ternary = new Ternary(this.IRB, this.expr);
    this.expr.setTernary(this.ternary)
    this.os = new OS(this.IRB, this.expr);
    this.http = new ZenHttp(this.IRB, this.expr);
    this.sys = new ZenSys(this.IRB, this.expr);
    this.list = new ZenList(this.IRB, this.expr, this.infer);
    this.IRB.setCall(this.expr);
    
    this.io = new IO(this.IRB, this.expr);
    
    this.error = new ZenError(this.IRB, this.io);
    this.type = new Type(this.IRB, this.expr);
    this.string = new ZenString(this.IRB, this.expr);
    this.call = new Call(this.IRB, this.expr, this.io, this.type, this.string, this.error, this.file, this.os, this.time, this.network, this.http, this.sys);
    
    this.expr.setCall(this.call);
    this.call.setExpression(this.expr);
    
    this.block = new Block(this.IRB, this);
    this.switch = new Switch(this.IRB, this.expr, this.block);
    this.conditional = new Conditional(this.IRB, this.expr, this.block);
    this.fn = new HandleFunction(this.IRB, this.expr, this.block, this.infer);
    this.struct = new Struct(this.IRB, this.expr, this.fn);
    this.variable = new Variable(this.IRB, this.expr, this.call, this.infer);
    this.loop = new Loop(this.IRB, this.expr, this.variable, this.block);
  }
  
  // main entry
  generateLLVM() {
    
    
    if (!this.IRB.DEBUG_IR) {
      this.IRB.loadGlobalConstants();
    }
    
    const haveExport = this.ast.find(f => f.type === "EXPORT");
    const haveImport = this.ast.find(f => f.type === "IMPORT");
    
    if (haveImport && haveExport) {
      this.IRB.emitError("ModuleError", "cannot import module from same export file", node);
    }
    
    for (const node of this.ast) {
      
      if (node.type === "EXPORT") {
        this.IRB.exported = true;
      }
      
      if (node.type === "IMPORT") {
        this.module.moduleAnalyser(node);
      }
    }
    
    if (!this.IRB.exported && !this.IRB.stdlibMode) {
      this.IRB.emit("define void @main() { \nentry:\n");
    }
    
    // set builtins
    this.IRB.registerBuiltins(BUILTIN_MAP);
    
    // function hoisting 
    
    for (const node of this.ast) {
      if (node.type === "FUNCTION_DECLARATION") {
        
        if (!this.IRB.stdlibMode) {
          const stdlibSet = new Set([
            ...RESERVED_FUNCTIONS
          ]);
          
          if (stdlibSet.has(node.name)) {
            this.IRB.emitError(
              "ReservedFunctionError",
              `${node.name} is a reserved function name`, node
            );
          }
        }
        
        const returnType = node.returnType === "void" ?
          "void" : node.returnType.type;
           
        
        const isArrayRet = returnType === "void" ? false : returnType === "List" ? false : node.returnType?.dimensions.length > 0;
        const retGeneric = returnType === "List" ? this.IRB.getDeepestGeneric(node.returnType.generic) : returnType;
        const generic = returnType === "List" ? node.returnType : null;
        
        if (isArrayRet) this.IRB.emitError("SemanticError", `function ${name} cannot return array`, node);
        
        const data = { name: node.name, returnType, params: node.params, retGeneric, generic }
        
        this.IRB.setFunction(node.name, data);
        
      }
    }
    
    for (const node of this.ast) {
      if (!this.IRB.diaganosticMode) {
        if (this.IRB.hadError) {
          return null;
        }
      }
      this.dispatch(node);
    }
    if (!this.IRB.exported && !this.IRB.stdlibMode) {
      this.IRB.emit("ret void \n}");
    }
    
    if (!this.IRB.DEBUG_IR) {
      for (const [name, meta] of Object.entries(GLOBAL_EXTERNAL)) {
        
        const kind = meta.mutable ? "global" : "constant";
        
        this.IRB.globals.unshift(
          `@${name} = external ${kind} ${meta.type}`
        );
      }
      
      if (!this.IRB.stdlibMode) {
        for (const [name, fn] of Object.entries(STD_FUNCTIONS_SCHEMA)) {
          
          if (!this.IRB.usedStdFunctions?.has(name)) continue;
          
          const params = fn.params.join(", ");
          
          this.IRB.globals.unshift(
            `declare ${fn.ret} @${name}(${params})`
          );
        }
      }
      
    }
    
    return {
      ir: this.IRB.getIR(),
      symbolTable: this.IRB.symbolTable,
      functionTable: this.IRB.functions
    }
    
  }
  
  dispatch(node, globalScope = true, fromInsideBlock = false) {
    // if its direct node dont again hoist function. we can toggle this in src/codegen/lib/block.js
    
    if (!this.IRB.diaganosticMode) {
      if (this.IRB.hadError) {
        return null;
      }
    }
    
    // block level function hoisting 
    if (fromInsideBlock) {
      if (node.type === "FUNCTION_DECLARATION") {
        
        const stdlibSet = new Set([
          ...RESERVED_FUNCTIONS
        ]);
        
        if (stdlibSet.has(node.name)) {
          this.IRB.emitError(
            "ReservedFunctionError",
            `${node.name} is a reserved function name`, node
          );
        }
        
        const returnType = node.returnType === "void" ?
          "void" : node.returnType.type
        
        const isArrayRet = returnType === "void" ? false : returnType === "List" ? false : node.returnType?.dimensions.length > 0;
        const retGeneric = returnType === "List" ? this.IRB.getDeepestGeneric(node.returnType.generic) : returnType;
        const generic = returnType === "List" ? node.returnType : null;
        if (isArrayRet) this.IRB.emitError("SemanticError", `function ${name} cannot return array`, node);
        
        const data = { name: node.name, returnType, params: node.params, generic }
        
        this.IRB.setFunction(node.name, data);
      }
    }
    
    const type = node.type;
    
    switch (type) {
      case 'VARIABLE_DECLARATION':
        this.handleVariable(node, globalScope);
        break;
        
      case 'VARIABLE_REFERENCE':
        this.handleVariableRef(node, globalScope);
        break;
        
      case 'CONDITIONAL':
        this.conditional.conditional(node);
        break;
        
      case 'LOOP':
        this.loop.loop(node);
        break;
        
      case 'LOOP_OF':
        this.loop.loopOf(node);
        break;
        
      case 'LOOP_IN':
        this.loop.loopIn(node);
        break;
        
      case "STRUCT":
        this.struct.struct(node, globalScope);
        break;
        
      case 'WHILE_LOOP':
        this.loop.whileLoop(node);
        break;
        
      case 'DO_WHILE':
        this.loop.doWhileLoop(node);
        break;
        
      case 'SWITCH':
        this.switch.handleSwitch(node);
        break;
        
      case 'IMPORT':
        return // ignore 
        
      case 'EXPORT':
        return // ignore 
        
      case 'RETURN':
        this.fn.handleReturn(node);
        break;
        
      case 'MAP_DECLARATION':
        this.map.handleMap(node, globalScope);
        break;
        
      case 'BREAK':
        this.loop.handleBreak();
        break;
        
      case 'CONTINUE':
        this.loop.handleContinue();
        break;
        
      case 'FUNCTION_DECLARATION':
        this.fn.handleFunction(node);
        break;
        
      case 'BLOCK':
        this.block.block(node, false);
        break;
        
      case 'CALL':
        this.call.handleCall(node, true);
        break;
        
      default:
        this.IRB.emitError("InternalError", `Unknown node type ${type}`, node);
    }
  }
  
  // variable declaration rooting 
  
  handleVariable(node, globalScope) {
    
    let type = node.dataType;
    if (type === "auto") {
      type = this.infer.infer(node);
      node.dataType = type;
    }
    
    const isCall = node?.value?.type === "CALL";
    const isTernary = node?.value?.type === "TERNARY";
    const isArrayAccess = node?.value?.type === "ARRAY_ACCESS";
    const isStruct = node?.struct_ref;
    const isList = node.isList;
    
    if (isList) {
      this.list.list(node, globalScope);
      return
    }
    
    if (isTernary) {
      
      const t = this.ternary.ternary(node.value);
      const name = node.name;
      this.IRB.guardGlobal(name, node);
      this.IRB.guardStackOp("TERNARY", node);
      const gName = this.IRB.newGlobalTemp()
      const lName = this.IRB.newTemp();
      
      if (globalScope) {
        
        if (t.isList) {
        this.IRB.emitError(
          "TypeError",
          `${node.name} expect ${t.type} but got 'List'`, node
        );
        }
        
        const initialValue = this.IRB.initialValue(node.dataType);
        
        this.IRB.globals.push(`${gName} = global ${t.llvmType} ${initialValue}`);
        
        this.IRB.emit(`store ${t.llvmType} ${t.ptr}, ptr ${gName}`);
      } else {
        this.IRB.emit(`${lName} = alloca ${t.llvmType}`);
        
        this.IRB.emit(`store ${t.llvmType} ${t.ptr}, ptr ${lName}`);
      }
      
      this.IRB.setVar(name, this.IRB.createData({
        ptr: globalScope ? gName : lName,
        llvmType: t.llvmType,
        type: node.dataType,
        isConstant: node.isConstant,
        isGlobal: globalScope,
        needsLoad: true
      }));
      return;
    }
    
    if (isStruct) {
      this.struct.structRef(node, globalScope);
      return;
    }
    
    const isArray = node?.isArray;
    
    if (isArray) {
      this.variable.arrayVariable(node, globalScope);
      return;
    }
    
    if (isArrayAccess) {
      this.variable.arrayAccessVariable(node, globalScope);
      return;
    }
    
    if (isCall) {
      
      if (VOID_BUILTIN_FUNCTIONS.includes(node.value.name)) {
        this.IRB.emitError("TypeError", `${node.value.name}() void function cannot be used in expression`, node);
      }
      
      this.variable.callVariable(node, globalScope);
      
    } else if (SCALAR_TYPES.includes(type)) {
      
      this.variable.scalarVariable(node, globalScope);
      
    } else if (type === "string") {
      this.variable.stringVariable(node, globalScope);
    }
  }
  
  handleVariableRef(node, globalScope) {
    const isUnary = node.expression.type === "UNARY_EXPRESSION";
    const isMemberAssign = node.expression.type === "MEMBER_ASSIGNMENT";
    const isTernary = node.expression.type === "TERNARY";
    
    if (COMPOUND_OPERATORS.includes(node.expression.operator)) {
      const normalisedNode = this.IRB.normalizeCompound(node);
      
      return this.variable.variableReference(normalisedNode);
    }
    
    if (isTernary) {
      this.ternary.ternary(node.expression);
      return;
    }
    
    const isMemberAccess = node?.object?.name;
    
    if (isMemberAssign) {
      // inside redirect ro map assign
      this.struct.assignStruct(node.expression, globalScope);
      return;
    }
    
    if (isUnary) {
      return this.variable.handleUnary(node.expression);
    }
    
    return this.variable.variableReference(node);
  }
  
}
