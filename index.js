/*
import { Lexer } from './src/lexer/lexer.js';
import { Parser } from './src/parser/parser.js';
import { CodeGen } from './src/codegen/codegen.js';
import { IRBuilder } from './src/codegen/helper/helper.js';

const code = document.querySelector(".code");
const btn = document.querySelector(".generate");

const tokenDiv = document.querySelector(".tokens");
const astDiv = document.querySelector(".ast");
const llvmDiv = document.getElementById("llvm");
const highlight = document.getElementById("codeHighlight");
const clearBtn = document.querySelector(".clear");
const IR = new IRBuilder();

clearBtn.addEventListener("click", async()=> {
  
    const text = code.value;
    
    try {
      await navigator.clipboard.writeText(text);
      console.log("copied")
    } catch (err) {
      console.error("Clipboard failed:", err);
      alert("Copy failed (browser permission issue)");
    }
    
  code.value = "";
    
  
  window.location.reload();
  
    code.textContent = ""
    highlight.textContent = ""
  
})

btn.addEventListener("click", () => {
  // reset UI
  llvmDiv.textContent = "";
  tokenDiv.textContent = "";
  astDiv.textContent = "";
  
  const source = code.value;
  
  const lexer = new Lexer(source, IR);
  const tokens = lexer.tokenize();
  tokenDiv.textContent = JSON.stringify(tokens, null, 2);
  
  const parser = new Parser(tokens, IR);
  const ast = parser.parse();
  astDiv.textContent = JSON.stringify(ast, null, 2);
  
  const codegen = new CodeGen(ast);
  const llvm = codegen.generateLLVM();
  
  llvmDiv.textContent = llvm.ir;
  
});

document.querySelectorAll(".copy-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const target = btn.dataset.copy;
    
    let text = "";
    
    if (target === "tokens") {
      text = document.querySelector(".tokens")?.innerText || "";
    }
    
    if (target === "ast") {
      text = document.querySelector(".ast")?.innerText || "";
    }
    
    if (target === "llvm") {
      text = document.querySelector("#llvm")?.innerText || "";
    }
    
    try {
      await navigator.clipboard.writeText(text);
      
      const oldText = btn.textContent;
      btn.textContent = "Copied!";
      
      setTimeout(() => {
        btn.textContent = oldText;
      }, 1000);
      
    } catch (err) {
      console.error("Clipboard failed:", err);
      alert("Copy failed (browser permission issue)");
    }
  });
});

const downloadBtn = document.querySelector(".download-llvm");

downloadBtn.addEventListener("click", () => {
  const llvm = document.getElementById("llvm").textContent;

  if (!llvm) {
    alert("No LLVM IR to download");
    return;
  }

  // create file blob
  const blob = new Blob([llvm], { type: "text/plain" });

  // create download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "output.ll";

  document.body.appendChild(a);
  a.click();

  // cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
*/