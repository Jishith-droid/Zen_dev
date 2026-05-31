export class HandleFunction {
  constructor(IRB, expr, block, infer) {
    this.IRB = IRB;
    this.block = block;
    this.expr = expr;
    this.infer = infer;
  }
  
  handleReturn(node, meta) {
    
    if (this.IRB.currentFunction === null) {
      this.IRB.emitError("SemanticError", "return outside function", node);
    }
    
    if (node?.value.length === 0) {
      this.IRB.emit(`ret void`);
      return;
    }
    
    const name = this.IRB.currentFunction.name;
    
    // ensure meta data passed from handleFunction is valid and its return type need inference 
    if (meta && meta.isAuto) {
      
      const retType = this.infer.infer(node.value);
      
      if (retType === "List") {
        this.IRB.emitError("SemanticError", `function '${name}' not allowed return inference`, node);
      }
      
      const fn = this.IRB.getFunction(name);
      
      // update return type
      
      fn.returnType = retType;
      
      this.IRB.currentFunction.returnType = retType; 
      
      if (node.value.type === "CALL") {
        const fn = this.IRB.getFunction(node.value.name);
        
        fn.returnType = retType;
      }
      const llvmReturnType = this.IRB.getLLVMType(retType);
      
      
      this.IRB.currentFunction.body.unshift(meta.local.join("\n"));
      this.IRB.currentFunction.body.unshift(`define ${llvmReturnType} @${meta.name} ${meta.ir} { \n entry:`);
    }
    
    const funcType = this.IRB.currentFunction.returnType;
    
    this.IRB.currentFunction.hasReturn = true;
    
    if (funcType === "void") {
      this.IRB.emit("ret void");
      return;
    }
    
    const expr = this.expr.handleExpression(node.value, false);
    
    this.IRB.emitExpr(expr);
    
    if (expr.llvmType.startsWith("[")) {
      this.IRB.emitError(
        "SemanticError",
        `function ${name} cannot return array`, node)
    }
    
    if (expr?.isList) {
      if (!this.IRB.currentFunction.isList) {
        this.IRB.emitError("TypeError", `function ${name} expected ${funcType} but got ${expr.type}`, node);
      }
        
        if (expr?.fromParam || expr?.isListLiteral) {
          // param already holds list pointer
          this.IRB.emit(`ret ptr ${expr.ptr}`);
        } 
        else {
          // local variable (stack slot) needs load
          const t = this.IRB.newTemp();
          this.IRB.emit(`${t} = load ptr, ptr ${expr.ptr}`);
          this.IRB.emit(`ret ptr ${t}`);
        }
        
        return;
    }
    
    if (expr.isMap) {
      if (node.value.type !== "variable") {
        this.IRB.emitError("SemanticError", "only Map reference can return", node);
      }
      let loaded;
      
      if (expr.needsLoad) {
        loaded = this.IRB.newTemp();
        
        this.IRB.emit(
          `${loaded} = load ptr, ptr ${expr.ptr}`
        );
        
      } else {
        loaded = expr.ptr;
      }
      this.IRB.emit(`ret ptr ${loaded}`);
      
      const layout = expr.layout;
      
      this.IRB.functions.get(name).layout = layout;
      return;
    }
    // type check 
    if (expr.type !== funcType) {
      this.IRB.emitError("TypeError", `function ${name} expected ${funcType} but got ${expr.type}`, node);
    }
    
    this.IRB.emit(`ret ${expr.llvmType} ${expr.ptr}`);
  }
  
  handleFunction(node) {
    
    if (node.name === "main") {
      this.IRB.emitError(
        "ReservedFunctionError",
        "'main' is a reserved function name", node
      );
    }
    
    if (this.IRB.currentFunction !== null) {
      this.IRB.emitError("SemanticError", "Nested functions are not supported", node);
    }
    
    const isMethod = node?.isMethod;
    
    const prevFunction = this.IRB.currentFunction;
    
    let local = []
    
    let name;
    if (isMethod) {
      name = `${node.structName}_${node.name}`;
    } else {
      name = node.name;
    }
    
    let returnType = node.returnType === "void" ?
      "void" :
      node.returnType.type; // exclude auto infer for now
    
    let llvmReturnType = returnType === "void" ?
      "void" : returnType === "List" ? "%ZenList*" : returnType === "Map" ? "ptr" :
      this.IRB.getLLVMType(returnType); // exclude auto for now
    
    const params = node.params;
    
    const { ir, params: paramData } = this.IRB.buildParams(params, isMethod);
    
    this.IRB.currentFunction = {
      name,
      body: [],
      isList: returnType === "List",
      returnType, // temporarily store return type even its auto
      hasReturn: false,
      isAsync: node.isAsync
    };
    
    this.IRB.enterScope();
    
    // do not make function signature if it's auto
    if (returnType !== "auto") {
      this.IRB.emit(`define ${llvmReturnType} @${name} ${ir} {`);
      this.IRB.emit("entry:");
    }
    
    for (const p of paramData) {
      
      if (p.isList) {
        
        this.IRB.declareOneTime(
          "zen_list_new",
          "declare ptr @zen_list_new(i64)"
        );
        
        this.IRB.declareOneTime(
          "zen_list_get",
          "declare ptr @zen_list_get(ptr, i32)"
        );
        
        this.IRB.declareOneTime(
          "ZenList",
          `%ZenList = type { ptr, i32, i32, i64 }`
        );
        
        const getDeepestType = (g) => {
          
          if (g.type === "List") {
            return getDeepestType(g.generic);
          }
          
          return g.type;
        };
        
        const deepestType =
          getDeepestType(p.generic.generic);
        
        this.IRB.setVar(p.name, this.IRB.createData({
          ptr: p.ptr,
          llvmType: p.llvmType,
          generic: p.generic,
          type: deepestType,
          isConstant: false,
          isGlobal: false,
          isList: true,
          fromParam: true,
          needsLoad: false
        }));
      } else if (p.isRest) {

        this.IRB.declareOneTime(
        "ZenList",
        "%ZenList = type { ptr, i32, i32, i64 }"
      );
        // update symbol table
        this.IRB.setVar(p.name, this.IRB.createData({
          ptr: p.ptr,
          llvmType: "ZenList",
          type: p.type,
          generic: { generic: { type: p.type } },
          isConstant: false,
          isGlobal: false,
          isList: true,
          needsLoad: false,
          fromParam: true
        }));
        
      } else if (p.isMap) {
        this.IRB.setVar(p.name, this.IRB.createData({
          ptr: p.ptr,
          llvmType: "ptr",
          type: "ptr",
          isConstant: false,
          isGlobal: false,
          isMap: true,
          fromParam: true,
          needsLoad: false
        }));
      }
      else {
        let ptr = `%${p.name}.addr`;
        
        // alloca
        local.push(`${ptr} = alloca ${p.llvmType}`); // always push to local for infering
        
        // store incoming param (p.temp)
        local.push(`store ${p.llvmType} ${p.temp}, ${p.llvmType}* ${ptr}`);
        
        const t = this.IRB.newTemp()
        local.push(`${t} = load ${p.llvmType}, ptr ${ptr}`);
        
        
        // update symbol table
        this.IRB.setVar(p.name, this.IRB.createData({
          ptr: t, // special case for primitive types (loaded value)
          llvmType: p.llvmType,
          type: p.type,
          isConstant: false,
          isGlobal: false,
          needsLoad: false,
          fromParam: true
        }));
      }
    }
    
    // meta data for infering return type at handleReturn site
    const meta = {
      name,
      ir,
      isAuto: returnType === "auto",
      local
    }
    
    if (returnType !== "auto") {
      this.IRB.emit(local.join("\n"))
    }
    
    this.block.block(node.body, false, meta); // pass meta data in block
    
    if (!this.IRB.currentFunction.hasReturn) {
      if (returnType === "int") {
        this.IRB.emit("ret i32 0");
      } else if (returnType === "bool") {
        this.IRB.emit("ret i1 0");
      } else if (returnType === "double") {
        this.IRB.emit("ret double 0.0");
      } else if (returnType === "string") {
        this.IRB.emit("ret i8* null");
      } else {
        this.IRB.emit("ret void");
      }
    }
    
    this.IRB.emit("}");
    
    this.IRB.exitScope();
    
    this.IRB.functionBuff.push(this.IRB.currentFunction.body.join("\n"));
    
    this.IRB.currentFunction = prevFunction;
    
  }
}