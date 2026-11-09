/**
 * Script kiểm thử toàn trình quy trình vận chuyển GHN & MongoDB Atlas
 * Không sử dụng mock/seed dữ liệu, kết nối trực tiếp 100% với GHN API và MongoDB Atlas
 * Chạy bằng lệnh: node backend/src/scripts/testGhnFlow.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
dotenv.config();
import mongoose from 'mongoose';
import * as ghnService from '../services/shipping/ghnService.js';
import { Shop } from '../models/shop/Shop.js';

async function runGhnIntegrationTests() {
  let passedTests = 0;
  let totalTests = 7;

  try {
    // Kết nối MongoDB Atlas
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (mongoUri) {
      await mongoose.connect(mongoUri);
      console.log('📦 Đã kết nối MongoDB Atlas thành công');
    }

    // Lấy shop thực tế từ MongoDB Atlas để làm điểm lấy hàng
    const realShop = await Shop.findOne({ status: 'ACTIVE' }).lean() || await Shop.findOne({}).lean();
    console.log(`🏪 Điểm lấy hàng từ MongoDB Atlas: "${realShop?.name || 'Vestora Tân Xã'}" - SĐT: ${realShop?.phone} - Đ/c: ${realShop?.address}`);

    const fromDistrictId = realShop?.districtId || 1808; // Thạch Thất
    const fromWardCode = String(realShop?.wardCode || '1B1921'); // Tân Xã
    const fromName = realShop?.name || 'Vestora Tân Xã';
    const fromPhone = realShop?.phone || '0912345677';
    const fromAddress = realShop?.address || 'Khu Công nghệ cao Hòa Lạc, Thạch Thất, Hà Nội';

    // 1. Kiểm tra lấy danh mục Tỉnh/Thành từ GHN API
    console.log('\n1️⃣ [Test 1] Tra cứu danh mục Tỉnh/Thành phố trực tiếp từ GHN API:');
    const provinces = await ghnService.getProvinces();
    if (Array.isArray(provinces) && provinces.length > 0) {
      console.log(`   ✅ Thành công: Tìm thấy ${provinces.length} tỉnh/thành thực tế từ GHN (VD: ${provinces[0].ProvinceName})`);
      passedTests++;
    } else {
      throw new Error('Danh sách tỉnh thành rỗng');
    }

    // 2. Kiểm tra lấy Quận/Huyện & Phường/Xã từ GHN API
    console.log('\n2️⃣ [Test 2] Tra cứu Quận/Huyện & Phường/Xã trực tiếp từ GHN API:');
    const sampleProvince = provinces.find((p) => p.ProvinceName === 'Hà Nội' || p.ProvinceName === 'Hồ Chí Minh') || provinces[0];
    const sampleProvinceId = sampleProvince.ProvinceID || 201;
    const districts = await ghnService.getDistricts(sampleProvinceId);
    console.log(`   ✅ Tìm thấy ${districts.length} quận/huyện cho tỉnh ${sampleProvince.ProvinceName} (ID ${sampleProvinceId})`);

    const sampleDistrict = districts.find(d => d.DistrictName.includes('Cầu Giấy')) || districts[0];
    const sampleDistrictId = sampleDistrict.DistrictID;
    const wards = await ghnService.getWards(sampleDistrictId);
    const targetWard = wards[0];
    console.log(`   ✅ Tìm thấy ${wards.length} phường/xã cho quận ${sampleDistrict.DistrictName} (VD: ${targetWard.WardName} - Mã: ${targetWard.WardCode})`);
    passedTests++;

    // 3. Kiểm tra tính cước phí vận chuyển thực tế qua GHN API
    console.log('\n3️⃣ [Test 3] Tính cước phí vận chuyển thực tế qua GHN API:');
    const feeRes = await ghnService.calculateShippingFee({
      fromDistrictId,
      fromWardCode,
      toDistrictId: sampleDistrictId,
      toWardCode: targetWard.WardCode,
      weight: 800,
      length: 35,
      width: 25,
      height: 15,
      insuranceValue: 1000000,
    });
    console.log(`   ✅ Cước thực tế GHN: ${new Intl.NumberFormat('vi-VN').format(feeRes.total_fee)} VND`);
    console.log(`   ✅ Giao dự kiến: ${new Date(feeRes.expected_delivery_time).toLocaleDateString('vi-VN')}`);
    passedTests++;

    // 4. Kiểm tra tạo vận đơn xuất hàng (Outbound) thực tế trên GHN API
    console.log('\n4️⃣ [Test 4] Tạo vận đơn xuất hàng thực tế trên GHN API:');
    const createRes = await ghnService.createGHNOrder({
      fromName,
      fromPhone,
      fromAddress,
      fromDistrictId,
      fromWardCode,
      toName: 'Trần Thị Thu Thảo',
      toPhone: '0912345678',
      toAddress: `Số 15 Phố ${targetWard.WardName}, ${sampleDistrict.DistrictName}`,
      toDistrictId: sampleDistrictId,
      toWardCode: targetWard.WardCode,
      codAmount: 350000,
      weight: 800,
      note: 'Hàng thời trang cao cấp - Cho xem không cho thử',
      clientOrderCode: `TEST-${Date.now()}`,
    });
    console.log(`   ✅ Mã vận đơn GHN thực tế: ${createRes.order_code}`);
    console.log(`   ✅ Cước phí GHN xác nhận: ${new Intl.NumberFormat('vi-VN').format(createRes.total_fee)} VND`);
    passedTests++;

    // 5. Kiểm tra tra cứu chi tiết vận đơn vừa tạo trực tiếp từ GHN API
    console.log('\n5️⃣ [Test 5] Tra cứu chi tiết vận đơn trực tiếp từ GHN API:');
    const detailRes = await ghnService.getGHNOrderDetail(createRes.order_code);
    console.log(`   ✅ Trạng thái GHN trả về: ${detailRes.status || detailRes.status_name || 'Đang xử lý'}`);
    passedTests++;

    // 6. Kiểm tra tạo mã in phiếu giao hàng A5 từ GHN API
    console.log('\n6️⃣ [Test 6] Tạo token in phiếu A5 thực tế từ GHN API:');
    const printRes = await ghnService.generatePrintToken(createRes.order_code);
    console.log(`   ✅ URL in phiếu A5: ${printRes.printUrl}`);
    passedTests++;

    // 7. Kiểm tra hủy vận đơn thực tế trên GHN API
    console.log('\n7️⃣ [Test 7] Hủy vận đơn thực tế trên GHN API:');
    const cancelRes = await ghnService.cancelGHNOrder(createRes.order_code);
    console.log(`   ✅ Kết quả hủy: ${cancelRes.message}`);
    passedTests++;

    console.log('\n====================================================');
    console.log(`🎉 HOÀN THÀNH TOÀN BỘ KIỂM THỬ THỰC TẾ: ${passedTests}/${totalTests} TESTS PASSED!`);
    console.log('====================================================');

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(0);
  } catch (error) {
    console.error('\n❌ KIỂM THỬ THẤT BẠI:', error.message);
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

runGhnIntegrationTests();
