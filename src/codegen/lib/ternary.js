export class Ternary {
  constructor(IRB, expr) {
    this.IRB = IRB;
    this.expr = expr;
  }
  
  ternary(node) {
    
    const cond = this.expr.handleExpression(node.condition);
    
    this.IRB.emitExpr(cond);
    
    const trueLabel = this.IRB.newLabel("ternary_true");
    const falseLabel = this.IRB.newLabel("ternary_false");
    const mergeLabel = this.IRB.newLabel("ternary_merge");
    
    // evaluate BOTH expressions early 
    const t = this.expr.handleExpression(node.trueExpr);
    const f = this.expr.handleExpression(node.falseExpr);
    
    this.IRB.emitExpr(t);
    this.IRB.emitExpr(f);
    
    // type must match
    const resultType = t.llvmType;
    
    
    const boolPtr = this.IRB.toBool(cond.ptr, cond.type);
    
    // branch
    this.IRB.emit(
      `br i1 ${boolPtr}, label %${trueLabel}, label %${falseLabel}`
    );
    
    // TRUE BLOCK
    
    this.IRB.emit(`${trueLabel}:`);
    this.IRB.emit(`br label %${mergeLabel}`);
    
    // FALSE BLOCK
    
    this.IRB.emit(`${falseLabel}:`);
    this.IRB.emit(`br label %${mergeLabel}`);
    
    // MERGE PHI
    
    this.IRB.emit(`${mergeLabel}:`);
    
    const result = this.IRB.newTemp();
    
    this.IRB.emit(
      `${result} = phi ${resultType} ` +
      `[ ${t.ptr}, %${trueLabel} ], ` +
      `[ ${f.ptr}, %${falseLabel} ]`
    );
    
    return {
      ptr: result,
      type: t.type || f.type,
      llvmType: resultType,
      local: [],
      global: [],
      isVarRef: false
    };
  }
}