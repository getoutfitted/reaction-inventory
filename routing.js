Router.map(function() {
  return this.route('dashboard/inventory', {
    controller: ShopAdminController,
    path: 'dashboard/inventory',
    template: 'inventory',
    waitOn: function() {
      return ReactionCore.Subscriptions.Packages;
    },
    subscriptions: function() {
      return Meteor.subscribe("Inventory");
    }
  });
});
