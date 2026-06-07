import {
  LLVM_TYPES_MAP,
  ZEN_TYPES_MAP,
  STD_FUNCTIONS_SCHEMA,
  GLOBAL_EXTERNAL,
  COMPOUND_OPERATORS
} from "../../config/config.js";

export class IRBuilder {
  constructor(moduleName) {
    this.globals = [];
    this.locals = [];
    this.functionBuff = [];
    
    this.currentFunction = null;
    this.functions = new Map();
    
    this.moduleName = moduleName;
    
    this.returnCount = 0;
    this.returnTypes = [];
    
    this.reactiveMap = new Map();
    this.dependents = new Map();
    
    this.freedMap = new Map();
    
    this.errors = [];
    this.hadError = false;
    
    this.runtimeStack = [];
    
    this.maps = new Map();
    
    this.freedVars = new Set();
    this.freedFields = new Map();
    
    this.cachedStrings = new Map();
    
    this.currentStruct = null;
    this.usedStdFunctions = new Set();
    
    this.loopStack = [];
    this.loopBlockTerminated = false;
    this.loopIterationSkipped = false;
    
    this.diaganosticMode = true;
    this.DEBUG_IR = false; // debug mode
    this.exported = false; // exported file flag
    this.stdlibMode = false; // std mode toggler
    
    this.formatMap = this.formatMap || new Map(); // format for screen() 
    
    this.tempCount = 0; // main counter
    this.globalTempCount = 0; // global counter
    this.labelCount = 0;
    this.strCount = 0;
    
    this.builtins = new Map();
    this.symbolTable = [new Map()];
    this.structTable = new Map();
    this.usedStdlib = new Map();
  }
  
  hasPath(from, target, visited = new Set()) {
    
    if (from === target) {
      return true;
    }
    
    if (visited.has(from)) {
      return false;
    }
    
    visited.add(from);
    
    const deps = this.dependents.get(from) || [];
    
    for (const dep of deps) {
      if (this.hasPath(dep, target, visited)) {
        return true;
      }
    }
    
    return false;
  }
  
  updateReactive(name, visited = new Set()) {
    
    if (visited.has(name)) return;
    visited.add(name);
    
    const dependents = this.dependents.get(name) || [];
    
    for (const d of dependents) {
      
      const reactive = this.reactiveMap.get(d);
      const ptr = this.getVar(d).ptr;
      
      const expr = this.expr.handleExpression(reactive.expr);
      
      this.emitExpr(expr);
      
      this.emit(
        `store ${expr.llvmType} ${expr.ptr}, ptr ${ptr}`
      );
      
      // recurse
      this.updateReactive(d, visited);
    }
  }
  
  collectVarRefs(node, refs = new Set()) {
    
    if (!node || typeof node !== "object") {
      return [...refs];
    }
    
    if (node.type === "variable") {
      refs.add(node.name);
    }
    
    for (const value of Object.values(node)) {
      
      if (Array.isArray(value)) {
        for (const item of value) {
          this.collectVarRefs(item, refs);
        }
      } else if (value && typeof value === "object") {
        this.collectVarRefs(value, refs);
      }
      
    }
    
    return [...refs];
  }
  
  emitExpr(expr) {
    if (expr?.local?.length) this.emit(expr.local.join("\n"));
    if (expr?.global?.length) this.globals.push(expr.global.join("\n"));
  }
  
  enterFunction(name) {
    this.runtimeStack.push(name);
  }
  
  leaveFunction() {
    this.runtimeStack.pop();
  }
  
  setCall(expr) {
    this.expr = expr;
  }
  
  setFunction(name, data) {
    if (this.functions.has(name)) {
      this.emitError("DeclarationError", `Function '${name}' is already defined`)
    }
    this.functions.set(name, data);
  }
  
  guardGlobal(name, node) {
    const globalConstantsSet = new Set(Object.keys(GLOBAL_EXTERNAL));
    
    if (globalConstantsSet.has(name)) {
      this.emitError("DeclarationError", `'${name}' is a reserved super global and cannot be redeclared`, node)
    }
  }
  
  registerBuiltins(BUILTIN_MAP) {
    for (const [name, info] of Object.entries(BUILTIN_MAP)) {
      
      // only register used builtins
      if (!this.usedStdFunctions?.has(name)) continue;
      
      const finalName = info.llvmName || name;
      
      // guard against duplicate definition
      if (this.functions.has(finalName)) continue;
      
      this.setFunction(finalName, {
        name: finalName,
        returnType: info.returnType,
        isBuiltin: true
      });
    }
  }
  
  sizeOf(type) {
    
    if (type === "int") return 4;
    if (type === "double") return 8;
    if (type === "bool") return 1;
    if (type === "string") return 8;
    
    // struct
    const structInfo = this.getStruct(type);
    
    if (structInfo) {
      
      let size = 0;
      
      for (const field of structInfo.layout) {
        size += this.sizeOf(field.type);
      }
      
      // simple alignment
      if (size % 8 !== 0) {
        size += 8 - (size % 8);
      }
      
      return size;
    }
    
    return 8;
  }
  
  bindLineColumn(node) {
    
    const targets = [
      node?.value,
      node?.expression
    ];
    
    for (const target of targets) {
      if (target) {
        target.line = node.line;
        target.column = node.column;
      }
    }
  }
  
  setStruct(name, data) {
    if (this.structTable.has(name)) {
      this.emitError("DeclarationError", `Struct '${name}' is already defined`, node)
    }
    this.structTable.set(name, data);
  }
  
  resolveMemberChain(node) {
    
    const chain = [];
    
    let current = node;
    
    while (current.type === "MEMBER_ACCESS") {
      chain.unshift(current.field);
      current = current.object;
    }
    
    return {
      base: current,
      fields: chain
    };
  }
  
  getArrayChain(node) {
    const indices = [];
    
    let current = node;
    
    while (current.type === "ARRAY_ACCESS") {
      indices.push(current.index);
      current = current.array;
    }
    
    return {
      b: current,
      indices: indices.reverse()
    };
  }
  
  getBaseArray(node) {
    if (node.type === "variable") {
      return node;
    }
    
    if (node.type === "ARRAY_ACCESS") {
      return this.getBaseArray(node.array);
    }
    
    return null;
  }
  
  resolveMemberChainAssign(node) {
    
    const chain = [];
    let current = node;
    
    while (current.type === "MEMBER_ACCESS") {
      chain.unshift(current.field);
      current = current.object;
    }
    
    let base;
    
    if (current.type === "variable") {
      base = current.name;
    }
    
    else if (current.type === "THIS") {
      base = "this";
    }
    
    else {
      this.emitError("TypeError", `Cannot access member on non-struct type '${current.type}'`, node)
    }
    
    return {
      base,
      fields: chain
    };
  }
  
  getFunction(name) {
    if (this.functions.has(name)) {
      return this.functions.get(name);
    }
    
    this.emitError("ReferenceError", `Function '${name}' is not defined`)
  }
  
  typeMatches(expr, expectedType, expectedIsList = false) {
    return (
      expr.type === expectedType &&
      expr.isList === expectedIsList
    );
  }
  
  getStruct(name) {
    if (this.structTable.has(name)) {
      return this.structTable.get(name);
    }
    
    this.emitError("ReferenceError", `Struct '${name}' is not defined`)
  }
  
