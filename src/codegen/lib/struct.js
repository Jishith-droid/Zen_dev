export class Struct {
  constructor(IRB, expr, fn) {
    this.IRB = IRB;
    this.expr = expr;
    this.fn = fn
  }
  
  
  registerStructMethods(structNode) {
    const structName = structNode.name;
    this.IRB.currentStruct = structName;
    for (const method of structNode.methods) {
      
      const fnName = `${structName}_${method.name}`;
      
      this.IRB.functions.set(fnName, {
        name: fnName,
        params: method.params,
        returnType: method.returnType,
        isMethod: true,
        struct: structName,
        ast: method
      });
    }
  }
  
  generateMethods(node) {
    const name = node.name;
    
    for (const method of node.methods) {
      method.structName = name;
      this.fn.handleFunction(method);
    }
  }
  
  
  struct(node, globalScope) {
    
    const name = node.name;
    const fields = node.fields;
    const isMethod = node?.methods?.length > 0;
    
    const layout = [];
    const fieldMap = {};
    const llvmFields = [];
    
    let byteSize = 0;
    
    // =========================
    // TYPE SIZE HELPERS
    // =========================
    const getTypeSize = (llvmType) => {
      
      // pointer
      if (llvmType.endsWith("*")) return 8;
      
      if (llvmType === "i1") return 1;
      if (llvmType === "i8") return 1;
      if (llvmType === "i32") return 4;
      if (llvmType === "i64") return 8;
      if (llvmType === "double") return 8;
      if (llvmType === "ptr") return 8;
      
      // arrays like [10 x i32]
      const arrMatch = llvmType.match(/\[(\d+)\s+x\s+(.+)\]/);
      if (arrMatch) {
        const len = parseInt(arrMatch[1]);
        const elemType = arrMatch[2];
        return len * getTypeSize(elemType);
      }
      
      // struct (IMPORTANT FIX)
      const structMatch = llvmType.match(/%(.+)/);
      if (structMatch) {
        const structName = structMatch[1];
        const structInfo = this.IRB.getStruct(structName);
        if (!structInfo) {
          throw new Error(`[Zen Error] Unknown struct type: ${structName}`);
        }
        return structInfo.byteSize;
      }
      
      throw new Error(`[Zen Error] Unknown type size: ${llvmType}`);
    };
    
    // =========================
    // BUILD STRUCT LAYOUT
    // =========================
    for (let i = 0; i < fields.length; i++) {
      
      const f = fields[i];
      
      let llvmType;
      
      // ARRAY FIELD
      if (f.dimensions && f.dimensions.length > 0) {
        
        const dims = f.dimensions.map(d => d.value ?? d);
        
        const { full } = this.IRB.buildArrayType(
          this.IRB.getLLVMType(f.type),
          dims
        );
        
        llvmType = full;
      }
      
      // NORMAL FIELD
      else {
        llvmType = this.IRB.getLLVMType(f.type);
      }
      
      let type;
      if (f.type === "List") {
        type = this.IRB.getDeepestGeneric(f.generic);
      } else {
        type = f.type;
      }
      
      layout.push({
        name: f.name,
        type: type,
        isList: f.type === "List",
        generic: {
          type: "List",
          generic: f?.generic
        },
        llvmType,
        index: i,
        dimensions: f.dimensions || []
      });
      
      fieldMap[f.name] = i;
      llvmFields.push(llvmType);
      
      // accumulate byte size
      byteSize += getTypeSize(llvmType);
    }
    
    // =========================
    // EMIT LLVM STRUCT TYPE
    // =========================
    this.IRB.globals.push(
      `%${name} = type { ${llvmFields.join(", ")} }`
    );
    
    // =========================
    // REGISTER STRUCT
    // =========================
    this.IRB.setStruct(name, {
      isGlobal: globalScope,
      layout,
      fieldMap,
      byteSize,
      size: fields.length
    });
    
    // =========================
    // METHODS SUPPORT
    // =========================
    if (isMethod) {
      this.registerStructMethods(node);
      
      this.IRB.setVar("this", this.IRB.createData({
        ptr: "%this",
        type: name,
        llvmType: `%${name}*`,
        isStruct: true
      }));
      
      this.generateMethods(node);
    }
    
    return;
  }
  
  
  
  
  
  
  
  /*
  struct(node, globalScope) {
    
    const name = node.name;
    const fields = node.fields;
    const isMethod = node?.methods?.length > 0;
    
    const layout = [];
    const fieldMap = {};
    const llvmFields = [];
    
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      
      let llvmType;
      
      // =========================
      // ARRAY FIELD SUPPORT
      // =========================
      if (f.dimensions && f.dimensions.length > 0) {
        
        const dims = f.dimensions.map(d => {
          // handle AST int node OR raw number
          return d.value ?? d;
        });
        
        // build LLVM array type using helper
        const { full } = this.IRB.buildArrayType(
          this.IRB.getLLVMType(f.type),
          dims
        );
        
        llvmType = full;
      } else {
        llvmType = this.IRB.getLLVMType(f.type);
      }
      
      layout.push({
        name: f.name,
        type: f.type,
        llvmType,
        index: i,
        dimensions: f.dimensions
      });
      
      fieldMap[f.name] = i;
      llvmFields.push(llvmType);
    }
    
    
    // =========================
    // EMIT LLVM STRUCT TYPE
    // =========================
    this.IRB.globals.push(
      `%${name} = type { ${llvmFields.join(", ")} }`
    );
    
    // =========================
    // REGISTER STRUCT
    // =========================
    this.IRB.setStruct(name, {
      isGlobal: globalScope,
      layout,
      fieldMap,
      size: fields.length,
      byteSize
    });
    
    if (isMethod) {
      this.registerStructMethods(node);
      this.IRB.setVar("this", this.IRB.createData({
        ptr: "%this",
        type: this.IRB.currentStruct,
        llvmType: `%${this.IRB.currentStruct}*`,
        isStruct: true
      }));
      this.generateMethods(node);
      
    }
    
    return;
  }
  */
  
  
  
  
  structRef(node, globalScope) {
    
    const structName = node.struct_ref;
    const varName = node.name;
    
    const structInfo = this.IRB.getStruct(structName);
    
    if (!structInfo) {
      throw new Error(`[Zen Error] Unknown struct: ${structName}`);
    }
    
    const llvmType = `%${structName}`;
    
    let ptr;
    
    if (globalScope) {
      ptr = this.IRB.newGlobalTemp();
      this.IRB.globals.push(`${ptr} = global ${llvmType} zeroinitializer`);
    } else {
      ptr = this.IRB.newTemp();
      this.IRB.emit(`${ptr} = alloca ${llvmType}`);
    }
    
    this.IRB.setVar(varName, this.IRB.createData({
      ptr,
      type: structName,
      llvmType,
      isStruct: true,
      isGlobal: globalScope,
      isVarRef: true
    }));
    this.IRB.logSymbolTable();
  }
  
  
  assignStruct(node, globalScope) {
    
    // =========================  
    // 1. FLATTEN CHAIN  
    // =========================  
    
    const { base, fields } = this.IRB.resolveMemberChainAssign(node.object);
    const lastField = node.field;
    
    let variable;
    if (base === "this") {
      variable = this.IRB.getVar("this");
    } else {
      variable = this.IRB.getVar(base);
    }
    
    if (variable?.isMap) {
      
      // =========================
      // RESOLVE VALUE
      // =========================
      
      const value = this.expr.handleExpression(node.value);
      
      if (value.local?.length) {
        this.IRB.emit(value.local.join("\n"));
      }
      
      if (value.global?.length) {
        this.globals.push(value.global.join("\n"));
      }
      
      let valuePtr = this.IRB.castToPtr(
        value
      );
      
      // =========================
      // CHAIN RESOLUTION (LAYOUT + RUNTIME FIX)
      // =========================
      
      const { base, fields } =
      this.IRB.resolveMemberChainAssign(node.object);
      
      let currentLayout = this.IRB.maps.get(base);
      
      if (!currentLayout) {
        this.IRB.emitError(
          "ReferenceError",
          `Unknown map layout: ${base}` , node
        );
      }
      
      //  IMPORTANT: runtime pointer starts from ROOT object
      let currentPtr =
        base === "this" ?
        this.IRB.getVar("this").ptr :
        this.IRB.getVar(base).ptr;
      
      let needsLoad = true;
      // walk chain except last field
      for (let i = 0; i < fields.length; i++) {
        
        const field = fields[i];
        needsLoad = false;
        const meta = currentLayout[field];
        
        if (!meta) {
          this.IRB.emitError(
            "ReferenceError",
            `Cannot access '${field}' on undefined map`, node
          );
        }
        
        // =========================
        // RUNTIME POINTER WALK
        // =========================
        
        const keyPtr = this.IRB.newGlobalString(field);
        
        /* if (keyPtr.local?.length) {
           this.IRB.emit(keyPtr.local);
         }*/
        
        const temp = this.IRB.newTemp();
        let t;
        
        if (variable.needsLoad) {
          t = this.IRB.newTemp()
          this.IRB.emit(`${t} = load ptr, ptr ${currentPtr}`)
        } else {
          t = currentPtr;
        }
        this.IRB.emit(
          `${temp} = call ptr @zen_map_get(ptr ${t}, ptr ${keyPtr.name})`
        );
        
        currentPtr = temp;
        
        // =========================
        // LAYOUT WALK
        // =========================
        
        if (meta.isMap) {
          currentLayout = meta.layout;
        }
        
        // stop before last
        if (i === fields.length - 1) {
          break;
        }
      }
      
      // =========================
      // FINAL KEY
      // =========================
      
      const keyPtr = this.IRB.newGlobalString(node.field);
      
      /* if (keyPtr.local?.length) {
         this.IRB.emit(keyPtr.local);
       }*/
      
      // =========================
      // FIXED STORE TARGET
      // =========================
      let t;
      
      if (needsLoad && !variable.fromParam) {
        t = this.IRB.newTemp();
        this.IRB.emit(`${t} = load ptr, ptr ${currentPtr}`)
      } else {
        t = currentPtr;
      }
      this.IRB.emit(
        `call void @zen_map_set(ptr ${t}, ptr ${keyPtr.name}, ptr ${valuePtr})`
      );
      
      
      
      
      
      // =========================
      // LAYOUT UPDATE (unchanged logic)
      // =========================
      
      const entry = {
        type: value.type,
        llvmType: this.IRB.getLLVMType(value.type),
        isMap: false
      };
      
      if (value?.isList) {
        Object.assign(entry, {
          type: "List",
          llvmType: "ptr",
          isList: true,
          elementType: value.generic?.generic || "dynamic"
        });
      }
      
      if (value?.isMap) {
        Object.assign(entry, {
          type: "Map",
          llvmType: "ptr",
          isMap: true,
          layout: this.IRB.maps.get(value.type) || {}
        });
      }
      
      currentLayout[node.field] = entry;
      
      return;
    }
    
    /*
    
    if (!variable || !variable.isStruct) {
      throw new Error(`[Zen Error] ${base} is not a struct`);
    }
    
    let structName = variable.type;
    let basePtr = variable.ptr;
    
    // =========================  
    // 2. WALK THROUGH CHAIN  
    // =========================  
    for (let i = 0; i < fields.length; i++) {
      
      const structInfo = this.IRB.getStruct(structName);
      const fieldIndex = structInfo.fieldMap[fields[i]];
      
      if (fieldIndex === undefined) {
        throw new Error(`[Zen Error] Unknown field ${fields[i]} in ${structName}`);
      }
      
      const ptr = this.IRB.newTemp();
      
      this.IRB.emit(
        `${ptr} = getelementptr %${structName}, %${structName}* ${basePtr}, i32 0, i32 ${fieldIndex}`
      );
      
      basePtr = ptr;
      structName = structInfo.layout[fieldIndex].type;
    }
    
    // =========================  
    // 3. FINAL FIELD (ACTUAL ASSIGNMENT TARGET)  
    // =========================  
    const structInfo = this.IRB.getStruct(structName);
    const fieldIndex = structInfo.fieldMap[lastField];
    
    if (fieldIndex === undefined) {
      throw new Error(`[Zen Error] Unknown field ${lastField} in ${structName}`);
    }
    
    const value = this.expr.handleExpression(node.value);
    
    
    
    
    const rhs = value;
    
    const isStructCopy =
      rhs.isVarRef &&
      rhs.isStruct;
    
    if (isStructCopy) {
      
      // p.address = a
      
      const finalPtr = this.IRB.newTemp();
      
      this.IRB.emit(
        `${finalPtr} = getelementptr %${structName}, %${structName}* ${basePtr}, i32 0, i32 ${fieldIndex}`
      );
      
      const dstPtr = finalPtr; // already computed GEP
      
      const srcPtr = rhs.ptr;
      
      const size = this.IRB.getStruct(this.IRB.getVar(node.value.name).type).size;
      
      this.IRB.declareOneTime("llvm.memcpy.p0.p0.i64", "declare void @llvm.memcpy.p0.p0.i64(ptr, ptr, i64, i1)");
      
      this.IRB.emit(
        `call void @llvm.memcpy.p0.p0.i64(` +
        `ptr ${dstPtr}, ptr ${srcPtr}, i64 ${size}, i1 false)`
      );
      
      return;
    }
    
    
    
    if (value.local.length) this.IRB.emit(value.local.join("\n"));
    if (value.global.length) this.IRB.globals.push(value.global.join("\n"));
    
    const llvmType = this.IRB.getLLVMType(
      structInfo.layout[fieldIndex].type
    );
    
    const finalPtr = this.IRB.newTemp();
    
    this.IRB.emit(
      `${finalPtr} = getelementptr %${structName}, %${structName}* ${basePtr}, i32 0, i32 ${fieldIndex}`
    );
    
    this.IRB.emit(
      `store ${llvmType} ${value.ptr}, ${llvmType}* ${finalPtr}`
    );
    
  }
  
  */
    
    
    if (!variable || !variable.isStruct) {
      throw new Error(`[Zen Error] ${base} is not a struct`);
    }
    
    let structName = variable.type;
    let basePtr = variable.ptr;
    
    // =========================  
    // 2. WALK THROUGH CHAIN  
    // =========================  
    for (let i = 0; i < fields.length; i++) {
      
      const structInfo = this.IRB.getStruct(structName);
      const fieldIndex = structInfo.fieldMap[fields[i]];
      
      if (fieldIndex === undefined) {
        throw new Error(`[Zen Error] Unknown field ${fields[i]} in ${structName}`);
      }
      
      const ptr = this.IRB.newTemp();
      
      this.IRB.emit(
        `${ptr} = getelementptr %${structName}, %${structName}* ${basePtr}, i32 0, i32 ${fieldIndex}`
      );
      
      basePtr = ptr;
      structName = structInfo.layout[fieldIndex].type;
    }
    
    // =========================  
    // 3. FINAL FIELD  
    // =========================  
    const structInfo = this.IRB.getStruct(structName);
    
    const fieldIndex = structInfo.fieldMap[lastField];
    const isList = structInfo.layout[fieldIndex].isList
    
    if (fieldIndex === undefined) {
      throw new Error(`[Zen Error] Unknown field ${lastField} in ${structName}`);
    }
    
    const value = this.expr.handleExpression(node.value);
    
    const rhs = value;
    
    const finalPtr = this.IRB.newTemp();
    
    this.IRB.emit(
      `${finalPtr} = getelementptr %${structName}, %${structName}* ${basePtr}, i32 0, i32 ${fieldIndex}`
    );
    
    // =========================  
    // STRUCT COPY  
    // =========================  
    const isStructCopy =
      rhs.isVarRef &&
      rhs.isStruct &&
      this.IRB.getStruct(rhs.type) &&
      rhs.type === structInfo.layout[fieldIndex].type;
    
    if (isStructCopy) {
      
      const dstPtr = finalPtr;
      const srcPtr = rhs.ptr;
      
      const struct = this.IRB.getStruct(rhs.type);
      const size = struct.byteSize;
      
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
    
    // =========================  
    // NORMAL VALUE STORE  
    // =========================  
    if (value.local.length) this.IRB.emit(value.local.join("\n"));
    if (value.global.length) this.IRB.globals.push(value.global.join("\n"));
    
    const llvmType = this.IRB.getLLVMType(
      structInfo.layout[fieldIndex].type
    );
    
    if (llvmType === "ptr" || isList) {
      this.IRB.emit(
        `store ptr ${value.ptr}, ptr ${finalPtr}`
      );
    } else {
      this.IRB.emit(
        `store ${llvmType} ${value.ptr}, ${llvmType}* ${finalPtr}`
      );
    }
  }
}