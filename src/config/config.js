// data type

const LLVM_TYPES_MAP = {
  int: "i32",
  double: "double",
  string: "i8*",
  bool: "i1",
  "void": "void"
};

const ZEN_TYPES_MAP = {
  "i32": "int",
  "double": "double",
  "i8*": "string",
  "i1": "bool",
  "void": "void"
}

const COMPOUND_OPERATORS = ["+=", "-=", "*=", "/=", "%="];

const TYPES = ["int", "bool", "string", "double", "auto" /* for infer */ ];

const SCALAR_TYPES = ["int", "bool", "double"];

const NON_SCALAR_TYPES = ["string"];

const RESERVED_KEYWORDS = ["fn", "if", "else if", "else", "loop", "const", "int", "double", "string", "bool", "return", "while", "List", "this", "do", "in", "of", "async", "await", "Map"];

// lexer tokens

const TokenTypes = {
  IDENTIFIER: "IDENTIFIER",
  ASSIGNMENT: "ASSIGNMENT",
  OPERATOR: "OPERATOR",
  CONSTANT: "CONSTANT",
  IMPORT: "IMPORT",
  EXPORT: "EXPORT",
  STRUCT: "STRUCT",
  FROM: "FROM",
  QUESTION: "QUESTION",
  TYPE: "TYPE",
  INT: "int",
  ELLIPSIS: "ELLIPSIS",
  LESS_THAN: "LESS_THAN",
  GREATER_THAN: "GREATER_THAN",
  DOT: "DOT",
  LBRACKET: "LBRACKET",
  RBRACKET: "RBRACKET",
  STRING: "string",
  BOOLEAN: "bool",
  DOUBLE: "double",
  NEWLINE: "NEWLINE",
  LEFT_PARENTHESIS: "LEFT_PARENTHESIS",
  RIGHT_PARENTHESIS: "RIGHT_PARENTHESIS",
  KEYWORD: "KEYWORD",
  COMMA: "COMMA",
  BLOCK_START: "BLOCK_START",
  BLOCK_END: "BLOCK_END",
  COLON: "COLON",
  ARRAY: "ARRAY",
  EOF: "EOF"
};

// keywords

const KEYWORDS = ["if", "else if", "else", "loop", "break", "continue", "return", "fn", "const", "void", "while", "switch", "case", "default", "import", "export", "from", "struct", "auto", "List", "this", "do", "in", "of", "async", "await", "Map"];

const STDLIB = [
  // BASIC
  "isEven", "isOdd", "isPositive", "isNegative",
  "abs", "max", "min", "clamp", "sign",
  
  // MATH
  "pow", "sqrt", "square", "cube",
  
  // ROUNDING
  "floor", "ceil", "round", "toFixed",
  "mod",
  
  // NUMBER THEORY
  "gcd", "lcm", "factorial", "isPrime",
  
  // INTERPOLATION
  "lerp", "normalize",
  
  // UTILITY
  "between",
  
  // STRING
  "reverse", "indexOf", "slice", "charAt",
  "replace", "contains",
  "upperCase", "lowerCase",
  "startsWith", "endsWith",
  "trim", "splitAt",
  "repeat", "padStart", "padEnd", "padCenter", "count",
  "capitalize", "extName", "sin",
  "cos", "tan", "log", "exp",
  "random", "randomInt",
  
  "match", "json"
];

// builtin functions

/*const BUILTIN_FUNCTIONS = [
  "screen", "input", "type", "Int", "Double", "Bool", "String", "toString", "toInt", "length", "panic", "readFile", "writeFile", "appendFile", "exists", "deleteFile", "renameFile", "makeDir", "exec", "sleep", "getEnv", "cwd", "changeDir",
  "cpuCount",
  
  "cpuArch",
  
  "cpuModel",
  
  "cpuSpeed",
  
  "totalMemory",
  
  "freeMemory",
  
  "usedMemory",
  
  "processMemory",
  
  "osName",
  
  "osVersion",
  
  "hostname",
  
  "username",
  
  "uptime",
  
  "online",
  
  "battery",
  "time",
  "millis",
  "date",
  "month",
  "day",
  "year",
  "color",
  "get",
  "post",
  "update",
  "delete",
  "patch"
];
*/

