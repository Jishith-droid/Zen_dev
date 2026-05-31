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
        struct: structName
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
    
    this.IRB.guardStackOp("STRUCT", node);
    const name = node.name;
    const fields = node.fields;
    const isMethod = node?.methods?.length > 0;
    
    const layout = [];
    const fieldMap = {};
    const llvmFields = [];
    
    let byteSize = 0;
    
    // BUILD STRUCT LAYOUT
    
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
      byteSize += this.IRB.getTypeSizeStruct(llvmType);
    }
    
    // EMIT LLVM STRUCT TYPE
    
    this.IRB.globals.push(
      `%${name} = type { ${llvmFields.join(", ")} }`
    );
    
    // REGISTER STRUCT
    
    this.IRB.setStruct(name, {
      isGlobal: globalScope,
      layout,
      fieldMap,
      byteSize,
      size: fields.length
    });
    
    // METHODS SUPPORT
    
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
  
  structRef(node, globalScope) {
    
    const structName = node.struct_ref;
    const varName = node.name;
    
    const structInfo = this.IRB.getStruct(structName);
    
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
      isVarRef: true,
      needsLoad: true
    }));
    this.IRB.logSymbolTable();
  }
  
  
  assignStruct(node, globalScope) {
    
    // 1. FLATTEN CHAIN  
    
    const { base, fields } = this.IRB.resolveMemberChainAssign(node.object);
    const lastField = node.field;
    
    let variable;
    if (base === "this") {
      variable = this.IRB.getVar("this");
    } else {
      variable = this.IRB.getVar(base);
    }
    
    if (variable?.isMap) {
      
      // RESOLVE VALUE
      
      const value = this.expr.handleExpression(node.value);
      
      this.IRB.emitExpr(value);
      
      let valuePtr = this.IRB.castToPtr(value);
      
      // CHAIN RESOLUTION
      
      let currentLayout = this.IRB.maps.get(base);
      
      if (!currentLayout) {
        this.IRB.emitError(
          "InternalError",
          `Unknown map layout: ${base}`,
          node
        );
      }
      
      // runtime pointer starts from ROOT object
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
        
        // RUNTIME POINTER WALK
        
        const keyPtr = this.IRB.newGlobalString(field);
        
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
        
        // LAYOUT WALK
        
        if (meta.isMap) {
          currentLayout = meta.layout;
        }
        
        // stop before last
        if (i === fields.length - 1) {
          break;
        }
      }
      
      // FINAL KEY
      
      const keyPtr = this.IRB.newGlobalString(node.field);
      
      // FIXED STORE TARGET
      
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
      
      // LAYOUT UPDATE 
      
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
    
    // struct assign
    
    if (!variable || !variable.isStruct) {
      this.IRB.emitError(
        "ReferenceError",
        `'${base}' is not a struct`,
        node
      );
    }
    
    let structName = variable.type;
    let basePtr = variable.ptr;
    
    // WALK THROUGH CHAIN  
    
    for (let i = 0; i < fields.length; i++) {
      
      const structInfo = this.IRB.getStruct(structName);
      const fieldIndex = structInfo.fieldMap[fields[i]];
      
      if (fieldIndex === undefined) {
        this.IRB.emitError(
          "ReferenceError",
          `Unknown field '${fields[i]}' in struct '${structName}'`,
          node
        );
      }
      
      const ptr = this.IRB.newTemp();
      
      this.IRB.emit(
        `${ptr} = getelementptr %${structName}, %${structName}* ${basePtr}, i32 0, i32 ${fieldIndex}`
      );
      
      basePtr = ptr;
      structName = structInfo.layout[fieldIndex].type;
    }
    
    // FINAL FIELD  
    
    const structInfo = this.IRB.getStruct(structName);
    
    const fieldIndex = structInfo.fieldMap[lastField];
    const isList = structInfo.layout[fieldIndex].isList
    
    if (fieldIndex === undefined) {
      this.IRB.emitError(
        "ReferenceError",
        `Unknown field '${lastField}' in struct '${structName}'`,
        node
      );
    }
    
    const value = this.expr.handleExpression(node.value);
    
    this.IRB.emitExpr(value);
    
    const rhs = value;
    
    const finalPtr = this.IRB.newTemp();
    
    this.IRB.emit(
      `${finalPtr} = getelementptr %${structName}, %${structName}* ${basePtr}, i32 0, i32 ${fieldIndex}`
    );
    
    // STRUCT COPY  
    
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
    
    // NORMAL VALUE STORE  
    
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