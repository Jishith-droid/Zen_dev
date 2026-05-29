import { LOGICAL_OPS, COMPARISON_OPS, OP_CODES, LOOKUP, cmpMap, fcmpMap, NAMESPACE_MAP } from '/src/config/config.js';

export class Expression {
  constructor(IRB) {
    this.IRB = IRB;
    this.count = 0
  }
  
  setCall(call) {
    this.call = call;
  }
  
  setTernary(t) {
    this.ternary = t;
  }
  
  
  handleExpression(node, globalScope = true) { // default globalScope true
    
    const op = node.operator;
    let local = [];
    let global = [];
    
    // scalar types
    
    if (node.type === "int" || node.type === "double" || node.type === "bool") {
      let value = node.value;
      
      if (node.type === "double") {
        value = this.IRB.formatDouble(value);
      }
      
      if (node.type === "bool") {
        value = node.value ? 1 : 0;
      }
      
      return {
        ptr: value,
        type: node.type,
        llvmType: this.IRB.getLLVMType(node.type),
        local: [],
        global: [],
        kind: "literal",
        endLabel: null,
        postOrPrefix: false,
        isVarRef: false
      };
    }
    
    // non scalar type
    
    if (node.type === "string") {
      const str = node.value;
      const data = this.IRB.newGlobalString(str);
      
      return {
        ptr: data.name,
        ir: data.ir, // direct ir for module linking 
        type: "string",
        llvmType: "i8*",
        length: data.length,
        local: data.local,
        global: data.global,
        kind: "literal",
        endLabel: null,
        postOrPrefix: false,
        isVarRef: false,
        rawStr: data.rawStr
      };
    }
    
    // variable reference 
    
    if (node.type === "variable") {
      
      // check for freed memory 
      if (this.IRB.freedVars.has(node.name)) {
        this.IRB.emitError(
          "MemoryError",
          `${node.name} used after free`, node);
      }
      
      const data = this.IRB.getVar(node.name, node);
      
      
      // check its array so no need load. we can load in array access 
      const isArray = data?.isArray;
      const isStruct = data?.isStruct;
      const isList = data?.isList;
      const isVarArg = data?.isVarArg;
      const isMap = data?.isMap;
      let needsLoad = data?.needsLoad ?? false;
      const fromLoopOf = data?.fromLoopOf;
      
      let t;
      if (!isArray && !isStruct && (!isList) && !isVarArg && !isMap && needsLoad) {
        t = this.IRB.newTemp();
        this.IRB.emit(`${t} = load ${data.llvmType}, ${data.llvmType}* ${data.ptr}`);
        needsLoad = false;
      } else if (isVarArg) {
        t = this.IRB.newTemp();
        this.IRB.emit(`${t} = load ptr, ptr ${data.ptr}`);
      }
      else {
        t = data.ptr;
      }
      
      return {
        ptr: t,
        addr: data.ptr, // only for unary
        type: data.type,
        stringGep: data?.ir,
        llvmType: data.llvmType,
        isStruct: data?.isStruct,
        local: [],
        global: [],
        length: data.length, //data.llvmType?.startsWith("[") ? data.length : null, //only for length() calcultion for arrays
        endLabel: null,
        isVarRef: true, // for ++ -- ref and string variable refference tracking only
        postOrPrefix: data.postOrPrefix,
        dimData: isArray ? data.dimensionsData : null, // only for array access bound checking
        isList,
        generic: data?.generic,
        fromParam: data?.fromParam,
        isVarArg,
        isArray: isArray ? true : false,
        isMap: isMap,
        layout: data.layout,
        needsLoad,
        name: data?.name,
        fromLoopOf
      };
    }
    
    /*if (node.type === "ARRAY") {
      this.IRB.emitError("SyntaxError", "array standalone literals not yet supported yet");
     
     
    }
    */
    
    if (node.type === "ARRAY") {
      
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
        "%ZenList = type { ptr, i32, i32, i64 }"
      );
      
      // infer element type from first element
      const first = node.elements[0];
      
      if (!first) {
        this.IRB.emitError(
          "TypeError",
          "cannot infer empty array literal type", node
        );
      }
      
      const elemExpr =
        this.handleExpression(first);
      
      const elemLLVM =
        elemExpr.isList ?
        "ptr" :
        elemExpr.llvmType;
      
      const elemSize =
        elemLLVM === "ptr" ?
        8 :
        this.IRB.sizeOf(elemExpr.type);
      
      const list =
        this.IRB.newTemp();
      
      const local = [];
      const global = [];
      
      local.push(
        `${list} = call ptr @zen_list_new(i64 ${elemSize})`
      );
      
      for (const el of node.elements) {
        
        const expr =
          this.handleExpression(el);
        
        if (expr.local?.length) {
          local.push(...expr.local);
        }
        
        if (expr.global?.length) {
          global.push(...expr.global);
        }
        
        const tmp =
          this.IRB.newTemp();
        
        local.push(
          `${tmp} = alloca ${elemLLVM}`
        );
        
        local.push(
          `store ${elemLLVM} ${expr.ptr}, ptr ${tmp}`
        );
        
        local.push(
          `call void @zen_list_push(ptr ${list}, ptr ${tmp})`
        );
      }
      
      return {
        ptr: list,
        addr: list,
        type: elemExpr.type,
        llvmType: "%ZenList*",
        local,
        global,
        isListLiteral: true,
        isList: true,
        generic: {
          generic: {
            type: first.type
          }
        }
      };
    }
    
    if (node.type === "TERNARY") {
      const res = this.ternary.ternary(node);
      
      return res;
    }
    
