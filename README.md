# ZEN Programming Language

**Version 1.0.0** · Stable · May 2026

---

## Introduction

ZEN is a statically compiled, LLVM-based programming language built around one principle: **every construct must have a deterministic representation in the compiler.** If it cannot be precisely defined, it does not exist in the language.

ZEN is an open-source programming language, and its development is open to everyone. Whether you are a compiler enthusiast, a language designer, or simply curious about how programming languages work at a fundamental level, you are welcome to explore, contribute, and build with ZEN. The source code, compiler implementation, and this specification are all publicly available. Contributions in any form — bug reports, suggestions, tooling, or improvements to the language itself — are valued and encouraged. ZEN is built in the open, and its future is shaped by everyone who chooses to be part of it.

The result is a language with a minimal syntactic surface, no implicit coercions, no hidden runtime transformations, and no undocumented behavior — a system where the programmer and the compiler always agree on what code means.

---

## Origin

ZEN was designed and implemented by **Jishith MP** as an independent programming language project.

The language grew out of a practical need: a compiler-oriented system that behaves predictably from source to binary. Early work focused on LLVM IR generation and formal lexical rules; over time this evolved into a complete language definition — with a structured grammar, a well-specified type system, and a compilation pipeline designed for clarity over cleverness.

The name *ZEN* reflects the design philosophy directly. Not as metaphor, but as method: simplicity achieved through deliberate reduction, not accident.

---

## Philosophy

> *If it cannot be precisely defined, it does not exist in the language.*

This constraint drives every decision in ZEN's design:

- **No ambiguous behavior.** Every expression evaluates to exactly one outcome, defined at compile time.
- **No implicit coercion.** Type conversions are always explicit and visible in source.
- **No hidden transformations.** The compiler does not silently rewrite code. What you write is what executes.
- **No syntactic sugar beyond specification.** Convenience constructs are not added unless they can be fully and formally defined.

The language is designed from the compiler's perspective first. Ease of implementation and correctness of semantics take precedence over surface-level ergonomics. This makes ZEN well-suited for systems-level work, compiler tooling, and any domain where predictability matters more than brevity.

---

## Design Goals

| Goal | Description |
|---|---|
| **Minimal syntax surface** | The language avoids redundant keywords and constructs with overlapping semantics. |
| **Deterministic semantics** | Compile-time and runtime behavior are fully specified; no undefined behavior. |
| **Compiler-first design** | Language constructs are designed for implementation clarity and unambiguous parsing. |
| **LLVM intermediate target** | ZEN compiles to LLVM IR as its primary intermediate representation. |
| **Structural programming model** | Explicit logic construction with no hidden control flow. |

---

## Reactive Variables

Zen introduces a first-class language feature called **reactive variables** — variables that automatically recompute their value whenever a referenced variable changes.

### Syntax

```zen
reactive <type> <identifier> = <expression>
```

```zen
int b = 20
reactive int a = b + 10   # a is 30

b = 50                     # a automatically becomes 60
```

---

### How It Works

A `reactive` variable holds a **live binding** to its defining expression. Rather than capturing the value at the time of declaration, it captures the expression itself. Any time a variable referenced in that expression is reassigned, the reactive variable recomputes.

```zen
int x = 5
int y = 10
reactive int sum = x + y   # sum is 15

x = 20                      # sum is now 30
y = 2                       # sum is now 22
```

---

### Rules and Constraints

**Only variable reassignment triggers recomputation.**
A reactive variable updates only when a referenced variable is reassigned via `=`. Mutations that do not go through reassignment do not trigger an update.

**`const` variables do not trigger updates.**
Since `const` variables cannot be reassigned, a reactive expression that references only `const` values behaves as a regular variable — it is computed once at declaration and never again.

```zen
const int base = 100
reactive int val = base + 50   # val is 150 — never updates, base is const
```

**Reactive variables work on variable references only.**
The expression must reference named variables. Expressions that reference only literals are legal but pointless — they will never recompute.

```zen
reactive int x = 5 + 3   # always 8 — no variable to trigger recomputation
```

**A reactive variable cannot be manually reassigned.**
Once declared as `reactive`, its value is exclusively owned by its expression. Direct reassignment is a compile-time error.

```zen
reactive int a = b + 10

a = 99   # compile-time error: cannot manually assign to a reactive variable
```

**Reactive variables can reference other reactive variables.**
A chain of reactive dependencies is fully supported. Updates propagate through the chain in declaration order.

```zen
int base = 10
reactive int doubled = base * 2     # 20
reactive int final   = doubled + 5  # 25

base = 20   # doubled → 40, final → 45
```

---

### Summary

| Property | Behavior |
|---|---|
| Trigger | Reassignment of a referenced variable |
| `const` references | No trigger — computed once |
| Manual reassignment | Compile-time error |
| Chained reactives | Supported — propagates in order |
| Expression type | Variable references only |


## Scope of This Specification

Version 1.0.0 defines the **stable core** of the language:

- Lexical structure and token definitions
- Grammar and core syntax rules
- Primitive and composite data types
- Variable and map declarations
- Function definitions
- Control flow constructs
- Compilation and evaluation model

Future versions will address type system extensions, optimization semantics, and concurrency primitives.


## Lexical Structure

The ZEN compiler reduces source text into a flat sequence of tokens before any parsing occurs. Each token carries two fields: a **type** and a **value**. All subsequent grammar rules operate on this token stream, never on raw source characters.

---

### 2.1 Source Encoding

ZEN source files are plain text. The language does not mandate a specific file encoding beyond ASCII compatibility for all reserved symbols and keywords. Identifiers and string contents may contain extended characters at the implementation's discretion.

---

### 2.2 Whitespace

Whitespace — spaces, tabs, and newlines — carries no syntactic meaning in ZEN and is fully discarded during tokenization. It serves only to separate adjacent tokens where ambiguity would otherwise arise.

```zen
int x = 10       # same token stream as:
int x=10
```

---

### 2.3 Comments

Comments are stripped during tokenization and produce no tokens. ZEN supports three comment forms:

| Form | Syntax | Scope |
|---|---|---|
| Hash line comment | `# comment` | From `#` to end of line |
| Slash line comment | `// comment` | From `//` to end of line |
| Block comment | `/* comment */` | Across any number of lines |

Both single-line forms are equivalent. Neither is preferred or deprecated — their coexistence is intentional, allowing users to adopt whichever convention suits their style.

Block comments do not nest. The first `*/` encountered closes the comment regardless of any `/*` inside it.

```zen
# this is a comment
// this is also a comment

/*
  this spans
  multiple lines
*/
```

---

### 2.4 Keywords

The following identifiers are reserved by the language and may not be used as user-defined names:

| Category | Keywords |
|---|---|
| **Types** | `int` `double` `string` `bool` `List` `Map` |
| **Control Flow** | `if` `else if` `else` `loop` `while` `do` `switch` `case` |
| **Loop Control flow** | `break` `continue` |
| **export and import** | `export` `import` |
| **Functions** | `fn` `return` |
| **inference** | `auto` |
| **struct** | `struct` |
| **Iteration** | `in` `of` |
| **CONSTANT** | `const` |
| **Concurrency** | `async` `await` |
| **Object** | `this` |

Keywords are case-sensitive. `fn` is reserved; `Fn` and `FN` are valid identifiers.

ZEN reserves async and await as keywords in v1.0.0, and the parser recognizes their syntax, but code generation for asynchronous concurrency is not yet implemented. Full async/await support, including the concurrency model and runtime semantics, is planned for v2.

---

### 2.5 Identifiers

An identifier is a user-defined name for a variable, function, or other declared entity.

**Rules:**

- Must begin with a letter (`a–z`, `A–Z`) or an underscore (`_`)
- May contain letters, digits (`0–9`), and underscores in any position after the first character
- May end with a digit
- Are case-sensitive — `count`, `Count`, and `COUNT` are three distinct identifiers
- Must not match any reserved keyword

**Valid identifiers:**

```zen
x
myVariable
_internal
value1
snake_case_name
counter2
```

**Invalid identifiers:**

```zen
1value       # begins with a digit
fn           # reserved keyword
my-var       # hyphens are not allowed
```

---

### 2.6 Literals

A literal is a fixed value written directly in source. ZEN defines four literal types.

#### 2.6.1 Integer Literals

A sequence of decimal digits with no prefix, suffix, or separator.

```zen
0
42
1000
```

Hexadecimal, binary, and octal representations are not supported in v1.0.0.

#### 2.6.2 Double Literals

A decimal integer part, a dot, and a decimal fractional part. Both parts are required.

```zen
3.14
0.5
100.0
```

Scientific notation is not supported in v1.0.0. A bare integer such as `42` is not a valid `double` literal; `42.0` must be written explicitly.

#### 2.6.3 String Literals

A sequence of characters enclosed in matching double or single quotes. Both forms are equivalent.

```zen
"hello, world"
'hello, world'
```

---

**Backtick Strings**

Zen also supports backtick-delimited strings — `` ` `` — which offer two additional capabilities over quoted strings.

**Multiline strings**

Backtick strings preserve newlines and indentation exactly as written in source. No escape sequences are needed.

```zen
string msg = `hello
hi
how are you`
```

**Template literals**

Backtick strings support inline expression interpolation using `${}`. Any valid Zen expression can appear inside the braces.

```zen
string name = "Zen"
string msg  = `Hello, ${name}!`           # "Hello, Zen!"

int a = 10
int b = 20
string result = `Sum of ${a} and ${b} is ${a + b}`   # "Sum of 10 and 20 is 30"
```

Multiline and interpolation can be combined freely.

```zen
string user = "Achu"
string out  = `Welcome, ${user}.
Your session has started.`
```

---

| Form | Multiline | Interpolation |
|---|---|---|
| `"..."` | No | No |
| `'...'` | No | No |
| `` `...` `` | Yes | Yes |

#### 2.6.4 Boolean Literals

Exactly two values, lowercase:

```zen
true
false
```

Any other casing (`True`, `TRUE`) is not a boolean literal and will be interpreted as an identifier.

---

### 2.7 Operators

Operators are fixed-character sequences that form their own token type. ZEN defines five operator categories.

#### Assignment Operators

| Operator | Meaning |
|---|---|
| `=` | Assign |
| `+=` | Add and assign |
| `-=` | Subtract and assign |
| `*=` | Multiply and assign |
| `/=` | Divide and assign |
| `%=` | Modulo and assign |

#### Arithmetic Operators

| Operator | Meaning |
|---|---|
| `+` | Addition |
| `-` | Subtraction |
| `*` | Multiplication |
| `/` | Division |
| `%` | Modulo |

#### Unary Operators

| Operator | Meaning |
|---|---|
| `++` | Increment |
| `--` | Decrement |
| `!` | Logical NOT |

#### Comparison Operators

| Operator | Meaning |
|---|---|
| `==` | Equal |
| `!=` | Not equal |
| `>=` | Greater than or equal |
| `<=` | Less than or equal |
| `>` | Greater than |
| `<` | Less than |

#### Logical Operators

| Operator | Meaning |
|---|---|
| `&&` | Logical AND |
| `\|\|` | Logical OR |

---

### 2.8 Token Summary

Every unit of source text falls into one of the following token types:

| Token Type | Examples |
|---|---|
| `KEYWORD` | `fn`, `if`, `const`, `return` |
| `IDENTIFIER` | `x`, `myVar`, `_count` |
| `int` | `0`, `42`, `1000` |
| `double` | `3.14`, `0.5`, `100.0` |
| `string` | `"hello"`, `'world'` |
| `bool` | `true`, `false` |
| `OPERATOR` | `+`, `==`, `&&`, `++` |


## 3. Types

ZEN is a statically typed language. Every value has a type known at compile time. This section defines the four primitive types that form the foundation of the type system.

Data structure types — `List`, `Map`, `struct`, and fixed-size arrays — are defined separately in Section 4.

---

### 3.1 Primitive Types

ZEN defines exactly four primitive types:

| Type | Description | Example Literals |
|---|---|---|
| `int` | Integer number | `0`, `42`, `1000` |
| `double` | Floating-point number | `3.14`, `0.5`, `100.0` |
| `bool` | Boolean value | `true`, `false` |
| `string` | Text value | `"hello"`, `'world'` |

These are reserved keywords and cannot be used as identifiers.

---

#### 3.1.1 `int`

Represents a whole number. Only decimal notation is supported; negative values are expressed using the unary `-` operator. `+` unary is invalid in Zen.

```zen
int x = 42
int y = 0
int z = -10

