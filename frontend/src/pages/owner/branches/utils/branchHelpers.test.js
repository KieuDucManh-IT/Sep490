import { cleanName, getProvinceCoords, validateBranchForm } from './branchHelpers';

describe('Branch Management Helpers & Validations', () => {
  describe('cleanName', () => {
    test('chuẩn hóa và xóa bỏ các tiền tố hành chính tiếng Việt', () => {
      expect(cleanName('Thành phố Hà Nội')).toBe('ha noi');
      expect(cleanName('Tỉnh Khánh Hòa')).toBe('khanh hoa');
      expect(cleanName('Quận Ba Đình')).toBe('ba dinh');
      expect(cleanName('Phường Tràng Tiền')).toBe('trang tien');
      expect(cleanName('TP. Hồ Chí Minh')).toBe('ho chi minh');
    });

    test('bỏ dấu thanh tiếng Việt chính xác', () => {
      expect(cleanName('Đà Nẵng')).toBe('da nang');
      expect(cleanName('Thừa Thiên Huế')).toBe('thua thien hue');
    });

    test('xử lý chuỗi rỗng hoặc giá trị không hợp lệ', () => {
      expect(cleanName('')).toBe('');
      expect(cleanName(null)).toBe('');
      expect(cleanName(undefined)).toBe('');
    });
  });

  describe('getProvinceCoords', () => {
    test('tìm thấy tọa độ mặc định khi khớp tên tỉnh', () => {
      const coordsHN = getProvinceCoords('Hà Nội');
      expect(coordsHN).toEqual({ lat: 21.028511, lng: 105.854167 });

      const coordsHCM = getProvinceCoords('Thành phố Hồ Chí Minh');
      expect(coordsHCM).toEqual({ lat: 10.776889, lng: 106.700806 });
    });

    test('trả về null khi không tìm thấy tỉnh phù hợp', () => {
      expect(getProvinceCoords('Tỉnh Không Tồn Tại')).toBeNull();
      expect(getProvinceCoords('')).toBeNull();
    });
  });

  describe('validateBranchForm', () => {
    const validFormData = {
      name: 'VESTORA Flagship Tràng Tiền',
      phone: '0912345678',
      city: 'Thành phố Hà Nội',
      address: 'Số 18 Tràng Tiền',
      latitude: '21.028511',
      longitude: '105.854167',
      openingHours: '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
      description: 'Showroom thời trang dạ tiệc cao cấp VESTORA.',
    };

    test('form hợp lệ hoàn toàn không trả về lỗi nào', () => {
      const errors = validateBranchForm(validFormData);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    test('từ chối khi tên chi nhánh quá ngắn hoặc để trống', () => {
      const errorsEmpty = validateBranchForm({ ...validFormData, name: '' });
      expect(errorsEmpty.name).toBeDefined();

      const errorsShort = validateBranchForm({ ...validFormData, name: 'AB' });
      expect(errorsShort.name).toBeDefined();
    });

    test('từ chối khi số điện thoại hotline không hợp lệ', () => {
      const errorsInvalidPhone = validateBranchForm({ ...validFormData, phone: '012345' });
      expect(errorsInvalidPhone.phone).toBeDefined();

      const errorsWrongPrefix = validateBranchForm({ ...validFormData, phone: '0412345678' });
      expect(errorsWrongPrefix.phone).toBeDefined();

      const errorsValidPrefix = validateBranchForm({ ...validFormData, phone: '+84 912 345 678' });
      expect(errorsValidPrefix.phone).toBeUndefined();
    });

    test('từ chối khi chưa chọn Tỉnh / Thành phố', () => {
      const errorsNoCity = validateBranchForm({ ...validFormData, city: '' });
      expect(errorsNoCity.city).toBeDefined();

      const errorsAllCity = validateBranchForm({ ...validFormData, city: 'ALL' });
      expect(errorsAllCity.city).toBeDefined();
    });

    test('từ chối khi thiếu hoặc sai phạm vi tọa độ vị trí', () => {
      const errorsNoCoords = validateBranchForm({ ...validFormData, latitude: '', longitude: '' });
      expect(errorsNoCoords.coordinates).toBeDefined();

      const errorsOutOfRange = validateBranchForm({ ...validFormData, latitude: '95.0', longitude: '105.0' });
      expect(errorsOutOfRange.coordinates).toBeDefined();
    });

    test('từ chối khi giờ đóng cửa trước giờ mở cửa', () => {
      const errorsInvalidHours = validateBranchForm({
        ...validFormData,
        openingHours: '22:00 - 08:00 (Thứ 2 - Chủ Nhật)',
      });
      expect(errorsInvalidHours.openingHours).toBeDefined();
    });
  });
});
