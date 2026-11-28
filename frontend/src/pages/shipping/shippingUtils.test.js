import {
  cleanText,
  filterHanoiProvinces,
  autoMatchProvince,
  autoMatchWard,
} from './shippingUtils';

describe('filterHanoiProvinces (Hanoi-only scope)', () => {
  it('chỉ giữ lại Hà Nội trong danh sách Tỉnh/Thành và chuẩn hóa đầy đủ trường v3/v2', () => {
    const raw = [
      { _id: '1000001', name: 'Thành phố Hồ Chí Minh' },
      { _id: '1000000', name: 'Thành phố Hà Nội' },
      { _id: '1000002', name: 'Thành phố Đà Nẵng' },
    ];

    expect(filterHanoiProvinces(raw)).toEqual([
      {
        _id: '1000000',
        ProvinceID: '1000000',
        name: 'Thành phố Hà Nội',
        ProvinceName: 'Thành phố Hà Nội',
      },
    ]);
  });

  it('fallback trả nguyên danh sách đã chuẩn hóa nếu API không trả bản ghi khớp Hà Nội', () => {
    const raw = [{ _id: '2', name: 'Đà Nẵng' }];
    expect(filterHanoiProvinces(raw)).toEqual([
      {
        _id: '2',
        ProvinceID: '2',
        name: 'Đà Nẵng',
        ProvinceName: 'Đà Nẵng',
      },
    ]);
  });
});

describe('cleanText, autoMatchProvince & autoMatchWard edge cases', () => {
  it('cleanText xử lý viết tắt dính liền TP.HCM và autoMatchProvince không khớp sai từ gợi ý 2 ký tự hoặc tên đường', () => {
    expect(cleanText('TP.HCM')).toBe('hcm');
    const provs = [
      { _id: '10', name: 'Tỉnh Hà Giang' },
      { _id: '1000000', name: 'Thành phố Hà Nội' },
      { _id: '1000001', name: 'Thành phố Hồ Chí Minh' },
      { _id: '1000004', name: 'Thành phố Hải Phòng' },
    ];

    expect(autoMatchProvince('TP.HCM', '', provs)?._id).toBe('1000001');
    expect(autoMatchProvince('ha', '', provs)).toBeNull();
    expect(autoMatchProvince('', '50 Ngõ Hà Nội, Quận Lê Chân, Thành phố Hải Phòng', provs)?._id).toBe('1000004');
  });

  it('autoMatchWard ưu tiên WardCode/_id, chặn parseInt GSO collision, phường đánh số ngắn và tên đường trong fullAddr', () => {
    const wards = [
      { _id: 'W012', WardCode: '100012', WardName: 'Phường Sai Số 12', GovernmentCode: '00012' },
      { _id: 'W001', WardCode: '200102', WardName: 'Phường 10', NameExtension: ['P.10', 'Phuong 10'], GovernmentCode: '00999' },
      { _id: 'W002', WardCode: '200103', WardName: 'Phường 1', NameExtension: ['P.1'], GovernmentCode: '00998' },
      { _id: 'WKM', WardCode: '100105', WardName: 'Phường Kim Mã', GovernmentCode: '00015' },
      { _id: 'WNK', WardCode: '100106', WardName: 'Phường Ngọc Khánh', GovernmentCode: '00016' },
      { _id: 'WHB', WardCode: '100107', WardName: 'Phường Hàng Bạc', GovernmentCode: '00001' },
    ];

    // "12 Hàng Bạc" không bị parseInt("12") khớp nhầm sang GovernmentCode "00012"
    expect(autoMatchWard('12 Hàng Bạc', '', '', wards)?.WardCode).toBe('100107');

    // WardCode 200102 khớp trực tiếp ngay cả khi trùng dạng số
    const collisionList = [
      { _id: 'A', WardCode: '999999', WardName: 'Xã Sai', GovernmentCode: '200102' },
      { _id: 'B', WardCode: '200102', WardName: 'Phường Đúng', GovernmentCode: '00050' },
    ];
    expect(autoMatchWard('', '200102', '', collisionList)?.WardCode).toBe('200102');

    // "Phường 1" không khớp nhầm "Phường 10"
    expect(autoMatchWard('Phường 1', '', '', wards)?.WardCode).toBe('200103');

    // fullAddr "50 Kim Mã, Phường Ngọc Khánh, ..." không chọn nhầm "Phường Kim Mã"
    expect(autoMatchWard('', '', '50 Kim Mã, Phường Ngọc Khánh, Quận Ba Đình, Hà Nội', wards)?.WardCode).toBe('100106');

    // Viết tắt "P. Ngọc Khánh" có dấu chấm không bị regex \b làm trượt match theo segment "50 Kim Mã"
    expect(autoMatchWard('', '', 'Tòa nhà A, 50 Kim Mã, P. Ngọc Khánh, Ba Đình, Hà Nội', wards)?.WardCode).toBe('100106');
  });
});

