import { SCALAR_TYPES } from '/src/config/config.js';

export class Loop {
  constructor(IRB, expr, variable, block) {
    this.IRB = IRB;
    this.variable = variable;
    this.block = block;
    this.expr = expr;
  }
  
  loop(node) {
    
    this.IRB.guardStackOp("LOOP", node);
    
    const { init, condition, update } = node;
    
    this.IRB.enterScope();
    
    if (init !== null) {
      // ===== init =====
      if (SCALAR_TYPES.includes(init.dataType)) {
        this.variable.scalarVariable(init, false);
      } else {
        this.variable.stringVariable(init, false);
      }
    }
    
    const condLabel = this.IRB.newLabel("loopCond");
    const bodyLabel = this.IRB.newLabel("loopBody");
    const endLabel = this.IRB.newLabel("loopEnd");
    const updateLabel = this.IRB.newLabel("loopUpdate");
    
    this.IRB.loopStack.push({
      breakLabel: endLabel,
      continueLabel: updateLabel
    });
    
    // jump to condition first
    this.IRB.emit(`br label %${condLabel}`);
    
    // ===== condition =====
    this.IRB.emit(`${condLabel}:`);
    
    const expr = this.expr.handleExpression(condition, false);
    
    if (expr.local?.length) this.IRB.emit(expr.local.join("\n"));
    if (expr.global?.length) this.IRB.globals.push(expr.global.join("\n"));
    
    const condPtr =
      expr.llvmType === "i1" ?
      expr.ptr :
      this.IRB.toI1(expr.ptr, expr.llvmType);
    
    this.IRB.emit(`br i1 ${condPtr}, label %${bodyLabel}, label %${endLabel}`);
    
    // ===== body =====
    this.IRB.emit(`${bodyLabel}:`);
    
    this.block.block(node.body, false);
    
    
    this.IRB.emit(`br label %${updateLabel}`);
    
    this.IRB.emit(`${updateLabel}:`);
    
    let updateExpr;
    
    if (update.type === "ASSIGNMENT") {
      const ptr = this.IRB.getVar(update.name).ptr;
      const type = this.IRB.getVar(update.name).type;
      
      updateExpr = this.expr.handleExpression(update.value, false);
      
      if (type !== updateExpr.type) {
        this.IRB.emitError("TypeError", `variable ${update.name} expect ${type} but got ${updateExpr.type}`, node);
      }
      if (updateExpr.local.length) this.IRB.emit(updateExpr.local.join("\n"));
      if (updateExpr.global.length) this.IRB.globals.push(updateExpr.global.join("\n"));
      this.IRB.emitStore(updateExpr.llvmType, updateExpr.ptr, ptr);
      
    } else {
      updateExpr = this.expr.handleExpression(update, false);
      if (updateExpr.local.length) this.IRB.emit(updateExpr.local.join("\n"));
      if (updateExpr.global.length) this.IRB.globals.push(updateExpr.global.join("\n"));
    }
    
    // loop back
    this.IRB.emit(`br label %${condLabel}`);
    
    
    // ===== end =====
    this.IRB.emit(`${endLabel}:`);
    
    this.IRB.loopStack.pop();
    this.IRB.exitScope();
  }
  
  handleBreak() {
    const loop = this.IRB.loopStack[this.IRB.loopStack.length - 1];
    
    if (!loop) {
      this.IRB.emitError("SyntaxError", "break used outside loop");
    }
    
    this.IRB.loopBlockTerminated = true;
    this.IRB.emit(`br label %${loop.breakLabel}`);
  }
  
  handleContinue() {
    const loop = this.IRB.loopStack[this.IRB.loopStack.length - 1];
    
    if (!loop) {
      this.IRB.emitError("SyntaxError", "continue used outside loop");
    }
    
    this.IRB.loopIterationSkipped = true;
    this.IRB.emit(`br label %${loop.continueLabel}`);
  }
  
  whileLoop(node) {
    
    this.IRB.guardStackOp("WHILE_LOOP", node);
    
    const condition = node.condition;
    const body = node.body;
    
    this.IRB.enterScope();
    
    const condLabel = this.IRB.newLabel("whileCond");
    const bodyLabel = this.IRB.newLabel("whileBody");
    const endLabel = this.IRB.newLabel("whileEnd");
    
    this.IRB.loopStack.push({
      breakLabel: endLabel,
      continueLabel: condLabel
    });
    
    // jump to condition first
    this.IRB.emit(`br label %${condLabel}`);
    
    // ===== condition =====
    this.IRB.emit(`${condLabel}:`);
    
    const expr = this.expr.handleExpression(condition, false);
    
    if (expr.local?.length) this.IRB.emit(expr.local.join("\n"));
    if (expr.global?.length) this.IRB.globals.push(expr.global.join("\n"));
    
    const condPtr =
      expr.llvmType === "i1" ?
      expr.ptr :
      this.IRB.toI1(expr.ptr, expr.llvmType);
    
    this.IRB.emit(`br i1 ${condPtr}, label %${bodyLabel}, label %${endLabel}`);
    
    // ===== body =====
    this.IRB.emit(`${bodyLabel}:`);
    
    this.block.block(body, false);
    
    // loop back to condition 
    this.IRB.emit(`br label %${condLabel}`);
    
    // ===== end =====
    this.IRB.emit(`${endLabel}:`);
    
    this.IRB.loopStack.pop();
    this.IRB.exitScope();
  }
  
