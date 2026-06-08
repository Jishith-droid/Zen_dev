## Error Reference
modified

Zen reports errors in a consistent structured format. Compile-time errors include the source location. Runtime errors include only the error message — location information is not available at runtime.

Compile-time format:

[Zen  <ErrorType>]
  ├── <message>
  └── at: <file>:<line>:<col>

Runtime format:

[Zen  <ErrorType>]
  └── <message>


---


## Compile-Time Errors

Compile-time errors are caught before execution. The program will not run until all compile-time errors are resolved.


---


### SyntaxError

Raised when source text does not conform to Zen's grammar.

[Zen  SyntaxError]
  ├── Unexpected token '}' — expected expression
  └── at: main.zen:20:1

[Zen  SyntaxError]
  ├── Unterminated string literal — expected closing '"'
  └── at: main.zen:8:5

[Zen  SyntaxError]
  ├── Expected '(' after 'fn' in function declaration
  └── at: main.zen:15:4

Common triggers:
- Mismatched or missing brackets, braces, or parentheses
- Unterminated string literals
- Malformed function, loop, or conditional declarations

---

### InternalError

Raised when the compiler encounters an unexpected internal state that should never occur during normal compilation.

[Zen  InternalError]
  ├── Missing function table entry for 'foo'
  └── at: main.zen:5:1

[Zen  InternalError]
  ├── Missing symbol table entry for 'x'
  └── at: main.zen:3:1

Common triggers:
- A function or variable passed through codegen without a corresponding table entry
- Compiler pipeline reached an unexpected or inconsistent state

---


### TypeError

Raised when a value is used in a context that does not match its declared or expected type.

[Zen  TypeError]
  ├── Cannot assign 'string' to variable of type 'int'
  └── at: main.zen:5:10

[Zen  TypeError]
  ├── Argument 1 of 'process' expects 'int', got 'bool'
  └── at: main.zen:12:14

[Zen  TypeError]
  ├── Condition must be of type 'bool', got 'int'
  └── at: main.zen:9:7

[Zen  TypeError]
  ├── Ternary branches must return the same type — got 'int' and 'string'
  └── at: main.zen:17:5

[Zen  TypeError]
  ├── 'switch' condition must be of type 'int', got 'float'
  └── at: main.zen:22:10

Common triggers:
- Assigning a value of the wrong type to a typed variable
- Passing an argument of the wrong type to a function
- Using a non-bool expression as a condition in if, while, or do-while
- Using a non-int expression as a switch condition
- Ternary branches resolving to different types


---


### ArgumentError

Raised when a function is called with the wrong number of arguments.

[Zen  ArgumentError]
  ├── 'screen' accepts 1 to 2 argument(s), got 0
  └── at: main.zen:8:3

[Zen  ArgumentError]
  ├── 'multiply' accepts exactly 2 argument(s), got 5
  └── at: main.zen:31:5

Common triggers:
- Calling a function with fewer arguments than required parameters
- Calling a function with more arguments than it declares
- Omitting a required argument when default parameters are partially defined


---


### DeclarationError

Raised when a variable or function is declared incorrectly or violates a declaration rule.

[Zen  DeclarationError]
  ├── 'fn' is a reserved keyword and cannot be used as an identifier
  └── at: main.zen:3:5

[Zen  DeclarationError]
  ├── Nested function declarations are not allowed in Zen
  └── at: main.zen:10:3

[Zen  DeclarationError]
  ├── Variable 'x' must have an explicit type or use 'auto'
  └── at: main.zen:6:1

[Zen  DeclarationError]
  ├── 'List<auto>' is not a valid type — element type must be explicit
  └── at: main.zen:4:8

[Zen  DeclarationError]
  ├── Cannot manually assign to reactive variable 'total'
  └── at: main.zen:18:3

Common triggers:
- Using a reserved keyword as an identifier
- Declaring a function inside another function
- Declaring a variable with no type annotation and no auto keyword
- Using List<auto> as a type
- Manually reassigning a reactive variable


---


### ConstError

Raised when a const variable is reassigned after declaration.

[Zen  ConstError]
  ├── Cannot reassign constant 'MAX' — declared as 'const' on line 2
  └── at: main.zen:14:3

Common triggers:
- Assigning a new value to a const variable anywhere after its declaration
- Using a const variable as a loop counter or accumulator


---


### SemanticError

Raised when code is syntactically valid but violates a language rule that cannot be caught by grammar alone.

[Zen  SemanticError]
  ├── 'return' used outside of a function body
  └── at: main.zen:3:1

