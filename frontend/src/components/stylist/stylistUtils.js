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

// Helper phân loại và tạo link chuyển cả set đồ sang phòng thử đồ ảo AI IDM-VTON (đã lọc sạch trang sức)
export const buildTryOnUrl = (products) => {
  if (!Array.isArray(products) || products.length === 0) return '/try-on/photo';

  // Lọc bỏ trang sức
  const validProducts = products.filter((p) => !isJewelry(p));
  if (validProducts.length === 0) return '/try-on/photo';
  if (validProducts.length === 1) return `/try-on/photo?productId=${validProducts[0].id}`;

  let mainItem = null;
  let pairedItem = null;
  let accessoryItem = null;

  for (const p of validProducts) {
    const catStr = `${p.name || ''} ${
      Array.isArray(p.category) ? p.category.join(' ') : p.category || ''
    }`.toLowerCase();
    // Phụ kiện chỉ nhận túi xách, kính, khăn, mũ... (không nhận trang sức)
    if (/túi|tui|bag|kính|kinh|glasses|khăn|clutch|nón|mũ|hat|giày|shoes/.test(catStr) && !accessoryItem) {
      accessoryItem = p;
    } else if (/quần|quan|chân váy|skirt|pants|trouser|short/.test(catStr) && !pairedItem) {
      pairedItem = p;
    } else if (/đầm|dam|váy|vay|áo dài|ao dai|dress|suit|blazer|áo|ao/.test(catStr) && !mainItem) {
      mainItem = p;
    }
  }

  // Phân bổ các món còn lại đảm bảo không trùng nhau
  for (const p of validProducts) {
    if (mainItem?.id === p.id || pairedItem?.id === p.id || accessoryItem?.id === p.id) continue;
    if (!mainItem) {
      mainItem = p;
    } else if (!pairedItem) {
      pairedItem = p;
    } else if (!accessoryItem) {
      accessoryItem = p;
    }
  }

  if (!mainItem) mainItem = validProducts[0];

  const params = new URLSearchParams();
  if (mainItem?.id) params.set('productId', mainItem.id);
  if (pairedItem?.id && pairedItem.id !== mainItem.id) params.set('pairedId', pairedItem.id);
  if (accessoryItem?.id && accessoryItem.id !== mainItem.id && accessoryItem.id !== pairedItem?.id) {
    params.set('accessoryId', accessoryItem.id);
  }

  return `/try-on/photo?${params.toString()}`;
};
