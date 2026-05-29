export class ZenHttp {
  constructor(IRB, expr) {
    this.IRB = IRB;
    this.expr = expr;
  }
  zenNativeHTTPCall(node, globalScope, funcName, returnType, paramCount = 0, params, name) {
    
    const isVarDecl = node.type === "VARIABLE_DECLARATION";
    const isVarRef = node.type === "VARIABLE_REFERENCE";
    const isAwait = node.isAwait;
    
    const args = isVarDecl || isVarRef ? node.value.args : node.args;
    
    if (args.length !== paramCount) {
      this.IRB.emitError(
        "ArgumentError",
        `Function ${name} accept exactly ${paramCount} argument(s)`, node
      );
    }
    
    // -------------------------
    // Expression evaluation
    // -------------------------
    const exprs = args.map(arg => this.expr.handleExpression(arg));
    
    exprs.forEach((expr, i) => {
      const actualType = expr.type;
      const expectedType = params[i];
      
      if (actualType !== expectedType) {
        this.IRB.emitError(
          "TypeError",
          `Function ${name} expects ${expectedType} at arg ${i + 1}, got ${actualType}`, node
        );
      }
    });
    
    // -------------------------
    // Arg type mapper
    // -------------------------
    const getArgType = (e) => {
      switch (e) {
        case "int":
          return "i32";
        case "double":
          return "double";
        case 'bool':
          return "i1";
        case "string":
          return "i8*";
        default:
          this.IRB.emitError("TypeError", `Unsupported arg type: ${e}`, node);
      }
    };
    
    // -------------------------
    // Emit inner code first
    // -------------------------
    exprs.forEach(e => {
      if (e.local?.length) this.IRB.emit(e.local.join("\n"));
      if (e.global?.length) this.IRB.emit(e.global.join("\n"));
    });
    
    // -------------------------
    // Build LLVM call args safely
    // -------------------------
    const callArgs = exprs.map(e => {
      const t = getArgType(e.type);
      return `${t} ${e.ptr}`;
    }).join(", ");
    
    const llvmRet = this.IRB.getLLVMType(returnType);
    
    // -------------------------
    // Function declaration (once)
    // -------------------------
    this.IRB.declareOneTime(
      funcName,
      `declare ${llvmRet} @${funcName}(${exprs.map(e => getArgType(e.type)).join(", ")})`
    );
    
    let isConstant;
    let ptr = null;
    
    // -------------------------
    // VARIABLE DECLARATION
    // -------------------------
    if (isVarDecl) {
      const name = node.name;
      const gName = this.IRB.newGlobalTemp();
      const lName = this.IRB.newTemp();
      const declaredType = node.dataType;
      const llvmType = this.IRB.getLLVMType(declaredType);
      isConstant = node.isConstant;
      
      const t = this.IRB.newTemp();
      this.IRB.emit(`${t} = call ${llvmRet} @${funcName}(${callArgs})`);
      
      if (isAwait) {
          this.IRB.emit(`%res = call i8* @zen.coro.await(i8* %ctx, i8* ${t})`);
     }
      
      if (globalScope) {
        const initialValue = this.IRB.initialValue(declaredType);
        this.IRB.globals.push(`${gName} = global ${llvmRet} ${initialValue}`);
        this.IRB.emit(`store ${llvmType} ${t}, ${llvmType}* ${gName}`);
        ptr = gName;
      } else {
        this.IRB.emitAlloca(llvmType, lName);
        this.IRB.emit(`store ${llvmType} ${t}, ${llvmType}* ${lName}`);
        ptr = lName;
      }
      
      this.IRB.setVar(name, this.IRB.createData({
        ptr: globalScope ? gName : lName,
        llvmType,
        type: declaredType,
        isConstant,
        isGlobal: globalScope
      }));
      
      this.IRB.logSymbolTable();
    }
    
    // -------------------------
    // VARIABLE REFERENCE
    // -------------------------
    if (isVarRef) {
      const data = this.IRB.getVar(node.name);
      isConstant = data.isConstant;
      
      const ptr = data.ptr;
      ptr = ptr;
      const llvmType = data.llvmType;
      
      const t = this.IRB.newTemp();
      this.IRB.emit(`${t} = call ${llvmRet} @${funcName}(${callArgs})`);
      
      if (isAwait) {
          this.IRB.emit(`%res = call i8* @zen.coro.await(i8* %ctx, i8* ${t})`);
     }
      
      this.IRB.emit(`store ${llvmType} ${t}, ${llvmType}* ${ptr}`);
    }
    
    // -------------------------
    // PURE CALL (no assignment)
    // -------------------------
    if (!isVarDecl && !isVarRef) {
      const t = this.IRB.newTemp();
      this.IRB.emit(`${t} = call ${llvmRet} @${funcName}(${callArgs})`);
      
      if (isAwait) {
          this.IRB.emit(`%res = call i8* @zen.coro.await(i8* %ctx, i8* ${t})`);
     }
      ptr = t;
    }
    
    // -------------------------
    // Return ZEN IR object
    // -------------------------
    return {
      ptr,
      type: returnType,
      llvmType: llvmRet,
      local: [],
      global: [],
      isGlobal: globalScope,
      isConstant,
      postOrPrefix: false
    };
  }
}