  utf8LenWithNull(str) {
    let bytes = 0;
    
    for (const ch of str) {
      const code = ch.codePointAt(0);
      
      if (code <= 0x7F) {
        bytes += 1;
      } else if (code <= 0x7FF) {
        bytes += 2;
      } else if (code <= 0xFFFF) {
        bytes += 3;
      } else {
        bytes += 4;
      }
    }
    
    return bytes + 1;
  }
  
  logSymbolTable() {
    console.log(this.symbolTable);
  }
  
  getSymbolTable() {
    return this.symbolTable;
  }
  
  declareOneTime(name, fn) {
    if (this.builtins.has(name)) {
      return;
    }
    
    this.builtins.set(name, fn);
    
    this.globals.unshift(fn);
  }
  
  getListElementLLVM(generic) {
    
    if (!generic) {
      return "ptr";
    }
    
    const inner = generic.generic;
    
    // nested list
    if (inner.type === "List") {
      return "ptr";
    }
    
    // struct
    if (this.hasStruct(inner.type)) {
      return `%${inner.type}`;
    }
    
    // primitive
    return this.getLLVMType(inner.type);
  }
  
  guardStackOp(opName, node) {
    
    if (this.exported && !this.currentFunction) {
      this.emitError("ExportError", `Stack operation '${opName}' is not allowed in exported module`, node)
    }
  }
  
  emit(line) {
    
    const target =
      this.currentFunction ?
      this.currentFunction.body :
      this.exported ?
      null :
      this.locals;
    
    // exported global scope → ignore
    if (!target) return
    
    // debug flag
    if (this.DEBUG_IR) {
      if (target[target.length - 1] === line) {
        this.emitError(
          "InternalError",
          `Duplicate IR detected: ${line}`
        );
      }
    }
    
    target.push(line);
  }
  
  getLLVMType(type) {
    // struct ref 
    if (this.structTable.has(type)) {
      return `%${type}`;
    }
    
    if (type === "Map" || type === "List") {
      return "ptr";
    }
    
    if (type === "void") return "void";
    return LLVM_TYPES_MAP[type];
  }
  
  revertType(type) {
    return ZEN_TYPES_MAP[type];
  }
  
  getIR() {
    return [
      ...this.globals,
      ...this.functionBuff,
      ...this.locals
    ].join("\n");
  }
  
  newTemp() {
    return `%t${this.tempCount++}`;
  }
  
  newGlobalTemp() {
  return `@t${this.exported ? ".e" : ""}_${this.moduleName}_${this.globalTempCount++}`;
}

strTemp() {
  return `@.str${this.exported ? ".e" : ""}${this.stdlibMode ? "_stdlib" : ""}_${this.moduleName}_${this.strCount++}`;
}
  
  newLabel(name = "label") {
    return `${name}${this.labelCount++}`;
  }
  
  formatDouble(value) {
    const num = Number(value);
    
    // ensure decimal format
    return Number.isInteger(num) ? num.toFixed(1) : num.toString();
  }
  
  createData({
    ptr,
    llvmType,
    type,
    isMap,
    isVarArg,
    isMethod,
    generic,
    isList,
    isStruct,
    length,
    isConstant,
    isGlobal,
    isValue,
    kind,
    postOrPrefix,
    isArray,
    dimensionsData,
    dimensions,
    fromParam,
    layout,
    needsLoad,
    name,
    fromLoopOf,
    rawStr,
    isReactive
  }) {
    return {
      ptr,
      llvmType,
      type,
      isMap,
      generic,
      isList,
      isMethod,
      isStruct,
      length,
      isConstant,
      isGlobal,
      isValue,
      kind,
      postOrPrefix,
      isArray,
      isVarArg,
      dimensionsData,
      dimensions,
      fromParam,
      layout,
      needsLoad,
      name,
      fromLoopOf,
      rawStr,
      isReactive
    };
  }
  
  initialValue(type) {
    return type === "int" || type === "bool" ?
      "0" :
      type === "double" ?
      "0.0" :
      type === "string" ?
      "null" :
      "";
  }
  
  // ===== SCOPES =====
  setVar(name, data) {
    
    const current = this.symbolTable[this.symbolTable.length - 1];
    if (current.has(name)) {
      this.emitError("DeclarationError", `Variable '${name}' is already defined`)
    }
    current.set(name, data);
  }
  
  getVar(name, node) {
    
    for (let i = this.symbolTable.length - 1; i >= 0; i--) {
      if (this.symbolTable[i].has(name)) {
        return this.symbolTable[i].get(name);
      }
    }
    
    this.emitError("ReferenceError", `variable ${name} is not defined`);
  }
  
  enterScope() {
    this.symbolTable.push(new Map());
  }
  
  exitScope() {
    this.symbolTable.pop();
  }
  
  hasVar(name) {
    for (let i = this.symbolTable.length - 1; i >= 0; i--) {
      if (this.symbolTable[i].has(name)) {
        return true;
      }
    }
    return false;
  }
  
  isDeclaredInCurrentScope(name) {
    return this.symbolTable[this.symbolTable.length - 1].has(name);
  }
  
  loadVar(name) {
    const v = this.getVar(name);
    const tmp = this.newTemp();
    
    this.emit(
      `${tmp} = load ${v.llvmType}, ${v.llvmType}* ${v.ptr}`
    );
    
    return tmp;
  }
  
  getTypeSizeStruct(llvmType) {
    
    // pointer
    if (llvmType.endsWith("*")) return 8;
    
    if (llvmType === "i1") return 1;
    if (llvmType === "i8") return 1;
    if (llvmType === "i32") return 4;
    if (llvmType === "i64") return 8;
    if (llvmType === "double") return 8;
    if (llvmType === "ptr") return 8;
    
    // arrays like [10 x i32]
    const arrMatch = llvmType.match(/\[(\d+)\s+x\s+(.+)\]/);
    if (arrMatch) {
      const len = parseInt(arrMatch[1]);
      const elemType = arrMatch[2];
      return len * this.getTypeSizeStruct(elemType);
    }
    
    // struct (IMPORTANT FIX)
    const structMatch = llvmType.match(/%(.+)/);
    if (structMatch) {
      const structName = structMatch[1];
      const structInfo = this.getStruct(structName);
      if (!structInfo) {
        this.emitError(
          "ReferenceError",
          `Unknown struct type '${structName}'`,
          node
        );
      }
      return structInfo.byteSize;
    }
    
    this.emitError(
      "InternalError",
      `Unknown type size for '${llvmType}'`,
      node
    );
  }
  
  
  getListDepth(g) {
    
    if (g.type !== "List") {
      return 0;
    }
    
    return 1 + this.getListDepth(g.generic);
  };
  
  toBool(val, type) {
    if (type === "bool") {
      
      return val;
    }
    
    const t = this.newTemp();
    
    if (type === "int") {
      this.emit(`${t} = icmp ne i32 ${val}, 0`);
    }
    else if (type === "double") {
      this.emit(`${t} = fcmp one double ${val}, 0.0`);
    }
    else if (type === "string") {
      const t0 = this.newTemp();
      this.emit(`${t0} = load i8, i8* ${val}`);
      this.emit(`${t} = icmp ne i8 ${t0}, 0`);
    }
    else {
      this.emitError("InternalError", `Cannot convert ${type} to bool`, node);
    }
    
    return t;
  }
  
