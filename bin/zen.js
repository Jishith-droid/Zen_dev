#!/usr/bin/env node

import fs from "fs";
import { Lexer } from "../src/lexer/lexer.js";
import { Parser } from "../src/parser/parser.js";
import { CodeGen } from "../src/codegen/codegen.js";
import { IRBuilder } from "../src/codegen/helper/helper.js";

const file = process.argv[2];

if (!file) {
  console.error("Usage: zen <file.zen>");
  process.exit(1);
}

const source = fs.readFileSync(file, "utf8");

const IR = new IRBuilder();

const lexer = new Lexer(source, IR);
const tokens = lexer.tokenize();

const parser = new Parser(tokens, IR);
const ast = parser.parse();

const codegen = new CodeGen(ast);
const llvm = codegen.generateLLVM();