const RESERVED_FUNCTIONS = [
  // CORE
  "screen",
  "input",
  "type",
  "Int",
  "Double",
  "Bool",
  "String",
  "toString",
  "toInt",
  "length",
  "color",
  // BASIC
  "isEven", "isOdd", "isPositive", "isNegative",
  "abs", "max", "min", "clamp", "sign",
  
  // MATH
  "pow", "sqrt", "square", "cube",
  
  // ROUNDING
  "floor", "ceil", "round", "toFixed",
  "mod",
  
  // NUMBER THEORY
  "gcd", "lcm", "factorial", "isPrime",
  
  // INTERPOLATION
  "lerp", "normalize",
  
  // UTILITY
  "between",
  
  // STRING
  "reverse", "indexOf", "slice", "charAt",
  "replace", "contains",
  "upperCase", "lowerCase",
  "startsWith", "endsWith",
  "trim", "splitAt",
  "repeat", "padStart", "padEnd", "padCenter", "count",
  "capitalize", "extName", "sin",
  "cos", "tan", "log", "exp",
  "random", "randomInt",
  
  "match", "json"
]

const BUILTIN_FUNCTIONS = [
  
  // CORE
  "screen",
  "input",
  "type",
  "Int",
  "Double",
  "Bool",
  "String",
  "toString",
  "toInt",
  "length",
  "color",
  "_time_sleep",
  // SYS
  "_sys_exec",
  "_sys_panic",
  "_sys_getEnv",
  
  // FS
  "_fs_cwd",
  "_fs_readFile",
  "_fs_writeFile",
  "_fs_appendFile",
  "_fs_exists",
  "_fs_deleteFile",
  "_fs_makeDir",
  "_fs_changeDir",
  "_fs_renameFile",
  
  // OS
  "_os_cpuCount",
  "_os_cpuArch",
  "_os_cpuModel",
  "_os_cpuSpeed",
  "_os_totalMemory",
  "_os_freeMemory",
  "_os_usedMemory",
  "_os_processMemory",
  "_os_osName",
  "_os_osVersion",
  "_os_hostname",
  "_os_username",
  "_os_uptime",
  "_os_battery",
  
  // NET
  "_net_online",
  
  // TIME
  "_time_time",
  "_time_millis",
  "_time_date",
  "_time_month",
  "_time_day",
  "_time_year",
  
  // HTTP
  "_http_get",
  "_http_post",
  "_http_update",
  "_http_patch",
  "_http_delete"
];

const NAMESPACE_MAP = {
  
  os: [
    "cpuCount",
    "cpuArch",
    "cpuModel",
    "cpuSpeed",
    "totalMemory",
    "freeMemory",
    "usedMemory",
    "processMemory",
    "osName",
    "osVersion",
    "hostname",
    "username",
    "uptime",
    "battery"
  ],
  
  fs: [
    "readFile",
    "writeFile",
    "appendFile",
    "exists",
    "deleteFile",
    "renameFile",
    "makeDir",
    "cwd",
    "changeDir"
  ],
  
  sys: [
    "exec",
    "panic",
    "getEnv"
  ],
  
  time: [
    "sleep",
    "time",
    "millis",
    "date",
    "day",
    "month",
    "year"
  ],
  
  http: [
    "get",
    "post",
    "update",
    "delete",
    "patch"
  ],
  
  net: [
    "online"
  ]
};

