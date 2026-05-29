export class Ternary {
  constructor(IRB, expr) {
    this.IRB = IRB;
    this.expr = expr;
  }

ternary(node) {
  
  const cond = this.expr.handleExpression(node.condition);

  if (cond.local?.length) {
    this.IRB.emit(cond.local.join("\n"));
  }

  const trueLabel = this.IRB.newLabel("ternary_true");
  const falseLabel = this.IRB.newLabel("ternary_false");
  const mergeLabel = this.IRB.newLabel("ternary_merge");

  // evaluate BOTH expressions early (SSA safety)
  const t = this.expr.handleExpression(node.trueExpr);
  const f = this.expr.handleExpression(node.falseExpr);

  if (t.local?.length) this.IRB.emit(t.local.join("\n"));
  if (f.local?.length) this.IRB.emit(f.local.join("\n"));

  // type must match
  const resultType = t.llvmType;
  

   const toBool = (val, type) => {
        if (type === "bool") {
          
          return val;
        }
        
        const t = this.IRB.newTemp();
        
        if (type === "int") {
          this.IRB.emit(`${t} = icmp ne i32 ${val}, 0`);
        }
        else if (type === "double") {
          this.IRB.emit(`${t} = fcmp one double ${val}, 0.0`);
        }
        else if (type === "string") {
          const t0 = this.IRB.newTemp();
          this.IRB.emit(`${t0} = load i8, i8* ${val}`);
          this.IRB.emit(`${t} = icmp ne i8 ${t0}, 0`);
        }
        else {
          this.IRB.emitError("TypeError", `Cannot convert ${type} to bool`, node);
        }
        
        return t;
     }
     
     const boolPtr = toBool(cond.ptr, cond.type);
  
  // branch
  this.IRB.emit(
    `br i1 ${boolPtr}, label %${trueLabel}, label %${falseLabel}`
  );

  // =========================
  // TRUE BLOCK
  // =========================
  this.IRB.emit(`${trueLabel}:`);
  this.IRB.emit(`br label %${mergeLabel}`);

  // =========================
  // FALSE BLOCK
  // =========================
  this.IRB.emit(`${falseLabel}:`);
  this.IRB.emit(`br label %${mergeLabel}`);

  // =========================
  // MERGE (PHI)
  // =========================
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