  toBoolString(ptr) {
    const len = this.newTemp();
    const cmp = this.newTemp();
    
    this.declareOneTime("strlen", "declare i64 @strlen(i8*)");
    
    this.emit(`${len} = call i64 @strlen(i8* ${ptr})`);
    this.emit(`${cmp} = icmp ne i64 ${len}, 0`);
    
    return cmp;
  }
  
  toI1(ptr, type) {
    
    if (type === "i1") return ptr;
    
    const tmp = this.newTemp();
    
    switch (type) {
      case "i32":
      case "int":
        this.emit(`${tmp} = icmp ne i32 ${ptr}, 0`);
        return tmp;
        
      case "double":
        this.emit(`${tmp} = fcmp une double ${ptr}, 0.0`);
        return tmp;
        
      case "i8*":
      case "string":
        return this.toBoolString(ptr)
        
      default:
        this.emit(`${tmp} = icmp ne i32 ${ptr}, 0`);
        return tmp;
    }
  }
  
  
  emitError(type, message, node = null) {
    if (!this.diaganosticMode) {
      this.errors.push({ type, message, node });
      this.hadError = true;
      this.printError(this.errors);
    } else {
      throw new Error(`[Zen Error] ${type}: ${message} at line ${node?.line}:${node?.column}`);
    }
  }
  
  printError() {
    const err = this.errors?.[0];
    
    if (!err) return;
    
    const hasLocation =
      err.node?.line != null &&
      err.node?.column != null;
    
    const hasTrace =
      Array.isArray(this.runtimeStack) &&
      this.runtimeStack.length > 0;
    
    const trace = hasTrace ?
      "\n  ├── stack trace:\n" +
      this.runtimeStack
      .slice()
      .reverse()
      .map(fn => `  │   at ${fn}()`)
      .join("\n") :
      "";
    
    console.error(
      `[Zen ${err.type}]
  ├── ${err.message}${
    hasLocation
      ? `\n  ╰── at line:${err.node.line}:${err.node.column}`
      : ""
  }${trace}`
    );
  }
  
  formatValue(value, type) {
    if (type === "double") {
      return value === 0 ? "0.0" : String(value);
    }
    
    return String(value);
  }
  
  buildParams(params, isMethod = false, node) {
    
    const paramStr = [];
    const paramData = [];
    
    for (const p of params) {
      const temp = this.newTemp();
      
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
        this.emitError("TypeError", `Fixed-size arrays cannot be passed as function parameters`, node)
      }
      
      // FLATTEN TYPE → LLVM TYPE
      
      const llvmType = this.getLLVMType(p.type.type);
      
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
    
    if (isMethod) {
      paramStr.unshift(`ptr %this`);
      paramData.push({
        name: "this",
        ptr: `%this`,
        type: `${this.currentStruct}`,
        llvmType: `%${this.currentStruct}*`,
        isMethod: true,
        isStruct: true
      })
    }
    
    return {
      ir: `(${paramStr.join(", ")})`,
      params: paramData
    };
  }
  
  getGlobalStringPtr(str) {
    
    const name = this.strTemp();
    const len = this.utf8LenWithNull(str);
    
    // create global string
    this.globals.push(
      `${name} = private unnamed_addr constant [${len} x i8] c"${str}\\00"`
    );
    
    // return constant GEP (no temp!)
    return `getelementptr inbounds ([${len} x i8], [${len} x i8]* ${name}, i32 0, i32 0)`;
  }
  
  escapeLLVMString(str) {
    return str
      .replace(/\\/g, "\\5C")
      .replace(/\n/g, "\\0A")
      .replace(/\r/g, "\\0D")
      .replace(/\t/g, "\\09")
      .replace(/"/g, "\\22");
  }
  
  newGlobalString(str) {
    
    if (this.cachedStrings.has(str)) {
      
      const cached =
        this.cachedStrings.get(str);
      
      const tmp =
        this.newTemp();
      
      const ir = `getelementptr inbounds [${cached.len} x i8], [${cached.len} x i8]* ${cached.globalName}, i32 0, i32 0`;
      
      this.emit(`${tmp} = ${ir}`);
      
      return {
        name: tmp,
        ir,
        local: [],
        global: [],
        rawStr: str,
        symbol: cached.globalName
      };
    }
    
    // NEW STRING
    
    const escaped =
      this.escapeLLVMString(str);
    
    const globalName =
      this.strTemp();
    
    const len =
      this.utf8LenWithNull(str);
    
    this.globals.push(
      `${globalName} = private unnamed_addr constant ` +
      `[${len} x i8] c"${escaped}\\00"`
    );
    
    // fresh gep
    const tmp =
      this.newTemp();
    
    const ir = `getelementptr inbounds [${len} x i8], [${len} x i8]* ${globalName}, i32 0, i32 0`
    
    this.emit(`${tmp} = ${ir}`);
    
    // cache ONLY global data
    this.cachedStrings.set(str, {
      globalName,
      len
    });
    
    return {
      name: tmp,
      ir,
      local: [],
      global: [],
      rawStr: str,
      symbol: globalName
    };
  }
  
  validateCallArgs(fn, args, isRest, restIndex = null, node) {
    
    const params = fn.params;
    
    // NORMAL CALL
    
    if (!isRest) {
      
      if (params.length !== args.length) {
        this.emitError("ArgumentError", `'${fn.name}' accepts exactly ${params.length} argument(s), got ${args.length}`, node)
      }
      
      for (let i = 0; i < params.length; i++) {
        
        const expectedList =
          params[i].type.type === "List" ? "List" : params[i].type.type;
        
        const actualList = args[i]?.isList ? "List" : args[i]?.type;
        
        if (expectedList !== actualList) {
          this.emitError("TypeError", `Argument type mismatch in '${fn.name}' — expected (${expectedList}), got (${actualList})`, node)
        }
      }
      
      return;
    }
    
    // REST CALL (INDEX BASED)
    
    if (restIndex === null || restIndex < 0) {
      this.emitError("InternalError", "invalid restIndex", node);
    }
    
    // fixed params
    for (let i = 0; i < restIndex; i++) {
      
      const expected =
        params[i].type.type === "List" ?
        params[i].type.generic.type :
        params[i].type.type;
      
      const actual = args[i]?.type;
      
      if (actual && expected !== actual) {
        this.emitError("TypeError", `'${fn.name}' expects type '${expected}', got '${actual}'`, node)
      }
    }
    
    // rest validation
    const restType =
      args[restIndex]?.type;
    
    for (let i = restIndex; i < args.length; i++) {
      
      const actual = args[i]?.type;
      
      if (actual !== restType) {
        this.emitError("TypeError", `'${fn.name}' rest parameter expects type '${restType}', got '${actual}'`, node)
      }
    }
  }
  
  emitScreenInt(val) {
    this.declareOneTime("fmt_int", '@.fmt_int = private constant [4 x i8] c"%d\\0A\\00"');
    
    this.declareOneTime("screen_int", `define void @screen_int(i32 %x) {
entry:
  call i32 (i8*, ...) @printf(i8* getelementptr ([4 x i8], [4 x i8]* @.fmt_int, i32 0, i32 0),
    i32 %x)
  call i32 @fflush(i8* null)
  ret void
}`);
    
    this.emit(`call void @screen_int(i32 ${val})`);
  }
  
  emitScreenDouble(val) {
    this.declareOneTime("fmt_double", '@.fmt_double = private constant [5 x i8] c"%lf\\0A\\00"');
    
    this.declareOneTime("screen_double", `define void @screen_double(double %x) {
entry:
  call i32 (i8*, ...) @printf(i8* getelementptr ([5 x i8], [5 x i8]* @.fmt_double, i32 0, i32 0),
    double %x)
  call i32 @fflush(i8* null)
  ret void
}`);
    
    this.emit(`call void @screen_double(double ${val})`);
  }
  
  toLLVMString(str) { // for screen string format 
    
    let result = "";
    let len = 0;
    
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      
      if (c === '\n') {
        result += "\\0A";
        len += 1;
      } else if (c === '\t') {
        result += "\\09";
        len += 1;
      } else if (c === '\\') {
        result += "\\5C";
        len += 1;
      } else if (c === '"') {
        result += "\\22";
        len += 1;
      } else {
        result += c;
        len += 1;
      }
    }
    
    result += "\\00"; // null terminator
    len += 1;
    
    return { llvmStr: result, length: len };
  }
  
