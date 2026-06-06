import { TYPES, TokenTypes, KEYWORDS, BUILTIN_FUNCTIONS, OPERATORS, ASSIGNMENT_OPS, ARITHMETIC_OPS, UNARY_OPS, COMPARISON_OPS, LOGICAL_OPS } from '/src/config/config.js';

const SORTED_OPERATORS = [...OPERATORS]
  .sort((a, b) => b.length - a.length);

export class Lexer {
  constructor(source, IRB) {
    this.source = source;
    this.pos = 0;
    this.currentChar = this.source[this.pos] || null;
    this.tokens = [];
    this.line = 1;
    this.column = 1;
    this.IRB = IRB;
  }
  
  lineAndColumn() {
    return {
      line: this.line,
      column: this.column
    }
  }
  
  addToken(type, value) {
    this.tokens.push({
      type,
      value,
      line: this.line,
      column: this.column
    });
  }
  
  addTokenAt(type, value, line, column) {
    this.tokens.push({
      type,
      value,
      line,
      column
    });
  }
  
  tokenize() {
    while (this.currentChar !== null) {
      
      // newline
      
      if (this.currentChar === '\n') {
        this.addToken(
          TokenTypes.NEWLINE,
          "\n"
        );
        this.advance();
        continue;
      }
      
      if (
        this.currentChar === ' ' ||
        this.currentChar === '\t' ||
        this.currentChar === '\r'
      ) {
        this.advance();
        continue;
      }
      
      // comments
      
      if (
        this.currentChar === "/" &&
        this.peek() === "/"
      ) {
        this.skipComment();
        continue;
      }
      
      if (
        this.currentChar === "#"
      ) {
        this.skipComment();
        continue;
      }
      
      if (
        this.currentChar === "/" &&
        this.peek() === "*"
      ) {
        this.skipMultiLineComment();
        continue;
      }
      
      // IDENTIFIER
      
      if (/[a-zA-Z_]/.test(this.currentChar)) {
        
        const line = this.line;
        const column = this.column;
        
        const word = this.identifier();
        
        if (word === "true" || word === "false") {
          
          this.addTokenAt(
            TokenTypes.BOOLEAN,
            word === "true",
            line,
            column
          );
          
        } else if (TYPES.includes(word)) {
          
          this.addTokenAt(
            TokenTypes.TYPE,
            word,
            line,
            column
          );
          
        } else if (KEYWORDS.includes(word)) {
          
          this.addTokenAt(
            TokenTypes.KEYWORD,
            word,
            line,
            column
          );
          
        } else if (word === "reactive") {
          
          this.addTokenAt(
            TokenTypes.REACTIVE,
            word,
            line,
            column
          );
          
        } else {
          
          this.addTokenAt(
            TokenTypes.IDENTIFIER,
            word,
            line,
            column
          );
        }
        
        continue;
      }
      
      // synmbols
      
      if (this.currentChar === ":") {
        this.addToken(
          TokenTypes.COLON,
          ":"
        );
        this.advance();
        continue;
      }
      
      if (this.source.startsWith("...", this.pos)) {
        
        this.addToken(
          TokenTypes.ELLIPSIS,
          "..."
        );
        
        this.pos += 3;
        this.column += 3;
        this.currentChar =
          this.source[this.pos] || null;
        
        continue;
      }
      
      if (this.currentChar === ".") {
        this.addToken(
          TokenTypes.DOT,
          "."
        );
        this.advance();
        continue;
      }
      
      if (this.currentChar === "[") {
        this.addToken(
          TokenTypes.LBRACKET,
          "["
        );
        this.advance();
        continue;
      }
      
      if (this.currentChar === "]") {
        this.addToken(
          TokenTypes.RBRACKET,
          "]"
        );
        this.advance();
        continue;
      }
      
      // NUMBER
      
      if (/\d/.test(this.currentChar)) {
        
        const line = this.line;
        const column = this.column;
        
        const num = this.number();
        
        this.addTokenAt(
          num.isFloat ?
          TokenTypes.DOUBLE :
          TokenTypes.INT,
          num.value,
          line,
          column
        );
        
        continue;
      }
      
      // STRING
      
      if (
        this.currentChar === '"' ||
        this.currentChar === "'"
      ) {
        
        const line = this.line;
        const column = this.column;
        
        const value = this.string();
        
        this.addTokenAt(
          TokenTypes.STRING,
          value,
          line,
          column
        );
        
        continue;
      }
      
      if (this.currentChar === "`") {
        
        const parts = this.templateString();
        
        this.addTokenAt(
          TokenTypes.TEMPLATE_STRING,
          parts,
        );
        
        continue;
      }
      
      // ?
      
      if (this.currentChar === '?') {
        this.addToken(
          TokenTypes.QUESTION,
          "?"
        );
        this.advance();
        continue;
      }
      
      if (this.currentChar === '$') {
        this.addToken(
          TokenTypes.DOLLAR,
          "$"
        );
        this.advance();
        continue;
      }
      
      // OPERATORS
      
      let matched = false;
      
      for (const op of SORTED_OPERATORS) {
        
        if (this.source.startsWith(op, this.pos)) {
          
          let type;
          
          if (ASSIGNMENT_OPS.includes(op)) {
            type = "ASSIGNMENT";
          }
          
          else if (ARITHMETIC_OPS.includes(op)) {
            
            if (op === "+") type = "PLUS";
            else if (op === "-") type = "MINUS";
            else if (op === "*") type = "STAR";
            else if (op === "/") type = "SLASH";
            else if (op === "%") type = "MODULO";
          }
          
          else if (COMPARISON_OPS.includes(op)) {
            type = "COMPARISON";
          }
          
          else if (LOGICAL_OPS.includes(op)) {
            type = "LOGICAL";
          }
          
          else if (UNARY_OPS.includes(op)) {
            
            type =
              op === "!" ?
              "BANG" :
              op === "++" ?
              "PLUS_PLUS" :
              "MINUS_MINUS";
          }
          
          this.addToken(type, op);
          
          this.pos += op.length;
          this.column += op.length;
          this.currentChar =
            this.source[this.pos] || null;
          
          matched = true;
          break;
        }
      }
      
      if (matched) continue;
      
      // (
      
      if (this.currentChar === "(") {
        this.addToken(
          TokenTypes.LEFT_PARENTHESIS,
          "("
        );
        this.advance();
        continue;
      }
      
      // )
      
      if (this.currentChar === ")") {
        this.addToken(
          TokenTypes.RIGHT_PARENTHESIS,
          ")"
        );
        this.advance();
        continue;
      }
      
      // {
      
      if (this.currentChar === "{") {
        this.addToken(
          TokenTypes.BLOCK_START,
          "{"
        );
        this.advance();
        continue;
      }
      
      // }
      
      if (this.currentChar === "}") {
        this.addToken(
          TokenTypes.BLOCK_END,
          "}"
        );
        this.advance();
        continue;
      }
      
      // ,
      
      if (this.currentChar === ",") {
        this.addToken(
          TokenTypes.COMMA,
          ","
        );
        this.advance();
        continue;
      }
      
      this.IRB.emitError("SyntaxError",
        `Unexpected character: '${this.currentChar}' at line ${this.line}, column ${this.column}`, this.lineAndColumn());
    }
    
    // EOF
    this.addToken(
      TokenTypes.EOF,
      null
    );
    
    return this.tokens;
  }
  
