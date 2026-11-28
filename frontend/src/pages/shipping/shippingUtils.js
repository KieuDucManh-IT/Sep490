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
    .replace(/^(?:(?:tp|t|tt|tx|p|x|q|h)\.(?:\s*)|(?:thanh pho|tinh|thi tran|thi xa|phuong|xa|quan|huyen)\s+)/i, '')
    .replace(/[\s\-_,.]/g, '');

/**
 * Chuẩn hóa danh mục Tỉnh/Thành GHN và lọc theo phạm vi Hà Nội (fallback toàn bộ nếu không khớp)
 */
export const filterHanoiProvinces = (list = []) => {
  const normalized = (Array.isArray(list) ? list : [])
    .filter(Boolean)
    .map((p) => {
      const name = p.name || p.ProvinceName || '';
      const id = p._id ?? p.ProvinceID;
      return {
        ...p,
        _id: id,
        ProvinceID: p.ProvinceID ?? id,
        name,
        ProvinceName: p.ProvinceName || name,
      };
    });
  const hanoiOnly = normalized.filter((p) => cleanText(p.name).includes('hanoi'));
  return hanoiOnly.length > 0 ? hanoiOnly : normalized;
};

/**
 * Tự động khớp Tỉnh / Thành phố từ dữ liệu khách hàng với danh mục GHN (Hỗ trợ GHN v3 và v2)
 */
export const autoMatchProvince = (hint, fullAddr, provList) => {
  if (!Array.isArray(provList) || !provList.length) return null;
  const cHint = cleanText(hint);

  if (cHint) {
    // 1. So khớp trực tiếp theo ID (cả v3 _id và v2 ProvinceID)
    const byId = provList.find((p) => String(p._id ?? p.ProvinceID) === String(hint));
    if (byId) return byId;

    // Ánh xạ mã cũ v2 hoặc tên viết tắt phổ biến
    if (String(hint) === '201') {
      const hn = provList.find((p) => cleanText(p.name || p.ProvinceName).includes('hanoi') || String(p._id ?? p.ProvinceID) === '1000000');
      if (hn) return hn;
    }
    if (String(hint) === '202' || cHint === 'hcm' || cHint === 'tphcm') {
      const hcm = provList.find((p) => cleanText(p.name || p.ProvinceName).includes('hochiminh'));
      if (hcm) return hcm;
    }

    // 2. So khớp theo tên tỉnh (không dùng substring với gợi ý ngắn <= 2 ký tự)
    const direct = provList.find((p) => {
      const pClean = cleanText(p.ProvinceName || p.name);
      const exts = Array.isArray(p.NameExtension) ? p.NameExtension : Array.isArray(p.extension_names) ? p.extension_names : [];
      return (
        pClean === cHint ||
        (cHint.length > 2 && pClean.length > 2 && (cHint.includes(pClean) || pClean.includes(cHint))) ||
        exts.some((ext) => cleanText(ext) === cHint)
      );
    });
    if (direct) return direct;
  }

  if (fullAddr) {
    // Ưu tiên kiểm tra phân đoạn cuối (Tỉnh/Thành phố thực sự) trước khi quét tên đường
    const rawParts = String(fullAddr).split(',').map((s) => s.trim()).filter(Boolean);
    const tailCandidates = rawParts.length > 1 ? rawParts.slice(-2).reverse() : rawParts;
    for (const seg of tailCandidates) {
      const cSeg = cleanText(seg);
      if (cSeg.length <= 2) continue;
      const bySeg = provList.find((p) => {
        const pClean = cleanText(p.ProvinceName || p.name);
        return pClean.length > 2 && (cSeg === pClean || cSeg.includes(pClean));
      });
      if (bySeg) return bySeg;
    }

    const cFull = cleanText(fullAddr);
    if (cFull) {
      const byAddr = provList.find((p) => {
        const pClean = cleanText(p.ProvinceName || p.name);
        return pClean.length > 2 && cFull.includes(pClean);
      });
      if (byAddr) return byAddr;
    }
  }

  return null;
};

