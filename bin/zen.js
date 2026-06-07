#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

import { Lexer } from "../src/lexer/lexer.js";
import { Parser } from "../src/parser/parser.js";
import { CodeGen } from "../src/codegen/codegen.js";
import { IRBuilder } from "../src/codegen/helper/helper.js";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPILER_ROOT = path.resolve(__dirname, "..");

const command = process.argv[2];
const file = process.argv[3];

function help() {
  console.log(`
Zen Programming Language

Usage:
  zen run <file>
  zen build <file>
  zen ir <file>
  zen ast <file>
  zen tokens <file>
  zen version
  zen help
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

// ---------------- CLI ----------------

if (!command) {
  help();
  process.exit(0);
}

if (command === "help") {
  help();
  process.exit(0);
}

if (command === "version") {
  console.log("Zen 1.0.0");
  process.exit(0);
}

if (!file) {
  console.error("error: missing input file");
  process.exit(1);
}

if (!fs.existsSync(file)) {
  console.error(`error: file not found '${file}'`);
  process.exit(1);
}

// ---------------- FRONTEND ----------------

const source = fs.readFileSync(file, "utf8");

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

// ---------------- CODEGEN ----------------

const codegen = new CodeGen(ast);
const llvm = codegen.generateLLVM();

if (!llvm) {
  console.error("IR generation failed");
  process.exit(1);
}

const moduleFiles = llvm.modules ? [...llvm.modules] : [];
console.log(moduleFiles)
if (command === "ir") {
  console.log(llvm.ir);
  process.exit(0);
}

// ---------------- BUILD ----------------

if (command !== "build" && command !== "run") {
  console.error(`error: unknown command '${command}'`);
  process.exit(1);
}

try {
  fs.mkdirSync("build", { recursive: true });

  const exeName = path.basename(file).replace(/\.(zen|z)$/, "");
  const buildDir = "build";

  // ---------------- MAIN IR ----------------
  const outLL = path.join(buildDir, "out.ll");
  const outOptLL = path.join(buildDir, "out_opt.ll");
  const outO = path.join(buildDir, "out.o");

  fs.writeFileSync(outLL, llvm.ir);

  run(`opt -O3 ${outLL} -S -o ${outOptLL}`);
  run(`llc -filetype=obj -relocation-model=pic ${outOptLL} -o ${outO}`);

  // ---------------- MODULES ----------------
  const moduleObjs = [];

  for (const ll of moduleFiles) {
    const obj = ll.replace(".ll", ".o");

    run(`llc -filetype=obj -relocation-model=pic ${ll} -o ${obj}`);
    moduleObjs.push(obj);
  }

  // ---------------- STDLIB (ONLY .o) ----------------
  const stdlibObjs = [
    path.join(COMPILER_ROOT, "src/zen_stdlib/constants.o"),
   path.join(COMPILER_ROOT,  "src/zen_stdlib/zen_stdlib_opt.o"),
  ];

  // ---------------- RUNTIME (ONLY .o) ----------------
  const runtimeObjs = [
   path.join(COMPILER_ROOT,  "src/codegen/runtime/runtime.o"),
   path.join(COMPILER_ROOT, "src/codegen/runtime/listRuntime.o"),
   path.join(COMPILER_ROOT, "src/codegen/runtime/mapRuntime.o"),
  ];

  // ---------------- LINK ----------------
  run(
    [
      "clang",
      outO,
      ...moduleObjs,
      ...stdlibObjs,
      ...runtimeObjs,
      "-O3",
      "-o",
      path.join(buildDir, exeName),
    ].join(" ")
  );

  // ---------------- RUN ----------------
  if (command === "build") {
    console.log(`Build successful: build/${exeName}`);
    process.exit(0);
  }

  run(path.join(buildDir, exeName));

} catch (err) {
  console.error("Build failed");
  process.exit(1);
}
