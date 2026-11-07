import { ghnRequest, ghnConfig, isMockMode } from './ghnConfig.js';
import { mapGhnStatus } from './ghnStatusMapper.js';

// Dữ liệu giả lập địa giới hành chính phục vụ Mock Dev Mode
const MOCK_PROVINCES = [
  { ProvinceID: 201, ProvinceName: 'Hà Nội', Code: 'HN' },
  { ProvinceID: 202, ProvinceName: 'Hồ Chí Minh', Code: 'HCM' },
  { ProvinceID: 203, ProvinceName: 'Đà Nẵng', Code: 'DN' },
  { ProvinceID: 204, ProvinceName: 'Hải Phòng', Code: 'HP' },
  { ProvinceID: 205, ProvinceName: 'Cần Thơ', Code: 'CT' },
];

const MOCK_DISTRICTS = {
  201: [
    { DistrictID: 1442, DistrictName: 'Quận Ba Đình', ProvinceID: 201 },
    { DistrictID: 1443, DistrictName: 'Quận Hoàn Kiếm', ProvinceID: 201 },
    { DistrictID: 1444, DistrictName: 'Quận Cầu Giấy', ProvinceID: 201 },
    { DistrictID: 1445, DistrictName: 'Quận Đống Đa', ProvinceID: 201 },
  ],
  202: [
    { DistrictID: 1446, DistrictName: 'Quận 1', ProvinceID: 202 },
    { DistrictID: 1447, DistrictName: 'Quận 3', ProvinceID: 202 },
    { DistrictID: 1448, DistrictName: 'Quận Bình Thạnh', ProvinceID: 202 },
    { DistrictID: 1449, DistrictName: 'Thành phố Thủ Đức', ProvinceID: 202 },
  ],
  203: [
    { DistrictID: 1450, DistrictName: 'Quận Hải Châu', ProvinceID: 203 },
    { DistrictID: 1451, DistrictName: 'Quận Thanh Khê', ProvinceID: 203 },
  ],
};

const MOCK_WARDS = {
  1444: [
    { WardCode: '270501', WardName: 'Phường Dịch Vọng', DistrictID: 1444 },
    { WardCode: '270502', WardName: 'Phường Dịch Vọng Hậu', DistrictID: 1444 },
    { WardCode: '270503', WardName: 'Phường Nghĩa Đô', DistrictID: 1444 },
    { WardCode: '270504', WardName: 'Phường Quan Hoa', DistrictID: 1444 },
  ],
  1446: [
    { WardCode: '270601', WardName: 'Phường Bến Nghé', DistrictID: 1446 },
    { WardCode: '270602', WardName: 'Phường Bến Thành', DistrictID: 1446 },
    { WardCode: '270603', WardName: 'Phường Đa Kao', DistrictID: 1446 },
  ],
};

/**
 * Lấy danh sách Tỉnh/Thành từ GHN (Đã làm sạch dữ liệu rác Sandbox & sắp xếp chuẩn bảng chữ cái)
 */
export const getProvinces = async () => {
  if (isMockMode()) {
    return MOCK_PROVINCES;
  }
  try {
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
      return cleanList.sort((a, b) => {
        const aPri = PRIORITY_IDS.indexOf(Number(a.ProvinceID));
        const bPri = PRIORITY_IDS.indexOf(Number(b.ProvinceID));
        if (aPri !== -1 && bPri !== -1) return aPri - bPri;
        if (aPri !== -1) return -1;
        if (bPri !== -1) return 1;
        return a.ProvinceName.localeCompare(b.ProvinceName, 'vi');
      });
    }
    return MOCK_PROVINCES;
  } catch (error) {
    console.warn('[GHN] getProvinces failed, fallback to mock data:', error.message);
    return MOCK_PROVINCES;
  }
};

/**
 * Lấy danh sách Quận/Huyện theo Tỉnh/Thành (Lọc rác & xếp A-Z)
 */