    if (node.type === "MEMBER_ACCESS") {
      
      const { base, fields } = this.IRB.resolveMemberChain(node);
      
      // namespace resolve 
      
      if (
        base.type === "variable" &&
        NAMESPACE_MAP[base.name]
      ) {
        
        const namespace = base.name;
        
        if (
          !NAMESPACE_MAP[namespace]
          .includes(node.field)
        ) {
          
          this.IRB.emitError(
            "ReferenceError",
            `${namespace}.${node.field} does not exist`, node
          );
        }
        
        
        const callNode = {
          "isInbuilt": true,
          "type": "CALL",
          "name": `_${namespace}_${node.field}`,
          "args": node.args,
          isAwait: node.isAwait
        }
        
        return this.call.handleCall(callNode, true)
      }
      
      let object;
      
      if (base.type === "THIS") {
        
        object = {
          ptr: "%this",
          type: this.IRB.currentStruct,
          llvmType: `%${this.IRB.currentStruct}`,
          local: [],
          global: [],
          isStruct: true,
          isVarRef: false
        };
        
      } else {
        
        object = this.handleExpression(base);
        
      }
      
      
      
      
      
      
      
      
      if (object.isStruct) {
        
        let structName = object.type;
        let basePtr = object.ptr;
        
        let fieldInfo = null;
        
        // =====================================
        // WALK CHAIN
        // =====================================
        
        for (let i = 0; i < fields.length; i++) {
          
          const LIST_PROPS = ["push", "pop", "contains", "removeAt", "clear", "free", "length", "capacity"];
          
          if (LIST_PROPS.includes(fields[i])) {
            
            const t = this.IRB.newTemp();
            this.IRB.emit(`${t} = load ptr, ptr ${basePtr}`);
            
            const fakeObject = {
              ptr: t,
              type: fieldInfo.type,
              llvmType: fieldInfo.llvmType,
              local: [],
              global: [],
              isList: true,
              isVarRef: true,
              generic: fieldInfo.generic
            };
            
            return this.IRB.handleListProperty(
              t,
              fakeObject,
              node.field,
              node,
              false,
              fields[fields.length - 1]
            );
          }
          const structInfo =
            this.IRB.getStruct(structName);
          
          if (!structInfo) {
            throw new Error(
              `[Zen Error] Unknown struct '${structName}'`
            );
          }
          
          const currentField = fields[i];
          
          
          
          
          const possibleMethod =
            `${structName}_${currentField}`;
          
          const isMethod =
            this.IRB.functions.has(possibleMethod);
          
          if (isMethod) {
            
            const fn =
              this.IRB.getFunction(possibleMethod);
            
            const args = [];
            
            // implicit this
            args.push(`ptr ${basePtr}`);
            
            // method args
            for (const argNode of (node.args || [])) {
              
              const arg =
                this.handleExpression(argNode);
              
              if (arg.local?.length) {
                local.push(...arg.local);
              }
              
              args.push(
                `${arg.llvmType} ${arg.ptr}`
              );
            }
            
            // void method
            if (fn.returnType.type === "void") {
              
              this.IRB.emit(
                `call void @${possibleMethod}(${args.join(", ")})`
              );
              
              return {
                ptr: null,
                type: "void",
                llvmType: "void",
                local,
                global: [],
                isVarRef: false
              };
            }
            
            // returning method
            const retType =
              this.IRB.getLLVMType(
                fn.returnType.type
              );
            
            const tmp =
              this.IRB.newTemp();
            
            this.IRB.emit(
              `${tmp} = call ${retType} @${possibleMethod}(${args.join(", ")})`
            );
            
            return {
              ptr: tmp,
              type: fn.returnType.type,
              llvmType: retType,
              local,
              global: [],
              isVarRef: false
            };
          }
          
          
          
          
          // =====================================
          // FIELD LOOKUP
          // =====================================
          
          const fieldIndex =
            structInfo.fieldMap[currentField];
          
          if (fieldIndex === undefined) {
            throw new Error(
              `[Zen Error] Struct field '${currentField}' does not exist in '${structName}'`
            );
          }
          
          fieldInfo =
            structInfo.layout[fieldIndex];
          
          const ptr =
            this.IRB.newTemp();
          
          this.IRB.emit(
            `${ptr} = getelementptr %${structName}, %${structName}* ${basePtr}, i32 0, i32 ${fieldIndex}`
          );
          
          basePtr = ptr;
          
          structName = fieldInfo.type;
        }
        
        // =====================================
        // STRUCT FIELD TYPES
        // =====================================
        
        const finalType =
          fieldInfo.llvmType;
        
        const isList =
          fieldInfo.isList;
        
        const isMap =
          fieldInfo.type === "Map";
        
        // =====================================
        // LIST RETURN
        // =====================================
        
        
        
        if (isList) {
          
          return {
            ptr: basePtr,
            type: fieldInfo.type,
            llvmType: "ptr",
            local: [],
            global: [],
            isList: true,
            isVarRef: true,
            generic: fieldInfo.generic
          };
        }
        /*
          // =====================================
          // MAP RETURN
          // =====================================

          if (isMap) {

            return {
              ptr: basePtr,
              type: "Map",
              llvmType: "ptr",
              local: [],
              global: [],
              isMap: true,
              isVarRef: true,
              layout: fieldInfo.layout
            };
            
          }

          // =====================================
          // NORMAL SCALAR LOAD
          // =====================================

          const val =
            this.IRB.newTemp();

          this.IRB.emit(
            `${val} = load ${finalType}, ${finalType}* ${basePtr}`
          );

          return {
            ptr: val,
            type: structName,
            llvmType: finalType,
            local: [],
            global: [],
            isVarRef: false
          };
          */
      }
      
      
      
      
      
      
      
      
      
      
      if (object?.isMap) {
        
        // =========================================
        // DECLARE RUNTIME
        // =========================================
        
        this.IRB.declareOneTime(
          "zen_map_get",
          "declare ptr @zen_map_get(ptr, ptr)"
        );
        
        // =========================================
        // MAP LAYOUT
        // =========================================
        
        let currentLayout =
          this.IRB.maps.get(
            base.name
          );
        
        
        if (!currentLayout) {
          
          throw new Error(
            `[Zen Error] Unknown map layout: ${base.name}`
          );
        }
        
        
        // =========================================
        // START CHAIN WALK
        // =========================================
        
        /* let currentMapPtr =
           object.ptr;*/
        
        let currentMapPtr = object.ptr;
        
        if (object.needsLoad) {
          const loaded = this.IRB.newTemp();
          
          this.IRB.emit(
            `${loaded} = load ptr, ptr ${currentMapPtr}`
          );
          
          currentMapPtr = loaded;
        }
        
        let resultPtr = null;
        let isList = false;
        let finalElementType = null;
        let finalType = "ptr";
        let finalLLVMType = "ptr";
        let finalMapLayout = null;
        // =========================================
        // WALK:
        // a.b.c.d
        // =========================================
        
        for (let i = 0; i < fields.length; i++) {
          
          const field =
            fields[i];
          
          // =========================================
          // VALIDATE FIELD
          // =========================================
          
          const freedSet = this.IRB.freedFields.get(object.name);
          
          if (freedSet?.has(field)) {
            this.IRB.emitError(
              "MemoryError",
              `map ${object.name} field '${field}' used after free`, node
            );
          }
          
          
          switch (field) {
            case 'free':
              const t = this.IRB.newTemp();
              this.IRB.emit(`${t} = load ptr, ptr ${object.ptr}`);
              this.IRB.emit(`call void @zen_map_free(ptr ${t})`);
              
              this.IRB.freedVars.add(base.name);
              
              return { local: [], global: [] }
              
            default:
              // Tab to edit
          }
          
          if (!currentLayout[field] && field !== "free") {
            
            throw new Error(
              `[Zen Error] Map field '${field}' does not exist`
            );
          }
          
          const meta =
            currentLayout[field];
          
          
          // =========================================
          // SWITCH TO LIST MEMBER ACCESS
          // =========================================
          
          if (
            meta.isList &&
            i < fields.length - 1
          ) {
            
            this.IRB.declareOneTime(
              "zen_map_get",
              "declare ptr @zen_map_get(ptr, ptr)"
            );
            
            // get actual list ptr first
            const keyPtr =
              this.IRB.newGlobalString(field);
            
            /*  if (keyPtr.local.length) {
                this.IRB.emit(keyPtr.local);
              } */
            
            const listPtr =
              this.IRB.newTemp();
            /*      let t;
                   
                     t = this.IRB.newTemp()
                     this.IRB.emit(`${t} = load ptr, ptr ${currentMapPtr}`)
                   */
            this.IRB.emit(
              `${listPtr} = call ptr @zen_map_get(` +
              `ptr ${currentMapPtr}, ` +
              `ptr ${keyPtr.name}` +
              `)`
            );
            
            // remaining field
            const nextField =
              fields[i + 1];
            
            
            const normalizedGeneric = this.IRB.normalizeGeneric(meta.elementType);
            
            // fake list object
            const fakeObject = {
              ptr: listPtr,
              basePtr: object.ptr,
              type: meta.type,
              llvmType: "ptr",
              isList: true,
              name: object?.name,
              generic: {
                generic: normalizedGeneric
              },
              fromParam: false,
              local: [],
              global: []
            };
            
            // =====================================
            // DIRECT LIST PROPERTY HANDLING
            // =====================================
            
            // =====================================
            // DIRECT LIST PROPERTY HANDLING
            // =====================================
            
            const listGeneric = meta.elementType;
            
            if (meta.isList) {
              return this.IRB.handleListProperty(listPtr, fakeObject, nextField, node, true, field);
            }
            
          }
          
          
          // =========================================
          // SAVE FINAL TYPE
          // =========================================
          
          finalType =
            meta.type === "List" ? meta?.elementType.type : meta.type;
          finalElementType = meta?.isVarRef ? meta.generic : meta.elementType;
          
          finalLLVMType =
            meta.llvmType;
          
          isList = meta.isList;
          
          // =========================================
          // KEY STRING
          // =========================================
          
          const keyPtr =
            this.IRB.newGlobalString(
              field
            );
          
          /*  if (keyPtr.local.length) {
              
              this.IRB.emit(
                keyPtr.local
              );
            }*/
          
          // =========================================
          // MAP GET
          // =========================================
          
          resultPtr =
            this.IRB.newTemp();
          /* const t = this.IRB.newTemp()
            this.IRB.emit(`${t} = load ptr, ptr ${currentMapPtr}`)*/
          this.IRB.emit(
            `${resultPtr} = call ptr @zen_map_get(` +
            `ptr ${currentMapPtr}, ` +
            `ptr ${keyPtr.name}` +
            `)`
          );
          
          // =========================================
          // NEXT MAP
          // =========================================
          
          if (meta.isMap) {
            
            currentLayout =
              meta.layout;
            finalMapLayout = meta.layout;
          }
          
          if (i < fields.length - 1) {
            
            currentMapPtr =
              resultPtr;
          }
        }
        
        // =========================================
        // PTR -> REAL TYPE
        // =========================================
        
        let finalPtr =
          resultPtr;
        
        if (!isList) {
          
          // int
          if (finalType === "int") {
            
            finalPtr = this.IRB.newTemp();
            
            this.IRB.emit(
              `${finalPtr} = load i32, ptr ${resultPtr}`
            );
          }
          
          // bool
          else if (finalType === "bool") {
            
            finalPtr = this.IRB.newTemp();
            
            this.IRB.emit(
              `${finalPtr} = load i1, ptr ${resultPtr}`
            );
          }
          
          // double
          else if (finalType === "double") {
            
            finalPtr = this.IRB.newTemp();
            
            this.IRB.emit(
              `${finalPtr} = load double, ptr ${resultPtr}`
            );
          }
        }
        
        // =========================================
        // RETURN FINAL VALUE
        // =========================================
        
        return {
          ptr: finalPtr,
          type: finalType,
          llvmType: finalLLVMType,
          local: [],
          global: [],
          isMapValue: true,
          isList,
          generic: {
            generic: this.IRB.normalizeGeneric(finalElementType)
          },
          layout: finalMapLayout,
          isMap: finalType === "Map"
        };
      }
      
      
      // list / method 
      
      let structName = object.type;
      let basePtr = object.ptr;
      const isList = object?.isList;
      const methodName = `${object.type}_${node.field}`;
      
      if (isList) {
        
        const o =
          this.handleExpression(node.object);
        
        if (o?.local?.length) {
          this.IRB.emit(o.local.join("\n"));
        }
        
        let listPtr =
          this.IRB.newTemp();
        
        if (!o.fromParam && o.needsLoad) {
          this.IRB.emit(
            `${listPtr} = load ptr, ptr ${o.ptr}`
          );
        } else {
          listPtr = o.ptr;
        }
        
        const field = node.field;
        /* const isNestedList = this.IRB.isNestedList(object.generic);
         
         if (field === "free" && isNestedList) {
           this.IRB.emitError("MemoryError", `Cannot free nested list '${base?.array?.name}'. Only top-level lists can be freed.`);
         }
         */
        o.name = base?.array?.o?.name;
        
        return this.IRB.handleListProperty(listPtr, o, field, node, false, base?.array?.field);
        
      }
      
      let fieldInfo;
      
      // walk struct
      for (let i = 0; i < fields.length; i++) {
        
        const structInfo = this.IRB.getStruct(structName);
        
        
        
        const currentField = fields[i];
        
        /*   const possibleMethod =
             `${structName}_${currentField}`;
           
           const isMethod =
             this.IRB.functions.has(possibleMethod);
           
           if (isMethod) {
             
             const fn =
               this.IRB.getFunction(possibleMethod);
             
             const args = [];
             
             // implicit this
             args.push(`ptr ${basePtr}`);
             
             // method args
             for (const argNode of (node.args || [])) {
               
               const arg =
                 this.handleExpression(argNode);
               
               if (arg.local?.length) {
                 local.push(...arg.local);
               }
               
               args.push(
                 `${arg.llvmType} ${arg.ptr}`
               );
             }
             
             // void method
             if (fn.returnType.type === "void") {
               
               this.IRB.emit(
                 `call void @${possibleMethod}(${args.join(", ")})`
               );
               
               return {
                 ptr: null,
                 type: "void",
                 llvmType: "void",
                 local,
                 global: [],
                 isVarRef: false
               };
             }
             
             // returning method
             const retType =
               this.IRB.getLLVMType(
                 fn.returnType.type
               );
             
             const tmp =
               this.IRB.newTemp();
             
             this.IRB.emit(
               `${tmp} = call ${retType} @${possibleMethod}(${args.join(", ")})`
             );
             
             return {
               ptr: tmp,
               type: fn.returnType.type,
               llvmType: retType,
               local,
               global: [],
               isVarRef: false
             };
           }
           */
        
        const fieldIndex = structInfo.fieldMap[fields[i]];
        
        fieldInfo = structInfo.layout[fieldIndex];
        
        const ptr = this.IRB.newTemp();
        
        this.IRB.emit(
          `${ptr} = getelementptr %${structName}, %${structName}* ${basePtr}, i32 0, i32 ${fieldIndex}`
        );
        
        basePtr = ptr;
        structName = fieldInfo.type;
      }
      
      const finalType = fieldInfo.llvmType;
      
      //  KEY FIX
      const isArray = finalType?.startsWith("[") || finalType?.isArray;
      const isStruct = this.IRB.hasStruct(structName);
      
      if (isArray || isStruct) {
        //  return pointer (so ARRAY_ACCESS can use it)
        return {
          ptr: basePtr,
          addr: basePtr, // IMPORTANT for your existing ARRAY_ACCESS
          type: structName,
          llvmType: finalType,
          local,
          global: [],
          isVarRef: false
        };
      }
      
      //  normal scalar → load
      const val = this.IRB.newTemp();
      
      local.push(
        `${val} = load ${finalType}, ${finalType}* ${basePtr}`
      );
      
      return {
        ptr: val,
        type: structName,
        llvmType: finalType,
        local,
        global: [],
        isVarRef: false
      };
      
    }
    