const BUILTIN_MAP = {
  
  // ========================================
  // CORE
  // ========================================
  
  screen: {
    returnType: "void",
    llvmName: "screen"
  },
  
  input: {
    returnType: "int",
    llvmName: "input"
  },
  
  type: {
    returnType: "string",
    llvmName: "type"
  },
  
  "Int": {
    returnType: "int",
    llvmName: "Int"
  },
  
  "Double": {
    returnType: "double",
    llvmName: "Double"
  },
  
  "Bool": {
    returnType: "bool",
    llvmName: "Bool"
  },
  
  "String": {
    returnType: "string",
    llvmName: "String"
  },
  
  toString: {
    returnType: "string",
    llvmName: "toString"
  },
  
  toInt: {
    returnType: "int",
    llvmName: "toInt"
  },
  
  length: {
    returnType: "int",
    llvmName: "length"
  },
  
  color: {
    returnType: "void",
    llvmName: "color"
  },
  
  // ========================================
  // SYS
  // ========================================
  
  panic: {
    returnType: "void",
    llvmName: "_sys_panic"
  },
  
  exec: {
    returnType: "int",
    llvmName: "_sys_exec"
  },
  
  getEnv: {
    returnType: "string",
    llvmName: "_sys_getEnv"
  },
  
  // ========================================
  // FS
  // ========================================
  
  readFile: {
    returnType: "string",
    llvmName: "_fs_readFile"
  },
  
  writeFile: {
    returnType: "int",
    llvmName: "_fs_writeFile"
  },
  
  appendFile: {
    returnType: "int",
    llvmName: "_fs_appendFile"
  },
  
  exists: {
    returnType: "bool",
    llvmName: "_fs_exists"
  },
  
  deleteFile: {
    returnType: "int",
    llvmName: "_fs_deleteFile"
  },
  
  renameFile: {
    returnType: "int",
    llvmName: "_fs_renameFile"
  },
  
  makeDir: {
    returnType: "int",
    llvmName: "_fs_makeDir"
  },
  
  cwd: {
    returnType: "string",
    llvmName: "_fs_cwd"
  },
  
  changeDir: {
    returnType: "int",
    llvmName: "_fs_changeDir"
  },
  
  // ========================================
  // OS
  // ========================================
  
  cpuCount: {
    returnType: "int",
    llvmName: "_os_cpuCount"
  },
  
  cpuArch: {
    returnType: "string",
    llvmName: "_os_cpuArch"
  },
  
  cpuModel: {
    returnType: "string",
    llvmName: "_os_cpuModel"
  },
  
  cpuSpeed: {
    returnType: "double",
    llvmName: "_os_cpuSpeed"
  },
  
  totalMemory: {
    returnType: "int",
    llvmName: "_os_totalMemory"
  },
  
  freeMemory: {
    returnType: "int",
    llvmName: "_os_freeMemory"
  },
  
  usedMemory: {
    returnType: "int",
    llvmName: "_os_usedMemory"
  },
  
  processMemory: {
    returnType: "int",
    llvmName: "_os_processMemory"
  },
  
  osName: {
    returnType: "string",
    llvmName: "_os_osName"
  },
  
  osVersion: {
    returnType: "string",
    llvmName: "_os_osVersion"
  },
  
  hostname: {
    returnType: "string",
    llvmName: "_os_hostname"
  },
  
  username: {
    returnType: "string",
    llvmName: "_os_username"
  },
  
  uptime: {
    returnType: "int",
    llvmName: "_os_uptime"
  },
  
  battery: {
    returnType: "string",
    llvmName: "_os_battery"
  },
  
  // ========================================
  // NET
  // ========================================
  
  online: {
    returnType: "bool",
    llvmName: "_net_online"
  },
  
  // ========================================
  // TIME
  // ========================================
  
  sleep: {
    returnType: "void",
    llvmName: "zen_sleep"
  },
  
  time: {
    returnType: "string",
    llvmName: "_time_time"
  },
  
  millis: {
    returnType: "int",
    llvmName: "_time_millis"
  },
  
  date: {
    returnType: "int",
    llvmName: "_time_date"
  },
  
  month: {
    returnType: "int",
    llvmName: "_time_month"
  },
  
  day: {
    returnType: "int",
    llvmName: "_time_day"
  },
  
  year: {
    returnType: "int",
    llvmName: "_time_year"
  },
  
  // ========================================
  // HTTP
  // ========================================
  
  "get": {
    returnType: "string",
    llvmName: "_http_get"
  },
  
  post: {
    returnType: "string",
    llvmName: "_http_post"
  },
  
  update: {
    returnType: "string",
    llvmName: "_http_update"
  },
  
  patch: {
    returnType: "string",
    llvmName: "_http_patch"
  },
  
  "delete": {
    returnType: "string",
    llvmName: "_http_delete"
  }
};


const NOT_STANDALONE_BUILTIN_FUNCTIONS = ["input"];

const VOID_BUILTIN_FUNCTIONS = ["screen", "panic", "sleep"];

// operators

const ASSIGNMENT_OPS = [
  "=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%="
];

const ARITHMETIC_OPS = [
  "+",
  "-",
  "*",
  "/",
  "%"
];

const UNARY_OPS = [
  "++",
  "--",
  "!"
];

