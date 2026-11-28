import React, { useState, useEffect, useRef } from 'react';
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
  initialShipment = null,
  orderType = 'rental',
  onSuccess,
}) {
  const {
    provinces,
    wards,
    loadingWards,
    divisionsError,
    provinceId: toProvinceId,
    districtId: toDistrictId,
    wardCode: toWardCode,
    handleProvinceChange,
    handleWardChange,
    resetDivisions,
    reloadDivisions,
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
  const [cooldown, setCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [outOfScopeWarning, setOutOfScopeWarning] = useState('');
  const autoMatchedRef = useRef(false);
  const submittingRef = useRef(false);

  const clearError = () => {
    if (errorMsg) setErrorMsg('');
  };

  // Countdown timer cho nút gửi đơn (khóa nút chống gửi dồn / tránh rate-limit GHN)
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // 1. Khởi tạo/reset dữ liệu form khi mở modal hoặc đổi đơn (không phụ thuộc provinces để tránh ghi đè input người dùng)
  useEffect(() => {
    if (!show || !order) {
      autoMatchedRef.current = false;
      submittingRef.current = false;
      setOutOfScopeWarning('');
      resetDivisions();
      return;
    }

    resetDivisions();
    setOutOfScopeWarning('');
    submittingRef.current = false;

    const {
      receiverName,
      receiverPhone,
      detailedAddress,
    } = extractOrderAddressInfo(order);

    const prevReceiver = initialShipment?.receiverInfo || {};
    setToName(prevReceiver.name || receiverName);
    setToPhone(prevReceiver.phone || receiverPhone);
    setToAddress(prevReceiver.address || detailedAddress);

    setWeight(initialShipment?.weight ? Number(initialShipment.weight) : 500);
    setLength(initialShipment?.length ? Number(initialShipment.length) : 30);
    setWidth(initialShipment?.width ? Number(initialShipment.width) : 20);
    setHeight(initialShipment?.height ? Number(initialShipment.height) : 10);
    setNote(initialShipment?.note || 'Cho khách xem hàng không cho thử');

    // Tính COD mặc định theo số dư chưa thanh toán (đơn đã thanh toán đủ luôn ép về 0 kể cả khi retry)
    let defaultCod = 0;
    if (order.paymentStatus === 'paid') {
      defaultCod = 0;
    } else if (initialShipment?.codAmount !== undefined) {
      defaultCod = initialShipment.codAmount;
    } else {
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
    setCooldown(0);
    autoMatchedRef.current = false;
  }, [show, order, initialShipment, orderType, resetDivisions]);

  // 2. Tự động khớp Tỉnh/Thành (Hà Nội) và Phường/Xã 1 lần khi danh mục provinces sẵn sàng
  useEffect(() => {
    if (!show || !order || provinces.length === 0 || autoMatchedRef.current) return;
    autoMatchedRef.current = true;

    const {
      provHint,
      wardHint,
      wardCodeHint,
      provinceIdHint,
      fullAddr,
    } = extractOrderAddressInfo(order);

    const prevReceiver = initialShipment?.receiverInfo || {};
    const finalProvId = prevReceiver.provinceId || provinceIdHint;
    const finalWardCode = prevReceiver.wardCode || wardCodeHint;
    const finalWardHint = prevReceiver.wardName || wardHint;

    let targetProvId = finalProvId ? String(finalProvId) : '';
    const exists = targetProvId && provinces.some((p) => String(p._id ?? p.ProvinceID) === targetProvId);
    if (!exists) {
      const matchedProv = autoMatchProvince(targetProvId || provHint, fullAddr, provinces);
      if (matchedProv) {
        targetProvId = String(matchedProv._id ?? matchedProv.ProvinceID);
      } else {
        targetProvId = '';
        if (provHint || finalProvId || fullAddr) {
          setOutOfScopeWarning(
            'Địa chỉ đơn hàng nằm ngoài khu vực Hà Nội hoặc chưa xác định được Tỉnh/Thành. Hệ thống hiện chỉ hỗ trợ tạo vận đơn GHN tại Hà Nội.'
          );
        }
      }
    }

    if (targetProvId) {
      setOutOfScopeWarning('');
      handleProvinceChange(targetProvId, finalWardHint, finalWardCode, fullAddr);
    }
  }, [show, order, initialShipment, orderType, provinces, handleProvinceChange]);

  const onProvinceSelect = (val) => {
    setFeeResult(null);
    setOutOfScopeWarning('');
    clearError();
    handleProvinceChange(val);
  };

  const onWardSelect = (val) => {
    setFeeResult(null);
    clearError();
    handleWardChange(val);
  };

  const validateMeasureFields = () => {
    if (!Number.isFinite(Number(weight)) || Number(weight) <= 0) {
      return 'Khối lượng kiện hàng phải lớn hơn 0 (gram).';
    }
    if ([length, width, height].some((d) => !Number.isFinite(Number(d)) || Number(d) <= 0)) {
      return 'Kích thước kiện hàng (Dài, Rộng, Cao) phải lớn hơn 0 cm.';
    }
    return '';
  };

  // 5. Tính trước phí ship (Hỗ trợ GHN v3)
  const handleCalculateFee = async () => {
    if (!toProvinceId || !toWardCode) {
      setErrorMsg('Vui lòng chọn Tỉnh/Thành và Phường/Xã để tính phí giao hàng.');
      return;
    }
    const measureErr = validateMeasureFields();
    if (measureErr) {
      setErrorMsg(measureErr);
      return;
    }
    setErrorMsg('');
    setCalculatingFee(true);
    try {
      const selectedProv = provinces.find((p) => String(p._id ?? p.ProvinceID) === String(toProvinceId));
      const selectedWard = wards.find((w) => String(w.WardCode || w._id) === String(toWardCode));
      const provName = selectedProv?.name || selectedProv?.ProvinceName || '';
      const wardName = selectedWard?.WardName || selectedWard?.name || selectedWard?.label || '';
      const isNewAddress = Number(toProvinceId) >= 1000000 || Boolean(order?.shippingAddress?.isNewAddress);

      const res = await calculateShippingFeeApi({
        orderType,
        orderId: order?._id,
        toProvinceId: Number(toProvinceId),
        toDistrictId: toDistrictId ? Number(toDistrictId) : undefined,
        toWardCode: String(toWardCode || ''),
        toProvinceName: provName,
        toWardName: wardName,
        isNewToAddress: isNewAddress,
        weight: Number(weight),
        length: Number(length),
        width: Number(width),
        height: Number(height),
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

  const formatSubmitError = (err) => {
    const raw = String(err?.message || err || '');
    if (err?.code === 'GHN_TIMEOUT' || err?.status === 504) {
      return {
        msg: 'Cổng GHN phản hồi quá chậm (timeout), vui lòng đợi vài giây rồi kiểm tra lại trước khi gửi lại.',
        needCooldown: true,
      };
    }
    if (err?.status === 429 || raw.toLowerCase().includes('too many request') || raw.toLowerCase().includes('is processing')) {
      return {
        msg: 'GHN đang xử lý tạo đơn cho mã này, vui lòng đợi vài giây rồi thử lại.',
        needCooldown: true,
      };
    }
    return { msg: raw || 'Tạo vận đơn thất bại.', needCooldown: false };
  };

  // 6. Gửi tạo đơn sang GHN
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current || submitting || cooldown > 0) return;
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

    // Kiểm tra và chuẩn hóa số điện thoại Việt Nam (di động 10 số & cố định 02x, hỗ trợ +84/84)
    let cleanPhone = toPhone.trim().replace(/[\s.-]/g, '');
    if (cleanPhone.startsWith('+84')) cleanPhone = '0' + cleanPhone.slice(3);
    else if (cleanPhone.startsWith('84') && cleanPhone.length >= 11) cleanPhone = '0' + cleanPhone.slice(2);

    const vnPhoneRegex = /^(0(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}|02[0-9]{8,9})$/;
    if (!vnPhoneRegex.test(cleanPhone)) {
      setErrorMsg('Số điện thoại không hợp lệ. Vui lòng nhập số di động 10 số hoặc số cố định 02x hợp lệ tại Việt Nam.');
      return;
    }

    if (!toAddress.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ cụ thể.');
      return;
    }
    const measureErr = validateMeasureFields();
    if (measureErr) {
      setErrorMsg(measureErr);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const selectedProv = provinces.find((p) => String(p._id ?? p.ProvinceID) === String(toProvinceId));
      const selectedWard = wards.find((w) => String(w.WardCode || w._id) === String(toWardCode));
      const provName = selectedProv?.name || selectedProv?.ProvinceName || '';
      const wardName = selectedWard?.WardName || selectedWard?.name || selectedWard?.label || '';
      const isNewAddress = Number(toProvinceId) >= 1000000 || Boolean(order?.shippingAddress?.isNewAddress);

      const payload = {
        orderType,
        orderId: order._id,
        toName: toName.trim(),
        toPhone: cleanPhone,
        toAddress: toAddress.trim(),
        toProvinceId: Number(toProvinceId),
        toDistrictId: toDistrictId ? Number(toDistrictId) : undefined,
        toWardCode: String(toWardCode),
        toProvinceName: provName,
        toWardName: wardName,
        isNewToAddress: isNewAddress,
        weight: Number(weight),
        length: Number(length),
        width: Number(width),
        height: Number(height),
        note: note.trim(),
        customCodAmount: customCod === '' ? undefined : Number(customCod),
      };

      const res = await createOutboundShipmentApi(payload);
      if (res?.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setErrorMsg(res?.message || 'Tạo vận đơn thất bại.');
      }
    } catch (err) {
      const { msg, needCooldown } = formatSubmitError(err);
      setErrorMsg(msg);
      if (needCooldown) setCooldown(5);
    } finally {
      submittingRef.current = false;
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="shipment-create-modal-title"
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
                <h6 id="shipment-create-modal-title" className="modal-title fw-bold text-dark mb-0">
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
              aria-label="Đóng"
              onClick={onClose}
              disabled={submitting}
            />
          </div>

          {/* Body */}
          <div className="modal-body p-4">
            {divisionsError && (
              <div role="alert" className="alert alert-warning py-2 px-3 small d-flex align-items-center justify-content-between gap-2 mb-3">
                <div className="d-flex align-items-center gap-2">
                  <AlertCircle size={16} className="text-warning flex-shrink-0" />
                  <span>{divisionsError}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-warning py-0 px-2 flex-shrink-0"
                  onClick={reloadDivisions}
                >
                  Thử tải lại
                </button>
              </div>
            )}

            {outOfScopeWarning && (
              <div role="alert" className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <AlertCircle size={16} className="text-warning flex-shrink-0" />
                <span>{outOfScopeWarning}</span>
              </div>
            )}

            {errorMsg && (
              <div role="alert" className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <AlertCircle size={16} className="text-danger flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} id="shipment-create-form" aria-label="Tạo vận đơn GHN">
              {/* Cửa hàng gửi đồ (Điểm lấy hàng của Shipper) */}
              <div className="mb-3 p-3 bg-light rounded-3 border">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="small fw-bold text-uppercase text-primary d-flex align-items-center gap-1">
                    <Store size={15} /> 1. Cửa hàng gửi đồ (Shipper tới lấy hàng)
                  </div>
                  {storeLat != null && storeLng != null ? (
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
                    {storeLat != null && storeLng != null && (
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
                    <label htmlFor="shipToName" className="form-label small text-muted mb-1">Họ tên người nhận *</label>
                    <input
                      id="shipToName"
                      type="text"
                      className="form-control form-control-sm"
                      value={toName}
                      onChange={(e) => { setToName(e.target.value); clearError(); }}
                      required
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label htmlFor="shipToPhone" className="form-label small text-muted mb-1">Số điện thoại nhận hàng *</label>
                    <input
                      id="shipToPhone"
                      type="text"
                      className="form-control form-control-sm"
                      value={toPhone}
                      onChange={(e) => { setToPhone(e.target.value); clearError(); }}
                      required
                    />
                  </div>

                  {/* Địa giới hành chính: Cấp Tỉnh/Thành và Phường/Xã (Mô hình 2 cấp GHN v3) */}
                  <div className="col-12 col-md-6">
                    <label htmlFor="shipToProvince" className="form-label small text-muted mb-1">Tỉnh / Thành phố *</label>
                    <SearchableSelect
                      id="shipToProvince"
                      options={provinces.map((p) => ({
                        value: String(p._id ?? p.ProvinceID),
                        label: p.name || p.ProvinceName,
                        name: p.name || p.ProvinceName,
                      }))}
                      value={String(toProvinceId || '')}
                      onChange={(val) => onProvinceSelect(val)}
                      placeholder="-- Chọn hoặc gõ tìm Tỉnh / Thành --"
                      searchPlaceholder="Gõ tên Tỉnh / Thành..."
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label htmlFor="shipToWard" className="form-label small text-muted mb-1">Phường / Xã *</label>
                    <SearchableSelect
                      id="shipToWard"
                      options={wards.map((w) => ({
                        value: String(w.WardCode || w._id),
                        label: w.label || w.WardName || w.name,
                        name: w.WardName || w.name,
                      }))}
                      value={String(toWardCode || '')}
                      onChange={(val) => onWardSelect(val)}
                      placeholder={!toProvinceId ? 'Chọn Tỉnh trước' : loadingWards ? 'Đang tải danh sách...' : '-- Chọn hoặc gõ tìm Phường / Xã --'}
                      searchPlaceholder="Gõ tên Phường / Xã..."
                      disabled={!toProvinceId || loadingWards || wards.length === 0}
                    />
                  </div>

                  <div className="col-12">
                    <label htmlFor="shipToAddress" className="form-label small text-muted mb-1">Số nhà, tên đường chi tiết *</label>
                    <input
                      id="shipToAddress"
                      type="text"
                      className="form-control form-control-sm"
                      value={toAddress}
                      onChange={(e) => { setToAddress(e.target.value); clearError(); }}
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
                    <label htmlFor="shipWeight" className="form-label small text-muted mb-1">Khối lượng (gram) *</label>
                    <input
                      id="shipWeight"
                      type="number"
                      min="100"
                      step="50"
                      className="form-control form-control-sm"
                      value={weight}
                      onChange={(e) => {
                        setWeight(e.target.value);
                        setFeeResult(null);
                        clearError();
                      }}
                      required
                    />
                  </div>
                  <div className="col-6 col-md-3">
                    <label htmlFor="shipLength" className="form-label small text-muted mb-1">Dài x Rộng x Cao (cm)</label>
                    <div className="input-group input-group-sm">
                      <input
                        id="shipLength"
                        type="number"
                        aria-label="Chiều dài (cm)"
                        className="form-control text-center p-1"
                        value={length}
                        onChange={(e) => { setLength(e.target.value); setFeeResult(null); clearError(); }}
                      />
                      <span className="input-group-text px-1">x</span>
                      <input
                        id="shipWidth"
                        type="number"
                        aria-label="Chiều rộng (cm)"
                        className="form-control text-center p-1"
                        value={width}
                        onChange={(e) => { setWidth(e.target.value); setFeeResult(null); clearError(); }}
                      />
                      <span className="input-group-text px-1">x</span>
                      <input
                        id="shipHeight"
                        type="number"
                        aria-label="Chiều cao (cm)"
                        className="form-control text-center p-1"
                        value={height}
                        onChange={(e) => { setHeight(e.target.value); setFeeResult(null); clearError(); }}
                      />
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <label htmlFor="shipCustomCod" className="form-label small text-muted mb-1">
                      Tiền thu hộ COD (VND)
                    </label>
                    <div className="input-group input-group-sm">
                      <input
                        id="shipCustomCod"
                        type="number"
                        min="0"
                        className="form-control"
                        value={customCod}
                        onChange={(e) => { setCustomCod(e.target.value); clearError(); }}
                        placeholder="0"
                      />
                      <span className="input-group-text">VND</span>
                    </div>
                    <small className="text-muted shipping-fee-sub">
                      Cước ship do Shop thanh toán. COD chỉ thu tiền hàng/cọc còn thiếu.
                    </small>
                  </div>

                  <div className="col-12">
                    <label htmlFor="shipNote" className="form-label small text-muted mb-1">Ghi chú cho shipper</label>
                    <input
                      id="shipNote"
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
              disabled={submitting || cooldown > 0}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="spin" />
                  <span>Đang gửi GHN...</span>
                </>
              ) : cooldown > 0 ? (
                <>
                  <Loader2 size={14} className="spin" />
                  <span>Vui lòng đợi ({cooldown}s)...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={14} />
                  <span>Xác nhận tạo đơn GHN</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
