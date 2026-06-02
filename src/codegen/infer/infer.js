export class InferType {
  constructor(IRB, scope = {}) {
    this.IRB = IRB;
    this.numericTypes = ["int", "double", "bool"];
  }
  
  infer(node) {
    
    if (!node) {
      this.IRB.emitError(
        "InternalError",
        "Invalid AST node",
        node
      );
    }
    
    switch (node.type) {
      
      // LITERALS
      
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
        
        // VARIABLE
        
      case "variable": {
        const data = this.IRB.getVar(node.name, node);
        const type = data.type;
        
        if (!type) {
          this.IRB.emitError(
            "ReferenceError",
            `Undefined variable '${node.name}'`,
            node
          );
        }
        
        if (data.isList) {
          this.IRB.emitError("SemanticError", `function '${name}' not allowed 'List' return inference`, node);
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
      
      case 'ARRAY': {
        this.IRB.emitError("SemanticError", `List not allowed inference`, node);
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
      
      case "MEMBER_ACCESS": {
        
        const { base, fields } =
        this.IRB.resolveMemberChain(node);
        
        // MAP ACCESS
        
        if (base.type === "variable") {
          
          const varInfo = this.IRB.getVar(base.name, node);
          
          // MAP ROOT
          if (varInfo.type === "Map" || varInfo.isMap) {
            
            let currentLayout =
              this.IRB.maps.get(base.name);
            
            if (!currentLayout) {
              this.IRB.emitError("InternalError", `Unknown Map '${base.name}' layout`, node)
            }
            
            let currentType = "Map";
            let fieldInfo;
            
            for (const field of fields) {
              
              if (!currentLayout[field]) {
                this.IRB.emitError(
                  "ReferenceError",
                  `Unknown map field '${field}'`,
                  node
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
        
        // STRUCT ACCESS
        let currentType;
        if (base.value === "this") {
          
          currentType = this.IRB.currentStruct;
          
        } else {
          
          currentType = this.IRB.getVar(base.name, node).type;
        }
        
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
      
      // FUNCTION CALL
      
      case "CALL": {
        
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
            this.IRB.emitError(
              "ReferenceError",
              `Method '${fullMethodName}' not found`,
              node
            );
          }
          
          node.inferredType =
            fn.returnType;
          
          return fn.returnType;
        }
        
        // normal function
        if (node.name) {
          
          const fn =
            this.IRB.getFunction(node.name);
          
          if (!fn) {
            this.IRB.emitError(
              "ReferenceError",
              `Function '${node.name}' not found`,
              node
            );
          }
          
          node.inferredType =
            fn.returnType;
          
          return fn.returnType;
        }
      }
      
      // ARRAY
      
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
            this.IRB.emitError(
              "TypeError",
              `Array element type mismatch '${currentType}' != '${firstType}'`,
              node
            );
          }
        }
        
        node.inferredType = firstType;
        
        return firstType;
      }
      
      // BINARY EXPRESSION
      
      case "BINARY_EXPRESSION": {
        const leftType = this.infer(node.left);
        const rightType = this.infer(node.right);
        
        const op = node.operator;
        
        // ARITHMETIC
        
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
        
        // COMPARISON
        
        if (["==", "!=", ">", "<", ">=", "<="].includes(op)) {
          
          node.inferredType = "bool";
          
          return "bool";
        }
        
        // LOGICAL
        
        if (["&&", "||"].includes(op)) {
          
          if (leftType !== "bool") {
            this.IRB.emitError(
              "TypeError",
              `Logical operator '${op}' requires boolean left operand`,
              node
            );
          }
          
          if (rightType !== "bool") {
            this.IRB.emitError(
              "TypeError",
              `Logical operator '${op}' requires boolean right operand`,
              node
            );
          }
          
          node.inferredType = "bool";
          
          return "bool";
        }
        
        this.IRB.emitError(
          "SyntaxError",
          `Unknown operator '${op}'`,
          node
        );
      }
      
      // UNARY EXPRESSION
      
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
        
        this.IRB.emitError(
          "SyntaxError",
          `Unknown unary operator '${node.operator}'`,
          node
        );
      }
      
      case "TERNARY": {
        
        const conditionType = this.infer(node.condition);
        
        if (conditionType !== "bool") {
          this.IRB.emitError(
            "TypeError",
            "Ternary condition must be bool",
            node
          );
        }
        
        const leftType = this.infer(node.trueExpr);
        const rightType = this.infer(node.falseExpr);
        
        if (leftType !== rightType) {
          this.IRB.emitError(
            "TypeError",
            `Ternary type mismatch '${leftType}' != '${rightType}'`,
            node
          );
        }
        
        node.inferredType = leftType;
        return leftType;
      }
      
      // VARIABLE DECLARATION
      
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
            this.IRB.emitError(
              "TypeError",
              `Cannot assign '${valueType}' to '${finalType}'`,
              node
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
      this.IRB.emitError(
        "TypeError",
        `Operator '${op}' requires numeric types. Got '${type}'`,
        node
      );
    }
    return type;
  }
}