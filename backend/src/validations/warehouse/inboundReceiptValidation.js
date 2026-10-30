const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });
const isObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const isQuantity = (value) => Number.isInteger(value) && value >= 0;

export const validateCreateInboundReceipt = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw badRequest('Dữ liệu phiếu nhập không hợp lệ.');
  if (!isObjectId(payload.locationId)) throw badRequest('Kho/cửa hàng không hợp lệ.');
  if (!isObjectId(payload.supplierId)) throw badRequest('Nhà cung cấp không hợp lệ.');
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw badRequest('Phiếu nhập cần ít nhất một mặt hàng.');
  if (!isObjectId(payload.assignedStaffId)) throw badRequest('Cần chỉ định một nhân viên kho để xử lý phiếu.');
  if (payload.items.some((item) => !item || !isObjectId(item.variantId) || !isQuantity(item.quantityExpected) || item.quantityExpected === 0 || !Number.isFinite(item.unitCost) || item.unitCost < 0)) {
    throw badRequest('Mỗi mặt hàng cần biến thể hợp lệ, số lượng nguyên dương và giá nhập không âm.');
  }
  if (payload.items.length > 200) throw badRequest('Phiếu nhập không được vượt quá 200 dòng hàng.');
  if (payload.note != null && (typeof payload.note !== 'string' || payload.note.length > 1000)) throw badRequest('Ghi chú không hợp lệ.');
  return {
    locationId: payload.locationId,
    supplierId: payload.supplierId,
    assignedStaffId: payload.assignedStaffId,
    items: payload.items.map(({ variantId, quantityExpected, unitCost }) => ({ variantId, quantityExpected, unitCost })),
    note: String(payload.note || '').trim(),
  };
};

export const validateReceiptCheck = (payload, detailIds) => {
  if (!Array.isArray(payload?.items) || payload.items.length !== detailIds.length) throw badRequest('Cần ghi nhận đầy đủ tất cả dòng hàng của phiếu.');
  const seen = new Set();
  const items = payload.items.map((item) => {
    if (!isObjectId(item?.detailId) || !detailIds.includes(item.detailId) || seen.has(item.detailId)) throw badRequest('Dòng hàng ghi nhận không hợp lệ hoặc bị lặp.');
    if (!isQuantity(item.quantityReceived) || !isQuantity(item.quantityDamaged) || item.quantityDamaged > item.quantityReceived) throw badRequest('Số lượng nhận/hỏng không hợp lệ; hàng hỏng không thể lớn hơn số lượng nhận.');
    if (item.note != null && (typeof item.note !== 'string' || item.note.length > 500)) throw badRequest('Ghi chú dòng hàng không hợp lệ.');
    seen.add(item.detailId);
    return { detailId: item.detailId, quantityReceived: item.quantityReceived, quantityDamaged: item.quantityDamaged, note: String(item.note || '').trim() };
  });
  return items;
};

export const validatePutaway = (payload, detailIds) => {
  if (!Array.isArray(payload?.items) || payload.items.length !== detailIds.length) throw badRequest('Cần phân bổ đầy đủ tất cả dòng hàng của phiếu.');
  const seen = new Set();
  return payload.items.map((item) => {
    if (!isObjectId(item?.detailId) || !detailIds.includes(item.detailId) || seen.has(item.detailId)) throw badRequest('Dòng hàng phân bổ không hợp lệ hoặc bị lặp.');
    if (!Array.isArray(item.allocations)) throw badRequest('Mỗi dòng hàng cần có danh sách vị trí phân bổ.');
    const seenStorage = new Set();
    const allocations = item.allocations.map((allocation) => {
      if (!isObjectId(allocation?.storageId) || !isQuantity(allocation.quantity) || allocation.quantity === 0 || seenStorage.has(allocation.storageId)) {
        throw badRequest('Mỗi phân bổ cần một shelf hợp lệ, số lượng nguyên dương và không được lặp shelf.');
      }
      seenStorage.add(allocation.storageId);
      return { storageId: allocation.storageId, quantity: allocation.quantity };
    });
    seen.add(item.detailId);
    return { detailId: item.detailId, allocations };
  });
};
