import { validateInput } from '../../generic/inputValidation.js';

const inventoryFields = ['code', 'name', 'type', 'address', 'maxCapacity', 'managerId', 'status'];
const inventoryRules = {
  code: { label: 'Mã vị trí', type: 'string', required: true, maxLength: 60 },
  name: { label: 'Tên vị trí', type: 'string', required: true, maxLength: 160 },
  type: { label: 'Loại vị trí', type: 'string', required: true, enum: ['warehouse', 'store'] },
  address: { label: 'Địa chỉ', type: 'string', maxLength: 500 },
  maxCapacity: { label: 'Sức chứa tối đa', type: 'number', min: 0, integer: true, nullable: true },
  managerId: { label: 'Người quản lý', type: 'objectId', nullable: true },
  status: { label: 'Trạng thái', type: 'string', enum: ['active', 'inactive'] },
};

const storageFields = ['locationId', 'parentStorageId', 'code', 'name', 'type', 'maxCapacity', 'status'];
const storageRules = {
  locationId: { label: 'Kho / cửa hàng', type: 'objectId', required: true },
  parentStorageId: { label: 'Vị trí cha', type: 'objectId', nullable: true },
  code: { label: 'Mã vị trí lưu trữ', type: 'string', required: true, maxLength: 60 },
  name: { label: 'Tên vị trí lưu trữ', type: 'string', required: true, maxLength: 160 },
  type: { label: 'Loại vị trí', type: 'string', required: true, enum: ['zone', 'row', 'shelf', 'temporary_area'] },
  maxCapacity: { label: 'Sức chứa tối đa', type: 'number', min: 0, integer: true, nullable: true },
  status: { label: 'Trạng thái', type: 'string', enum: ['active', 'inactive'] },
};

export const validateInventoryLocation = (payload, current) => validateInput(payload, current, inventoryFields, inventoryRules);
export const validateStorageLocation = (payload, current) => validateInput(payload, current, storageFields, storageRules);