  advance() {
    if (this.currentChar === '\n') {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }
    this.pos++;
    this.currentChar = this.source[this.pos] || null;
  }
  
  
  peek() {
    return this.source[this.pos + 1] || null;
  }
  
  skipComment() {
    while (this.currentChar !== null && this.currentChar !== '\n') {
      this.advance();
    }
    this.advance();
  }
  
  skipMultiLineComment() {
    this.advance();
    this.advance();
    while (this.currentChar !== null) {
      if (this.currentChar === '*' && this.peek() === '/') {
        this.advance();
        this.advance();
        return;
      }
      this.advance();
    }
    
    this.IRB.emitError("SyntaxError", "Unterminated multi-line comment", this.lineAndColumn());
  }
  
  identifier() {
    let result = '';
    while (this.currentChar !== null && /[a-zA-Z_0-9]/.test(this.currentChar)) {
      result += this.currentChar;
      this.advance();
    }
    return result;
  }
  
  number() {
    let result = '';
    let hasDot = false;
    
    while (
      this.currentChar !== null &&
      (/\d/.test(this.currentChar) || this.currentChar === '.')
    ) {
      if (this.currentChar === '.') {
        if (hasDot) break;
        hasDot = true;
        result += '.';
        this.advance();
        continue;
      }
      
      result += this.currentChar;
      this.advance();
    }
    
    if (result.startsWith('.')) {
      result = '0' + result;
      hasDot = true;
    }
    
    return {
      value: hasDot ? parseFloat(result) : parseInt(result, 10),
      isFloat: hasDot
    };
  }
  
