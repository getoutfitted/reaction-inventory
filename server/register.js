ReactionCore.registerPackage({
  label: "Inventory",
  name: "reaction-inventory",
  icon: "fa fa-truck",
  autoEnable: true,
  settings: {
    name: "Inventory"
  },
  registry: [
    {
      provides: "dashboard",
      route: "dashboard/inventory",
      label: "Basic Inventory",
      description: "Basic Inventory Management",
      icon: "fa fa-truck",
      cycle: 4,
      group: "reaction-inventory"
    },
    {
      label: "Inventory Settings",
      route: "dashboard/inventory",
      provides: "settings",
      group: "reaction-inventory",
      template: "inventorySettings"
    }
  ]
});
