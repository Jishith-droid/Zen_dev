import { NON_STANDALONE_BUILTINS, OS_MAP, FILE_MAP, TIME_MAP, NETWORK_MAP, SYS_MAP, HTTP_MAP, STD_FUNCTIONS } from '/src/config/config.js';

export class Call {
  constructor(IRB, expr, io, type, string, error, file, os, time, network, http, sys) {
    this.IRB = IRB;
    this.io = io;
    this.type = type;
    this.string = string;
    this.error = error;
    this.file = file;
    this.os = os;
    this.time = time;
    this.network = network;
    this.http = http;
    this.sys = sys;
  }
  
  setExpression(expr) {
    this.expr = expr;
  }
  
  handleCall(node, asStatement = false, globalScope) {
    
    this.IRB.guardStackOp("CALL", node);
    this.IRB.enterFunction(node.name);
    const isMethodCall = !!node?.callee;
    
    if (isMethodCall) {
      const fakeNode = {
        type: "MEMBER_ACCESS",
        field: node.callee.field,
        object: node.callee.object,
        args: node.args
      }
      
      const valExpr = this.expr.handleExpression(fakeNode);
      
      this.IRB.emitExpr(valExpr);
      
      return {
        ptr: valExpr.ptr,
        type: valExpr.type,
        llvmType: valExpr.llvmType,
        local: valExpr.local,
        global: valExpr.global,
        endLabel: null,
        isVarRef: false,
        postOrPrefix: false,
        isList: valExpr?.isList,
        generic: valExpr?.generic
      };
    }
    
    const name = node.name;
    
    if (STD_FUNCTIONS.includes(name)) {
      this.IRB.usedStdFunctions.add(name);
      if (!this.IRB.functions.has(name)) {
        this.IRB.setStdlibFunctions();
      }
    }
    
    if (node.isInbuilt && !STD_FUNCTIONS.includes(name)) {
      
      this.IRB.leaveFunction();
      return this.handleBuiltInCall(node, globalScope);
    }
    
    if (node.isAwait && !this.IRB.currentFunction.isAsync) {
      this.IRB.emitError(
        "SyntaxError",
        "await can only be used inside async functions", node
      );
    }
    
    const fn = this.IRB.getFunction(name);
    
    const hasRest = fn.params.some(p => p.isRest);
    
    const finalArgs = [...node.args];
    
    for (let i = finalArgs.length; i < fn.params.length; i++) {
      
      const param = fn.params[i];
      
      if (param.default) {
        finalArgs.push(param.default);
      }
    }
    
    const args = [];
    let global = [];
    let local = [];
    
    // Evaluate all arguments
    
    for (const arg of finalArgs) {
      
      const val = this.expr.handleExpression(arg, false);
      
      if (val.type === "void") {
        this.IRB.emitError("TypeError", "void value used in expression", node);
      }
      
      this.IRB.emitExpr(val);
      
      args.push(val);
    }
    
    // REST INDEX
    
    let restIndex = -1;
    
    if (hasRest) {
      restIndex = fn.params.findIndex(p => p.isRest);
    }
    
    this.IRB.validateCallArgs(fn, args, hasRest, restIndex, node);
    
    let layout = null;
    if (fn.returnType === "Map") {
      
      layout = fn.layout;
    }
    
    let argStr = [];
    
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      const param = fn.params[i];
      
      // ── Map layout aliasing ──
      if (param?.isMap || param?.type.type === "Map") {
        const argNode = finalArgs[i];
        const argName = argNode?.name; // "b"
        const layoutt = this.IRB.maps.get(argName);
        layout = layoutt;
        if (layout) {
          
          this.IRB.maps.set(param.name, layoutt); // "a" same layout as "b"
        }
      }
    }
    
    // REST CALL HANDLING (List based)
    
