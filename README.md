# Reaction Inventory
[![Circle CI](https://circleci.com/gh/reactioncommerce/reaction-inventory.svg?style=svg)](https://circleci.com/gh/reactioncommerce/reaction-inventory)

This is a core package of Reaction Commerce and provides
- Inventory Collection and Schema
- reserve inventory when added to Cart
- release inventory when removed from cart
- backorder inventory when no inventory exists
- creates inventory, adjusts inventory on product variant update
- deleted inventory when variant removed

## Usage

```bash
meteor add reactioncommerce:reaction-inventory
```

## Testing

```bash
VELOCITY_TEST_PACKAGES=1 meteor test-packages --port 3006 reactioncommerce:reaction-inventory
```
