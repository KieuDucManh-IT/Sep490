import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
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
import { Modal as ReturnFlowModal } from 'react-bootstrap';
import {
  getRentalReturnFlow,
  requestRentalReturn,
  advanceRentalReturn,
  completeRentalReturn,
  uploadRentalEvidence,
} from '../../services/rentalReturnApi';
import {
  getSalesReturnFlow,
  requestSalesReturn,
  advanceSalesReturn,
  completeSalesReturn,
  uploadSalesEvidence,
} from '../../services/salesOrderApi';

const RETURN_APIS = {
  rental: {
    get: getRentalReturnFlow,
    request: requestRentalReturn,
    advance: advanceRentalReturn,
    complete: completeRentalReturn,
    upload: uploadRentalEvidence,
  },
  sale: {
    get: getSalesReturnFlow,
    request: requestSalesReturn,
    advance: advanceSalesReturn,
    complete: completeSalesReturn,
    upload: uploadSalesEvidence,
  },
};

export default function ShipmentReturnModal({
  show,
  onClose,
  order,
  initialShipment = null,
  onSuccess,
  isCustomer = false,
  orderType = 'rental',
  orderItemsProp = null,
}) {
  const isSale = orderType === 'sale';
  const itemIdOf = (it) => String(it._id || it.id || it.detailId || '');
  const getItemMaxQty = useCallback(
    (it) => Math.max(1, Number(isSale ? it.quantity : (it.remainingQuantity ?? it.quantity)) || 1),
    [isSale]
  );
  const defaultReturnNote = isSale
    ? 'Khách hàng gửi trả lại sản phẩm mua về cửa hàng'
    : (isCustomer ? 'Khách hàng gửi trả lại trang phục thuê về cửa hàng' : 'Thu hồi trang phục cho thuê hoàn trả về shop');
  const allOrderItems = React.useMemo(() => {
    if (!order) return [];
    const list = orderItemsProp || order.items || order.details || [];
    return Array.isArray(list) ? list : [];
  }, [order, orderItemsProp]);
  const selectableItems = React.useMemo(() => {
    if (isSale) return allOrderItems;
    return allOrderItems.filter((it) => Number(it.remainingQuantity ?? it.quantity ?? 1) > 0);
  }, [isSale, allOrderItems]);

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
  const [length, setLength] = useState(20);
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(10);
  const [reason, setReason] = useState('');
  const [selectedMap, setSelectedMap] = useState({});
  const [note, setNote] = useState(defaultReturnNote);

  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Countdown timer cho nút gửi đơn (khóa nút chống gửi dồn / tránh rate-limit GHN)
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Khởi tạo dữ liệu form khi mở modal hoặc đổi đơn
  useEffect(() => {
    if (!show || !order) return;

    const {
      receiverName,
      receiverPhone,
      detailedAddress,
    } = extractOrderAddressInfo(order);

    const prevSender = initialShipment?.senderInfo || initialShipment?.receiverInfo || {};
    setFromName(prevSender.name || receiverName);
    setFromPhone(prevSender.phone || receiverPhone);
    setFromAddress(prevSender.address || detailedAddress);

    // Tự động kế thừa kích thước & cân nặng từ đơn gửi đi (Outbound) nếu có
    const outbound = (order?.shipments && Array.isArray(order.shipments))
      ? order.shipments.find((s) => s.shipmentType === 'outbound')
      : null;
    const sourceShipment = initialShipment || outbound;

    setWeight(sourceShipment?.weight ? Number(sourceShipment.weight) : 500);
    setLength(sourceShipment?.length ? Number(sourceShipment.length) : 20);
    setWidth(sourceShipment?.width ? Number(sourceShipment.width) : 20);
    setHeight(sourceShipment?.height ? Number(sourceShipment.height) : 10);
    setNote(sourceShipment?.note || defaultReturnNote);
    setReason('');
    if (selectableItems.length > 0) {
      const initMap = {};
      selectableItems.forEach((it) => {
        const dId = itemIdOf(it);
        if (dId) initMap[dId] = { checked: true, quantity: getItemMaxQty(it) };
      });
      setSelectedMap(initMap);
    } else {
      setSelectedMap({});
    }
    setErrorMsg('');
    setCooldown(0);
  }, [show, order, initialShipment, isSale, isCustomer, selectableItems, defaultReturnNote, getItemMaxQty]);

  // Tự động khớp Tỉnh / Xã từ thông tin đơn hàng / initialShipment (không ghi đè input người dùng)
  useEffect(() => {
    if (!show || !order || provinces.length === 0) return;

    const {
      provHint,
      wardHint,
      wardCodeHint,
      provinceIdHint,
      fullAddr,
    } = extractOrderAddressInfo(order);

    const prevSender = initialShipment?.senderInfo || initialShipment?.receiverInfo || {};
    const finalProvId = prevSender.provinceId || provinceIdHint;
    const finalWardCode = prevSender.wardCode || wardCodeHint;

    let targetProvId = finalProvId ? String(finalProvId) : '';
    const exists = targetProvId && provinces.some((p) => String(p._id || p.ProvinceID) === targetProvId);
    if (!exists) {
      const matchedProv = autoMatchProvince(targetProvId || provHint, fullAddr, provinces);
      if (matchedProv) {
        targetProvId = String(matchedProv._id || matchedProv.ProvinceID);
      }
    }

    if (targetProvId) {
      handleProvinceChange(targetProvId, wardHint, finalWardCode, fullAddr);
    }
  }, [show, order, initialShipment, provinces, handleProvinceChange]);

  const formatErrorText = (msg) => {
    const raw = String(msg || '');
    if (raw.toLowerCase().includes('too many request') || raw.toLowerCase().includes('is processing')) {
      return 'GHN đang xử lý tạo đơn cho mã này, vui lòng đợi vài giây rồi thử lại.';
    }
    return raw;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || cooldown > 0) return;
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

    const selectedItems = selectableItems
      .map((it) => {
        const dId = itemIdOf(it);
        const sel = selectedMap[dId];
        if (!dId || !sel?.checked) return null;
        const qty = Math.max(1, Math.min(getItemMaxQty(it), Number(sel.quantity || 1)));
        return isSale
          ? { salesOrderDetailId: dId, quantityReturned: qty }
          : { rentalOrderDetailId: dId, quantityReturned: qty };
      })
      .filter(Boolean);

    if ((isSale || selectableItems.length > 0) && !selectedItems.length) {
      setErrorMsg('Vui lòng chọn ít nhất 1 sản phẩm cần hoàn trả.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const selectedProv = provinces.find((p) => String(p._id || p.ProvinceID) === String(fromProvinceId));
      const selectedWard = wards.find((w) => String(w.WardCode || w._id) === String(fromWardCode));
      const provName = selectedProv?.name || selectedProv?.ProvinceName || order?.shippingAddress?.city || '';
      const wardName = selectedWard?.WardName || selectedWard?.name || selectedWard?.label || order?.shippingAddress?.ward || '';
      const isNewAddress = Number(fromProvinceId) >= 1000000 || Boolean(order?.shippingAddress?.isNewAddress);

      const payload = {
        orderId: order._id,
        orderType,
        fromName: fromName.trim(),
        fromPhone: cleanPhone,
        fromAddress: fromAddress.trim(),
        fromProvinceId: Number(fromProvinceId),
        fromDistrictId: fromDistrictId ? Number(fromDistrictId) : undefined,
        fromWardCode: String(fromWardCode || ''),
        fromProvinceName: provName,
        fromWardName: wardName,
        isNewFromAddress: isNewAddress,
        weight: Number(weight) || 500,
        length: Number(length) || 20,
        width: Number(width) || 20,
        height: Number(height) || 10,
        note: note.trim(),
        ...(isSale
          ? { reason: reason.trim(), items: selectedItems }
          : (selectedItems.length > 0 ? { items: selectedItems } : {})),
      };

      const res = await createReturnShipmentApi(payload);
      if (res?.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setErrorMsg(formatErrorText(res?.message || 'Tạo yêu cầu thu hồi thất bại.'));
        setCooldown(5);
      }
    } catch (err) {
      setErrorMsg(formatErrorText(err.message || 'Lỗi khi kết nối hệ thống GHN.'));
      setCooldown(5);
    } finally {
      setSubmitting(false);
    }
  };

  if (!show || !order) return null;

  const isFullSelection = selectableItems.length > 0 && selectableItems.every((it) => {
    const sel = selectedMap[itemIdOf(it)];
    return sel?.checked && Number(sel.quantity || 1) === getItemMaxQty(it);
  });
  const selectedQtyOf = (it) => {
    const sel = selectedMap[itemIdOf(it)];
    if (!sel?.checked) return 0;
    return Math.max(1, Math.min(getItemMaxQty(it), Number(sel.quantity || 1)));
  };
  const netMerchandise = Math.max(0, Number(order.subtotal || 0) - Number(order.discountAmount || 0))
    || Math.max(0, Number(order.totalAmount || 0) - Number(order.shippingFee || 0));
  const rawSubtotal = selectableItems.reduce((sum, d) => sum + Number(d.lineTotal || 0), 0);
  const partialSaleRefundSum = selectableItems.reduce((sum, it) => {
    const qty = selectedQtyOf(it);
    if (!qty) return sum;
    const proportion = rawSubtotal > 0 ? Number(it.lineTotal || 0) / rawSubtotal : 0;
    return sum + Math.round(netMerchandise * proportion * (qty / Math.max(1, Number(it.quantity || 1))));
  }, 0);

  const rentalRemainingLocked = Math.max(
    0,
    Number(order.depositAmount || 0) - Number(order.refundedDepositAmount || 0) - Number(order.deductedDepositAmount || 0)
  );
  const totalRentalFeeBasis = allOrderItems.reduce(
    (sum, d) => sum + Number(d.lineTotal || (Number(d.unitPrice || 0) * Math.max(1, Number(d.quantity || 1)))),
    0
  );
  const estimateRentalItemDeposit = (it, selQty) => {
    const perUnit = Number(it.depositPerUnit || 0);
    if (perUnit > 0) return perUnit * selQty;
    const origQty = Math.max(1, Number(it.quantity || 1));
    const lineBasis = Number(it.lineTotal || (Number(it.unitPrice || 0) * origQty));
    if (totalRentalFeeBasis > 0) {
      return Math.round(Number(order.depositAmount || 0) * (lineBasis / totalRentalFeeBasis) * (selQty / origQty));
    }
    return Math.round(rentalRemainingLocked * (selQty / Math.max(1, getItemMaxQty(it))));
  };
  const partialRentalDepositSum = Math.min(
    rentalRemainingLocked,
    selectableItems.reduce((sum, it) => {
      const qty = selectedQtyOf(it);
      return qty ? sum + estimateRentalItemDeposit(it, qty) : sum;
    }, 0)
  );

  const estimatedRefundAmount = isSale
    ? (isFullSelection
      ? Number(order.totalAmount || 0)
      : Math.min(Number(order.paidAmount || order.totalAmount || 0), Math.max(0, partialSaleRefundSum)))
    : (isFullSelection ? rentalRemainingLocked : partialRentalDepositSum);

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
              <div className="p-2 rounded bg-warning text-dark">
                <RotateCcw size={18} />
              </div>
              <div>
                <h6 className="modal-title fw-bold text-dark mb-0">
                  {isSale
                    ? (isCustomer ? 'Yêu Cầu Trả Hàng Mua Qua GHN' : 'Tạo Vận Đơn Thu Hồi Hàng Mua (GHN)')
                    : (isCustomer ? 'Yêu Cầu Trả Đồ Thuê Qua GHN' : 'Tạo Vận Đơn Thu Hồi Đồ Thuê (GHN)')}
                </h6>
                <small className="text-muted">
                  Đơn hàng: <strong>{order.orderCode}</strong>
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
                    <Store size={15} /> {isCustomer ? '1. Cửa hàng tiếp nhận đồ hoàn trả' : '1. Cửa hàng tiếp nhận đồ hoàn (Shipper giao trả về)'}
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
                  {isCustomer ? '2. Địa chỉ shipper tới lấy đồ từ quý khách' : '2. Địa điểm shipper tới lấy đồ từ khách'}
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

                  {/* Địa giới hành chính: Cấp Tỉnh/Thành và Phường/Xã (Mô hình 2 cấp GHN v3) */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">Tỉnh / Thành phố *</label>
                    <SearchableSelect
                      id="returnFromProvince"
                      options={provinces.map((p) => ({
                        value: String(p._id || p.ProvinceID),
                        label: p.name || p.ProvinceName,
                        name: p.name || p.ProvinceName,
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
                        value: String(w.WardCode || w._id),
                        label: w.label || w.WardName || w.name,
                        name: w.WardName || w.name,
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
                      placeholder="VD: Số 24, Ngõ 105 Đường Cầu Giấy"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Chọn sản phẩm hoàn trả */}
              {(isSale || selectableItems.length > 0) && (
                <div className="mb-3 p-3 bg-light rounded-3 border">
                  <div className="small fw-bold text-uppercase text-muted mb-2">
                    {isSale ? '3. Chọn sản phẩm cần trả & Lý do' : '3. Chọn trang phục trả đợt này'}
                  </div>
                  <div className="table-responsive mb-2">
                    <table className="table table-sm align-middle mb-0 bg-white rounded">
                      <thead className="table-light">
                        <tr className="small text-muted">
                          <th style={{ width: 34 }}>Chọn</th>
                          <th>Sản phẩm</th>
                          <th style={{ width: 110 }}>Số lượng trả</th>
                          <th className="text-end" style={{ width: 120 }}>
                            {isSale ? 'Giá dòng' : 'Cọc dự kiến'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectableItems.map((it) => {
                          const dId = itemIdOf(it);
                          const maxQty = getItemMaxQty(it);
                          const sel = selectedMap[dId] || { checked: true, quantity: maxQty };
                          const selQty = Math.max(1, Math.min(maxQty, Number(sel.quantity || 1)));
                          const pName = it.variantId?.productId?.name || it.productName || it.name || 'Sản phẩm';
                          const sizeColor = [it.variantId?.size || it.size, it.variantId?.color || it.color].filter(Boolean).join(' · ');
                          const returnedQty = Number(it.returnedQuantity || 0);
                          const rowAmount = isSale
                            ? Number(it.lineTotal || 0)
                            : estimateRentalItemDeposit(it, sel.checked ? selQty : maxQty);
                          return (
                            <tr key={dId} className="small">
                              <td>
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={Boolean(sel.checked)}
                                  onChange={(e) =>
                                    setSelectedMap((prev) => ({
                                      ...prev,
                                      [dId]: { checked: e.target.checked, quantity: sel.quantity || maxQty },
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <div className="fw-semibold text-dark">{pName}</div>
                                {sizeColor && <div className="text-muted" style={{ fontSize: '11px' }}>{sizeColor}</div>}
                                {!isSale && returnedQty > 0 && (
                                  <div className="text-info" style={{ fontSize: '11px' }}>
                                    Đã trả {returnedQty}/{it.quantity}
                                  </div>
                                )}
                              </td>
                              <td>
                                {maxQty > 1 ? (
                                  <div className="d-flex align-items-center gap-1">
                                    <input
                                      type="number"
                                      min={1}
                                      max={maxQty}
                                      disabled={!sel.checked}
                                      className="form-control form-control-sm"
                                      style={{ width: 62 }}
                                      value={sel.quantity || 1}
                                      onChange={(e) => {
                                        const val = Math.max(1, Math.min(maxQty, Number(e.target.value) || 1));
                                        setSelectedMap((prev) => ({
                                          ...prev,
                                          [dId]: { checked: true, quantity: val },
                                        }));
                                      }}
                                    />
                                    <span className="text-muted">/ {maxQty}</span>
                                  </div>
                                ) : (
                                  <span>1 / 1</span>
                                )}
                              </td>
                              <td className="text-end fw-semibold">
                                {Number(rowAmount || 0).toLocaleString('vi-VN')}đ
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="d-flex justify-content-between align-items-center small py-2 px-2 bg-white rounded border mb-2">
                    <span className="text-muted">
                      {isSale
                        ? 'Dự kiến hoàn vào Ví Vestora sau KCS:'
                        : 'Dự kiến hoàn cọc đợt này (chưa trừ phí trễ/hư hỏng nếu có):'}
                    </span>
                    <strong className="text-success">
                      {estimatedRefundAmount.toLocaleString('vi-VN')}đ
                      {!isFullSelection && <span className="text-muted fw-normal"> (Trả một phần)</span>}
                    </strong>
                  </div>
                  {isSale && (
                    <div>
                      <label className="form-label small text-muted mb-1">Lý do trả hàng (không bắt buộc)</label>
                      <input
                        type="text"
                        maxLength={1000}
                        className="form-control form-control-sm"
                        placeholder="VD: Mặc không vừa, muốn đổi trả..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Thông số kiện hàng & Ghi chú */}
              <div className="mb-3">
                <div className="small fw-bold text-uppercase text-muted mb-2">
                  <Package size={14} className="me-1 inline" /> {(isSale || selectableItems.length > 0) ? '4.' : '3.'} Thông số kiện hàng & Ghi chú
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">Cân nặng (g) *</label>
                    <input
                      type="number"
                      min="100"
                      step="50"
                      className="form-control form-control-sm"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">Dài (cm)</label>
                    <input
                      type="number"
                      min="5"
                      className="form-control form-control-sm"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                    />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">Rộng (cm)</label>
                    <input
                      type="number"
                      min="5"
                      className="form-control form-control-sm"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                    />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">Cao (cm)</label>
                    <input
                      type="number"
                      min="5"
                      className="form-control form-control-sm"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    />
                  </div>
                </div>
                <div className="row g-2">
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
                  <span>
                    {isCustomer ? 'Gửi yêu cầu shipper tới lấy đồ' : 'Xác nhận tạo đơn thu hồi GHN'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export function RentalReturnWorkflow({
  show,
  orderId,
  onClose,
  orderType = 'rental',
  readOnly = false,
}) {
  if (!show || !orderId) return null;

  return (
    <RentalReturnWorkflowBody
      key={orderType + ':' + orderId}
      orderId={orderId}
      onClose={onClose}
      orderType={orderType}
      readOnly={readOnly}
    />
  );
}

function useRentalEvidence(orderId, orderType = 'rental') {
  const api = RETURN_APIS[orderType];
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const busyRef = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const current = ++generation.current;

    try {
      const response = await api.get(orderId);

      if (mounted.current && current === generation.current) {
        // Giữ URL đang phát để polling không làm video chạy lại.
        const keepVideo = (previous, next) =>
          previous?.uploadedAt === next?.uploadedAt &&
            previous?.expiresAt > Date.now() + 60000
            ? previous
            : next;

        setData(previous => ({
          ...response.data,

          ...Object.fromEntries(
            [
              'packingVideo',
              'receivingVideo',
              'returnVideo',
              'returnReceivedVideo',
            ].map(field => [
              field,
              keepVideo(previous?.[field], response.data[field]),
            ])
          ),
        }));
      }
    } catch (err) {
      if (mounted.current && current === generation.current) {
        setError(err.message);
      }
    }
  }, [orderId, api]);

  useEffect(() => {
    mounted.current = true;
    load();

    const timer = setInterval(() => {
      if (!busyRef.current) load();
    }, 5000);

    return () => {
      mounted.current = false;
      generation.current += 1;
      clearInterval(timer);
    };
  }, [load]);

  async function run(action) {
    if (busyRef.current) return;

    busyRef.current = true;
    generation.current += 1;
    setBusy(true);
    setError('');

    try {
      const result = await action();
      await load();
      return result;
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function upload(kind, file) {
    if (!file) return;

    if (
      !['video/mp4', 'video/webm'].includes(file.type) ||
      file.size > 50 * 1024 * 1024
    ) {
      setError('Chọn video MP4/WebM, tối đa 50 MB và 5 phút.');
      return;
    }

    run(() => api.upload(orderId, kind, file));
  }
  return { data, error, busy, run, upload, api };
}

function EvidenceVideos({
  data,
  busy,
  upload,
  stage,
  orderType = 'rental',
  readOnly = false,
}) {
  const definitions = stage === 'delivery'
    ? [
      {
        kind: 'packing',
        field: 'packingVideo',
        label:
          'Shop: video sản phẩm trước khi giao hàng' +
          (orderType === 'sale' ? ' (bắt buộc)' : ''),
      },
      {
        kind: 'receiving',
        field: 'receivingVideo',
        label: 'Khách: video nhận hàng (không bắt buộc)',
      },
    ]
    : [
      {
        kind: 'return',
        field: 'returnVideo',
        label: 'Khách: video trước khi trả đồ (không bắt buộc)',
      },
      {
        kind: 'return-received',
        field: 'returnReceivedVideo',
        label: orderType === 'sale'
          ? 'Shop: video nhận hàng trả (bắt buộc trước khi hoàn tiền)'
          : 'Shop: video nhận đồ trả (bắt buộc trước khi hoàn cọc)',
      },
    ];

  return (
    <div className="row g-3">
      {definitions.map(item => {
        const video = data[item.field];

        const canUpload =
          !readOnly &&
          data.videoPermissions?.[item.kind] &&
          !video;

        return (
          <div className="col-md-6" key={item.field}>
            <label
              className="d-block fw-semibold"
              htmlFor={`video-${item.field}`}
            >
              {item.label}
            </label>

            {video ? (
              <>
                <video
                  aria-label={item.label}
                  src={video.url}
                  controls
                  playsInline
                  preload="none"
                  style={{ width: '100%' }}
                />

                <small>
                  Tải lên:{' '}
                  {new Date(video.uploadedAt).toLocaleString('vi-VN')}
                </small>
              </>
            ) : canUpload ? (
              <>
                <input
                  id={`video-${item.field}`}
                  type="file"
                  accept="video/mp4,video/webm"
                  disabled={busy}
                  onChange={event => {
                    upload(item.kind, event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />

                <div className="small text-muted">
                  MP4/WebM · tối đa 50 MB, 5 phút
                </div>
              </>
            ) : (
              <p className="text-muted">Chưa có video.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function RentalDeliveryVideos({
  orderId,
  readOnly = false,
  orderType = 'rental',
  onChange,
}) {
  if (!orderId) return null;

  return (
    <RentalDeliveryVideosBody
      key={orderType + ':' + orderId}
      orderId={orderId}
      readOnly={readOnly}
      orderType={orderType}
      onChange={onChange}
    />
  );
}

function RentalDeliveryVideosBody({
  orderId,
  readOnly,
  orderType,
  onChange,
}) {
  const { data, error, busy, upload } =
    useRentalEvidence(orderId, orderType);

  useEffect(() => {
    onChange?.(data);
  }, [data, onChange]);

  return (
    <section className="modal-section-card">
      <div className="modal-section-header">
        <h6 className="modal-section-title">
          5. Video giao hàng và nhận hàng
        </h6>
      </div>

      {error && (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      )}

      {data ? (
        <EvidenceVideos
          data={data}
          busy={busy}
          upload={upload}
          stage="delivery"
          orderType={orderType}
          readOnly={readOnly}
        />
      ) : (
        <p>Đang tải video…</p>
      )}

      {orderType === 'sale' &&
        data?.videoPermissions?.packing &&
        !data.packingVideo && (
          <p className="small text-muted mt-2">
            Chi nhánh cần tải video đóng hàng trước khi tạo vận đơn
            hoặc xác nhận đã giao.
          </p>
        )}

      {busy && <p role="status">Đang tải video lên…</p>}
    </section>
  );
}

function RentalReturnWorkflowBody({
  orderId,
  onClose,
  orderType,
  readOnly,
}) {
  const { data, error, busy, run, upload, api } =
    useRentalEvidence(orderId, orderType);

  const isSale = orderType === 'sale';
  const [confirmed, setConfirmed] = useState(false);
  const [batchNotice, setBatchNotice] = useState('');
  const errorRef = useRef(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [error]);

  const shipment = data?.shipment;
  const status = shipment?.shipmentStatus;

  const statusText = {
    preparing: 'Chờ lấy đồ',
    shipped: 'Đang chuyển về shop',
    delivered: 'Đã về shop, chờ nghiệm thu',
  };

  const date = value =>
    value ? new Date(value).toLocaleString('vi-VN') : '—';

  return (
    <ReturnFlowModal
      show
      onHide={() => !busy && onClose()}
      size="lg"
      centered
      backdrop="static"
    >
      <ReturnFlowModal.Header closeButton={!busy}>
        <ReturnFlowModal.Title>
          {isSale ? 'Trả hàng đã mua' : 'Trả đồ thuê'}{' '}
          {data?.orderCode ? `#${data.orderCode}` : ''}
        </ReturnFlowModal.Title>
      </ReturnFlowModal.Header>

      <ReturnFlowModal.Body
        style={{ maxHeight: '75vh', overflowY: 'auto' }}
      >
        {error && (
          <div ref={errorRef} role="alert" className="alert alert-danger">
            {error}
          </div>
        )}

        {!data ? (
          <p>Đang tải thông tin trả đồ…</p>
        ) : (
          <>
            <section className="border rounded p-3 mb-3">
              <h6>
                {isSale ? 'Khách hàng & đơn mua' : 'Khách hàng & thời gian thuê'}
              </h6>
              <div>
                {data.customer.name} · {data.customer.phone}
              </div>
              <p>{data.customer.address}</p>

              <div>
                {isSale ? (
                  <>Ngày mua: {date(data.createdAt)}</>
                ) : (
                  <>
                    Ngày thuê: {date(data.startDate)}
                    {' · '}
                    Hạn trả: {date(data.dueDate)}
                  </>
                )}
              </div>

              <hr />

              <strong>Nơi nhận trả: {data.shop.name}</strong>
              <div>
                {data.shop.address} · {data.shop.phone}
              </div>
            </section>

            <section className="border rounded p-3 mb-3">
              <h6>
                {!isSale && data.isPartialOrder
                  ? `Trang phục trả đợt này (${data.items.length})`
                  : `Trang phục hoàn trả (${data.items.length})`}
              </h6>

              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Phân loại</th>
                    <th>Số lượng</th>
                  </tr>
                </thead>

                <tbody>
                  {data.items.map(item => (
                    <tr key={item.id}>
                      <td>
                        {item.image && (
                          <img
                            src={item.image}
                            alt=""
                            style={{
                              width: 48,
                              height: 60,
                              objectFit: 'cover',
                              marginRight: 10,
                            }}
                          />
                        )}

                        {item.name}
                        <div className="small text-muted">
                          {item.sku}
                        </div>
                      </td>

                      <td>
                        {[item.size, item.color]
                          .filter(Boolean)
                          .join(' · ')}
                      </td>

                      <td>{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="border rounded p-3 mb-3">
              <h6>Video trả đồ và nhận đồ trả</h6>
              <EvidenceVideos
                orderType={orderType}
                readOnly={readOnly}
                data={data}
                busy={busy}
                upload={upload}
                stage="return"
              />
            </section>

            {shipment && (
              <section className="border rounded p-3 mb-3">
                <h6>
                  {shipment.carrierName}{' '}
                  {shipment.isSimulated && (
                    <span className="badge bg-warning text-dark">
                      Mô phỏng
                    </span>
                  )}
                </h6>

                <div style={{ overflowWrap: 'anywhere' }}>
                  Mã vận đơn: {shipment.trackingCode}
                </div>

                <strong>
                  {data.completed
                    ? (isSale ? 'Đã trả hàng hoàn tất' : 'Hoàn tất trả đồ')
                    : statusText[status] || status}
                </strong>

                <p>
                  Từ {shipment.senderInfo?.name}
                  {' → '}
                  {shipment.receiverInfo?.name}
                </p>

                <h6>Hành trình trả đồ</h6>

                <ol>
                  {[...(shipment.statusHistory || [])]
                    .reverse()
                    .map((event, i) => (
                      <li key={i} className="mb-2">
                        {event.description}
                        <div className="small text-muted">
                          {date(event.timestamp)}
                        </div>
                      </li>
                    ))}
                </ol>
              </section>
            )}

            {!isSale && data.isPartialOrder && !data.completed && (
              <div className="alert alert-info py-2 small mb-3">
                Đã hoàn cọc các đợt trước:{' '}
                <strong>{Number(data.refundedDepositAmount || 0).toLocaleString('vi-VN')}đ</strong>
                {Number(data.deductedDepositAmount || 0) > 0 && (
                  <>
                    {' · '}
                    Đã khấu trừ:{' '}
                    <strong>{Number(data.deductedDepositAmount).toLocaleString('vi-VN')}đ</strong>
                  </>
                )}
                {' · '}
                Cọc còn lại đang giữ:{' '}
                <strong>{Number(data.remainingDepositAmount || 0).toLocaleString('vi-VN')}đ</strong>
              </div>
            )}

            {batchNotice && !data.completed && (
              <div role="status" className="alert alert-success">
                {batchNotice}
              </div>
            )}

            {data.completed && (
              <div role="status" className="alert alert-success">
                {isSale ? 'Đã trả hàng hoàn tất. ' : 'Đã hoàn tất trả đồ. '}

                {data.refundedAmount != null &&
                  Number.isFinite(Number(data.refundedAmount)) && (
                    <>
                      Đã hoàn{' '}
                      {Number(data.refundedAmount).toLocaleString('vi-VN')}đ{' '}
                      {isSale ? 'tiền mua hàng' : 'tiền cọc'} vào Ví Vestora
                      của chủ đơn.
                    </>
                  )}
              </div>
            )}

            {isSale && data.requestBlockedReason && !data.completed && (
              <p className="text-muted">{data.requestBlockedReason}</p>
            )}

            {!data.completed && (!shipment || ['cancelled', 'failed'].includes(status)) && data.canRequest && !readOnly && !isSale && (
              data.simulatorEnabled ? (
                <div className="mt-3">
                  {['cancelled', 'failed'].includes(status) && (
                    <div className="alert alert-warning py-2 mb-2 small">
                      Vận đơn trước đó đã bị {status === 'cancelled' ? 'hủy' : 'thất bại'}. Bạn có thể tạo lại vận đơn thu hồi GHN mới.
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => run(() => api.request(orderId))}
                  >
                    Tạo đơn thu hồi đồ (GHN)
                  </button>
                </div>
              ) : (
                <div className="alert alert-info py-2 mb-0 small">
                  Vui lòng dùng nút thu hồi đồ thuê ở màn hình chi tiết đơn hàng để chọn trang phục trả và tạo vận đơn GHN.
                </div>
              )
            )}
            {!data.completed && (!shipment || ['cancelled', 'failed'].includes(status)) && data.canRequest && !readOnly && isSale && (
              <div className="alert alert-info py-2 mb-0 small">
                Vui lòng dùng nút tạo yêu cầu trả hàng qua GHN ở màn hình chi tiết đơn hàng để chọn món cần trả và địa chỉ lấy hàng.
              </div>
            )}

            {!data.completed &&
              data.canManage &&
              !readOnly && (
                <div className="mt-3">
                  {status === 'delivered' ? (
                    <>
                      <label className="d-block mb-2">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          disabled={busy}
                          onChange={event => setConfirmed(event.target.checked)}
                        />{' '}
                        Đã kiểm tra và nhận đủ đồ nguyên vẹn
                      </label>

                      {!data.returnReceivedVideo && (
                        <div
                          role="alert"
                          className="alert alert-warning py-2"
                        >
                          {isSale
                            ? 'Shop cần tải video nhận hàng trả ở mục phía trên trước khi hoàn tất và hoàn tiền.'
                            : 'Shop cần tải video nhận đồ trả ở mục phía trên trước khi hoàn tất và hoàn cọc.'}
                        </div>
                      )}

                      <button
                        className="btn btn-success"
                        disabled={
                          busy ||
                          !confirmed ||
                          !data.returnReceivedVideo
                        }
                        onClick={async () => {
                          const res = await run(() => api.complete(orderId));
                          const payload = res?.data || res;
                          if (payload?.isPartial || payload?.status === 'partially_returned') {
                            setConfirmed(false);
                            setBatchNotice(
                              `Đã hoàn ${Number(payload.refundedAmount || 0).toLocaleString('vi-VN')}đ tiền cọc đợt này; đơn chuyển sang trạng thái đang trả một phần.`
                            );
                          }
                        }}
                      >
                        {isSale
                          ? 'Hoàn tất trả hàng & hoàn tiền'
                          : 'Hoàn tất trả đồ & hoàn cọc'}
                      </button>
                    </>
                  ) : data.simulatorEnabled && shipment?.isSimulated ? (
                    <>
                      {status === 'preparing' && (
                        <button
                          className="btn btn-outline-primary"
                          disabled={busy}
                          onClick={() =>
                            run(() => api.advance(orderId, 'shipped'))
                          }
                        >
                          Mô phỏng: đã lấy đồ
                        </button>
                      )}

                      {status === 'shipped' && (
                        <button
                          className="btn btn-outline-primary"
                          disabled={busy}
                          onClick={() =>
                            run(() => api.advance(orderId, 'delivered'))
                          }
                        >
                          Mô phỏng: đã giao về shop
                        </button>
                      )}
                    </>
                  ) : shipment && ['preparing', 'shipped'].includes(status) && !data.simulatorEnabled ? (
                    <p className="text-muted mb-0">
                      Mô phỏng trả đồ chưa được bật trên máy chủ.
                    </p>
                  ) : null}
                </div>
              )}

            {busy && <p role="status">Đang xử lý…</p>}
          </>
        )}
      </ReturnFlowModal.Body>

      <ReturnFlowModal.Footer>
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={onClose}
        >
          Đóng
        </button>
      </ReturnFlowModal.Footer>
    </ReturnFlowModal>
  );
}

export function SalesReturnWorkflow(props) {
  return <RentalReturnWorkflow {...props} orderType="sale" />;
}

export function SalesDeliveryVideos(props) {
  return <RentalDeliveryVideos {...props} orderType="sale" />;
}
