  import { TYPES } from '/src/config/config.js';
  
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
      if (declaredType === "auto") {
        declaredType = this.infer.infer(node);
      }
      
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
         this.IRB.guardStackOp("variable declaration non-constant", node);
        this.IRB.globals.push(`${gName} = global ${llvmType} ${initialValue}`);
        }
        
        if (expr.local.length) this.IRB.emit(expr.local.join("\n"));
        if (expr.global.length) this.IRB.globals.push(expr.global.join("\n"));
        
        if (expr?.kind !== "literal") {
        this.IRB.emitStore(llvmType, expr.ptr, gName);
        }
        
      } else { // local
        
        this.IRB.guardStackOp("LOCAL_VARIABLE", node);
        
        ptr = lName;
        
        this.IRB.emitAlloca(llvmType, lName);
        
        if (expr.local.length) this.IRB.emit(expr.local.join("\n"));
        if (expr.global.length) this.IRB.globals.push(expr.global.join("\n"));
        
        this.IRB.emitStore(llvmType, expr.ptr, lName);
        
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
      
      if (declaredType !== expr.type) {
        this.IRB.emitError("TypeError", `variable ${name} expect string but got ${expr.type}`, node);
      }
      
      if (globalScope) {
        ptr = gName;
        
        if (expr.local.length) this.IRB.emit(expr.local.join("\n"));
        if (expr.global.length) this.IRB.globals.push(expr.global.join("\n"));
        
        if (expr?.isVarRef) {
          this.IRB.globals.push(`${gName} = global i8* null`);
          
        } else {
          const fPtr = this.IRB.exported ? expr?.ir : "null";
          console.log(expr, this.IRB.exported)
          this.IRB.globals.push(`${gName} = global i8* ${fPtr}`);
        }
        this.IRB.emit(`store i8* ${expr.ptr}, i8** ${gName}`);
        
      } else {
        this.IRB.guardStackOp("variable declaration non-constant", node);
        ptr = lName;
        
        this.IRB.emitAlloca("i8*", lName);
        
        if (expr.local.length) this.IRB.emit(expr.local.join("\n"));
        if (expr.global.length) this.IRB.globals.push(expr.global.join("\n"));
        
        this.IRB.emit(`store i8* ${expr.ptr}, i8** ${lName}`);
        
      }
      
      this.IRB.setVar(name, this.IRB.createData({
        ptr,
        length: expr.length,
        llvmType,
        type: declaredType,
        isConstant,
        isGlobal: globalScope,
        rawStr: expr.rawStr,
        needsLoad: true
      }));
    }
    
    // variable refference 
    
    variableReference(node) {
      
      const name = node.expression.name;
      
      const isUnary = node.expression?.value?.type === "UNARY_EXPRESSION";
      const isCall = node.expression?.value?.type === "CALL";
      const isMethodCall = !!node.expression?.callee;
      
      if (isMethodCall) {
        const fakeNode = {
          type: "MEMBER_ACCESS",
          field: node.expression.callee.field,
          object: node.expression.callee.object,
          args: node.expression.args,
          isAwait: node.expression.isAwait
        }
        
        const valExpr = this.expr.handleExpression(fakeNode);
        
        
        if (valExpr.local.length) this.IRB.emit(valExpr.local.join("\n"));
        if (valExpr.global.length) this.IRB.globals.push(valExpr.global.join("\n"));
        return;
      }
      
      const isArrayReassignment = node.expression?.array;
      
      if (isArrayReassignment) {
        
        const { b } = this.IRB.getArrayChain(node.expression);
        
        if (b.type === "MEMBER_ACCESS") {
          return this.handleStructArrayAssignment(node.expression);
        }
        
        const getBaseArray = (node) => {
          if (node.type === "variable") {
            return node;
          }
          
          if (node.type === "ARRAY_ACCESS") {
            return getBaseArray(node.array);
          }
          
          return null;
        }
        
        const base = getBaseArray(node.expression.array);
        
        if (base) {
          
          const varInfo = this.IRB.getVar(base.name, node);
          console.log(varInfo)
          const isStringReassignment = varInfo.type === "string" && !varInfo.llvmType.startsWith("[") && !varInfo.llvmType === "%ZenList*";
          
          if (isStringReassignment) {
            this.IRB.emitError("SemanticError", "string reassignment not allowed", node);
          }
        }
        
        this.IRB.bindLineColumn(node)
        
        const expr = this.expr.handleExpression(node.expression);
        
        const ptr = expr.raw;
        
        if (expr.local.length) this.IRB.emit(expr.local.join("\n"));
        if (expr.global.length) this.IRB.globals.push(expr.global.join("\n"));
        
        const valExpr = this.expr.handleExpression(node.expression.value);
        
        if (valExpr.local.length) this.IRB.emit(valExpr.local.join("\n"));
        if (valExpr.global.length) this.IRB.globals.push(valExpr.global.join("\n"));
        
        this.IRB.emit(`store ${valExpr.llvmType} ${valExpr.ptr}, ${valExpr.llvmType}* ${ptr}`)
        return;
      }
      
      if (isUnary && (node.expression.operator === "++" || node.expression.operator === "--")) { // unary 
        return this.handleUnary(node.expression.value, true);
      }
      
      if (isCall) {
        const isGlobal = this.IRB.getVar(name, node).isGlobal;
        return this.callVariable(this.IRB.normalizeNode(node), isGlobal);
      }
      
      const orgData = this.IRB.getVar(name, node);
      const isConstant = orgData.isConstant;
      
      if (isConstant) {
        this.IRB.emitError("ImmutableError", `modifying const ${name}`, node);
      }
      
      
      
      if (orgData?.isStruct) {
        this.IRB.bindLineColumn(node)
        const rhs = this.expr.handleExpression(node.expression.value);
        
        const isStructCopy =
          rhs.isStruct &&
          this.IRB.getStruct(rhs.type);
        
        if (isStructCopy) {
          
          const struct = this.IRB.getStruct(rhs.type);
          const size = struct.byteSize;
          
          const dstPtr = orgData.ptr; // %d
          const srcPtr = rhs.ptr; // %a
          
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
      const destType = node.expression.value.type;
      const destValue = this.IRB.formatValue(node.expression.value.value, destType);
      
      
      if (!this.IRB.hasVar(name)) {
        this.IRB.emitError("ReferenceError", `${name} is not defined`, node);
      }
      this.IRB.bindLineColumn(node)
      const expr = this.expr.handleExpression(node.expression.value, false);
      
      if (orgData.type !== expr.type) {
        this.IRB.emitError(
          "TypeError",
          `${name} → expected ${orgData.type} but got ${expr.type}`, node
        );
      }
      
    /*  if (orgData.isList !== expr.isList) {
        this.IRB.emitError(
          "TypeError",
          `${name} → expected ${orgData.isList ? "List" : "non-List"} but got ${expr.isList ? "List" : expr.type}`, node
        );
      }*/
      
      if (expr.local.length) this.IRB.emit(expr.local.join("\n"));
      if (expr.global.length) this.IRB.globals.push(expr.global.join("\n"));
      
      this.IRB.emitStore(llvmType, expr.ptr, orgPtr);
    }
    
    handleUnary(node, fromVarRef) {
      this.IRB.bindLineColumn(node)
      const expr = this.expr.handleExpression(node);
      const ptr = this.IRB.getVar(node.argument.name, node).ptr;
      
      if (expr.local.length) this.IRB.emit(expr.local.join("\n"));
      if (expr.global.length) this.IRB.globals.push(expr.global.join("\n"));
      
      if (fromVarRef) {
        this.IRB.emitStore(expr.llvmType, expr.ptr, ptr);
      }
      
    }
    
    callVariable(node, globalScope) {
      
      const isVarDecl = node.type === "VARIABLE_DECLARATION";
      const isMethodCall = !!node.value?.callee;
      
      if (isMethodCall) {
        const fakeNode = {
          type: "MEMBER_ACCESS",
          field: node.value.callee.field,
          object: node.value.callee.object,
          args: node.value.args
        }
        
        const valExpr = this.expr.handleExpression(fakeNode);
        
        if (valExpr.local.length) this.IRB.emit(valExpr.local.join("\n"));
        if (valExpr.global.length) this.IRB.globals.push(valExpr.global.join("\n"));
        let ptr;
        if (globalScope) {
          if (isVarDecl) {
            ptr = this.IRB.newGlobalTemp();
            this.IRB.globals.push(`${ptr} = ${node.isConstant ? "constant" : "global"} ${valExpr.llvmType}  ${this.IRB.initialValue(valExpr.type)}`);
            this.IRB.emit(`store ${valExpr.llvmType} ${valExpr.ptr}, ${valExpr.llvmType}* ${ptr}`)
          } else {
            ptr = this.IRB.getVar(name, node).ptr;
            this.IRB.emit(`store ${valExpr.llvmType} ${valExpr.ptr}, ${valExpr.llvmType}* ${ptr}`)
          }
        } else { // local scope
          if (isVarDecl) {
            ptr = this.IRB.newTemp();
            this.IRB.emit(`${ptr} = alloca ${valExpr.llvmType}`);
            this.IRB.emit(`store ${valExpr.llvmType} ${valExpr.ptr}, ${valExpr.llvmType}* ${ptr}`)
          } else {
            ptr = this.IRB.getVar(name, node).ptr;
            this.IRB.emit(`store ${valExpr.llvmType} ${valExpr.ptr}, ${valExpr.llvmType}* ${ptr}`)
          }
        }
        
        this.IRB.setVar(node.name, this.IRB.createData({
          ptr,
          llvmType: valExpr.llvmType,
          type: valExpr.type,
          isConstant: false,
          isGlobal: globalScope,
          needsLoad: true
        }));
        return;
      }
      
      if (node.value.isInbuilt) {
        this.call.handleBuiltInCall(node, globalScope);
        return;
      }
      
      const name = node.name;
      this.IRB.guardGlobal(name, node);
      let dataType = node.dataType;
      if (dataType === "auto") {
        dataType = this.infer.infer(node);
      }
      
      const llvmType = this.IRB.getLLVMType(dataType);
      this.IRB.bindLineColumn(node)
      // evaluate RHS (call)
      const val = this.expr.handleExpression(node.value, globalScope);
      
      // void check
      if (val === null) {
        this.IRB.emitError(
          "TypeError",
          `${node.value.name}() → void function cannot be assigned`, node
        );
      }
      
      // type mismatch
      if (val.type !== dataType) {
        this.IRB.emitError(
          "TypeError",
          `${name} → expected ${dataType} but got ${val.type}`, node
        );
      }
      
      let ptr;
      
      if (globalScope) {
        if (isVarDecl) {
          ptr = this.IRB.newGlobalTemp();
        } else {
          ptr = this.IRB.getVar(name, node).ptr;
        }
        
        let value;
        if (["int", "bool"].includes(dataType)) {
          value = "0";
        } else if (dataType === "double") {
          value = "0.0";
        } else {
          value = "null";
        }
        if (isVarDecl) {
          this.IRB.globals.push(`${ptr} = global ${llvmType} ${value}`);
        }
        
      } else {
        if (isVarDecl) {
          ptr = this.IRB.newTemp();
          this.IRB.emitAlloca(llvmType, ptr);
        } else {
          ptr = this.IRB.getVar(name, node).ptr;
        }
        
      }
      
      if (val.isList) {
        this.IRB.emit(`store ptr ${val.ptr}, ptr ${ptr}`);
      } else {
        this.IRB.emit(`store ${llvmType} ${val.ptr}, ptr ${ptr}`);
      }
      
      
      this.IRB.setVar(name, this.IRB.createData({
        ptr,
        llvmType: val.isList ? "ptr" : llvmType,
        type: dataType,
        isConstant: false,
        isGlobal: globalScope,
        needsLoad: true,
        isList: val.isList
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
      
      if (globalScope) {
        if (init.ir.length) this.IRB.globals.push(init.ir.join("\n"))
      } else {
        if (init.ir.length) this.IRB.emit(init.ir.join("\n"));
      }
      
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
        
        this.IRB.globals.push(`${ptr} = ${isConstant ? "constant" : "global"} ${llvmType} ${initialValue}`);
      } else {
        this.IRB.emitAlloca(llvmType, ptr);
      }
      
      if (expr.local.length) this.IRB.emit(expr.local.join("\n"));
      if (expr.global.length) this.IRB.globals.push(expr.global.join("\n"));
      
      this.IRB.emit(`store ${expr.llvmType} ${expr.ptr}, ${expr.llvmType}* ${ptr}`);
      
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
    
    handleStructArrayAssignment(exprNode) {
      
      const { b, indices } = this.IRB.getArrayChain(exprNode);
      
      // =========================
      // 1. resolve base
      // =========================
      let basePtr;
      let llvmType;
      
      if (b.type === "MEMBER_ACCESS") {
        const { base: root, fields } =
        this.IRB.resolveMemberChainAssign(b);
        
        const varInfo = this.IRB.getVar(root, node);
        
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
          
          if (baseExpr.local?.length)
            this.IRB.emit(baseExpr.local.join("\n"));
          
          let currentPtr = baseExpr.ptr;
          
          
          for (let i = 0; i < indices.length; i++) {
            
            const v = indices[i];
            
            const indexExpr = this.expr.handleExpression(v);
            
            if (indexExpr.local?.length) {
              this.IRB.emit(indexExpr.local.join("\n"));
            }
            
            const isLast = i === indices.length - 1;
            
            // =========================
            // MAP KEY ACCESS
            // =========================
            if (v.type === "string") {
              
              this.IRB.declareOneTime(
                "zen_map_get",
                "declare ptr @zen_map_get(ptr, ptr)"
              );
              
              const tmp = this.IRB.newTemp();
              
              this.IRB.emit(
                `${tmp} = call ptr @zen_map_get(ptr ${currentPtr}, ptr ${indexExpr.ptr})`
              );
              
              // intermediate access:
              // load actual container ptr
              if (!isLast) {
                
                const loaded = this.IRB.newTemp();
                
                this.IRB.emit(
                  `${loaded} = load ptr, ptr ${tmp}`
                );
                
                currentPtr = loaded;
              }
              
              // final access:
              // keep slot ptr for store
              else {
                currentPtr = tmp;
              }
            }
            
            // =========================
            // LIST INDEX ACCESS
            // =========================
            else {
              
              this.IRB.declareOneTime(
                "zen_list_get",
                "declare ptr @zen_list_get(ptr, i32)"
              );
              
              const tmp = this.IRB.newTemp();
              
              this.IRB.emit(
                `${tmp} = call ptr @zen_list_get(ptr ${currentPtr}, i32 ${indexExpr.ptr})`
              );
              
              // intermediate access:
              // load actual container ptr
              if (!isLast) {
                
                const loaded = this.IRB.newTemp();
                
                this.IRB.emit(
                  `${loaded} = load ptr, ptr ${tmp}`
                );
                
                currentPtr = loaded;
              }
              
              // final access:
              // keep slot ptr for store
              else {
                currentPtr = tmp;
              }
            }
          }
          
          const valueExpr = this.expr.handleExpression(exprNode.value);
          
          if (valueExpr.local?.length) {
            this.IRB.emit(valueExpr.local.join("\n"));
          }
          
          this.IRB.emit(
            `store ${valueExpr.llvmType} ${valueExpr.ptr}, ${valueExpr.llvmType}* ${currentPtr}`
          );
          
          return;
        }
        
        
        basePtr = varInfo.ptr;
        let structName = varInfo.type;
        
        // walk struct chain
        for (let f of fields) {
          
          const structInfo = this.IRB.getStruct(structName);
          
          if (!structInfo) {
            throw new Error(`Trying to access field ${f} on non-struct ${structName}`);
          }
          
          const idx = structInfo.fieldMap[f];
          
          const isList = structInfo.layout[idx]?.isList;
          
          
          if (isList) {
            
            
            const baseExpr = this.expr.handleExpression(b);
            
            if (baseExpr.local?.length)
              this.IRB.emit(baseExpr.local.join("\n"));
            
            const t = this.IRB.newTemp()
            this.IRB.emit(`${t} = load ptr, ptr ${baseExpr.ptr}`)
            
            let currentPtr = t;
            
            let tmp
            for (let i = 0; i < indices.length; i++) {
              
              const v = indices[i];
              
              const indexExpr = this.expr.handleExpression(v);
              
              if (indexExpr.local?.length) {
                this.IRB.emit(indexExpr.local.join("\n"));
              }
              
              // =========================
              // LIST INDEX ACCESS
              // =========================
              
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
            
            if (valueExpr.local?.length) {
              this.IRB.emit(valueExpr.local.join("\n"));
            }
            
            this.IRB.emit(
              `store ${valueExpr.llvmType} ${valueExpr.ptr}, ${valueExpr.llvmType}* ${tmp}`
            );
            
            return;
            
          }
          
          
          
          
          
          if (idx === undefined) {
            throw new Error(`Unknown field ${f} in ${structName}`);
          }
          
          const ptr = this.IRB.newTemp();
          
          this.IRB.emit(
            `${ptr} = getelementptr %${structName}, %${structName}* ${basePtr}, i32 0, i32 ${idx}`
          );
          
          basePtr = ptr;
          
          // IMPORTANT
          const fieldInfo = structInfo.layout[idx];
          
          structName = fieldInfo.type; // "int"
          llvmType = fieldInfo.llvmType; // "[2 x [2 x i32]]"
        }
        
        
      } else if (b.type === "variable") {
        
        const varInfo = this.IRB.getVar(b.name, node);
        basePtr = varInfo.ptr;
        llvmType = varInfo.llvmType;
        
      } else {
        throw new Error("Unsupported base for array assignment");
      }
      
      // =========================
      // 2. apply indices 
      // =========================
      let currentPtr = basePtr;
      let currentType = llvmType;
      
      for (let idxNode of indices) {
        
        const idxExpr = this.expr.handleExpression(idxNode);
        
        if (idxExpr.local.length)
          this.IRB.emit(idxExpr.local.join("\n"));
        
        const elemPtr = this.IRB.newTemp();
        
        this.IRB.emit(
          `${elemPtr} = getelementptr ${currentType}, ${currentType}* ${currentPtr}, i32 0, i32 ${idxExpr.ptr}`
        );
        
        // shrink type: [2 x [2 x i32]] → [2 x i32] → i32
        currentType = this.IRB.getArrayElementType(currentType);
        
        currentPtr = elemPtr;
      }
      
      // =========================
      // 3. store
      // =========================
      const valExpr = this.expr.handleExpression(exprNode.value);
      
      if (valExpr.local.length)
        this.IRB.emit(valExpr.local.join("\n"));
      
      this.IRB.emit(
        `store ${valExpr.llvmType} ${valExpr.ptr}, ${valExpr.llvmType}* ${currentPtr}`
      );
    }
    
  }