export const getDistricts = async (provinceId) => {
  const pId = Number(provinceId);
  if (isMockMode()) {
    return MOCK_DISTRICTS[pId] || [
      { DistrictID: 9901, DistrictName: 'Quận Trung Tâm', ProvinceID: pId },
      { DistrictID: 9902, DistrictName: 'Quận Ngoại Thành', ProvinceID: pId },
    ];
  }
  try {
    const data = await ghnRequest('/shiip/public-api/master-data/district', {
      method: 'POST',
      data: { province_id: pId },
    });
    if (data?.code === 200 && Array.isArray(data.data)) {
      return data.data
        .filter((d) => d && d.DistrictName && !d.DistrictName.toLowerCase().includes('test') && d.Status !== 2)
        .sort((a, b) => a.DistrictName.localeCompare(b.DistrictName, 'vi'));
    }
    return MOCK_DISTRICTS[pId] || [];
  } catch (error) {
    console.warn(`[GHN] getDistricts(${provinceId}) failed, fallback to mock:`, error.message);
    return MOCK_DISTRICTS[pId] || [];
  }
};

/**
 * Lấy danh sách Phường/Xã theo Quận/Huyện (Lọc rác & xếp A-Z)
 */
export const getWards = async (districtId) => {
  const dId = Number(districtId);
  if (isMockMode()) {
    return MOCK_WARDS[dId] || [
      { WardCode: `${dId}01`, WardName: 'Phường 1', DistrictID: dId },
      { WardCode: `${dId}02`, WardName: 'Phường 2', DistrictID: dId },
      { WardCode: `${dId}03`, WardName: 'Phường 3', DistrictID: dId },
    ];
  }
  try {
    const data = await ghnRequest('/shiip/public-api/master-data/ward', {
      method: 'POST',
      data: { district_id: dId },
    });
    if (data?.code === 200 && Array.isArray(data.data)) {
      return data.data
        .filter((w) => w && w.WardName && !w.WardName.toLowerCase().includes('test') && w.Status !== 2)
        .sort((a, b) => a.WardName.localeCompare(b.WardName, 'vi'));
    }
    return MOCK_WARDS[dId] || [];
  } catch (error) {
    console.warn(`[GHN] getWards(${districtId}) failed, fallback to mock:`, error.message);
    return MOCK_WARDS[dId] || [];
  }
};

/**
 * Tính cước phí vận chuyển qua GHN
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
  const expectedDate = new Date();
  expectedDate.setDate(expectedDate.getDate() + 2);

  if (isMockMode()) {
    // Giả lập mức phí: 28,000 VND cơ bản, cộng thêm 5,000 VND cho mỗi 500g phát sinh
    const baseFee = 28000;
    const extraWeight = Math.max(0, weight - 500);
    const weightFee = Math.ceil(extraWeight / 500) * 5000;
    const totalFee = baseFee + weightFee;

    return {
      total_fee: totalFee,
      service_fee: baseFee,
      insurance_fee: insuranceValue > 1000000 ? Math.round(insuranceValue * 0.005) : 0,
      expected_delivery_time: expectedDate,
      isMock: true,
    };
  }

  try {
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
      return {
        total_fee: res.data.total || 30000,
        service_fee: res.data.service_fee || 30000,
        insurance_fee: res.data.insurance_fee || 0,
        expected_delivery_time: expectedDate,
        isMock: false,
      };
    }

    throw new Error(res?.message || 'Không thể tính phí vận chuyển GHN');
  } catch (error) {
    console.error('[GHN] calculateShippingFee error:', error.message);
    // Khi có lỗi từ API, fallback sang giá trị ước tính an toàn
    return {
      total_fee: 32000,
      service_fee: 32000,
      insurance_fee: 0,
      expected_delivery_time: expectedDate,
      isMock: true,
      fallbackNotice: error.message,
    };
  }
};

/**
 * Tạo vận đơn trên hệ thống GHN
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

  const expectedDate = new Date();
  expectedDate.setDate(expectedDate.getDate() + 2);

  if (isMockMode()) {
    const randomCode = 'MOCK' + Math.floor(100000 + Math.random() * 900000);
    return {
      order_code: randomCode,
      total_fee: 32000,
      expected_delivery_time: expectedDate,
      isMock: true,
    };
  }

  try {
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
      // Điểm lấy hàng động theo từng chi nhánh cụ thể
      ...(fromName ? { from_name: fromName } : {}),
      ...(fromPhone ? { from_phone: fromPhone } : {}),
      ...(fromAddress ? { from_address: fromAddress } : {}),
      ...(fromDistrictId ? { from_district_id: Number(fromDistrictId) } : {}),
      ...(fromWardCode ? { from_ward_code: String(fromWardCode) } : {}),
      // Địa chỉ nhận hàng của khách
      to_name: toName,
      to_phone: toPhone,
      to_address: toAddress,
      to_ward_code: String(toWardCode),
      to_district_id: Number(toDistrictId),
      // Địa chỉ hoàn hàng khi giao không thành công (trả về đúng kho chi nhánh xuất hàng)
      return_phone: returnPhone || fromPhone || toPhone,
      return_address: returnAddress || fromAddress || toAddress,
      return_district_id: Number(returnDistrictId || fromDistrictId || toDistrictId),
      return_ward_code: String(returnWardCode || fromWardCode || toWardCode),
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
  } catch (error) {
    const errorMsg = error.message;
    console.error('[GHN] createGHNOrder failed:', errorMsg);
    throw new Error(`Tạo vận đơn GHN thất bại: ${errorMsg}`);
  }
};

/**
 * Tra cứu chi tiết vận đơn theo mã GHN
 */
