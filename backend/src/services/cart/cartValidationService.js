import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { availableFromBalances } from '../warehouse/orderStockService.js';
import { isActiveStoreLocation, formatLocationAddress } from '../warehouse/productInventoryHelper.js';
import { resolveProductPricing, isActiveProduct, isActiveVariant } from '../masterdata/productPricing.js';
import { validateCalendarRentalRange } from '../../validations/sale&rental/rentalOrderValidation.js';
const idOf = (v) => String(v?._id || v || '');

/** Read-only quote; no reservations or business data writes.
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-019
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-028
 */
export const validateCartState = async ({ locationId = null, rentalItems = [], saleItems = [] }) => {
  const input = [...rentalItems.map(it => ({ ...it, orderType: 'rental' })), ...saleItems.map(it => ({ ...it, orderType: 'sale' }))];
  const [locations, variants] = await Promise.all([
    InventoryLocation.find({ status: 'active' }).populate('shopId').lean(),
    ProductVariant.find({ _id: { $in: input.map(it => it.variantId) } }).populate('productId').lean(),
  ]);
  const activeLocations = locations.filter(isActiveStoreLocation);
  const selected = locations.find(loc => idOf(loc) === String(locationId));
  const location = locationId ? { locationId: String(locationId), name: selected?.name || '', address: formatLocationAddress(selected), type: selected?.type || '', active: isActiveStoreLocation(selected) } : null;
  const siblings = await ProductVariant.find({ productId: { $in: variants.map(v => v.productId?._id).filter(Boolean) }, status: 'active', isDeleted: { $ne: true } }).lean();
  const ids = [...new Set([...variants, ...siblings].map(v => idOf(v)))];
  // TASK-010: chỉ đọc balance cho mọi loại hàng (bỏ fallback đếm món).
  const balances = await InventoryBalance.find({ variantId: { $in: ids } }).lean();
  const stock = (vid, lid) => availableFromBalances(balances.filter(row => idOf(row.variantId) === vid && idOf(row.locationId) === lid));
  const totals = new Map();
  for (const row of input) totals.set(String(row.variantId), (totals.get(String(row.variantId)) || 0) + row.quantity);
  const summary = { rentalFeeSubtotal: 0, depositSubtotal: 0, saleSubtotal: 0, grandTotal: 0 };
  const resultItems = input.map(it => {
    const variant = variants.find(v => idOf(v) === String(it.variantId));
    const product = variant?.productId;
    const errors = []; const warnings = [];
    const fail = (code, message) => errors.push({ code, message });
    const total = totals.get(String(it.variantId));
    const availableQty = locationId ? (location?.active ? stock(String(it.variantId), String(locationId)) : 0)
      : activeLocations.reduce((sum, loc) => sum + stock(String(it.variantId), idOf(loc)), 0);
    if (!variant || !product?._id) fail('ERR_ITEM_NOT_FOUND', 'Sản phẩm không còn tồn tại.');
    else if (!isActiveVariant(variant) || !isActiveProduct(product)) fail('ERR_ITEM_INACTIVE', 'Sản phẩm đã ngừng kinh doanh.');
    else if (product.isSetPrice !== true) fail('ERR_ITEM_NOT_PRICED', `Sản phẩm [${product.name || variant.sku}] chưa được mở bán.`);
    if (product && (it.orderType === 'sale' ? String(product.tag).toLowerCase() === 'rental' : String(product.tag).toLowerCase() === 'sale')) fail('ERR_ITEM_TYPE_MISMATCH', 'Sản phẩm không hỗ trợ hình thức giao dịch này.');
    if (location && !location.active) fail('ERR_BRANCH_UNAVAILABLE', 'Chi nhánh không khả dụng.');
    if (availableQty < total) fail('ERR_INSUFFICIENT_STOCK', `Chỉ còn ${availableQty} sản phẩm, giỏ đang yêu cầu ${total}.`);
    const prices = resolveProductPricing(product, variant);
    let authoritative = null;
    let priceChanged = false;
    if (variant && product?._id) {
      if (it.orderType === 'sale') {
        if (!Number.isFinite(prices.salePrice) || prices.salePrice <= 0) fail('ERR_INVALID_PRICE', 'Giá bán chưa hợp lệ.');
        else {
          authoritative = { salePrice: prices.salePrice, lineTotal: prices.salePrice * it.quantity, lineDeposit: 0 };
          priceChanged = it.clientSalePrice !== undefined && it.clientSalePrice !== prices.salePrice;
          summary.saleSubtotal += authoritative.lineTotal;
        }
      } else {
        const range = validateCalendarRentalRange(it.startDate, it.dueDate);
        if (!range.valid) fail(range.code, range.message);
        if (!Number.isFinite(prices.rentalPricePerDay) || prices.rentalPricePerDay <= 0 || !Number.isFinite(prices.deposit) || prices.deposit < 0) fail('ERR_INVALID_PRICE', 'Giá thuê hoặc tiền cọc chưa hợp lệ.');
        else if (range.valid) {
          authoritative = { rentalPricePerDay: prices.rentalPricePerDay, depositPerUnit: prices.deposit, rentalDays: range.rentalDays,
            lineTotal: prices.rentalPricePerDay * range.rentalDays * it.quantity, lineDeposit: prices.deposit * it.quantity };
          priceChanged = (it.clientRentalPricePerDay !== undefined && it.clientRentalPricePerDay !== prices.rentalPricePerDay) ||
            (it.clientDepositPerUnit !== undefined && it.clientDepositPerUnit !== prices.deposit);
          summary.rentalFeeSubtotal += authoritative.lineTotal; summary.depositSubtotal += authoritative.lineDeposit;
        }
      }
    }
    if (priceChanged) warnings.push({ code: 'ERR_INVALID_PRICE', message: 'Giá đã thay đổi. Vui lòng xác nhận tổng tiền mới.' });
    const alternativeBranches = activeLocations.filter(loc => idOf(loc) !== String(locationId) && stock(String(it.variantId), idOf(loc)) >= total)
      .map(loc => ({ locationId: idOf(loc), name: loc.name, address: formatLocationAddress(loc), availableQty: stock(String(it.variantId), idOf(loc)) }));
    const alternativeVariants = errors.length ? siblings.filter(v => idOf(v) !== String(it.variantId) && idOf(v.productId) === idOf(product) && isActiveVariant(v))
      .flatMap(v => activeLocations.filter(loc => (!locationId || idOf(loc) === String(locationId)) && stock(idOf(v), idOf(loc)) >= total)
        .map(loc => ({ variantId: idOf(v), sku: v.sku, size: v.size, color: v.color, availableQty: stock(idOf(v), idOf(loc)), locationId: idOf(loc), locationName: loc.name }))) : [];
    return { cartItemId: it.cartItemId, orderType: it.orderType, productId: product?._id ? idOf(product) : null,
      variantId: String(it.variantId), sku: variant?.sku || null, name: product?.name || null, size: variant?.size || null, color: variant?.color || null,
      requestedQuantity: it.quantity, aggregatedRequestedQuantity: total, availableQty, valid: !errors.length, priceChanged,
      errors, warnings, authoritative, alternativeBranches, alternativeVariants };
  });
  summary.grandTotal = summary.rentalFeeSubtotal + summary.depositSubtotal + summary.saleSubtotal;
  const flatten = (key) => resultItems.flatMap(it => it[key].map(e => ({ ...e, cartItemId: it.cartItemId, variantId: it.variantId, orderType: it.orderType })));
  return { valid: resultItems.every(it => it.valid), hasPriceChanges: resultItems.some(it => it.priceChanged), checkedAt: new Date().toISOString(), location, items: resultItems, summary, errors: flatten('errors'), warnings: flatten('warnings') };
};
