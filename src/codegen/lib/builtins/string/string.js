export class ZenString {
  constructor(IRB, expr) {
    this.IRB = IRB;
    this.expr = expr;
  }
  
  length(node) {
    
    const args = node.args;
    
    if (args[0].length > 1) {
      this.IRB.emitError("ArgumentError", "Function type() accept exactly 1 argument", node);
    }
    
    const expr = this.expr.handleExpression(args[0]);
    
    const isArray = expr.llvmType.startsWith("[");
    const isString = expr.type === "string";
    const isList = expr?.isList;
    
    if ((!isString && !isArray) || (isList || expr?.isStruct)) {
      this.IRB.emitError(
        "TypeError",
        "The length() function expects a string or array argument.", node
      );
    }
    
    
    this.IRB.emitExpr(expr)
    
    this.IRB.declareOneTime("strlen", "declare i32 @strlen(i8*)");
    
    let finalPtr = null;
    
      if (!isArray) {
        const t = this.IRB.newTemp();
        this.IRB.emit(`${t} = call i32 @strlen(i8* ${expr.ptr})`);
        
        finalPtr = t;
        
      } else {
        finalPtr = expr.length;
      }
    
    return {
      ptr: finalPtr,
      type: "int",
      llvmType: "i32",
      local: [],
      global: [],
      isConstant: true,
      postOrPrefix: false
    }
    
  }
}