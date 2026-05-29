import { ParserTypes, BUILTIN_FUNCTIONS, TYPES } from '/src/config/config.js';

export class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }
  
  // =========================
  // HELPERS
  // =========================
  
  current() {
    return this.tokens[this.pos];
  }
  
  advance() {
    const token = this.tokens[this.pos++];
    
    this.lastToken = token;
    
    return token;
  }
  
  node(node) {
    node.line = this.lastToken?.line;
    node.column = this.lastToken?.column;
    return node;
  }
  
  match(type) {
    return this.current()?.type === type;
  }
  
  expect(type) {
    if (!this.match(type)) {
      throw new Error(`[Zen Error] parser: Expected ${type}, got ${this.current()?.type}`);
    }
    return this.advance();
  }
  
  skipNewlines() {
    while (this.match("NEWLINE")) {
      this.advance();
    }
  }
  
  matchKeyword(value) {
    return this.current()?.type === "KEYWORD" &&
      this.current()?.value === value;
  }
  
  expectKeyword(value) {
    if (!this.matchKeyword(value)) {
      throw new Error(`[Zen Error] parser: Expected keyword ${value}, got ${this.current()?.value}`);
    }
    return this.advance();
  }
  
  peek(type) {
    return this.tokens[this.pos + 1]?.type === type;
  }
  
  // =========================
  // ENTRY
  // =========================
  parse() {
    const body = [];
    
    while (this.current() && !this.match("EOF")) {
      
      //  SKIP EMPTY LINES
      if (this.match("NEWLINE")) {
        this.advance();
        continue;
      }
      
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
      
      //  consume statement separator
      if (this.match("NEWLINE")) {
        this.advance();
      }
    }
    
    return body;
  }
  // =========================
  // STATEMENTS (IMPORTANT FIX)
  // =========================
  parseStatement() {
    if (this.match("TYPE") || this.matchKeyword("auto")) {
      return this.node(this.parseVariableDeclaration());
    }
    
    if (this.matchKeyword("switch")) {
      return this.node(this.parseSwitch());
    }
    
    if (this.matchKeyword("Map")) {
      return this.node(this.parseMap());
    }
    
    if (this.matchKeyword("do")) {
      return this.node(this.parseDoWhile());
    }
    
    if (this.matchKeyword("List")) {
      return this.node(this.parseList());
    }
    
    if (this.matchKeyword("import")) {
      return this.node(this.parseImport());
    }
    
    if (this.matchKeyword("struct")) {
      return this.node(this.parseStruct());
    }
    
    if (this.matchKeyword("export")) {
      return this.node(this.parseExport());
    }
    
    if (this.match("BLOCK_END")) return null;
    
    if (this.matchKeyword("return")) {
      this.advance();
      
      if (
        this.match("NEWLINE") ||
        this.match("BLOCK_END") ||
        this.match("EOF")
      ) {
        return null;
      }
      const value = this.parseExpression();
      
      return this.node({
        type: ParserTypes.RETURN,
        value
      });
    }
    
    if (this.matchKeyword("fn") || this.matchKeyword("async")) {
      let isAsync = false; // default mode 
      if (this.matchKeyword("async")) {
        isAsync = true;
      }
      return this.node(this.parseFunction(false, isAsync));
    }
    
    if (this.matchKeyword("while")) {
      return this.node(this.parseWhileLoop());
    }
    
    if (this.matchKeyword("break")) {
      this.expectKeyword("break");
      return this.node({ type: ParserTypes.BREAK });
    }
    
    if (
      this.matchKeyword("await") &&
      this.tokens[this.pos + 1].type === "IDENTIFIER" &&
      this.tokens[this.pos + 2].type === "LEFT_PARENTHESIS")
    {
      
      this.advance();
      
      const name =
        this.current().value;
      
      this.advance();
      
      return this.node(this.parseCall(
        name,
        true // isAwait 
      ));
    }
    
    if (this.match("IDENTIFIER") && this.peek("LEFT_PARENTHESIS")) {
      
      const name = this.current().value;
      this.advance();
      return this.node(this.parseCall(name, false));
    }
    
    if (this.matchKeyword("continue")) {
      this.expectKeyword("continue");
      return this.node({ type: ParserTypes.CONTINUE });
    }
    
    if (this.matchKeyword("loop")) {
      return this.node(this.parseLoop());
    }
    
    
    if (this.match("BLOCK_START")) {
      return this.node(this.parseBlock());
    }
    
    if (this.matchKeyword("if")) {
      return this.node(this.parseConditional());
    }
    
    if (this.match("LBRACKET")) {
      return this.node(this.parseExpression());
    }
    
    if (this.match("IDENTIFIER") && this.peek("IDENTIFIER")) {
      const struct_ref = this.advance().value;
      const name = this.advance().value;
      
      return this.node({
        type: ParserTypes.VARIABLE_DECLARATION,
        struct_ref,
        name
      });
    }
    
    if (this.match("IDENTIFIER")) {
      const expr = this.parseExpression();
      
      return this.node({
        type: ParserTypes.VARIABLE_REFERENCE,
        expression: expr
      });
    }
    
    const expr = this.parseExpression();
    
    return this.node({
      type: ParserTypes.VARIABLE_REFERENCE,
      expression: expr
    });
  }
  
  /*parseMap() {
    
    this.expectKeyword("Map");
    
    const name =
      this.expect("IDENTIFIER").value;
    
    this.expect("ASSIGNMENT");
    
    const value =
      this.parseExpression();
    
    return {
      type: ParserTypes.MAP_DECLARATION,
      name,
      value
    };
  }
  */
  
  parseMap() {
    this.expectKeyword("Map");
    
    const name = this.expect("IDENTIFIER").value;
    
    // optional assignment
    let value = null;
    
    if (this.current().type === "ASSIGNMENT") {
      this.expect("ASSIGNMENT");
      value = this.parseExpression();
    } else {
      // sugar: Map a => Map a = {}
      value = {
        type: "MAP_LITERAL",
        properties: []
      };
    }
    
    return this.node({
      type: ParserTypes.MAP_DECLARATION,
      name,
      value
    });
  }
  
  parseMapLiteral() {
    this.skipNewlines()
    this.expect("BLOCK_START");
    
    this.skipNewlines();
    
    const properties = [];
    
    while (
      !this.match("BLOCK_END") &&
      !this.match("EOF")
    ) {
      
      const key =
        this.expect("IDENTIFIER").value;
      
      let index = null;
      
      // hobbies[10]
      if (this.match("LBRACKET")) {
        
        this.advance();
        
        index =
          this.parseExpression();
        
        this.expect("RBRACKET");
      }
      
      this.expect("COLON");
      
      let value;
      
      // nested map
      if (this.match("BLOCK_START")) {
        value = this.parseMapLiteral();
      }
      else {
        value = this.parseExpression();
      }
      
      properties.push({
        type: ParserTypes.MAP_PROPERTY,
        key,
        index,
        value
      });
      
      if (this.match("COMMA")) {
        this.advance();
      }
      
      this.skipNewlines();
    }
    
    this.expect("BLOCK_END");
    
    return {
      type: ParserTypes.MAP_LITERAL,
      properties
    };
  }
  
  parseSwitch() {
    this.expectKeyword("switch");
    
    this.expect("LEFT_PARENTHESIS");
    const discriminant = this.parseExpression();
    this.expect("RIGHT_PARENTHESIS");
    
    this.expect("BLOCK_START");
    
    const cases = [];
    let defaultCase = null;
    
    this.skipNewlines();
    
    while (!this.match("BLOCK_END")) {
      
      this.skipNewlines();
      
      // =========================
      // CASE
      // =========================
      if (this.matchKeyword("case")) {
        this.advance(); // consume 'case'
        
        const value = this.parseExpression();
        this.expect("COLON");
        
        this.skipNewlines();
        
        const statements = [];
        
        while (
          !this.matchKeyword("case") &&
          !this.matchKeyword("default") &&
          !this.match("BLOCK_END")
        ) {
          this.skipNewlines();
          statements.push(this.parseStatement());
          this.skipNewlines();
        }
        
        cases.push({
          value,
          statements
        });
        
        continue;
      }
      
      // =========================
      // DEFAULT
      // =========================
      if (this.matchKeyword("default")) {
        this.advance(); // consume 'default'
        this.expect("COLON");
        
        this.skipNewlines();
        
        const statements = [];
        
        while (
          !this.match("BLOCK_END")
        ) {
          this.skipNewlines();
          statements.push(this.parseStatement());
          this.skipNewlines();
        }
        
        defaultCase = {
          statements
        };
        
        continue;
      }
      
      throw new Error(`[Zen Error] parser: Unexpected token in switch`);
    }
    
    this.expect("BLOCK_END");
    
    return {
      type: ParserTypes.SWITCH,
      discriminant,
      cases,
      defaultCase
    };
  }
  
  
  parseStruct() {
    this.expectKeyword("struct");
    
    const name = this.expect("IDENTIFIER").value;
    
    this.expect("BLOCK_START");
    
    const fields = [];
    const methods = [];
    
    while (!this.match("BLOCK_END")) {
      
      if (this.match("NEWLINE")) {
        this.advance();
        continue;
      }
      
      let isAsyncMethod = false;
      
      if (this.matchKeyword("async")) {
        isAsyncMethod = true;
        this.advance();
      }
      
      const nameToken = this.expect("IDENTIFIER");
      
      // =========================
      // METHOD DETECTION
      // =========================
      if (this.match("LEFT_PARENTHESIS")) {
        const method = this.parseFunction(true, isAsyncMethod);
        method.name = nameToken.value;
        method.isMethod = true;
        methods.push(method);
        continue;
      }
      
      // =========================
      // FIELD PARSE
      // =========================
      if (this.match("IDENTIFIER")) {
        // fixed-size array type: arr[10]
        const baseType = this.advance().value;
        const dimensions = [];
        
        while (this.match("LBRACKET")) {
          this.advance();
          
          if (this.match("RBRACKET")) {
            throw new Error("[Zen Error] parser: Array size missing");
          }
          
          const size = this.parseExpression();
          
          this.expect("RBRACKET");
          
          dimensions.push(size);
        }
        
        fields.push({
          name: nameToken.value,
          type: baseType,
          dimensions
        });
        
      } else {
        // int, bool, string, double, List, Map
        const typeNode = this.parseType();
        
        fields.push({
          name: nameToken.value,
          ...typeNode
        });
      }
      
      // formatting support
      if (this.match("NEWLINE")) this.advance();
      if (this.match("COMMA")) this.advance();
    }
    
    this.expect("BLOCK_END");
    
    return {
      type: ParserTypes.STRUCT,
      name,
      fields,
      methods
    };
  }
  
  expectLessThan() {
    const t = this.current();
    
    if (t?.type !== "COMPARISON" || t?.value !== "<") {
      throw new Error(
        `[Zen Error] parser: Expected LESS_THAN '<', got ${t?.value}`
      );
    }
    
    return this.advance();
  }
  
  expectGreaterThan() {
    const t = this.current();
    
    if (t?.type !== "COMPARISON" || t?.value !== ">") {
      throw new Error(
        `[Zen Error] parser: Expected GREATER_THAN '>', got ${t?.value}`
      );
    }
    
    return this.advance();
  }
  
  
  parseListGeneric() {
    
    // consume List
    this.expectKeyword("List");
    
    // <
    this.expectLessThan();
    
    let innerType;
    
    // nested list
    if (this.matchKeyword("List")) {
      
      innerType = this.parseListGeneric();
    }
    
    // primitive / struct
    else if (
      this.match("TYPE") ||
      this.match("IDENTIFIER")
    ) {
      
      innerType = {
        type: this.advance().value
      };
    }
    
    else {
      
      throw new Error(
        `[Zen Error] parser: Invalid List generic type`
      );
    }
    
    // >
    this.expectGreaterThan();
    
    return this.node({
      type: "List",
      generic: innerType
    });
  }
  
  parseList() {
    
    const generic =
      this.parseListGeneric();
    let isConstant = false;
    if (this.matchKeyword("const")) {
      isConstant = true;
      this.advance()
    }
    const name =
      this.expect("IDENTIFIER").value;
    
    let value = null;
    
    if (this.match("ASSIGNMENT")) {
      
      this.advance();
      
      value = this.parseExpression();
    }
    
    else {
      
      value = {
        type: ParserTypes.LIST_LITERAL,
        elements: []
      };
    }
    
    return {
      type: ParserTypes.VARIABLE_DECLARATION,
      dataType: "List",
      isConstant,
      generic,
      name,
      value,
      isList: true
    };
  }
  
  parseImport() {
    this.expectKeyword("import");
    this.expect("LEFT_PARENTHESIS");
    
    const names = [];
    
    while (!this.match("RIGHT_PARENTHESIS")) {
      names.push(this.expect("IDENTIFIER").value);
      
      if (this.match("COMMA")) {
        this.advance();
      }
    }
    
    this.expect("RIGHT_PARENTHESIS");
    this.expectKeyword("from");
    
    const source = this.expect("string").value;
    
    return {
      type: ParserTypes.IMPORT,
      names,
      source
    };
  }
  
  parseExport() {
    this.expectKeyword("export");
    this.expect("LEFT_PARENTHESIS");
    
    const names = [];
    
    while (!this.match("RIGHT_PARENTHESIS")) {
      names.push(this.expect("IDENTIFIER").value);
      
      if (this.match("COMMA")) {
        this.advance();
      }
    }
    
    this.expect("RIGHT_PARENTHESIS");
    
    return {
      type: ParserTypes.EXPORT,
      names
    };
  }
  
  parseDoWhile() {
    this.expectKeyword("do");
    
    let body;
    
    // =========================
    // BODY
    // =========================
    if (this.match("BLOCK_START")) {
      body = this.parseBlock();
    } else {
      body = this.parseStatement();
    }
    
    // =========================
    // EXPECT WHILE
    // =========================
    this.expectKeyword("while");
    
    this.expect("LEFT_PARENTHESIS");
    const condition = this.parseExpression();
    this.expect("RIGHT_PARENTHESIS");
    
    return {
      type: ParserTypes.DO_WHILE,
      body,
      condition
    };
  }
  
  parseWhileLoop() {
    this.expectKeyword("while");
    
    this.expect("LEFT_PARENTHESIS");
    const condition = this.parseExpression();
    this.expect("RIGHT_PARENTHESIS");
    
    let body;
    if (this.match("BLOCK_START")) {
      body = this.parseBlock();
    } else {
      body = this.parseStatement();
    }
    
    return {
      type: ParserTypes.WHILE,
      condition,
      body
    };
  }
  
  parseType(fromRet) {
    
    // =========================
    // GENERIC TYPE SUPPORT
    // =========================
    
    //if (!fromRet) {
    
    if (this.matchKeyword("List")) {
      return this.parseListGeneric();
      // }
      
      // ADD MAP SUPPORT HERE
      if (this.matchKeyword("Map")) {
        this.advance();
        
        return {
          type: "Map",
          dimensions: []
        };
      }
    }
    
    let baseType;
    
    if (this.match("TYPE")) {
      baseType = this.expect("TYPE").value;
    }
    
    else if (this.matchKeyword("List")) {
      baseType = this.expectKeyword("List").value;
    }
    
    // (safe fallback for Map in typed contexts)
    else if (this.matchKeyword("Map")) {
      baseType = this.expectKeyword("Map").value;
    }
    
    else {
      throw new Error(
        `SyntaxError Unknown type '${this.current()?.value}'`
      );
    }
    
    const dimensions = [];
    
    while (this.match("LBRACKET")) {
      this.advance();
      
      let size = null;
      
      if (!this.match("RBRACKET")) {
        size = this.parseExpression();
      }
      
      this.expect("RBRACKET");
      
      dimensions.push(size);
    }
    
    return {
      type: baseType,
      dimensions
    };
  }
  
  parseFunction(isInsideMethod = false, isAsyncFn = false) {
    let isAsync = isAsyncFn;
    if (!isInsideMethod) {
      if (this.matchKeyword("async")) {
        this.advance()
      }
      this.expectKeyword("fn");
    }
    
    let name;
    
    if (!isInsideMethod) {
      name = this.expect("IDENTIFIER").value;
      if (name.startsWith("_")) {
        throw new Error(
          `NamingError : Illegal identifier '${name}'. '_' prefix is reserved for Zen internal symbols (stdlib/runtime)`
        );
      }
    }
    
    this.expect("LEFT_PARENTHESIS");
    
    const params = [];
    
    while (!this.match("RIGHT_PARENTHESIS")) {
      this.skipNewlines()
      const t = this.parseType();
      
      const name = this.expect("IDENTIFIER").value;
      this.skipNewlines()
      let isRest = false;
      
      if (this.match("ELLIPSIS")) {
        this.advance();
        isRest = true;
      }
      
      let param = {
        type: t,
        name,
        dimensions: t.dimensions,
        isRest
      };
      if (isRest && !this.match("RIGHT_PARENTHESIS")) {
        throw new Error(
          "SyntaxError rest parameter must be last"
        );
      }
      if (this.match("ASSIGNMENT")) {
        this.advance();
        param.default = this.parseExpression();
      }
      
      params.push(param);
      
      if (this.match("COMMA")) {
        this.skipNewlines()
        this.advance();
        
      }
      
    }
    
    this.expect("RIGHT_PARENTHESIS");
    
    let returnType;
    
    // =========================
    // IMPLICIT VOID
    // =========================
    
    if (this.match("BLOCK_START")) {
      this.skipNewlines()
      returnType = {
        type: "void",
        dimensions: []
      };
    }
    
    // =========================
    // EXPLICIT VOID
    // =========================
    
    else if (this.matchKeyword("void")) {
      this.skipNewlines()
      returnType = {
        type: this.expectKeyword("void").value,
        dimensions: []
      };
    }
    
    // =========================
    // AUTO RETURN INFERENCE
    // =========================
    
    else if (
      this.match("KEYWORD") &&
      this.current().value === "auto"
    ) {
      
      this.advance();
      
      returnType = {
        type: "auto",
        dimensions: []
      };
    }
    
    // =========================
    // NORMAL TYPE
    // =========================
    
    else {
      
      returnType = this.parseType(true);
    }
    
    const body = this.parseBlock();
    
    return {
      type: ParserTypes.FUNCTION_DECLARATION,
      name,
      isAsync: isAsyncFn,
      params,
      returnType,
      body
    };
  }
  
  parseLoop() {
    
    this.expectKeyword("loop");
    this.expect("LEFT_PARENTHESIS");
    
    // =====================================================
    // LOOP OF / LOOP IN DETECTION
    // =====================================================
    
    const next1 = this.tokens[this.pos];
    const next2 = this.tokens[this.pos + 1];
    const next3 = this.tokens[this.pos + 2];
    
    const isLoopOf =
      next1?.type === "IDENTIFIER" &&
      next2?.type === "KEYWORD" &&
      next2.value === "of";
    
    const isLoopIn =
      next1?.type === "IDENTIFIER" &&
      next2?.type === "KEYWORD" &&
      next2.value === "in";
    
    // =====================================================
    // LOOP OF (ARRAY / LIST)
    // loop (int i of arr)
    // =====================================================
    
    if (isLoopOf) {
      
      //const varType = this.expect("TYPE").value;
      const varName = this.expect("IDENTIFIER").value;
      
      this.expectKeyword("of");
      
      const iterable = this.parseExpression();
      this.expect("RIGHT_PARENTHESIS");
      
      const body =
        this.match("BLOCK_START") ?
        this.parseBlock() :
        this.parseStatement();
      
      return this.node({
        type: ParserTypes.LOOP_OF,
        // varType,
        varName,
        iterable,
        body
      });
    }
    
    // =====================================================
    // LOOP IN (MAP)
    // loop (key in map)
    // =====================================================
    
    if (isLoopIn) {
      
      const keyName = this.expect("IDENTIFIER").value;
      
      this.expectKeyword("in");
      
      const iterable = this.parseExpression();
      this.expect("RIGHT_PARENTHESIS");
      
      const body =
        this.match("BLOCK_START") ?
        this.parseBlock() :
        this.parseStatement();
      
      return this.node({
        type: ParserTypes.LOOP_IN,
        keyName,
        iterable,
        body
      });
    }
    
    // =====================================================
    // C-STYLE LOOP
    // loop (init, condition, update)
    // =====================================================
    
    let first;
    
    if (this.match("TYPE") || this.matchKeyword("auto")) {
      first = this.parseVariableDeclaration();
    } else {
      first = this.parseExpression();
    }
    
    this.expect("COMMA");
    
    let second = this.parseExpression();
    
    let init = null;
    let condition = null;
    let update = null;
    
    if (this.match("COMMA")) {
      
      this.advance();
      
      let third;
      
      if (
        this.match("IDENTIFIER") && ["PLUS_PLUS", "MINUS_MINUS"].includes(
          this.tokens[this.pos + 1]?.type
        )
      ) {
        const name = this.expect("IDENTIFIER").value;
        const opToken = this.advance();
        
        third = {
          type: ParserTypes.UNARY_EXPRESSION,
          operator: opToken.value,
          argument: {
            type: ParserTypes.VARIABLE,
            name
          }
        };
        
      } else {
        third = this.node(this.parseExpression());
      }
      
      init = first;
      condition = second;
      update = third;
      
    } else {
      condition = first;
      update = second;
    }
    
    this.expect("RIGHT_PARENTHESIS");
    
    const body =
      this.match("BLOCK_START") ?
      this.parseBlock() :
      this.parseStatement();
    
    return this.node({
      type: ParserTypes.LOOP,
      init,
      condition,
      update,
      body
    });
  }
  
  parseConditional() {
    this.expectKeyword("if");
    
    this.expect("LEFT_PARENTHESIS");
    const ifCondition = this.parseExpression();
    this.expect("RIGHT_PARENTHESIS");
    
    const ifBody = this.match("BLOCK_START") ?
      this.parseBlock() :
      this.parseStatement();
    
    const elseIf = [];
    let elseBody = null;
    
    this.skipNewlines();
    
    while (this.matchKeyword("else")) {
      this.expectKeyword("else");
      
      this.skipNewlines();
      
      if (this.matchKeyword("if")) {
        this.expectKeyword("if");
        
        this.expect("LEFT_PARENTHESIS");
        const condition = this.parseExpression();
        this.expect("RIGHT_PARENTHESIS");
        
        const body = this.match("BLOCK_START") ?
          this.parseBlock() :
          this.parseStatement();
        
        elseIf.push({
          condition,
          body
        });
        
      } else {
        // final else
        elseBody = this.match("BLOCK_START") ?
          this.parseBlock() :
          this.parseStatement();
        break;
      }
      
      this.skipNewlines();
    }
    
    return {
      type: "CONDITIONAL",
      if: {
        condition: ifCondition,
        body: ifBody
      },
      elseIf,
      else: elseBody ? { body: elseBody } : null
    };
  }
  
  parseBlock() {
    this.expect("BLOCK_START");
    
    const body = [];
    
    while (!this.match("BLOCK_END") && this.current()) {
      
      if (this.match("NEWLINE")) {
        this.advance();
        continue;
      }
      
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
      
      if (this.match("NEWLINE")) {
        this.advance();
      }
    }
    
    this.expect("BLOCK_END");
    
    return {
      type: ParserTypes.BLOCK,
      body
    };
  }
  
  parseVariableDeclaration() {
    const dataType = this.advance().value;
    
    let isConst = false;
    
    if (this.match("KEYWORD")) {
      const keyVal = this.expect("KEYWORD").value;
      
      if (keyVal === "const") {
        isConst = true;
      }
    }
    
    const name = this.expect("IDENTIFIER").value;
    
    // =========================
    // ARRAY DIMENSIONS
    // =========================
    
    const dimensions = [];
    
    while (this.match("LBRACKET")) {
      
      this.advance();
      
      const dim = this.parseExpression();
      
      if (dim.type !== ParserTypes.INT && dim.type !== ParserTypes.BINARY_EXPRESSION) {
        throw new Error(
          "[Zen Error] TypeError: array dimension must be int or constant expression"
        );
      }
      
      dimensions.push(dim);
      
      this.expect("RBRACKET");
    }
    
    let value = null;
    let inferedType = null;
    
    // =========================
    // EXPLICIT INITIALIZER
    // =========================
    
    if (this.match("ASSIGNMENT")) {
      
      this.advance();
      
      value = this.parseExpression();
      
      if (TYPES.includes(value.type)) {
        inferedType = value.type;
      }
      
    }
    
    // =========================
    // DEFAULT INITIALIZATION
    // =========================
    
    else {
      
      // -------------------------
      // AUTO INVALID
      // -------------------------
      
      if (dataType === "auto") {
        throw new Error(
          "[Zen Error] parser: auto variable requires initializer"
        );
      }
      
      // -------------------------
      // ARRAY DEFAULT INIT
      // -------------------------
      
      if (dimensions.length > 0) {
        
        value = {
          type: ParserTypes.ARRAY,
          elements: []
        };
      }
      
      // -------------------------
      // PRIMITIVE DEFAULT INIT
      // -------------------------
      
      else {
        
        // int
        if (dataType === "int") {
          value = {
            type: ParserTypes.INT,
            value: 0
          };
        }
        
        // double
        else if (dataType === "double") {
          value = {
            type: ParserTypes.DOUBLE,
            value: 0.0
          };
        }
        
        // string
        else if (dataType === "string") {
          value = {
            type: ParserTypes.STRING,
            value: ""
          };
        }
        
        // bool
        else if (dataType === "bool") {
          value = {
            type: ParserTypes.BOOL,
            value: 0
          };
        }
      }
    }
    
    return {
      type: ParserTypes.VARIABLE_DECLARATION,
      dataType,
      inferedType,
      isArray: dimensions.length > 0,
      isConstant: isConst,
      name,
      dimensions,
      value
    };
  }
  
  // =========================
  // EXPRESSIONS
  // =========================
  
  parseExpression() {
    this.skipNewlines();
    this.unaryDepth = 0;
    return this.parseAssignment();
  }
  
  // =========================
  // ASSIGNMENT (=, +=, etc)
  // =========================
  
  parseAssignment() {
    let expr = this.parseTernary();
    
    if (this.match("ASSIGNMENT")) {
      const op = this.advance().value;
      const value = this.parseAssignment();
      
      if (expr.type === ParserTypes.ARRAY_ACCESS) {
        return {
          type: ParserTypes.ARRAY_ACCESS,
          array: expr.array,
          index: expr.index,
          operator: op,
          value
        };
      }
      
      if (expr.type === ParserTypes.VARIABLE) {
        return {
          type: ParserTypes.ASSIGNMENT,
          name: expr.name,
          operator: op,
          value
        };
      }
      
      if (expr.type === ParserTypes.MEMBER_ACCESS) {
        return {
          type: ParserTypes.MEMBER_ASSIGNMENT,
          object: expr.object,
          field: expr.field,
          operator: op,
          value
        };
      }
    }
    
    return expr;
  }
  
  
  parseTernary() {
    this.skipNewlines();
    let condition = this.parseLogical();
    this.skipNewlines()
    if (this.match("QUESTION")) {
      this.advance(); // ?
      this.skipNewlines();
      const trueExpr = this.parseExpression(); // full expression allowed
      this.expect("COLON");
      this.skipNewlines()
      const falseExpr = this.parseExpression();
      this.skipNewlines()
      return {
        type: ParserTypes.TERNARY,
        condition,
        trueExpr,
        falseExpr
      };
    }
    
    return condition;
  }
  
  
  
  parseLogical() {
    this.skipNewlines()
    let expr = this.parseEquality();
    
    while (this.match("LOGICAL")) {
      const op = this.advance().value;
      const right = this.parseEquality();
      
      expr = {
        type: ParserTypes.BINARY_EXPRESSION,
        left: expr,
        operator: op,
        right
      };
    }
    
    return expr;
  }
  
  // =========================
  // COMPARISON
  // =========================
  parseEquality() {
    this.skipNewlines();
    let expr = this.node(this.parseComparison());
    
    while (this.match("EQUALITY")) {
      const op = this.advance().value;
      const right = this.node(this.parseComparison());
      
      expr = {
        type: ParserTypes.BINARY_EXPRESSION,
        left: expr,
        operator: op,
        right
      };
    }
    
    return expr;
  }
  
  parseComparison() {
    this.skipNewlines();
    let expr = this.node(this.parseTerm());
    
    while (this.match("COMPARISON")) {
      const op = this.advance().value;
      const right = this.node(this.parseTerm());
      
      expr = {
        type: ParserTypes.BINARY_EXPRESSION,
        left: expr,
        operator: op,
        right
      };
    }
    
    return expr;
  }
  
  // =========================
  // + -
  // =========================
  parseTerm() {
    this.skipNewlines();
    let expr = this.node(this.parseFactor());
    
    while (this.match("PLUS") || this.match("MINUS")) {
      const op = this.advance().value;
      const right = this.node(this.parseFactor());
      
      expr = {
        type: ParserTypes.BINARY_EXPRESSION,
        left: expr,
        operator: op,
        right
      };
    }
    
    return expr;
  }
  
  // =========================
  // * / %
  // =========================
  parseFactor() {
    this.skipNewlines()
    let expr = this.node(this.parseUnary());
    
    while (
      this.match("STAR") ||
      this.match("SLASH") ||
      this.match("MODULO")
    ) {
      const op = this.advance().value;
      const right = this.node(this.parseUnary());
      
      expr = {
        type: ParserTypes.BINARY_EXPRESSION,
        left: expr,
        operator: op,
        right
      };
    }
    
    return expr;
  }
  
  
  parseUnary() {
    if (
      this.match("MINUS") ||
      this.match("BANG") ||
      this.match("PLUS_PLUS") ||
      this.match("MINUS_MINUS")
    ) {
      const op = this.advance().value;
      const argument = this.node(this.parseUnary());
      
      return {
        type: ParserTypes.UNARY_EXPRESSION,
        operator: op,
        argument,
        isPostfix: false
      };
    }
    
    return this.node(this.parsePostfix());
  }
  
  parsePostfix(isAwait = false) {
    this.skipNewlines()
    let expr = this.node(this.parsePrimary());
    
    while (true) {
      this.skipNewlines()
      if (this.match("DOT")) {
        this.skipNewlines();
        this.advance();
        this.skipNewlines()
        const field = this.expect("IDENTIFIER").value;
        this.skipNewlines();
        expr = {
          type: ParserTypes.MEMBER_ACCESS,
          object: expr,
          field
        };
        
        continue;
      }
      
      // ARRAY ACCESS 
      if (this.match("LBRACKET")) {
        this.advance();
        
        const index = this.node(this.parseExpression());
        
        this.expect("RBRACKET");
        
        expr = {
          type: ParserTypes.ARRAY_ACCESS,
          array: expr,
          index
        };
        
        continue;
      }
      
      
      if (this.match("LEFT_PARENTHESIS")) {
        
        this.advance();
        
        const args = [];
        
        while (true) {
          
          this.skipNewlines();
          
          if (this.match("RIGHT_PARENTHESIS")) {
            this.skipNewlines();
            break;
          }
          
          args.push(
            this.node(this.parseExpression())
          );
          
          this.skipNewlines();
          
          if (this.match("COMMA")) {
            
            this.advance();
            
          } else {
            break;
          }
        }
        
        this.skipNewlines();
        
        this.expect("RIGHT_PARENTHESIS");
        
        expr = {
          type: ParserTypes.CALL,
          callee: expr,
          isAwait,
          args
        };
        
        continue;
      }
      
      
      
      
      // existing postfix ++ --
      if (this.match("PLUS_PLUS") || this.match("MINUS_MINUS")) {
        const op = this.advance().value;
        
        expr = {
          type: ParserTypes.UNARY_EXPRESSION,
          operator: op,
          argument: expr,
          isPostfix: true
        };
        
        continue;
      }
      
      break;
    }
    
    return expr;
  }
  
  parseArrayLiteral() {
    this.expect("LBRACKET");
    
    const elements = [];
    
    this.skipNewlines(); //  important
    
    while (!this.match("RBRACKET")) {
      
      elements.push(this.parseExpression());
      
      this.skipNewlines(); // after element
      
      if (this.match("COMMA")) {
        this.advance();
        this.skipNewlines(); // after comma
      } else {
        break;
      }
    }
    
    this.expect("RBRACKET");
    
    return this.node({
      type: ParserTypes.ARRAY,
      elements
    });
  }
  
  // =========================
  // PRIMARY (VALUES)
  // =========================
  parsePrimary() {
    this.skipNewlines();
    
    const token = this.current();
    
    // NUMBER
    if (token.type === "int") {
      this.advance();
      return {
        type: ParserTypes.INT,
        value: token.value
      };
    }
    
    // DOUBLE
    if (token.type === "double") {
      this.advance();
      return {
        type: ParserTypes.DOUBLE,
        value: token.value
      };
    }
    
    // STRING
    if (token.type === "string") {
      this.advance();
      return {
        type: ParserTypes.STRING,
        value: token.value
      };
    }
    
    // BOOLEAN
    if (token.type === "bool") {
      this.advance();
      return {
        type: ParserTypes.BOOLEAN,
        value: token.value === true ? 1 : 0
      };
    }
    
    if (this.matchKeyword("this")) {
      this.advance();
      
      return {
        type: "THIS",
        value: "this"
      };
    }
    
    // VARIABLE
    if (token.type === "IDENTIFIER") {
      this.advance();
      
      // function call
      if (this.match("LEFT_PARENTHESIS")) {
        return this.parseCall(token.value, false);
      }
      
      return {
        type: ParserTypes.VARIABLE,
        name: token.value
      };
    }
    
    if (this.match("BLOCK_START")) {
      return this.parseMapLiteral();
    }
    
    if (
      token.type === "KEYWORD" &&
      token.value === "await"
    ) {
      
      this.advance();
      
      const expr = this.parsePostfix();
      
      if (expr.type === ParserTypes.CALL) {
        expr.isAwait = true;
        return expr;
      }
      
      throw new Error("Expected async call after await");
    }
    
    if (this.match("LBRACKET") && this.tokens[this.pos - 1].type !== "IDENTIFIER") {
      return this.parseArrayLiteral();
    }
    
    // GROUPING ( )
    if (this.match("LEFT_PARENTHESIS")) {
      this.advance();
      this.skipNewlines()
      const expr = this.parseExpression();
      this.skipNewlines()
      this.expect("RIGHT_PARENTHESIS");
      return expr;
    }
    
    throw new Error("Unexpected token: " + JSON.stringify(token));
  }
  
  // =========================
  // FUNCTION CALL
  // =========================
  parseCall(name, isAwait = false) {
    
    this.expect("LEFT_PARENTHESIS");
    this.skipNewlines()
    const args = [];
    
    while (!this.match("RIGHT_PARENTHESIS")) {
      this.skipNewlines()
      args.push(this.parseExpression());
      this.skipNewlines();
      if (this.match("COMMA")) {
        
        this.advance();
        this.skipNewlines();
      } else {
        break;
      }
    }
    
    this.skipNewlines();
    this.expect("RIGHT_PARENTHESIS");
    
    return {
      isInbuilt: BUILTIN_FUNCTIONS.includes(name),
      type: ParserTypes.CALL,
      name,
      isAwait,
      args
    };
  }
  
}