int p = +10 # invalid
int q = 10 # valid
```

---

#### 3.1.2 `double`

Represents a floating-point number. Both the integer part and the fractional part must be written explicitly — a bare integer is not a valid `double` literal.

```zen
double pi = 3.14
double zero = 0.0
double rate = 100.0
```

---

#### 3.1.3 `bool`

Represents a boolean value. Only two values exist: `true` and `false`. Both are lowercase; any other casing is treated as an identifier, not a boolean.

```zen
bool active = true
bool done = false
```

---

#### 3.1.4 `string`

Represents a sequence of characters. String literals may be enclosed in either double or single quotes; both forms produce identical values.

```zen
string name = "ZEN"
string greeting = 'hello'
```

---

### 3.2 Type Behavior in Expressions

ZEN does not perform implicit type casting in general. Types must match at assignment and in most expression contexts. Two specific exceptions exist: numeric promotion and string coercion.

---

#### 3.2.1 Numeric Promotion

When one operand in an arithmetic expression is `double` and the other is `int`, the `int` value is automatically promoted to `double` for the duration of that expression. The result is `double`.

```zen
double result = 3.14 + 2     # 2 is promoted to 2.0 → result is 5.14
double x = 10 * 0.5          # 10 is promoted to 10.0 → result is 5.0
```

Promotion is expression-scoped. The original `int` variable or literal is not affected.

```zen
int a = 5
double b = 2.0
double c = a + b             # a is promoted within this expression only
                             # a remains int outside of it
```

---

#### 3.2.2 String Coercion

When one operand of `+` is a `string`, the other operand is implicitly coerced to its string representation. The result is always `string`. This is the only form of cross-type coercion ZEN permits.

```zen
string s = "count: " + 10        # → "count: 10"
string t = "value: " + 3.14      # → "value: 3.14"
string u = "active: " + true     # → "active: true"
```

Coercion is one-directional: a non-string operand is converted to `string`, never the reverse.

```zen
int x = 5 + "3"                  # error: int context, no coercion applies
```

## 4. Grammar & Syntax

This section defines the syntactic rules of ZEN. Grammar rules are written in a simplified EBNF-style notation where:

- `=` defines a rule
- `|` means "or"
- `?` means optional (zero or one)
- `*` means zero or more
- `+` means one or more
- `"text"` is a literal token
- `UPPER_CASE` is a terminal token from the lexer
- `lower_case` is a non-terminal rule defined in this section

---

### 4.1 Program Structure

A ZEN program is a sequence of top-level declarations. Code may exist at the global level as variable declarations or function definitions.

```
program
  = top_level_decl*

top_level_decl
  = var_decl
  | const_decl
  | function_decl
  | struct_decl
```

---

### 4.2 Blocks

A block is a sequence of statements enclosed in braces. Blocks define scope boundaries.

```
block
  = "{" statement* "}"
```

---

### 4.3 Statements

```
statement
  = var_decl
  | const_decl
  | assignment
  | function_call ";"?
  | return_stmt
  | if_stmt
  | switch_stmt
  | loop_stmt
  | while_stmt
  | do_while_stmt
  | loop_in_stmt
  | loop_of_stmt
  | block
```

---

### 4.4 Variable Declarations

#### Full Declaration

```
var_decl
  = type IDENTIFIER "=" expression
  | "auto" IDENTIFIER "=" expression
```

```zen
int a = 10
double pi = 3.14
string name = "ZEN"
bool active = true
auto x = 42
```

#### Declaration Without Initializer

A variable may be declared without an explicit value. The compiler lowers it to the type's default value.

```
var_decl_default
  = type IDENTIFIER
```

| Type | Default Value |
|---|---|
| `int` | `0` |
| `double` | `0.0` |
| `string` | `""` |
| `bool` | `false` |
| `List<T>` | `[]` |
| `Map` | `{}` |

```zen
int a          # lowered to: int a = 0
double rate    # lowered to: double rate = 0.0
string label   # lowered to: string label = ""
bool flag      # lowered to: bool flag = false
```

#### Constant Declaration

Constants are declared with the `const` modifier after the type. They cannot be reassigned after declaration.

```
const_decl
  = type "const" IDENTIFIER "=" expression
```

```zen
int const MAX = 100
string const VERSION = "1.0.0"
```

---

### 4.5 Assignment & Reassignment

Variables may be reassigned using the `=` operator or any compound assignment operator. Constants may not be reassigned.

```
assignment
  = IDENTIFIER assign_op expression
  | index_access assign_op expression
  | field_access assign_op expression

assign_op
  = "=" | "+=" | "-=" | "*=" | "/=" | "%="
```

```zen
a = 10
a += 5
a -= 2
a *= 3
a /= 4
a %= 2
```

---

### 4.6 Expressions

```
expression
  = literal
  | IDENTIFIER
  | function_call
  | index_access
  | field_access
  | unary_expr
  | binary_expr
  | ternary_expr
  | "(" expression ")"

literal
  = INT_LITERAL
  | DOUBLE_LITERAL
  | STRING_LITERAL
  | BOOL_LITERAL
  | list_literal
  | Map and fixed array literals not exists
```

#### Binary Expressions

```
binary_expr
  = expression binary_op expression

binary_op
  = "+" | "-" | "*" | "/" | "%"
  | "==" | "!=" | ">=" | "<=" | ">" | "<"
  | "&&" | "||"
```

Standard operator precedence applies. Parentheses may be used to override precedence explicitly.

```zen
int a = 10 + 2 * 76        # multiplication first
int b = (10 + 2) * 76      # addition first
bool c = a > 10 && b < 500
```

#### Unary Expressions

```
unary_expr
  = ("+" | "-" | "!") expression
  | IDENTIFIER "++"
  | IDENTIFIER "--"
```

```zen
!active
-10
a++
b--
```

#### Ternary Expression

```
ternary_expr
  = expression "?" expression ":" expression
```

The condition must evaluate to `bool`. Both branches **must return the same type** — a type mismatch between the true and false branches is a compile-time error.

```zen
int max     = a > b ? a : b
string label = active ? "on" : "off"
int val     = a > 0 ? (a > 10 ? 2 : 1) : 0
```

Nesting is allowed. Each nested ternary must also satisfy the same-type constraint at every level.

---

**Type Mismatch — Compile-time Error**

```zen
# Error: branches return different types (int vs string)
auto x = a > b ? 42 : "hello"

# Error: branches return different types (bool vs int)
auto y = flag ? true : 0
```

Both the true branch and the false branch must resolve to the **same static type**. Zen performs this check at compile time — no implicit coercion is applied.


#### Access Expressions

```
index_access
  = IDENTIFIER "[" expression "]"

field_access
  = IDENTIFIER "." IDENTIFIER
  | IDENTIFIER "[" expression "]"     # runtime key access for Map
```

```zen
arr[0]
matrix[1][2]
person.name
map["key"]
map[runtimeKey]
```

---

### 4.7 Function Declarations

```
function_decl
  = "fn" IDENTIFIER "(" param_list? ")" return_type? block

param_list
  = param ("," param)*

param
  = type IDENTIFIER
  | type IDENTIFIER "..."              # rest parameter

return_type
  = type
  | "auto"
  | (empty)                           # implicitly void
```

- Function identifiers follow the standard identifier rules, except that they must not start with _ (underscore), as names beginning with _ are reserved for ZEN internal use.
- Parameters are typed explicitly.
- If no return type is specified, the function is implicitly `void`.
- `auto` may be used as the return type; the compiler infers it from the `return` statement.
- A rest parameter (`type identifier...`) collects remaining arguments into a `List`. It must be the last parameter.
- Function declarations may not be nested inside another function.

```zen
fn greet(string name) {
  # void — no return type specified
}

fn add(int a, int b) int {
  return a + b
}

fn sum(int values...) List<int> {
  # for rest parameter explicit return like List<T> is required. no auto for List return.
  # values is List<int> under the hood
  return values
}

fn multiply(int a, int b) int {
  return a * b
}
```

#### Return Statement

```
return_stmt
  = "return" expression?
```

`return` is valid only inside a function block. A bare `return` with no expression is valid in `void` functions.

```zen
return
return 42
return a + b
```

#### Function Call

```
function_call
  = IDENTIFIER "(" argument_list? ")"

argument_list
  = argument ("," argument)*

argument
  = expression
```

```zen
greet("ZEN")
add(10, 20)
add(5 + 5, a)
multiply(a, b)
```

---

### 4.8 Scopes

ZEN defines three scope levels. Each inner scope has access to identifiers declared in any enclosing outer scope.

| Scope | Where | Lifetime |
|---|---|---|
| **Global** | Top level of the program, outside any block | Entire program execution |
| **Function** | Inside a function block | Duration of the function call |
| **Block** | Inside any `{}` block (if, loop, nested block) | Duration of that block |

An identifier declared in an inner scope shadows any identifier with the same name in an outer scope for the duration of that inner scope.

---

### 4.9 Control Flow

#### If Statement

```
if_stmt
  = "if" "(" expression ")" block
    ("else if" "(" expression ")" block)*
    ("else" block)?
```

```zen
if (a > 10) {
  # ...
} else if (a == 10) {
  # ...
} else {
  # ...
}
```

#### Switch Statement

```
switch_stmt
  = "switch" "(" expression ")" "{" case_clause* default_clause? "}"

case_clause
  = "case" int_expr ":" block

default_clause
  = "default" ":" block

int_expr
  = INT_LITERAL
  | int_literal_expr          # compile-time integer expression e.g. 10 + 10
```

- The switch expression must evaluate to `int`.
- Case values must be integer literals or compile-time integer expressions. Variable references are not permitted in case values.
- There is no fallthrough. Each case is implicitly terminated. No `break` is needed or allowed.
- `default` is optional and matches any value not covered by a case.

```zen
switch (status) {
  case 1: {
    # ...
  }
  case 10 + 10: {
    # matches 20
  }
  default: {
    # ...
  }
}
```

---

### 4.10 Loop Constructs

ZEN provides five loop forms.

#### General Loop

The general loop takes either two or three arguments separated by `,`. When three arguments are provided, the first is the initializer. When two are provided, no initializer is used — the variable must be declared before the loop.

```
loop_stmt
  = "loop" "(" var_decl "," expression "," update_expr ")" block
  | "loop" "(" expression "," update_expr ")" block

update_expr
  = assignment
  | unary_expr
```

```zen
loop (int i = 0, i < 10, i++) {
  # i declared in loop init
}

int i = 0
loop (i < 10, i++) {
  # i declared outside
}
```

#### While Loop

```
while_stmt
  = "while" "(" expression ")" block
```

```zen
while (active) {
  # ...
}
```

#### Do-While Loop

```
do_while_stmt
  = "do" block "while" "(" expression ")"
```

```zen
do {
  # executes at least once
} while (count < 10)
```

#### Loop In — Map Iteration

Iterates over key-value pairs in a `Map`.

```
loop_in_stmt
  = "loop" "(" IDENTIFIER "in" IDENTIFIER ")" block
```

```zen
loop (value in myMap) {
  # value holds the current map value one by one
}
```

#### Loop Of — Array and List Iteration

Iterates over elements of a `List`, fixed-size array, or rest parameter (which is a `List` under the hood).

```
loop_of_stmt
  = "loop" "(" IDENTIFIER "of" IDENTIFIER ")" block
```

```zen
loop (item of myList) {
  # item holds the current element
}

loop (val of arr) {
  # works for fixed-size arrays
}
```

Nested iteration:

```zen
loop (row of matrix) {
  loop (cell of row) {
    # nested loop of
  }
}
```

---

### 4.11 Data Structure Declarations

Full behavior and semantics are defined in Section 5. Grammar rules are provided here for reference.

#### List

```
list_decl
  = "List" "<" type ">" IDENTIFIER "=" list_literal
  | "List" "<" type ">" IDENTIFIER              # lowered to = []

list_literal
  = "[" (expression ("," expression)*)? "]"
```

```zen
List<int> nums = [1, 2, 3]
List<List<int>> matrix = [[1, 2], [3, 4]]
List<int> empty                              # lowered to: List<int> empty = []
```

#### Map

```
map_decl
  = "Map" IDENTIFIER "=" map_literal
  | Map IDENTIFIER # lowered to = {}