  emitScreenString(val, format) {
    this.formatMap = this.formatMap || new Map();
    
    let id;
    
    if (this.formatMap.has(format)) {
      id = this.formatMap.get(format);
    } else {
      id = this.formatMap.size;
      this.formatMap.set(format, id);
      
      const { llvmStr, length } = this.toLLVMString(format);
      
      const fmtName = `fmt_string_${this.moduleName}_${id}`;
      const fnName = `screen_string_${this.moduleName}_${id}`;
      
      this.declareOneTime(
        fmtName,
        `@.${fmtName} = private constant [${length} x i8] c"${llvmStr}"`
      );
      
      this.declareOneTime(
        fnName,
        `define void @${fnName}(i8* %x) {
entry:
  call i32 (i8*, ...) @printf(i8* getelementptr ([${length} x i8], [${length} x i8]* @.${fmtName}, i32 0, i32 0),
    i8* %x)
  call i32 @fflush(i8* null)
  ret void
}`
      );
    }
    
    const fnName = `screen_string_${this.moduleName}_${id}`;  
    
    this.emit(`call void @${fnName}(i8* ${val})`);
  }
  
  emitScreenBool(val) {
    this.declareOneTime("fmt_bool_t", '@.fmt_bool_t = private constant [6 x i8] c"true\\0A\\00"');
    this.declareOneTime("fmt_bool_f", '@.fmt_bool_f = private constant [7 x i8] c"false\\0A\\00"');
    
    this.declareOneTime("screen_bool", `define void @screen_bool(i1 %b) {
entry:
  br i1 %b, label %true, label %false
true:
  call i32 (i8*, ...) @printf(i8* getelementptr ([6 x i8], [6 x i8]* @.fmt_bool_t, i32 0, i32 0))
  call i32 @fflush(i8* null)
  br label %end
false:
  call i32 (i8*, ...) @printf(i8* getelementptr ([7 x i8], [7 x i8]* @.fmt_bool_f, i32 0, i32 0))
  call i32 @fflush(i8* null)
  br label %end
end:
  ret void
}`);
    
    this.emit(`call void @screen_bool(i1 ${val})`);
  }
  
  containsUnary(node) {
    if (!node) return false;
    
    if (
      node.type === "UNARY_EXPRESSION" &&
      (node.operator === "++" || node.operator === "--")
    ) {
      this.emitError("SyntaxError", `'++' and '--' are only valid as standalone statements or assignment targets`, node)
    }
    
    return (
      this.containsUnary(node.left) ||
      this.containsUnary(node.right) ||
      this.containsUnary(node.argument)
    );
  }
  
  normalizeNode(node) {
    
    // CASE 1: Variable Declaration
    if (node.type === "VARIABLE_DECLARATION") return node;
    
    // CASE 2: Assignment wrapped in VARIABLE_REFERENCE
    if (node.type === "VARIABLE_REFERENCE") {
      const expr = node.expression;
      const data = this.getVar(expr.name);
      
      return {
        type: "VARIABLE_REFERENCE",
        dataType: data.type,
        isConstant: data.isConstant,
        name: expr.name,
        value: expr.value
      };
    }
    
    return node;
  }
  
  // array helpwers 
  
  validateArrayType(type, node, expectedZenType, name) {
    
    // ---------- LEAF ----------
    if (node.type !== "ARRAY") {
      
      const res = this.expr.handleExpression(node);
      const actualType = res.type;
      
      if (actualType !== expectedZenType) {
        this.emitError("TypeError", `Cannot assign '${actualType}' to variable '${name}' of type '${expectedZenType}'`, node)
      }
      
      
      return;
    }
    
    // ---------- ARRAY ----------
    const match = type.match(/^\[(\d+) x (.*)\]$/);
    if (!match) this.emitError("SyntaxError", `Invalid array type declaration`, node)
    
    const size = parseInt(match[1]);
    const innerType = match[2];
    // Helper at top of the method (or inline)
    
    if (node.elements.length !== size) {
      this.emitError("ArrayError", `Array '${name}' declared with size ${size} but got ${node.elements.length} element(s)`, node)
    }
    
    node.elements.forEach((el, i) =>
      this.validateArrayType(innerType, el, expectedZenType, name)
    );
  }
  
  buildArrayType(baseType, dims) {
    let type = baseType;
    
    for (let i = dims.length - 1; i >= 0; i--) {
      type = `[${dims[i]} x ${type}]`;
    }
    
    return {
      full: type,
      base: baseType
    };
  }
  
  buildGlobalInit(type, node, baseType, zenType, isTop = false) {
    // ---------- LEAF ----------
    if (node.type !== "ARRAY") {
      
      if (node.type !== zenType) {
        this.emitError("DeclarationError", `Global array '${name}' initializer must be a compile-time constant`, node)
      }
      
      if (zenType === "bool") {
        return `${baseType} ${node.value ? 1 : 0}`;
      }
      
      if (zenType === "double") {
        return `${baseType} ${this.formatDouble(node.value)}`;
      }
      
      if (zenType === "string") {
        const gep = this.getGlobalStringPtr(node.value);
        return `i8* ${gep}`;
      }
      
      return `${baseType} ${node.value}`;
    }
    
    // ---------- ARRAY ----------
    const match = type.match(/^\[(\d+) x (.*)\]$/);
    const innerType = match[2];
    
    const elements = node.elements.map(el =>
      this.buildGlobalInit(innerType, el, baseType, zenType, false)
    );
    
    const body = `[${elements.join(", ")}]`;
    
    return isTop ? body : `${type} ${body}`;
  }
  
  validateArray(dimensions, node, depth = 0) {
    if (depth >= dimensions.length) return;
    
    if (node.type !== "ARRAY") {
      this.emitError("SyntaxError", `Invalid array structure — expected a valid array literal`, node)
    }
    
    const expected =
      dimensions[depth].type === "int" ?
      dimensions[depth].value :
      this.constEval(dimensions[depth], "Array dimension");
    
    if (node.elements.length !== expected) {
      this.emitError("ArrayError", `Array size mismatch at dimension ${depth} — expected ${expected} element(s), got ${node.elements.length}`, node)
    }
    
    node.elements.forEach(el =>
      this.validateArray(dimensions, el, depth + 1)
    );
  }
  