  doWhileLoop(node) {
    
    this.IRB.guardStackOp("DO_WHILE_LOOP", node);
    
    const body = node.body;
    const condition = node.condition;
    
    this.IRB.enterScope();
    
    const bodyLabel = this.IRB.newLabel("doWhileBody");
    const condLabel = this.IRB.newLabel("doWhileCond");
    const endLabel = this.IRB.newLabel("doWhileEnd");
    
    this.IRB.loopStack.push({
      breakLabel: endLabel,
      continueLabel: condLabel
    });
    
    // =========================
    // ENTRY → BODY FIRST (KEY DIFFERENCE)
    // =========================
    this.IRB.emit(`br label %${bodyLabel}`);
    
    // =========================
    // BODY
    // =========================
    this.IRB.emit(`${bodyLabel}:`);
    
    this.block.block(body, false);
    
    // continue jumps here
    this.IRB.emit(`br label %${condLabel}`);
    
    // =========================
    // CONDITION CHECK
    // =========================
    this.IRB.emit(`${condLabel}:`);
    
    const expr = this.expr.handleExpression(condition, false);
    
    if (expr.local?.length) this.IRB.emit(expr.local.join("\n"));
    if (expr.global?.length) this.IRB.globals.push(expr.global.join("\n"));
    
    const condPtr =
      expr.llvmType === "i1" ?
      expr.ptr :
      this.IRB.toI1(expr.ptr, expr.llvmType);
    
    this.IRB.emit(
      `br i1 ${condPtr}, label %${bodyLabel}, label %${endLabel}`
    );
    
    // =========================
    // END
    // =========================
    this.IRB.emit(`${endLabel}:`);
    
    this.IRB.loopStack.pop();
    this.IRB.exitScope();
  }
  
  
  