    if (node.type === "ARRAY_ACCESS") {
      
      const buildAccess = (n) => {
        if (n.type !== "ARRAY_ACCESS") {
          return this.handleExpression(n);
        }
        
        const base = buildAccess(n.array);
        
        if (base.local?.length) {
          local.push(...base.local);
        }
        
        const index = this.handleExpression(n.index);
        
        if (index.local.length) local.push(index.local.join("\n"))
        
        const ptr = this.IRB.newTemp();
        
        if (base.isVarArg) {
          local.push(
            `${ptr} = getelementptr ptr, ptr %varargs, i32 ${index.ptr}`
          );
          return {
            ptr,
            type: base.type,
            addr: ptr,
            isList: false,
            llvmType: this.IRB.getLLVMType(base.type),
            endLabel: null,
            postOrPrefix: false,
            isArray: false,
            isVarArg: true
          }
        }
        
        
        
        
        
        
        
        
        if (base.isList) {
          
          let listTemp = this.IRB.newTemp();
          
          if (
            base.isMapValue ||
            base.fromParam
          ) {
            listTemp = base.ptr;
          } else {
            
            listTemp = this.IRB.newTemp();
            
            local.push(
              `${listTemp} = load ptr, ptr ${base.ptr}`
            );
          }
          
          this.IRB.declareOneTime(
            "zen_list_get",
            "declare ptr @zen_list_get(ptr, i32)"
          );
          
          const elemPtr = this.IRB.newTemp();
          
          local.push(
            `${elemPtr} = call ptr @zen_list_get(ptr ${listTemp}, i32 ${index.ptr})`
          );
          
          const isListValue = !!base.generic
          
          
          const nextGeneric = base.generic?.generic;
          
          const normalizedGeneric =
            this.IRB.normalizeGeneric(nextGeneric);
          
          const isNested =
            normalizedGeneric?.type === "List";
          
          
          return {
            ptr: elemPtr,
            type: base.type,
            addr: elemPtr,
            isList: isNested,
            isListAccess: true,
            generic: normalizedGeneric,
            llvmType: isNested ? "ptr" : this.IRB.getLLVMType(base.type),
            endLabel: null,
            postOrPrefix: false,
            isArray: false,
            needsLoad: !isNested
          };
          
          
          
        }
        
        // =========================================
        // MAP ACCESS — a[key]
        // =========================================
        if (base.isMap) {
          const mapLayout = base.layout;
          const typeSet = new Set();
          let genericType;
          for (const key in mapLayout) {
            const isList = mapLayout[key]?.isList;
            if (isList) {
              typeSet.add("List");
              genericType = "List";
            } else {
              typeSet.add(mapLayout[key].type);
              genericType = mapLayout[key].type
            }
          }
          
          if (typeSet.size > 1) {
            this.IRB.emitError(
              "TypeError",
              `Map '${base.name}' is not uniform. Loop-in requires single type.`, node
            );
          }
          
          
          this.IRB.declareOneTime(
            "zen_map_get",
            "declare ptr @zen_map_get(ptr, ptr)"
          );
          
          // Load the map ptr if needed
          let mapPtr = base.ptr;
          if (base.needsLoad) {
            const loaded = this.IRB.newTemp();
            local.push(`${loaded} = load ptr, ptr ${mapPtr}`);
            mapPtr = loaded;
          }
          
          // index.ptr is the runtime key string ptr (from loopIn keyName binding)
          const resultPtr = this.IRB.newTemp();
          local.push(
            `${resultPtr} = call ptr @zen_map_get(ptr ${mapPtr}, ptr ${index.ptr})`
          );
          
          // Determine the value type from the map layout if available
          
          
          let meta;
          
          if (index.rawStr && mapLayout[index.rawStr]) {
            meta = mapLayout[index.rawStr];
          } else {
            meta = Object.values(mapLayout)[0]; // safe fallback
          }
          
          // =========================================
          // TYPE RESOLUTION (CORRECT FOR YOUR DESIGN)
          // =========================================
          
          // primitive type only (NEVER includes list info)
          let finalType = meta?.type || genericType;
          
          // list flag MUST come from meta directly
          const isList = meta?.isList || false;
          
          // element type (for nested reasoning / loops)
          const elementType = meta?.elementType || null;
          
          // LLVM type stays same logic
          const finalLLVMType =
            meta?.llvmType ?? this.IRB.getLLVMType(finalType);
          
          let finalPtr = resultPtr;
          
          
          //  let finalPtr = resultPtr; // ALWAYS keep ptr for containers
          
          return {
            ptr: finalPtr,
            type: finalType,
            llvmType: finalLLVMType,
            addr: finalType,
            local: [],
            global: [],
            isMapValue: true,
            isDynamicMapAccess: true,
            isList,
            isArray: false,
            needsLoad: false
          };
        }
        
        
        // string index access
        if (base.type === "string" && base.llvmType === "i8*") {
          
          if (base.local?.length) local.push(...base.local);
          if (base.global?.length) global.push(...base.global);
          
          local.push(
            `${ptr} = getelementptr i8, i8* ${base.ptr ?? base.addr}, i32 ${index.ptr}`
          );
          
          const t = this.IRB.newTemp();
          local.push(`${t} = load i8, i8* ${ptr}`);
          this.IRB.declareOneTime("zen_char_to_string", "declare i8* @zen_char_to_string(i8)");
          const tem = this.IRB.newTemp();
          local.push(`${tem} = call i8* @zen_char_to_string(i8 ${t})`);
          
          return {
            addr: tem,
            ptr: tem,
            llvmType: "i8*",
            type: "string",
            internalType: "char", // only for internal use
            local: base.local || [],
            global: []
          };
        }
        
        local.push(
          `${ptr} = getelementptr ${base.llvmType}, ${base.llvmType}* ${base.addr}, i32 0, i32 ${index.ptr}`
        );
        
        const nextType = this.IRB.getElementType(base.llvmType);
        
        return {
          addr: ptr,
          llvmType: nextType,
          type: base.type,
          local: base.local || [],
          global: []
        };
      };
      
      const final = buildAccess(node);
      
      const val = this.IRB.newTemp();
      
      const isStringCharAccess = final.internalType === "char";
      const isListAccess = final.isList;
      const isDynamicMapAccess = final.isDynamicMapAccess;
      const finalPtrShape = final.llvmType === "ptr" ? "ptr" : final.llvmType + "*";
      
      if (!isStringCharAccess && !isDynamicMapAccess) {
        local.push(
          
          `${val} = load ${final.llvmType}, ${finalPtrShape} ${final.addr}`
        );
      }
      
      return {
        ptr: isStringCharAccess || isDynamicMapAccess ? final.ptr : val,
        raw: final.addr,
        addr: final.ptr,
        type: final.type,
        llvmType: final.llvmType,
        local,
        isList: final.isList,
        global: [],
        endLabel: null,
        postOrPrefix: false,
        isArray: final.isArray, // for fn return error usage only
        generic: final?.generic,
        needsLoad: final.needsLoad,
        isListAccess: final?.isListAccess
      };
    }
    