const COMPARISON_OPS = [
  "==",
  "!=",
  ">=",
  "<=",
  ">",
  "<"
];

const LOGICAL_OPS = [
  "&&",
  "||"
];

const OP_CODES = {
  int: {
    "+": "add",
    "-": "sub",
    "*": "mul",
    "/": "sdiv",
    "%": "srem"
  },
  double: {
    "+": "fadd",
    "-": "fsub",
    "*": "fmul",
    "/": "fdiv",
    "%": "frem"
  }
};

const cmpMap = {
  "==": "eq",
  "!=": "ne",
  ">": "sgt",
  "<": "slt",
  ">=": "sge",
  "<=": "sle"
};

const fcmpMap = {
  "==": "oeq",
  "!=": "one",
  ">": "ogt",
  "<": "olt",
  ">=": "oge",
  "<=": "ole"
};

const FORMAT_MAP = {
  int: {
    fmt: "@.scan_int",
    fmtType: "[3 x i8]",
    varType: "i32",
    decl: "scan_int",
    ir: '@.scan_int = private constant [3 x i8] c"%d\\00"',
    zero: "0"
  },
  double: {
    fmt: "@.scan_double",
    fmtType: "[4 x i8]",
    varType: "double",
    decl: "scan_double",
    ir: '@.scan_double = private constant [4 x i8] c"%lf\\00"',
    zero: "0.0"
  },
  string: {
    fmt: "@.scan_string",
    fmtType: "[6 x i8]",
    varType: "i8*",
    decl: "scan_string",
    ir: '@.scan_string = private constant [6 x i8] c"%[^\n]\\00"',
    zero: null
  }
}

const LOOKUP = {
  bool: 0,
  int: 1,
  double: 2
};

const OPERATORS = [
  ...ASSIGNMENT_OPS,
  ...ARITHMETIC_OPS,
  ...UNARY_OPS,
  ...COMPARISON_OPS,
  ...LOGICAL_OPS
];

// parser types

const ParserTypes = {
  BINARY_EXPRESSION: "BINARY_EXPRESSION",
  MAP_DECLARATION: "MAP_DECLARATION",
  MAP_LITERAL: "MAP_LITERAL",
  MAP_PROPERTY: "MAP_PROPERTY",
  SWITCH: "SWITCH",
  LOOP_IN: "LOOP_IN",
  LOOP_OF: "LOOP_OF",
  DO_WHILE: "DO_WHILE",
  TERNARY: "TERNARY",
  ASSIGNMENT: "ASSIGNMENT",
  VARIABLE_REFERENCE: "VARIABLE_REFERENCE",
  LIST_LITERAL: "LIST_LITERAL",
  UNARY_EXPRESSION: "UNARY_EXPRESSION",
  FUNCTION_DECLARATION: "FUNCTION_DECLARATION",
  VARIABLE_DECLARATION: "VARIABLE_DECLARATION",
  STRUCT: "STRUCT",
  MEMBER_ASSIGNMENT: "MEMBER_ASSIGNMENT",
  MEMBER_ACCESS: "MEMBER_ACCESS",
  IMPORT: "IMPORT",
  EXPORT: "EXPORT",
  BLOCK: "BLOCK",
  IF: "CONDITIONAL",
  LOOP: "LOOP",
  BREAK: "BREAK",
  CONTINUE: "CONTINUE",
  RETURN: "RETURN",
  INT: "int",
  DOUBLE: "double",
  STRING: "string",
  BOOLEAN: "bool",
  VOID: "void",
  VARIABLE: "variable",
  CALL: "CALL",
  WHILE: "WHILE_LOOP",
  CONDITIONAL: "CONDITIONAL",
  ARRAY: "ARRAY",
  ARRAY_ACCESS: "ARRAY_ACCESS",
  DATA_TYPE: "DATA_TYPE"
};

const GLOBAL_EXTERNAL = {
  PI: { type: "double", mutable: false },
  TAU: { type: "double", mutable: false },
  E: { type: "double", mutable: false },
  PHI: { type: "double", mutable: false },
  SQRT2: { type: "double", mutable: false },
  LN2: { type: "double", mutable: false },
  LN10: { type: "double", mutable: false },
  
  SEED: { type: "i32", mutable: true },
  
  I32_MAX: { type: "i32", mutable: false },
  I32_MIN: { type: "i32", mutable: false },
  
  F64_MAX: { type: "double", mutable: false },
  F64_MIN: { type: "double", mutable: false },
  F64_EPS: { type: "double", mutable: false },
  
  INF: { type: "double", mutable: false },
  NEG_INF: { type: "double", mutable: false },
  NAN: { type: "double", mutable: false }
};

