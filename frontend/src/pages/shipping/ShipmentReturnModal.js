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
  linkRentalInventory,
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

  const itemIdOf = (it) =>
    String(it._id || it.id || it.detailId || '');

  const getItemMaxQty = useCallback(
    (it) =>
      Math.max(
        1,
        Number(
          isSale
            ? it.quantity
            : (it.remainingQuantity ?? it.quantity)
        ) || 1
      ),
    [isSale]
  );

  const defaultReturnNote = isSale
    ? 'Khách hàng gửi trả lại sản phẩm mua về cửa hàng'
    : (
      isCustomer
        ? 'Khách hàng gửi trả lại trang phục thuê về cửa hàng'
        : 'Thu hồi trang phục cho thuê hoàn trả về shop'
    );

  const allOrderItems = React.useMemo(() => {
    if (!order) return [];

    const list =
      orderItemsProp ||
      order.items ||
      order.details ||
      [];

    return Array.isArray(list) ? list : [];
  }, [order, orderItemsProp]);

  const selectableItems = React.useMemo(() => {
    if (isSale) return allOrderItems;

    return allOrderItems.filter(
      (it) =>
        Number(
          it.remainingQuantity ?? it.quantity ?? 1
        ) > 0
    );
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

  // Form State.
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

  // Khóa nút chống gửi dồn, tránh rate-limit GHN.
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  // Khởi tạo dữ liệu form khi mở modal hoặc đổi đơn.
  useEffect(() => {
    if (!show || !order) return;

    const {
      receiverName,
      receiverPhone,
      detailedAddress,
    } = extractOrderAddressInfo(order);

    const prevSender =
      initialShipment?.senderInfo ||
      initialShipment?.receiverInfo ||
      {};

    setFromName(prevSender.name || receiverName);
    setFromPhone(prevSender.phone || receiverPhone);
    setFromAddress(prevSender.address || detailedAddress);

    // Kế thừa kích thước và cân nặng từ đơn gửi đi nếu có.
    const outbound =
      order?.shipments && Array.isArray(order.shipments)
        ? order.shipments.find(
          (s) => s.shipmentType === 'outbound'
        )
        : null;

    const sourceShipment = initialShipment || outbound;

    setWeight(
      sourceShipment?.weight
        ? Number(sourceShipment.weight)
        : 500
    );

    setLength(
      sourceShipment?.length
        ? Number(sourceShipment.length)
        : 20
    );

    setWidth(
      sourceShipment?.width
        ? Number(sourceShipment.width)
        : 20
    );

    setHeight(
      sourceShipment?.height
        ? Number(sourceShipment.height)
        : 10
    );

    setNote(sourceShipment?.note || defaultReturnNote);
    setReason('');

    if (selectableItems.length > 0) {
      const initMap = {};

      selectableItems.forEach((it) => {
        const dId = itemIdOf(it);

        if (dId) {
          initMap[dId] = {
            checked: true,
            quantity: getItemMaxQty(it),
          };
        }
      });

      setSelectedMap(initMap);
    } else {
      setSelectedMap({});
    }

    setErrorMsg('');
    setCooldown(0);
  }, [
    show,
    order,
    initialShipment,
    isSale,
    isCustomer,
    selectableItems,
    defaultReturnNote,
    getItemMaxQty,
  ]);

  // Tự động khớp Tỉnh / Xã từ thông tin đơn hàng.
  useEffect(() => {
    if (!show || !order || provinces.length === 0) return;

    const {
      provHint,
      wardHint,
      wardCodeHint,
      provinceIdHint,
      fullAddr,
    } = extractOrderAddressInfo(order);

    const prevSender =
      initialShipment?.senderInfo ||
      initialShipment?.receiverInfo ||
      {};

    const finalProvId =
      prevSender.provinceId || provinceIdHint;

    const finalWardCode =
      prevSender.wardCode || wardCodeHint;

    let targetProvId = finalProvId
      ? String(finalProvId)
      : '';

    const exists =
      targetProvId &&
      provinces.some(
        (p) =>
          String(p._id || p.ProvinceID) === targetProvId
      );

    if (!exists) {
      const matchedProv = autoMatchProvince(
        targetProvId || provHint,
        fullAddr,
        provinces
      );

      if (matchedProv) {
        targetProvId = String(
          matchedProv._id || matchedProv.ProvinceID
        );
      }
    }

    if (targetProvId) {
      handleProvinceChange(
        targetProvId,
        wardHint,
        finalWardCode,
        fullAddr
      );
    }
  }, [
    show,
    order,
    initialShipment,
    provinces,
    handleProvinceChange,
  ]);

  const formatErrorText = (msg) => {
    const raw = String(msg || '');

    if (
      raw.toLowerCase().includes('too many request') ||
      raw.toLowerCase().includes('is processing')
    ) {
      return 'GHN đang xử lý tạo đơn cho mã này, vui lòng đợi vài giây rồi thử lại.';
    }

    return raw;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting || cooldown > 0) return;

    if (!fromProvinceId) {
      setErrorMsg(
        'Vui lòng chọn Tỉnh/Thành phố nơi shipper tới lấy đồ trả.'
      );
      return;
    }

    if (!fromWardCode) {
      setErrorMsg(
        'Vui lòng chọn Phường/Xã nơi shipper tới lấy đồ trả.'
      );
      return;
    }

    if (!fromPhone.trim()) {
      setErrorMsg('Vui lòng nhập số điện thoại người trả.');
      return;
    }

    // Chuẩn hóa số điện thoại Việt Nam, hỗ trợ +84 và 84.
    let cleanPhone = fromPhone
      .trim()
      .replace(/[\s.-]/g, '');

    if (cleanPhone.startsWith('+84')) {
      cleanPhone = '0' + cleanPhone.slice(3);
    } else if (
      cleanPhone.startsWith('84') &&
      cleanPhone.length === 11
    ) {
      cleanPhone = '0' + cleanPhone.slice(2);
    }

    const vnPhoneRegex =
      /^(0)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;

    if (!vnPhoneRegex.test(cleanPhone)) {
      setErrorMsg(
        'Số điện thoại không hợp lệ. Vui lòng nhập số di động 10 số hiện hành của Việt Nam (VD: 0912345678, 0388889999). Đầu số cũ 012x đã bị ngừng sử dụng và không được GHN chấp nhận.'
      );
      return;
    }

    if (!fromAddress.trim()) {
      setErrorMsg(
        'Vui lòng nhập địa chỉ cụ thể nơi shipper tới lấy đồ.'
      );
      return;
    }

    const selectedItems = selectableItems
      .map((it) => {
        const dId = itemIdOf(it);
        const sel = selectedMap[dId];

        if (!dId || !sel?.checked) return null;

        const qty = Math.max(
          1,
          Math.min(
            getItemMaxQty(it),
            Number(sel.quantity || 1)
          )
        );

        return isSale
          ? {
            salesOrderDetailId: dId,
            quantityReturned: qty,
          }
          : {
            rentalOrderDetailId: dId,
            quantityReturned: qty,
          };
      })
      .filter(Boolean);

    if (
      (isSale || selectableItems.length > 0) &&
      !selectedItems.length
    ) {
      setErrorMsg(
        'Vui lòng chọn ít nhất 1 sản phẩm cần hoàn trả.'
      );
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const selectedProv = provinces.find(
        (p) =>
          String(p._id || p.ProvinceID) ===
          String(fromProvinceId)
      );

      const selectedWard = wards.find(
        (w) =>
          String(w.WardCode || w._id) ===
          String(fromWardCode)
      );

      const provName =
        selectedProv?.name ||
        selectedProv?.ProvinceName ||
        order?.shippingAddress?.city ||
        '';

      const wardName =
        selectedWard?.WardName ||
        selectedWard?.name ||
        selectedWard?.label ||
        order?.shippingAddress?.ward ||
        '';

      const isNewAddress =
        Number(fromProvinceId) >= 1000000 ||
        Boolean(order?.shippingAddress?.isNewAddress);

      const payload = {
        orderId: order._id,
        orderType,
        fromName: fromName.trim(),
        fromPhone: cleanPhone,
        fromAddress: fromAddress.trim(),
        fromProvinceId: Number(fromProvinceId),
        fromDistrictId: fromDistrictId
          ? Number(fromDistrictId)
          : undefined,
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
          ? {
            reason: reason.trim(),
            items: selectedItems,
          }
          : (
            selectedItems.length > 0
              ? { items: selectedItems }
              : {}
          )),
      };

      const res = await createReturnShipmentApi(payload);

      if (res?.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setErrorMsg(
          formatErrorText(
            res?.message || 'Tạo yêu cầu thu hồi thất bại.'
          )
        );
        setCooldown(5);
      }
    } catch (err) {
      setErrorMsg(
        formatErrorText(
          err.message || 'Lỗi khi kết nối hệ thống GHN.'
        )
      );
      setCooldown(5);
    } finally {
      setSubmitting(false);
    }
  };

  if (!show || !order) return null;

  const isFullSelection =
    selectableItems.length > 0 &&
    selectableItems.every((it) => {
      const sel = selectedMap[itemIdOf(it)];

      return (
        sel?.checked &&
        Number(sel.quantity || 1) === getItemMaxQty(it)
      );
    });

  const selectedQtyOf = (it) => {
    const sel = selectedMap[itemIdOf(it)];

    if (!sel?.checked) return 0;

    return Math.max(
      1,
      Math.min(
        getItemMaxQty(it),
        Number(sel.quantity || 1)
      )
    );
  };

  const netMerchandise =
    Math.max(
      0,
      Number(order.subtotal || 0) -
      Number(order.discountAmount || 0)
    ) ||
    Math.max(
      0,
      Number(order.totalAmount || 0) -
      Number(order.shippingFee || 0)
    );

  const rawSubtotal = selectableItems.reduce(
    (sum, d) => sum + Number(d.lineTotal || 0),
    0
  );

  const partialSaleRefundSum = selectableItems.reduce(
    (sum, it) => {
      const qty = selectedQtyOf(it);

      if (!qty) return sum;

      const proportion =
        rawSubtotal > 0
          ? Number(it.lineTotal || 0) / rawSubtotal
          : 0;

      return (
        sum +
        Math.round(
          netMerchandise *
          proportion *
          (
            qty /
            Math.max(1, Number(it.quantity || 1))
          )
        )
      );
    },
    0
  );

  const rentalRemainingLocked = Math.max(
    0,
    Number(order.depositAmount || 0) -
    Number(order.refundedDepositAmount || 0) -
    Number(order.deductedDepositAmount || 0)
  );

  const totalRentalFeeBasis = allOrderItems.reduce(
    (sum, d) =>
      sum +
      Number(
        d.lineTotal ||
        (
          Number(d.unitPrice || 0) *
          Math.max(1, Number(d.quantity || 1))
        )
      ),
    0
  );

  const estimateRentalItemDeposit = (it, selQty) => {
    const perUnit = Number(it.depositPerUnit || 0);

    if (perUnit > 0) {
      return perUnit * selQty;
    }

    const origQty = Math.max(
      1,
      Number(it.quantity || 1)
    );

    const lineBasis = Number(
      it.lineTotal ||
      (Number(it.unitPrice || 0) * origQty)
    );

    if (totalRentalFeeBasis > 0) {
      return Math.round(
        Number(order.depositAmount || 0) *
        (lineBasis / totalRentalFeeBasis) *
        (selQty / origQty)
      );
    }

    return Math.round(
      rentalRemainingLocked *
      (selQty / Math.max(1, getItemMaxQty(it)))
    );
  };

  const partialRentalDepositSum = Math.min(
    rentalRemainingLocked,
    selectableItems.reduce((sum, it) => {
      const qty = selectedQtyOf(it);

      return qty
        ? sum + estimateRentalItemDeposit(it, qty)
        : sum;
    }, 0)
  );

  const estimatedRefundAmount = isSale
    ? (
      isFullSelection
        ? Number(order.totalAmount || 0)
        : Math.min(
          Number(
            order.paidAmount ||
            order.totalAmount ||
            0
          ),
          Math.max(0, partialSaleRefundSum)
        )
    )
    : (
      isFullSelection
        ? rentalRemainingLocked
        : partialRentalDepositSum
    );

  const shop = order.locationId?.shopId || {};

  const storeName =
    shop.name ||
    order.locationId?.name ||
    'Cửa hàng Vestora';

  const storeAddress =
    shop.address ||
    order.locationId?.address ||
    'Địa chỉ Cửa hàng';

  const storePhone =
    shop.phone ||
    order.locationId?.phone ||
    '';

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
                    ? (
                      isCustomer
                        ? 'Yêu Cầu Trả Hàng Mua Qua GHN'
                        : 'Tạo Vận Đơn Thu Hồi Hàng Mua (GHN)'
                    )
                    : (
                      isCustomer
                        ? 'Yêu Cầu Trả Đồ Thuê Qua GHN'
                        : 'Tạo Vận Đơn Thu Hồi Đồ Thuê (GHN)'
                    )}
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
                <AlertCircle
                  size={16}
                  className="text-danger flex-shrink-0"
                />
                <span>{errorMsg}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              id="shipment-return-form"
            >
              {/* Điểm nhận hàng hoàn trả */}
              <div className="mb-3 p-3 bg-light rounded-3 border">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="small fw-bold text-uppercase text-primary d-flex align-items-center gap-1">
                    <Store size={15} />

                    {isCustomer
                      ? '1. Cửa hàng tiếp nhận đồ hoàn trả'
                      : '1. Cửa hàng tiếp nhận đồ hoàn (Shipper giao trả về)'}
                  </div>

                  {storeLat && storeLng ? (
                    <a
                      href={`https://www.google.com/maps?q=${storeLat},${storeLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-primary py-0 px-2 small d-inline-flex align-items-center gap-1"
                      title="Mở Google Maps theo tọa độ GPS"
                    >
                      <ExternalLink size={12} />
                      Xem vị trí trên bản đồ
                    </a>
                  ) : null}
                </div>

                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <span className="small text-muted d-block">
                      Cửa hàng tiếp nhận đồ:
                    </span>

                    <strong className="text-dark small me-1">
                      {storeName}
                    </strong>

                    {storePhone && (
                      <span className="d-block small text-muted">
                        Hotline cửa hàng: {storePhone}
                      </span>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <span className="small text-muted d-block">
                      Địa chỉ cửa hàng nhận:
                    </span>

                    <span className="text-dark small d-block">
                      {storeAddress}
                    </span>

                    {storeLat && storeLng && (
                      <span className="small text-muted shipping-fee-sub">
                        📍 Tọa độ GPS:{' '}
                        {Number(storeLat).toFixed(4)},{' '}
                        {Number(storeLng).toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Thông tin người trả hàng */}
              <div className="mb-3">
                <div className="small fw-bold text-uppercase text-muted mb-2">
                  {isCustomer
                    ? '2. Địa chỉ shipper tới lấy đồ từ quý khách'
                    : '2. Địa điểm shipper tới lấy đồ từ khách'}
                </div>

                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">
                      Họ tên người trả đồ *
                    </label>

                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={fromName}
                      onChange={(e) =>
                        setFromName(e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">
                      Số điện thoại liên hệ *
                    </label>

                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={fromPhone}
                      onChange={(e) =>
                        setFromPhone(e.target.value)
                      }
                      required
                    />
                  </div>

                  {/* Địa giới hành chính GHN */}
                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">
                      Tỉnh / Thành phố *
                    </label>

                    <SearchableSelect
                      id="returnFromProvince"
                      options={provinces.map((p) => ({
                        value: String(p._id || p.ProvinceID),
                        label: p.name || p.ProvinceName,
                        name: p.name || p.ProvinceName,
                      }))}
                      value={String(fromProvinceId || '')}
                      onChange={(val) =>
                        handleProvinceChange(val)
                      }
                      placeholder="-- Chọn hoặc gõ tìm Tỉnh / Thành --"
                      searchPlaceholder="Gõ tên Tỉnh / Thành..."
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small text-muted mb-1">
                      Phường / Xã *
                    </label>

                    <SearchableSelect
                      id="returnFromWard"
                      options={wards.map((w) => ({
                        value: String(w.WardCode || w._id),
                        label:
                          w.label ||
                          w.WardName ||
                          w.name,
                        name: w.WardName || w.name,
                      }))}
                      value={String(fromWardCode || '')}
                      onChange={(val) =>
                        handleWardChange(val)
                      }
                      placeholder={
                        !fromProvinceId
                          ? 'Chọn Tỉnh trước'
                          : loadingWards
                            ? 'Đang tải danh sách...'
                            : '-- Chọn hoặc gõ tìm Phường / Xã --'
                      }
                      searchPlaceholder="Gõ tên Phường / Xã..."
                      disabled={
                        !fromProvinceId ||
                        loadingWards ||
                        wards.length === 0
                      }
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small text-muted mb-1">
                      Số nhà, tên đường chi tiết *
                    </label>

                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={fromAddress}
                      onChange={(e) =>
                        setFromAddress(e.target.value)
                      }
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
                    {isSale
                      ? '3. Chọn sản phẩm cần trả & Lý do'
                      : '3. Chọn trang phục trả đợt này'}
                  </div>

                  <div className="table-responsive mb-2">
                    <table className="table table-sm align-middle mb-0 bg-white rounded">
                      <thead className="table-light">
                        <tr className="small text-muted">
                          <th style={{ width: 34 }}>
                            Chọn
                          </th>

                          <th>Sản phẩm</th>

                          <th style={{ width: 110 }}>
                            Số lượng trả
                          </th>

                          <th
                            className="text-end"
                            style={{ width: 120 }}
                          >
                            {isSale
                              ? 'Giá dòng'
                              : 'Cọc dự kiến'}
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectableItems.map((it) => {
                          const dId = itemIdOf(it);
                          const maxQty = getItemMaxQty(it);

                          const sel = selectedMap[dId] || {
                            checked: true,
                            quantity: maxQty,
                          };

                          const selQty = Math.max(
                            1,
                            Math.min(
                              maxQty,
                              Number(sel.quantity || 1)
                            )
                          );

                          const pName =
                            it.variantId?.productId?.name ||
                            it.productName ||
                            it.name ||
                            'Sản phẩm';

                          const sizeColor = [
                            it.variantId?.size || it.size,
                            it.variantId?.color || it.color,
                          ]
                            .filter(Boolean)
                            .join(' · ');

                          const returnedQty = Number(
                            it.returnedQuantity || 0
                          );

                          const rowAmount = isSale
                            ? Number(it.lineTotal || 0)
                            : estimateRentalItemDeposit(
                              it,
                              sel.checked ? selQty : maxQty
                            );

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
                                      [dId]: {
                                        checked: e.target.checked,
                                        quantity:
                                          sel.quantity || maxQty,
                                      },
                                    }))
                                  }
                                />
                              </td>

                              <td>
                                <div className="fw-semibold text-dark">
                                  {pName}
                                </div>

                                {sizeColor && (
                                  <div
                                    className="text-muted"
                                    style={{ fontSize: '11px' }}
                                  >
                                    {sizeColor}
                                  </div>
                                )}

                                {!isSale && returnedQty > 0 && (
                                  <div
                                    className="text-info"
                                    style={{ fontSize: '11px' }}
                                  >
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
                                        const val = Math.max(
                                          1,
                                          Math.min(
                                            maxQty,
                                            Number(e.target.value) || 1
                                          )
                                        );

                                        setSelectedMap((prev) => ({
                                          ...prev,
                                          [dId]: {
                                            checked: true,
                                            quantity: val,
                                          },
                                        }));
                                      }}
                                    />

                                    <span className="text-muted">
                                      / {maxQty}
                                    </span>
                                  </div>
                                ) : (
                                  <span>1 / 1</span>
                                )}
                              </td>

                              <td className="text-end fw-semibold">
                                {Number(
                                  rowAmount || 0
                                ).toLocaleString('vi-VN')}đ
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

                      {!isFullSelection && (
                        <span className="text-muted fw-normal">
                          {' '}(Trả một phần)
                        </span>
                      )}
                    </strong>
                  </div>

                  {isSale && (
                    <div>
                      <label className="form-label small text-muted mb-1">
                        Lý do trả hàng (không bắt buộc)
                      </label>

                      <input
                        type="text"
                        maxLength={1000}
                        className="form-control form-control-sm"
                        placeholder="VD: Mặc không vừa, muốn đổi trả..."
                        value={reason}
                        onChange={(e) =>
                          setReason(e.target.value)
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Thông số kiện hàng và ghi chú */}
              <div className="mb-3">
                <div className="small fw-bold text-uppercase text-muted mb-2">
                  <Package
                    size={14}
                    className="me-1 inline"
                  />

                  {(isSale || selectableItems.length > 0)
                    ? '4.'
                    : '3.'}{' '}
                  Thông số kiện hàng & Ghi chú
                </div>

                <div className="row g-2 mb-2">
                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">
                      Cân nặng (g) *
                    </label>

                    <input
                      type="number"
                      min="100"
                      step="50"
                      className="form-control form-control-sm"
                      value={weight}
                      onChange={(e) =>
                        setWeight(e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">
                      Dài (cm)
                    </label>

                    <input
                      type="number"
                      min="5"
                      className="form-control form-control-sm"
                      value={length}
                      onChange={(e) =>
                        setLength(e.target.value)
                      }
                    />
                  </div>

                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">
                      Rộng (cm)
                    </label>

                    <input
                      type="number"
                      min="5"
                      className="form-control form-control-sm"
                      value={width}
                      onChange={(e) =>
                        setWidth(e.target.value)
                      }
                    />
                  </div>

                  <div className="col-6 col-md-3">
                    <label className="form-label small text-muted mb-1">
                      Cao (cm)
                    </label>

                    <input
                      type="number"
                      min="5"
                      className="form-control form-control-sm"
                      value={height}
                      onChange={(e) =>
                        setHeight(e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="row g-2">
                  <div className="col-12">
                    <label className="form-label small text-muted mb-1">
                      Ghi chú cho shipper
                    </label>

                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={note}
                      onChange={(e) =>
                        setNote(e.target.value)
                      }
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
                    {isCustomer
                      ? 'Gửi yêu cầu shipper tới lấy đồ'
                      : 'Xác nhận tạo đơn thu hồi GHN'}
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

function useRentalEvidence(
  orderId,
  orderType = 'rental'
) {
  const api = RETURN_APIS[orderType];

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const busyRef = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const current = ++generation.current;

    try {
      const response = await api.get(orderId);

      if (
        mounted.current &&
        current === generation.current
      ) {
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
              keepVideo(
                previous?.[field],
                response.data[field]
              ),
            ])
          ),
        }));
      }
    } catch (err) {
      if (
        mounted.current &&
        current === generation.current
      ) {
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
    setNotice('');

    try {
      const result = await action();

      if (mounted.current && result?.message) {
        setNotice(result.message);
      }

      await load();

      return result;
    } catch (err) {
      if (mounted.current) {
        setError(err.message);
      }
    } finally {
      busyRef.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  function upload(kind, file) {
    if (!file) return;

    if (
      !['video/mp4', 'video/webm'].includes(file.type) ||
      file.size > 50 * 1024 * 1024
    ) {
      setError(
        'Chọn video MP4/WebM, tối đa 50 MB và 5 phút.'
      );
      return;
    }

    run(() => api.upload(orderId, kind, file));
  }

  return {
    data,
    error,
    notice,
    busy,
    run,
    upload,
    api,
  };
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
          (
            orderType === 'sale'
              ? ' (bắt buộc)'
              : ''
          ),
      },
      {
        kind: 'receiving',
        field: 'receivingVideo',
        label:
          'Khách: video nhận hàng (không bắt buộc)',
      },
    ]
    : [
      {
        kind: 'return',
        field: 'returnVideo',
        label:
          'Khách: video trước khi trả đồ (không bắt buộc)',
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
                  {new Date(
                    video.uploadedAt
                  ).toLocaleString('vi-VN')}
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
                    upload(
                      item.kind,
                      event.target.files?.[0]
                    );

                    event.target.value = '';
                  }}
                />

                <div className="small text-muted">
                  MP4/WebM · tối đa 50 MB, 5 phút
                </div>
              </>
            ) : (
              <p className="text-muted">
                Chưa có video.
              </p>
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

function rentalInspectionSlots(data, drafts) {
  const shipmentId = String(data?.shipment?._id || '');

  return (data?.items || []).flatMap(detail => {
    const candidates = (data.physicalItems || []).filter(
      item =>
        item.status === 'handed_over' &&
        item.itemId &&
        String(item.detailId) === String(detail.detailId)
    );

    return Array.from(
      { length: Number(detail.quantity) },
      (_, index) => {
        const key = `${shipmentId}:${detail.detailId}:${index}`;

        return {
          key,
          detail,
          candidates,
          index,
          itemId: '',
          inspectionResult: '',
          damageMode: 'fixed',
          damageValue: '0',
          note: '',
          ...(drafts[key] || {}),
        };
      }
    );
  });
}

function rentalDamageLimit(slot) {
  if (slot.damageMode === 'percentage') return 100;

  const deposit = slot.detail.depositPerUnit;

  return Number.isSafeInteger(deposit) && deposit >= 0
    ? deposit
    : null;
}

function boundInspectionValue(raw, slot) {
  if (raw === '') return '';

  const value = Number(raw);
  const limit = rentalDamageLimit(slot);

  if (!Number.isFinite(value) || limit == null) return '';

  if (value < 0) return '0';
  if (value > limit) return String(limit);

  // Tiền VND chỉ nhận số nguyên.
  if (slot.damageMode === 'fixed') {
    return String(Math.floor(value));
  }

  return /[eE]/.test(raw) ? String(value) : raw;
}

function inspectionAmount(slot) {
  if (slot.inspectionResult === 'ok') return 0;

  if (!['fixed', 'percentage'].includes(slot.damageMode)) {
    return null;
  }

  const value = Number(slot.damageValue);
  const limit = rentalDamageLimit(slot);

  if (
    String(slot.damageValue).trim() === '' ||
    limit == null ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > limit
  ) {
    return null;
  }

  if (slot.damageMode === 'percentage') {
    const basis = slot.detail.compensationValuePerUnit;

    if (
      !Number.isSafeInteger(basis) ||
      basis <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(String(slot.damageValue))
    ) {
      return null;
    }

    const cents = window.BigInt(Math.round(value * 100));

    return Number(
      (window.BigInt(basis) * cents + 5000n) / 10000n
    );
  }

  return Number.isSafeInteger(value) ? value : null;
}

function RentalBatchInspectionFields({
  slots,
  busy,
  onChange,
}) {
  const selected = new Set(
    slots.map(slot => slot.itemId).filter(Boolean)
  );

  const money = value =>
    Number(value || 0).toLocaleString('vi-VN') + 'đ';

  return slots.map(slot => {
    const amount = inspectionAmount(slot);
    const limit = rentalDamageLimit(slot);

    const isDamaged = ['needs_service', 'missing'].includes(
      slot.inspectionResult
    );

    const hasBasis =
      Number.isSafeInteger(slot.detail.compensationValuePerUnit) &&
      slot.detail.compensationValuePerUnit > 0;

    return (
      <section
        key={slot.key}
        className="border rounded p-3 mb-3 rr-inspection-item"
      >
        <h6>
          {slot.detail.name} — món {slot.index + 1}/{slot.detail.quantity}
        </h6>

        <div className="small text-muted mb-2">
          {slot.detail.sku}
        </div>

        <label className="d-block mb-3">
          Mã hiện vật trả đợt này

          <select
            className="form-select"
            disabled={busy}
            value={slot.itemId}
            onChange={event =>
              onChange(slot.key, {
                itemId: event.target.value,
                inspectionResult: '',
                damageMode: 'fixed',
                damageValue: '0',
                note: '',
              })
            }
          >
            <option value="">
              Chọn đúng hiện vật của đợt trả
            </option>

            {slot.candidates.map(item => (
              <option
                key={item.itemId}
                value={String(item.itemId)}
                disabled={
                  selected.has(String(item.itemId)) &&
                  slot.itemId !== String(item.itemId)
                }
              >
                {item.itemCode}
              </option>
            ))}
          </select>
        </label>

        <label className="d-block mb-3">
          Tình trạng hiện vật

          <select
            className="form-select"
            value={slot.inspectionResult}
            disabled={busy || !slot.itemId}
            onChange={event =>
              onChange(slot.key, {
                inspectionResult: event.target.value,
                damageMode: 'fixed',
                damageValue: '0',
              })
            }
          >
            <option value="">Chọn kết quả kiểm tra</option>
            <option value="ok">Nguyên vẹn</option>
            <option value="needs_service">
              Hư hỏng — cần xử lý
            </option>
            <option value="missing">
              Mất hiện vật thuộc đợt trả này
            </option>
          </select>
        </label>

        {isDamaged && (
          <>
            <div className="row g-3">
              <label className="col-md-6">
                Cách tính bồi thường cho món này

                <select
                  className="form-select"
                  value={slot.damageMode}
                  disabled={busy}
                  onChange={event =>
                    onChange(slot.key, {
                      damageMode: event.target.value,
                      damageValue: '0',
                    })
                  }
                >
                  <option value="fixed">Số tiền cố định</option>
                  <option value="percentage" disabled={!hasBasis}>
                    Phần trăm giá trị hiện vật
                  </option>
                </select>
              </label>

              <label className="col-md-6">
                {slot.damageMode === 'percentage'
                  ? 'Mức hư hỏng (%)'
                  : 'Bồi thường đánh giá (VND)'}

                <div className="rr-amount-input">
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    max={limit ?? 0}
                    step={slot.damageMode === 'percentage' ? '0.01' : '1'}
                    inputMode={
                      slot.damageMode === 'percentage' ? 'decimal' : 'numeric'
                    }
                    value={slot.damageValue}
                    disabled={busy || limit == null}
                    aria-describedby={`rr-limit-${slot.key}`}
                    onKeyDown={event => {
                      if (['e', 'E', '+', '-'].includes(event.key)) {
                        event.preventDefault();
                      }
                    }}
                    onChange={event =>
                      onChange(slot.key, {
                        damageValue: boundInspectionValue(
                          event.target.value,
                          slot
                        ),
                      })
                    }
                    onBlur={event => {
                      if (event.target.value === '') {
                        onChange(slot.key, { damageValue: '0' });
                      }
                    }}
                  />

                  <span aria-hidden="true">
                    {slot.damageMode === 'percentage' ? '%' : 'đ'}
                  </span>
                </div>

                <small
                  className="rr-field-hint"
                  id={`rr-limit-${slot.key}`}
                >
                  {slot.damageMode === 'percentage'
                    ? 'Từ 0 đến 100%. Giá trị vượt giới hạn được đưa về 100%.'
                    : limit == null
                      ? 'Thiếu tiền cọc của hiện vật. Cần kiểm tra chi tiết đơn thuê.'
                      : `Từ 0 đến ${money(limit)} — tiền cọc của một hiện vật.`}
                </small>
              </label>
            </div>

            {slot.damageMode === 'percentage' && (
              <p className="small mt-2 mb-0">
                Căn cứ: {money(slot.detail.compensationValuePerUnit)}
                {' '}/ hiện vật
                {slot.detail.compensationValueSource === 'catalog' &&
                  ' (giá sản phẩm hiện tại; đơn cũ chưa lưu giá lúc đặt)'}.
              </p>
            )}

            {!hasBasis && (
              <p className="small text-muted mt-2 mb-0">
                Chưa có giá trị sản phẩm để tính %.
                Nhập số tiền bồi thường riêng cho món này.
              </p>
            )}

            <label className="d-block mt-3">
              Ghi chú cho hiện vật này

              <textarea
                className="form-control"
                rows={2}
                maxLength={500}
                value={slot.note}
                disabled={busy}
                onChange={event =>
                  onChange(slot.key, {
                    note: event.target.value,
                  })
                }
              />
            </label>
          </>
        )}

        {slot.inspectionResult && (
          <div
            className={
              amount == null ? 'text-danger mt-2' : 'mt-2'
            }
          >
            {amount == null
              ? 'Nhập mức bồi thường hợp lệ.'
              : `Bồi thường đánh giá cho món này: ${money(amount)}`}
          </div>
        )}
      </section>
    );
  });
}

function RentalInventoryFields({
  orderId,
  data,
  busy,
  run,
  inspections = {},
  setInspections,
  embedded = false,
}) {
  const [codes, setCodes] = useState({});

  if (!data?.canManage || data.completed) return null;

  const details = data.physicalDetails || [];
  const items = data.physicalItems || [];
  const batchDetails = data.items || [];

  const itemsFor = detailId =>
    items.filter(
      item => String(item.detailId) === String(detailId)
    );

  const needsLink = details.some(
    detail =>
      itemsFor(detail.detailId).length !== detail.quantity
  );

  const needsHandover =
    ['renting', 'overdue', 'partially_returned'].includes(
      data.rentalStatus
    ) &&
    items.some(item => item.status === 'assigned');

  const codesFor = detail =>
    codes[detail.detailId] ??
    itemsFor(detail.detailId)
      .map(item => item.itemCode)
      .join(', ');

  const labels = {
    assigned: 'Đã gán',
    handed_over: 'Đã giao',
    returned: 'Đã trả',
    damaged: 'Đã trả, hư hỏng',
    missing: 'Mất',
  };

  return (
    <section
      className={
        embedded
          ? ''
          : 'border rounded p-3 mb-3'
      }
    >
      {!embedded && (
        <h6>Hiện vật của đơn thuê</h6>
      )}

      {needsLink || needsHandover ? (
        <>
          <p>
            Nhập mã từng hiện vật thực tế đã đóng/giao cho
            khách. Dùng mã hiện vật trong kho, không dùng
            SKU; ngăn cách các mã bằng dấu phẩy.
          </p>

          {details.map(detail => (
            <label
              key={detail.detailId}
              className="d-block mb-2"
            >
              {detail.sku} — {detail.quantity} hiện vật

              <input
                className="form-control"
                value={codesFor(detail)}
                disabled={busy}
                onChange={event =>
                  setCodes(previous => ({
                    ...previous,
                    [detail.detailId]: event.target.value,
                  }))
                }
              />
            </label>
          ))}

          <button
            type="button"
            className="btn btn-outline-primary"
            disabled={busy || !details.length}
            onClick={() =>
              run(() =>
                linkRentalInventory(
                  orderId,
                  details.map(detail => ({
                    detailId: detail.detailId,
                    itemCodes: codesFor(detail)
                      .split(',')
                      .map(code => code.trim())
                      .filter(Boolean),
                  }))
                )
              )
            }
          >
            Xác nhận đúng hiện vật
          </button>
        </>
      ) : (
        <>
          {setInspections && (
            <p>
              Chọn kết quả cho đúng hiện vật trả đợt này;
              để trống món chưa trả.
            </p>
          )}

          {items.map(item => (
            <div
              key={item.itemId || item.itemCode}
              className="mb-2"
            >
              <strong>{item.itemCode}</strong>{' '}

              {setInspections &&
                item.status === 'handed_over' &&
                batchDetails.some(
                  detail =>
                    String(detail.detailId) ===
                    String(item.detailId)
                ) ? (
                <select
                  className="form-select"
                  aria-label={`Kết quả nghiệm thu ${item.itemCode}`}
                  disabled={busy}
                  value={inspections[item.itemId] || ''}
                  onChange={event =>
                    setInspections(previous => ({
                      ...previous,
                      [item.itemId]: event.target.value,
                    }))
                  }
                >
                  <option value="">
                    Chưa chọn / chưa trả đợt này
                  </option>

                  <option value="ok">
                    Nguyên vẹn
                  </option>

                  <option value="needs_service">
                    Hư hỏng — cần xử lý
                  </option>

                  <option value="missing">
                    Mất đồ
                  </option>
                </select>
              ) : (
                <span>
                  ({labels[item.status] || item.status})
                </span>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function RentalDeliveryVideosBody({
  orderId,
  readOnly,
  orderType,
  onChange,
}) {
  const {
    data,
    error,
    busy,
    upload,
    run,
  } = useRentalEvidence(orderId, orderType);

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
        <div
          role="alert"
          className="alert alert-danger"
        >
          {error}
        </div>
      )}

      {orderType === 'rental' && !readOnly && (
        <RentalInventoryFields
          orderId={orderId}
          data={data}
          busy={busy}
          run={run}
        />
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

      {busy && (
        <p role="status">
          Đang tải video lên…
        </p>
      )}
    </section>
  );
}

function RentalReturnWorkflowBody({
  orderId,
  onClose,
  orderType,
  readOnly,
}) {
  const {
    data,
    error,
    notice,
    busy,
    run,
    upload,
    api,
  } = useRentalEvidence(orderId, orderType);

  const isSale = orderType === 'sale';

  const [confirmed, setConfirmed] = useState(false);
  const [inspections, setInspections] = useState({});
  const [inspectionNote, setInspectionNote] = useState('');

  const slots = rentalInspectionSlots(data, inspections);

  const needsInventoryLink =
    !isSale &&
    (data?.physicalDetails || []).some(detail => {
      const rows = (data.physicalItems || []).filter(
        item => String(item.detailId) === String(detail.detailId)
      );

      return (
        rows.length !== detail.quantity ||
        rows.some(item => item.status === 'assigned')
      );
    });

  const inventoryErrors = [];

  if (!isSale) {
    if (needsInventoryLink) {
      inventoryErrors.push(
        'Cần xác nhận đủ mã hiện vật đã bàn giao.'
      );
    }

    if (!slots.length) {
      inventoryErrors.push(
        'Không có hiện vật cần nghiệm thu trong đợt này.'
      );
    }

    const used = new Set();

    for (const slot of slots) {
      const label = `${slot.detail.name} — món ${slot.index + 1}`;

      if (
        !slot.candidates.some(
          item => String(item.itemId) === slot.itemId
        )
      ) {
        inventoryErrors.push(
          `${label}: chưa chọn mã hiện vật hợp lệ.`
        );
      } else if (used.has(slot.itemId)) {
        inventoryErrors.push(
          `${label}: mã hiện vật bị chọn trùng.`
        );
      }

      used.add(slot.itemId);

      if (
        !['ok', 'needs_service', 'missing'].includes(
          slot.inspectionResult
        )
      ) {
        inventoryErrors.push(
          `${label}: chưa chọn tình trạng.`
        );
      } else if (inspectionAmount(slot) == null) {
        inventoryErrors.push(
          `${label}: mức bồi thường không hợp lệ.`
        );
      }
    }
  }

  const totalAssessedDamage = slots.reduce(
    (sum, slot) => sum + (inspectionAmount(slot) || 0),
    0
  );

  if (!isSale && !Number.isSafeInteger(totalAssessedDamage)) {
    inventoryErrors.push(
      'Tổng bồi thường vượt giới hạn xử lý.'
    );
  }

  const quoteKey = JSON.stringify(
    slots.map(slot => [
      slot.key,
      slot.itemId,
      slot.inspectionResult,
      slot.damageMode,
      slot.damageValue,
      slot.damageMode === 'percentage'
        ? slot.detail.compensationValuePerUnit
        : slot.detail.depositPerUnit,
    ])
  );

  useEffect(() => {
    setConfirmed(false);
  }, [quoteKey]);

  const completionErrors = [...inventoryErrors];

  if (!data?.returnReceivedVideo) {
    completionErrors.push(
      'Chưa có video shop nhận đồ trả.'
    );
  }

  if (!confirmed) {
    completionErrors.push(
      'Chưa tích xác nhận kết quả nghiệm thu.'
    );
  }

  const inspectionRows = slots.map(slot => ({
    itemId: slot.itemId,
    inspectionResult: slot.inspectionResult,
    damageMode:
      slot.inspectionResult === 'ok'
        ? 'fixed'
        : slot.damageMode,
    damageValue:
      slot.inspectionResult === 'ok'
        ? 0
        : slot.damageValue,
    expectedBaseValue: slot.detail.compensationValuePerUnit,
    note: slot.note.trim(),
  }));

  function handleSlotChange(key, patch) {
    setInspections(previous => ({
      ...previous,
      [key]: {
        ...previous[key],
        ...patch,
      },
    }));

    setConfirmed(false);
  }

  useEffect(() => {
    setInspections({});
    setConfirmed(false);
    setInspectionNote('');
  }, [data?.shipment?._id]);

  const [batchNotice, setBatchNotice] = useState('');
  const errorRef = useRef(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView?.({
        block: 'nearest',
      });
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
    value
      ? new Date(value).toLocaleString('vi-VN')
      : '—';

  return (
    <ReturnFlowModal
      className={isSale ? undefined : 'rental-return-modal'}
      show
      onHide={() => !busy && onClose()}
      size="lg"
      centered
      backdrop="static"
    >
      <ReturnFlowModal.Header closeButton={!busy}>
        <ReturnFlowModal.Title>
          {isSale
            ? 'Trả hàng đã mua'
            : 'Trả đồ thuê'}{' '}
          {data?.orderCode
            ? `#${data.orderCode}`
            : ''}
        </ReturnFlowModal.Title>
      </ReturnFlowModal.Header>

      <ReturnFlowModal.Body
        style={{
          maxHeight: '75vh',
          overflowY: 'auto',
        }}
      >
        {error && (
          <div
            ref={errorRef}
            role="alert"
            className="alert alert-danger"
          >
            {error}
          </div>
        )}

        {notice && !data?.completed && (
          <div
            role="status"
            className="alert alert-success"
          >
            {notice}
          </div>
        )}

        {!data ? (
          <p>Đang tải thông tin trả đồ…</p>
        ) : (
          <>

            <section className="border rounded p-3 mb-3">
              <h6>
                {isSale
                  ? 'Khách hàng & đơn mua'
                  : 'Khách hàng & thời gian thuê'}
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

              <strong>
                Nơi nhận trả: {data.shop.name}
              </strong>

              <div>
                {data.shop.address} · {data.shop.phone}
              </div>
            </section>

            <section className="border rounded p-3 mb-3">
              <h6>
                {!isSale && data.isPartialOrder
                  ? 'Trang phục trả đợt này'
                  : 'Trang phục hoàn trả'}
                {' '}
                (
                {data.items.reduce(
                  (sum, item) => sum + Number(item.quantity || 0),
                  0
                )}
                {' '}hiện vật)
              </h6>
              <div className="rr-table-wrap">
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
              </div>
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
                    ? (
                      isSale
                        ? 'Đã trả hàng hoàn tất'
                        : 'Hoàn tất trả đồ'
                    )
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

            {!isSale &&
              data.isPartialOrder &&
              !data.completed && (
                <div className="alert alert-info py-2 small mb-3">
                  Đã hoàn cọc các đợt trước:{' '}

                  <strong>
                    {Number(
                      data.refundedDepositAmount || 0
                    ).toLocaleString('vi-VN')}đ
                  </strong>

                  {Number(
                    data.deductedDepositAmount || 0
                  ) > 0 && (
                      <>
                        {' · '}
                        Đã khấu trừ:{' '}

                        <strong>
                          {Number(
                            data.deductedDepositAmount
                          ).toLocaleString('vi-VN')}đ
                        </strong>
                      </>
                    )}

                  {' · '}
                  Cọc còn lại đang giữ:{' '}

                  <strong>
                    {Number(
                      data.remainingDepositAmount || 0
                    ).toLocaleString('vi-VN')}đ
                  </strong>
                </div>
              )}

            {batchNotice && !data.completed && (
              <div
                role="status"
                className="alert alert-success"
              >
                {batchNotice}
              </div>
            )}

            {data.completed && (
              <div
                role="status"
                className="alert alert-success"
              >
                {isSale
                  ? 'Đã trả hàng hoàn tất. '
                  : 'Đã hoàn tất trả đồ. '}

                {data.refundedAmount != null &&
                  Number.isFinite(
                    Number(data.refundedAmount)
                  ) && (
                    <>
                      Đã hoàn{' '}
                      {Number(
                        data.refundedAmount
                      ).toLocaleString('vi-VN')}đ{' '}
                      {isSale
                        ? 'tiền mua hàng'
                        : 'tiền cọc'}{' '}
                      vào Ví Vestora của chủ đơn.
                    </>
                  )}
              </div>
            )}

            {isSale &&
              data.requestBlockedReason &&
              !data.completed && (
                <p className="text-muted">
                  {data.requestBlockedReason}
                </p>
              )}

            {!data.completed &&
              (
                !shipment ||
                ['cancelled', 'failed'].includes(status)
              ) &&
              data.canRequest &&
              !readOnly &&
              !isSale && (
                data.simulatorEnabled ? (
                  <div className="mt-3">
                    {['cancelled', 'failed'].includes(status) && (
                      <div className="alert alert-warning py-2 mb-2 small">
                        Vận đơn trước đó đã bị{' '}
                        {status === 'cancelled'
                          ? 'hủy'
                          : 'thất bại'}.{' '}
                        Bạn có thể tạo lại vận đơn thu hồi GHN mới.
                      </div>
                    )}

                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() =>
                        run(() => api.request(orderId))
                      }
                    >
                      Tạo đơn thu hồi đồ (GHN)
                    </button>
                  </div>
                ) : (
                  <div className="alert alert-info py-2 mb-0 small">
                    Vui lòng dùng nút thu hồi đồ thuê ở màn hình
                    chi tiết đơn hàng để chọn trang phục trả và
                    tạo vận đơn GHN.
                  </div>
                )
              )}

            {!data.completed &&
              (
                !shipment ||
                ['cancelled', 'failed'].includes(status)
              ) &&
              data.canRequest &&
              !readOnly &&
              isSale && (
                <div className="alert alert-info py-2 mb-0 small">
                  Vui lòng dùng nút tạo yêu cầu trả hàng qua GHN
                  ở màn hình chi tiết đơn hàng để chọn món cần trả
                  và địa chỉ lấy hàng.
                </div>
              )}

            {!data.completed &&
              data.canManage &&
              !readOnly && (
                <div className="mt-3">
                  {status === 'delivered' ? (
                    <>
                      {!isSale && (
                        <div className="border rounded p-3 mb-3">
                          <h6>
                            Nghiệm thu {slots.length} hiện vật của đợt trả
                          </h6>

                          <p className="small text-muted">
                            Chọn đúng mã của món khách trả đợt này.
                            Món chưa trả tiếp tục được giữ trong đơn thuê.
                          </p>

                          {needsInventoryLink ? (
                            <RentalInventoryFields
                              embedded
                              orderId={orderId}
                              data={data}
                              busy={busy}
                              run={run}
                            />
                          ) : (
                            <RentalBatchInspectionFields
                              slots={slots}
                              busy={busy}
                              onChange={handleSlotChange}
                            />
                          )}

                          <strong>
                            Tổng bồi thường đánh giá:
                            {' '}{totalAssessedDamage.toLocaleString('vi-VN')}đ
                          </strong>

                          <p className="small text-muted mt-2">
                            Phí quá hạn được trừ trước. Số thực thu không vượt
                            phần cọc quyết toán của đợt trả; cọc của món chưa trả
                            vẫn được giữ.
                          </p>

                          <label className="d-block mt-3">
                            Ghi chú chung của đợt trả (không bắt buộc)

                            <textarea
                              className="form-control"
                              rows={2}
                              maxLength={500}
                              value={inspectionNote}
                              disabled={busy}
                              onChange={event => {
                                setInspectionNote(event.target.value);
                                setConfirmed(false);
                              }}
                            />
                          </label>
                        </div>
                      )}

                      <label className="d-block mb-2">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          disabled={busy}
                          onChange={event =>
                            setConfirmed(event.target.checked)
                          }
                        />{' '}

                        {isSale
                          ? 'Đã kiểm tra và nhận đủ đồ nguyên vẹn'
                          : 'Đã kiểm tra và ghi nhận đúng tình trạng từng hiện vật'}
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

                      {completionErrors.length > 0 && (
                        <div className="alert alert-warning py-2" role="status">
                          Chưa thể hoàn tất:

                          <ul className="mb-0">
                            {completionErrors.map((message, index) => (
                              <li key={index}>{message}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button
                        className="btn btn-success"
                        disabled={busy || completionErrors.length > 0}
                        onClick={async () => {
                          if (completionErrors.length) return;

                          const res = await run(() =>
                            isSale
                              ? api.complete(orderId)
                              : api.complete(orderId, {
                                shipmentId: data.shipment._id,
                                inspections: inspectionRows,
                                note: inspectionNote.trim(),
                              })
                          );

                          const payload = res?.data || res;

                          if (
                            payload?.isPartial ||
                            payload?.status === 'partially_returned'
                          ) {
                            setConfirmed(false);
                            setInspections({});
                            setInspectionNote('');

                            setBatchNotice(
                              `Đã hoàn ${Number(
                                payload.refundedAmount || 0
                              ).toLocaleString('vi-VN')}đ tiền cọc đợt này; đơn chuyển sang trạng thái đang trả một phần.`
                            );
                          }
                        }}
                      >
                        {isSale
                          ? 'Hoàn tất trả hàng & hoàn tiền'
                          : 'Hoàn tất trả đồ & hoàn cọc'}
                      </button>
                    </>
                  ) : (
                    data.simulatorEnabled &&
                    shipment?.isSimulated
                  ) ? (
                    <>
                      {status === 'preparing' && (
                        <button
                          className="btn btn-outline-primary"
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              api.advance(orderId, 'shipped')
                            )
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
                            run(() =>
                              api.advance(orderId, 'delivered')
                            )
                          }
                        >
                          Mô phỏng: đã giao về shop
                        </button>
                      )}
                    </>
                  ) : (
                    shipment &&
                    ['preparing', 'shipped'].includes(status) &&
                    !data.simulatorEnabled
                  ) ? (
                    <p className="text-muted mb-0">
                      Mô phỏng trả đồ chưa được bật trên máy chủ.
                    </p>
                  ) : null}
                </div>
              )}

            {busy && (
              <p role="status">
                Đang xử lý…
              </p>
            )}
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
  return (
    <RentalReturnWorkflow
      {...props}
      orderType="sale"
    />
  );
}

export function SalesDeliveryVideos(props) {
  return (
    <RentalDeliveryVideos
      {...props}
      orderType="sale"
    />
  );
}