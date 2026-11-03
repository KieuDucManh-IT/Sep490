import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { StockMovement } from '../../models/warehouse/inventory/StockMovement.js';

export const increaseInventoryBalance = ({ locationId, storageId = null, variantId, quantity, increments = {}, session }) =>
  InventoryBalance.findOneAndUpdate(
    { locationId, storageId, variantId },
    { $inc: { quantityOnHand: quantity, ...increments } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) },
  );

export const recordStockMovement = async (movement, session) => {
  if (session) return (await StockMovement.create([movement], { session }))[0];
  return StockMovement.create(movement);
};