const STD_FUNCTIONS = {
  // ===== BASIC =====
  isEven: { ret: "i1", params: ["i32"] },
  isOdd: { ret: "i1", params: ["i32"] },
  isPositive: { ret: "i1", params: ["i32"] },
  isNegative: { ret: "i1", params: ["i32"] },
  
  abs: { ret: "i32", params: ["i32"] },
  max: { ret: "i32", params: ["i32", "i32"] },
  min: { ret: "i32", params: ["i32", "i32"] },
  clamp: { ret: "i32", params: ["i32", "i32", "i32"] },
  sign: { ret: "i32", params: ["i32"] },
  
  pow: { ret: "double", params: ["i32", "i32"] },
  sqrt: { ret: "i32", params: ["i32"] },
  square: { ret: "i32", params: ["i32"] },
  cube: { ret: "i32", params: ["i32"] },
  
  // ===== ROUNDING =====
  floor: { ret: "i32", params: ["double"] },
  ceil: { ret: "i32", params: ["double"] },
  round: { ret: "i32", params: ["double"] },
  toFixed: { ret: "double", params: ["double", "i32"] },
  
  mod: { ret: "i32", params: ["i32", "i32"] },
  
  // ===== NUMBER THEORY =====
  gcd: { ret: "i32", params: ["i32", "i32"] },
  lcm: { ret: "i32", params: ["i32", "i32"] },
  factorial: { ret: "double", params: ["i32"] },
  isPrime: { ret: "i1", params: ["i32"] },
  
  // ===== INTERPOLATION =====
  lerp: { ret: "double", params: ["double", "double", "double"] },
  normalize: { ret: "double", params: ["double", "double", "double"] },
  
  // ===== UTILITY =====
  between: { ret: "i1", params: ["i32", "i32", "i32"] },
  
  // ===== STRING =====
  reverse: { ret: "i8*", params: ["i8*"] },
  indexOf: { ret: "i32", params: ["i8*", "i8*"] },
  slice: { ret: "i8*", params: ["i8*", "i32", "i32"] },
  charAt: { ret: "i8*", params: ["i8*", "i32"] },
  replace: { ret: "i8*", params: ["i8*", "i8*", "i8*"] },
  contains: { ret: "i1", params: ["i8*", "i8*"] },
  upperCase: { ret: "i8*", params: ["i8*"] },
  lowerCase: { ret: "i8*", params: ["i8*"] },
  startsWith: { ret: "i1", params: ["i8*", "i8*"] },
  endsWith: { ret: "i1", params: ["i8*", "i8*"] },
  trim: { ret: "i8*", params: ["i8*"] },
  splitAt: { ret: "i8*", params: ["i8*", "i8*", "i32"] },
  repeat: { ret: "i8*", params: ["i8*", "i32"] },
  count: { ret: "i32", params: ["i8*", "i8*"] },
  
  padStart: { ret: "i8*", params: ["i8*", "i32", "i8*"] },
  padEnd: { ret: "i8*", params: ["i8*", "i32", "i8*"] },
  padCenter: { ret: "i8*", params: ["i8*", "i32", "i8*"] },
  
  capitalize: { ret: "i8*", params: ["i8*"] },
  extName: { ret: "i8*", params: ["i8*"] },
  
  sin: { ret: "double", params: ["double"] },
  cos: { ret: "double", params: ["double"] },
  tan: { ret: "double", params: ["double"] },
  
  log: { ret: "double", params: ["double"] },
  exp: { ret: "double", params: ["double"] },
  
  randomInt: { ret: "i32", params: ["i32", "i32"] },
  random: { ret: "double", params: [] },
  match: { ret: "i1", params: ["i8*", "i8*"] },
  json: { ret: "i8*", params: ["i8*", "i8*"] }
};

/* zen native simlar Structure functions map
  struct: { name: [llvm binding name, return type, params count, [params]]}
  */
