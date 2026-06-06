export class OS {
  constructor(IRB, expr) {
    this.IRB = IRB;
    this.expr = expr;
  }
  zenNativeOSCall(node, globalScope, funcName, returnType, paramCount = 0, params, name) {
    
    if (returnType === "void") {
      const args = node.args;
      
      if (args.length !== paramCount) {
        this.IRB.emitError(
          "ArgumentError",
          `Function ${name} accept exactly ${paramCount} argument(s)`, node
        );
      }
      
      // Expression evaluation

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
      

      // Arg type mapper

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
      
      // Emit inner code first

      exprs.forEach(e => {
        if (e.local?.length) this.IRB.emit(e.local.join("\n"));
        if (e.global?.length) this.IRB.emit(e.global.join("\n"));
      });
      
      // Build LLVM call args safely

      const callArgs = exprs.map(e => {
        const t = getArgType(e.type);
        return `${t} ${e.ptr}`;
      }).join(", ");
      
      const llvmRet = "void";

      // Function declaration 

      this.IRB.declareOneTime(
        funcName,
        `declare ${llvmRet} @${funcName}(${exprs.map(e => getArgType(e.type)).join(", ")})`
      );
      
      this.IRB.emit(`call ${llvmRet} @${funcName}(${callArgs})`);
        return;
    }
    
    const args = node.args;
    
    if (args.length !== paramCount) {
      this.IRB.emitError(
        "ArgumentError",
        `Function ${name} accept exactly ${paramCount} argument(s)`, node
      );
    }
    
    // Expression evaluation

    const exprs = args.map(arg => this.expr.handleExpression(arg));
    
    exprs.forEach((expr, i) => {
      const actualType = expr.type;
      const expectedType = params[i];
      const isList = expr?.isList;
      const displayType = isList ?
        `List` :
        actualType;
      
      if (isList || (expectedType !== actualType)) {
      
        this.IRB.emitError(
          "TypeError",
          `Function ${name} expects ${expectedType} at arg ${i + 1}, got ${displayType}`, node.args[i]
        );
      }
    });
    
    // Arg type mapper

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
    
    // Emit inner code first

    exprs.forEach(e => {
      if (e.local?.length) this.IRB.emit(e.local.join("\n"));
      if (e.global?.length) this.IRB.emit(e.global.join("\n"));
    });
    
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
    
  
      const t = this.IRB.newTemp();
      this.IRB.emit(`${t} = call ${llvmRet} @${funcName}(${callArgs})`);
    
    return {
      ptr: t,
      type: returnType,
      llvmType: llvmRet,
      local: [],
      global: [],
      postOrPrefix: false
    };
  }
}