export const getGHNOrderDetail = async (orderCode) => {
  if (isMockMode()) {
    return {
      order_code: orderCode,
      status: 'delivering',
      status_name: 'Đang giao hàng',
      log: [
        { status: 'ready_to_pick', updated_date: new Date(Date.now() - 86400000).toISOString() },
        { status: 'picked', updated_date: new Date(Date.now() - 43200000).toISOString() },
        { status: 'delivering', updated_date: new Date().toISOString() },
      ],
      isMock: true,
    };
  }

  try {
    const res = await ghnRequest('/shiip/public-api/v2/shipping-order/detail', {
      method: 'POST',
      data: { order_code: orderCode },
    });
    if (res?.code === 200 && res.data) {
      return res.data;
    }
    throw new Error(res?.message || 'Không tìm thấy chi tiết vận đơn');
  } catch (error) {
    console.error('[GHN] getGHNOrderDetail error:', error.message);
    throw error;
  }
};

/**
 * Hủy đơn hàng trên GHN
 */
export const cancelGHNOrder = async (orderCode) => {
  if (isMockMode()) {
    return { success: true, message: 'Đã hủy vận đơn giả lập thành công' };
  }

  try {
    const res = await ghnRequest('/shiip/public-api/v2/switch-status/cancel', {
      method: 'POST',
      data: { order_codes: [orderCode] },
    });
    if (res?.code === 200) {
      return { success: true, message: 'Đã hủy vận đơn trên hệ thống GHN' };
    }
    throw new Error(res?.message || 'Không thể hủy vận đơn GHN');
  } catch (error) {
    console.error('[GHN] cancelGHNOrder error:', error.message);
    throw new Error(`Hủy đơn GHN thất bại: ${error.message}`);
  }
};

/**
 * Tạo token in phiếu giao hàng A5 từ GHN
 */
export const generatePrintToken = async (orderCodes) => {
  const codes = Array.isArray(orderCodes) ? orderCodes : [orderCodes];
  if (isMockMode()) {
    return {
      token: 'mock_print_token',
      printUrl: `https://dev-online-gateway.ghn.vn/a5/public-api/printA5?token=mock_print_token`,
    };
  }

  try {
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
    throw new Error(res?.message || 'Không thể tạo mã in phiếu GHN');
  } catch (error) {
    console.error('[GHN] generatePrintToken error:', error.message);
    throw error;
  }
};
