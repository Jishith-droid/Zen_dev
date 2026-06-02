  import { TYPES, STD_FUNCTIONS } from '/src/config/config.js';
  
  export class Variable {
    constructor(IRB, expr, call, infer, struct) {
      this.IRB = IRB;
      this.expr = expr;
      this.call = call;
      this.infer = infer;
      this.struct = struct;
    }
    
    // scalar variable handling 
    scalarVariable(node, globalScope) {
      
      const name = node.name;
      this.IRB.guardGlobal(name, node);
      const gName = this.IRB.newGlobalTemp()
      const lName = this.IRB.newTemp();
      const valueType = node.value.type;
      let declaredType = node.dataType;
      if (declaredType === "auto") declaredType = this.infer.infer(node);
      
      const llvmType = this.IRB.getLLVMType(declaredType);
      
      const isConstant = node.isConstant;
      let ptr = null;
      
      this.IRB.bindLineColumn(node)
      
      const expr = this.expr.handleExpression(node.value, globalScope);
      
      if (this.IRB.isDeclaredInCurrentScope(name)) {
        this.IRB.emitError("ReferenceError", `variable ${name} already defined`, node);
      }
      
      if (declaredType !== expr.type) {
        this.IRB.emitError("TypeError", `variable ${name} expect ${declaredType} but got ${expr.type}`, node);
      }
      
      if (globalScope) { // global
        ptr = gName;
        
        const initialValue = this.IRB.initialValue(declaredType);
        
        if (expr?.kind === "literal") {
          this.IRB.globals.push(`${gName} = global ${llvmType} ${expr.ptr}`);
        } else {
          this.IRB.guardStackOp(`NON-CONSTANT VARIABLE ${name}`, node);
          this.IRB.globals.push(`${gName} = global ${llvmType} ${initialValue}`);
        }
        
        this.IRB.emitExpr(expr);
        
        if (expr?.kind !== "literal") {
          this.IRB.emit(`store ${llvmType} ${expr.ptr}, ptr ${gName}`);
        }
        
      } else { // local
        
        this.IRB.guardStackOp(`LOCAL_VARIABLE ${name}`, node);
        
        ptr = lName;
        
        this.IRB.emit(`${lName} = alloca ${llvmType}`);
        
        this.IRB.emitExpr(expr);
        
        this.IRB.emit(`store ${llvmType} ${expr.ptr}, ptr ${lName}`);
        
      }
      
      this.IRB.setVar(name, this.IRB.createData({
        ptr,
        llvmType,
        type: declaredType,
        isConstant,
        isGlobal: globalScope,
        needsLoad: true
      }));
    }
    
    // string variable handling 
    
    stringVariable(node, globalScope) {
      
      const name = node.name;
      this.IRB.guardGlobal(name, node);
      const gName = this.IRB.newGlobalTemp();
      const lName = this.IRB.newTemp();
      let valueTtype = node.value.type;
      let declaredType = node.dataType;
      if (declaredType === "auto") {
        declaredType = this.infer.infer(node);
      }
      const llvmType = this.IRB.getLLVMType(declaredType);
      const isConstant = node.isConstant;
      let ptr = null;
      
      this.IRB.bindLineColumn(node)
      
      const expr = this.expr.handleExpression(node.value, globalScope);
      
      this.IRB.emitExpr(expr);
      
      if (declaredType !== expr.type) {
        this.IRB.emitError("TypeError", `variable ${name} expect string but got ${expr.type}`, node);
      }
      
      if (globalScope) { // global scope
        ptr = gName;
        
        const isExported = this.IRB.exported;
        
        if (isExported) {
          this.IRB.globals.push(`${gName} = global i8* ${expr?.ir}`);
        } else {
          this.IRB.globals.push(`${gName} = global i8* null`);
        }
        
        this.IRB.emit(`store i8* ${expr.ptr}, i8** ${gName}`);
        
      } else { // local scope
        
        this.IRB.guardStackOp(`LOCAL_VARIABLE ${name}`, node);
        ptr = lName;
        
        this.IRB.emit(`${lName} = alloca i8*`);
        
        this.IRB.emit(`store i8* ${expr.ptr}, i8** ${lName}`);
      }
      
      this.IRB.setVar(name, this.IRB.createData({
        ptr,
        length: expr?.length,
        llvmType,
        type: declaredType,
        isConstant,
        isGlobal: globalScope,
        rawStr: expr?.rawStr,
        needsLoad: true
      }));
    }
    
    // variable refference 
    
    variableReference(node) {
      
      
      const expression = node?.expression;
      const name = expression.name;
      
      const isUnary = expression.value?.type === "UNARY_EXPRESSION";
      
      const isCall = expression.value?.type === "CALL";
      
      const isMethodCall = !!node.expression?.callee;
      
      const isArrayReassignment = expression?.array; // fixed/List
      
      if (isMethodCall) {
        const fakeNode = {
          type: "MEMBER_ACCESS",
          field: expression.callee.field,
          object: expression.callee.object,
          args: expression.args,
          isAwait: expression.isAwait
        }
        
        const valExpr = this.expr.handleExpression(fakeNode);
        
        this.IRB.emitExpr(valExpr);
        return;
      }
      
      if (isArrayReassignment) {
        
        const { b } = this.IRB.getArrayChain(expression);
        
        if (b.type === "MEMBER_ACCESS") {
          return this.handleMemberArrayReassign(expression);
        }
        
        const base = this.IRB.getBaseArray(expression.array);
        
        const varInfo = this.IRB.getVar(base.name, node);
        
        if (base) {
          
          const isArrayType = varInfo.llvmType.startsWith("[");
          const isZenList = varInfo.llvmType === "%ZenList*";
          
          const isStringReassignment =
            varInfo.type === "string" &&
            !isArrayType &&
            !isZenList;
          
          if (isStringReassignment) {
            this.IRB.emitError("SemanticError", `Invalid reassignment: '${base.name}' is a string and cannot be modified after initialization`, node);
          }
        }
        
        this.IRB.bindLineColumn(node)
        
        const expr = this.expr.handleExpression(expression);
        
        this.IRB.emitExpr(expr);
        
        const valExpr = this.expr.handleExpression(expression.value);
        
        this.IRB.emitExpr(valExpr);
        
        if (varInfo.isList) {
          const generic = this.IRB.getDeepestGeneric(varInfo.generic);
          if (generic !== valExpr.type) {
            this.IRB.emitError(
              "TypeError",
              `List '${base.name}' expected ${generic} but got ${valExpr.type}`, node
            );
          }
        }
        
        if (varInfo.isArray) {
          const type = varInfo.type;
          if (type !== valExpr.type) {
            this.IRB.emitError(
              "TypeError",
              `array '${base.name}' expected ${type} but got ${valExpr.type}`, node
            );
          }
        }
        
        this.IRB.emit(`store ${valExpr.llvmType} ${valExpr.ptr}, ptr ${expr.raw}`)
        return;
      }
      
      if (isUnary && (expression.operator === "++" || expression.operator === "--")) {
        return this.handleUnary(expression.value, true);
      }
      
      const orgData = this.IRB.getVar(name, node);
      
      if (isCall) {
        const isGlobal = orgData.isGlobal;
        return this.callVariable(this.IRB.normalizeNode(node), isGlobal);
      }
      
      if (orgData?.isStruct) {
        this.IRB.bindLineColumn(node)
        const rhs = this.expr.handleExpression(expression.value);
        
        const struct = this.IRB.getStruct(rhs.type);
        
        const isStructCopy =
          rhs.isStruct && struct;
        
        if (isStructCopy) {
          
          const size = struct.byteSize;
          
          const dstPtr = orgData.ptr;
          const srcPtr = rhs.ptr;
          
          this.IRB.declareOneTime(
            "llvm.memcpy.p0.p0.i64",
            "declare void @llvm.memcpy.p0.p0.i64(ptr, ptr, i64, i1)"
          );
          
          this.IRB.emit(
            `call void @llvm.memcpy.p0.p0.i64(` +
            `ptr ${dstPtr}, ptr ${srcPtr}, i64 ${size}, i1 false)`
          );
          
          return;
        }
      }
      
      const orgPtr = orgData.ptr;
      const orgType = orgData.type;
      const llvmType = orgData.llvmType;
      const isConstant = orgData.isConstant;
      
      if (isConstant) {
        this.IRB.emitError("ConstError", `Cannot reassign constant '${name}'`, node);
      }
      
      this.IRB.bindLineColumn(node)
      
      const expr = this.expr.handleExpression(expression.value);
      
      if (orgData.type !== expr.type) {
        this.IRB.emitError(
          "TypeError",
          `variable '${name}' expected ${orgType} but got ${expr.type}`, node
        );
      }
      
      if (orgData.isList) {
      if (orgData.isList !== expr.isList) {
        this.IRB.emitError(
          "TypeError",
          `variable '${name}' expected ${orgData.isList ? "List" : "non-List"} but got ${expr.isList ? "List" : expr.type}`,
          node
        );
      }
      }
      
      this.IRB.emitExpr(expr);
      
      this.IRB.emit(
        `store ${llvmType} ${expr.ptr}, ptr ${orgPtr}`
      );
    }
    
    handleUnary(node, fromVarRef) {
      
      this.IRB.bindLineColumn(node)
      
      const expr = this.expr.handleExpression(node);
      
      this.IRB.emitExpr(expr);
      
      if (fromVarRef) {
        const ptr = this.IRB.getVar(node.argument.name, node).ptr;
        this.IRB.emit(`store ${expr.llvmType} ${expr.ptr}, ptr ${ptr}`);
      }
      
    }
    
    callVariable(node, globalScope) {
      
      const isVarDecl = node.type === "VARIABLE_DECLARATION";
      const isMethodCall = !!node.value?.callee;
      const name = node.name || node?.expression.name;
      
      if (isMethodCall) {
        const fakeNode = {
          type: "MEMBER_ACCESS",
          field: node.value.callee.field,
          object: node.value.callee.object,
          args: node.value.args
        }
        
        const valExpr = this.expr.handleExpression(fakeNode);
        
        this.IRB.emitExpr(valExpr);
        
        let ptr;
        if (globalScope) {
          if (isVarDecl) {
            ptr = this.IRB.newGlobalTemp();
            this.IRB.globals.push(`${ptr} = global ${valExpr.llvmType}  ${this.IRB.initialValue(valExpr.type)}`);
            
          } else {
            const data = this.IRB.getVar(name, node);
            ptr = data.ptr;
          }
          
        } else { // local scope
          if (isVarDecl) {
            ptr = this.IRB.newTemp();
            this.IRB.emit(`${ptr} = alloca ${valExpr.llvmType}`);
            
          } else {
            const data = this.IRB.getVar(name, node);
            ptr = data.ptr;
          }
        }
        
        this.IRB.emit(`store ${valExpr.llvmType} ${valExpr.ptr}, ptr ${ptr}`);
        
        const isConstant = isVarDecl ? node.isConstant : data.isConstant;
        
        this.IRB.setVar(node.name, this.IRB.createData({
          ptr,
          llvmType: valExpr.llvmType,
          type: valExpr.type,
          isConstant,
          isGlobal: globalScope,
          needsLoad: true
        }));
        return;
      }
      
      if (node.value.isInbuilt && !STD_FUNCTIONS.includes(node.value.name)) {
        
        this.call.handleBuiltInCall(node, globalScope);
        return;
      }
      
      this.IRB.guardGlobal(name, node);
      let dataType = node.dataType;
      if (dataType === "auto") {
        dataType = this.infer.infer(node);
      }
      
      const llvmType = this.IRB.getLLVMType(dataType);
      
      this.IRB.bindLineColumn(node)
      // evaluate RHS 
      const val = this.expr.handleExpression(node.value, globalScope);
      
      // void check
      if (val?.returnType === "void") {
        this.IRB.emitError(
          "TypeError",
          `${node.value.name}() void function cannot be assigned`, node
        );
      }
      
      if (val.type !== dataType) {
        this.IRB.emitError(
          "TypeError",
          `${name} expected ${dataType} but got ${val.type}`, node
        );
      }
      
      let ptr;
      let value = this.IRB.initialValue(dataType);
      
      if (globalScope) {
        if (isVarDecl) {
          ptr = this.IRB.newGlobalTemp();
          this.IRB.globals.push(`${ptr} = global ${llvmType} ${value}`);
        } else {
          const data = this.IRB.getVar(name, node);
          ptr = data.ptr;
        }
        
      } else {
        if (isVarDecl) {
          ptr = this.IRB.newTemp();
          this.IRB.emit(`${ptr} = alloca ${llvmType}`);
        } else {
          const data = this.IRB.getVar(name, node);
          ptr = data.ptr;
        }
      }
      
      const isList = val?.isList;
      const isMap = val?.isMap;
      const isStruct = val?.isStruct;
      
      if (isList || isMap || isStruct) {
        this.IRB.emit(`store ptr ${val.ptr}, ptr ${ptr}`);
      } else {
        this.IRB.emit(`store ${llvmType} ${val.ptr}, ptr ${ptr}`);
      }
      
      if (!isVarDecl) return;
      
      this.IRB.setVar(name, this.IRB.createData({
        ptr,
        llvmType: isList || isMap || isStruct ? "ptr" : llvmType,
        type: dataType,
        isConstant: false,
        isGlobal: globalScope,
        needsLoad: true,
        isList,
        isMap,
        isStruct
      }));
    }
    
    arrayVariable(node, globalScope) {
      
      const { name, isConstant, dimensions, value } = node;
      
      let dataType = node.dataType;
      if (dataType === "auto") {
        dataType = this.infer.infer(node);
      }
      this.IRB.guardGlobal(name, node);
      const llvmType = this.IRB.getLLVMType(dataType);
      const dimSizes = dimensions.map(d => d.value);
      
      const init = this.IRB.arrayInit(name, dimensions, value, globalScope, llvmType, dataType, isConstant);
      
      const ir = init.ir.length ? init.ir.join("\n") : null;
      if (ir) globalScope ? this.IRB.globals.push(ir) : this.IRB.emit(ir);
      
      this.IRB.setVar(name, this.IRB.createData({
        ptr: init.ptr,
        llvmType: init.llvmType,
        type: dataType,
        internalType: `array<${dataType}>`,
        length: init.length,
        isConstant,
        isGlobal: globalScope,
        postOrPrefix: false,
        isArray: true,
        dimensions: dimensions.length,
        dimensionsData: dimSizes
      }));
      this.IRB.logSymbolTable()
    }
    
    arrayAccessVariable(node, globalScope) {
      
      const { name, isConstant, value } = node;
      let dataType = node.dataType;
      if (dataType === "auto") {
        dataType = this.infer.infer(node);
      }
      this.IRB.guardGlobal(name, node);
      const llvmType = this.IRB.getLLVMType(dataType);
      const ptr = globalScope ? this.IRB.newGlobalTemp() : this.IRB.newTemp();
      
      this.IRB.bindLineColumn(node)
      const expr = this.expr.handleExpression(value);
      
      if (globalScope) { // global
        const initialValue = this.IRB.initialValue(dataType);
        
        this.IRB.globals.push(`${ptr} = global ${llvmType} ${initialValue}`);
      } else {
        this.IRB.emit(`${ptr} = alloca ${llvmType}`);
      }
      
      this.IRB.emitExpr(expr);
      
      this.IRB.emit(`store ${expr.llvmType} ${expr.ptr}, ptr ${ptr}`);
      
      this.IRB.setVar(name, this.IRB.createData({
        ptr,
        llvmType,
        type: dataType,
        isConstant,
        isGlobal: globalScope,
        postOrPrefix: false,
        isArray: false,
        needsLoad: true
      }));
      this.IRB.logSymbolTable()
    }
    
    handleMemberArrayReassign(exprNode) {
      
      const { b, indices } = this.IRB.getArrayChain(exprNode);
      
      // resolve base
      
      let basePtr;
      let llvmType;
      
      if (b.type === "MEMBER_ACCESS") {
        const { base: root, fields } =
        this.IRB.resolveMemberChainAssign(b);
        
        const varInfo = this.IRB.getVar(root, exprNode);
        
        // map inside list reassignment handling 
        
        if (varInfo.isMap) {
          
          this.IRB.declareOneTime(
            "zen_map_set",
            "declare void @zen_map_set(ptr, ptr, ptr)"
          );
          
          this.IRB.declareOneTime(
            "zen_map_get",
            "declare void @zen_map_get(ptr, ptr)"
          );
          const baseExpr = this.expr.handleExpression(b);
          
          this.IRB.emitExpr(baseExpr);
          
          let currentPtr = baseExpr.ptr;
          
          for (let i = 0; i < indices.length; i++) {
            
            const v = indices[i];
            
            const indexExpr = this.expr.handleExpression(v);
            
            this.IRB.emitExpr(indexExpr);
            
            const isLast = i === indices.length - 1;
            
            // MAP KEY ACCESS
            
            if (v.type === "string") {
              
              this.IRB.declareOneTime(
                "zen_map_get",
                "declare ptr @zen_map_get(ptr, ptr)"
              );
              
              const tmp = this.IRB.newTemp();
              
              this.IRB.emit(
                `${tmp} = call ptr @zen_map_get(ptr ${currentPtr}, ptr ${indexExpr.ptr})`
              );
              
              // load actual container ptr
              
              if (!isLast) {
                
                const loaded = this.IRB.newTemp();
                
                this.IRB.emit(
                  `${loaded} = load ptr, ptr ${tmp}`
                );
                
                currentPtr = loaded;
              }
              
              // keep slot ptr for store
              else {
                currentPtr = tmp;
              }
            }
            
            // LIST INDEX ACCESS
            
            else {
              
              this.IRB.declareOneTime(
                "zen_list_get",
                "declare ptr @zen_list_get(ptr, i32)"
              );
              
              const tmp = this.IRB.newTemp();
              
              this.IRB.emit(
                `${tmp} = call ptr @zen_list_get(ptr ${currentPtr}, i32 ${indexExpr.ptr})`
              );
              
              if (!isLast) {
                
                const loaded = this.IRB.newTemp();
                
                this.IRB.emit(
                  `${loaded} = load ptr, ptr ${tmp}`
                );
                
                currentPtr = loaded;
              }
              
              // keep slot ptr for store
              else {
                currentPtr = tmp;
              }
            }
          }
          
          const valueExpr = this.expr.handleExpression(exprNode.value);
          
          this.IRB.emitExpr(valueExpr);
          
          this.IRB.emit(
            `store ${valueExpr.llvmType} ${valueExpr.ptr}, ptr ${currentPtr}`
          );
          
          return;
        }
        
        
        basePtr = varInfo.ptr;
        let structName = varInfo.type;
        
        // walk struct chain
        for (let f of fields) {
          
          const structInfo = this.IRB.getStruct(structName);
          
          if (!structInfo) {
            this.IRB.emitError(
              "TypeError",
              `Cannot access field '${f}' on non-struct type '${structName}'`,
              exprNode
            );
          }
          
          const idx = structInfo.fieldMap[f];
          
          const isList = structInfo.layout[idx]?.isList;
          
          
          if (isList) {
            
            const baseExpr = this.expr.handleExpression(b);
            
            this.IRB.emitExpr(baseExpr);
            
            const t = this.IRB.newTemp()
            this.IRB.emit(`${t} = load ptr, ptr ${baseExpr.ptr}`)
            
            let currentPtr = t;
            
            let tmp
            for (let i = 0; i < indices.length; i++) {
              
              const v = indices[i];
              
              const indexExpr = this.expr.handleExpression(v);
              
              this.IRB.emitExpr(indexExpr);
              
              // LIST INDEX ACCESS
              
              this.IRB.declareOneTime(
                "zen_list_get",
                "declare ptr @zen_list_get(ptr, i32)"
              );
              
              tmp = this.IRB.newTemp();
              
              this.IRB.emit(
                `${tmp} = call ptr @zen_list_get(ptr ${currentPtr}, i32 ${indexExpr.ptr})`
              );
              
              
              const loaded = this.IRB.newTemp();
              
              this.IRB.emit(
                `${loaded} = load ptr, ptr ${tmp}`
              );
              
              currentPtr = loaded;
              
            }
            
            const valueExpr = this.expr.handleExpression(exprNode.value);
            
            this.IRB.emitExpr(valueExpr);
            
            this.IRB.emit(
              `store ${valueExpr.llvmType} ${valueExpr.ptr}, ptr ${tmp}`
            );
            
            return;
            
          }
          
          if (idx === undefined) {
            this.IRB.emitError(
              "TypeError",
              `Unknown field '${f}' in struct '${structName}'`,
              exprNode
            );
          }
          
          const ptr = this.IRB.newTemp();
          
          this.IRB.emit(
            `${ptr} = getelementptr %${structName}, %${structName}* ${basePtr}, i32 0, i32 ${idx}`
          );
          
          basePtr = ptr;
          
          const fieldInfo = structInfo.layout[idx];
          
          structName = fieldInfo.type;
          llvmType = fieldInfo.llvmType;
        }
        
      } else if (b.type === "variable") {
        
        const varInfo = this.IRB.getVar(b.name, node);
        basePtr = varInfo.ptr;
        llvmType = varInfo.llvmType;
        
      } else {
        this.IRB.emitError(
          "TypeError",
          "Invalid target for array assignment",
          exprNode
        );
      }
      
      // 2. apply indices 
      
      let currentPtr = basePtr;
      let currentType = llvmType;
      
      for (let idxNode of indices) {
        
        const idxExpr = this.expr.handleExpression(idxNode);
        
        this.IRB.emitExpr(idxExpr);
        
        const elemPtr = this.IRB.newTemp();
        
        this.IRB.emit(
          `${elemPtr} = getelementptr ${currentType}, ${currentType}* ${currentPtr}, i32 0, i32 ${idxExpr.ptr}`
        );
        
        // shrink type: [2 x [2 x i32]] - [2 x i32] - i32
        currentType = this.IRB.getArrayElementType(currentType);
        
        currentPtr = elemPtr;
      }
      
      // 3. store
      
      const valExpr = this.expr.handleExpression(exprNode.value);
      
      this.IRB.emitExpr(valExpr);
      
      this.IRB.emit(
        `store ${valExpr.llvmType} ${valExpr.ptr}, ptr ${currentPtr}`
      );
    }
    
  }