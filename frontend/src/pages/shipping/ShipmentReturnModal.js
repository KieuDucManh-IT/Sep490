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

  // Tự động khớp Tỉnh / Xã từ thông tin đơn hàng / initialShipment
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

    const prevSender = initialShipment?.senderInfo || initialShipment?.receiverInfo || {};
    const finalName = prevSender.name || receiverName;
    const finalPhone = prevSender.phone || receiverPhone;
    const finalAddress = prevSender.address || detailedAddress;
    const finalProvId = prevSender.provinceId || provinceIdHint;
    const finalWardCode = prevSender.wardCode || wardCodeHint;

    setFromName(finalName);
    setFromPhone(finalPhone);
    setFromAddress(finalAddress);
    if (initialShipment?.weight) setWeight(Number(initialShipment.weight));
    if (initialShipment?.note) setNote(initialShipment.note);
    setErrorMsg('');

    // Tự động phân tích và chọn Tỉnh/Thành, Phường/Xã cho điểm lấy đồ
    if (provinces.length > 0) {
      if (finalProvId) {
        handleProvinceChange(String(finalProvId), wardHint, finalWardCode, fullAddr);
      } else {
        const matchedProv = autoMatchProvince(provHint, fullAddr, provinces);
        if (matchedProv) {
          handleProvinceChange(String(matchedProv.ProvinceID), wardHint, finalWardCode, fullAddr);
        }
      }
    }
  }, [show, order, initialShipment, provinces, handleProvinceChange]);

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
      await action();
      await load();
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
  const [reason, setReason] = useState('');

  const [confirmed, setConfirmed] = useState(false);
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
              <h6>Trang phục hoàn trả ({data.items.length})</h6>

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

            {isSale && data.canRequest && !readOnly && (
              <div className="mb-3">
                <p>Yêu cầu trả lại toàn bộ sản phẩm trong đơn mua.</p>

                <label htmlFor="sales-return-reason" className="form-label">
                  Lý do trả hàng (không bắt buộc)
                </label>

                <textarea
                  id="sales-return-reason"
                  className="form-control"
                  maxLength={1000}
                  value={reason}
                  disabled={busy}
                  onChange={event => setReason(event.target.value)}
                />
              </div>
            )}

            {!data.completed && data.canRequest && !readOnly && (
              <button
                className="btn btn-primary"
                disabled={busy || !data.simulatorEnabled}
                onClick={() =>
                  run(() =>
                    isSale
                      ? api.request(orderId, reason)
                      : api.request(orderId)
                  )
                }
              >
                {isSale ? 'Tạo đơn trả hàng mua' : 'Tạo đơn trả đồ'}
              </button>
            )}

            {!data.completed &&
              data.canManage &&
              !readOnly &&
              data.simulatorEnabled &&
              shipment?.isSimulated && (
                <div className="mt-3">
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

                  {status === 'delivered' && (
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
                        onClick={() =>
                          run(() => api.complete(orderId))
                        }
                      >
                        {isSale
                          ? 'Hoàn tất trả hàng & hoàn tiền'
                          : 'Hoàn tất trả đồ & hoàn cọc'}
                      </button>
                    </>
                  )}
                </div>
              )}

            {!data.simulatorEnabled && !data.completed && (
              <p className="text-muted mt-3">
                Mô phỏng trả đồ chưa được bật trên máy chủ.
              </p>
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