/**
 * Tự động khớp Phường / Xã với danh mục GHN (ưu tiên GHN WardCode/_id trước GSO GovernmentCode, chống khớp nhầm số đường)
 */
export const autoMatchWard = (wardNameHint, wardCodeHint = '', fullAddr = '', wardList = []) => {
  if (!Array.isArray(wardList) || !wardList.length) return null;

  const cHint = cleanText(wardNameHint);
  const rawCodeCandidate = String(wardCodeHint || wardNameHint || '').trim();

  // 1. Khớp trực tiếp qua WardCode / _id của GHN (cả v2 và v3) trước khi thử GSO
  if (rawCodeCandidate) {
    const targetCode = rawCodeCandidate.toLowerCase();
    const byCode = wardList.find((w) => {
      const wCode = String(w.WardCode || w._id || '').trim().toLowerCase();
      return wCode && wCode === targetCode;
    });
    if (byCode) return byCode;
  }

  // 2. Khớp qua GovernmentCode GSO chỉ khi đầu vào thuần chữ số (tránh "12 Hàng Bạc" bị parseInt -> 12)
  if (/^\d+$/.test(rawCodeCandidate)) {
    const numCode = Number(rawCodeCandidate);
    if (numCode > 0) {
      const byGov = wardList.find((w) => {
        if (!w.GovernmentCode) return false;
        return parseInt(w.GovernmentCode, 10) === numCode;
      });
      if (byGov) return byGov;
    }
  }

  // 3. Khớp chính xác tên đã chuẩn hóa
  if (cHint) {
    const exact = wardList.find((w) => cleanText(w.WardName || w.name) === cHint);
    if (exact) return exact;
  }

  // 4. Khớp qua NameExtension / extension_names của GHN (exact hoặc chuỗi dài > 2)
  if (cHint) {
    const byExt = wardList.find((w) => {
      const exts = Array.isArray(w.NameExtension) ? w.NameExtension : Array.isArray(w.extension_names) ? w.extension_names : [];
      return exts.some((ext) => {
        const extClean = cleanText(ext);
        if (!extClean) return false;
        return extClean === cHint || (cHint.length > 2 && extClean.length > 2 && extClean.includes(cHint));
      });
    });
    if (byExt) return byExt;
  }

  // 5. Khớp substring tên xã (chặt chẽ > 2 ký tự ở cả hai vế)
  if (cHint && cHint.length > 2) {
    const sub = wardList.find((w) => {
      const wClean = cleanText(w.WardName || w.name);
      return wClean.length > 2 && (wClean.includes(cHint) || cHint.includes(wClean));
    });
    if (sub) return sub;
  }

  // 6. Khớp từ chuỗi địa chỉ đầy đủ (ưu tiên phân đoạn ghi phường/xã, bỏ qua số nhà/tên đường đầu tiên)
  if (fullAddr) {
    const segments = String(fullAddr).split(',').map((s) => s.trim()).filter(Boolean);
    const wardSegs = segments.filter((seg) => /^(?:(?:phường|xã|thị trấn|phuong|xa|thi tran)\b|(?:p|x|tt)\.)/i.test(seg));
    const searchOrder = wardSegs.length > 0
      ? wardSegs
      : segments.length > 1
        ? segments.slice(1)
        : segments;

    for (const seg of searchOrder) {
      const cSeg = cleanText(seg);
      if (!cSeg) continue;
      const exactSeg = wardList.find((w) => cleanText(w.WardName || w.name) === cSeg);
      if (exactSeg) return exactSeg;
      if (cSeg.length > 3) {
        const matchSeg = wardList.find((w) => {
          const wClean = cleanText(w.WardName || w.name);
          return wClean.length > 3 && cSeg.includes(wClean);
        });
        if (matchSeg) return matchSeg;
      }
    }
  }

  return null;
};

/**
 * Trích xuất và bóc tách dữ liệu địa chỉ khách hàng từ đơn hàng
 */
export const extractOrderAddressInfo = (order) => {
  if (!order) return {};

  const customer = order.customerId || order.customerInfo || order.customer || {};
  const info = (Array.isArray(customer.Information) ? customer.Information[0] : customer.Information) || {};
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
