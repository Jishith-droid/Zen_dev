import { FORMAT_MAP } from "../../../../config/config.js";

export class IO {
  constructor(IRB, expr) {
    this.IRB = IRB;
    this.expr = expr;
  }
  
  screen(node) {
    const args = node.args;
    
    this.IRB.declareOneTime("printf", "declare i32 @printf(i8*, ...)");
    this.IRB.declareOneTime("fflush", "declare i32 @fflush(i8*)");
    
    if (args.length > 2) {
      this.IRB.emitError("ArgumentError", "screen() takes exactly upto 2 arguments", node);
    }
    
    let strFrmt = "%s\n"; // default str format
    const arg = args[0]; // first arg
    
    if (args.length === 2) {
      if (args[1].type === "string") {
        strFrmt = args[1].value;
      } else {
        this.IRB.emitError("ArgumentError", "screen() second parameter should be string", node);
      }
    }
    
    
    const isFunction = arg?.type === "variable" && this.IRB.functions.has(arg.name)
    
    let expr;
    let type;
    let s;
    let valuePtr;
    if (isFunction) {
      
      s = `Function<${arg.name}>`;
      
      type = "string";
    } else {
      
      arg.line = node?.line;
      arg.column = node?.column;
      
      expr = this.expr.handleExpression(arg, false);
      
      if (expr.local.length) this.IRB.emit(expr.local.join("\n"));
      if (expr.global.length) this.IRB.globals.push(expr.global.join("\n"));
      type = expr.type;
      valuePtr = expr.ptr;
    }
    
    if (expr.isMap) {
      s = "Map";
      type = "string";
    }
    
    if (expr.isArray) {
      s = "<array>"
      type = "string";
    }
    
    if (expr?.isStruct) {
      s = `struct<${expr.type}>`;
      type = "string"
    }
    
    if (typeof expr?.generic === "object" && expr?.isList) {
      s = this.IRB.generateScreenString(expr.generic);
      type = "string";
    }
    
    if (s) {
      const string = this.IRB.newGlobalString(s);
      valuePtr = string.name;
    }
    
    switch (type) {
      case "int":
        this.IRB.emitScreenInt(valuePtr);
        break;
        
      case "double":
        this.IRB.emitScreenDouble(valuePtr);
        break;
        
      case "string":
        this.IRB.emitScreenString(valuePtr, strFrmt);
        break;
        
      case "bool":
        this.IRB.emitScreenBool(valuePtr);
        break;
        
      default:
        this.IRB.emitError("TypeError", `screen() unsupported type: ${type}`, node);
    }
  }
  
  input(node, globalScope) {
    
    this.IRB.declareOneTime(
      "sys_input",
      "declare ptr @sys_input(ptr)"
    );
    
    const args = node?.value?.args || node?.args;
    
    const ptr = this.IRB.newTemp();
    
    let promptPtr = "null";
    
    if (args.length !== 0) {
      
      if (args.length > 1) {
        this.IRB.emitError(
          "ArgumentError",
          `input() expects 0 or 1 argument, but got ${args.length}`,
          node
        );
      }
      
      const expr = this.expr.handleExpression(args[0]);
      const displayType = expr?.isList ? "List" : expr.type;
      
      if (expr.type !== "string" && expr.isList) {
        this.IRB.emitError(
          "TypeError",
          `input() prompt must be string, got ${displayType}`,
          args[0]
        );
      }
      this.IRB.emitExpr(expr);
      
      promptPtr = expr.ptr;
    }
    
    this.IRB.emit(
      `${ptr} = call ptr @sys_input(ptr ${promptPtr})`
    );
    
    return {
      ptr,
      type: "string",
      llvmType: "ptr",
      needsLoad: false,
      local: [],
      global: []
    };
  }
}
