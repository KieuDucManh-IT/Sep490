export const currency = new Intl.NumberFormat('vi-VN');

export const isJewelry = (item) => {
  if (!item) return false;
  const text = `${item.name || ''} ${
    Array.isArray(item.category) ? item.category.join(' ') : item.category || ''
  }`.toLowerCase();
  return /nhẫn|nhan|bông tai|bong tai|khuyên|khuyen|vòng|vong|dây chuyền|day chuyen|lắc|lac|trang sức|trang suc|jewelry|earring|necklace|ring|bracelet/.test(
    text
  );
};

/**
 * Phân loại vai trò trang phục trong việc phối đồ:
 * - 'dress': Đầm, váy liền, áo dài, jumpsuit (trang phục liền thân)
 * - 'bottom': Quần, chân váy (thân dưới)
 * - 'outerwear': Áo khoác, blazer, cardigan, áo vest khoác ngoài
 * - 'top': Áo sơ mi, áo thun, polo, áo kiểu, croptop (thân trên thông thường)
 * - 'accessory': Túi xách, clutch, khăn, mũ, kính, thắt lưng, giày (phụ kiện phối)
 * - 'jewelry': Trang sức (không thử được trên mô hình VTON)
 * - 'other': Khác
 */
export const getProductGarmentRole = (item) => {
  if (!item) return 'other';
  if (isJewelry(item)) return 'jewelry';

  const text = `${item.name || ''} ${
    Array.isArray(item.category) ? item.category.join(' ') : item.category || ''
  }`.toLowerCase();

  // 1. Phụ kiện thời trang (túi xách, clutch, khăn, kính, mũ, thắt lưng, giày...)
  if (
    /túi|tui|bag|clutch|ví cầm tay|vi cam tay|khăn|khan|scarf|kính|kinh|glasses|nón|mũ|hat|cap|thắt lưng|that lung|belt|cà vạt|ca vat|tie|giày|giay|shoes|cao gót|sneaker|boot|sandal/.test(
      text
    )
  ) {
    return 'accessory';
  }

  // 2. Chân váy hoặc Quần (Lower body / Bottom)
  // Lưu ý: "chân váy" phải kiểm tra trước hoặc tách khỏi "váy liền" để không bị nhầm là đầm
  if (/quần|quan|chân váy|chan vay|skirt|pants|trouser|jean|jeans|shorts|short/.test(text)) {
    return 'bottom';
  }

  // 3. Đầm / Váy liền / Áo dài / Jumpsuit (Full-body one-piece)
  if (/đầm|dam|váy|vay|áo dài|ao dai|dress|gown|jumpsuit/.test(text)) {
    return 'dress';
  }

  // 4. Áo khoác / Blazer (Outerwear)
  if (
    /blazer|áo khoác|ao khoac|jacket|coat|măng tô|mang to|cardigan|áo vest|ao vest|áo gile|gile/.test(
      text
    )
  ) {
    return 'outerwear';
  }

  // 5. Áo thông thường (Top / Upper body)
  if (/áo sơ mi|ao so mi|sơ mi|so mi|shirt|áo thun|ao thun|t-shirt|tshirt|tee|polo|croptop|blouse|áo len|ao len|áo kiểu|ao kieu|áo hai dây|áo sát nách|áo|ao/.test(text)) {
    return 'top';
  }

  return 'other';
};

/**
 * Kiểm tra xem danh sách sản phẩm có phải là 1 BỘ PHỐI HỢP LÝ CÓ THỂ MẶC CÙNG NHAU không:
 * - KHÔNG PHẢI set phối nếu có >= 2 đầm (ví dụ: 3 mẫu đầm dạ hội khác nhau là các lựa chọn thay thế)
 * - KHÔNG PHẢI set phối nếu có >= 2 quần/chân váy hoặc >= 2 áo sơ mi/thun
 * - LÀ SET PHỐI nếu:
 *   + 1 Đầm + 1 Áo khoác ngoài (blazer)
 *   + 1 Áo (hoặc Áo khoác) + 1 Quần/Chân váy
 * (Phụ kiện túi xách/kính không tham gia ghép đồ AI, chỉ hiển thị dạng ảnh nhỏ Lookbook)
 */