  loopOf(node) {
    
    this.IRB.guardStackOp("LOOP_OF", node);
    
    const { varName, iterable, body } = node;
    
    this.IRB.enterScope();
    
    const startLabel = this.IRB.newLabel("arr_start");
    const bodyLabel = this.IRB.newLabel("arr_body");
    const endLabel = this.IRB.newLabel("arr_end");
    const incLabel = this.IRB.newLabel("arr_inc");
    
    this.IRB.loopStack.push({
      breakLabel: endLabel,
      continueLabel: incLabel
    });
    
    // =========================
    // index = 0
    // =========================
    const indexPtr = this.IRB.newTemp();
    this.IRB.emit(`${indexPtr} = alloca i32`);
    this.IRB.emitStore("i32", "0", indexPtr);
    
    // =========================
    // resolve iterable
    // =========================
    const expr = this.expr.handleExpression(iterable, false);
    
    let varType = null;
    let llvmVarType = null;
    
    if (!expr.isArray && !expr.isList) {
      this.IRB.emitError(
        "TypeError",
        "loop of supports only array or list", node
      );
    }
    
    let len;
    if (expr.isArray) {
      len = expr.length;
      varType = expr.type;
      llvmVarType = this.IRB.getLLVMType(varType);
    } else if (expr.isList) {
      
      this.IRB.declareOneTime(
        "zen_list_get",
        "declare ptr @zen_list_get(ptr, i32)"
      );
      varType = expr.type;
      llvmVarType = this.IRB.getLLVMType(varType);
      const gep =
        this.IRB.newTemp();
      let tm = this.IRB.newTemp();
      if (expr.needsLoad) {
        this.IRB.emit(
          `${tm} = load ptr, ptr ${expr.ptr}`
        );
      } else {
        tm = expr.ptr;
      }
      
      this.IRB.emit(
        `${gep} = getelementptr inbounds %ZenList, ptr ${tm}, i32 0, i32 1`
      );
      
      const val =
        this.IRB.newTemp();
      
      this.IRB.emit(
        `${val} = load i32, ptr ${gep}`
      );
      len = val
    }
    
    this.IRB.emit(`br label %${startLabel}`);
    
    // =========================
    // CONDITION
    // =========================
    this.IRB.emit(`${startLabel}:`);
    
    const idxTmp = this.IRB.newTemp();
    this.IRB.emit(`${idxTmp} = load i32, i32* ${indexPtr}`);
    
    const cmpTmp = this.IRB.newTemp();
    this.IRB.emit(
      `${cmpTmp} = icmp slt i32 ${idxTmp}, ${len}`
    );
    
    this.IRB.emit(
      `br i1 ${cmpTmp}, label %${bodyLabel}, label %${endLabel}`
    );
    
    // =========================
    // BODY
    // =========================
    this.IRB.emit(`${bodyLabel}:`);
    
    let elemTmp = this.IRB.newTemp();
    
    if (expr.isArray) {
      
      this.IRB.emit(
        `${elemTmp} = getelementptr ${expr.llvmType}, ptr ${expr.ptr}, i32 0, i32 ${idxTmp}`
      );
      
      const valTmp = this.IRB.newTemp();
      
      this.IRB.emit(
        `${valTmp} = load ${llvmVarType}, ptr ${elemTmp}`
      );
      
      const nextDims =
        expr.dimData?.slice(1);
      
      const isNested =
        expr.dimData?.length > 1;
      /*const nestedLLVM =
        isNested ?
        `[${nextDims[0]} x ${llvmVarType}]` :
        llvmVarType;*/
      const nestedLLVM = isNested ?
        nextDims.reduceRight(
          (inner, dim) => `[${dim} x ${inner}]`,
          llvmVarType
        ) :
        llvmVarType;
      if (isNested) {
        
        this.IRB.setVar(varName, {
          ptr: elemTmp,
          type: varType,
          llvmType: nestedLLVM,
          needsLoad: false,
          isArray: true,
          length: nextDims?.[0],
          dimensionsData: nextDims
        });
        
      } else {
        
        const valTmp = this.IRB.newTemp();
        
        this.IRB.emit(
          `${valTmp} = load ${llvmVarType}, ptr ${elemTmp}`
        );
        
        this.IRB.setVar(varName, {
          ptr: valTmp,
          type: varType,
          llvmType: llvmVarType,
          needsLoad: false,
          isArray: false
        });
      }
    }
    else if (expr.isList) {
      
      let tm = this.IRB.newTemp();
      if (expr.needsLoad) {
        this.IRB.emit(
          `${tm} = load ptr, ptr ${expr.ptr}`
        );
      } else {
        tm = expr.ptr;
      }
      
      const valTmp = this.IRB.newTemp();
      this.IRB.emit(
        `${valTmp} = call ptr @zen_list_get(ptr ${tm}, i32 ${idxTmp})`
      );
      
      
      const nextGeneric =
        expr.generic?.generic ?? expr.generic;
      
      const isNested =
        nextGeneric?.type === "List";
      
      this.IRB.setVar(varName, {
        ptr: valTmp,
        type: varType,
        llvmType: llvmVarType,
        isList: isNested,
        generic: nextGeneric,
        fromLoopOf: true,
        needsLoad: true
      });
      
      
    }
    
    
    this.block.block(body, false);
    
    this.IRB.emit(`br label %${incLabel}`);
    
    // =========================
    // INCREMENT
    // =========================
    this.IRB.emit(`${incLabel}:`);
    
    const incTmp = this.IRB.newTemp();
    this.IRB.emit(
      `${incTmp} = add i32 ${idxTmp}, 1`
    );
    
    this.IRB.emitStore("i32", incTmp, indexPtr);
    
    this.IRB.emit(`br label %${startLabel}`);
    
    // =========================
    // END
    // =========================
    this.IRB.emit(`${endLabel}:`);
    
    this.IRB.loopStack.pop();
    this.IRB.exitScope();
  }
  