map_literal
  = "{" (IDENTIFIER ":" expression ("," IDENTIFIER ":" expression)*)? "}"
```

```zen
Map person = {
  name: "Jishith",
  age: 21
}
Map address # lowered to Map address = {}
```

#### Fixed-Size Array

```
array_decl
  = type IDENTIFIER dimension+ "=" array_literal

dimension
  = "[" INT_LITERAL "]"

array_literal
  = "[" (array_literal | expression) ("," (array_literal | expression))* "]"
```

```zen
int arr[3] = [1, 2, 3]
int matrix[2][2] = [[1, 2], [3, 4]]
```

#### Struct Declaration

```
struct_decl
  = "struct" IDENTIFIER "{" field_decl* method_decl* "}"

field_decl
  = IDENTIFIER type ","?

method_decl
  = IDENTIFIER "(" param_list? ")" return_type? block
```

```zen
struct Person {
  name string,
  age int,
  scores List<int>,

  greet() void {
    # this is implicitly available
  }

  getName() string {
    return this.name
  }
}
```

#### Struct Instantiation and Access

```
struct_instance
  = IDENTIFIER IDENTIFIER       # TypeName aliasName

method_call
  = IDENTIFIER "." IDENTIFIER "(" argument_list? ")"
```

```zen
Person p
p.name = "Jishith"
p.age = 21
p.greet()
string n = p.getName()
```
## 5. Data Structures

ZEN provides four built-in data structure types: `Map`, `List`, fixed-size arrays, and `struct`. Each has distinct memory characteristics, mutability rules, and supported operations.

| Type | Schema | Size | Memory | Heterogeneous |
|---|---|---|---|---|
| `Map` | Dynamic | Runtime | Heap | Yes |
| `List<T>` | Typed | Runtime | Heap | No |
| `array` | Fixed | Compile-time | Stack | No |
| `struct` | Fixed | Compile-time | Stack | No |

---

### 5.1 Map

A `Map` is a dynamic, heterogeneous key-value store. Its schema is not fixed at compile time — fields may be added at runtime. It is a heap-allocated object and must be explicitly freed when no longer needed.

#### Declaration

```
map_decl
  = "Map" IDENTIFIER "=" map_literal
  | "Map" IDENTIFIER                   # lowered to Map IDENTIFIER = {}
```

A `Map` declared without an initializer is lowered to an empty map.

```zen
Map a                                  # lowered to: Map a = {}
Map a = {}                             # explicit empty map
```

#### Allowed Value Types

Map values may be of the following types:

- `int`, `double`, `string`, `bool`
- `List<T>`
- Nested `Map`

Struct instances may not be stored as Map values in v1.0.0.

#### Literals and Nesting

Map literals use identifier keys with colon-separated values. Maps may be nested to any depth.

```zen
Map a = {
  name: "jishith",
  age: 21,
  score: 98.5,
  active: true
}

Map b = {
  name: "jishith",
  nested: {
    hobbies: [20, 20, 10, 39],
    salary: 20000.5
  }
}
```

> **Note:** Map literals are only valid at the point of declaration. Map is not a first-class value in v1.0.0 — map literals cannot be passed as arguments, returned from functions, or assigned to variables after initial declaration. This restriction may be lifted in a future version.

#### Field Access

Fields are accessed using dot notation. Nested fields are chained.

```zen
a.name                                 # "jishith"
b.nested.hobbies[0]                    # 20
b.nested.salary                        # 20000.5
```

Runtime key access using a variable is also supported:

```zen
string key = "name"
a[key]                                 # equivalent to a.name
```

#### Field Assignment

Assigning to an existing field updates its value. Assigning to a field that does not exist creates it dynamically at runtime.

```zen
a.name = "arun"                        # update existing field
a.country = "India"                    # creates new field at runtime
```

#### Built-in Methods

| Method | Description |
|---|---|
| `free()` | Releases the Map from heap memory |

```zen
a.free()
```

After calling `free()`, the Map must not be accessed or reassigned. Any use after `free()` will result in a runtime error.

```zen
a.free()
a.name = "x"                           # runtime error: use after free
```

---

### 5.2 List

A `List` is a dynamically sized, heap-allocated array. Unlike `Map`, a `List` is homogeneous — all elements must be of the same declared type. Nesting is supported through `List<List<T>>`.

#### Declaration

```
list_decl
  = "List" "<" type ">" IDENTIFIER "=" list_literal
  | "List" "<" type ">" IDENTIFIER              # lowered to = []
```

A `List` declared without an initializer is lowered to an empty list.

```zen
List<int> nums                         # lowered to: List<int> nums = []
List<int> nums = [1, 2, 3]
List<string> names = ["zen", "lang"]
List<List<int>> matrix = [[1, 2], [3, 4]]
```

#### Allowed Element Types

List elements may be of the following types:

- `int`, `double`, `string`, `bool`
- Nested `List<T>`

`Map` is not a valid element type in v1.0.0, as Map has no literal form for use in expressions.

`auto` is not valid as a type parameter — `List<auto>` is a compile-time error.

#### Access

Elements are accessed by zero-based integer index.

```zen
nums[0]                                # first element
matrix[0][1]                           # nested access
```

#### Assignment

Individual elements may be reassigned by index.

```zen
nums[0] = 99
matrix[1][0] = 10
```

#### Built-in Methods

| Method | Signature | Description |
|---|---|---|
| `push` | `push(value)` | Appends a value to the end of the list |
| `pop` | `pop()` | Removes and returns the last element |
| `contains` | `contains(value)` | Returns `bool` — checks if value exists |
| `removeAt` | `removeAt(index)` | Removes element at the given index |
| `clear` | `clear()` | Removes all elements; list remains alive |
| `free` | `free()` | Releases the list from heap memory |

```zen
nums.push(30)
nums.push([10, 20])                    # valid for nested List<List<int>>
int last = nums.pop()
bool found = nums.contains(30)
bool nested = matrix.contains([1, 2]) # checks for exact sublist match
nums.removeAt(0)
nums.clear()                           # list is now [] but still usable
nums.free()                            # list is released
```

`push` accepts a value matching the declared element type. For a `List<List<int>>`, pushing a `List<int>` literal is valid.

`contains` on a nested list checks for an exact sublist match — the argument must be a list literal or reference matching the inner type.

#### Free and Nested Lists

After calling `free()`, the list must not be accessed. Any use after `free()` results in a runtime error.

```zen
nums.free()
nums.push(1)                           # runtime error: use after free
```

For nested lists, freeing an inner list directly is technically permitted but not recommended. ZEN cannot fully track inner list lifetimes after a partial free, and accessing a freed inner list will throw a runtime error.

> **Recommendation:** Do not call `free()` on individual inner lists of a nested `List<List<T>>`. Free the outer list instead.

---

### 5.3 Fixed-Size Arrays

A fixed-size array has a length determined at compile time and cannot be resized. It is stack-allocated. Dimensions are specified in the declaration and are part of the array's type.

#### Declaration

```
array_decl
  = type IDENTIFIER dimension+ "=" array_literal

dimension
  = "[" INT_LITERAL "]"
```

The dimension must be a positive integer literal. A size of `0` is not permitted.

```zen
int arr[3] = [1, 2, 3]
int matrix[2][2] = [[1, 2], [3, 4]]
```

#### Zero Initialization

An array may be declared with an empty literal. All elements are zero-initialized according to their type.

```zen
int arr[3] = []                        # [0, 0, 0]
int matrix[2][2] = [[], []]            # [[0,0],[0,0]]
```

#### Full Initialization Required

If a non-empty literal is provided, it must exactly match the declared dimensions. Partial initialization is a compile-time error.

```zen
int arr[3] = [1, 2]                    # error: expected 3 elements, got 2
int arr[3] = [1, 2, 3]                 # valid
```

#### Access and Assignment

Elements are accessed and assigned by zero-based index.

```zen
arr[0]                                 # read
arr[0] = 99                            # write
matrix[1][1] = 5
```

#### Constraints

- Fixed-size arrays cannot be passed as function parameters in v1.0.0.
- Fixed-size arrays have no built-in methods.
- Resizing is not possible after declaration.

---

### 5.4 Struct

A `struct` defines a named, fixed-schema composite type. Its fields and methods are determined at compile time and cannot be changed at runtime. Struct instances are stack-allocated.

#### Declaration

```
struct_decl
  = "struct" IDENTIFIER "{" field_decl* method_decl* "}"

field_decl
  = IDENTIFIER type ","?

method_decl
  = IDENTIFIER "(" param_list? ")" return_type? block
```

By convention, struct names begin with an uppercase letter.

```zen
struct Person {
  name string,
  age int,
  scores List<int>,

  greet() void {
    # this is implicitly available inside all methods
  }

  getName() string {
    return this.name
  }
}
```

#### Allowed Field Types

Struct fields may be of the following types:

- `int`, `double`, `string`, `bool`
- `List<T>`
- Another `struct` type

`Map` is not a valid field type in v1.0.0.

#### Instantiation

A struct is instantiated by declaring a variable with the struct name as its type. No constructor syntax is used.

```zen
Person p
```

Fields are then assigned individually using dot notation.

```zen
p.name = "Jishith"
p.age = 21
```

#### Field Access

```zen
p.name                                 # "Jishith"
p.age                                  # 21
p.scores[0]                            # first element of the List field
```

#### Nested Structs

A struct field may hold another struct instance.

```zen
struct Address {
  city string,
  zip int
}

struct Person {
  name string,
  address Address
}

Person p
p.name = "Jishith"
p.address.city = "Bangalore"
p.address.zip = 560001
```

#### Methods

Methods are declared inside the struct body without the `fn` keyword. The current instance is implicitly available as `this` inside every method.

```zen
struct Counter {
  value int,

  increment() void {
    this.value += 1
  }

  get() int {
    return this.value
  }
}
```

Methods may have any return type, including `List<T>`, `auto`, or primitives. Struct instances cannot be passed as function parameters in v1.0.0, and methods cannot be called on a struct type directly — only on an instance.

```zen
Counter c
c.value = 0
c.increment()
int v = c.get()                        # v = 1
```

#### Constraints

- Struct instances cannot be passed as function parameters in v1.0.0.
- `Map` is not a valid field type in v1.0.0.
- Methods are user-defined only; no built-in struct methods exist.
- Struct declarations may not be nested inside functions.

## 6. Functions

A function is a named, reusable block of code that accepts parameters and optionally returns a value. Functions are the primary unit of logic encapsulation in ZEN.

---

### 6.1 Declaration

Functions are declared using the `fn` keyword. The full syntax is:

```
fn IDENTIFIER ( param_list? ) return_type? block
```

```zen
fn greet(string name) {
  # void — no return type declared
}

fn add(int a, int b) int {
  return a + b
}

fn describe(string label, int value) string {
  return label + ": " + value
}
```

- If no return type is specified, the function is implicitly `void`.
- `auto` may be used as the return type; the compiler infers it from the `return` statement.
- Function declarations may not be nested inside another function.
- Functions are fully hoisted — they may be called anywhere in the program regardless of where they are declared.

---

## 6.2 Parameters

Parameters are declared as **type-identifier pairs**, separated by commas. Zen is strictly typed — every parameter must carry an explicit type annotation.

### Primitive Parameters

```zen
fn multiply(int a, int b) int {
  return a * b
}
```

Supported primitive parameter types include `int`, `float`, `bool`, and `string`.

---

### List Parameters

List parameters use the generic syntax `List<T>` and support any level of nesting.

```zen
fn sum(List<int> nums) int { ... }

fn process(List<string> names) void { ... }

fn matrix(List<List<float>> grid) void { ... }

fn deep(List<List<List<int>>> cube) void { ... }
```

---

### Map Parameters

Map parameters are declared using the `Map` type. Note that Map parameters **do not support default values**.

```zen
fn display(Map info) void { ... }

fn merge(Map source, Map target) void { ... }
```

---

### Default Parameters

Zen supports default values for **primitive** and **List** parameters. If a caller omits an argument, the default value is used.

**Primitive defaults:**

```zen
fn greet(string name = "World") void {
  print("Hello, " + name)
}

fn power(int base, int exp = 2) int {
  return base ^ exp
}
```

**List defaults:**

```zen
fn process(List<int> nums = [10, 20]) void {
  ...
}

