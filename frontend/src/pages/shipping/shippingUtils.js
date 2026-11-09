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
 * Tự động khớp Tỉnh / Thành phố từ dữ liệu khách hàng với danh mục GHN
 */
export const autoMatchProvince = (hint, fullAddr, provList) => {
  if (!Array.isArray(provList) || !provList.length) return null;
  const cHint = cleanText(hint);
  const cFull = cleanText(fullAddr);

  if (cHint) {
    const direct = provList.find((p) => {
      const pClean = cleanText(p.ProvinceName);
      return (
        pClean === cHint ||
        cHint.includes(pClean) ||
        pClean.includes(cHint) ||
        String(p.ProvinceID) === String(hint) ||
        (Array.isArray(p.NameExtension) && p.NameExtension.some((ext) => cleanText(ext) === cHint))
      );
    });
    if (direct) return direct;
  }

  if (cFull) {
    const byAddr = provList.find((p) => {
      const pClean = cleanText(p.ProvinceName);
      return pClean.length > 2 && cFull.includes(pClean);
    });
    if (byAddr) return byAddr;
  }

  return null;
};

/**
 * Từ điển các danh xưng địa lý đặc thù / chuyển đổi tên hành chính
 */
export const WARD_ALIASES = {
  hoalac: ['thachhoa', 'tanxa', 'binhyen', 'dongtruc'],
  thachhoa: ['hoalac'],
  khucnchoalac: ['thachhoa'],
  fpt: ['thachhoa'],
  thachthat: ['thachhoa', 'lienquan'],
};

/**
 * Tự động khớp Phường / Xã với danh mục GHN (hỗ trợ GSO GovernmentCode, GHN WardCode, NameExtension, Aliases)
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

  // 2. Khớp trực tiếp qua WardCode của GHN
  if (wardCodeHint || wardNameHint) {
    const targetCode = String(wardCodeHint || wardNameHint).trim().toLowerCase();
    const byCode = wardList.find((w) => String(w.WardCode).trim().toLowerCase() === targetCode);
    if (byCode) return byCode;
  }

  // 3. Khớp chính xác tên đã chuẩn hóa
  if (cHint) {
    const exact = wardList.find((w) => cleanText(w.WardName) === cHint);
    if (exact) return exact;
  }

  // 4. Khớp qua NameExtension của GHN
  if (cHint) {
    const byExt = wardList.find((w) => {
      if (!Array.isArray(w.NameExtension)) return false;
      return w.NameExtension.some((ext) => cleanText(ext) === cHint || cleanText(ext).includes(cHint));
    });
    if (byExt) return byExt;
  }

  // 5. Khớp qua từ điển danh pháp / khu vực đặc thù (VD: Hòa Lạc -> Thạch Hòa)
  if (cHint || cFull) {
    for (const [aliasKey, targetList] of Object.entries(WARD_ALIASES)) {
      if (cHint.includes(aliasKey) || cFull.includes(aliasKey)) {
        for (const target of targetList) {
          const byAlias = wardList.find((w) => {
            const wClean = cleanText(w.WardName);
            return wClean === target || wClean.includes(target) || target.includes(wClean);
          });
          if (byAlias) return byAlias;
        }
      }
    }
  }

  // 6. Khớp substring tên xã
  if (cHint && cHint.length > 2) {
    const sub = wardList.find((w) => {
      const wClean = cleanText(w.WardName);
      return wClean.includes(cHint) || cHint.includes(wClean);
    });
    if (sub) return sub;
  }

  // 7. Khớp từ chuỗi địa chỉ đầy đủ
  if (cFull) {
    const byAddr = wardList.find((w) => {
      const wClean = cleanText(w.WardName);
      return wClean.length > 3 && cFull.includes(wClean);
    });
    if (byAddr) return byAddr;
  }

  return null;
};

/**
 * Trích xuất và bóc tách thông minh dữ liệu địa chỉ khách hàng từ đơn hàng
 * Tách biệt rõ ràng Số nhà/Đường chi tiết (toAddress) và Phường/Xã (toWardCode)
 */