  flattenArray(node, indices = [], out = []) {
    if (node.type !== "ARRAY") {
      out.push({ indices, node });
      return out;
    }
    
    node.elements.forEach((el, i) => {
      this.flattenArray(el, [...indices, i], out);
    });
    
    return out;
  }
  
  arrayInit(name, dimensions, value, isGlobal, baseType = "i32", zenType = "int", isConstant, node) {
    
    // dimensions validation 
    
    const dims = dimensions.map(d => {
      if (d.type === "int") {
        return d.value;
      }
      
      if (d.type === "BINARY_EXPRESSION") {
        const val = this.constEval(d, "Array dimension");
        
        if (typeof val !== "number") {
          this.emitError("ArrayError", `Array dimension must be a compile-time constant integer`, node)
        }
        
        return val;
      }
      
      this.emitError("ArrayError", `Array dimension must be a positive integer greater than 0`, node)
    });
    
    if (dims[0] === 0) {
      this.emitError("ArrayError", `Array size must be a positive integer greater than 0`, node)
    }
    
    const { full: arrayType, base: elementType } =
    this.buildArrayType(baseType, dims);
    const elementSize = this.getTypeSize(zenType);
    const length = value.elements.length;
    if (value && value.elements.length > 0) {
      this.validateArrayType(arrayType, value, zenType, name);
      this.validateArray(dimensions, value);
    }
    
    // ---------------- GLOBAL ----------------
    if (isGlobal) {
      const ptr = this.newGlobalTemp();
      
      if (!value || value.elements.length === 0) {
        
        return {
          ir: [`${ptr} = ${isConstant ? "constant" : "global"} ${arrayType} zeroinitializer`],
          ptr,
          llvmType: arrayType,
          length
        }
      }
      
      const init = this.buildGlobalInit(arrayType, value, baseType, zenType, true);
      return {
        ir: [`${ptr} = ${isConstant ? "constant" : "global"} ${arrayType} ${init}`],
        ptr,
        llvmType: arrayType,
        length
      }
    }
    
    // ---------------- LOCAL ----------------
    let ir = [];
    const ptr = this.newTemp();
    
    ir.push(`${ptr} = alloca ${arrayType}`);
    
    // zero init
    if (!value || value.elements.length === 0) {
      const totalSize = dims.reduce((a, b) => a * b, 1) * elementSize;
      
      const cast = this.newTemp();
      
      ir.push(
        `${cast} = bitcast ${arrayType}* ${ptr} to i8*`
      );
      
      ir.push(
        `call void @llvm.memset.p0i8.i64(i8* ${cast}, i8 0, i64 ${totalSize}, i1 false)`
      );
      
      return { ir, ptr, llvmType: arrayType, length };
    }
    
    const flat = this.flattenArray(value);
    
    flat.forEach((item) => {
      const gep = this.newTemp();
      
      const indices = ["i32 0", ...item.indices.map(i => `i32 ${i}`)].join(", ");
      
      ir.push(
        `${gep} = getelementptr ${arrayType}, ${arrayType}* ${ptr}, ${indices}`
      );
      
      // evaluate each element here
      const res = this.expr.handleExpression(item.node);
      
      if (res.local.length) ir.push(...res.local);
      if (res.global.length) ir.push(...res.global);
      
      ir.push(
        `store ${res.llvmType} ${res.ptr}, ${res.llvmType}* ${gep}`
      );
    });
    
    return { ir, ptr, llvmType: arrayType, length };
  }
  
  getTypeSize(type) {
    switch (type) {
      case "int":
        return 4;
      case "double":
        return 8;
      case "bool":
        return 1;
      case "string":
        return 8; // pointer size (64-bit)
      default:
        this.emitError("Internal Error", "Unknown type " + type);
    }
  }
  
  getTypeSizeBytes(type) {
    if (type === "i8") return 1;
    if (type === "i32") return 4;
    if (type === "i64") return 8;
    if (type === "double") return 8;
    if (type.endsWith("*")) return 8; //pointer
    if (type === "ptr") return 8;
    this.emitError(
      "InternalError",
      `Unknown type size '${type}'`,
      node
    );
  }
  
  getElementType(typeStr) {
    
    // remove pointer layer
    if (typeStr?.endsWith("*")) {
      return typeStr.slice(0, -1);
    }
    
    // array layer
    const match = typeStr.match(/^\[(\d+)\s+x\s+(.+)\]$/);
    if (match) {
      return match[2].trim();
    }
    
    return typeStr;
  }
  
  hasStruct(name) {
    return this.structTable && this.structTable.hasOwnProperty(name);
  }
  
  getArrayElementType(type) {
    // "[2 x [2 x i32]]" → "[2 x i32]"
    const match = type.match(/^\[\d+ x (.+)\]$/);
    return match ? match[1] : type;
  }
  
