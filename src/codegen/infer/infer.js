export class InferType {
  constructor(IRB, scope = {}) {
    this.IRB = IRB;
    this.numericTypes = ["int", "double", "bool"];
  }
  
  infer(node) {
    
    if (!node) {
      throw new Error("Invalid AST node");
    }
    
    switch (node.type) {
      
      // =========================
      // LITERALS
      // =========================
      
      case "int":
        node.inferredType = "int";
        return "int";
        
      case "double":
        node.inferredType = "double";
        return "double";
        
      case "bool":
        node.inferredType = "bool";
        return "bool";
        
      case "string":
        node.inferredType = "string";
        return "string";
        
        // =========================
        // VARIABLE
        // =========================
        
      case "variable": {
        const data = this.IRB.getVar(node.name, node);
        const type = data.type;
        
        if (!type) {
          throw new Error(`Undefined variable '${node.name}'`);
        }
        
        if (data.isList) {
          node.inferredType = "List";
          return "List";
        } else if (data.isMap) {
          node.inferredType = "Map";
          return "Map";
        } else {
          node.inferredType = type;
        }
        
        return type;
      }
      
      // function declaration 
      
      case 'FUNCTION_DECLARATION': {
        
        // find return statement
        const returnStmt = node.body.body.find(
          stmt => stmt.type === "RETURN"
        );
        
        // implicit void
        if (!returnStmt) {
          
          node.returnType = {
            type: "void",
            dimensions: []
          };
          
          return {
            type: "void"
          };
        }
        
        // auto return inference
        if (node.returnType.type === "auto") {
          
          const inferred = this.infer(returnStmt.value);
          
          node.returnType = {
            type: inferred.type,
            dimensions: []
          };
          
          return inferred;
        }
        
        // explicit return type
        return {
          type: node.returnType.type
        };
      }
      
      case "ARRAY_ACCESS": {
        
        const data = this.IRB.getVar(node.array.name, node);
        const type = data.type;
        
        const isList = data?.generic?.generic.type === "List";
        
        if (isList) return "List"
        
        if (data.isMap) {
          const index = node.index.value;
          let type =
            this.IRB.maps.get(node.array.name)[index].type;
          return type;
        }
        
        
        return type;
      }
      
      /*  case "MEMBER_ACCESS": {
          
          const { base, fields } =
          this.IRB.resolveMemberChain(node);
          
          let currentType =
            this.IRB.getVar(base.name).type;
          
          let fieldInfo;
          
          for (const field of fields) {
            
            const structInfo =
              this.IRB.getStruct(currentType);
            
            const fieldIndex =
              structInfo.fieldMap[field];
            
            fieldInfo =
              structInfo.layout[fieldIndex];
            
            currentType =
              fieldInfo.type;
          }
          
          return fieldInfo.type;
        }
        */
      
      
      case "MEMBER_ACCESS": {
        
        const { base, fields } =
        this.IRB.resolveMemberChain(node);
        
        // =========================
        // MAP ACCESS
        // =========================
        
        if (base.type === "variable") {
          
          const varInfo = this.IRB.getVar(base.name, node);
          
          // MAP ROOT
          if (varInfo.type === "Map" || varInfo.isMap) {
            
            let currentLayout =
              this.IRB.maps.get(base.name);
            
            let currentType = "Map";
            let fieldInfo;
            
            for (const field of fields) {
              
              if (!currentLayout[field]) {
                throw new Error(
                  `[Zen Error] Map field '${field}' does not exist`
                );
              }
              
              fieldInfo = currentLayout[field];
              
              currentType = fieldInfo.type;
              
              // move deeper for nested map
              if (fieldInfo.isMap) {
                currentLayout = fieldInfo.layout;
              }
            }
            
            return currentType;
          }
        }
        
        // =========================
        // STRUCT ACCESS
        // =========================
        
        let currentType =
          this.IRB.getVar(base.name, node).type;
        
        let fieldInfo;
        
        for (const field of fields) {
          
          const structInfo =
            this.IRB.getStruct(currentType);
          
          const fieldIndex =
            structInfo.fieldMap[field];
          
          fieldInfo =
            structInfo.layout[fieldIndex];
          
          currentType =
            fieldInfo.type;
        }
        
        return fieldInfo.type;
      }
      
      
      // =========================
      // FUNCTION CALL
      // =========================
      
      case "CALL": {
        
        // normal function
        if (node.name) {
          
          const fn =
            this.IRB.getFunction(node.name);
          
          if (!fn) {
            throw new Error(
              `Function '${node.name}' not found`
            );
          }
          
          node.inferredType =
            fn.returnType;
          
          return fn.returnType;
        }
        
        // method call
        if (
          node.callee &&
          node.callee.type === "MEMBER_ACCESS"
        ) {
          
          const object =
            node.callee.object;
          
          const methodName =
            node.callee.field;
          
          // infer object type
          const structName =
            this.infer(object);
          
          const fullMethodName =
            `${structName}_${methodName}`;
          
          const fn =
            this.IRB.getFunction(fullMethodName);
          
          if (!fn) {
            throw new Error(
              `Method '${fullMethodName}' not found`
            );
          }
          
          node.inferredType =
            fn.returnType;
          
          return fn.returnType;
        }
      }
      
      // =========================
      // ARRAY
      // =========================
      
      case "ARRAY": {
        
        // []
        if (node.elements.length === 0) {
          node.inferredType = "int";
          return "int";
        }
        
        // infer from first element
        const firstType = this.infer(node.elements[0]);
        
        // validate all elements
        for (const el of node.elements) {
          const currentType = this.infer(el);
          
          if (currentType !== firstType) {
            throw new Error(
              `Array element type mismatch '${currentType}' != '${firstType}'`
            );
          }
        }
        
        node.inferredType = firstType;
        
        return firstType;
      }
      
      // =========================
      // BINARY EXPRESSION
      // =========================
      
      case "BINARY_EXPRESSION": {
        const leftType = this.infer(node.left);
        const rightType = this.infer(node.right);
        
        const op = node.operator;
        
        // -------------------------
        // ARITHMETIC
        // -------------------------
        
        if (["+", "-", "*", "/", "%"].includes(op)) {
          
          if (leftType === "string" || rightType === "string") {
            node.inferredType = "string";
            return "string";
          }
          
          let lType = leftType
          let rType = rightType
          
          // double dominance
          if (lType === "double" || rType === "double") {
            node.inferredType = "double";
            return "double";
          }
          
          node.inferredType = "int";
          return "int";
        }
        
        // -------------------------
        // COMPARISON
        // -------------------------
        
        if (["==", "!=", ">", "<", ">=", "<="].includes(op)) {
          
          node.inferredType = "bool";
          
          return "bool";
        }
        
        // -------------------------
        // LOGICAL
        // -------------------------
        
        if (["&&", "||"].includes(op)) {
          
          if (leftType !== "bool") {
            throw new Error(
              `Logical operator '${op}' requires bool left operand`
            );
          }
          
          if (rightType !== "bool") {
            throw new Error(
              `Logical operator '${op}' requires bool right operand`
            );
          }
          
          node.inferredType = "bool";
          
          return "bool";
        }
        
        throw new Error(`Unknown operator '${op}'`);
      }
      
      // =========================
      // UNARY EXPRESSION
      // =========================
      
      case "UNARY_EXPRESSION": {
        const valueType = this.infer(node.argument);
        
        if (node.operator === "!") {
          
          node.inferredType = "bool";
          
          return "bool";
        }
        
        if (node.operator === "-") {
          
          let orgType = this.ensureNumeric(valueType, "-");
          
          node.inferredType = orgType;
          if (orgType === "bool") orgType = "int";
          return orgType;
        }
        
        if (node.operator === "++" || node.operator === "--") {
          node.inferredType = valueType;
          return valueType;
        }
        
        throw new Error(`Unknown unary operator '${node.operator}'`);
      }
      
      case "TERNARY": {
        
        const conditionType = this.infer(node.condition);
        
        if (conditionType !== "bool") {
          throw new Error("Ternary condition must be bool");
        }
        
        const leftType = this.infer(node.trueExpr);
        const rightType = this.infer(node.falseExpr);
        
        if (leftType !== rightType) {
          throw new Error(
            `Ternary type mismatch '${leftType}' != '${rightType}'`
          );
        }
        
        node.inferredType = leftType;
        return leftType;
      }
      
      // =========================
      // VARIABLE DECLARATION
      // =========================
      
      case "VARIABLE_DECLARATION": {
        
        let finalType;
        
        // auto
        if (node.dataType === "auto") {
          
          // array
          if (node.isArray) {
            finalType = this.infer(node.value);
          } else {
            
            finalType = this.infer(node.value);
          }
        }
        
        // strict type
        else {
          
          finalType = node.dataType;
          
          const valueType = this.infer(node.value);
          
          if (valueType !== finalType) {
            throw new Error(
              `Cannot assign '${valueType}' to '${finalType}'`
            );
          }
        }
        
        node.inferredType = finalType;
        
        return finalType;
      }
      
      default:
        this.IRB.emitError(
          "InferError",
          `Cannot infer node type '${node.type}'`, node
        );
        
    }
  }
  
  ensureNumeric(type, op) {
    if (!this.numericTypes.includes(type)) {
      throw new Error(
        `Operator '${op}' requires numeric types. Got '${type}'`
      );
    }
    return type;
  }
}