    if (node.type === "MAP_LITERAL") {
      this.IRB.emitError("SemanticError", "Map literals not supported yet", node);
    }
    
    if (node.type === "CALL") {
      return this.call.handleCall(node, true, globalScope);
    }
    
    if (node.type === "UNARY_EXPRESSION") {
      
      const val = this.handleExpression(node.argument, globalScope);
      
      const local = [...(val.local || [])];
      const global = [...(val.global || [])];
      
      const v = val.ptr;
      
      if (node.argument.type === "string") {
        this.IRB.emitError("TypeError", "unary operators cannot be applied to type 'string'", node);
      }
      
      /* =========================
         LOGICAL NOT (!)
      ========================= */
      if (node.operator === "!") {
        let isValue;
        let boolVal;
        
        if (val.type === "int") {
          const t = this.IRB.newTemp();
          local.push(`${t} = icmp ne i32 ${v}, 0`);
          boolVal = t;
        }
        
        else if (val.type === "double") {
          const t = this.IRB.newTemp();
          local.push(`${t} = fcmp one double ${v}, 0.0`);
          boolVal = t;
        }
        
        else if (val.type === "bool") {
          boolVal = v;
        }
        
        else {
          this.IRB.emitError("TypeError", `Cannot apply ! to ${val.type}`, node);
        }
        
        const res = this.IRB.newTemp();
        local.push(`${res} = xor i1 ${boolVal}, true`);
        
        return {
          ptr: res,
          type: "bool",
          llvmType: "i1",
          local,
          global,
          endLabel: null,
          postOrPrefix: false,
          isVarRef: false
        };
      }
      
      /* =========================
         NEGATION (-)
      ========================= */
      if (node.operator === "-") {
        
        const res = this.IRB.newTemp();
        
        if (val.type === "int") {
          local.push(`${res} = sub i32 0, ${v}`);
          return {
            ptr: res,
            type: "int",
            llvmType: "i32",
            local,
            global,
            postOrPrefix: false,
            endLabel: null,
            isVarRef: false
          };
        }
        
        if (val.type === "double") {
          local.push(`${res} = fsub double 0.0, ${v}`);
          return {
            ptr: res,
            type: "double",
            llvmType: "double",
            local,
            global,
            endLabel: null,
            postOrPrefix: false,
            isVarRef: false
          };
        }
        
        if (val.type === "bool") {
          
          // bool is i1 in LLVM
          const ext = this.IRB.newTemp();
          
          local.push(`${ext} = zext i1 ${v} to i32`);
          local.push(`${res} = sub i32 0, ${ext}`);
          
          return {
            ptr: res,
            type: "int",
            llvmType: "i32",
            local,
            global,
            endLabel: null,
            postOrPrefix: false,
            isVarRef: false
          };
        }
        
        this.IRB.emitError("TypeError", `Cannot apply - to ${val.type}`, node);
      }
      
      /* ===============================
         Increment or Decrement postfix 
         or prefix unary
         ===============================*/
      
      if (node.operator === "++" || node.operator === "--") {
        
        const isInt = val.type === "int";
        const isDouble = val.type === "double";
        
        
        if (!isInt && !isDouble) {
          this.IRB.emitError(
            "TypeError",
            `expected numeric type (int or double), got ${val.type}`, node
          );
        }
        
        if (!val.isVarRef) {
          this.IRB.emitError(
            "ReferenceError",
            "invalid assignment target: expected variable reference", node
          );
        }
        
        const llvmType = isDouble ? "double" : "i32";
        const op = node.operator === "++" ? "add" : "sub";
        const one = isDouble ? "1.0" : "1";
        
        //  get variable address
        const old = val.ptr;
        
        //  compute new value
        const newVal = this.IRB.newTemp();
        local.push(`${newVal} = ${isDouble ? "f" : ""}${op} ${llvmType} ${old}, ${one}`);
        
        local.push(`store ${val.llvmType} ${newVal}, ${val.llvmType}* ${val.addr}`);
        
        //  return based on prefix/postfix
        return {
          ptr: node.isPostfix ? old : newVal,
          newVal: newVal, // for reference 
          type: val.type,
          llvmType,
          local,
          global,
          isVarRef: false,
          endLabel: null,
          isPostfix: node.isPostfix,
          postOrPrefix: true
        };
      }
      
      this.IRB.emitError("TypeError", `Unsupported unary operator ${node.operator}`, node);
    }
    