  castExpression(expr, targetType, fnName) {
    if (expr.type === targetType) {
      return expr;
    }
    let local = [];
    
    const t = this.newTemp(); // ONLY SSA name
    
    if (fnName === "toInt") {
      if (expr.type === "string" && targetType === "int") {
        this.declareOneTime("string_to_int_ascii", "declare i32 @string_to_int_ascii(i8*)");
        
        local.push(`${t} = call i32 @string_to_int_ascii(i8* ${expr.ptr})`);
        
        return {
          ptr: t,
          llvmType: "i32",
          type: "int",
          local
        };
      }
    }
    if (fnName === "toString")
      if (expr.type === "int" && targetType === "string") {
        this.declareOneTime("int_to_string_ascii", "declare i8* @int_to_string_ascii(i32)");
        
        local.push(`${t} = call i8* @int_to_string_ascii(i32 ${expr.ptr})`);
        
        return {
          ptr: t,
          llvmType: "i8*",
          type: "string",
          local
        };
      }
    
    // INT  BOOL
    
    if (expr.type === "int" && targetType === "bool") {
      local.push(`${t} = icmp ne i32 ${expr.ptr}, 0`);
      
      return {
        ptr: t,
        llvmType: "i1",
        type: "bool",
        local
      };
    }
    
    // BOOL  INT
    
    if (expr.type === "bool" && targetType === "int") {
      local.push(`${t} = zext i1 ${expr.ptr} to i32`);
      
      return {
        ptr: t,
        llvmType: "i32",
        type: "int",
        local
      };
    }
    
    // INT  DOUBLE
    
    if (expr.type === "int" && targetType === "double") {
      local.push(`${t} = sitofp i32 ${expr.ptr} to double`);
      
      return {
        ptr: t,
        llvmType: "double",
        type: "double",
        local
      };
    }
    
    // ---------------------------
    // DOUBLE → INT
    // ---------------------------
    if (expr.type === "double" && targetType === "int") {
      local.push(`${t} = fptosi double ${expr.ptr} to i32`);
      
      return {
        ptr: t,
        llvmType: "i32",
        type: "int",
        local
      };
    }
    
    // BOOL  DOUBLE
    
    if (expr.type === "bool" && targetType === "double") {
      const intTemp = this.newTemp();
      
      // step 1: bool → int
      local.push(`${intTemp} = zext i1 ${expr.ptr} to i32`);
      
      // step 2: int → double
      local.push(`${t} = sitofp i32 ${intTemp} to double`);
      
      return {
        ptr: t,
        llvmType: "double",
        type: "double",
        local
      };
    }
    
    // DOUBLE  BOOL
    
    if (expr.type === "double" && targetType === "bool") {
      const t = this.newTemp();
      
      local.push(`${t} = fcmp une double ${expr.ptr}, 0.0`);
      
      return {
        ptr: t,
        llvmType: "i1",
        type: "bool",
        local
      };
    }
    
    // INT STRING
    
    if (expr.type === "int" && targetType === "string") {
      this.declareOneTime("int_to_string", "declare i8* @int_to_string(i32)");
      
      local.push(`${t} = call i8* @int_to_string(i32 ${expr.ptr})`);
      
      return {
        ptr: t,
        llvmType: "i8*",
        type: "string",
        local
      };
    }
    
    // DOUBLE  STRING
    
    if (expr.type === "double" && targetType === "string") {
      this.declareOneTime("double_to_string", "declare i8* @double_to_string(double)");
      
      local.push(`${t} = call i8* @double_to_string(double ${expr.ptr})`);
      
      return {
        ptr: t,
        llvmType: "i8*",
        type: "string",
        local
      };
    }
    
    // BOOL  STRING
    
    if (expr.type === "bool" && targetType === "string") {
      this.declareOneTime("bool_to_string", "declare i8* @bool_to_string(i1)");
      local.push(`${t} = call i8* @bool_to_string(i1 ${expr.ptr})`);
      
      return {
        ptr: t,
        llvmType: "i8*",
        type: "string",
        local
      };
    }
    
    // STRING INT
    
    if (expr.type === "string" && targetType === "int") {
      this.declareOneTime("string_to_int", "declare i32 @string_to_int(i8*)");
      
      local.push(`${t} = call i32 @string_to_int(i8* ${expr.ptr})`);
      
      return {
        ptr: t,
        llvmType: "i32",
        type: "int",
        local
      };
    }
    
    // STRING  DOUBLE
    
    if (expr.type === "string" && targetType === "double") {
      this.declareOneTime("string_to_double", "declare double @string_to_double(i8*)");
      
      local.push(`${t} = call double @string_to_double(i8* ${expr.ptr})`);
      
      return {
        ptr: t,
        llvmType: "double",
        type: "double",
        local
      };
    }
    
    // STRING  BOOL
    
    if (expr.type === "string" && targetType === "bool") {
      const len = this.newTemp();
      const res = this.newTemp();
      this.declareOneTime("strlen", "declare i64 @strlen(i8*)");
      
      local.push(`${len} = call i64 @strlen(i8* ${expr.ptr})`);
      local.push(`${res} = icmp ne i64 ${len}, 0`);
      
      return {
        ptr: res,
        llvmType: "i1",
        type: "bool",
        local
      };
    }
    
    this.emitError("TypeError", `Cannot cast '${expr.type}' to '${targetType}'`, node)
  }
  