fn configure(List<string> flags = ["verbose", "safe"]) void {
  ...
}
```

**Map parameters do not support defaults.** A `Map` argument must always be explicitly passed by the caller.

```zen
// Valid
fn display(Map info) void { ... }

// Invalid — not supported in Zen
fn display(Map info = {}) void { ... }
```

#### Rest Parameters

A rest parameter collects all remaining arguments into a `List`. It must be the last parameter in the list and is declared with `...` after the identifier.

```zen
fn sum(int values...) int {
  int total = 0
  loop (item of values) {
    total += item
  }
  return total
}
```

Under the hood, `values` is a `List<int>`. When returning a rest parameter, the return type must be declared explicitly as the corresponding `List<T>` type. `auto` is not valid as a return type for List — the generic type parameter must be fully preserved.

```zen
fn collect(int values...) List<int> {
  return values                        # explicit List<int> return type required
}
```

```zen
fn collect(int values...) auto {       # compile-time error: auto invalid for List return
  return values
}
```

---

### 6.3 Return Statement

The `return` keyword exits the current function and optionally passes a value back to the caller.

```zen
return          # valid in void functions
return 42
return a + b
return "done"
```

- `return` is only valid inside a function block.
- A `void` function may use a bare `return` to exit early.
- The returned expression must match the declared return type.

---

**Exhaustive Return Required**

For non-`void` functions, Zen requires a **guaranteed return path**. Every possible execution path through the function must end in a `return` statement. This is enforced at compile time.

A `return` that only exists inside a conditional or loop does **not** satisfy this requirement — the compiler cannot guarantee it will be reached.

```zen
# Error: return is conditional — not all paths return a value
fn add(int a, int b) int {
  if a > 20 {
    return 20
  }
  # missing return — compile-time error
}

# Error: return is inside a loop — not guaranteed to execute
fn find(List<int> nums) int {
  loop (int n in nums) {
    return n
  }
  # missing return — compile-time error
}
```

```zen
# Valid: all paths return a value
fn add(int a, int b) int {
  if a > 20 {
    return 20
  }
  return a + b
}

# Valid: unconditional return at end
fn clamp(int val) int {
  if val < 0  { return 0   }
  if val > 100 { return 100 }
  return val
}
```

`void` functions are exempt — they may return early with a bare `return` or simply fall off the end of the block.

---

### 6.4 Function Calls

A function is called by its name followed by a parenthesised argument list.

```zen
greet("ZEN")
add(10, 20)
add(5 + 5, a)
int result = multiply(a, b)
string s = describe("score", 99)
```

Arguments may be literals, variables, or any valid expression.

---

### 6.5 Recursion

Functions may call themselves recursively. ZEN places no language-level restriction on recursion depth; stack overflow is a runtime concern.

```zen
fn factorial(int n) int {
  if (n <= 1) {
    return 1
  }
  return n * factorial(n - 1)
}
```

---

### 6.6 Hoisting

All function declarations are hoisted to the top of their scope at compile time. A function may be called before its declaration appears in the source file.

```zen
int result = add(3, 4)                 # valid — add is declared below

fn add(int a, int b) int {
  return a + b
}
```

---

## 7. Conditionals

ZEN provides two conditional constructs: `if` and `switch`. Both control which block of code executes based on a condition.

---

### 7.1 If Statement

```
if_stmt
  = "if" "(" expression ")" block
    ("else if" "(" expression ")" block)*
    ("else" block)?
```

The condition must evaluate to `bool`. `else if` and `else` clauses are optional. Only the first matching branch executes.

```zen
if (score >= 90) {
  grade = "A"
} else if (score >= 75) {
  grade = "B"
} else if (score >= 60) {
  grade = "C"
} else {
  grade = "F"
}
```

`if` may be used without `else`:

```zen
if (active) {
  start()
}
```

---

### 7.2 Switch Statement

```
switch_stmt
  = "switch" "(" expression ")" "{" case_clause* default_clause? "}"

case_clause
  = "case" int_expr ":" block

default_clause
  = "default" ":" block
```

- The switch expression must evaluate to `int`.
- Case values must be integer literals or compile-time integer expressions. Variable references are not permitted in case values.
- There is no fallthrough. Each case block is implicitly terminated — no `break` is needed or permitted between cases.
- `default` is optional and executes when no case matches.

```zen
switch (status) {
  case 1: {
    # handle active
  }
  case 2: {
    # handle inactive
  }
  case 10 + 10: {
    # matches 20 — compile-time expression
  }
  default: {
    # handle unknown
  }
}
```

`break` and `continue` inside a case block refer to an enclosing loop, not the switch itself. Since switch has no fallthrough, there is no need for a switch-level `break`.

---

## 8. Ternary Expression

The ternary operator provides a compact conditional expression.

```
ternary_expr
  = expression "?" expression ":" expression
```

The condition must evaluate to `bool`. The two branches may be any expression.

```zen
int max = a > b ? a : b
string label = active ? "on" : "off"
double rate = flag ? 1.5 : 0.5
```

#### Nesting

Ternary expressions may be nested. Parentheses are recommended for clarity.

```zen
int tier = score >= 90 ? 3 : (score >= 60 ? 2 : 1)
```

#### As a Statement

A ternary may be used as a standalone statement. When used this way, the returned value is discarded.

```zen
active ? start() : stop()
```

This is valid but the return value of `start()` or `stop()` is not captured. If the value is needed, assign it:

```zen
int result = active ? start() : stop()
```

---

## 9. Loop Constructs

ZEN provides five loop forms. All loops support `break` and `continue`.

- `break` exits the innermost enclosing loop immediately.
- `continue` skips the remainder of the current iteration and proceeds to the next.

In nested loops, `break` and `continue` apply only to the loop they are directly inside.

```zen
loop (int i = 0, i < 3, i++) {
  loop (int j = 0, j < 3, j++) {
    if (j == 1) { break }              # breaks inner loop only
  }
  # outer loop continues normally
}
```

---

### 9.1 General Loop

The general loop is ZEN's primary counted iteration construct. It uses the `loop` keyword with comma-separated clauses.

```
loop_stmt
  = "loop" "(" var_decl "," expression "," update_expr ")" block
  | "loop" "(" expression "," update_expr ")" block
```

**Three-clause form** — includes an initializer:

```zen
loop (int i = 0, i < 10, i++) {
  # i is scoped to this loop
}
```

**Two-clause form** — the loop variable is declared outside:

```zen
int i = 0
loop (i < 10, i++) {
  # i is from the outer scope
}
```

The initializer in the three-clause form is scoped to the loop block. The two-clause form is used when the variable needs to persist after the loop or was declared in an outer scope.

```zen
loop (int i = 0, i < 5, i++) {
  if (i == 3) { break }
}

int j = 0
loop (j < 5, j++) {
  if (j == 3) { continue }
  # j is accessible after the loop
}
```

---

### 9.2 While Loop

Executes a block repeatedly as long as the condition is `bool` true.

```
while_stmt
  = "while" "(" expression ")" block
```

```zen
while (active) {
  process()
}

int count = 0
while (count < 10) {
  count += 1
  if (count == 7) { break }
}
```

---

### 9.3 Do-While Loop

Executes the block at least once, then repeats as long as the condition is true.

```
do_while_stmt
  = "do" block "while" "(" expression ")"
```

```zen
do {
  fetch()
  count += 1
} while (count < 5)
```

The condition is evaluated after each iteration. `break` exits immediately; `continue` jumps to the condition check.

---

### 9.4 Loop In — Map Iteration

Iterates over the keys of a `Map`. On each iteration, the loop variable holds the current key as a `string`.

```
loop_in_stmt
  = "loop" "(" IDENTIFIER "in" IDENTIFIER ")" block
```

For `loop in` to be valid, two conditions must be met:

- All values in the Map must be of the same type.
- The Map must not contain nested fields — nested Maps or Lists as values are not permitted in a `loop in` target.

If either condition is violated, the compiler raises an error. Full heterogeneous and nested Map iteration is deferred to v2.

```zen
Map config = {
  host: "localhost",
  port: "8080"
}

loop (key in config) {
  string val = config[key]             # all values are string, no nesting — valid
}
```

```zen
Map mixed = {
  name: "zen",
  age: 21
}

loop (key in mixed) {                  # compile-time error: heterogeneous values
}
```

```zen
Map nested = {
  info: {
    city: "Bangalore"
  }
}

loop (key in nested) {                 # compile-time error: nested fields not allowed
}
```

`break` and `continue` work normally inside `loop in`.

---

### 9.5 Loop Of — List and Array Iteration

Iterates over the elements of a `List`, fixed-size array, or rest parameter. On each iteration, the loop variable holds the current element.

```
loop_of_stmt
  = "loop" "(" IDENTIFIER "of" IDENTIFIER ")" block
```

```zen
List<int> nums = [10, 20, 30]

loop (item of nums) {
  # item is int
}

int arr[3] = [1, 2, 3]

loop (val of arr) {
  # val is int
}
```

#### Nested Iteration

For nested lists, `loop of` may be nested to iterate over inner elements.

```zen
List<List<int>> matrix = [[1, 2], [3, 4]]

loop (row of matrix) {
  loop (cell of row) {
    # cell is int
  }
}
```

`break` exits the innermost `loop of`. The outer loop continues normally.

```zen
loop (row of matrix) {
  loop (cell of row) {
    if (cell == 2) { break }           # exits inner loop only
  }
}
```

## 10. Modules — Export and Import

ZEN supports a simple module system through `export` and `import`. A file may expose a defined set of globals and functions to other files, and consume exports from other files by name.

---

### 10.1 Export

The `export` keyword makes selected identifiers available to other files. It uses a call-like syntax:

```
export_stmt
  = "export" "(" identifier_list ")"

identifier_list
  = IDENTIFIER ("," IDENTIFIER)*
```

#### Rules

- A file may contain exactly one `export` statement. Multiple `export` calls in the same file are a compile-time error.
- `export` must appear at the bottom of the file, after all declarations. For variables this is required; for functions it is strongly recommended.
- Only global variables and functions may be exported. Local variables, block-scoped variables, and struct declarations may not be exported.

#### Exportable Values

Only **static global values** may be exported — values whose representation is fully determined at compile time without requiring a stack frame.

| Exportable | Example |
|---|---|
| Integer literal | `int a = 10` |
| Double literal | `double pi = 3.14` |
| String literal | `string name = "ZEN"` |
| Bool literal | `bool flag = true` |
| Constant | `int const MAX = 100` |
| Global function | `fn add(int a, int b) int { ... }` |
| Static global array | `int arr[3] = [1, 2, 3]` |

#### Non-Exportable Values

Values that require a stack frame or runtime evaluation cannot be exported. Attempting to export them is a compile-time error.

| Not Exportable | Reason |
|---|---|
| `int a = 10 + 10` | Expression — requires stack frame evaluation |
| `int a = b + 1` | Variable reference — runtime dependent |
| `auto a = 42` | Inferred type — not statically resolved for export |
| Local variables | Not global scope |
| Struct declarations | Not supported in v1.0.0 |

```zen
int a = 10             # valid — static literal
int b = a + 5          # invalid — expression, cannot be exported

fn add(int x, int y) int {
  return x + y
}

int const MAX = 100    # valid — constant literal

export(a, add, MAX)    # b would cause a compile-time error here
```

#### Exported Files and Import Restriction

A file that exports identifiers must not itself contain any `import` statement. Circular or dependent module chains are not permitted in v1.0.0. This is a compile-time error.

```zen
import(utils) from "utils.zen"   # compile-time error: exported file cannot import
export(a, add)
```

---

### 10.2 Import

The `import` keyword brings exported identifiers from another file into the current file's global scope.

```
import_stmt
  = "import" "(" identifier_list ")" "from" STRING_LITERAL
```

#### Rules

- All `import` statements must appear at the top of the file, before any declarations or statements.
- Imported names must exactly match the names declared in the `export` statement of the target file.
- The path must point to a `.zen` file. Paths may be relative to the current file or absolute depending on the environment.
- Imported identifiers are used directly by name — no namespace prefix is required.

```zen
import(a, add, MAX) from "utils.zen"

int result = add(10, 20)
int total = a + MAX
```

#### Name Mismatch

If an imported name does not exist in the target file's export list, the compiler raises an error.

```zen
import(add, multiply) from "utils.zen"   # compile-time error if multiply is not exported
```

#### Multiple Imports

A file may import from multiple source files using separate `import` statements, all placed at the top.

```zen
import(add, subtract) from "math.zen"
import(greet) from "utils.zen"

