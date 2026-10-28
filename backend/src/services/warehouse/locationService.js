import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { validateInventoryLocation, validateStorageLocation } from '../../validations/warehouse/locationValidation.js';

const createService = (Model, validate, populateFields = []) => ({
  list: () => {
    let query = Model.find().sort({ createdAt: -1 });
    for (const field of populateFields) query = query.populate(field);
    return query;
  },
  create: async (payload) => { validate(payload); return Model.create(payload); },
  update: async (id, payload) => {
    const document = await Model.findById(id);
    if (!document) return null;
    validate({ ...document.toObject(), ...payload });
    Object.assign(document, payload);
    return document.save();
  },
  remove: (id) => Model.findByIdAndDelete(id),
});

export const inventoryLocationService = createService(InventoryLocation, validateInventoryLocation);
export const storageLocationService = createService(StorageLocation, validateStorageLocation, ['locationId', 'parentStorageId']);
