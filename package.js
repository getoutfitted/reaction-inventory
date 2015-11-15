Package.describe({
  summary: "Reaction Inventory",
  name: "reactioncommerce:reaction-inventory",
  version: "0.1.0",
  git: "https://github.com/reactioncommerce/reaction-inventory.git"
});


Package.onUse(function (api) {
  api.versionsFrom("METEOR@1.2");

  // meteor base packages
  api.use("meteor-base");
  api.use("mongo");
  api.use("session");
  api.use("tracker");
  api.use("reload");
  api.use("random");
  api.use("ejson");
  api.use("check");
  api.use("ecmascript");
  api.use("ddp-rate-limiter");

  api.use("reactioncommerce:core@0.9.5");

  api.addFiles("schema.js"); // ReactionCore.Schemas.Inventory
  api.addFiles("collections.js"); // Inventory collection
  api.addFiles("server/publications.js", ["server"]); // publish inventory
  api.addFiles("hooks.js"); // hook into core collection updates
  api.addFiles("routing.js"); // dashboard/inventory
  api.addFiles("inventory.js"); // inventory methods
  api.addFiles("server/register.js", ["server"]); // register as a reaction package
  api.addFiles("server/methods.js", ["server"]); // server methods
});

Package.onTest(function (api) {
  api.use("sanjo:jasmine@0.20.2");
  api.use("ecmascript");
  api.use("jquery");
  api.use("underscore");
  api.use("velocity:html-reporter@0.9.1");
  api.use("velocity:console-reporter@0.1.4");

  api.use("reactioncommerce:core");
  api.use("reactioncommerce:reaction-factories");
  api.use("reactioncommerce:reaction-inventory");

  api.addFiles("tests/jasmine/server/integration/inventory.js", "server");
});
