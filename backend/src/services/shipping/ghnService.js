import { ghnRequest, ghnConfig } from './ghnConfig.js';
import { mapGhnStatus } from './ghnStatusMapper.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // Bộ nhớ đệm 24 giờ cho dữ liệu địa giới hành chính
let cachedProvinces = null;
let cachedProvincesTime = 0;

const cachedDistricts = new Map(); // provinceId -> { data, timestamp }
const cachedWards = new Map(); // districtId -> { data, timestamp }
const cachedWardsByProvince = new Map(); // provinceId -> { data, timestamp }

/**
 * Lấy danh sách Tỉnh/Thành từ GHN API thực tế
 * (Đã làm sạch các tỉnh test/rác trên Sandbox & sắp xếp chuẩn bảng chữ cái)
 */
export const getProvinces = async () => {
  if (cachedProvinces && Date.now() - cachedProvincesTime < CACHE_TTL_MS) {
    return cachedProvinces;
  }

  const data = await ghnRequest('/shiip/public-api/master-data/province');
  if (data?.code === 200 && Array.isArray(data.data)) {
    // Loại bỏ các tỉnh test / rác trên GHN Sandbox (Hà Nội 02, Test - Alert...)
    const KNOWN_DIRTY_IDS = new Set([2002, 298]);
    const cleanList = data.data.filter((p) => {
      if (!p || !p.ProvinceName) return false;
      if (KNOWN_DIRTY_IDS.has(Number(p.ProvinceID))) return false;
      const nameLower = p.ProvinceName.toLowerCase().trim();
      if (nameLower.includes('test') || nameLower.includes('alert') || nameLower.includes(' 02')) {
        return false;
      }
      if (p.Status === 2) return false;
      return true;
    });

    // Ưu tiên Hà Nội, TP.HCM, Đà Nẵng ở đầu danh sách, các tỉnh còn lại xếp theo A-Z tiếng Việt
    const PRIORITY_IDS = [201, 202, 203];
    const sorted = cleanList.sort((a, b) => {
      const aPri = PRIORITY_IDS.indexOf(Number(a.ProvinceID));
      const bPri = PRIORITY_IDS.indexOf(Number(b.ProvinceID));
      if (aPri !== -1 && bPri !== -1) return aPri - bPri;
      if (aPri !== -1) return -1;
      if (bPri !== -1) return 1;
      return a.ProvinceName.localeCompare(b.ProvinceName, 'vi');
    });

    cachedProvinces = sorted;
    cachedProvincesTime = Date.now();
    return sorted;
  }
  throw new Error(data?.message || 'Không thể tải danh sách Tỉnh/Thành từ GHN');
};

/**
 * Lấy danh sách Quận/Huyện theo Tỉnh/Thành từ GHN API
 */
