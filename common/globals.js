// exported, global/window scope
ReactionInventory = {};
ReactionInventory.Schemas = {};
ReactionInventory.Collections = {};

// set logging level
let formatOut = logger.format({
  outputMode: "short",
  levelInString: false
});
ReactionInventory.Log = logger.bunyan.createLogger({name: "inventory", stream: formatOut});