  loadGlobalConstants() {
    
    const g = this.symbolTable[0]; // global scope
    
    // ─── Mathematical Constants ───────────────────────────────
    g.set("PI", this.createData({
      ptr: "@PI",
      llvmType: "double",
      type: "double",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    g.set("SEED", this.createData({
      ptr: "@SEED",
      llvmType: "i32",
      type: "int",
      isConstant: false,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    g.set("TAU", this.createData({
      ptr: "@TAU",
      llvmType: "double",
      type: "double",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    g.set("E", this.createData({
      ptr: "@E",
      llvmType: "double",
      type: "double",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    g.set("PHI", this.createData({
      ptr: "@PHI",
      llvmType: "double",
      type: "double",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    g.set("SQRT2", this.createData({
      ptr: "@SQRT2",
      llvmType: "double",
      type: "double",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    g.set("LN2", this.createData({
      ptr: "@LN2",
      llvmType: "double",
      type: "double",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    g.set("LN10", this.createData({
      ptr: "@LN10",
      llvmType: "double",
      type: "double",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    
    // ─── Integer Limits ───────────────────────────────────────
    
    g.set("I32_MAX", this.createData({
      ptr: "@I32_MAX",
      llvmType: "i32",
      type: "int",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    g.set("I32_MIN", this.createData({
      ptr: "@I32_MIN",
      llvmType: "i32",
      type: "int",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    
    // ─── Floating Point Limits ────────────────────────────────
    
    g.set("F64_MAX", this.createData({
      ptr: "@F64_MAX",
      llvmType: "double",
      type: "double",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    g.set("F64_MIN", this.createData({
      ptr: "@F64_MIN",
      llvmType: "double",
      type: "double",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    g.set("F64_EPS", this.createData({
      ptr: "@F64_EPS",
      llvmType: "double",
      type: "double",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    
    // ─── Special Float Values ─────────────────────────────────
    
    g.set("INF", this.createData({
      ptr: "@INF",
      llvmType: "double",
      type: "double",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    g.set("NEG_INF", this.createData({
      ptr: "@NEG_INF",
      llvmType: "double",
      type: "double",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
    
    g.set("NAN", this.createData({
      ptr: "@NAN",
      llvmType: "double",
      type: "double",
      isConstant: true,
      isGlobal: true,
      kind: "external",
      needsLoad: true
    }));
  }
  
  setStdlibFunctions() {
    for (const name of this.usedStdFunctions) {
      
      if (this.functions.has(name)) continue;
      
      const fn = STD_FUNCTIONS_SCHEMA[name];
      
      if (!fn) {
        console.log("Missing stdlib:", name);
        continue;
      }
      
      const params = fn.params.map((type, i) => ({
        type: { type: this.revertType(type) },
        name: `p${i}`
      }));
      
      this.setFunction(name, {
        name,
        returnType: this.revertType(fn.ret),
        params
      });
    }
  }
  
  normalizeGeneric(meta) {
    
    if (!meta) {
      return null;
    }
    
    // already normalized
    if (
      typeof meta === "object" &&
      meta.type
    ) {
      return meta;
    }
    
    // primitive string
    return {
      type: meta,
      llvmType: this.getLLVMType(meta),
      isList: false,
      isMap: false,
      elementType: null
    };
  }
  
  buildMapLayout(mapLiteral) {
    
    if (
      !mapLiteral ||
      !mapLiteral.properties
    ) {
      return;
    }
    
    const layout = {};
    
    for (const prop of mapLiteral.properties) {
      
      // NESTED MAP
      
      if (prop.value.type === "MAP_LITERAL") {
        
        layout[prop.key] = {
          type: "Map",
          llvmType: "ptr",
          isMap: true,
          layout: this.buildMapLayout(prop.value)
        };
      }
      
      // LIST
      
      else if (prop.value.type === "ARRAY") {
        
        const inferArrayType = (arr) => {
          
          const first = arr.elements?.[0];
          
          if (!first) {
            return {
              type: "dynamic",
              llvmType: "ptr",
              isList: true,
              elementType: "dynamic"
            };
          }
          
          
          if (first.type === "ARRAY") {
            
            const nested = inferArrayType(first);
            
            return {
              type: nested.type,
              llvmType: nested.llvmType,
              isList: true,
              elementType: {
                type: "List",
                llvmType: "ptr",
                isList: true,
                generic: nested.elementType
              }
            };
          }
          
          // primitive
          return {
            type: first.type,
            llvmType: this.getLLVMType(first.type),
            isList: true,
            elementType: this.normalizeGeneric(first.type)
          };
        };
        
        layout[prop.key] = inferArrayType(prop.value);
        layout[prop.key].isMap = false;
        
      }
      
      // NORMAL VALUE
      
      else {
        
        const expr = this.expr.handleExpression(prop.value);
        
        // MAP/LIST VARIABLE REF
        
        if (expr.isVarRef && (expr.isMap || expr.isList)) {
          
          // MAP
          if (expr.isMap) {
            
            layout[prop.key] = {
              type: "Map",
              llvmType: "ptr",
              isMap: true,
              layout: expr.layout
            };
          }
          
          // LIST
          else if (expr.isList) {
            
            layout[prop.key] = {
              type: expr.type, // "int"
              llvmType: this.getLLVMType(expr.type), // "i32"
              isList: true,
              isMap: false,
              isVarRef: true,
              generic: expr.generic?.generic || expr.generic
            };
          }
        }
        
        // NORMAL VALUE
        
        else {
          
          layout[prop.key] = {
            type: expr.type,
            llvmType: this.getLLVMType(expr.type),
            isMap: false
          };
        }
      }
    }
    
    return layout;
  }
  
  buildMapRecursive(
    parentMapPtr,
    mapLiteral
  ) {
    this.declareOneTime(
      "zen_map_set",
      "declare void @zen_map_set(ptr, ptr, ptr)"
    );
    for (const prop of mapLiteral.properties) {
      
      // GLOBAL KEY STRING
      
      const keyPtr =
        this.newGlobalString(
          prop.key
        );
      
      let valuePtr;
      
      // NESTED MAP
      
      if (
        prop.value.type === "MAP_LITERAL"
      ) {
        
        const nestedMapPtr =
          this.newTemp();
        
        this.emit(
          `${nestedMapPtr} = call ptr @zen_map_new()`
        );
        
        // recurse deeper
        this.buildMapRecursive(
          nestedMapPtr,
          prop.value
        );
        
        valuePtr = nestedMapPtr;
      }
      
      // NORMAL EXPRESSION
      
      else {
        
        
        const value =
          this.expr.handleExpression(
            prop.value
          );
        
        this.emitExpr(value);
        
        if (value?.needsLoad) {
          const t = this.newTemp();
          this.emit(`${t} = load ptr, ptr ${value.ptr}`)
          valuePtr = t;
        } else {
          valuePtr = this.castToPtr(value)
        }
        
      }
      
      // MAP SET
      
      this.emit(
        `call void @zen_map_set(` +
        `ptr ${parentMapPtr}, ` +
        `ptr ${keyPtr.name}, ` +
        `ptr ${valuePtr}` +
        `)`
      );
    }
  }
  
  
  castToPtr(value) {
    
    const type = value.type;
    const isList = value.isList;
    const isMap = value.isMap;
    const isListAccess = value.isListAccess;
    const vptr = value.ptr;
    
    // already ptr-like
    if (
      type === "ptr" ||
      type === "string" ||
      type === "Map" ||
      type === "List" ||
      isList ||
      isMap
    ) {
      return isListAccess ? value.addr : vptr;
    }
    
    // INT
    
    if (type === "int") {
      
      if (isListAccess)
        return value.addr;
      
      const box = this.newTemp();
      
      this.emit(
        `${box} = alloca i32`
      );
      
      this.emit(
        `store i32 ${vptr}, ptr ${box}`
      );
      
      return box;
    }
    
    // BOOL
    
    if (type === "bool") {
      
      if (isListAccess)
        return value.addr;
      
      const box = this.newTemp();
      
      this.emit(
        `${box} = alloca i1`
      );
      
      this.emit(
        `store i1 ${vptr}, ptr ${box}`
      );
      
      return box;
    }
    
    // DOUBLE
    
    if (type === "double") {
      
      if (isListAccess)
        return value.addr;
      
      const box = this.newTemp();
      
      this.emit(
        `${box} = alloca double`
      );
      
      this.emit(
        `store double ${vptr}, ptr ${box}`
      );
      
      return box;
    }
    
    this.emitError(
      "TypeError",
      `Cannot cast '${type}' to ptr`,
      node
    );
  }
  
  handleListProperty(listPtr, object, field, node, fromMap = false, freeField = null) {
    
    switch (field) {
      
      case "length": {
        const gep = this.newTemp();
        this.emit(
          `${gep} = getelementptr inbounds %ZenList, ptr ${listPtr}, i32 0, i32 1`
        );
        
        const val = this.newTemp();
        this.emit(`${val} = load i32, ptr ${gep}`);
        
        return { ptr: val, type: "int", llvmType: "i32", local: [], global: [] };
      }
      
      case "capacity": {
        const gep = this.newTemp();
        this.emit(
          `${gep} = getelementptr inbounds %ZenList, ptr ${listPtr}, i32 0, i32 2`
        );
        
        const val = this.newTemp();
        this.emit(`${val} = load i32, ptr ${gep}`);
        
        return { ptr: val, type: "int", llvmType: "i32", local: [], global: [] };
      }
      
      case "push": {
        
        this.declareOneTime(
          "zen_list_push",
          "declare void @zen_list_push(ptr, ptr)"
        );
        
        const arg = this.expr.handleExpression(node.args[0]);
        
        const expType =
          object?.generic?.generic?.type;
        
        if (expType === "List") {
          
          const expArgType =
            arg?.isList === true ? "List" : arg?.type;
          
          if (expArgType !== "List") {
            this.emitError("TypeError", `'${node.object.name}.push' expects a List element, got '${expArgType}'`, node.args[0])
          }
          
        } else {
          
          const expArgType =
            arg?.isList === true ? "List" : arg?.type;
          
          if (expArgType !== expType) {
            this.emitError("TypeError", `'${node.object.name}.push' expects type '${expType}', got '${expArgType}'`, node.args[0])
          }
        }
        
        this.emitExpr(arg)
        
        const llvmType = this.getListElementLLVM(object.generic);
        
        const tmp = this.newTemp();
        this.emit(`${tmp} = alloca ${llvmType}`);
        
        let t;
        
        if (arg.needsLoad) {
          t = this.newTemp();
          this.emit(`${t} = load ${llvmType}, ptr ${arg.ptr}`)
        } else {
          t = arg.ptr;
        }
        this.emit(`store ${llvmType} ${t}, ptr ${tmp}`);
        
        this.emit(
          `call void @zen_list_push(ptr ${listPtr}, ptr ${tmp})`
        );
        
        return { ptr: null, type: "void", llvmType: "void", local: [], global: [] };
      }
      
      case "pop": {
        
        this.declareOneTime(
          "zen_list_pop",
          "declare void @zen_list_pop(ptr, ptr)"
        );
        
        const llvmType = this.getListElementLLVM(object.generic);
        
        const type = this.getDeepestGeneric(object.generic)
        
        const unwrapGeneric = (g) => {
          if (!g || g.type !== "List") return null;
          return g.generic;
        }
        
        const isList = llvmType === "ptr";
        
        const out = this.newTemp();
        this.emit(`${out} = alloca ${llvmType}`);
        
        this.emit(
          `call void @zen_list_pop(ptr ${listPtr}, ptr ${out})`
        );
        
        const val = this.newTemp();
        this.emit(`${val} = load ${llvmType}, ptr ${out}`);
        
        const nextGeneric = unwrapGeneric(object.generic);
        
        return {
          ptr: val,
          type,
          llvmType,
          local: [],
          global: [],
          isList: nextGeneric?.type === "List",
          generic: nextGeneric
        };
      }
      
      case "removeAt": {
        
        this.declareOneTime(
          "zen_list_remove",
          "declare void @zen_list_remove(ptr, i32)"
        );
        
        const index = this.expr.handleExpression(node.args[0]);
        
        const invalidIndex =
          index.type !== "int" || index.isList;
        
        if (invalidIndex) {
          this.emitError("TypeError", `List '${node.object.name}' index must be of type 'int'`, node.args[0])
        }
        
        this.emitExpr(index)
        
        this.emit(
          `call void @zen_list_remove(ptr ${listPtr}, i32 ${index.ptr})`
        );
        
        return { ptr: null, type: "void", llvmType: "void", local: [], global: [] };
      }
      
      case "clear": {
        
        this.declareOneTime(
          "zen_list_clear",
          "declare void @zen_list_clear(ptr)"
        );
        
        this.emit(`call void @zen_list_clear(ptr ${listPtr})`);
        return { ptr: null, type: "void", llvmType: "void", local: [], global: [] };
      }
      
      case "contains": {
        
        this.declareOneTime(
          "zen_list_contains",
          "declare i1 @zen_list_contains(ptr, ptr)"
        );
        
        const arg = this.expr.handleExpression(node.args[0]);
        
        const expType =
          object?.generic?.generic?.type;
        
        if (expType === "List") {
          
          const expArgType =
            arg?.isList === true ? "List" : arg?.type;
          
          if (expArgType !== "List") {
            this.emitError("TypeError", `'${node.object.name}.contains' expects a List element, got '${expArgType}'`, node.args[0])
          }
          
        } else {
          
          const expArgType =
            arg?.isList === true ? "List" : arg?.type;
          
          if (expArgType !== expType) {
            this.emitError("TypeError", `'${node.object.name}.contains' expects type '${expType}', got '${expArgType}'`, node.args[0])
          }
        }
        
        
        this.emitExpr(arg);
        
        const llvmType = this.getListElementLLVM(object.generic);
        
        const tmp = this.newTemp();
        this.emit(`${tmp} = alloca ${llvmType}`);
        
        this.emit(`store ${llvmType} ${arg.ptr}, ptr ${tmp}`);
        
        
        const val = this.newTemp();
        
        this.emit(
          `${val} = call i1 @zen_list_contains(ptr ${listPtr}, ptr ${tmp})`
        );
        
        return { ptr: val, type: "bool", llvmType: "i1", local: [], global: [] };
      }
      
      case "free": {
        
        this.declareOneTime(
          "zen_list_free",
          "declare void @zen_list_free(ptr)"
        );
        
        if (!fromMap) {
          
          this.emit(`call void @zen_list_free(ptr ${listPtr})`);
          this.emit(`store ptr null, ptr ${object.ptr}`)
          
          this.freedVars.add(node.object.name);
          
          if (!this.freedFields.has(object.name)) {
            this.freedFields.set(object.name, new Set());
            this.freedFields.get(object.name).add(freeField);
          }
          
        } else { // map inside list
          
          this.declareOneTime(
            "zen_map_remove",
            "declare void @zen_map_remove(ptr, ptr)"
          );
          
          let key;
          if (freeField) {
            key = this.newGlobalString(freeField);
          }
          const t = this.newTemp();
          this.emit(`${t} = load ptr, ptr ${object.basePtr}`)
          this.emit(`call void @zen_map_remove(ptr ${t}, ptr ${key.name})`)
          
          if (!this.freedFields.has(object.name)) {
            this.freedFields.set(object.name, new Set());
            this.freedFields.get(object.name).add(freeField);
          }
          
          const meta = this.maps.get(object.name);
          meta[freeField].freed = true;
          meta[freeField].freedAt = freeField;
          
          // important case mutating var for save freed field !!
          
          this.getVar(object.name).freedAt = freeField;
          
        }
        
        
        return { ptr: null, type: "void", llvmType: "void", local: [], global: [] };
      }
      
      
      default:
        this.emitError("TypeError", `List has no property .${field}`, node);
    }
  }
  
  isNestedList(generic) {
    return generic?.type === "List" &&
      generic?.generic?.type === "List";
  }
  
  normalizeCompound(node) {
    if (!node || typeof node !== "object") return node;
    
    // recurse first
    for (const key in node) {
      if (node[key] && typeof node[key] === "object") {
        node[key] = this.normalizeCompound(node[key]);
      }
    }
    
   if (node.type === "ASSIGNMENT") {
  const op = node.operator;
  if (op !== "=") {
    const binaryOp = op[0];
    node.value = {
      type: "BINARY_EXPRESSION",
      operator: binaryOp,
      left: { type: "variable", name: node.name },
      right: node.value
    };
    node.operator = "=";
  }
} else if (node.type === "MEMBER_ASSIGNMENT") {
  const op = node.operator;
  if (op !== "=") {
    const binaryOp = op[0];
    node.value = {
      type: "BINARY_EXPRESSION",
      operator: binaryOp,
      left: {
        type: "MEMBER_ACCESS",
        object: node.object,
        field: node.field,
        line: node.object.line,
        column: node.object.column
      },
      right: node.value
    };
    node.operator = "=";
  }
}
    
    return node;
  }
  
  
  normalizeUpdateToExpr(update, loopVarName) {
    
    // 1. i++ / i--
    if (update.type === "UNARY_EXPRESSION") {
      const op = update.operator === "++" ? "+" : "-";
      return {
        type: "ASSIGNMENT",
        name: update.argument.name,
        operator: "=",
        value: {
          type: "BINARY_EXPRESSION",
          left: {
            type: "variable",
            name: update.argument.name
          },
          operator: op,
          right: {
            type: "int",
            value: 1
          }
        }
      };
    }
    
    // 2. i += 3, i -= 3, etc — normalize compound to plain assignment
    if (update.type === "ASSIGNMENT" && update.operator) {
      if (COMPOUND_OPERATORS.includes(update.operator)) {
        return this.normalizeCompound(update);
      }
      // plain i = expr — already an assignment, pass through
      return update;
    }
    
    this.emitError("SyntaxError", `Invalid update expression in loop`, update)
  }
  
  getDeepestGeneric(generic) {
    let cur = generic;
    
    while (cur?.generic) {
      cur = cur.generic;
    }
    
    return cur?.type || null;
  }
  
  constEval(node, context) {
    if (node.type === "int") return node.value;
    
    if (node.type === "BINARY_EXPRESSION") {
      const l = this.constEval(node.left, context);
      const r = this.constEval(node.right, context);
      
      if (typeof l === "number" && typeof r === "number") {
        switch (node.operator) {
          case "+":
            return l + r;
          case "-":
            return l - r;
          case "*":
            return l * r;
          case "/":
            return Math.floor(l / r);
        }
      }
    }
    
    this.emitError("ConstError", `Cannot use a non-constant expression in '${context}'`, node)
  }
  
  generateScreenString(typeInfo) {
    
    if (!typeInfo) {
      return "unknown";
    }
    
    if (typeInfo.type !== "List") {
      return typeInfo.type;
    }
    
    const inner = this.generateScreenString(
      typeInfo.generic
    );
    
    return `List<${inner}>`;
  }
}