  loopIn(node) {
    const { keyName, iterable, body } = node;
    
    this.IRB.guardStackOp("LOOP_IN", node);
    this.IRB.enterScope();
    
    // =========================================
    // RESOLVE MAP POINTER
    // =========================================
    const expr = this.expr.handleExpression(iterable, false);
    
    if (expr.local?.length) this.IRB.emit(expr.local.join("\n"));
    if (expr.global?.length) this.IRB.globals.push(expr.global.join("\n"));
    
    let mapPtr = expr.ptr;
    
    if (expr.needsLoad) {
      const tmp = this.IRB.newTemp();
      this.IRB.emit(`${tmp} = load ptr, ptr ${mapPtr}`);
      mapPtr = tmp;
    }
    
    this.IRB.declareOneTime("zen_map_get", "declare ptr @zen_map_get(ptr, ptr)");
    
    // =========================================
    // GET MAP LAYOUT
    // =========================================
    const mapLayout = this.IRB.maps.get(iterable.name) || expr?.layout;
    if (!mapLayout) {
      this.IRB.emitError("RuntimeError", "Map iteration requires known key layout", node);
      return;
    }
    
    const keys = Object.keys(mapLayout);
    
    const inferredType = mapLayout[keys[0]].type;
    
    const allSame = keys.every(k => mapLayout[k].type === inferredType);
    
    const hasNestedMap = keys.some(k => mapLayout[k].type === "Map");

if (hasNestedMap) {

    this.IRB.emitError(
      "TypeError",
      "loop in doesn't support nested Map",
      node
    );
  }
    
    if (!allSame) {
      this.IRB.emitError(
        "TypeError",
        "loop in requires all map values to be the same type",
        node
      );
    }
    // =========================================
    // PRE-INTERN ALL KEY STRINGS AS GLOBALS
    // =========================================
    const keyPtrs = keys.map((key) => {
      const keyPtr = this.IRB.newGlobalString(key);
      /*  if (keyPtr.local?.length) this.IRB.emit(keyPtr.local);*/
      return keyPtr.name;
    });
    
    // =========================================
    // LOOP LABELS
    // =========================================
    const startLabel = this.IRB.newLabel("map_loop_start");
    const bodyLabel = this.IRB.newLabel("map_loop_body");
    const endLabel = this.IRB.newLabel("map_loop_end");
    const switchLabel = this.IRB.newLabel("map_loop_switch");
    
    this.IRB.loopStack.push({ breakLabel: endLabel, continueLabel: startLabel });
    
    // =========================================
    // INDEX ALLOCA
    // =========================================
    const idxPtr = this.IRB.newTemp();
    this.IRB.emit(`${idxPtr} = alloca i32`);
    this.IRB.emitStore("i32", "0", idxPtr);
    
    // =========================================
    // KEY POINTER ALLOCA  (written by the switch, read in body)
    // =========================================
    const keySlot = this.IRB.newTemp();
    this.IRB.emit(`${keySlot} = alloca ptr`);
    
    this.IRB.emit(`br label %${startLabel}`);
    
    // =========================================
    // CONDITION BLOCK
    // =========================================
    this.IRB.emit(`${startLabel}:`);
    
    const idxVal = this.IRB.newTemp();
    this.IRB.emit(`${idxVal} = load i32, ptr ${idxPtr}`);
    
    const cmpTmp = this.IRB.newTemp();
    this.IRB.emit(`${cmpTmp} = icmp slt i32 ${idxVal}, ${keys.length}`);
    this.IRB.emit(`br i1 ${cmpTmp}, label %${switchLabel}, label %${endLabel}`);
    
    // =========================================
    // SWITCH BLOCK — selects the right key ptr
    // =========================================
    this.IRB.emit(`${switchLabel}:`);
    
    // Build one case-label per key
    const caseLabels = keys.map((_, i) => this.IRB.newLabel(`map_key_${i}`));
    // Default (unreachable) points at first case — index is always in range
    const defaultLabel = caseLabels[0];
    
    const switchCases = keys
      .map((_, i) => `i32 ${i}, label %${caseLabels[i]}`)
      .join(" ");
    
    this.IRB.emit(
      `switch i32 ${idxVal}, label %${defaultLabel} [ ${switchCases} ]`
    );
    
    // One tiny block per key: store the string pointer, jump to body
    keys.forEach((_, i) => {
      
      this.IRB.emit(`${caseLabels[i]}:`);
      this.IRB.emit(`store ptr ${keyPtrs[i]}, ptr ${keySlot}`);
      this.IRB.emit(`br label %${bodyLabel}`);
    });
    
    // =========================================
    // BODY BLOCK
    // =========================================
    this.IRB.emit(`${bodyLabel}:`);
    
    // Load the selected key ptr and expose it as the loop variable
    const currentKeyPtr = this.IRB.newTemp();
    
    this.IRB.emit(`${currentKeyPtr} = load ptr, ptr ${keySlot}`);
    
    // Fetch the value for this key (available to body if needed)
    const valueTmp = this.IRB.newTemp();
    this.IRB.emit(
      `${valueTmp} = call ptr @zen_map_get(ptr ${mapPtr}, ptr ${currentKeyPtr})`
    );
    
    this.IRB.setVar(keyName, {
      ptr: valueTmp,
      type: inferredType,
      llvmType: this.IRB.getLLVMType(inferredType),
      needsLoad: inferredType !== "string" ? true : false,
      name: iterable.name,
      layout: mapLayout
    });
    
    
    
    // Execute user body
    this.block.block(body, false);
    
    // =========================================
    // INCREMENT
    // =========================================
    const incTmp = this.IRB.newTemp();
    this.IRB.emit(`${incTmp} = add i32 ${idxVal}, 1`);
    this.IRB.emitStore("i32", incTmp, idxPtr);
    
    this.IRB.emit(`br label %${startLabel}`);
    
    // =========================================
    // END
    // =========================================
    this.IRB.emit(`${endLabel}:`);
    
    this.IRB.loopStack.pop();
    this.IRB.exitScope();
  }
}