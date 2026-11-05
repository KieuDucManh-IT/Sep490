const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const objectId = (value, label) => {
  const id = String(value || '');
  if (!/^[a-f\d]{24}$/i.test(id)) throw badRequest(`${label} không hợp lệ.`);
  return id;
};
const integer = (value, label, min = 0) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min) throw badRequest(`${label} phải là số nguyên từ ${min} trở lên.`);
  return number;
};

export const validateCreateTransferRequest = (payload) => {
  if (!isObject(payload)) throw badRequest('Dữ liệu yêu cầu điều chuyển không hợp lệ.');
  const branchId = payload.branchId ? objectId(payload.branchId, 'Chi nhánh đang thao tác') : null;
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw badRequest('Thêm ít nhất một mặt hàng cần bổ sung.');
  const items = payload.items.map((item) => {
    if (!isObject(item)) throw badRequest('Dòng mặt hàng không hợp lệ.');
    return {
      variantId: objectId(item.variantId, 'Biến thể'),
      quantityRequested: integer(item.quantityRequested, 'Số lượng yêu cầu', 1),
      note: String(item.note || '').trim().slice(0, 500),
    };
  });
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.variantId)) throw badRequest('Mỗi biến thể chỉ được xuất hiện một lần trong yêu cầu.');
    seen.add(item.variantId);
  }
  return { branchId, items, note: String(payload.note || '').trim().slice(0, 1000) };
};

export const validateTransferDecision = (payload) => {
  if (!isObject(payload) || !['approve', 'reject'].includes(payload.decision)) throw badRequest('Quyết định duyệt không hợp lệ.');
  if (payload.decision === 'reject') return { decision: 'reject', note: String(payload.note || '').trim().slice(0, 1000) };
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw badRequest('Cần duyệt số lượng cho các mặt hàng.');
  const items = payload.items.map((item) => {
    if (!isObject(item)) throw badRequest('Dòng duyệt không hợp lệ.');
    return {
      detailId: objectId(item.detailId, 'Dòng điều chuyển'),
      quantityApproved: integer(item.quantityApproved, 'Số lượng duyệt'),
    };
  });
  if (new Set(items.map((item) => item.detailId)).size !== items.length) throw badRequest('Dòng duyệt bị trùng.');
  const assignedStaffId = payload.assignedStaffId ? objectId(payload.assignedStaffId, 'Nhân viên xuất kho') : null;
  if (!assignedStaffId) throw badRequest('Chọn nhân viên kho phụ trách soạn và xuất hàng.');
  return { decision: 'approve', assignedStaffId, items, note: String(payload.note || '').trim().slice(0, 1000) };
};

export const validateTransferPick = (payload) => {
  if (!isObject(payload) || !Array.isArray(payload.items) || payload.items.length === 0) throw badRequest('Cần phân bổ vị trí xuất cho ít nhất một mặt hàng.');
  const items = payload.items.map((line) => {
    if (!isObject(line) || !Array.isArray(line.allocations) || line.allocations.length === 0) throw badRequest('Mỗi dòng hàng cần có ít nhất một vị trí lấy hàng.');
    const allocations = line.allocations.map((allocation) => {
      if (!isObject(allocation)) throw badRequest('Phân bổ vị trí xuất không hợp lệ.');
      const itemIds = allocation.itemIds == null ? [] : allocation.itemIds;
      if (!Array.isArray(itemIds)) throw badRequest('Danh sách InventoryItem phải là một danh sách.');
      const normalizedItemIds = itemIds.map((id) => objectId(id, 'InventoryItem'));
      if (new Set(normalizedItemIds).size !== normalizedItemIds.length) throw badRequest('InventoryItem trong cùng một vị trí bị trùng.');
      return {
        storageId: allocation.storageId && allocation.storageId !== 'none' ? objectId(allocation.storageId, 'Vị trí xuất') : null,
        quantity: integer(allocation.quantity, 'Số lượng phân bổ', 1),
        itemIds: normalizedItemIds,
      };
    });
    const storageKeys = allocations.map((allocation) => String(allocation.storageId || 'none'));
    if (new Set(storageKeys).size !== storageKeys.length) throw badRequest('Mỗi vị trí chỉ được phân bổ một lần cho một mặt hàng; hãy gộp số lượng cùng vị trí.');
    const allItemIds = allocations.flatMap((allocation) => allocation.itemIds);
    if (new Set(allItemIds).size !== allItemIds.length) throw badRequest('Không thể phân bổ cùng một InventoryItem ở nhiều vị trí.');
    return { detailId: objectId(line.detailId, 'Dòng điều chuyển'), allocations };
  });
  if (new Set(items.map((item) => item.detailId)).size !== items.length) throw badRequest('Dòng phân bổ bị trùng.');
  return { items };
};

export const validateTransferReceipt = (payload) => {
  if (!isObject(payload) || !Array.isArray(payload.items) || payload.items.length === 0) throw badRequest('Thêm số lượng thực nhận cho phiếu.');
  const items = payload.items.map((item) => {
    if (!isObject(item)) throw badRequest('Dòng nhận hàng không hợp lệ.');
    const receivedItemIds = item.receivedItemIds == null ? [] : item.receivedItemIds;
    const damagedItemIds = item.damagedItemIds == null ? [] : item.damagedItemIds;
    if (!Array.isArray(receivedItemIds) || !Array.isArray(damagedItemIds)) throw badRequest('Danh sách mã hàng cá thể không hợp lệ.');
    return {
      detailId: objectId(item.detailId, 'Dòng điều chuyển'),
      quantityReceived: integer(item.quantityReceived, 'Số lượng thực nhận'),
      quantityDamaged: integer(item.quantityDamaged || 0, 'Số lượng hư hỏng'),
      receivedItemIds: receivedItemIds.map((id) => objectId(id, 'Mã hàng cá thể')),
      damagedItemIds: damagedItemIds.map((id) => objectId(id, 'Mã hàng hư hỏng')),
    };
  });
  if (new Set(items.map((item) => item.detailId)).size !== items.length) throw badRequest('Dòng nhận hàng bị trùng.');
  return { items, complete: payload.complete !== false, note: String(payload.note || '').trim().slice(0, 1000) };
};
