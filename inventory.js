// Define a rate limiting rule that matches update attempts by non-admin users
const addReserveRule = {
  userId: function (userId) {
    return Roles.userIsInRole(userId, "createProduct", ReactionCore.getShopId());
  },
  type: "subscription",
  method: "Inventory"
};

// Define a rate limiting rule that matches backorder attempts by non-admin users
const addBackorderRule = {
  userId: function (userId) {
    return Roles.userIsInRole(userId, "createProduct", ReactionCore.getShopId());
  },
  type: "method",
  method: "inventory/backorder"
};

// Add the rule, allowing up to 5 messages every 1000 milliseconds.
DDPRateLimiter.addRule(addReserveRule, 5, 1000);
DDPRateLimiter.addRule(addBackorderRule, 5, 1000);

//
// Inventory methods
//

Meteor.methods({
  /**
   * inventory/register
   * @param {Object} product - valid ReactionCore.Schemas.Product object
   * @return {undefined}
   */
  "inventory/register": function (product) {
    check(product, ReactionCore.Schemas.Product);
    // this.unblock();
    let totalNewInventory = 0;
    // user needs createProduct permission to register new inventory
    if (!ReactionCore.hasPermission("createProduct")) {
      throw new Meteor.Error(403, "Access Denied");
    }

    // we'll check each variant to see if it has been fully registered
    for (let variant of product.variants) {
      let inventory = ReactionCore.Collections.Inventory.find({
        productId: product._id,
        variantId: variant._id,
        shopId: product.shopId
      });
      // we'll return this as well
      let inventoryVariantCount = inventory.count();
      // if the variant exists already we're remove from the inventoryVariants
      // so that we don't process it as an insert
      if (inventoryVariantCount < variant.inventoryQuantity) {
        let newQty = variant.inventoryQuantity || 0;
        let i = inventoryVariantCount + 1;

        ReactionCore.Log.info(
          `inserting ${newQty - inventoryVariantCount} new inventory items for ${variant._id}`
        );

        while (i <= newQty) {
          let inventoryItem = ReactionCore.Collections.Inventory.insert({
            shopId: product.shopId,
            variantId: variant._id,
            productId: product._id
          });

          // checking updated inventory state
          realQty = ReactionCore.Collections.Inventory.find({
            shopId: product.shopId,
            variantId: variant._id,
            productId: product._id
          }).count();
          // console.log(realQty, i)
          if (realQty !== i) {
            throw new Meteor.Error("Inventory Anomoly Detected. Abort!");
          }
          ReactionCore.Log.debug("inventory/register added", inventoryItem);
          totalNewInventory++;
          i++;
        }
      }
    }
    // return the total amount
    // of new inventory created
    return totalNewInventory;
  },
  /**
   * inventory/adjust
   * adjust existing inventory when changes are made
   * we get the inventoryQuantity for each product variant,
   * and compare the qty to the qty in the inventory records
   * we will add inventoryItems as needed to have the same amount as the inventoryQuantity
   * but when deleting, we'll refuse to delete anything not workflow.status = "new"
   *
   * @param  {Object} product - ReactionCore.Schemas.Product object
   * @return {[undefined]} returns undefined
   */
  "inventory/adjust": function (product) {
    // adds or updates inventory collection with this product
    check(product, ReactionCore.Schemas.Product);
    this.unblock();

    // user needs createProduct permission to adjust inventory
    if (!ReactionCore.hasPermission("createProduct")) {
      throw new Meteor.Error(403, "Access Denied");
    }

    // variants to register
    let inventoryVariants = product.variants.map(variant => {
      return {
        _id: variant._id,
        qty: variant.inventoryQuantity || 0
      };
    }); // Quantity and variants of this product's inventory

    for (let variant of inventoryVariants) {
      let Inventory = ReactionCore.Collections.Inventory.find({
        productId: product._id,
        variantId: variant._id
      });
      let itemCount = Inventory.count();

      ReactionCore.Log.info(
        `inventory: adjust variant ${variant._id} from ${itemCount} to ${variant.qty} `
      );

      // we need to register some new variants to inventory
      if (itemCount < variant.qty) {
        Meteor.call("inventory/register", product);
      }
      // we're adding variants to inventory
      if (itemCount > variant.qty) {
        // determine how many records to delete
        removeQty = itemCount - variant.qty;

        // we're only going to delete records that are new
        let removeInventory = ReactionCore.Collections.Inventory.find({
          "productId": product._id,
          "variantId": variant._id,
          "workflow.status": "new"
        }, {
          sort: {
            updatedAt: -1
          },
          limit: removeQty
        }).fetch();

        // delete latest inventory records that are new
        for (let inventoryItem of removeInventory) {
          // we can only remove inventory marked as new
          Meteor.call("inventory/remove", inventoryItem);
        }
        // we could add logic here to move othere inventory items to a retired status
        // if there aren't enough "new" items to remove
      }
    }
  },
  "inventory/remove": function (inventoryItem) {
    check(inventoryItem, ReactionCore.Schemas.Inventory);
    this.unblock();
    // user needs createProduct permission to adjust inventory
    if (!ReactionCore.hasPermission("createProduct")) {
      throw new Meteor.Error(403, "Access Denied");
    }

    ReactionCore.Log.debug("inventory/remove", inventoryItem);
    return ReactionCore.Collections.Inventory.remove(inventoryItem);
  },
  /**
   * inventory/addReserve
   *
   * @param  {Array} cartItems array of objects of type ReactionCore.Schemas.CartItems
   * @param  {String} status optional - sets the inventory workflow status, defaults to "reserved"
   * @return {undefined} returns undefined
   */
  "inventory/addReserve": function (cartItems, status) {
    check(cartItems, [ReactionCore.Schemas.CartItem]);
    check(status, Match.Optional(String));
    this.unblock();
    const newStatus = status || "reserved"; // change status to options object
    let reservationCount = 0;
    // update each cart item in inventory
    for (let item of cartItems) {
      // check of existing reserved inventory for this cart
      let existingReservations = ReactionCore.Collections.Inventory.find({
        productId: item.productId,
        variantId: item.variants._id,
        shopId: item.shopId,
        orderId: item._id
      });

      // define a new reservation
      let availableInventory = ReactionCore.Collections.Inventory.find({
        "productId": item.productId,
        "variantId": item.variants._id,
        "shopId": item.shopId,
        "workflow.status": "new"
      });

      const totalRequiredQty = item.quantity; //
      const availableInventoryQty = availableInventory.count();
      let existingReservationQty = existingReservations.count();


      ReactionCore.Log.info("totalRequiredQty", totalRequiredQty);
      ReactionCore.Log.info("availableInventoryQty", availableInventoryQty);

      // if we don't have existing inventory we create backorders
      if (totalRequiredQty > availableInventoryQty) {
        let backOrderQty = Number(totalRequiredQty - availableInventoryQty - existingReservationQty);
        ReactionCore.Log.info("no inventory found, backorder.", backOrderQty);
        // define a new reservation
        const reservation = {
          productId: item.productId,
          variantId: item.variants._id,
          shopId: item.shopId,
          orderId: item._id
        };

        Meteor.call("inventory/backorder", reservation, backOrderQty);
        existingReservationQty = backOrderQty;
      }
      // if we have inventory available, only create additional required reservations
      ReactionCore.Log.debug("existingReservationQty", existingReservationQty);
      let newReservedQty = totalRequiredQty - existingReservationQty;
      let i = 0;
      // updated existing new inventory to be reserved
      ReactionCore.Log.info(`reserving ${newReservedQty} inventory of ${totalRequiredQty} items.`);
      while (i < newReservedQty) {
        // we should be updating existing inventory here.
        // backorder process created additional backorder inventory if there
        // wasn't enough.
        ReactionCore.Collections.Inventory.update({
          "productId": item.productId,
          "variantId": item.variants._id,
          "shopId": item.shopId,
          "workflow.status": "new"
        }, {
          $set: {
            "orderId": item._id,
            "workflow.status": newStatus
          }
        });
        reservationCount = i;
        i++;
      }
    }
    ReactionCore.Log.info("inventory/addReserve", reservationCount, newStatus);
    return reservationCount;
  },
/**
 * inventory/clearReserve
 * @param  {Array} cartItems array of objects ReactionCore.Schemas.CartItem
 * @param  {[type]} status optional reset workflow.status, defaults to "new"
 * @param  {[type]} reserve optional matching workflow.status, defaults to "reserved"
 * @return {undefined} undefined
 */
  "inventory/clearReserve": function (cartItems, status, reserve) {
    check(cartItems, [ReactionCore.Schemas.CartItem]);
    check(status, Match.Optional(String)); // should be a constant or workflow definition
    check(reserve, Match.Optional(String)); // should be a constant or workflow definition
    this.unblock();

    // optional workflow status or default to "new"
    let newStatus = status || "new";
    let oldStatus = reserve || "reserved";

    // remove each cart item in inventory
    for (let item of cartItems) {
      // check of existing reserved inventory for this cart
      let existingReservations = ReactionCore.Collections.Inventory.find({
        "productId": item.productId,
        "variantId": item.variants._id,
        "shopId": item.shopId,
        "orderId": item._id,
        "workflow.status": oldStatus
      });
      let i = existingReservations.count();
      // reset existing cartItem reservations
      while (i <= item.quantity) {
        ReactionCore.Collections.Inventory.update({
          "productId": item.productId,
          "variantId": item.variants._id,
          "shopId": item.shopId,
          "orderId": item._id,
          "workflow.status": oldStatus
        }, {
          $set: {
            "orderId": "", // clear order/cart
            "workflow.status": newStatus // reset status
          }
        });
        i++;
      }
    }
    ReactionCore.Log.info("inventory/clearReserve", newStatus);
    return;
  },
  /**
   * inventory/backorder
   * is used by the cart process to create a new Inventory
   * backorder item, but this could be used for inserting any
   * custom inventory as
   * DDP Limits: as these are wide open we defined some ddp limiting rules http://docs.meteor.com/#/full/ddpratelimiter
   *
   * @param {Object} reservation ReactionCore.Schemas.Inventory
   * @param {Number} backOrderQty number of backorder items to create
   * @returns {Array} inserts into collection and returns array of inserted inventory id
   */
  "inventory/backorder": function (reservation, backOrderQty) {
    check(reservation, ReactionCore.Schemas.Inventory);
    check(backOrderQty, Number);
    const inventoryBackorder = [];
    // if meteor user is a guest
    let newReservation = reservation;
    // default to backorder status if not defined.
    if (!newReservation.workflow) {
      newReservation.workflow = {
        status: "backorder"
      };
    }
    // insert backorder
    let i = 0;
    while (i < backOrderQty) {
      inventoryId = ReactionCore.Collections.Inventory.insert(newReservation);
      inventoryBackorder.push(inventoryId);
      ReactionCore.Log.debug("inventory: demand created backorder", inventoryId);
      i++;
    }
    return inventoryBackorder;
  },
  //
  // send low stock warnings
  //
  "inventory/lowStock": function (product) {
    check(product, ReactionCore.Schemas.Product);
    // WIP placeholder
    ReactionCore.Log.info("inventory/lowStock");
    return;
  },
  //
  // mark inventory as shipped
  //
  "inventory/shipped": function (productId, variantId) {
    check(productId, String);
    check(variantId, String);
    // WIP placeholder
    ReactionCore.Log.info("inventory/shipped");
    return;
  },
  //
  // mark inventory as returned
  //
  "inventory/return": function (inventoryId, productId, variantId) {
    check(inventoryId, String);
    check(productId, String);
    check(variantId, String);

    // WIP placeholder
    ReactionCore.Log.info("inventory/return");
    return;
  },
  //
  // mark inventory as return and available for sale
  //
  "inventory/returnToStock": function (productId, variantId) {
    check(productId, String);
    check(variantId, String);
    // WIP placeholder
    ReactionCore.Log.info("inventory/returnToStock");
    return;
  }
});