    /* =========================
       RECURSIVE RESOLVE
    ========================= */
    const resolve = (n) => {
      
      if (n.type === "BINARY_EXPRESSION") {
        
        this.IRB.containsUnary(n)
        return this.handleExpression(n, globalScope);
      }
      
      if (n.type === "string") {
        return this.handleExpression(n, globalScope);
      }
      
      if (n.type === "ARRAY_ACCESS") {
        return this.handleExpression(n, globalScope);
      }
      
      if (n.type === "ARRAY") {
        return this.handleExpression(n, globalScope);
      }
      
      if (n.type === "MEMBER_ACCESS") {
        return this.handleExpression(n, globalScope);
      }
      
      if (n.type === "CALL") {
        return this.call.handleCall(n, false, globalScope); // false : mark as not a statement not to push emit
      }
      
      /* ===== VARIABLE ===== */
      if (n.type === "variable") {
        return this.handleExpression(n, globalScope)
      }
      
      if (n.type === "TERNARY") {
        return this.handleExpression(n)
      }
      
      if (n.type === "MAP_LITERAL") {
        return this.handleExpression(n)
      }
      
      if (n.type === "UNARY_EXPRESSION") {
        this.IRB.containsUnary(n);
        return this.handleExpression(n);
      }
      
      if (n.type === "int" || n.type === "bool" || n.type === "double") {
        return this.handleExpression(n, globalScope)
      }
    };
    
