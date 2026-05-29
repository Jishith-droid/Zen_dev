/*
#!/usr/bin/env node

import fs from "fs";
import { execSync } from "child_process";

import { Lexer } from "./src/lexer/lexer.js";
import { Parser } from "./src/parser/parser.js";
import { CodeGen } from "./src/codegen/codegen.js";

// ===== ENTRY =====
const entry = process.argv[2];
if (!entry) {
  console.error("Usage: node zen.js main.zen");
  process.exit(1);
}

// ===== MODULE STORAGE =====
const modules = new Map();

// ===== LOAD MODULE =====
function loadModule(path) {
  if (modules.has(path)) return modules.get(path);

  const code = fs.readFileSync(path, "utf-8");

  const tokens = new Lexer(code).tokenize();
  const ast = new Parser(tokens).parse();

  const mod = {
    path,
    ast,
    symbols: {},
    exports: {},
    imports: []
  };

  modules.set(path, mod);

  // collect imports
  for (const node of ast) {
    if (node.type === "IMPORT") {
      mod.imports.push(node);
    }
  }

  // load dependencies
  mod.imports.forEach(imp => {
    loadModule(imp.source);
  });

  return mod;
}

// ===== ANALYZE =====
function mapType(t) {
  if (t === "int") return "i32";
  if (t === "double") return "double";
  if (t === "string") return "i8*";
  if (t === "bool") return "i1";
}

function analyze(mod) {
  for (const node of mod.ast) {

    if (node.type === "VARIABLE_DECLARATION") {
      mod.symbols[node.name] = {
        kind: "variable",
        type: mapType(node.dataType)
      };
    }

    if (node.type === "FUNCTION_DECLARATION") {
      mod.symbols[node.name] = {
        kind: "function",
        returnType: node.returnType === "void" ? "void" : node.returnType.type,
        params: node.params.map(p => mapType(p.type))
      };
    }

    if (node.type === "EXPORT") {
      node.names.forEach(name => {
        if (!mod.symbols[name]) {
          throw new Error(`${name} not found in ${mod.path}`);
        }
        mod.exports[name] = mod.symbols[name];
      });
    }
  }
}

// ===== RESOLVE IMPORTS =====
function resolve(mod) {
  for (const imp of mod.imports) {

    const target = modules.get(imp.source);

    imp.names.forEach(name => {
      const meta = target.exports[name];

      if (!meta) {
        throw new Error(`${name} not exported from ${imp.source}`);
      }

      mod.symbols[name] = meta;
    });
  }
}

// ===== CODEGEN =====
function generate(mod) {
  const codegen = new CodeGen(mod.ast, mod, modules);
  const llvm = codegen.generateLLVM();

  if (!fs.existsSync("build")) {
    fs.mkdirSync("build");
  }

  const out = "build/" + mod.path.replace(".zen", ".ll");
  fs.writeFileSync(out, llvm);
}

// ===== PIPELINE =====
loadModule(entry);
modules.forEach(analyze);
modules.forEach(resolve);
modules.forEach(generate);

// ===== LINK + RUN =====
const llFiles = [...modules.keys()].map(f =>
  "build/" + f.replace(".zen", ".ll")
);

const cmd = `
opt -O2 ${llFiles.join(" ")} -o build/test_opt.ll &&
clang build/test_opt.ll runtime.o zen_stdlib.o constants.o -o out &&
./out
`;

execSync(cmd, { stdio: "inherit" });
*/