export const getDistricts = async (provinceId) => {
  const pId = Number(provinceId);
  if (!pId) throw new Error('Mã Tỉnh/Thành phố không hợp lệ.');

  const cached = cachedDistricts.get(pId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const data = await ghnRequest('/shiip/public-api/master-data/district', {
    method: 'POST',
    data: { province_id: pId },
  });

  if (data?.code === 200 && Array.isArray(data.data)) {
    const list = data.data
      .filter((d) => d && d.DistrictName && !d.DistrictName.toLowerCase().includes('test') && d.Status !== 2)
      .sort((a, b) => a.DistrictName.localeCompare(b.DistrictName, 'vi'));

    cachedDistricts.set(pId, { data: list, timestamp: Date.now() });
    return list;
  }
  throw new Error(data?.message || `Không thể tải danh sách Quận/Huyện của tỉnh ${provinceId} từ GHN`);
};

/**
 * Lấy danh sách Phường/Xã theo Quận/Huyện từ GHN API
 */
export const getWards = async (districtId) => {
  const dId = Number(districtId);
  if (!dId) throw new Error('Mã Quận/Huyện không hợp lệ.');

  const cached = cachedWards.get(dId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const data = await ghnRequest('/shiip/public-api/master-data/ward', {
    method: 'POST',
    data: { district_id: dId },
  });

  if (data?.code === 200 && Array.isArray(data.data)) {
    const list = data.data
      .filter((w) => w && w.WardName && !w.WardName.toLowerCase().includes('test') && w.Status !== 2)
      .sort((a, b) => a.WardName.localeCompare(b.WardName, 'vi'));

    cachedWards.set(dId, { data: list, timestamp: Date.now() });
    return list;
  }
  throw new Error(data?.message || `Không thể tải danh sách Phường/Xã của quận/huyện ${districtId} từ GHN`);
};

/**
 * Lấy toàn bộ danh sách Phường/Xã theo Tỉnh/Thành (gộp mọi Quận/Huyện)
 * Sử dụng bộ nhớ đệm 24h trên server, gom nhóm tránh nghẽn tải song song
 */
export const getWardsByProvince = async (provinceId) => {
  const pId = Number(provinceId);
  if (!pId) throw new Error('Mã Tỉnh/Thành phố không hợp lệ.');

  const cached = cachedWardsByProvince.get(pId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const districts = await getDistricts(pId);
  if (!Array.isArray(districts) || !districts.length) {
    return [];
  }

  // Tải song song có giới hạn theo chunk (tối đa 6 request/chunk) để không nghẽn kết nối
  const CHUNK_SIZE = 6;
  const flattenedWards = [];

  for (let i = 0; i < districts.length; i += CHUNK_SIZE) {
    const chunk = districts.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(async (dist) => {
        try {
          const wards = await getWards(dist.DistrictID);
          return wards.map((w) => ({
            WardCode: String(w.WardCode),
            WardName: w.WardName,
            DistrictID: dist.DistrictID,
            DistrictName: dist.DistrictName,
            GovernmentCode: w.GovernmentCode ? String(w.GovernmentCode) : '',
            NameExtension: Array.isArray(w.NameExtension) ? w.NameExtension : [],
            label: `${w.WardName} (${dist.DistrictName})`,
          }));
        } catch {
          return [];
        }
      })
    );
    chunkResults.forEach((wards) => flattenedWards.push(...wards));
  }

  flattenedWards.sort((a, b) => a.WardName.localeCompare(b.WardName, 'vi'));
  cachedWardsByProvince.set(pId, { data: flattenedWards, timestamp: Date.now() });
  return flattenedWards;
};

/**
 * Tính cước phí vận chuyển thực tế qua GHN API
 */
export const calculateShippingFee = async ({
  fromDistrictId,
  fromWardCode,
  toDistrictId,
  toWardCode,
  weight = 500,
  length = 30,
  width = 20,
  height = 10,
  insuranceValue = 0,
}) => {
  if (!fromDistrictId) throw new Error('Thiếu thông tin Quận/Huyện gửi hàng.');
  if (!toDistrictId) throw new Error('Thiếu thông tin Quận/Huyện nhận hàng.');

  const payload = {
    service_type_id: 2, // Dịch vụ Chuẩn/Nhanh của GHN
    from_district_id: Number(fromDistrictId),
    from_ward_code: String(fromWardCode || ''),
    to_district_id: Number(toDistrictId),
    to_ward_code: String(toWardCode || ''),
    weight: Number(weight) || 500,
    length: Number(length) || 30,
    width: Number(width) || 20,
    height: Number(height) || 10,
    insurance_value: Math.min(5000000, Number(insuranceValue) || 0),
  };

  const res = await ghnRequest('/shiip/public-api/v2/shipping-order/fee', {
    method: 'POST',
    data: payload,
  });

  if (res?.code === 200 && res.data) {
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 2);

    return {
      total_fee: res.data.total || 0,
      service_fee: res.data.service_fee || 0,
      insurance_fee: res.data.insurance_fee || 0,
      expected_delivery_time: expectedDate,
      isMock: false,
    };
  }

  throw new Error(res?.message || 'Không thể tính phí vận chuyển từ GHN');
};

/**
 * Tạo vận đơn thực tế trên hệ thống GHN API
 * Dữ liệu người gửi và người nhận lấy 100% từ MongoDB Atlas (Shop & Order)
 */
export const createGHNOrder = async (orderPayload) => {
  const {
    shopId,
    fromName,
    fromPhone,
    fromAddress,
    fromWardCode,
    fromDistrictId,
    returnPhone,
    returnAddress,
    returnDistrictId,
    returnWardCode,
    toName,
    toPhone,
    toAddress,
    toWardCode,
    toDistrictId,
    codAmount = 0,
    weight = 500,
    length = 30,
    width = 20,
    height = 10,
    note = 'Cho khách xem hàng không cho thử',
    items = [],
    clientOrderCode = '',
    insuranceValue = 0,
  } = orderPayload;

  // Kiểm tra dữ liệu bắt buộc từ MongoDB Atlas, không fallback giá trị ảo
  if (!fromName) throw new Error('Thiếu tên cửa hàng gửi hàng.');
  if (!fromPhone) throw new Error('Thiếu số điện thoại cửa hàng gửi hàng.');
  if (!fromAddress) throw new Error('Thiếu địa chỉ cửa hàng gửi hàng.');
  if (!fromDistrictId) throw new Error('Thiếu thông tin Quận/Huyện của cửa hàng gửi hàng.');
  if (!fromWardCode) throw new Error('Thiếu thông tin Phường/Xã của cửa hàng gửi hàng.');

  if (!toName) throw new Error('Thiếu họ tên người nhận.');
  if (!toPhone) throw new Error('Thiếu số điện thoại người nhận.');
  if (!toAddress) throw new Error('Thiếu địa chỉ giao hàng.');
  if (!toDistrictId) throw new Error('Thiếu Quận/Huyện người nhận.');
  if (!toWardCode) throw new Error('Thiếu Phường/Xã người nhận.');

  const ghnItems = items.length
    ? items.map((it) => ({
        name: it.name || 'Trang phục thời trang Vestora',
        code: it.sku || 'SKU-VESTORA',
        quantity: it.quantity || 1,
        price: it.price || 0,
        weight: Math.round((weight || 500) / (items.length || 1)),
      }))
    : [
        {
          name: 'Trang phục thời trang cao cấp Vestora',
          code: clientOrderCode || 'ORDER-VESTORA',
          quantity: 1,
          price: codAmount || 0,
          weight: weight || 500,
        },
      ];

  const payload = {
    payment_type_id: 1, // Người gửi (Cửa hàng) trả cước
    note: note || 'Cho xem hàng không cho thử đồ',
    required_note: 'CHOXEMHANGKHONGTHU',
    client_order_code: clientOrderCode || undefined,
    // Thông tin người gửi lấy trực tiếp từ MongoDB Shop
    from_name: fromName,
    from_phone: fromPhone,
    from_address: fromAddress,
    from_district_id: Number(fromDistrictId),
    from_ward_code: String(fromWardCode),
    // Thông tin khách hàng nhận
    to_name: toName,
    to_phone: toPhone,
    to_address: toAddress,
    to_ward_code: String(toWardCode),
    to_district_id: Number(toDistrictId),
    // Địa chỉ trả hàng khi giao không thành công (hoàn về chi nhánh)
    return_phone: returnPhone || fromPhone,
    return_address: returnAddress || fromAddress,
    return_district_id: Number(returnDistrictId || fromDistrictId),
    return_ward_code: String(returnWardCode || fromWardCode),
    cod_amount: Math.max(0, Number(codAmount) || 0),
    weight: Number(weight) || 500,
    length: Number(length) || 30,
    width: Number(width) || 20,
    height: Number(height) || 10,
    insurance_value: Math.min(5000000, Number(insuranceValue) || 0),
    service_type_id: 2,
    items: ghnItems,
  };

  const res = await ghnRequest('/shiip/public-api/v2/shipping-order/create', {
    method: 'POST',
    shopId: shopId ? Number(shopId) : undefined,
    data: payload,
  });

  if (res?.code === 200 && res.data) {
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 2);

    return {
      order_code: res.data.order_code,
      total_fee: res.data.total_fee || 0,
      expected_delivery_time: res.data.expected_delivery_time
        ? new Date(res.data.expected_delivery_time)
        : expectedDate,
      isMock: false,
    };
  }

  throw new Error(res?.message || 'Lỗi khi tạo vận đơn GHN');
};