    let lPtr = null;
    let rPtr = null;
    
    let lType = null;
    let rType = null;
    
    let lLLVMtype = null;
    let rLLVMtype = null;
    
    if (!LOGICAL_OPS.includes(op)) {
      let LNode = resolve(node.left);
      let RNode = resolve(node.right);
      
      lPtr = LNode.ptr;
      rPtr = RNode.ptr;
      
      lType = LNode.type;
      rType = RNode.type;
      
      lLLVMtype = LNode.llvmType;
      rLLVMtype = RNode.llvmType;
      // merge child IR first
      local.push(...LNode.local || [], ...RNode.local || []);
      global.push(...LNode.global || [], ...RNode.global || []);
      
    }
    
  /* =========================
       1. STRING CASE 
    ========================= 
    if (lType === "string" && rType === "string") {
      
      
      if (["-", "/", "*", "%"].includes(op)) {
        this.IRB.emitError(
          "TypeError",
          `invalid string operator '${op}', expected '+'`, node
        )
      }
      
      if (op === "+") {
        this.IRB.declareOneTime("str_concat", "declare i8* @str_concat(i8*, i8*)");
        
        const resultPtr = this.IRB.newTemp();
        
        /* ---------- CONCAT --------
        local.push(
          `${resultPtr} = call i8* @str_concat(i8* ${lPtr}, i8* ${rPtr})`
        );
        
        return {
          ptr: resultPtr,
          type: "string",
          llvmType: "i8*",
          local: local,
          global: global,
          endLabel: null,
          postOrPrefix: false
        };
      }
      
      
      if (COMPARISON_OPS.includes(op)) {
        
        this.IRB.declareOneTime(
          "str_cmp",
          "declare i32 @strcmp(i8*, i8*)"
        );
        
        const resultPtr = this.IRB.newTemp();
        
        const l = lPtr;
        const r = rPtr;
        
        const cmp = this.IRB.newTemp();
        local.push(
          `${cmp} = call i32 @strcmp(i8* ${l}, i8* ${r})`
        );
        
        // convert strcmp result → boolean
        const boolPtr = this.IRB.newTemp();
        
        if (op === "==") {
          local.push(`${boolPtr} = icmp eq i32 ${cmp}, 0`);
        }
        else if (op === "!=") {
          local.push(`${boolPtr} = icmp ne i32 ${cmp}, 0`);
        }
        else if (op === ">") {
          local.push(`${boolPtr} = icmp sgt i32 ${cmp}, 0`);
        }
        else if (op === "<") {
          local.push(`${boolPtr} = icmp slt i32 ${cmp}, 0`);
        }
        else if (op === ">=") {
          local.push(`${boolPtr} = icmp sge i32 ${cmp}, 0`);
        }
        else if (op === "<=") {
          local.push(`${boolPtr} = icmp sle i32 ${cmp}, 0`);
        }
        
        return {
          ptr: boolPtr,
          type: "bool",
          llvmType: "i1",
          local,
          global,
          postOrPrefix: false,
          endLabel: null
        };
      }
      
    } else if (
      (lType === "string" &&
        rType !== "string") ||
      (rType === "string" && lType !== "string")
    ) {
      this.IRB.emitError(
        "TypeError",
        `cannot apply '${op}' to ${lType} and ${rType}`, node
      );
    }
    */
    
    
    
