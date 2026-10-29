import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
const validate = (Model, payload) => {
  const error = new Model(payload).validateSync();
  if (error) throw error;
};
export const validateInventoryLocation = (payload) => validate(InventoryLocation, payload);
export const validateStorageLocation = (payload) => validate(StorageLocation, payload);
