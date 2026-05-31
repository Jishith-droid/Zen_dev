export class ZenMap {
  
  constructor(IRB, expr) {
    this.IRB = IRB;
    this.expr = expr;
  }
  
  // MAP DECLARATION
  
  handleMap(node, globalScope) {
    
    this.IRB.guardStackOp("MAP", node);
    this.IRB.guardGlobal(node.name, node);
    // DECLARE RUNTIME
    
    this.IRB.declareOneTime(
      "zen_map_new",
      "declare ptr @zen_map_new()"
    );
    
    
    const name = node.name;
    const gName = this.IRB.newGlobalTemp();
    const lName = this.IRB.newTemp();
    
    if (node.value.type !== "MAP_LITERAL") {
      
      const expr = this.expr.handleExpression(node.value);
      
      if (!expr.isMap) {
        this.IRB.emitError("TypeError", `Map ${name} expected Map but got ${expr.type}`, node);
      }
      
      this.IRB.emitExpr(expr);
      
      
      if (globalScope) {
        this.IRB.globals.push(`${gName} = global ptr null`);
        this.IRB.emit(`store ptr ${expr.ptr}, ptr ${gName}`)
        
      } else {
        this.IRB.emit(`${lName} = alloca ptr`);
        this.IRB.emit(`store ptr ${expr.ptr}, ptr ${lName}`)
        
      }
      
      this.IRB.setVar(
        name,
        this.IRB.createData({
          ptr: globalScope ? gName : lName,
          type: "Map",
          llvmType: "ptr",
          isMap: true,
          isGlobal: globalScope,
          needsLoad: true,
          name,
          layout: expr?.layout
        })
      );
      
      this.IRB.maps.set(node.name, expr.layout)
      
      return;
    }
    
    const layout =
      this.IRB.buildMapLayout(
        node.value
      );
    
    this.IRB.maps.set(
      name,
      layout
    );
    
    // CREATE ROOT MAP
    
    const mapPtr =
      this.IRB.newTemp();
    
    if (globalScope) {
      this.IRB.globals.push(`${gName} = global ptr null`);
      this.IRB.emit(
        `${mapPtr} = call ptr @zen_map_new()`
      );
      this.IRB.emit(`store ptr ${mapPtr}, ptr ${gName}`)
      
    } else {
      this.IRB.emit(`${lName} = alloca ptr`);
      this.IRB.emit(
        `${mapPtr} = call ptr @zen_map_new()`
      );
      this.IRB.emit(`store ptr ${mapPtr}, ptr ${lName}`)
      
    }
    
    // REGISTER VARIABLE
    
    this.IRB.setVar(
      name,
      this.IRB.createData({
        ptr: globalScope ? gName : lName,
        type: "Map",
        llvmType: "ptr",
        isMap: true,
        isGlobal: globalScope,
        layout,
        needsLoad: true,
        name
      })
    );
    
    
    // EMPTY MAP
    
    if (
      !node.value ||
      !node.value.properties ||
      node.value.properties.length === 0
    ) {
      return;
    }
    
    // INITIALIZE VALUES
    
    this.IRB.buildMapRecursive(
      mapPtr,
      node.value
    );
  }
  
}