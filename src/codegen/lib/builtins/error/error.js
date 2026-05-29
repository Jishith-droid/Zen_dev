import { FORMAT_MAP } from '/src/config/config.js';

export class ZenError {
  constructor(IRB, io) {
    this.IRB = IRB;
    this.io = io;
  }
  
  panic(node) {
    
    const args = node.args;
    
    if (args.length === 0 || args.length > 1) {
      this.IRB.emitError("ArgumentError", "Function panic() accept exactly 1 argument", node);
    }
    
    if (args[0].type !== "string") {
      this.IRB.emitError("TypeError", "Function panic() accept only string type", node);
    }
  
    this.IRB.declareOneTime("exit","declare void @exit(i32)");
    
    this.io.screen(node);
    
    this.IRB.emit(`call void @exit(i32 1)`);
    
  }
}