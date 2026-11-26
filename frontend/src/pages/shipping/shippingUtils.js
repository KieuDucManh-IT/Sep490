export const SHIPMENT_STATUS_MAP = {
  pending_confirmation: { text: 'Chờ xác nhận', chipClass: 'pending', color: 'secondary' },
  preparing: { text: 'Chờ lấy hàng', chipClass: 'confirmed', color: 'warning' },
  shipped: { text: 'Đang giao hàng', chipClass: 'processing', color: 'primary' },
  delivered: { text: 'Giao thành công', chipClass: 'completed', color: 'success' },
  failed: { text: 'Giao thất bại', chipClass: 'cancelled', color: 'danger' },
  cancelled: { text: 'Đã hủy', chipClass: 'cancelled', color: 'secondary' },
};

export const formatCurrency = (val) => {
  const num = Number(val || 0);
  const formatted = new Intl.NumberFormat('vi-VN').format(isNaN(num) ? 0 : num);
  return `${formatted} VND`;
};

/**
 * Format date in standard friendly Vietnamese format
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const sanitizeTimelineText = (text) => {
  if (!text) return 'Cập nhật tiến trình';
  return String(text)
    .replace(/\s*\(Cập nhật trạng thái vận chuyển qua Sandbox\)/gi, '')
    .replace(/\s*\(Sandbox\)/gi, '')
    .replace(/trên Shop (ID )?\d+/gi, 'tại cửa hàng')
    .replace(/sang Shop (ID )?\d+/gi, 'sang thông tin mới')
    .trim();
};

/**
 * Chuẩn hóa chuỗi tiếng Việt phục vụ so khớp danh mục hành chính GHN
 */
export const cleanText = (str) =>
  String(str || '')
    .replace(/đ/gi, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(tp\.|t\.|thanh pho|tinh|thi tran|tt\.|phuong|p\.|xa|x\.|quan|q\.|huyen|h\.)\s+/i, '')
    .replace(/[\s\-_,.]/g, '');

/**
 * Tự động khớp Tỉnh / Thành phố từ dữ liệu khách hàng với danh mục GHN (Hỗ trợ GHN v3 và v2)
 */
export const autoMatchProvince = (hint, fullAddr, provList) => {
  if (!Array.isArray(provList) || !provList.length) return null;
  const cHint = cleanText(hint);
  const cFull = cleanText(fullAddr);

  if (cHint) {
    // 1. So khớp trực tiếp theo ID (cả v3 _id và v2 ProvinceID)
    const byId = provList.find((p) => String(p._id || p.ProvinceID) === String(hint));
    if (byId) return byId;

    // Ánh xạ mã cũ v2 sang v3 (201 -> Hà Nội, 202 -> TP.HCM)
    if (String(hint) === '201') {
      const hn = provList.find((p) => cleanText(p.name || p.ProvinceName).includes('hanoi') || String(p._id || p.ProvinceID) === '1000000');
      if (hn) return hn;
    }
    if (String(hint) === '202') {
      const hcm = provList.find((p) => cleanText(p.name || p.ProvinceName).includes('hochiminh'));
      if (hcm) return hcm;
    }

    // 2. So khớp theo tên tỉnh
    const direct = provList.find((p) => {
      const pClean = cleanText(p.ProvinceName || p.name);
      const exts = Array.isArray(p.NameExtension) ? p.NameExtension : Array.isArray(p.extension_names) ? p.extension_names : [];
      return (
        pClean === cHint ||
        cHint.includes(pClean) ||
        pClean.includes(cHint) ||
        exts.some((ext) => cleanText(ext) === cHint)
      );
    });
    if (direct) return direct;
  }

  if (cFull) {
    const byAddr = provList.find((p) => {
      const pClean = cleanText(p.ProvinceName || p.name);
      return pClean.length > 2 && cFull.includes(pClean);
    });
    if (byAddr) return byAddr;
  }

  return null;
};

/**
 * Tự động khớp Phường / Xã với danh mục GHN (hỗ trợ GSO GovernmentCode, GHN WardCode / _id, NameExtension / extension_names)
 */