int x = add(1, 2)
greet("ZEN")
```

---

### 10.3 Module Rules Summary

| Rule | Detail |
|---|---|
| One `export` per file | Multiple export statements are a compile-time error |
| Export at bottom | Required for variables; recommended for functions |
| Static values only | Expressions and runtime-dependent values cannot be exported |
| No import in exported file | An exporting file must not import anything |
| Import at top | All imports must precede any other statements |
| Direct name access | Imported identifiers are used directly, no namespace prefix |
| Exact name match | Imported names must match the export list exactly |
| `.zen` extension required | Import paths must reference `.zen` files |


## 11. Standard Library

ZEN's standard library is divided into four parts:

- **Global Constants** — pre-defined immutable values available everywhere
- **Core Functions** — general-purpose built-ins compiled directly into the compiler
- **Namespaced Modules** — system-level built-ins accessed via `namespace.function()` syntax
- **Standard Functions** — utility functions written in ZEN itself (bootstrapped stdlib)

All standard library identifiers are reserved and cannot be redeclared by user code.

---

### 11.1 Global Constants

Global constants are pre-defined values available in every ZEN program without any import. They are used directly by name.

```zen
screen(PI)
double area = PI * r * r
```

#### Mathematical Constants

| Name | Type | Value | Description |
|---|---|---|---|
| `PI` | `double` | `3.14159265358979...` | Ratio of circumference to diameter |
| `TAU` | `double` | `6.28318530717958...` | `2 * PI` |
| `E` | `double` | `2.71828182845904...` | Euler's number |
| `PHI` | `double` | `1.61803398874989...` | Golden ratio |
| `SQRT2` | `double` | `1.41421356237309...` | Square root of 2 |
| `LN2` | `double` | `0.69314718055994...` | Natural log of 2 |
| `LN10` | `double` | `2.30258509299404...` | Natural log of 10 |

#### Numeric Bounds

| Name | Type | Description |
|---|---|---|
| `I32_MAX` | `int` | Maximum value of a 32-bit integer |
| `I32_MIN` | `int` | Minimum value of a 32-bit integer |
| `F64_MAX` | `double` | Maximum finite 64-bit float |
| `F64_MIN` | `double` | Minimum positive 64-bit float |
| `F64_EPS` | `double` | Smallest difference between two doubles |

#### Special Float Values

| Name | Type | Description |
|---|---|---|
| `INF` | `double` | Positive infinity |
| `NEG_INF` | `double` | Negative infinity |
| `NAN` | `double` | Not a number |

#### Mutable Global

| Name | Type | Mutable | Description |
|---|---|---|---|
| `SEED` | `int` | Yes | Seed value for random number generation |

`SEED` is the only mutable global constant. Assigning to it affects subsequent `random()` and `randomInt()` calls.

```zen
SEED = 42
double r = random()
```

---

### 11.2 Core Functions

Core functions are built directly into the compiler and available globally without any namespace prefix.

---

#### `screen`

Prints a value to standard output.

```
screen(value, format?)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `value` | any | Yes | The value to print |
| `format` | `string` | No | C-style format string |

Returns `void`.

```zen
screen("hello")
screen(42)
screen(3.14)
screen(true)
screen(42, "%d items")
screen(3.14, "%.2f")
```

---

#### `input`

Reads a line from standard input and returns it as a `string`. The caller is responsible for casting to the required type using Zen's built-in casting functions.

```
input(prompt?) → string
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `prompt` | `string` | No | Text to display before reading input |

---

**Basic Usage**

```zen
string name = input("Enter name: ")
string raw  = input()
```

`input()` always returns a `string` — even if the user types a number.

```zen
string age = input("Enter age: ")   # user types 23 → age is "23"
```

---

**Type Casting**

To work with the input as a specific type, use Zen's built-in casting functions:

```zen
int age      = Int(input("Enter age: "))
float price  = Double(input("Enter price: "))
bool confirm = Bool(input("Enter true/false: "))
```

---

**Flexible Usage**

Unlike many languages, `input()` in Zen is a first-class expression. It can be used anywhere a `string` value is valid — inline in expressions, as a function argument, or as a standalone statement.

```zen
# Standalone
input()

# Inline expression
screen("Hello, " + input("Name: "))

# As function argument
process(input("Enter value: "))

# In condition (after cast)
if Int(input("Enter number: ")) > 100 {
  screen("Large number")
}
```

---

#### `type`

Returns the type name of a value as a `string`.

```
type(value)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `value` | any | Yes | The value to inspect |

Returns `string`.

```zen
string t = type(42)          # "int"
string t = type(3.14)        # "double"
string t = type("hello")     # "string"
string t = type(true)        # "bool"
```

---

#### `length`

Returns the number of elements in a `List`, fixed-size array, or the number of characters in a `string`.

```
length(value)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `value` | `string`, `List<T>`, or array | Yes | The value to measure |

Returns `int`.

```zen
int len = length("hello")           # 5
int len = length([1, 2, 3])         # 3
List<int> nums = [10, 20, 30]
int len = length(nums)              # 3
```
---

#### Type Conversion Functions

ZEN provides four explicit type conversion functions. These are the only supported forms of explicit casting.

---

#### `Int`

Converts a value to `int`.

```
Int(value)
```

Returns `int`.

```zen
int a = Int(3.99)        # 3 — truncates
int b = Int("42")        # 42
int c = Int(true)        # 1
int d = Int(false)       # 0
```

---

#### `Double`

Converts a value to `double`.

```
Double(value)
```

Returns `double`.

```zen
double a = Double(10)          # 10.0
double b = Double("3.14")      # 3.14
double c = Double(true)        # 1.0
```

---

#### `Bool`

Converts a value to `bool`.

```
Bool(value)
```

Returns `bool`.

```zen
bool a = Bool(1)          # true
bool b = Bool(0)          # false
bool c = Bool("true")     # true
bool d = Bool("false")    # false
```

---

#### `String`

Converts a value to `string`.

```
String(value)
```

Returns `string`.

```zen
string a = String(42)        # "42"
string b = String(3.14)      # "3.14"
string c = String(true)      # "true"
```

---

## toString

toString performs an ASCII-based integer-to-character conversion, not a general string cast. It takes an integer value and returns its corresponding ASCII character as a string — for example, toString(65) returns "A", not "65". For general type-to-string conversion, use String() instead. Using toString on non-ASCII integer values or expecting it to stringify numbers as text will produce unexpected results.

```
toString(value)
```

Returns `string`.

```zen
string s = toString(99)      # "c" ASCII of 99
```

---

#### `toInt`

`toInt` performs an ASCII-based character-to-integer conversion, not a general integer cast. It takes a single character string and returns its corresponding ASCII code as an `int` — for example, `toInt("A")` returns `65`, not a parsed number. For general type-to-integer conversion, use `Int()` instead. Passing multi-character strings or expecting it to parse numeric strings as integers will produce unexpected results.

Returns `int`.

```zen
int n = toInt("A")       # 65 — ASCII code of A
int m = toInt("a")       # 97 — ASCII code of a
```

---

### 11.3 Namespaced Modules

Namespaced functions are accessed using dot notation: `namespace.function()`. The underlying compiler built-ins use internal `_namespace_name` identifiers, but ZEN source always uses the dot form.

```zen
string os = os.osName()
bool connected = net.online()
```

---

#### 11.3.1 `sys`

System-level process control.

---

##### `sys.panic`

Immediately terminates the program with an error message.

```
sys.panic(message)
```

| Parameter | Type | Description |
|---|---|---|
| `message` | `string` | Error message to display before exit |

Returns `void`.

```zen
if (x < 0) {
  sys.panic("negative value not allowed")
}
```

---

##### `sys.color`

Changes the terminal output color using ANSI formatting. Affects all subsequent `screen` output until changed again.

```
sys.color("color")
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | ANSI color name e.g. `"red"`, `"green"`, `"reset"` |

Returns `void`.

```zen
color("red")
screen("error occurred")
color("reset")
screen("back to normal")
```

---

##### `sys.exec`

Executes a shell command and returns its exit code.

```
sys.exec(command)
```

| Parameter | Type | Description |
|---|---|---|
| `command` | `string` | Shell command to execute |

Returns `int` — the exit code of the command.

```zen
int code = sys.exec("mkdir output")
```

---

##### `sys.getEnv`

Reads an environment variable by name.

```
sys.getEnv(name)
```

| Parameter | Type | Description |
|---|---|---|
| `name` | `string` | Environment variable name |

Returns `string`.

```zen
string path = sys.getEnv("PATH")
string home = sys.getEnv("HOME")
```

---

#### 11.3.2 `fs`

File system operations.

---

##### `fs.readFile`

Reads the full contents of a file and returns it as a string.

```
fs.readFile(path)
```

Returns `string`.

```zen
string content = fs.readFile("data.txt")
```

---

##### `fs.writeFile`

Writes a string to a file, overwriting existing content.

```
fs.writeFile(path, content)
```

Returns `int` — `0` on success, non-zero on failure.

```zen
int result = fs.writeFile("out.txt", "hello ZEN")
```

---

##### `fs.appendFile`

Appends a string to an existing file without overwriting.

```
fs.appendFile(path, content)
```

Returns `int` — `0` on success, non-zero on failure.

```zen
int result = fs.appendFile("log.txt", "new entry\n")
```

---

##### `fs.exists`

Checks whether a file or directory exists at the given path.

```
fs.exists(path)
```

Returns `bool`.

```zen
bool found = fs.exists("config.zen")
```

---

##### `fs.deleteFile`

Deletes a file at the given path.

```
fs.deleteFile(path)
```

Returns `int` — `0` on success, non-zero on failure.

```zen
int result = fs.deleteFile("temp.txt")
```

---

##### `fs.renameFile`

Renames or moves a file.

```
fs.renameFile(oldPath, newPath)
```

Returns `int` — `0` on success, non-zero on failure.

```zen
int result = fs.renameFile("old.txt", "new.txt")
```

---

##### `fs.makeDir`

Creates a new directory at the given path.

```
fs.makeDir(path)
```

Returns `int` — `0` on success, non-zero on failure.

```zen
int result = fs.makeDir("output")
```

---

##### `fs.cwd`

Returns the current working directory as a string.

```
fs.cwd()
```

Returns `string`.

```zen
string dir = fs.cwd()
screen(dir)
```

---

##### `fs.changeDir`

Changes the current working directory.

```
fs.changeDir(path)
```

Returns `int` — `0` on success, non-zero on failure.

```zen
int result = fs.changeDir("../project")
```

---

#### 11.3.3 `os`

Operating system and hardware information. All `os` functions take no parameters.

---

| Function | Returns | Description |
|---|---|---|
| `os.cpuCount()` | `int` | Number of logical CPU cores |
| `os.cpuArch()` | `string` | CPU architecture e.g. `"x86_64"` |
| `os.cpuModel()` | `string` | CPU model name |
| `os.cpuSpeed()` | `double` | CPU clock speed in GHz |
| `os.totalMemory()` | `int` | Total system RAM in bytes |
| `os.freeMemory()` | `int` | Available RAM in bytes |
| `os.usedMemory()` | `int` | Used RAM in bytes |
| `os.processMemory()` | `int` | RAM used by the current ZEN process in bytes |
| `os.osName()` | `string` | Operating system name e.g. `"Linux"` |
| `os.osVersion()` | `string` | OS version string |
| `os.hostname()` | `string` | Machine hostname |
| `os.username()` | `string` | Current logged-in username |
| `os.uptime()` | `int` | System uptime in seconds |
| `os.battery()` | `string` | Battery status string |

```zen
screen(os.osName())
screen(os.cpuCount())
int mem = os.freeMemory()
```

---

#### 11.3.4 `net`

Network information.

---

##### `net.online`

Checks whether the system has an active network connection.

```
net.online()
```

Returns `bool`.

```zen
bool connected = net.online()
if (connected) {
  screen("network available")
}
```

---

#### 11.3.5 `time`

Time and date functions.

---

##### `time.sleep`

Pauses execution for a given number of milliseconds.

```
time.sleep(ms)
```

| Parameter | Type | Description |
|---|---|---|
| `ms` | `int` | Duration to sleep in milliseconds |

Returns `void`.

