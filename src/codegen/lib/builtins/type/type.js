export class Type {
  constructor(IRB, expr) {
    this.IRB = IRB;
    this.expr = expr;
  }
  
  type(node) {
    
    const args = node.args;
    
    if (args[0].length > 1) {
      this.IRB.emitError("ArgumentError", "Function type() accept exactly 1 argument", node);
    }
    
    const expr = this.expr.handleExpression(args[0]);
    
    let type;
    if (expr.llvmType.startsWith("[")) {
      type = `array<${expr.type}>`;
    } else if (expr.isMap) {
      type = "Map";
    } else if (expr.isList) {
      type = this.IRB.generateScreenString(expr?.generic);
    } else {
      type = expr.type;
    }
    
    const str = this.IRB.newGlobalString(type);
    
    this.IRB.emitExpr(expr)
    
    return {
      ptr: expr.ptr,
      llvmType: "i8*",
      type: "string",
      isConstant: true,
      local: [],
      global: []
    }
  }
  
  Int(node) {
    
    const args = node.args;
    
    if (args[0].length > 1) {
      this.IRB.emitError("ArgumentError", "Function Int() accept exactly 1 argument", node);
    }
    
    const expr = this.expr.handleExpression(args[0]);
    
    this.IRB.emitExpr(expr);
    
    if (expr?.llvmType.startsWith("[") || expr?.isMap || expr?.isList || expr?.isStruct) {
      this.IRB.emitError("TypeError", `Int() cannot cast array or Map or List to int`, node);
    }
    const cast = this.IRB.castExpression(expr, "int");
    this.IRB.emit(cast?.local.join("\n"))
    return {
      ptr: cast.ptr,
      type: "int",
      llvmType: "i32",
      local: [],
      global: [],
      isConstant: true,
      postOrPrefix: false
    }
  }
  
  toInt(node) {
    
    const args = node.args;
    
    if (args[0].length > 1) {
      this.IRB.emitError("ArgumentError", "Function Int() accept exactly 1 argument", node);
    }
    
    const expr = this.expr.handleExpression(args[0]);
    
    this.IRB.emitExpr(expr)
    
    if (expr.llvmType.startsWith("[") || expr?.isMap || expr?.isList || expr?.isStruct) {
      this.IRB.emitError("TypeError", `toInt() cannot cast array or Map or List to int`, node);
    }
    const cast = this.IRB.castExpression(expr, "int", "toInt");
    this.IRB.emit(cast?.local.join("\n"))
    return {
      ptr: cast.ptr,
      type: "int",
      llvmType: "i32",
      local: [],
      global: [],
      isConstant: true,
      postOrPrefix: false
    }
  }
  
  Double(node) {
    
    const args = node.args;
    
    if (args[0].length > 1) {
      this.IRB.emitError("ArgumentError", "Function Double() accept exactly 1 argument", node);
    }
    
    const expr = this.expr.handleExpression(args[0]);
    if (expr.llvmType.startsWith("[") || expr?.isMap || expr?.isList || expr?.isStruct) {
      this.IRB.emitError("TypeError", `Double() cannot cast array or Map or List to double`, node);
    }
    this.IRB.emitExpr(expr)
    
    const cast = this.IRB.castExpression(expr, "double");
    this.IRB.emit(cast?.local.join("\n"))
    return {
      ptr: cast.ptr,
      type: "double",
      llvmType: "double",
      local: [],
      global: [],
      isConstant: true,
      postOrPrefix: false
    }
  }
  
  Bool(node) {
    
    const args = node.args;
    
    if (args[0].length > 1) {
      this.IRB.emitError("ArgumentError", "Function Bool() accept exactly 1 argument", node);
    }
    
    const expr = this.expr.handleExpression(args[0]);
    if (expr.llvmType.startsWith("[") || expr?.isMap || expr?.isList || expr?.isStruct) {
      this.IRB.emitError("TypeError", `Bool() cannot cast array or Map or List to bool`, node);
    }
    this.IRB.emitExpr(expr)
    
    const cast = this.IRB.castExpression(expr, "bool");
    this.IRB.emit(cast?.local.join("\n"))
    return {
      ptr: cast.ptr,
      type: "bool",
      llvmType: "i1",
      local: [],
      global: [],
      isConstant: true,
      postOrPrefix: false
    }
  }
  
  StringCast(node) {
    
    const args = node.args;
    
    if (args[0].length > 1) {
      this.IRB.emitError("ArgumentError", "Function Bool() accept exactly 1 argument", node);
    }
    
    const expr = this.expr.handleExpression(args[0]);
    if (expr.llvmType.startsWith("[") || expr?.isMap || expr?.isList || expr?.isStruct) {
      this.IRB.emitError("TypeError", `String() cannot cast array or Map or List to string`, node);
    }
    this.IRB.emitExpr(expr)
    
    const cast = this.IRB.castExpression(expr, "string");
    this.IRB.emit(cast?.local.join("\n"))
    return {
      ptr: cast.ptr,
      type: "string",
      llvmType: "i8*",
      local: [],
      global: [],
      isConstant: true,
      postOrPrefix: false
    }
  }
  
  toString(node) {
    
    const args = node.args;
    
    if (args[0].length > 1) {
      this.IRB.emitError("ArgumentError", "Function Bool() accept exactly 1 argument", node);
    }
    
    const expr = this.expr.handleExpression(args[0]);
    if (expr.llvmType.startsWith("[") || expr?.isMap || expr?.isList || expr?.isStruct) {
      this.IRB.emitError("TypeError", `toString() cannot cast array or Map or List to string`, node);
    }
    this.IRB.emitExpr(expr)
    
    const cast = this.IRB.castExpression(expr, "string", "toString");
    this.IRB.emit(cast?.local.join("\n"))
    return {
      ptr: cast.ptr,
      type: "string",
      llvmType: "i8*",
      local: [],
      global: [],
      isConstant: true,
      postOrPrefix: false
    }
  }
}