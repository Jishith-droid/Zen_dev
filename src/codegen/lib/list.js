export class ZenList {
  constructor(IRB, expr) {
    this.IRB = IRB;
    this.expr = expr;
  }
  
  list(node, globalScope) {
    
    this.IRB.guardStackOp("LIST", node);
    
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
    
    const name = node.name;
    
    this.IRB.guardGlobal(name, node);
    
    // TYPES
    
    const listLLVM = "%ZenList*"; // fixed
    
    const deepestType =
      this.IRB.getDeepestGeneric(node.generic);
    
    const depth =
      this.IRB.getListDepth(node.generic);
    
    const type =
      deepestType;
    
    const elementSize =
      depth > 1 ?
      8 :
      this.IRB.sizeOf(deepestType);
    
    // PTR
    
    const ptr = globalScope ?
      this.IRB.newGlobalTemp() :
      this.IRB.newTemp();
    
    // RECURSIVE PUSH
    
    const pushRecursive = (
      listPtr,
      element,
      generic
    ) => {
      
      // NESTED LIST
      
      if (
        element.type === "ARRAY" ||
        element.type === "LIST_LITERAL"
      ) {
        
        if (generic.type !== "List") {
          
          this.IRB.emitError(
            "TypeError",
            "nested list inside non-list generic", node
          );
        }
        
        const innerGeneric =
          generic.generic;
        
        const innerDepth =
          this.IRB.getListDepth(innerGeneric);
        
        const innerDeepest =
          this.IRB.getDeepestGeneric(innerGeneric);
        
        const innerSize =
          innerDepth > 1 ?
          8 :
          this.IRB.sizeOf(innerDeepest);
        
        // CREATE CHILD LIST 
        
        const childList =
          this.IRB.newTemp();
        
        this.IRB.emit(
          `${childList} = call ptr @zen_list_new(i64 ${innerSize})`
        );
        
        // PUSH CHILD ELEMENTS
        
        for (const child of element.elements) {
          
          pushRecursive(
            childList,
            child,
            innerGeneric
          );
        }
        
        // STORE CHILD PTR
        
        const tmp =
          this.IRB.newTemp();
        
        this.IRB.emit(
          `${tmp} = alloca ptr`
        );
        
        this.IRB.emit(
          `store ptr ${childList}, ptr ${tmp}`
        );
        
        // PUSH CHILD LIST
        
        this.IRB.emit(
          `call void @zen_list_push(` +
          `ptr ${listPtr}, ` +
          `ptr ${tmp}` +
          `)`
        );
        
        
        return;
      }
      
      // NORMAL VALUE
      
      const expr =
        this.expr.handleExpression(element);
      
      this.IRB.emitExpr(expr);
      
      const actualGeneric =
        generic.type === "List" ?
        generic.generic :
        generic;
      
      const elementLLVM =
        this.IRB.getListElementLLVM(generic);
      
      const tmp =
        this.IRB.newTemp();
      
      this.IRB.emit(
        `${tmp} = alloca ${elementLLVM}`
      );
      
      this.IRB.emit(
        `store ${elementLLVM} ${expr.ptr}, ptr ${tmp}`
      );
      
      this.IRB.emit(
        `call void @zen_list_push(` +
        `ptr ${listPtr}, ` +
        `ptr ${tmp}` +
        `)`
      );
    };
    
    // DETECT LIST LITERAL
    
    const isLiteralList =
      node.value &&
      (
        node.value.type === "ARRAY"
      );
    
    let rootList = null;
    
    
    // NORMAL EXPRESSION
    // List<int> a = other
    // List<int> a = fn()
    // List<int> a = b.pop()
    
    if (!isLiteralList && node.value) {
      
      const expr =
        this.expr.handleExpression(node.value);
      
      const isValidList =
        expr.isList;
      
      if (!isValidList) {
        const got =
          expr.isMap ? "Map" :
          expr.isStruct ? "Struct" :
          expr.type;
        
        this.IRB.emitError(
          "TypeError",
          `${node.name} expect List but got ${got}`, node
        );
      }
      
      if (type !== expr.type) {
        this.IRB.emitError("TypeError", `List ${name} expected ${type} but got ${expr.type}`, node)
      }
      
      this.IRB.emitExpr(expr);
      
      let t;
      if (expr.isVarRef) {
        t = this.IRB.newTemp();
        this.IRB.emit(`${t} = load ptr, ptr ${expr.ptr}`);
      }
      
      rootList = t ? t : expr.ptr;
    }
    
    // REAL LIST LITERAL
    
    else {
      
      const listTemp =
        this.IRB.newTemp();
      
      this.IRB.emit(
        `${listTemp} = call ptr @zen_list_new(i64 ${elementSize})`
      );
      
      rootList = listTemp;
      
      const validate = (el, expectedType) => {
        
        // if it's a list → go deeper
        if (el.type === "ARRAY" || el.type === "LIST") {
          for (const sub of el.elements) {
            validate(sub, expectedType);
          }
          return;
        }
        
        // leaf check
        if (el.type !== expectedType) {
          this.IRB.emitError(
            "TypeError",
            `List ${name} expected ${expectedType} but got ${el.type}`, node
          );
        }
      };
      
      if (
        node.value &&
        node.value.elements &&
        node.value.elements.length > 0
      ) {
        
        for (const el of node.value.elements) {
          
          validate(el, type);
          
          pushRecursive(
            rootList,
            el,
            node.generic
          );
        }
      }
    }
    
    // STORE VARIABLE PTR
    
    if (globalScope) {
      
      this.IRB.globals.push(
        `${ptr} = global ptr null`
      );
      
      this.IRB.emit(
        `store ptr ${rootList}, ptr ${ptr}`
      );
      
    }
    
    else {
      
      this.IRB.emit(
        `${ptr} = alloca ptr`
      );
      
      this.IRB.emit(
        `store ptr ${rootList}, ptr ${ptr}`
      );
    }
    
    // SYMBOL TABLE
    
    this.IRB.setVar(
      name,
      this.IRB.createData({
        ptr,
        llvmType: listLLVM,
        type,
        generic: node.generic,
        internalType: "List",
        isList: true,
        isGlobal: globalScope,
        isConstant: node.isConstant,
        needsLoad: true
      })
    );
    
  }
}