import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePhone,
  validateCoordinates,
  validateCreateBranchInput,
  validateUpdateShopInfoInput,
} from '../src/validations/shop/shopValidation.js';

describe('Backend Shop Validation Tests', () => {
  describe('validatePhone', () => {
    it('chuẩn hóa số điện thoại Việt Nam hợp lệ', () => {
      assert.equal(validatePhone('0912345678'), '0912345678');
      assert.equal(validatePhone('+84 912 345 678'), '0912345678');
      assert.equal(validatePhone(' 038 999 8888 '), '0389998888');
    });

    it('báo lỗi khi số điện thoại không đúng định dạng', () => {
      assert.throws(() => validatePhone('123456'), /Số điện thoại không hợp lệ/);
      assert.throws(() => validatePhone('0412345678'), /Số điện thoại không hợp lệ/);
    });

    it('báo lỗi khi để trống số điện thoại bắt buộc', () => {
      assert.throws(() => validatePhone('', true), /Số điện thoại không được để trống/);
      assert.equal(validatePhone('', false), '');
    });
  });

  describe('validateCoordinates', () => {
    it('chấp nhận tọa độ hợp lệ trong phạm vi', () => {
      const coords = validateCoordinates(21.028511, 105.854167, true);
      assert.equal(coords.latitude, 21.028511);
      assert.equal(coords.longitude, 105.854167);
    });

    it('báo lỗi khi vĩ độ hoặc kinh độ ngoài phạm vi [-90, 90] và [-180, 180]', () => {
      assert.throws(() => validateCoordinates(95, 105), /Vĩ độ/);
      assert.throws(() => validateCoordinates(21, 190), /Kinh độ/);
    });

    it('báo lỗi khi thiếu tọa độ mà required = true', () => {
      assert.throws(() => validateCoordinates(null, null, true), /Tọa độ GPS/);
    });
  });

  describe('validateCreateBranchInput', () => {
    const validBody = {
      name: 'Showroom Vestora Tràng Tiền',
      description: 'Cửa hàng đầm dạ hội thiết kế sang trọng',
      phone: '0987654321',
      address: 'Số 10 Tràng Tiền',
      city: 'Thành phố Hà Nội',
      ward: 'Phường Tràng Tiền',
      latitude: 21.0285,
      longitude: 105.8542,
    };

    it('kiểm tra thành công với dữ liệu hợp lệ', () => {
      const result = validateCreateBranchInput(validBody);
      assert.equal(result.name, 'Showroom Vestora Tràng Tiền');
      assert.equal(result.phone, '0987654321');
      assert.equal(result.city, 'Thành phố Hà Nội');
    });

    it('từ chối tên chi nhánh dưới 3 ký tự', () => {
      assert.throws(
        () => validateCreateBranchInput({ ...validBody, name: 'AB' }),
        /Tên chi nhánh là bắt buộc và phải từ 3 đến 100 ký tự/
      );
    });

    it('từ chối khi thiếu tỉnh thành phố', () => {
      assert.throws(
        () => validateCreateBranchInput({ ...validBody, city: '' }),
        /Tỉnh\/Thành phố của chi nhánh là bắt buộc/
      );
    });
  });

  describe('validateUpdateShopInfoInput', () => {
    it('kiểm tra và cập nhật từng phần thông tin', () => {
      const partial = validateUpdateShopInfoInput({
        name: 'Showroom Vestora Ba Đình',
        phone: '0912345678',
      });
      assert.equal(partial.name, 'Showroom Vestora Ba Đình');
      assert.equal(partial.phone, '0912345678');
      assert.equal(partial.address, undefined);
    });
  });
});
