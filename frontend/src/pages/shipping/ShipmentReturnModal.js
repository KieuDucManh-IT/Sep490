import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Package,
  AlertCircle,
  CheckCircle,
  Loader2,
  Store,
  ExternalLink,
} from 'lucide-react';
import { createReturnShipmentApi } from '../../services/shippingApi';
import {
  autoMatchProvince,
  extractOrderAddressInfo,
} from './shippingUtils';
import { useAdministrativeDivisions } from './hooks/useAdministrativeDivisions';
import SearchableSelect from '../../components/SearchableSelect';
import '../../styles/ShippingModal.css';

export default function ShipmentReturnModal({
  show,
  onClose,
  order,
  onSuccess,
}) {
  const {
    provinces,
    wards,
    loadingWards,
    provinceId: fromProvinceId,
    districtId: fromDistrictId,
    wardCode: fromWardCode,
    handleProvinceChange,
    handleWardChange,
  } = useAdministrativeDivisions(show);

  // Form State
  const [fromName, setFromName] = useState('');
  const [fromPhone, setFromPhone] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [weight, setWeight] = useState(500);
  const [note, setNote] = useState('Thu hồi trang phục cho thuê hoàn trả về shop');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Tự động khớp Tỉnh / Xã từ thông tin đơn hàng
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

    setFromName(receiverName);
    setFromPhone(receiverPhone);
    setFromAddress(detailedAddress);
    setErrorMsg('');

    // Tự động phân tích và chọn Tỉnh/Thành, Phường/Xã cho điểm lấy đồ
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
  }, [show, order, provinces, handleProvinceChange]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromProvinceId) {
      setErrorMsg('Vui lòng chọn Tỉnh/Thành phố nơi shipper tới lấy đồ trả.');
      return;
    }
    if (!fromWardCode) {
      setErrorMsg('Vui lòng chọn Phường/Xã nơi shipper tới lấy đồ trả.');
      return;
    }
    if (!fromPhone.trim()) {
      setErrorMsg('Vui lòng nhập số điện thoại người trả.');
      return;
    }

    // Kiểm tra và chuẩn hóa số điện thoại di động Việt Nam 10 số (hỗ trợ cả đầu số +84, 84)
    let cleanPhone = fromPhone.trim().replace(/[\s.-]/g, '');
    if (cleanPhone.startsWith('+84')) cleanPhone = '0' + cleanPhone.slice(3);
    else if (cleanPhone.startsWith('84') && cleanPhone.length === 11) cleanPhone = '0' + cleanPhone.slice(2);

    const vnPhoneRegex = /^(0)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
    if (!vnPhoneRegex.test(cleanPhone)) {
      setErrorMsg('Số điện thoại không hợp lệ. Vui lòng nhập số di động 10 số hiện hành của Việt Nam (VD: 0912345678, 0388889999). Đầu số cũ 012x đã bị ngừng sử dụng và không được GHN chấp nhận.');
      return;
    }

    if (!fromAddress.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ cụ thể nơi shipper tới lấy đồ.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        orderId: order._id,
        fromName: fromName.trim(),
        fromPhone: cleanPhone,
        fromAddress: fromAddress.trim(),
        fromProvinceId: Number(fromProvinceId),
        fromDistrictId: Number(fromDistrictId),
        fromWardCode: String(fromWardCode || ''),
        weight: Number(weight) || 500,
        note: note.trim(),
      };

      const res = await createReturnShipmentApi(payload);
      if (res?.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setErrorMsg(res?.message || 'Tạo yêu cầu thu hồi thất bại.');
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
              <div className="p-2 rounded bg-info text-white">
                <RotateCcw size={18} />
              </div>
              <div>
                <h6 className="modal-title fw-bold text-dark mb-0">
                  Tạo Yêu Cầu Thu Hồi Đồ Thuê (GHN)
                </h6>
                <small className="text-muted">
                  Đơn thuê: <strong>{order.orderCode}</strong> • Shipper tới lấy đồ từ khách mang về chi nhánh
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

            <form onSubmit={handleSubmit} id="shipment-return-form">
              {/* Điểm nhận hàng hoàn trả (Cửa hàng) */}
              <div className="mb-3 p-3 bg-light rounded-3 border">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="small fw-bold text-uppercase text-primary d-flex align-items-center gap-1">
                    <Store size={15} /> 1. Cửa hàng tiếp nhận đồ hoàn (Shipper giao trả về)
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
                    <span className="small text-muted d-block">Cửa hàng tiếp nhận đồ:</span>
                    <strong className="text-dark small me-1">{storeName}</strong>
                    {storePhone && <span className="d-block small text-muted">Hotline cửa hàng: {storePhone}</span>}
                  </div>
                  <div className="col-12 col-md-6">
                    <span className="small text-muted d-block">Địa chỉ cửa hàng nhận:</span>
                    <span className="text-dark small d-block">{storeAddress}</span>
                    {storeLat && storeLng && (
                      <span className="small text-muted shipping-fee-sub">
                        📍 Tọa độ GPS: {Number(storeLat).toFixed(4)}, {Number(storeLng).toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Thông tin người trả hàng (Khách hàng) */}
              <div className="mb-3">
                <div className="small fw-bold text-uppercase text-muted mb-2">
                  2. Địa điểm shipper tới lấy đồ từ khách
                </div>
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">Họ tên người trả đồ *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">Số điện thoại liên hệ *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={fromPhone}
                      onChange={(e) => setFromPhone(e.target.value)}
                      required
                    />
                  </div>

                  {/* Địa giới hành chính: Chỉ còn cấp Tỉnh/Thành và Phường/Xã (bỏ cấp Huyện) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">Tỉnh / Thành phố *</label>
                    <SearchableSelect
                      id="returnFromProvince"
                      options={provinces.map((p) => ({
                        value: String(p.ProvinceID),
                        label: p.ProvinceName,
                        name: p.ProvinceName,
                      }))}
                      value={String(fromProvinceId || '')}
                      onChange={(val) => handleProvinceChange(val)}
                      placeholder="-- Chọn hoặc gõ tìm Tỉnh / Thành --"
                      searchPlaceholder="Gõ tên Tỉnh / Thành..."
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">Phường / Xã *</label>
                    <SearchableSelect
                      id="returnFromWard"
                      options={wards.map((w) => ({
                        value: String(w.WardCode),
                        label: w.label || w.WardName,
                        name: w.WardName,
                      }))}
                      value={String(fromWardCode || '')}
                      onChange={(val) => handleWardChange(val)}
                      placeholder={!fromProvinceId ? 'Chọn Tỉnh trước' : loadingWards ? 'Đang tải danh sách...' : '-- Chọn hoặc gõ tìm Phường / Xã --'}
                      searchPlaceholder="Gõ tên Phường / Xã..."
                      disabled={!fromProvinceId || loadingWards || wards.length === 0}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small text-muted mb-1">Số nhà, tên đường chi tiết *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={fromAddress}
                      onChange={(e) => setFromAddress(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Khối lượng & Ghi chú */}
              <div className="mb-3">
                <div className="small fw-bold text-uppercase text-muted mb-2">
                  <Package size={14} className="me-1 inline" /> 3. Thông tin gói đồ & Ghi chú
                </div>
                <div className="row g-2">
                  <div className="col-6 col-md-4">
                    <label className="form-label small text-muted mb-1">Khối lượng ước tính (gram)</label>
                    <input
                      type="number"
                      min="100"
                      step="50"
                      className="form-control form-control-sm"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-8">
                    <label className="form-label small text-muted mb-1">Ghi chú vận chuyển</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>
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
              form="shipment-return-form"
              className="btn btn-sm btn-info text-white d-flex align-items-center gap-1"
              disabled={submitting}
            >
              {submitting ? <Loader2 size={14} className="spin" /> : <CheckCircle size={14} />}
              <span>{submitting ? 'Đang gửi GHN...' : 'Xác nhận tạo đơn thu hồi'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
