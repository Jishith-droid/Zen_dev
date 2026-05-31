export class Block {
  constructor(IRB, codegen) {
    this.IRB = IRB;
    this.codegen = codegen;
  }
  
  
  block(blockNode, globalScope, meta = false) {
    
    if (!blockNode) return;
    
    // REAL BLOCK 
    if (blockNode.type === "BLOCK") {
      this.IRB.enterScope();
      
      for (const stmt of blockNode.body || []) {
        this.codegen.dispatch(stmt, globalScope, true, meta); // third param: flag for if its inside any block to prevent double function hoisting 
      }
      
      this.IRB.exitScope();
      return;
    }
    
    // SINGLE STATEMENT
    this.IRB.enterScope();
    this.codegen.dispatch(blockNode, globalScope);
    this.IRB.exitScope();
  }
}