export const autoMatchWard = (wardNameHint, wardCodeHint = '', fullAddr = '', wardList = []) => {
  if (!Array.isArray(wardList) || !wardList.length) return null;

  const cHint = cleanText(wardNameHint);
  const cFull = cleanText(fullAddr);
  const numCode = parseInt(wardCodeHint || wardNameHint, 10);

  // 1. Khớp chính xác qua GovernmentCode (Mã Tổng cục Thống kê GSO từ open-api)
  if (!isNaN(numCode) && numCode > 0) {
    const byGov = wardList.find((w) => {
      if (!w.GovernmentCode) return false;
      return parseInt(w.GovernmentCode, 10) === numCode;
    });
    if (byGov) return byGov;
  }

  // 2. Khớp trực tiếp qua WardCode / _id của GHN (cả v2 và v3)
  if (wardCodeHint || wardNameHint) {
    const targetCode = String(wardCodeHint || wardNameHint).trim().toLowerCase();
    const byCode = wardList.find((w) => {
      const wCode = String(w.WardCode || w._id || '').trim().toLowerCase();
      return wCode && wCode === targetCode;
    });
    if (byCode) return byCode;
  }

  // 3. Khớp chính xác tên đã chuẩn hóa
  if (cHint) {
    const exact = wardList.find((w) => cleanText(w.WardName || w.name) === cHint);
    if (exact) return exact;
  }

  // 4. Khớp qua NameExtension / extension_names của GHN
  if (cHint) {
    const byExt = wardList.find((w) => {
      const exts = Array.isArray(w.NameExtension) ? w.NameExtension : Array.isArray(w.extension_names) ? w.extension_names : [];
      return exts.some((ext) => cleanText(ext) === cHint || cleanText(ext).includes(cHint));
    });
    if (byExt) return byExt;
  }

  // 5. Khớp substring tên xã
  if (cHint && cHint.length > 2) {
    const sub = wardList.find((w) => {
      const wClean = cleanText(w.WardName || w.name);
      return wClean.includes(cHint) || cHint.includes(wClean);
    });
    if (sub) return sub;
  }

  // 6. Khớp từ chuỗi địa chỉ đầy đủ
  if (cFull) {
    const byAddr = wardList.find((w) => {
      const wClean = cleanText(w.WardName || w.name);
      return wClean.length > 3 && cFull.includes(wClean);
    });
    if (byAddr) return byAddr;
  }

  return null;
};

/**
 * Trích xuất và bóc tách dữ liệu địa chỉ khách hàng từ đơn hàng
 */
export const extractOrderAddressInfo = (order) => {
  if (!order) return {};

  const customer = order.customerId || order.customerInfo || order.customer || {};
  const info = Array.isArray(customer.Information) ? customer.Information[0] : (customer.Information || {});
  const shipAddr = order.shippingAddress || {};

  const receiverName =
    shipAddr.receiverName ||
    shipAddr.toName ||
    shipAddr.name ||
    customer.FullName ||
    customer.fullName ||
    customer.name ||
    '';

  const receiverPhone =
    shipAddr.phone ||
    shipAddr.toPhone ||
    info.Phone ||
    customer.phone ||
    customer.Phone ||
    '';

  const provHint =
    shipAddr.city ||
    shipAddr.province ||
    shipAddr.provinceName ||
    info.ProvinceName ||
    info.ProvinceCode ||
    '';

  const wardHint =
    shipAddr.ward ||
    shipAddr.wardName ||
    info.WardName ||
    '';

  const wardCodeHint =
    shipAddr.wardCode ||
    info.WardCode ||
    '';

  const districtHint =
    shipAddr.district ||
    shipAddr.districtName ||
    info.DistrictName ||
    '';

  const detailedAddress =
    shipAddr.street ||
    shipAddr.address ||
    info.AddressDetail ||
    customer.address ||
    '';

  const fullAddr = [detailedAddress, wardHint, districtHint, provHint].filter(Boolean).join(', ');

  return {
    receiverName,
    receiverPhone: String(receiverPhone || '').trim(),
    detailedAddress,
    provHint,
    districtHint,
    wardHint,
    wardCodeHint,
    provinceIdHint: shipAddr.provinceId || null,
    districtIdHint: shipAddr.districtId || null,
    provinceNameHint: shipAddr.city || shipAddr.province || shipAddr.provinceName || '',
    districtNameHint: districtHint,
    wardNameHint: shipAddr.ward || shipAddr.wardName || '',
    isNewAddress: Boolean(shipAddr.isNewAddress || (shipAddr.provinceId && Number(shipAddr.provinceId) >= 1000000)),
    fullAddr,
  };
};

/** Chuẩn hóa danh sách món hiển thị trong card vận đơn (kết hợp snapshot & chi tiết đơn) */
export const normalizeShipmentDisplayItems = (items = [], orderItems = []) => {
  const list = Array.isArray(items) ? items : [];
  const orderList = Array.isArray(orderItems) ? orderItems : [];

  return list.map((it, i) => {
    const matched = orderList.find(
      (oi) =>
        (it.salesOrderDetailId && String(oi._id) === String(it.salesOrderDetailId)) ||
        (it.rentalOrderDetailId && String(oi._id) === String(it.rentalOrderDetailId)) ||
        (it.sku && (oi.variantId?.sku === it.sku || oi.sku === it.sku))
    );
    const v = it.variantId || matched?.variantId;
    return {
      name: it.name || it.productName || v?.productId?.name || v?.variantName || `Sản phẩm #${i + 1}`,
      size: it.size || v?.size || '',
      color: it.color || v?.color || '',
      sku: it.sku || v?.sku || '',
      quantity: it.quantity || it.quantityReturned || 1,
    };
  });
};