  string() {
    let result = '';
    const quoteType = this.currentChar;
    this.advance();
    
    while (this.currentChar !== null && this.currentChar !== quoteType) {
      if (this.currentChar === '\\') {
        this.advance();
        if (this.currentChar === 'n') result += '\n';
        else if (this.currentChar === 't') result += '\t';
        else if (this.currentChar === '\\') result += '\\';
        else if (this.currentChar === 'r') result += '\r';
        else if (this.currentChar === '"') result += '"';
        else if (this.currentChar === "'") result += "'";
        else result += this.currentChar;
      } else {
        result += this.currentChar;
      }
      this.advance();
    }
    
    if (this.currentChar === quoteType) {
      this.advance();
    } else {
      this.IRB.emitError("SyntaxError", "Unterminated string literal", this.lineAndColumn());
    }
    
    return result;
  }
  
  templateString() {
    
    const parts = [];
    let text = "";
    
    this.advance(); // skip `
    
    while (this.currentChar !== null) {
      
      // end template
      
      if (this.currentChar === "`") {
        
        if (text.length > 0) {
          parts.push(text);
        }
        
        this.advance();
        
        return parts;
      }
      
      // ${ ... }
      
      if (
        this.currentChar === "$" &&
        this.peek() === "{"
      ) {
        
        if (text.length > 0) {
          parts.push(text);
          text = "";
        }
        
        this.advance(); // $
        this.advance(); // {
        
        let expr = "";
        let depth = 1;
        
        while (this.currentChar !== null && depth > 0) {
          
          if (this.currentChar === "{") {
            depth++;
          }
          
          else if (this.currentChar === "}") {
            depth--;
            
            if (depth === 0) {
              break;
            }
          }
          
          expr += this.currentChar;
          this.advance();
        }
        
        if (depth !== 0) {
          this.IRB.emitError(
            "SyntaxError",
            "Unterminated template expression",
            this.lineAndColumn()
          );
        }
        
        parts.push({
          type: "EXPR",
          value: expr.trim()
        });
        
        this.advance(); // skip closing }
        
        continue;
      }
      
      // escapes
      
      if (this.currentChar === "\\") {
        
        this.advance();
        
        if (this.currentChar === "n") {
          text += "\n";
        }
        
        else if (this.currentChar === "t") {
          text += "\t";
        }
        
        else if (this.currentChar === "r") {
          text += "\r";
        }
        
        else if (this.currentChar === "\\") {
          text += "\\";
        }
        
        else if (this.currentChar === "`") {
          text += "`";
        }
        
        else {
          text += this.currentChar;
        }
        
        this.advance();
        continue;
      }
      
      text += this.currentChar;
      this.advance();
    }
    
    this.IRB.emitError(
      "SyntaxError",
      "Unterminated template string",
      this.lineAndColumn()
    );
  }
  
}