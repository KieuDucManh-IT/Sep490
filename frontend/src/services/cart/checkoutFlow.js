import { validateCart } from './cartValidationApi';
import { validateRentalDates } from './cartCalculations';

export function groupCheckoutItems(items, includeDates = true) {
  const groups = new Map();
  for (const item of items) {
    const locationId = item.selectedBranch?.locationId;
    if (!/^[a-fA-F0-9]{24}$/.test(String(locationId || '')) || !/^[a-fA-F0-9]{24}$/.test(String(item.variantId || ''))) throw new Error(`Vui lòng chọn lại biến thể và chi nhánh cho ${item.name}.`);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error(`Số lượng của ${item.name} không hợp lệ.`);
    if (item.orderType === 'rental') {
      const dates = validateRentalDates(item.startDate, item.dueDate);
      if (!dates.isValid) throw new Error(dates.errorMessage);
    }
    const key = `${locationId}|${includeDates ? item.orderType : ''}|${includeDates && item.orderType === 'rental' ? `${item.startDate}|${item.dueDate}` : ''}`;
    if (!groups.has(key)) groups.set(key, { locationId, startDate: item.startDate, dueDate: item.dueDate, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}

/** @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-028 */
export async function quoteCheckout(items) {
  const rows = []; const errors = [];
  // Aggregate every selected date range at the branch, matching current reservation semantics.
  for (const group of groupCheckoutItems(items, false)) {
    const payload = { locationId: group.locationId, rentalItems: [], saleItems: [] };
    for (const it of group.items) {
      const row = { cartItemId: it.cartItemId, variantId: it.variantId, quantity: it.quantity };
      if (it.orderType === 'rental') payload.rentalItems.push({ ...row, startDate: it.startDate, dueDate: it.dueDate,
        clientRentalPricePerDay: it.rentalPricePerDay, clientDepositPerUnit: it.depositAmount });
      else payload.saleItems.push({ ...row, clientSalePrice: it.salePrice });
    }
    const res = await validateCart(payload);
    if (!res?.success || !Array.isArray(res.data?.items) || res.data.items.length !== group.items.length) throw new Error('Không thể xác minh báo giá. Vui lòng thử lại.');
    rows.push(...res.data.items);
    errors.push(...(res.data.errors || []).map(e => e.message));
    if (!res.data.valid && !res.data.errors?.length) errors.push('Một số sản phẩm không còn khả dụng.');
  }
  return { rows, valid: !errors.length, errors, changed: rows.some(row => row.priceChanged) };
}

export const checkoutFingerprint = items => JSON.stringify(items.map(it => [it.cartItemId, it.variantId, it.quantity, it.selectedBranch?.locationId, it.startDate, it.dueDate, it.salePrice, it.rentalPricePerDay, it.depositAmount]));
const ATTEMPT_KEY = 'vestora_checkout_pending_v1';
const readAttempts = () => {
  const value = JSON.parse(localStorage.getItem(ATTEMPT_KEY) || '[]');
  return Array.isArray(value) ? value : value ? [value] : [];
};
const writeAttempts = attempts => {
  if (attempts.length) localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempts));
  else localStorage.removeItem(ATTEMPT_KEY);
};
export function pendingCheckout(items) {
  try {
    return readAttempts().find(pending => pending.cartItemIds?.some(id => items.some(it => it.cartItemId === id))) || null;
  } catch { return { unknown: true }; }
}
// Called only after the customer explicitly confirms checking order history.
export function acknowledgeCheckoutHistory(items) {
  writeAttempts(readAttempts().filter(pending => !pending.cartItemIds?.some(id => items.some(it => it.cartItemId === id))));
}
export const uncertainMessage = 'Chưa xác định được kết quả đặt đơn. Vui lòng kiểm tra lịch sử đơn hàng trước khi đặt lại các sản phẩm này.';

/** @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-030 */
export async function submitCheckoutGroups(groups, createOrder, onCreated) {
  const allItems = groups.flatMap(g => g.items);
  if (pendingCheckout(allItems)) throw new Error(uncertainMessage);
  const orders = [];
  for (const group of groups) {
    // Persist before sending: refresh after a timeout must not silently resubmit this group.
    const attempt = { cartItemIds: group.items.map(it => it.cartItemId), startedAt: new Date().toISOString() };
    const attemptIds = new Set(attempt.cartItemIds);
    const clearAttempt = () => writeAttempts(readAttempts().filter(row => !row.cartItemIds?.some(id => attemptIds.has(id))));
    writeAttempts([...readAttempts(), attempt]);
    try {
      const res = await createOrder(group);
      const order = res?.data;
      if (res?.success === false || !order?._id) throw new Error(uncertainMessage);
      orders.push(order);
      onCreated(group, order);
      clearAttempt();
    } catch (error) {
      const definiteRejection = error.status >= 400 && error.status < 500 && error.status !== 408;
      if (definiteRejection) clearAttempt();
      const failure = new Error(definiteRejection ? error.message : uncertainMessage);
      failure.orders = orders;
      failure.uncertain = !definiteRejection;
      throw failure;
    }
  }
  return orders;
}