export const isWearableComboSet = (products) => {
  if (!Array.isArray(products) || products.length < 2) return false;

  // Lọc bỏ phụ kiện và trang sức (chỉ xét trang phục mặc trên người)
  const valid = products.filter((p) => p && !isJewelry(p) && getProductGarmentRole(p) !== 'accessory');
  if (valid.length < 2) return false;

  // Nếu bất kỳ món đồ nào trong set không hỗ trợ thử đồ AI -> không tạo nút chuyển cả set vào thử đồ
  if (valid.some((p) => p.aiTryOn === false)) return false;

  const roleCounts = {
    dress: 0,
    top: 0,
    bottom: 0,
    outerwear: 0,
    accessory: 0,
    other: 0,
  };

  valid.forEach((p) => {
    const role = getProductGarmentRole(p);
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });

  // Nếu có từ 2 đầm trở lên -> Chắc chắn là danh sách các lựa chọn mẫu đầm khác nhau, KHÔNG PHẢI 1 set phối
  if (roleCounts.dress >= 2) return false;

  // Nếu có từ 2 quần/chân váy trở lên -> Các lựa chọn quần/váy thay thế nhau
  if (roleCounts.bottom >= 2) return false;

  // Nếu có từ 2 áo thun/sơ mi trong trở lên -> Các lựa chọn áo thay thế nhau
  if (roleCounts.top >= 2) return false;

  // Nếu có từ 2 áo khoác trở lên -> Các lựa chọn áo khoác thay thế nhau
  if (roleCounts.outerwear >= 2) return false;

  // Trường hợp 1: Có 1 Đầm / Váy liền / Áo dài
  if (roleCounts.dress === 1) {
    if (roleCounts.top > 0) return false;
    // Đầm phối cùng áo khoác ngoài (blazer) hoặc quần (áo dài)
    return roleCounts.outerwear > 0 || roleCounts.bottom > 0;
  }

  // Trường hợp 2: Không có Đầm -> Bắt buộc phải có cả phần trên (Áo hoặc Áo khoác) VÀ phần dưới (Quần hoặc Chân váy)
  const hasUpper = roleCounts.top > 0 || roleCounts.outerwear > 0;
  const hasLower = roleCounts.bottom > 0;

  return hasUpper && hasLower;
};

// Helper phân loại và tạo link chuyển set trang phục sang phòng thử đồ ảo AI IDM-VTON
export const buildTryOnUrl = (products) => {
  if (!Array.isArray(products) || products.length === 0) return '/try-on/photo';

  // Lọc bỏ trang sức và phụ kiện, và chỉ nhận sản phẩm hỗ trợ thử đồ AI
  const validProducts = products.filter((p) => p && !isJewelry(p) && getProductGarmentRole(p) !== 'accessory' && p.aiTryOn !== false);
  if (validProducts.length === 0) return '/try-on/photo';

  // Nếu chỉ có 1 món hoặc KHÔNG PHẢI là 1 set phối hợp lệ
  if (validProducts.length === 1 || !isWearableComboSet(validProducts)) {
    const singleId = validProducts[0].id || validProducts[0]._id;
    return singleId ? `/try-on/photo?productId=${singleId}` : '/try-on/photo';
  }

  // Phân bổ đúng vai trò trang phục vào các slot thử đồ
  let mainItem = null;
  let pairedItem = null;

  const dressItem = validProducts.find((p) => getProductGarmentRole(p) === 'dress');
  const topItem = validProducts.find((p) => getProductGarmentRole(p) === 'top');
  const bottomItem = validProducts.find((p) => getProductGarmentRole(p) === 'bottom');
  const outerwearItem = validProducts.find((p) => getProductGarmentRole(p) === 'outerwear');

  if (dressItem) {
    mainItem = dressItem;
    pairedItem = outerwearItem || bottomItem || null;
  } else {
    // Set 2 mảnh: Áo/Khoác + Quần/Chân váy
    mainItem = topItem || outerwearItem || null;
    pairedItem = bottomItem || null;
  }

  if (!mainItem) mainItem = validProducts[0];

  const params = new URLSearchParams();
  const mainId = mainItem.id || mainItem._id;
  if (mainId) params.set('productId', mainId);

  const pairedId = pairedItem?.id || pairedItem?._id;
  if (pairedId && pairedId !== mainId) {
    params.set('pairedId', pairedId);
  }

  return `/try-on/photo?${params.toString()}`;
};