     if (lType === "string" || rType === "string") {
       
       const LNode = {
         ptr: lPtr,
         type: lType,
         llvmType: lLLVMtype
       }
       
       const RNode = {
         ptr: rPtr,
         type: rType,
         llvmType: rLLVMtype
       }
       
       let leftPtr = lPtr;
       let rightPtr = rPtr;
       
       if (lType !== "string") {
         switch (lType) {
           case 'int':
           case 'bool':
           case 'double':
            const cExpr = this.IRB.castExpression(LNode, "string");
            leftPtr = cExpr.ptr;
             break;
           
           default:
            this.IRB.emitError("TypeError", `Cannot cast ${lType} to string`, node);
         }
       }
       
       if (rType !== "string") {
         switch (rType) {
           case 'int':
           case 'bool':
           case 'double':
            const cExpr = this.IRB.castExpression(RNode, "string");
            rightPtr = cExpr.ptr;
             break;
           
           default:
            this.IRB.emitError("TypeError", `Cannot cast ${rType} to string`, node);
         }
       }
      
      
      if (["-", "/", "*", "%"].includes(op)) {
        this.IRB.emitError(
          "TypeError",
          `invalid string operator '${op}', expected '+'`, node
        )
      }
      
      if (op === "+") {
        this.IRB.declareOneTime("str_concat", "declare i8* @str_concat(i8*, i8*)");
        
        const resultPtr = this.IRB.newTemp();
        
        /* ---------- CONCAT --------*/
        local.push(
          `${resultPtr} = call i8* @str_concat(i8* ${leftPtr}, i8* ${rightPtr})`
        );
        
        return {
          ptr: resultPtr,
          type: "string",
          llvmType: "i8*",
          local: local,
          global: global,
          endLabel: null,
          postOrPrefix: false
        };
      }
      
      
      if (COMPARISON_OPS.includes(op)) {
        
        this.IRB.declareOneTime(
          "str_cmp",
          "declare i32 @strcmp(i8*, i8*)"
        );
        
        const resultPtr = this.IRB.newTemp();
        
        const l = lPtr;
        const r = rPtr;
        
        const cmp = this.IRB.newTemp();
        local.push(
          `${cmp} = call i32 @strcmp(i8* ${l}, i8* ${r})`
        );
        
        // convert strcmp result → boolean
        const boolPtr = this.IRB.newTemp();
        
        if (op === "==") {
          local.push(`${boolPtr} = icmp eq i32 ${cmp}, 0`);
        }
        else if (op === "!=") {
          local.push(`${boolPtr} = icmp ne i32 ${cmp}, 0`);
        }
        else if (op === ">") {
          local.push(`${boolPtr} = icmp sgt i32 ${cmp}, 0`);
        }
        else if (op === "<") {
          local.push(`${boolPtr} = icmp slt i32 ${cmp}, 0`);
        }
        else if (op === ">=") {
          local.push(`${boolPtr} = icmp sge i32 ${cmp}, 0`);
        }
        else if (op === "<=") {
          local.push(`${boolPtr} = icmp sle i32 ${cmp}, 0`);
        }
        
        return {
          ptr: boolPtr,
          type: "bool",
          llvmType: "i1",
          local,
          global,
          postOrPrefix: false,
          endLabel: null
        };
      }
      
    } else if (
      (lType === "string" &&
        rType !== "string") ||
      (rType === "string" && lType !== "string")
    ) {
      this.IRB.emitError(
        "TypeError",
        `cannot apply '${op}' to ${lType} and ${rType}`, node
      );
    }
    
    
    
