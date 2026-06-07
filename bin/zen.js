#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";

// ---------------- ROOT ----------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI install root (zen compiler folder)
const COMPILER_ROOT = path.resolve(__dirname, "..");

// ---------------- HELP ----------------

const args = process.argv.slice(2);
const command = args[0];

function help() {
  console.log(`
Zen Programming Language

Usage:
  zen run <file>
  zen build <file>
  zen ir <file>
  zen ast <file>
  zen tokens <file>
  zen help
  zen version
`);
}

function run(cmd) {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    console.error("Command failed:", cmd);
    process.exit(1);
  }
}

// ---------------- HELP / VERSION ----------------

if (!command || command === "help" || command === "--help" || command === "-h") {
  help();
  process.exit(0);
}

if (command === "version") {
  console.log("Zen 1.0.0");
  process.exit(0);
}

// ---------------- INPUT FILE ----------------

const file = args[1];

if (!file) {
  console.error("error: missing input file");
  process.exit(1);
}

const inputFile = path.resolve(file);

if (!fs.existsSync(inputFile)) {
  console.error(`error: file not found '${inputFile}'`);
  process.exit(1);
}

// Project root = file location (FILE-BASED compiler)
const PROJECT_ROOT = path.dirname(inputFile);
const source = fs.readFileSync(inputFile, "utf8");

// ---------------- LOAD COMPILER MODULES (DYNAMIC IMPORT FIX) ----------------

const IRBuilder = (await import(
  pathToFileURL(path.join(COMPILER_ROOT, "src/codegen/helper/helper.js")).href
)).IRBuilder;

const Lexer = (await import(
  pathToFileURL(path.join(COMPILER_ROOT, "src/lexer/lexer.js")).href
)).Lexer;

const Parser = (await import(
  pathToFileURL(path.join(COMPILER_ROOT, "src/parser/parser.js")).href
)).Parser;

const CodeGen = (await import(
  pathToFileURL(path.join(COMPILER_ROOT, "src/codegen/codegen.js")).href
)).CodeGen;

// ---------------- FRONTEND ----------------

const IRB = new IRBuilder();

const lexer = new Lexer(source, IRB);
const tokens = lexer.tokenize();

if (command === "tokens") {
  console.log(tokens);
  process.exit(0);
}

const parser = new Parser(tokens, IRB);
const ast = parser.parse();

if (command === "ast") {
  console.log(JSON.stringify(ast, null, 2));
  process.exit(0);
}

// ---------------- IR GENERATION ----------------

const codegen = new CodeGen(ast, "main");
const llvm = codegen.generateLLVM();

if (!llvm) {
  console.error("IR generation failed");
  process.exit(1);
}

const moduleFiles = llvm.modules ? [...llvm.modules] : [];

// ---------------- BUILD DIR (FILE BASED) ----------------

const buildDir = path.join(PROJECT_ROOT, "build");
fs.mkdirSync(buildDir, { recursive: true });

// ---------------- OUTPUT FILES ----------------

const exeName = path.basename(inputFile).replace(/\.(zen|z)$/, "");

const outLL = path.join(buildDir, "out.ll");
const outOptLL = path.join(buildDir, "out_opt.ll");
const outO = path.join(buildDir, "out.o");

fs.writeFileSync(outLL, llvm.ir);

// ---------------- LLVM PIPELINE ----------------

run(`opt -O3 ${outLL} -S -o ${outOptLL}`);
run(`llc -filetype=obj -relocation-model=pic ${outOptLL} -o ${outO}`);

// ---------------- MODULE OBJECTS ----------------

const moduleObjs = [];

for (const ll of moduleFiles) {
  const absLL = path.resolve(PROJECT_ROOT, ll);
  const obj = absLL.replace(".ll", ".o");

  run(`llc -filetype=obj -relocation-model=pic ${absLL} -o ${obj}`);
  moduleObjs.push(obj);
}

// ---------------- STD LIB + RUNTIME ----------------

const stdlibObjs = [
  path.join(COMPILER_ROOT, "src/zen_stdlib/constants.o"),
  path.join(COMPILER_ROOT, "src/zen_stdlib/zen_stdlib_opt.o"),
];

const runtimeObjs = [
  path.join(COMPILER_ROOT, "src/codegen/runtime/runtime.o"),
  path.join(COMPILER_ROOT, "src/codegen/runtime/listRuntime.o"),
  path.join(COMPILER_ROOT, "src/codegen/runtime/mapRuntime.o"),
];

// ---------------- LINK ----------------

const outputExe = path.join(buildDir, exeName);

run([
  "clang",
  outO,
  ...moduleObjs,
  ...stdlibObjs,
  ...runtimeObjs,
  "-O3",
  "-o",
  outputExe,
].join(" "));

// ---------------- RUN ----------------

if (command === "build") {
  console.log(`Build successful: ${outputExe}`);
  process.exit(0);
}

run(outputExe);