/**
 * Tra cứu chi tiết vận đơn trực tiếp từ GHN API
 */
export const getGHNOrderDetail = async (orderCode) => {
  if (!orderCode) throw new Error('Mã vận đơn không được để trống.');

  const res = await ghnRequest('/shiip/public-api/v2/shipping-order/detail', {
    method: 'POST',
    data: { order_code: orderCode },
  });

  if (res?.code === 200 && res.data) {
    return res.data;
  }
  throw new Error(res?.message || `Không tìm thấy chi tiết vận đơn ${orderCode} trên GHN`);
};

/**
 * Hủy đơn hàng trực tiếp trên hệ thống GHN API
 */
export const cancelGHNOrder = async (orderCode) => {
  if (!orderCode) throw new Error('Mã vận đơn cần hủy không được để trống.');

  const res = await ghnRequest('/shiip/public-api/v2/switch-status/cancel', {
    method: 'POST',
    data: { order_codes: [orderCode] },
  });

  if (res?.code === 200) {
    return { success: true, message: 'Đã hủy vận đơn trên hệ thống GHN' };
  }
  throw new Error(res?.message || 'Không thể hủy vận đơn GHN');
};

/**
 * Tạo token in phiếu giao hàng A5 trực tiếp từ GHN API
 */
export const generatePrintToken = async (orderCodes) => {
  const codes = Array.isArray(orderCodes) ? orderCodes : [orderCodes];
  if (!codes.length) throw new Error('Cần cung cấp ít nhất một mã vận đơn GHN để in phiếu.');

  const res = await ghnRequest('/shiip/public-api/v2/a5/gen-token', {
    method: 'POST',
    data: { order_codes: codes },
  });

  if (res?.code === 200 && res.data?.token) {
    const token = res.data.token;
    return {
      token,
      printUrl: `${ghnConfig.apiUrl}/a5/public-api/printA5?token=${token}`,
    };
  }
  throw new Error(res?.message || 'Không thể tạo mã in phiếu GHN từ GHN API');
};