/*
const OS_MAP = {
  cpuCount: ["zen_cpu_count", "int", 0, []],
  cpuArch: ["zen_cpu_arch", "string", 0, []],
  cpuModel: ["zen_cpu_model", "string", 0, []],
  cpuSpeed: ["zen_cpu_speed", "double", 0, []],
  
  totalMemory: ["zen_total_memory", "int", 0, []],
  freeMemory: ["zen_free_memory", "int", 0, []],
  usedMemory: ["zen_used_memory", "int", 0, []],
  processMemory: ["zen_process_memory", "int", 0, []],
  
  osName: ["zen_os_name", "string", 0, []],
  osVersion: ["zen_os_version", "string", 0, []],
  
  username: ["zen_username", "string", 0, []],
  uptime: ["zen_uptime", "double", 0, []],
  hostname: ["zen_hostname", "int", 0, []],
  exec: ["zen_exec", "int", 1, ["string"]],
  color: ["zen_color", "void", 1, ["string"]],
  sleep: ["zen_sleep", "void", 1, ["int"]],
  getEnv: ["zen_getEnv", "string", 1, ["string"]],
  online: ["zen_online", "bool", 0, []],
  battery: ["zen_battery", "string", 0, []]
}

const FILE_MAP = {
  cwd: ["zen_cwd", "string", 0, []],
  readFile: ["zen_readFile", "string", 1, ["string"]],
  writeFile: ["zen_writeFile", "int", 2, ["string", "string"]],
  exists: ["zen_exists", "bool", 1, ["string"]],
  deleteFile: ["zen_deleteFile", "int", 1, ["string"]],
  makeDir: ["zen_makeDir", "int", 1, ["string"]],
  appendFile: ["zen_appendFile", "int", 2, ["string", "string"]],
  changeDir: ["zen_changeDir", "int", 1],
  renameFile: ["zen_renameFile", "int", 2, ["string", "string"]]
};

const TIME_MAP = {
  
  time: [
    "zen_time",
    "string",
    0,
    []
  ],
  
  millis: [
    "zen_millis",
    "int",
    0,
    []
  ],
  
  date: [
    "zen_date",
    "int",
    0,
    []
  ],
  
  month: [
    "zen_month",
    "int",
    0,
    []
  ],
  
  day: [
    "zen_day",
    "int",
    0,
    []
  ],
  
  year: [
    "zen_year",
    "int",
    0,
    []
  ]
  
};

const NETWORK_MAP = {
  
  "get": [
    "zen_get",
    "string",
    1,
    ["string"]
  ],
  
  post: [
    "zen_post",
    "string",
    2,
    ["string", "string"]
  ],
  
  update: [
    "zen_update",
    "string",
    2,
    ["string", "string"]
  ],
  
  patch: [
    "zen_patch",
    "string",
    2,
    ["string", "string"]
  ],
  
  "delete": [
    "zen_delete",
    "string",
    1,
    ["string"]
  ]
  
};*/


// ========================================
// OS
// ========================================

const OS_MAP = {
  
  _os_cpuCount: [
    "_os_cpuCount",
    "int",
    0,
    []
  ],
  
  _os_cpuArch: [
    "_os_cpuArch",
    "string",
    0,
    []
  ],
  
  _os_cpuModel: [
    "_os_cpuModel",
    "string",
    0,
    []
  ],
  
  _os_cpuSpeed: [
    "_os_cpuSpeed",
    "double",
    0,
    []
  ],
  
  _os_totalMemory: [
    "_os_totalMemory",
    "int",
    0,
    []
  ],
  
  _os_freeMemory: [
    "_os_freeMemory",
    "int",
    0,
    []
  ],
  
  _os_usedMemory: [
    "_os_usedMemory",
    "int",
    0,
    []
  ],
  
  _os_processMemory: [
    "_os_processMemory",
    "int",
    0,
    []
  ],
  
  _os_osName: [
    "_os_osName",
    "string",
    0,
    []
  ],
  
  _os_osVersion: [
    "_os_osVersion",
    "string",
    0,
    []
  ],
  
  _os_username: [
    "_os_username",
    "string",
    0,
    []
  ],
  
  _os_hostname: [
    "_os_hostname",
    "string",
    0,
    []
  ],
  
  _os_uptime: [
    "_os_uptime",
    "double",
    0,
    []
  ],
  
  _os_battery: [
    "_os_battery",
    "string",
    0,
    []
  ]
};