```zen
time.sleep(1000)       # pause for 1 second
```

---

##### `time.time`

Returns the current local time as a formatted string.

```
time.time()
```

Returns `string`.

```zen
string now = time.time()
screen(now)            # e.g. "14:32:05"
```

---

##### `time.millis`

Returns the current Unix timestamp in milliseconds.

```
time.millis()
```

Returns `int`.

```zen
int start = time.millis()
# ... work ...
int elapsed = time.millis() - start
```

---

##### `time.date`

Returns the current day of the month.

```
time.date()
```

Returns `int`.

```zen
int d = time.date()    # e.g. 29
```

---

##### `time.day`

Returns the current day of the week as an integer (0 = Sunday, 6 = Saturday).

```
time.day()
```

Returns `int`.

```zen
int d = time.day()     # e.g. 5 for Friday
```

---

##### `time.month`

Returns the current month as an integer (1 = January, 12 = December).

```
time.month()
```

Returns `int`.

```zen
int m = time.month()   # e.g. 5 for May
```

---

##### `time.year`

Returns the current year.

```
time.year()
```

Returns `int`.

```zen
int y = time.year()    # e.g. 2026
```

---

#### 11.3.6 `http`

HTTP client functions. All HTTP functions take a URL as the first parameter and return the response body as a `string`.

---

##### `http.get`

Sends an HTTP GET request.

```
http.get(url)
```

Returns `string` — the response body.

```zen
string res = http.get("https://api.example.com/data")
```

---

##### `http.post`

Sends an HTTP POST request with a body.

```
http.post(url, body)
```

| Parameter | Type | Description |
|---|---|---|
| `url` | `string` | Request URL |
| `body` | `string` | Request body |

Returns `string`.

```zen
string res = http.post("https://api.example.com/users", '{"name":"ZEN"}')
```

---

##### `http.update`

Sends an HTTP PUT request.

```
http.update(url, body)
```

Returns `string`.

```zen
string res = http.update("https://api.example.com/users/1", '{"name":"updated"}')
```

---

##### `http.patch`

Sends an HTTP PATCH request.

```
http.patch(url, body)
```

Returns `string`.

```zen
string res = http.patch("https://api.example.com/users/1", '{"age":22}')
```

---

##### `http.delete`

Sends an HTTP DELETE request.

```
http.delete(url)
```

Returns `string`.

```zen
string res = http.delete("https://api.example.com/users/1")
```

---

### 11.4 Standard Functions

Standard functions are written in ZEN itself as a bootstrapped standard library. They are available globally without any namespace prefix and cover math, string manipulation, and general utilities.

---

#### 11.4.1 Basic Numeric

---

##### `isEven`
```
isEven(n) → bool
```
Returns `true` if `n` is even.
```zen
bool r = isEven(4)      # true
```

---

##### `isOdd`
```
isOdd(n) → bool
```
Returns `true` if `n` is odd.
```zen
bool r = isOdd(3)       # true
```

---

##### `isPositive`
```
isPositive(n) → bool
```
Returns `true` if `n` is greater than zero.
```zen
bool r = isPositive(5)  # true
```

---

##### `isNegative`
```
isNegative(n) → bool
```
Returns `true` if `n` is less than zero.
```zen
bool r = isNegative(-3) # true
```

---

##### `abs`
```
abs(n) → int
```
Returns the absolute value of `n`.
```zen
int r = abs(-10)        # 10
```

---

##### `max`
```
max(a, b) → int
```
Returns the larger of two integers.
```zen
int r = max(3, 7)       # 7
```

---

##### `min`
```
min(a, b) → int
```
Returns the smaller of two integers.
```zen
int r = min(3, 7)       # 3
```

---

##### `clamp`
```
clamp(value, low, high) → int
```
Constrains `value` to the range `[low, high]`.
```zen
int r = clamp(15, 0, 10)   # 10
int r = clamp(-5, 0, 10)   # 0
int r = clamp(5, 0, 10)    # 5
```

---

##### `sign`
```
sign(n) → int
```
Returns `1` if `n` is positive, `-1` if negative, `0` if zero.
```zen
int r = sign(-99)       # -1
int r = sign(0)         # 0
```

---

#### 11.4.2 Math

---

##### `pow`
```
pow(base, exp) → double
```
Returns `base` raised to the power of `exp`.
```zen
double r = pow(2, 10)   # 1024.0
```

---

##### `sqrt`
```
sqrt(n) → int
```
Returns the integer square root of `n`.
```zen
int r = sqrt(16)        # 4
```

---

##### `square`
```
square(n) → int
```
Returns `n * n`.
```zen
int r = square(5)       # 25
```

---

##### `cube`
```
cube(n) → int
```
Returns `n * n * n`.
```zen
int r = cube(3)         # 27
```

---

##### `sin`
```
sin(x) → double
```
Returns the sine of `x` in radians.
```zen
double r = sin(PI / 2)  # 1.0
```

---

##### `cos`
```
cos(x) → double
```
Returns the cosine of `x` in radians.
```zen
double r = cos(0.0)     # 1.0
```

---

##### `tan`
```
tan(x) → double
```
Returns the tangent of `x` in radians.
```zen
double r = tan(PI / 4)  # ~1.0
```

---

##### `log`
```
log(x) → double
```
Returns the natural logarithm of `x`.
```zen
double r = log(E)       # 1.0
```

---

##### `exp`
```
exp(x) → double
```
Returns `e` raised to the power of `x`.
```zen
double r = exp(1.0)     # ~2.718
```

---

#### 11.4.3 Rounding

---

##### `floor`
```
floor(x) → int
```
Rounds `x` down to the nearest integer.
```zen
int r = floor(3.9)      # 3
```

---

##### `ceil`
```
ceil(x) → int
```
Rounds `x` up to the nearest integer.
```zen
int r = ceil(3.1)       # 4
```

---

##### `round`
```
round(x) → int
```
Rounds `x` to the nearest integer.
```zen
int r = round(3.5)      # 4
int r = round(3.4)      # 3
```

---

##### `toFixed`
```
toFixed(x, digits) → double
```
Returns `x` rounded to `digits` decimal places.
```zen
double r = toFixed(3.14159, 2)   # 3.14
```

---

##### `mod`
```
mod(a, b) → int
```
Returns the remainder of `a` divided by `b`.
```zen
int r = mod(10, 3)      # 1
```

---

#### 11.4.4 Number Theory

---

##### `gcd`
```
gcd(a, b) → int
```
Returns the greatest common divisor of `a` and `b`.
```zen
int r = gcd(12, 8)      # 4
```

---

##### `lcm`
```
lcm(a, b) → int
```
Returns the least common multiple of `a` and `b`.
```zen
int r = lcm(4, 6)       # 12
```

---

##### `factorial`
```
factorial(n) → double
```
Returns the factorial of `n`. Returns `double` to accommodate large values.
```zen
double r = factorial(10)   # 3628800.0
```

---

##### `isPrime`
```
isPrime(n) → bool
```
Returns `true` if `n` is a prime number.
```zen
bool r = isPrime(7)     # true
bool r = isPrime(4)     # false
```

---

#### 11.4.5 Interpolation

---

##### `lerp`
```
lerp(a, b, t) → double
```
Linearly interpolates between `a` and `b` by factor `t`. `t` should be in the range `[0.0, 1.0]`.
```zen
double r = lerp(0.0, 10.0, 0.5)   # 5.0
```

---

##### `normalize`
```
normalize(value, min, max) → double
```
Maps `value` from the range `[min, max]` to `[0.0, 1.0]`.
```zen
double r = normalize(5.0, 0.0, 10.0)   # 0.5
```

---

#### 11.4.6 Utility

---

##### `between`
```
between(value, low, high) → bool
```
Returns `true` if `value` is within the range `[low, high]` inclusive.
```zen
bool r = between(5, 1, 10)    # true
bool r = between(11, 1, 10)   # false
```

---

##### `random`
```
random() → double
```
Returns a random `double` in the range `[0.0, 1.0)`. Affected by `SEED`.
```zen
double r = random()
```

---

##### `randomInt`
```
randomInt(min, max) → int
```
Returns a random integer in the range `[min, max]` inclusive. Affected by `SEED`.
```zen
int r = randomInt(1, 100)
```

---

#### 11.4.7 String

---

##### `reverse`
```
reverse(s) → string
```
Returns the string with characters in reverse order.
```zen
string r = reverse("ZEN")      # "NEZ"
```

---

##### `indexOf`
```
indexOf(s, sub) → int
```
Returns the index of the first occurrence of `sub` in `s`. Returns `-1` if not found.
```zen
int r = indexOf("hello", "ll")  # 2
int r = indexOf("hello", "x")   # -1
```

---

##### `slice`
```
slice(s, start, end) → string
```
Returns the substring of `s` from index `start` (inclusive) to `end` (exclusive).
```zen
string r = slice("hello", 1, 3)   # "el"
```

---

##### `charAt`
```
charAt(s, index) → string
```
Returns the character at the given index as a single-character string.
```zen
string r = charAt("hello", 1)     # "e"
```

---

##### `replace`
```
replace(s, target, replacement) → string
```
Replaces the first occurrence of `target` in `s` with `replacement`.
```zen
string r = replace("hello world", "world", "ZEN")   # "hello ZEN"
```

---

##### `contains`
```
contains(s, sub) → bool
```
Returns `true` if `s` contains the substring `sub`.
```zen
bool r = contains("hello", "ell")   # true
```

---

##### `upperCase`
```
upperCase(s) → string
```
Returns `s` converted to uppercase.
```zen
string r = upperCase("zen")   # "ZEN"
```

---

##### `lowerCase`
```
lowerCase(s) → string
```
Returns `s` converted to lowercase.
```zen
string r = lowerCase("ZEN")   # "zen"
```

---

##### `startsWith`
```
startsWith(s, prefix) → bool
```
Returns `true` if `s` begins with `prefix`.
```zen
bool r = startsWith("hello", "he")   # true
```

---

##### `endsWith`
```
endsWith(s, suffix) → bool
```
Returns `true` if `s` ends with `suffix`.
```zen
bool r = endsWith("hello", "lo")   # true
```

---

##### `trim`
```
trim(s) → string
```
Returns `s` with leading and trailing whitespace removed.
```zen
string r = trim("  hello  ")   # "hello"
```

---

##### `splitAt`
```
splitAt(s, delimiter, index) → string
```
Splits `s` by `delimiter` and returns the element at `index`.
```zen
string r = splitAt("a,b,c", ",", 1)   # "b"
string r = splitAt("a,b,c", ",", 0)   # "a"
```

---

##### `repeat`
```
repeat(s, n) → string
```
Returns `s` repeated `n` times.
```zen
string r = repeat("ab", 3)   # "ababab"
```

---

##### `count`
```
count(s, sub) → int
```
Returns the number of non-overlapping occurrences of `sub` in `s`.
```zen
int r = count("hello world hello", "hello")   # 2
```

---

##### `padStart`
```
padStart(s, length, pad) → string
```
Pads the start of `s` with `pad` until the total length reaches `length`.
```zen
string r = padStart("5", 3, "0")   # "005"
```

---

##### `padEnd`
```
padEnd(s, length, pad) → string
```
Pads the end of `s` with `pad` until the total length reaches `length`.
```zen
string r = padEnd("hi", 5, ".")   # "hi..."
```

---

##### `padCenter`
```
padCenter(s, length, pad) → string
```
Pads both sides of `s` with `pad` to center it within `length`.
```zen
string r = padCenter("hi", 6, "-")   # "--hi--"
```

---

##### `capitalize`
```
capitalize(s) → string
```
Returns `s` with the first character converted to uppercase.
```zen
string r = capitalize("zen")   # "Zen"
```

---

##### `extName`
```
extName(path) → string
```
Returns the file extension from a path string, including the leading dot.
```zen
string r = extName("main.zen")   # ".zen"
string r = extName("data.txt")   # ".txt"
```

---

##### `match`
```
match(s, pattern) → bool
```
Returns `true` if `s` fully matches the given pattern string. The **entire string must match** — partial matches return `false`.

```zen
bool r = match("hello@zen.dev", "@")   # false — partial match
bool r = match("hello@zen.dev", "*@*") # true  — wildcard full match
```

---

**Pattern Reference**

Zen's `match()` uses its own lightweight pattern syntax — not traditional regex. Below is the complete reference.