export const extractOrderAddressInfo = (order) => {
  if (!order) return {};

  const customer = order.customerId || order.customerInfo || order.customer || {};
  const info = Array.isArray(customer.Information) ? customer.Information[0] : (customer.Information || {});
  const shipAddr = order.shippingAddress || {};

  // 1. Tên người nhận
  let receiverName =
    shipAddr.receiverName ||
    shipAddr.toName ||
    shipAddr.name ||
    customer.FullName ||
    customer.fullName ||
    customer.name ||
    '';

  // 2. Số điện thoại nhận hàng
  let receiverPhone =
    shipAddr.phone ||
    shipAddr.toPhone ||
    info.Phone ||
    customer.phone ||
    customer.Phone ||
    '';

  // 3. Bóc tách note nếu có định dạng [Giao tận nơi: Name - Phone - FullAddress]
  let noteAddr = '';
  if (order.note) {
    const match = order.note.match(/\[Giao tận nơi:\s*([^-]+?)\s*-\s*([^-]+?)\s*-\s*([^\]]+)\]/);
    if (match) {
      if (!shipAddr.receiverName && !customer.FullName) receiverName = match[1].trim();
      if (!shipAddr.phone && !info.Phone) receiverPhone = match[2].trim();
      noteAddr = match[3].trim();
    }
  }

  // 4. Gợi ý Tỉnh / Thành
  let provHint =
    shipAddr.city ||
    shipAddr.province ||
    shipAddr.provinceName ||
    info.ProvinceName ||
    info.ProvinceCode ||
    '';

  // 5. Gợi ý Phường / Xã
  let wardHint =
    shipAddr.ward ||
    shipAddr.wardName ||
    info.WardName ||
    '';

  let wardCodeHint =
    shipAddr.wardCode ||
    info.WardCode ||
    '';

  // 6. Bóc tách địa chỉ chi tiết (Số nhà, tên đường)
  let rawStreet = shipAddr.street || shipAddr.address || '';
  if (!rawStreet && info.AddressDetail) {
    rawStreet = info.AddressDetail;
  }
  if (!rawStreet && noteAddr) {
    const parts = noteAddr.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) rawStreet = parts[0];
  }
  if (!rawStreet && info.Address) {
    const parts = info.Address.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) rawStreet = parts[0];
  }

  const cWard = cleanText(wardHint);
  const cProv = cleanText(provHint);

  let detailedAddress = rawStreet;

  // Nếu detailedAddress có dấu phẩy: loại bỏ các đoạn trùng với xã hoặc tỉnh
  if (detailedAddress && detailedAddress.includes(',')) {
    const parts = detailedAddress.split(',').map((p) => p.trim()).filter(Boolean);
    const nonWardProvParts = parts.filter((p) => {
      const cp = cleanText(p);
      return cp && cp !== cWard && !cWard.includes(cp) && cp !== cProv && !cProv.includes(cp);
    });
    detailedAddress = nonWardProvParts.join(', ');
  }

  // Nếu sau khi lọc hoặc nếu rawStreet trùng hoàn toàn với xã hoặc tỉnh
  // (ví dụ: khách chỉ điền "Hoà Lạc" vào ô chi tiết, mà xã cũng là "Xã Hòa Lạc")
  // thì ô số nhà/tên đường thực chất đang chứa tên xã -> chuyển về rỗng để không bị fill nhầm trường xã vào ô địa chỉ
  const cFinal = cleanText(detailedAddress);
  if (cFinal && ((cWard && (cFinal === cWard || cWard.includes(cFinal))) || (cProv && (cFinal === cProv || cProv.includes(cFinal))))) {
    detailedAddress = '';
  }

  const fullAddr = [detailedAddress, rawStreet, wardHint, provHint, noteAddr, info.Address].filter(Boolean).join(', ');

  return {
    receiverName,
    receiverPhone: String(receiverPhone || '').trim(),
    detailedAddress,
    provHint,
    wardHint,
    wardCodeHint,
    fullAddr,
  };
};