    /* =========================
       2. NORMALIZE (bool → int)
    ========================= */
    const normalize = (type, val) => {
      
      if (type === "bool") {
        const t = this.IRB.newTemp();
        local.push(`${t} = zext i1 ${val} to i32`);
        return { type: "int", llvmType: "i32", value: t };
      }
      
      if (type === "int") {
        return { type, llvmType: "i32", value: val };
      }
      
      if (type === "double") {
        return { type, llvmType: "double", value: val };
      }
    };
    
    const L = normalize(lType, lPtr);
    const R = normalize(rType, rPtr);
    
    if (LOGICAL_OPS.includes(op)) {
      
      const result = this.IRB.newTemp();
      
      const rhsLabel = this.IRB.newLabel("rhs");
      const skipLabel = this.IRB.newLabel("skip");
      const endLabel = this.IRB.newLabel("end");
      
      /* ========= LEFT ========= */
      const LNode = resolve(node.left);
      
      local.push(...LNode.local || []);
      global.push(...LNode.global || []);
      
      const toBool = (val, type) => {
        if (type === "bool") {
          const t = this.IRB.newTemp();
          local.push(`${t} = add i1 ${val}, 0`);
          return t;
        }
        
        const t = this.IRB.newTemp();
        
        if (type === "int") {
          local.push(`${t} = icmp ne i32 ${val}, 0`);
        }
        else if (type === "double") {
          local.push(`${t} = fcmp one double ${val}, 0.0`);
        }
        else if (type === "string") {
          const t0 = this.IRB.newTemp();
          local.push(`${t0} = load i8, i8* ${val}`);
          local.push(`${t} = icmp ne i8 ${t0}, 0`);
        }
        else {
          this.IRB.emitError("TypeError", `Cannot convert ${type} to bool`, node);
        }
        
        return t;
      };
      
      const lBool = toBool(LNode.ptr, LNode.type);
      
      /* ========= BRANCH ========= */
      if (op === "&&") {
        local.push(`br i1 ${lBool}, label %${rhsLabel}, label %${skipLabel}`);
      } else {
        local.push(`br i1 ${lBool}, label %${skipLabel}, label %${rhsLabel}`);
      }
      
      /* ========= RHS ========= */
      local.push(`${rhsLabel}:`);
      
      const RNode = resolve(node.right);
      
      local.push(...RNode.local || []);
      global.push(...RNode.global || []);
      
      const rBool = toBool(RNode.ptr, RNode.type);
      
      // IMPORTANT: RHS may end in another block (nested short circuit)
      const rIncomingBlock = RNode.endLabel || rhsLabel;
      
      local.push(`br label %${endLabel}`);
      
      /* ========= SKIP ========= */
      local.push(`${skipLabel}:`);
      local.push(`br label %${endLabel}`);
      
      /* ========= END ========= */
      local.push(`${endLabel}:`);
      
      const skipValue = op === "&&" ? "false" : "true";
      
      local.push(
        `${result} = phi i1 [ ${skipValue}, %${skipLabel} ], [ ${rBool}, %${rIncomingBlock} ]`
      );
      
      return {
        ptr: result,
        type: "bool",
        llvmType: "i1",
        local,
        global,
        postOrPrefix: false,
        endLabel: endLabel
      };
    }
    
    
    if (COMPARISON_OPS.includes(op)) {
      const result = this.IRB.newTemp();
      
      const isDouble = L.type === "double" || R.type === "double";
      
      const llvmOp = isDouble ?
        `fcmp ${fcmpMap[op]}` :
        `icmp ${cmpMap[op]}`;
      
      const type = isDouble ? "double" : "int";
      
      // type promotion in comparison 
      if (type === "double") {
        
        if (L.type === "int") {
          const t = this.IRB.newTemp();
          local.push(`${t} = sitofp i32 ${L.value} to double`);
          L.value = t;
        }
        
        if (R.type === "int") {
          const t = this.IRB.newTemp();
          local.push(`${t} = sitofp i32 ${R.value} to double`);
          R.value = t;
        }
      }
      
      local.push(
        `${result} = ${llvmOp} ${this.IRB.getLLVMType(type)} ${L.value}, ${R.value}`
      );
      
      
      return {
        ptr: result,
        type: "bool",
        llvmType: "i1",
        local: local,
        global: global,
        endLabel: null,
        postOrPrefix: false
      };
    }
    
    /* =========================
       3. TYPE PROMOTION
    ========================= */
    let resultType =
      LOOKUP[L.type] > LOOKUP[R.type] ?
      L.type :
      R.type;
    
    if (resultType === "double") {
      
      if (L.type === "int") {
        const t = this.IRB.newTemp();
        local.push(`${t} = sitofp i32 ${L.value} to double`);
        L.value = t;
      }
      
      if (R.type === "int") {
        const t = this.IRB.newTemp();
        local.push(`${t} = sitofp i32 ${R.value} to double`);
        R.value = t;
      }
    }
    
    const opcode = OP_CODES[resultType][op];
    
    if (!opcode) {
      this.IRB.emitError(
        "TypeError",
        `cannot apply '${op}' to ${leftType} and ${rightType}`, node
      );
    }
    
    const result = this.IRB.newTemp();
    
    local.push(
      `${result} = ${opcode} ${this.IRB.getLLVMType(resultType)} ${L.value}, ${R.value}`
    );
    
    return {
      ptr: result,
      type: resultType,
      llvmType: this.IRB.getLLVMType(resultType),
      local,
      global,
      endLabel: null,
      postOrPrefix: false
    };
  }
}