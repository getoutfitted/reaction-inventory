/* eslint dot-notation: 0 */
describe("inventory methods", function () {
  describe("inventory items", function () {
    beforeEach(function () {
      ReactionCore.Collections.Inventory.remove({}); // Empty Inventory
      ReactionCore.Collections.Products.remove({}); // Empty Products
      ReactionCore.Collections.Cart.remove({}); // Empty Cart
    });
    describe("inventory/register", function () {
      it("should add inventory items for product", function (done) {
        let product = Factory.create("product");
        let productId = product._id;
        let qty = product.variants[0].inventoryQuantity;
        spyOn(ReactionCore, "hasPermission").and.returnValue(true);
        expect(Meteor.call("inventory/register", product)).toEqual(qty);
        // expect(function () {
        //   return Meteor.call("inventory/register", product);
        // }).toEqual(qty);

        let inventory = ReactionCore.Collections.Inventory.find({
          productId: productId
        }).fetch();
        expect(_.size(inventory)).toEqual(qty);
        done();
      });

      it("should remove deleted variants from inventory", function (done) {
        let product = Factory.create("product");
        let productId = product._id;
        let qty = product.variants[0].inventoryQuantity;

        expect(_.size(product.variants)).toEqual(1);
        // register inventory (that we'll should delete on variant removal)
        spyOn(ReactionCore, "hasPermission").and.returnValue(true);
        Meteor.call("inventory/register", product);
        // expect(Meteor.call("inventory/register", product)).toEqual(quantity);

        // delete variant
        Meteor.call("products/deleteVariant", product.variants[0]._id);

        let inventory = ReactionCore.Collections.Inventory.find({
          productId: productId
        }).fetch();

        expect(_.size(inventory)).not.toEqual(qty);
        expect(_.size(inventory)).toEqual(0);
        done();
      });

      it("should reserve product variants added to cart", function (done) {
        let product = Factory.create("product");
        let cartId = Factory.create("cart")._id;
        let productId = product._id;
        let quantity = product.variants[0].inventoryQuantity;
        let variantData = product.variants[0];
        expect(_.size(product.variants)).toEqual(1);
        // create some inventory to reserve
        spyOn(ReactionCore, "hasPermission").and.returnValue(true);
        Meteor.call("inventory/register", product);
        // expect(Meteor.call("inventory/register", product)).toEqual(quantity);

        // add to cart (expect to reserve)
        Meteor.call("cart/addToCart", cartId, productId, variantData, quantity);
        // fetch reserved inventory
        let inventory = ReactionCore.Collections.Inventory.find({
          "productId": productId,
          "variantId": product.variants[0]._id,
          "workflow.status": "reserved",
          "orderId": cartId
        }).fetch();

        expect(_.size(inventory)).toEqual(quantity);
        done();
      });

      it("should create backordered inventory when no inventory available", function (done) {
        let product = Factory.create("product");
        let cartId = Factory.create("cart")._id;
        let productId = product._id;
        let quantity = product.variants[0].inventoryQuantity;
        let variantData = product.variants[0];
        expect(_.size(product.variants)).toEqual(1);
        // add to cart
        Meteor.call("cart/addToCart", cartId, productId, variantData, quantity);
        // fetch reserved inventory
        let inventory = ReactionCore.Collections.Inventory.find({
          "productId": productId,
          "variantId": product.variants[0]._id,
          "workflow.status": "backordered",
          "orderId": cartId
        }).fetch();
        expect(_.size(inventory)).toEqual(quantity);
        done();
      });


      //
      // it("should remove inventory reservation when removed cart", function (
      //   done) {
      //   done();
      // });
      //

      //
      // it("should converted backordered inventory to reserved when inventory available", function (
      //   done) {
      //   done();
      // });
      //
      // it("should update sold inventory on product and inventory when order fulfilled", function (
      //   done) {
      //   done();
      // });
      //
      // it("should make reserved inventory available when cart deleted", function (
      //   done) {
      //   done();
      // });
      //
      // it("should update cart reservations when product sold out", function (
      //   done) {
      //   done();
      // });
      //
      // it("should send inventory notification when low stock on product", function (
      //   done) {
      //   done();
      // });
    });
  });
});