    if (hasRest) {
      
      // declare runtime once
      this.IRB.declareOneTime(
        "zen_list_new",
        "declare ptr @zen_list_new(i64)"
      );
      
      this.IRB.declareOneTime(
        "zen_list_push",
        "declare void @zen_list_push(ptr, ptr)"
      );
      
      this.IRB.declareOneTime(
        "ZenList",
        `%ZenList = type { ptr, i32, i32, i64 }`
      );
      
      const fixedArgs = args.slice(0, restIndex);
      const restArgs = args.slice(restIndex);
      
      let argStr = [];
      let global = [];
      let local = [];
      
      // FIXED ARGS
      
      for (const a of fixedArgs) {
        
        if (a.global?.length) global.push(...a.global);
        if (a.local?.length) local.push(...a.local);
        
        // handle pointer-level correctly
        if (a.isList) {
          const tmp = this.IRB.newTemp();
          local.push(`${tmp} = load ptr, ptr ${a.ptr}`);
          argStr.push(`ptr ${tmp}`);
        } else {
          argStr.push(`${a.llvmType} ${a.ptr}`);
        }
      }
      
      // REST TYPE VALIDATION
      
      const first = restArgs[0];
      // declared rest param type
      const restParam = fn.params[restIndex];
      
      // expected type from function signature
      const expectedType = restParam?.type?.type || restParam?.type;
      
      // inferred from first argument
      const inferredType = first?.type;
      
      if (!first) {
        this.IRB.emitError(
          "TypeError",
          `Rest parameter expects at least 1 argument`, node
        );
      }
      
      // 1. declared type vs inferred type check
      if (expectedType && inferredType && expectedType !== inferredType) {
        this.IRB.emitError(
          "TypeError",
          `Rest parameter expects ${expectedType} but got ${inferredType}`, node
        );
      }
      
      // 2. validate ALL rest args
      for (const a of restArgs) {
        const t = a.type;
        
        if (expectedType && t !== expectedType) {
          this.IRB.emitError(
            "TypeError",
            `Rest parameter expects ${expectedType} but got ${t}`, node
          );
        }
      }
      
      const elementSize = this.IRB.sizeOf(inferredType);
      const llvmType = this.IRB.getLLVMType(inferredType);
      const listPtr = this.IRB.newTemp();
      
      local.push(
        `${listPtr} = call ptr @zen_list_new(i64 ${elementSize})`
      );
      
      const count = restArgs.length;
      
      for (let i = 0; i < count; i++) {
        
        const a = restArgs[i];
        
        const tmp =
          this.IRB.newTemp();
        
        local.push(`${tmp} = alloca ${llvmType}`);
        
        local.push(`store ${llvmType} ${a.ptr}, ptr ${tmp}`);
        
        local.push(
          `call void @zen_list_push(ptr ${listPtr}, ptr ${tmp})`
        );
      }
      
      // PASS VARARGS LIST
      
      argStr.push(`ptr ${listPtr}`);
      
      // EMIT CALL
      
      let callTmp = null;
      
      if (fn.returnType === "void") {
        
        local.push(
          `call void @${name}(${argStr.join(", ")})`
        );
        
      } else {
        
        callTmp = this.IRB.newTemp();
        
        local.push(
          `${callTmp} = call ${this.IRB.getLLVMType(fn.returnType)} @${name}(${argStr.join(", ")})`
        );
      }
      
      if (asStatement) {
        this.IRB.emit(local.join("\n"));
        this.IRB.globals.push(global.join("\n"));
      }
      const isList = fn.returnType === "List";
      const isMap = fn.returnType === "Map";
      return {
        ptr: callTmp,
        type: fn.returnType,
        llvmType: isList ?
          "%ZenList" : this.IRB.getLLVMType(fn.returnType),
        generic: isList ? fn.generic : null,
        local: asStatement ? [] : local,
        global: asStatement ? [] : global,
        endLabel: null,
        isVarRef: false,
        postOrPrefix: false,
        layout,
        needsLoad: false,
        isList,
        isMap,
        isDirectCall: true
      };
    }
    
    // NORMAL CALL HANDLING
    
    for (const a of args) {
      
      if (a.needsLoad) {
        const tmp = this.IRB.newTemp();
        local.push(`${tmp} = load ptr, ptr ${a.ptr}`);
        argStr.push(`ptr ${tmp}`);
      } else {
        if (a.isList) {
          argStr.push(`ptr ${a.ptr}`);
        } else {
          argStr.push(`${a.llvmType} ${a.ptr}`);
        }
      }
    }
    