| Pattern | Name | Description |
|---|---|---|
| `"text"` | Literal | Matches exact string content character by character |
| `?` | Any Char | Matches exactly one character of any kind |
| `*` | Wildcard | Matches zero or more characters of any kind |
| `#d` | Digit | Matches a single numeric character `0–9` |
| `#a` | Letter | Matches a single alphabet character `a–z`, `A–Z` |
| `#x` | Alphanumeric | Matches one letter or digit |
| `#s` | Space | Matches one whitespace character (space or tab) |
| `(pattern?)` | Optional Group | Makes the inner pattern match 0 or 1 time |
| `a(+)` | One or More | Repeats the previous token at least once |
| `a(*)` | Zero or More | Repeats the previous token zero or more times |
| `a\|b\|c` | OR | Matches any one of the pipe-separated alternatives |
| `[a,b,c]` | Character Set | Matches one character from the comma-separated list |
| `[a-z]` | Character Range | Matches one character within the defined range |
| `:int` | Integer Token | Matches a full signed or unsigned integer |
| `:id` | Identifier Token | Matches a valid variable/function name (letter or `_` start) |
| `:string` | String Token | Matches any non-empty sequence of characters |

---

**Examples**

```zen
# Literals and wildcards
bool a = match("hello", "hello")       # true
bool b = match("hello123", "h*3")      # true

# Special tokens
bool c = match("5", "#d")             # true  — digit
bool d = match("Z", "#a")             # true  — letter
bool e = match("A", "#x")             # true  — alphanumeric
bool f = match(" ", "#s")             # true  — space

# Optional group
bool g = match("color",  "colou?r")   # true
bool h = match("colour", "colou?r")   # true

# Repetition
bool i = match("aaa", "a(+)")         # true  — one or more
bool j = match("",    "a(*)")         # true  — zero or more

# OR
bool k = match("maybe", "yes|no|maybe")  # true
bool l = match("nope",  "yes|no|maybe")  # false

# Character set and range
bool m = match("c", "[a,b,c]")        # true
bool n = match("7", "[0-9]")          # true
bool o = match("M", "[a-z]")          # false

# Typed tokens
bool p = match("12345",   ":int")     # true
bool q = match("-99",     ":int")     # true
bool r = match("12345a",  ":int")     # false — trailing char
bool s = match("zen_var1", ":id")     # true
bool t = match("1abc",     ":id")     # false — starts with digit
bool u = match("hello world", ":string") # true
```

---

**Notes**

- `match()` always checks the **full string**. Partial matches return `false` — `"12345a"` does not match `":int"`.
- OR (`|`) is evaluated **left to right**. First match wins.
- Character range `[lo-hi]` requires exactly 3 characters inside brackets with a dash in the middle — e.g. `[a-z]`, `[0-9]`.
- `:id` must start with a **letter or underscore**. A leading digit or symbol returns `false`.
- `:int` allows a **leading minus sign**. The remainder must be digits only with no trailing characters.
```

---

##### `json`
```
json(jsonString, accessor) → string
```
Extracts a value from a JSON string using a dot-notation or bracket-notation accessor. Always returns the extracted value as a `string`.

| Parameter | Type | Description |
|---|---|---|
| `jsonString` | `string` | A valid JSON string |
| `accessor` | `string` | Access path e.g. `"name"`, `"a.b"`, `"items[0]"`, `"a.b[1].c"` |

Returns `string`.

```zen
string data = '{"name":"jishith","age":21}'
string name = json(data, "name")          # "jishith"
string age  = json(data, "age")           # "21"

string nested = '{"user":{"city":"Bangalore"}}'
string city = json(nested, "user.city")   # "Bangalore"

string arr = '{"scores":[10,20,30]}'
string s = json(arr, "scores[1]")         # "20"

string deep = '{"a":{"b":[{"c":"found"}]}}'
string val = json(deep, "a.b[0].c")       # "found"
```

## 12. Compilation Model

ZEN is compiled through a multi-stage pipeline implemented in JavaScript and driven by Node.js. The compiler emits LLVM IR, which is then passed through the Clang toolchain to produce a native binary.

---

### 12.1 Pipeline Overview

```
Source (.zen)
     │
     ▼
 Lexer
 Tokenizes source into TYPE:VALUE token stream
     │
     ▼
 Parser
 Builds an Abstract Syntax Tree (AST)
     │
     ▼
 Code Generator
 Walks the AST and emits LLVM IR
     │
     ▼
 LLVM IR (.ll file)
     │
     ▼
 Clang Pipeline (-O2)
     │
     ├── Linux  → ELF binary
     └── Windows → .obj binary
```

---

### 12.2 Stages

#### Stage 1 — Lexer

The lexer reads raw source text and produces a flat sequence of tokens. Each token carries a type and a value. Whitespace and comments are discarded at this stage.

Input: `.zen` source file
Output: Token stream (`TYPE:VALUE` pairs)

#### Stage 2 — Parser

The parser consumes the token stream and constructs an Abstract Syntax Tree (AST). The AST represents the full syntactic structure of the program — declarations, expressions, statements, and control flow — as a tree of nodes.

Input: Token stream
Output: AST

#### Stage 3 — Code Generation

The code generator walks the AST and emits LLVM IR. Each AST node maps to a defined IR construct. This stage also performs semantic checks — type validation, scope resolution, and constraint enforcement.

Input: AST
Output: `.ll` LLVM IR file

#### Stage 4 — Clang Pipeline

The emitted IR is passed to Clang with `-O2` aggressive optimization. Clang compiles and links the IR into a native binary.

- On **Linux**: produces an ELF executable binary
- On **Windows**: produces a `.obj` binary

Input: `.ll` file
Output: Native binary

---

### 12.3 Host Language

The ZEN compiler is implemented in **JavaScript** and runs on **Node.js**. This is the v1.0.0 host. Self-hosting — rewriting the compiler in ZEN itself — is a future goal and not part of the current specification.

---

### 12.4 Optimization

ZEN uses Clang's `-O2` optimization level, which enables aggressive optimizations including:

- Inlining of small functions
- Dead code elimination
- Constant folding and propagation
- Loop optimizations

No user-facing optimization flags are exposed in v1.0.0. All compilation uses `-O2` by default.

---

### 12.5 CLI

ZEN is invoked from the command line using the `zen` command.

```
zen run <filename>
```

`filename` must be a `.zen` source file.

```bash
zen run main.zen
```

This command runs the full pipeline — lexing, parsing, IR emission, Clang compilation — and executes the resulting binary. Both the `.ll` IR file and the final binary are produced as output.

---

### 12.6 Output Files

| File | Description |
|---|---|
| `.ll` | LLVM IR intermediate representation |
| Binary (Linux) | ELF executable |
| Binary (Windows) | `.obj` binary |

## 13. Error Model

ZEN errors are divided into two categories: **compile-time errors**, caught before any code executes, and **runtime errors**, raised during program execution. Both follow a consistent format that includes the error type, a descriptive message, the source location when available, and a partial stack trace when available.

---

### 13.1 Error Format

All Zen errors follow a consistent structured format:

```
[Zen  ErrorType]
  ├── message
  ├── at: filename.zen:line:col
  └── hint: optional suggestion
```

| Field | Description |
|---|---|
| `ErrorType` | The category of error (see sections below) |
| `message` | A human-readable description of what went wrong |
| `at` | File name, line number, and column offset — included for all compile-time errors |
| `hint` | An optional suggestion to help resolve the error, shown when applicable |

---

**Compile-time errors** always include the `at` field pinpointing the exact location of the fault.

```
[Zen  TypeError]
  ├── Cannot assign 'string' to variable of type 'int'
  └── at: main.zen:5:10
```

**Runtime errors** omit location information — the program has already left the static analysis stage.

```
[Zen  IndexError]
  └── Index 5 is out of bounds for List of length 3 — valid range is 0 to 2
```

> **Note:** Stack traces are not included in Zen v1. A full call stack trace is planned for v2.

```
[Zen  ArgumentError]
  ├── Function time.sleep accepts exactly 1 argument(s), got 0
  ├── at: main.zen:12:3
  └── stack trace:
        test (main.zen:12)
```

---

### 13.2 Compile-Time Errors

Compile-time errors are raised by the compiler during lexing, parsing, or code generation. The program does not execute if any compile-time error is present.

---

## Error Reference

Zen reports errors in a consistent structured format. Compile-time errors include the source location. Runtime errors include only the error message — location information is not available at runtime.

**Compile-time format:**
```
[Zen  <ErrorType>]
  ├── <message>
  └── at: <file>:<line>:<col>
```

**Runtime format:**
```
[Zen  <ErrorType>]
  └── <message>
```

---

## Compile-Time Errors

Compile-time errors are caught before execution. The program will not run until all compile-time errors are resolved.

---

#### SyntaxError

Raised when source text does not conform to Zen's grammar.

```
[Zen  SyntaxError]
  ├── Unexpected token '}' — expected expression
  └── at: main.zen:20:1
```

```
[Zen  SyntaxError]
  ├── Unterminated string literal — expected closing '"'
  └── at: main.zen:8:5
```

```
[Zen  SyntaxError]
  ├── Expected '(' after 'fn' in function declaration
  └── at: main.zen:15:4
```

Common triggers:
- Mismatched or missing brackets, braces, or parentheses
- Unterminated string literals
- Malformed function, loop, or conditional declarations

---

#### TypeError

Raised when a value is used in a context that does not match its declared or expected type.

```
[Zen  TypeError]
  ├── Cannot assign 'string' to variable of type 'int'
  └── at: main.zen:5:10
```

```
[Zen  TypeError]
  ├── Argument 1 of 'process' expects 'int', got 'bool'
  └── at: main.zen:12:14
```

```
[Zen  TypeError]
  ├── Condition must be of type 'bool', got 'int'
  └── at: main.zen:9:7
```

```
[Zen  TypeError]
  ├── Ternary branches must return the same type — got 'int' and 'string'
  └── at: main.zen:17:5
```

```
[Zen  TypeError]
  ├── 'switch' condition must be of type 'int', got 'float'
  └── at: main.zen:22:10
```

Common triggers:
- Assigning a value of the wrong type to a typed variable
- Passing an argument of the wrong type to a function
- Using a non-`bool` expression as a condition in `if`, `while`, or `do-while`
- Using a non-`int` expression as a `switch` condition
- Ternary branches resolving to different types

---

#### ArgumentError

Raised when a function is called with the wrong number of arguments.

```
[Zen  ArgumentError]
  ├── 'screen' accepts 1 to 2 argument(s), got 0
  └── at: main.zen:8:3
```

```
[Zen  ArgumentError]
  ├── 'multiply' accepts exactly 2 argument(s), got 5
  └── at: main.zen:31:5
```

Common triggers:
- Calling a function with fewer arguments than required parameters
- Calling a function with more arguments than it declares
- Omitting a required argument when default parameters are partially defined

---

#### DeclarationError

Raised when a variable or function is declared incorrectly or violates a declaration rule.

```
[Zen  DeclarationError]
  ├── 'fn' is a reserved keyword and cannot be used as an identifier
  └── at: main.zen:3:5
```

```
[Zen  DeclarationError]
  ├── Nested function declarations are not allowed in Zen
  └── at: main.zen:10:3
```

```
[Zen  DeclarationError]
  ├── Variable 'x' must have an explicit type or use 'auto'
  └── at: main.zen:6:1
```

```
[Zen  DeclarationError]
  ├── 'List<auto>' is not a valid type — element type must be explicit
  └── at: main.zen:4:8
```

```
[Zen  DeclarationError]
  ├── Cannot manually assign to reactive variable 'total'
  └── at: main.zen:18:3
```

Common triggers:
- Using a reserved keyword as an identifier
- Declaring a function inside another function
- Declaring a variable with no type annotation and no `auto` keyword
- Using `List<auto>` as a type
- Manually reassigning a `reactive` variable

---

#### ConstError

Raised when a `const` variable is reassigned after declaration.

```
[Zen  ConstError]
  ├── Cannot reassign constant 'MAX' — declared as 'const' on line 2
  └── at: main.zen:14:3
```

Common triggers:
- Assigning a new value to a `const` variable anywhere after its declaration
- Using a `const` variable as a loop counter or accumulator

---

#### SemanticError

Raised when code is syntactically valid but violates a language rule that cannot be caught by grammar alone.

```
[Zen  SemanticError]
  ├── 'return' used outside of a function body
  └── at: main.zen:3:1