// ========================================
// FILE SYSTEM
// ========================================

const FILE_MAP = {
  
  _fs_cwd: [
    "_fs_cwd",
    "string",
    0,
    []
  ],
  
  _fs_readFile: [
    "_fs_readFile",
    "string",
    1,
    ["string"]
  ],
  
  _fs_writeFile: [
    "_fs_writeFile",
    "int",
    2,
    ["string", "string"]
  ],
  
  _fs_exists: [
    "_fs_exists",
    "bool",
    1,
    ["string"]
  ],
  
  _fs_deleteFile: [
    "_fs_deleteFile",
    "int",
    1,
    ["string"]
  ],
  
  _fs_makeDir: [
    "_fs_makeDir",
    "int",
    1,
    ["string"]
  ],
  
  _fs_appendFile: [
    "_fs_appendFile",
    "int",
    2,
    ["string", "string"]
  ],
  
  _fs_changeDir: [
    "_fs_changeDir",
    "int",
    1,
    ["string"]
  ],
  
  _fs_renameFile: [
    "_fs_renameFile",
    "int",
    2,
    ["string", "string"]
  ]
  
};


// ========================================
// SYSTEM
// ========================================

const SYS_MAP = {
  
  _sys_exec: [
    "_sys_exec",
    "int",
    1,
    ["string"]
  ],
  
  _sys_panic: [
    "_sys_panic",
    "void",
    1,
    ["string"]
  ],
  
  _sys_getEnv: [
    "_sys_getEnv",
    "string",
    1,
    ["string"]
  ],
  
  color: [
    "zen_color",
    "void",
    1,
    ["string"]
  ],
  
};


// ========================================
// TIME
// ========================================

const TIME_MAP = {
  
  _time_sleep: [
    "zen_sleep",
    "void",
    1,
    ["int"]
  ],
  
  _time_time: [
    "_time_time",
    "string",
    0,
    []
  ],
  
  _time_millis: [
    "_time_millis",
    "int",
    0,
    []
  ],
  
  _time_date: [
    "_time_date",
    "int",
    0,
    []
  ],
  
  _time_month: [
    "_time_month",
    "int",
    0,
    []
  ],
  
  _time_day: [
    "_time_day",
    "int",
    0,
    []
  ],
  
  _time_year: [
    "_time_year",
    "int",
    0,
    []
  ]
  
};


// ========================================
// NETWORK
// ========================================

const NETWORK_MAP = {
  
  _net_online: [
    "_net_online",
    "bool",
    0,
    []
  ]
};


// ========================================
// HTTP
// ========================================

const HTTP_MAP = {
  
  _http_get: [
    "_http_get",
    "string",
    1,
    ["string"]
  ],
  
  _http_post: [
    "_http_post",
    "string",
    2,
    ["string", "string"]
  ],
  
  _http_update: [
    "_http_update",
    "string",
    2,
    ["string", "string"]
  ],
  
  _http_patch: [
    "_http_patch",
    "string",
    2,
    ["string", "string"]
  ],
  
  _http_delete: [
    "_http_delete",
    "string",
    1,
    ["string"]
  ]
  
};

export {
  LLVM_TYPES_MAP,
  TYPES,
  SCALAR_TYPES,
  NON_SCALAR_TYPES,
  TokenTypes,
  KEYWORDS,
  BUILTIN_FUNCTIONS,
  ASSIGNMENT_OPS,
  ARITHMETIC_OPS,
  UNARY_OPS,
  COMPARISON_OPS,
  LOGICAL_OPS,
  OPERATORS,
  OP_CODES,
  LOOKUP,
  cmpMap,
  fcmpMap,
  VOID_BUILTIN_FUNCTIONS,
  NOT_STANDALONE_BUILTIN_FUNCTIONS,
  ParserTypes,
  FORMAT_MAP,
  RESERVED_KEYWORDS,
  ZEN_TYPES_MAP,
  GLOBAL_EXTERNAL,
  STD_FUNCTIONS,
  STDLIB,
  OS_MAP,
  FILE_MAP,
  TIME_MAP,
  BUILTIN_MAP,
  NETWORK_MAP,
  SYS_MAP,
  HTTP_MAP,
  NAMESPACE_MAP,
  RESERVED_FUNCTIONS,
  COMPOUND_OPERATORS
}