import React, { useState, useEffect } from 'react';
import {
  Truck,
  Package,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Loader2,
  Store,
  ExternalLink,
} from 'lucide-react';
import {
  calculateShippingFeeApi,
  createOutboundShipmentApi,
} from '../../services/shippingApi';
import {
  formatCurrency,
  formatDate,
  autoMatchProvince,
  extractOrderAddressInfo,
} from './shippingUtils';
import { useAdministrativeDivisions } from './hooks/useAdministrativeDivisions';
import SearchableSelect from '../../components/SearchableSelect';
import '../../styles/ShippingModal.css';

export default function ShipmentCreateModal({
  show,
  onClose,
  order,
  orderType = 'rental',
  onSuccess,
}) {
  const {
    provinces,
    wards,
    loadingWards,
    provinceId: toProvinceId,
    districtId: toDistrictId,
    wardCode: toWardCode,
    handleProvinceChange,
    handleWardChange,
  } = useAdministrativeDivisions(show);

  // Form State
  const [toName, setToName] = useState('');
  const [toPhone, setToPhone] = useState('');
  const [toAddress, setToAddress] = useState('');

  const [weight, setWeight] = useState(500);
  const [length, setLength] = useState(30);
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(10);
  const [note, setNote] = useState('Cho khách xem hàng không cho thử');
  const [customCod, setCustomCod] = useState('');

  // Fee state
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [feeResult, setFeeResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Điền thông tin khách hàng từ order và tự động khớp Tỉnh / Xã
  useEffect(() => {
    if (!show || !order) return;

    const {
      receiverName,
      receiverPhone,
      detailedAddress,
      provHint,
      wardHint,
      wardCodeHint,
      provinceIdHint,
      fullAddr,
    } = extractOrderAddressInfo(order);

    setToName(receiverName);
    setToPhone(receiverPhone);
    setToAddress(detailedAddress);

    // Tính COD mặc định theo số dư chưa thanh toán
    let defaultCod = 0;
    if (order.paymentStatus !== 'paid') {
      if (orderType === 'sale') {
        defaultCod = Math.max(0, (order.totalAmount || 0) - (order.paidAmount || 0));
      } else {
        const total = (order.rentalFee || 0) + (order.depositAmount || 0);
        defaultCod = Math.max(0, total - (order.paidAmount || 0));
      }
    }
    setCustomCod(String(defaultCod));
    setFeeResult(null);
    setErrorMsg('');

    // Tự động phân tích và chọn Tỉnh/Thành, Phường/Xã
    if (provinces.length > 0) {
      if (provinceIdHint) {
        handleProvinceChange(String(provinceIdHint), wardHint, wardCodeHint, fullAddr);
      } else {
        const matchedProv = autoMatchProvince(provHint, fullAddr, provinces);
        if (matchedProv) {
          handleProvinceChange(String(matchedProv.ProvinceID), wardHint, wardCodeHint, fullAddr);
        }
      }
    }
  }, [show, order, orderType, provinces, handleProvinceChange]);

  const onProvinceSelect = (val) => {
    setFeeResult(null);
    handleProvinceChange(val);
  };

  const onWardSelect = (val) => {
    setFeeResult(null);
    handleWardChange(val);
  };

  // 5. Tính trước phí ship
  const handleCalculateFee = async () => {
    if (!toProvinceId || !toWardCode) {
      setErrorMsg('Vui lòng chọn Tỉnh/Thành và Phường/Xã để tính phí giao hàng.');
      return;
    }
    setErrorMsg('');
    setCalculatingFee(true);
    try {
      const res = await calculateShippingFeeApi({
        orderType,
        orderId: order?._id,
        toProvinceId: Number(toProvinceId),
        toDistrictId: Number(toDistrictId),
        toWardCode: String(toWardCode || ''),
        weight: Number(weight) || 500,
        length: Number(length) || 30,
        width: Number(width) || 20,
        height: Number(height) || 10,
      });

      if (res?.success && res.data) {
        setFeeResult(res.data);
      } else {
        setErrorMsg(res?.message || 'Không thể tính phí vận chuyển.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi tính cước phí GHN.');
    } finally {
      setCalculatingFee(false);
    }
  };

  // 6. Gửi tạo đơn
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!toProvinceId) {
      setErrorMsg('Vui lòng chọn Tỉnh/Thành phố giao hàng.');
      return;
    }
    if (!toWardCode) {
      setErrorMsg('Vui lòng chọn Phường/Xã giao hàng.');
      return;
    }
    if (!toPhone.trim()) {
      setErrorMsg('Vui lòng nhập số điện thoại người nhận.');
      return;
    }

    // Kiểm tra và chuẩn hóa số điện thoại di động Việt Nam 10 số (hỗ trợ cả đầu số +84, 84)
    let cleanPhone = toPhone.trim().replace(/[\s.-]/g, '');
    if (cleanPhone.startsWith('+84')) cleanPhone = '0' + cleanPhone.slice(3);
    else if (cleanPhone.startsWith('84') && cleanPhone.length === 11) cleanPhone = '0' + cleanPhone.slice(2);

    const vnPhoneRegex = /^(0)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
    if (!vnPhoneRegex.test(cleanPhone)) {
      setErrorMsg('Số điện thoại không hợp lệ. Vui lòng nhập số di động 10 số hiện hành của Việt Nam (VD: 0912345678, 0388889999). Đầu số cũ 012x đã bị ngừng sử dụng và không được GHN chấp nhận.');
      return;
    }

    if (!toAddress.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ cụ thể.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        orderType,
        orderId: order._id,
        toName: toName.trim(),
        toPhone: cleanPhone,
        toAddress: toAddress.trim(),
        toProvinceId: Number(toProvinceId),
        toDistrictId: Number(toDistrictId),
        toWardCode: String(toWardCode),
        weight: Number(weight) || 500,
        length: Number(length) || 30,
        width: Number(width) || 20,
        height: Number(height) || 10,
        note: note.trim(),
        customCodAmount: Number(customCod) || 0,
      };

      const res = await createOutboundShipmentApi(payload);
      if (res?.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setErrorMsg(res?.message || 'Tạo vận đơn thất bại.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi kết nối hệ thống GHN.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!show || !order) return null;

  const shop = order.locationId?.shopId || {};
  const storeName = shop.name || order.locationId?.name || 'Cửa hàng Vestora';
  const storeAddress = shop.address || order.locationId?.address || 'Địa chỉ Cửa hàng';
  const storePhone = shop.phone || order.locationId?.phone || '';
  const storeLat = shop.latitude ?? null;
  const storeLng = shop.longitude ?? null;

  return (
    <div
      className="modal fade show d-block shipping-modal-backdrop"
      tabIndex="-1"
    >
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow">
          {/* Header */}
          <div className="modal-header bg-light border-bottom">
            <div className="d-flex align-items-center gap-2">
              <div className="p-2 rounded bg-primary text-white">
                <Truck size={18} />
              </div>
              <div>
                <h6 className="modal-title fw-bold text-dark mb-0">
                  Tạo Vận Đơn Giao Hàng (GHN)
                </h6>
                <small className="text-muted">
                  Đơn hàng: <strong>{order.orderCode}</strong> • {orderType === 'rental' ? 'Đơn thuê đồ' : 'Đơn bán hàng'}
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={submitting}
            />
          </div>

          {/* Body */}
          <div className="modal-body p-4">
            {errorMsg && (
              <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <AlertCircle size={16} className="text-danger flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} id="shipment-create-form">
              {/* Cửa hàng gửi đồ (Điểm lấy hàng của Shipper) */}
              <div className="mb-3 p-3 bg-light rounded-3 border">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="small fw-bold text-uppercase text-primary d-flex align-items-center gap-1">
                    <Store size={15} /> 1. Cửa hàng gửi đồ (Shipper tới lấy hàng)
                  </div>
                  {storeLat && storeLng ? (
                    <a
                      href={`https://www.google.com/maps?q=${storeLat},${storeLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-primary py-0 px-2 small d-inline-flex align-items-center gap-1"
                      title="Mở Google Maps theo tọa độ GPS"
                    >
                      <ExternalLink size={12} /> Xem vị trí trên bản đồ
                    </a>
                  ) : null}
                </div>
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <span className="small text-muted d-block">Cửa hàng phụ trách:</span>
                    <strong className="text-dark small me-1">{storeName}</strong>
                    {storePhone && <span className="d-block small text-muted">Hotline cửa hàng: {storePhone}</span>}
                  </div>
                  <div className="col-12 col-md-6">
                    <span className="small text-muted d-block">Địa chỉ cửa hàng:</span>
                    <span className="text-dark small d-block">{storeAddress}</span>
                    {storeLat && storeLng && (
                      <span className="small text-muted shipping-fee-sub">
                        📍 Tọa độ GPS: {Number(storeLat).toFixed(4)}, {Number(storeLng).toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Thông tin người nhận */}
              <div className="mb-3">
                <div className="small fw-bold text-uppercase text-muted mb-2">
                  2. Thông tin người nhận (Khách hàng)
                </div>
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">Họ tên người nhận *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={toName}
                      onChange={(e) => setToName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">Số điện thoại nhận hàng *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={toPhone}
                      onChange={(e) => setToPhone(e.target.value)}
                      required
                    />
                  </div>

                  {/* Địa giới hành chính: Chỉ còn cấp Tỉnh/Thành và Phường/Xã (bỏ cấp Huyện) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">Tỉnh / Thành phố *</label>
                    <SearchableSelect
                      id="shipToProvince"
                      options={provinces.map((p) => ({
                        value: String(p.ProvinceID),
                        label: p.ProvinceName,
                        name: p.ProvinceName,
                      }))}
                      value={String(toProvinceId || '')}
                      onChange={(val) => onProvinceSelect(val)}
                      placeholder="-- Chọn hoặc gõ tìm Tỉnh / Thành --"
                      searchPlaceholder="Gõ tên Tỉnh / Thành..."
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">Phường / Xã *</label>
                    <SearchableSelect
                      id="shipToWard"
                      options={wards.map((w) => ({
                        value: String(w.WardCode),
                        label: w.label || w.WardName,
                        name: w.WardName,
                      }))}
                      value={String(toWardCode || '')}
                      onChange={(val) => onWardSelect(val)}
                      placeholder={!toProvinceId ? 'Chọn Tỉnh trước' : loadingWards ? 'Đang tải danh sách...' : '-- Chọn hoặc gõ tìm Phường / Xã --'}
                      searchPlaceholder="Gõ tên Phường / Xã..."
                      disabled={!toProvinceId || loadingWards || wards.length === 0}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small text-muted mb-1">Số nhà, tên đường chi tiết *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={toAddress}
                      onChange={(e) => setToAddress(e.target.value)}
                      placeholder="VD: Số 24, Ngõ 105 Đường Cầu Giấy"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Thông số kiện hàng & Tiền thu hộ COD */}
              <div className="mb-3">
                <div className="small fw-bold text-uppercase text-muted mb-2">
                  <Package size={14} className="me-1 inline" /> 3. Thông số kiện hàng & Tiền thu hộ
                </div>
                <div className="row g-2">
                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">Khối lượng (gram) *</label>
                    <input
                      type="number"
                      min="100"
                      step="50"
                      className="form-control form-control-sm"
                      value={weight}
                      onChange={(e) => {
                        setWeight(e.target.value);
                        setFeeResult(null);
                      }}
                      required
                    />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">Dài x Rộng x Cao (cm)</label>
                    <div className="input-group input-group-sm">
                      <input
                        type="number"
                        className="form-control text-center p-1"
                        value={length}
                        onChange={(e) => setLength(e.target.value)}
                      />
                      <span className="input-group-text px-1">x</span>
                      <input
                        type="number"
                        className="form-control text-center p-1"
                        value={width}
                        onChange={(e) => setWidth(e.target.value)}
                      />
                      <span className="input-group-text px-1">x</span>
                      <input
                        type="number"
                        className="form-control text-center p-1"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">
                      Tiền thu hộ COD (VND)
                    </label>
                    <div className="input-group input-group-sm">
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        value={customCod}
                        onChange={(e) => setCustomCod(e.target.value)}
                        placeholder="0"
                      />
                      <span className="input-group-text">VND</span>
                    </div>
                    <small className="text-muted shipping-fee-sub">
                      Cước ship do Shop thanh toán. COD chỉ thu tiền hàng/cọc còn thiếu.
                    </small>
                  </div>

                  <div className="col-12">
                    <label className="form-label small text-muted mb-1">Ghi chú cho shipper</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Tra cứu cước phí Preview */}
              <div className="p-3 border rounded-3 bg-light d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                    onClick={handleCalculateFee}
                    disabled={calculatingFee || !toWardCode}
                  >
                    {calculatingFee ? <Loader2 size={14} className="spin" /> : <DollarSign size={14} />}
                    <span>{calculatingFee ? 'Đang tính...' : 'Kiểm tra cước phí'}</span>
                  </button>
                  <span className="small text-muted ms-2">
                    (Dịch vụ chuyển phát Chuẩn của GHN)
                  </span>
                </div>

                {feeResult && (
                  <div className="text-end">
                    <span className="small text-muted d-block">Cước ước tính:</span>
                    <strong className="text-primary fs-6">
                      {formatCurrency(feeResult.total_fee)}
                    </strong>
                    {feeResult.expected_delivery_time && (
                      <div className="text-muted shipping-fee-sub">
                        Giao dự kiến: {formatDate(feeResult.expected_delivery_time)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="modal-footer bg-light border-top">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              form="shipment-create-form"
              className="btn btn-sm btn-primary d-flex align-items-center gap-1"
              disabled={submitting}
            >
              {submitting ? <Loader2 size={14} className="spin" /> : <CheckCircle size={14} />}
              <span>{submitting ? 'Đang gửi GHN...' : 'Xác nhận tạo đơn GHN'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

