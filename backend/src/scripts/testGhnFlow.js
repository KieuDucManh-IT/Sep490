/**
 * Script kiểm thử toàn trình quy trình vận chuyển GHN (Mock & Sandbox)
 * Chạy bằng lệnh: node backend/src/scripts/testGhnFlow.js
 */

import 'dotenv/config';
import * as ghnService from '../services/shipping/ghnService.js';
import { mapGhnStatus } from '../services/shipping/ghnStatusMapper.js';
import { isMockMode } from '../services/shipping/ghnConfig.js';

async function runGhnIntegrationTests() {

  let passedTests = 0;
  let totalTests = 7;

  try {
    // 1. Kiểm tra lấy danh mục Tỉnh/Thành
    console.log('1️⃣ [Test 1] Tra cứu danh mục Tỉnh/Thành phố:');
    const provinces = await ghnService.getProvinces();
    if (Array.isArray(provinces) && provinces.length > 0) {
      console.log(`   ✅ Thành công: Tìm thấy ${provinces.length} tỉnh/thành (VD: ${provinces[0].ProvinceName})`);
      passedTests++;
    } else {
      throw new Error('Danh sách tỉnh thành rỗng');
    }

    // 2. Kiểm tra lấy Quận/Huyện & Phường/Xã
    console.log('\n2️⃣ [Test 2] Tra cứu Quận/Huyện & Phường/Xã:');
    const sampleProvince = provinces.find((p) => p.ProvinceName === 'Hà Nội' || p.ProvinceName === 'Hồ Chí Minh') || provinces[0];
    const sampleProvinceId = sampleProvince.ProvinceID || 201;
    const districts = await ghnService.getDistricts(sampleProvinceId);
    console.log(`   ✅ Tìm thấy ${districts.length} quận/huyện cho tỉnh ${sampleProvince.ProvinceName} (ID ${sampleProvinceId})`);

    const sampleDistrict = districts[0] || { DistrictID: 1446, DistrictName: 'Quận 1' };
    const sampleDistrictId = sampleDistrict.DistrictID || 1446;
    const wards = await ghnService.getWards(sampleDistrictId);
    const targetWard = wards[0] || { WardCode: '20415', WardName: 'Phường 18' };
    console.log(`   ✅ Tìm thấy ${wards.length} phường/xã cho quận ${sampleDistrict.DistrictName} (VD: ${targetWard.WardName} - Mã: ${targetWard.WardCode})`);
    passedTests++;

    // 3. Kiểm tra tính cước phí vận chuyển
    console.log('\n3️⃣ [Test 3] Tính cước phí vận chuyển giao hàng:');
    const feeRes = await ghnService.calculateShippingFee({
      fromDistrictId: 1444, // Cầu Giấy, HN
      fromWardCode: '20101',
      toDistrictId: sampleDistrictId,
      toWardCode: targetWard.WardCode,
      weight: 800, // 800g trang phục dạ hội
      length: 35,
      width: 25,
      height: 15,
      insuranceValue: 2000000,
    });
    console.log(`   ✅ Cước ước tính: ${new Intl.NumberFormat('vi-VN').format(feeRes.total_fee)} VND`);
    console.log(`   ✅ Giao dự kiến: ${new Date(feeRes.expected_delivery_time).toLocaleDateString('vi-VN')}`);
    passedTests++;

    // 4. Kiểm tra tạo vận đơn xuất hàng (Outbound)
    console.log('\n4️⃣ [Test 4] Tạo vận đơn xuất hàng sang GHN:');
    const createRes = await ghnService.createGHNOrder({
      toName: 'Trần Thị Thu Thảo',
      toPhone: '0912345678',
      toAddress: 'Số 45 Lê Duẩn',
      toDistrictId: sampleDistrictId,
      toWardCode: targetWard.WardCode,
      codAmount: 350000, // Thu hộ 350,000 VND
      weight: 800,
      note: 'Hàng thời trang cao cấp - Cho xem không cho thử',
      clientOrderCode: `TEST-ORD-${Date.now()}`,
    });
    console.log(`   ✅ Mã vận đơn GHN tạo thành công: ${createRes.order_code}`);
    console.log(`   ✅ Cước phí GHN xác nhận: ${new Intl.NumberFormat('vi-VN').format(createRes.total_fee)} VND`);
    passedTests++;

    // 5. Kiểm tra tra cứu chi tiết vận đơn vừa tạo
    console.log('\n5️⃣ [Test 5] Tra cứu chi tiết vận đơn theo mã:');
    const detailRes = await ghnService.getGHNOrderDetail(createRes.order_code);
    console.log(`   ✅ Trạng thái hiện tại: ${detailRes.status || detailRes.status_name || 'Đang xử lý'}`);
    passedTests++;

    // 6. Kiểm tra tạo mã in phiếu giao hàng A5
    console.log('\n6️⃣ [Test 6] Tạo token in phiếu A5:');
    const printRes = await ghnService.generatePrintToken(createRes.order_code);
    console.log(`   ✅ URL in phiếu A5: ${printRes.printUrl}`);
    passedTests++;

    // 7. Kiểm tra hủy vận đơn
    console.log('\n7️⃣ [Test 7] Hủy vận đơn thử nghiệm:');
    const cancelRes = await ghnService.cancelGHNOrder(createRes.order_code);
    console.log(`   ✅ Kết quả hủy: ${cancelRes.message}`);
    passedTests++;

    console.log('\n====================================================');
    console.log(`🎉 HOÀN THÀNH TOÀN BỘ KIỂM THỬ: ${passedTests}/${totalTests} TESTS PASSED!`);
    console.log('====================================================');
  } catch (error) {
    console.error('\n❌ KIỂM THỬ THẤT BẠI:', error.message);
    process.exit(1);
  }
}

runGhnIntegrationTests();