    if (fn.returnType === "void") {
      local.push(`call void @${name}(${argStr.join(", ")})`);
      
      if (asStatement) {
        this.IRB.emit(local.join("\n"));
        this.IRB.globals.push(global.join("\n"));
      }
      
      return {
        ptr: null,
        type: "void",
        llvmType: "void",
        local: asStatement ? [] : local,
        global: asStatement ? [] : global,
        endLabel: null,
        isVarRef: false,
        postOrPrefix: false,
        layout
      };
    }
    
    const tmp = this.IRB.newTemp();
    
    local.push(
      `${tmp} = call ${this.IRB.getLLVMType(fn.returnType)} @${name}(${argStr.join(", ")})`
    );
    
    if (asStatement) {
      this.IRB.emit(local.join("\n"));
      this.IRB.globals.push(global.join("\n"));
    }
    
    const isList = fn.returnType === "List";
    const isMap = fn.returnType === "Map";
    return {
      ptr: tmp,
      type: isList ? fn.retGeneric : fn.returnType,
      llvmType: isList ?
        "%ZenList" : this.IRB.getLLVMType(fn.returnType),
      local: asStatement ? [] : local,
      global: asStatement ? [] : global,
      endLabel: null,
      isVarRef: false,
      generic: fn.returnType === "List" ? fn.generic : null,
      postOrPrefix: false,
      layout,
      needsLoad: false, // call not need load
      isList,
      isMap,
      isDirectCall: true
    };
  }
  
  
  // built in function routing
  
  handleBuiltInCall(node, globalScope) {
    
    this.IRB.guardStackOp("CALL", node);
    
    let name = null;
    const type = node?.type;
    
    if (type === "VARIABLE_DECLARATION" || type === "VARIABLE_REFERENCE") {
      name = node.value.name;
    } else {
      name = node.name;
    }
    
    switch (name) {
      case 'screen':
        this.io.screen(node);
        break;
        
      case 'input':
        this.io.input(node, globalScope);
        break;
        
      case 'type':
        return this.type.type(node, globalScope);
        
      case 'Int':
        return this.type.Int(node, globalScope);
        
      case 'Double':
        return this.type.Double(node, globalScope);
        
      case 'Bool':
        return this.type.Bool(node, globalScope);
        
      case 'String':
        return this.type.StringCast(node, globalScope);
        
      case 'toString':
        return this.type.toString(node, globalScope);
        
      case 'toInt':
        return this.type.toInt(node, globalScope);
        
      case 'length':
        return this.string.length(node, globalScope);
        
      case 'panic':
        return this.error.panic(node);
        
        // these are same pattern functions 
        // unified
      case name: {
        const os = OS_MAP[name];
        const file = FILE_MAP[name];
        const time = TIME_MAP[name];
        const NW = NETWORK_MAP[name];
        const HTTP = HTTP_MAP[name];
        const SYS = SYS_MAP[name];
        
        if (os) {
          return this.os.zenNativeOSCall(
            node,
            globalScope,
            os[0],
            os[1],
            os[2],
            os[3],
            name
          );
        } else if (file) {
          return this.file.zenNativeFILECall(
            node,
            globalScope,
            file[0],
            file[1],
            file[2],
            file[3],
            name
          );
        } else if (time) {
          
          return this.time.zenNativeTIMECall(
            node,
            globalScope,
            time[0],
            time[1],
            time[2],
            time[3],
            name
          );
        } else if (NW) {
          return this.network.zenNativeNWCall(
            node,
            globalScope,
            NW[0],
            NW[1],
            NW[2],
            NW[3],
            name
          );
        } else if (HTTP) {
          return this.
          http.zenNativeHTTPCall(
            node,
            globalScope,
            HTTP[0],
            HTTP[1],
            HTTP[2],
            HTTP[3],
            name
          );
        } else if (SYS) {
          return this.sys.zenNativeSYSCall(
            node,
            globalScope,
            SYS[0],
            SYS[1],
            SYS[2],
            SYS[3],
            name
          );
        }
        
      }
      
      default:
        this.IRB.emitError("InternalError", `unknown builtin function ${name}`, node);
    }
  }
}