```

```
[Zen  SemanticError]
  ├── 'break' used outside of a loop or switch block
  └── at: main.zen:25:5
```

```
[Zen  SemanticError]
  ├── 'continue' used outside of a loop block
  └── at: main.zen:19:5
```

```
[Zen  SemanticError]
  ├── Function 'add' does not return a value on all code paths
  └── at: main.zen:7:1
```

```
[Zen  SemanticError]
  ├── Undefined variable 'count' — used before declaration
  └── at: main.zen:11:9
```

```
[Zen  SemanticError]
  ├── Undefined function 'compute' — no declaration found in scope
  └── at: main.zen:44:3
```

Common triggers:
- Using `return`, `break`, or `continue` outside their valid contexts
- Referencing a variable or function that has not been declared
- A non-`void` function that does not return a value on all execution paths
- Using a variable before it has been assigned a value

---

#### ArrayError

Raised when a fixed-size array declaration is invalid.

```
[Zen  ArrayError]
  ├── Array size must be a positive integer greater than 0
  └── at: main.zen:7:3
```

```
[Zen  ArrayError]
  ├── Partial initializer not allowed — array of size 4 requires exactly 4 elements
  └── at: main.zen:9:5
```

```
[Zen  ArrayError]
  ├── Negative index -1 is not allowed — array indices must be non-negative integers
  └── at: main.zen:12:6
```

Common triggers:
- Declaring an array with size `0` or a negative size
- Providing an initializer list that does not exactly match the declared array size
- Using a negative literal as an array index

---

#### ExportError

Raised when an export rule is violated.

```
[Zen  ExportError]
  ├── Cannot export 'b' — only compile-time constant values can be exported
  └── at: utils.zen:6:1
```

```
[Zen  ExportError]
  ├── A file may only contain one 'export' statement
  └── at: utils.zen:12:1
```

```
[Zen  ExportError]
  ├── A file cannot use both 'import' and 'export'
  └── at: utils.zen:1:1
```

Common triggers:
- Exporting a variable whose value is a runtime expression
- Declaring more than one `export` statement in a file
- Using both `import` and `export` in the same file

---

#### ImportError

Raised when an import cannot be resolved or violates an import rule.

```
[Zen  ImportError]
  ├── 'multiply' is not exported by 'utils.zen'
  └── at: main.zen:1:1
```

```
[Zen  ImportError]
  ├── Cannot resolve module 'helpers.zen' — file not found
  └── at: main.zen:1:1
```

```
[Zen  ImportError]
  ├── 'import' must appear before all other declarations
  └── at: main.zen:10:1
```

Common triggers:
- Importing a name that does not exist in the target file's export list
- Importing a file that does not exist on disk
- Placing an `import` statement after other declarations in the file

---

```markdown
#### ReferenceError

Raised when a variable, function, struct, field, or map key is referenced but has not been defined.

```
[Zen  ReferenceError]
  ├── Function 'compute' is not defined
  └── at: main.zen:44:3
```

```
[Zen  ReferenceError]
  ├── Struct 'Player' is not defined
  └── at: main.zen:12:5
```

```
[Zen  ReferenceError]
  ├── Field 'salary' does not exist in struct 'Employee'
  └── at: main.zen:27:8
```

```
[Zen  ReferenceError]
  ├── Key 'email' is not defined in Map 'user'
  └── at: main.zen:33:10
```

```
[Zen  ReferenceError]
  ├── Method 'calculate' is not defined
  └── at: main.zen:19:6
```

Common triggers:
- Calling a function that has not been declared
- Accessing a struct that has not been defined
- Accessing a field that does not exist in a struct
- Accessing a key that does not exist in a map layout
- Calling a method that does not exist on a type
```

---

## Runtime Errors

Runtime errors are raised during program execution and cannot always be anticipated at compile time. They terminate the program immediately.

---

#### IndexError

Raised when a `List` or fixed-size array is accessed with an index that is out of bounds at runtime.

```
[Zen  IndexError]
  └── Index 5 is out of bounds for List of length 3 — valid range is 0 to 2
```

```
[Zen  IndexError]
  └── Index 12 is out of bounds for array of length 5 — valid range is 0 to 4
```

Common triggers:
- Accessing a list or array element at an index greater than or equal to its length
- Off-by-one errors when iterating near the end of a collection

---

#### MemoryError

Raised when a heap object is accessed after it has been freed.

```
[Zen  MemoryError]
  └── Use after free — 'nums' has been freed and is no longer accessible
```

```
[Zen  MemoryError]
  └── Use after free — inner list at index 2 of 'matrix' has been freed
```

Common triggers:
- Accessing a `List` or `Map` after calling `.free()` on it
- Accessing a freed inner list within a nested `List<List<T>>`
- Retaining a reference to a freed object across function calls

---

#### LoopError

Raised when a `loop in` iterates over a `Map` whose value types cannot be resolved uniformly at runtime.

```
[Zen  LoopError]
  └── Cannot iterate — Map 'data' contains heterogeneous value types
```

```
[Zen  LoopError]
  └── Cannot iterate — Map 'config' contains nested values incompatible with 'loop in'
```

Common triggers:
- Using `loop in` on a `Map` that holds values of mixed types
- Using `loop in` on a `Map` with nested or complex value structures

---

#### PanicError

Raised explicitly by the program via `sys.panic()`. Signals an unrecoverable state defined by the developer.

```
[Zen  PanicError]
  └── negative value not allowed
```

```
[Zen  PanicError]
  └── unreachable code path reached in 'resolve'
```

Common triggers:
- Explicit `sys.panic("message")` call to abort on an invalid program state
- Defensive assertions that should never be reached in correct programs

---

### 13.4 Error Improvement Roadmap

ZEN v1.0.0 provides partial stack traces showing only the frame where the error occurred. The following improvements are planned for v2:

- Full call stack traces across all active frames
- Better source location tracking through nested expressions
- Recoverable runtime errors
- Improved error messages with suggested fixes


## Appendix

### A. Reserved Keywords

The following identifiers are reserved by the language and cannot be used as user-defined names.

| Keyword | Category |
|---|---|
| `int` | Type |
| `double` | Type |
| `string` | Type |
| `bool` | Type |
| `List` | Type |
| `Map` | Type |
| `fn` | Function declaration |
| `return` | Function |
| `const` | Declaration modifier |
| `auto` | Type inference |
| `if` | Control flow |
| `else if` | Control flow |
| `else` | Control flow |
| `switch` | Control flow |
| `loop` | Loop |
| `while` | Loop |
| `do` | Loop |
| `in` | Loop iteration |
| `of` | Loop iteration |
| `break` | Loop control |
| `continue` | Loop control |
| `struct` | Data structure |
| `this` | Struct method context |
| `async` | Concurrency (reserved) |
| `await` | Concurrency (reserved) |
| `export` | Module |
| `import` | Module |
| `from` | Module |

---

### B. Reserved Identifiers

The following names are reserved as built-in functions, standard library functions, or global constants. They cannot be redeclared by user code.

#### Global Constants

`PI` `TAU` `E` `PHI` `SQRT2` `LN2` `LN10` `SEED` `I32_MAX` `I32_MIN` `F64_MAX` `F64_MIN` `F64_EPS` `INF` `NEG_INF` `NAN`

#### Core Functions

`screen` `input` `type` `Int` `Double` `Bool` `String` `toString` `toInt` `length`

#### Standard Functions

`isEven` `isOdd` `isPositive` `isNegative` `abs` `max` `min` `clamp` `sign` `pow` `sqrt` `square` `cube` `floor` `ceil` `round` `toFixed` `mod` `gcd` `lcm` `factorial` `isPrime` `lerp` `normalize` `between` `sin` `cos` `tan` `log` `exp` `random` `randomInt` `reverse` `indexOf` `slice` `charAt` `replace` `contains` `upperCase` `lowerCase` `startsWith` `endsWith` `trim` `splitAt` `repeat` `count` `padStart` `padEnd` `padCenter` `capitalize` `extName` `match` `json`

#### Namespace Identifiers

`os` `fs` `sys` `time` `http` `net`

---

### C. Operator Precedence

Operators are listed from highest to lowest precedence. Operators on the same row have equal precedence and are evaluated left to right.

| Level | Operators | Description |
|---|---|---|
| 1 (highest) | `()` | Parenthesised grouping |
| 2 | `++` `--` `!` `-` | Unary operators |
| 3 | `*` `/` `%` | Multiplicative |
| 4 | `+` `-` | Additive |
| 5 | `<` `>` `<=` `>=` | Relational comparison |
| 6 | `==` `!=` | Equality |
| 7 | `&&` | Logical AND |
| 8 | `\|\|` | Logical OR |
| 9 | `? :` | Ternary |
| 10 (lowest) | `=` `+=` `-=` `*=` `/=` `%=` | Assignment |

---

### D. Type Default Values

When a variable is declared without an initializer, it is lowered to its type's default value.

| Type | Default |
|---|---|
| `int` | `0` |
| `double` | `0.0` |
| `string` | `""` |
| `bool` | `false` |
| `List<T>` | `[]` |
| `Map` | `{}` |

---

### E. Type Conversion Reference

| From | To | Function |
|---|---|---|
| `double` | `int` | `Int(x)` — truncates |
| `string` | `int` | `Int(x)` |
| `bool` | `int` | `Int(x)` — `true` → `1`, `false` → `0` |
| `int` | `double` | `Double(x)` |
| `string` | `double` | `Double(x)` |
| `bool` | `double` | `Double(x)` — `true` → `1.0` |
| `int` | `string` | `String(x)` |
| `double` | `string` | `String(x)` |
| `bool` | `string` | `String(x)` |
| `int` | `bool` | `Bool(x)` — `0` → `false`, non-zero → `true` |
| `string` | `bool` | `Bool(x)` — `"true"` → `true`, `"false"` → `false` |

---

### F. Implicit Type Behavior

| Context | Behavior |
|---|---|
| `int` operand with `double` in expression | `int` promoted to `double`; result is `double` |
| `string` + any type via `+` | Other operand coerced to `string`; result is `string` |
| Any other cross-type expression | Compile-time `TypeError` |

---

### G. Data Structure Constraints Summary

| Type | Heap | Resizable | Typed | Nestable | Pass as Param |
|---|---|---|---|---|---|
| `Map` | Yes | Yes | No | Yes | No |
| `List<T>` | Yes | Yes | Yes | Yes | Yes |
| Fixed Array | No | No | Yes | Yes | No |
| `struct` | No | No | Yes | Yes | No |

---

### H. Module Rules Summary

| Rule | Detail |
|---|---|
| One `export` per file | Multiple export statements are a compile-time error |
| Export at bottom | Required for variables; recommended for functions |
| Static values only | Expressions and runtime values cannot be exported |
| No import in exported file | An exporting file must not import |
| Import at top | All imports must precede any other statements |
| Direct name access | No namespace prefix on imported identifiers |
| Exact name match | Imported names must match the export list |
| `.zen` extension | Import paths must reference `.zen` files |

---

### I. Compilation Pipeline Summary

| Stage | Input | Output |
|---|---|---|
| Lexer | `.zen` source | Token stream |
| Parser | Token stream | AST |
| Code Generator | AST | `.ll` LLVM IR |
| Clang (`-O2`) | `.ll` LLVM IR | Native binary |

---

### J. Error Type Reference

| Error | Category | Trigger |
|---|---|---|
| `TypeError` | Compile-time | Type mismatch in assignment or expression |
| `ArgumentError` | Compile-time | Wrong number of arguments to a function |
| `ReferenceError` | Compile-time | Variable, function, struct, field, or map key referenced before definition |
| `DeclarationError` | Compile-time | Invalid identifier or declaration |
| `ConstError` | Compile-time | Reassignment of a constant |
| `ExportError` | Compile-time | Invalid export — expression value or duplicate export |
| `ImportError` | Compile-time | Unresolved import name or missing file |
| `SyntaxError` | Compile-time | Source does not conform to grammar |
| `ArrayError` | Compile-time | Invalid array size or partial initializer |
| `MemoryError` | Runtime | Use after free |
| `IndexError` | Runtime | Out-of-bounds array or list access |
| `PanicError` | Runtime | Explicit `sys.panic()` call |
| `LoopError` | Runtime | `loop in` on heterogeneous or nested Map |