[Zen  SemanticError]
  ├── 'break' used outside of a loop or switch block
  └── at: main.zen:25:5

[Zen  SemanticError]
  ├── 'continue' used outside of a loop block
  └── at: main.zen:19:5

[Zen  SemanticError]
  ├── Function 'add' does not return a value on all code paths
  └── at: main.zen:7:1

[Zen  SemanticError]
  ├── Undefined variable 'count' — used before declaration
  └── at: main.zen:11:9

[Zen  SemanticError]
  ├── Undefined function 'compute' — no declaration found in scope
  └── at: main.zen:44:3

Common triggers:
- Using return, break, or continue outside their valid contexts
- Referencing a variable or function that has not been declared
- A non-void function that does not return a value on all execution paths
- Using a variable before it has been assigned a value


---


### ArrayError

Raised when a fixed-size array declaration is invalid.

[Zen  ArrayError]
  ├── Array size must be a positive integer greater than 0
  └── at: main.zen:7:3

[Zen  ArrayError]
  ├── Partial initializer not allowed — array of size 4 requires exactly 4 elements
  └── at: main.zen:9:5

[Zen  ArrayError]
  ├── Negative index -1 is not allowed — array indices must be non-negative integers
  └── at: main.zen:12:6

Common triggers:
- Declaring an array with size 0 or a negative size
- Providing an initializer list that does not exactly match the declared array size
- Using a negative literal as an array index


---


### ExportError

Raised when an export rule is violated.

[Zen  ExportError]
  ├── Cannot export 'b' — only compile-time constant values can be exported
  └── at: utils.zen:6:1

[Zen  ExportError]
  ├── A file may only contain one 'export' statement
  └── at: utils.zen:12:1

[Zen  ExportError]
  ├── A file cannot use both 'import' and 'export'
  └── at: utils.zen:1:1

Common triggers:
- Exporting a variable whose value is a runtime expression
- Declaring more than one export statement in a file
- Using both import and export in the same file


---


### ImportError

Raised when an import cannot be resolved or violates an import rule.

[Zen  ImportError]
  ├── 'multiply' is not exported by 'utils.zen'
  └── at: main.zen:1:1

[Zen  ImportError]
  ├── Cannot resolve module 'helpers.zen' — file not found
  └── at: main.zen:1:1

[Zen  ImportError]
  ├── 'import' must appear before all other declarations
  └── at: main.zen:10:1

Common triggers:
- Importing a name that does not exist in the target file's export list
- Importing a file that does not exist on disk
- Placing an import statement after other declarations in the file


---


## Runtime Errors

Runtime errors are raised during program execution and cannot always be anticipated at compile time. They terminate the program immediately.


---


### IndexError

Raised when a List or fixed-size array is accessed with an index that is out of bounds at runtime.

[Zen  IndexError]
  └── Index 5 is out of bounds for List of length 3 — valid range is 0 to 2

[Zen  IndexError]
  └── Index 12 is out of bounds for array of length 5 — valid range is 0 to 4

Common triggers:
- Accessing a list or array element at an index greater than or equal to its length
- Off-by-one errors when iterating near the end of a collection


---


### MemoryError

Raised when a heap object is accessed after it has been freed.

[Zen  MemoryError]
  └── Use after free — 'nums' has been freed and is no longer accessible

[Zen  MemoryError]
  └── Use after free — inner list at index 2 of 'matrix' has been freed

Common triggers:
- Accessing a List or Map after calling .free() on it
- Accessing a freed inner list within a nested List<List<T>>
- Retaining a reference to a freed object across function calls


---


### LoopError

Raised when a loop in iterates over a Map whose value types cannot be resolved uniformly at runtime.

[Zen  LoopError]
  └── Cannot iterate — Map 'data' contains heterogeneous value types

[Zen  LoopError]
  └── Cannot iterate — Map 'config' contains nested values incompatible with 'loop in'

Common triggers:
- Using loop in on a Map that holds values of mixed types
- Using loop in on a Map with nested or complex value structures


---


### PanicError

Raised explicitly by the program via sys.panic(). Signals an unrecoverable state defined by the developer.

[Zen  PanicError]
  └── negative value not allowed

[Zen  PanicError]
  └── unreachable code path reached in 'resolve'

Common triggers:
- Explicit sys.panic("message") call to abort on an invalid program state
- Defensive assertions that should never be reached in correct programs

Raised when a variable, function, struct, field, or map key 
is referenced but has not been defined.