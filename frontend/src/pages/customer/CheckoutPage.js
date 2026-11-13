/**
 * Checkout Page — Rental-only checkout flow
 * Haute Couture design tokens, zero native dialogs, zero emoji, zero axios.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  FileText,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Package,
  Calendar,
  Loader2,
  Square,
  CheckSquare,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useCartStore } from '../../stores/useCartStore';
import { ORDER_TYPES } from '../../services/cart/cartTypes';
import { formatCurrencyVND } from '../../services/cart/cartCalculations';
import { createRentalOrder } from '../../services/rentalOrderApi';
import productService from '../../services/productService';
import GhnAddressSelector from '../../components/common/GhnAddressSelector';
import { getUserLocation } from '../../utils/userLocation';
import { calculateHaversineDistanceKm } from '../../utils/geoUtils';
import '../../styles/Cart.css';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, clearCart, updateItemBranch, removeItems } = useCartStore();

  // All rental items from cart (memoized)
  const rentalItems = useMemo(
    () => (items || []).filter((it) => it.orderType === ORDER_TYPES.RENTAL),
    [items]
  );
  const saleItems = useMemo(
    () => (items || []).filter((it) => it.orderType === ORDER_TYPES.SALE),
    [items]
  );
  const hasSaleItems = saleItems.length > 0;

  // ── Selection state (using unselectedIds to prevent infinite render loops) ──
  const [unselectedIds, setUnselectedIds] = useState(() => new Set());

  const toggleItem = useCallback((cartItemId) => {
    setUnselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cartItemId)) {
        next.delete(cartItemId);
      } else {
        next.add(cartItemId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setUnselectedIds((prev) => {
      if (prev.size === 0) {
        // Unselect all
        return new Set(rentalItems.map((it) => it.cartItemId));
      }
      // Select all
      return new Set();
    });
  }, [rentalItems]);

  // Items that will actually be ordered
  const selectedItems = useMemo(
    () => rentalItems.filter((it) => !unselectedIds.has(it.cartItemId)),
    [rentalItems, unselectedIds]
  );

  const selectedCount = selectedItems.length;
  const hasSelectedItems = selectedCount > 0;
  const allSelected = rentalItems.length > 0 && unselectedIds.size === 0;
  const someSelected = unselectedIds.size > 0 && selectedCount > 0;

  // ── Auto-resolve branch & repair variantId if needed ────────────────────────
  const [resolvingBranches, setResolvingBranches] = useState(false);
  const attemptedItemsRef = useRef(new Set());

  useEffect(() => {
    const unassigned = rentalItems.filter(
      (it) =>
        (!it.selectedBranch?.locationId ||
          !/^[0-9a-fA-F]{24}$/.test(String(it.selectedBranch.locationId)) ||
          !it.variantId ||
          !/^[0-9a-fA-F]{24}$/.test(String(it.variantId))) &&
        !attemptedItemsRef.current.has(it.cartItemId)
    );

    if (unassigned.length === 0) return;

    // Đánh dấu ngay lập tức để không bao giờ chạy lại cho cùng item
    unassigned.forEach((it) => attemptedItemsRef.current.add(it.cartItemId));

    let isMounted = true;
    setResolvingBranches(true);

    const resolveBranches = async () => {
      const userLoc = getUserLocation();
      try {
        for (const it of unassigned) {
          try {
            const res = await productService.getProductById(it.productId);
            const pData = res?.data || res;
            let rawBranches = Array.isArray(pData?.branches) ? pData.branches : [];

            // Bỏ kho tổng, chỉ lấy ở các chi nhánh (store / showroom)
            rawBranches = rawBranches.filter((b) => {
              const name = String(b.name || '').toLowerCase();
              const type = String(b.type || '').toLowerCase();
              return (
                type !== 'warehouse' &&
                !name.includes('kho tổng') &&
                !name.includes('kho tong') &&
                !name.includes('kho trung tâm')
              );
            });

            // Sửa variantId nếu variantId cũ không phải ObjectId 24 ký tự
            let repairedVariantId = it.variantId;
            if (!/^[0-9a-fA-F]{24}$/.test(String(it.variantId))) {
              const variants = Array.isArray(pData?.variants) ? pData.variants : [];
              const matched =
                variants.find(
                  (v) =>
                    String(v.size || '').toLowerCase() === String(it.size || '').toLowerCase() &&
                    String(v.color || '').toLowerCase() === String(it.color || '').toLowerCase()
                ) ||
                variants.find(
                  (v) => String(v.size || '').toLowerCase() === String(it.size || '').toLowerCase()
                ) ||
                variants[0];
              if (matched?._id) {
                repairedVariantId = String(matched._id);
              }
            }

            if (rawBranches.length > 0) {
              const withDist = rawBranches.map((b) => {
                let distanceKm = null;
                if (
                  userLoc?.latitude != null &&
                  userLoc?.longitude != null &&
                  b.latitude != null &&
                  b.longitude != null
                ) {
                  distanceKm = calculateHaversineDistanceKm(
                    userLoc.latitude,
                    userLoc.longitude,
                    b.latitude,
                    b.longitude
                  );
                }
                return { ...b, distanceKm };
              });

              withDist.sort((a, b) => {
                if (a.distanceKm == null && b.distanceKm == null) return 0;
                if (a.distanceKm == null) return 1;
                if (b.distanceKm == null) return -1;
                return a.distanceKm - b.distanceKm;
              });

              const best = withDist[0];
              const locId = best.locationId || best._id;
              if (locId && /^[0-9a-fA-F]{24}$/.test(String(locId))) {
                updateItemBranch(it.cartItemId, {
                  locationId: String(locId),
                  name: best.name,
                  address: best.address,
                  ...(repairedVariantId !== it.variantId ? { variantId: repairedVariantId } : {}),
                });
                setValidationError('');
              }
            } else if (repairedVariantId !== it.variantId) {
              updateItemBranch(it.cartItemId, { variantId: repairedVariantId });
            }
          } catch (e) {
            console.warn('Lỗi tự động xác định chi nhánh cho:', it.name, e);
          }
        }
      } finally {
        if (isMounted) setResolvingBranches(false);
      }
    };

    resolveBranches();

    return () => {
      isMounted = false;
    };
  }, [rentalItems, updateItemBranch]);

  // ── Summary totals for selected items only ─────────────────────────────────
  const { rentalFeeSubtotal, depositSubtotal } = useMemo(() => {
    let rental = 0;
    let deposit = 0;
    for (const it of selectedItems) {
      rental += it.lineRentalFee || 0;
      deposit += it.lineDeposit || it.depositAmount || 0;
    }
    return { rentalFeeSubtotal: rental, depositSubtotal: deposit };
  }, [selectedItems]);

  const rentalTotal = rentalFeeSubtotal + depositSubtotal;

  // Form state
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [successModal, setSuccessModal] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState(null);

  // Shipping Address state
  const [shippingAddress, setShippingAddress] = useState({
    receiverName: '',
    phone: '',
    street: '',
    ward: '',
    district: '',
    city: '',
    provinceId: null,
    districtId: null,
    wardCode: '',
  });

  const handleAddressChange = (field, value) => {
    setShippingAddress((prev) => ({ ...prev, [field]: value }));
  };

  const handleDivisionsChange = useCallback((divisionData) => {
    setShippingAddress((prev) => ({
      ...prev,
      provinceId: divisionData.provinceId,
      city: divisionData.city,
      districtId: divisionData.districtId,
      district: divisionData.district,
      wardCode: divisionData.wardCode,
      ward: divisionData.ward,
    }));
  }, []);

  // Lấy chi nhánh từ các selected items
  const branchesInCart = useMemo(() => {
    const seen = new Map();
    for (const it of selectedItems) {
      const locId = it.selectedBranch?.locationId;
      if (locId && !seen.has(String(locId))) {
        seen.set(String(locId), it.selectedBranch);
      }
    }
    return Array.from(seen.values());
  }, [selectedItems]);

  // Validate dates
  const validateDates = useCallback(() => {
    for (const item of selectedItems) {
      if (!item.startDate || !item.dueDate) {
        return 'Vui lòng quay lại giỏ hàng để chọn ngày thuê cho tất cả sản phẩm đã chọn.';
      }
      const start = new Date(item.startDate).getTime();
      const due = new Date(item.dueDate).getTime();
      if (isNaN(start) || isNaN(due) || due <= start) {
        return 'Ngày trả đồ phải sau ngày nhận đồ.';
      }
    }
    return '';
  }, [selectedItems]);

  // Validate locations and variants
  const validateItems = useCallback(() => {
    for (const item of selectedItems) {
      const locId = item.selectedBranch?.locationId;
      if (!locId || !/^[0-9a-fA-F]{24}$/.test(String(locId))) {
        return `Sản phẩm "${item.name}" chưa xác định được chi nhánh khả dụng. Vui lòng thử lại sau giây lát.`;
      }
      if (!item.variantId || !/^[0-9a-fA-F]{24}$/.test(String(item.variantId))) {
        return `Biến thể của sản phẩm "${item.name}" chưa hợp lệ. Vui lòng thêm lại sản phẩm vào giỏ hàng.`;
      }
    }
    return '';
  }, [selectedItems]);

  // Submit handler
  const handleSubmit = async () => {
    setSubmitError('');
    setValidationError('');

    if (!hasSelectedItems) return;

    const dateError = validateDates();
    if (dateError) {
      setValidationError(dateError);
      return;
    }

    const itemError = validateItems();
    if (itemError) {
      setValidationError(itemError);
      return;
    }

    if (!shippingAddress.receiverName.trim()) {
      setValidationError('Vui lòng nhập họ và tên người nhận trang phục.');
      return;
    }
    if (!shippingAddress.phone.trim() || shippingAddress.phone.trim().length < 8) {
      setValidationError('Vui lòng nhập số điện thoại người nhận hợp lệ.');
      return;
    }
    if (!shippingAddress.provinceId) {
      setValidationError('Vui lòng chọn Tỉnh/Thành phố nhận trang phục.');
      return;
    }
    if (!shippingAddress.districtId) {
      setValidationError('Vui lòng chọn Quận/Huyện nhận trang phục.');
      return;
    }
    if (!shippingAddress.wardCode) {
      setValidationError('Vui lòng chọn Phường/Xã nhận trang phục.');
      return;
    }
    if (!shippingAddress.street.trim()) {
      setValidationError('Vui lòng nhập số nhà, tên đường chi tiết nhận trang phục.');
      return;
    }

    setSubmitting(true);

    try {
      // Group by locationId + startDate + dueDate → mỗi nhóm = 1 đơn thuê
      const groupMap = new Map();
      for (const it of selectedItems) {
        const locId = String(it.selectedBranch?.locationId || '');
        const key = `${locId}|${it.startDate || ''}|${it.dueDate || ''}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            locationId: locId,
            startDate: it.startDate,
            dueDate: it.dueDate,
            items: [],
          });
        }
        groupMap.get(key).items.push(it);
      }

      let lastOrderId = null;
      for (const group of groupMap.values()) {
        const payload = {
          locationId: String(group.locationId),
          startDate: String(group.startDate),
          dueDate: String(group.dueDate),
          items: group.items.map((it) => ({
            variantId: String(it.variantId),
            quantity: Number(it.quantity) || 1,
            ...(it.note ? { note: it.note } : {}),
          })),
          paymentMethod: 'wallet',
          shippingAddress: {
            receiverName: shippingAddress.receiverName.trim(),
            phone: shippingAddress.phone.trim(),
            street: shippingAddress.street.trim(),
            ward: shippingAddress.ward.trim(),
            district: shippingAddress.district.trim(),
            city: shippingAddress.city.trim(),
            provinceId: shippingAddress.provinceId ? Number(shippingAddress.provinceId) : null,
            districtId: shippingAddress.districtId ? Number(shippingAddress.districtId) : null,
            wardCode: shippingAddress.wardCode ? String(shippingAddress.wardCode).trim() : null,
          },
          ...(note.trim() ? { note: note.trim() } : {}),
        };

        const data = await createRentalOrder(payload);
        lastOrderId = data?.data?._id || lastOrderId;
      }

      // Xóa các sản phẩm đã đặt khỏi giỏ
      if (selectedItems.length === rentalItems.length) {
        clearCart();
      } else {
        removeItems(selectedItems.map((it) => it.cartItemId));
      }

      setConfirmedOrderId(lastOrderId);
      setSuccessModal(true);
    } catch (err) {
      console.error('Lỗi đặt thuê:', err);
      setSubmitError(err.message || 'Không thể tạo đơn thuê. Vui lòng thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = !hasSelectedItems || submitting || resolvingBranches;

  // ── Styles ─────────────────────────────────────────────────────────────────
  const styles = {
    pageContainer: {
      backgroundColor: '#faf9f6',
      minHeight: '100vh',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: '#27272a',
      paddingBottom: 80,
    },
    headerHero: {
      maxWidth: 1320,
      margin: '0 auto',
      padding: '32px 32px 16px 32px',
    },
    backLink: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      color: '#71717A',
      fontSize: '13px',
      textDecoration: 'none',
      fontWeight: 500,
    },
    titleRow: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 12,
      marginTop: 12,
    },
    mainTitle: {
      fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
      fontSize: 38,
      fontWeight: 600,
      color: '#18181b',
      margin: 0,
      letterSpacing: '-0.4px',
    },
    mainGrid: {
      maxWidth: 1320,
      margin: '16px auto 0 auto',
      padding: '0 32px',
      display: 'grid',
      gridTemplateColumns: '1.45fr 0.85fr',
      gap: 36,
      alignItems: 'start',
    },
    card: {
      background: '#FFFFFF',
      borderRadius: 16,
      border: '1px solid #E5E0D8',
      padding: 24,
    },
    stickyCard: {
      background: '#FFFFFF',
      borderRadius: 12,
      border: '1px solid #E5E0D8',
      padding: 24,
      position: 'sticky',
      top: 100,
    },
    sectionTitle: {
      fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
      fontSize: 20,
      fontWeight: 600,
      color: '#171717',
      margin: '0 0 18px 0',
      paddingBottom: 14,
      borderBottom: '1px solid #E5E0D8',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },
    selectAllBar: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 0 14px 0',
      borderBottom: '1px solid #F4F4F5',
      marginBottom: 4,
      cursor: 'pointer',
      userSelect: 'none',
    },
    selectAllLabel: {
      fontSize: 13,
      fontWeight: 600,
      color: '#3F3F46',
      flex: 1,
    },
    selectCountBadge: {
      fontSize: 12,
      color: '#71717A',
    },
    itemRow: {
      display: 'flex',
      gap: 14,
      padding: '14px 0',
      borderBottom: '1px solid #F4F4F5',
      alignItems: 'center',
      cursor: 'pointer',
      transition: 'background 0.15s ease',
    },
    itemImage: {
      width: 64,
      height: 76,
      borderRadius: 10,
      objectFit: 'cover',
      background: '#F4F4F5',
      flexShrink: 0,
    },
    itemDetails: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
    },
    itemName: {
      fontSize: 14,
      fontWeight: 600,
      color: '#18181b',
      margin: 0,
    },
    itemMeta: {
      fontSize: 12,
      color: '#71717A',
    },
    itemPrice: {
      textAlign: 'right',
      flexShrink: 0,
    },
    warningBanner: {
      background: '#FFFBEB',
      border: '1px solid #FDE68A',
      borderRadius: 10,
      padding: '14px 18px',
      fontSize: 13,
      color: '#92400E',
      lineHeight: 1.6,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 18,
    },
    noSelectionBanner: {
      background: '#FFF7ED',
      border: '1px solid #FDBA74',
      borderRadius: 10,
      padding: '12px 16px',
      fontSize: 13,
      color: '#9A3412',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
    },
    errorBox: {
      background: '#FEF2F2',
      border: '1px solid #FECACA',
      borderRadius: 10,
      padding: '14px 18px',
      fontSize: 13,
      color: '#991B1B',
      lineHeight: 1.6,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      marginTop: 14,
    },
    label: {
      fontSize: 13,
      fontWeight: 600,
      color: '#3F3F46',
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    input: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: '8px',
      border: '1px solid #D4D4D8',
      fontSize: '13.5px',
      color: '#18181b',
      outline: 'none',
      background: '#FFFFFF',
      boxSizing: 'border-box',
    },
    textarea: {
      width: '100%',
      minHeight: 80,
      border: '1px solid #E5E0D8',
      borderRadius: 10,
      padding: '10px 12px',
      fontSize: 13,
      fontFamily: 'inherit',
      color: '#27272a',
      outline: 'none',
      resize: 'vertical',
      background: '#FFFFFF',
      boxSizing: 'border-box',
    },
    paymentBadge: {
      background: '#F0FDF4',
      border: '1px solid #BBF7D0',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 13,
      fontWeight: 600,
      color: '#15803D',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
    },
    summaryRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: 13.5,
      color: '#3F3F46',
      padding: '6px 0',
    },
    summaryTotal: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTop: '1.5px dashed #E5E0D8',
      paddingTop: 14,
      marginTop: 10,
    },
    totalLabel: {
      fontSize: 14,
      fontWeight: 600,
      color: '#171717',
    },
    totalAmount: {
      fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
      fontSize: 24,
      fontWeight: 700,
      color: '#171717',
      letterSpacing: '-0.5px',
    },
    submitButton: {
      width: '100%',
      height: 50,
      background: '#171717',
      color: '#F8F7F4',
      border: 'none',
      borderRadius: 12,
      fontSize: 14.5,
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 18,
      transition: 'all 0.2s ease',
      boxShadow: '0 4px 14px rgba(23, 23, 23, 0.18)',
    },
    submitButtonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    trustLine: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
      fontSize: 11,
      color: '#9CA3AF',
    },
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />

      {/* Page Header */}
      <div style={styles.headerHero}>
        <div style={{ marginBottom: 12 }}>
          <Link to="/cart" style={styles.backLink}>
            <ArrowLeft size={16} />
            <span>Quay lại giỏ hàng</span>
          </Link>
        </div>
        <div style={styles.titleRow}>
          <h1 style={styles.mainTitle}>Xác nhận đơn thuê</h1>
        </div>
      </div>

      {/* Main Grid */}
      <div style={styles.mainGrid}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Sale items banner */}
          {hasSaleItems && (
            <div style={styles.warningBanner}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1, color: '#D97706' }} />
              <span>
                Giỏ hàng của bạn có {saleItems.length} sản phẩm mua đứt.{' '}
                <Link
                  to="/checkout/sale"
                  style={{
                    color: '#96723D',
                    fontWeight: 600,
                    textDecoration: 'underline',
                  }}
                >
                  Bấm vào đây để thanh toán đơn mua ngay
                </Link>
                .
              </span>
            </div>
          )}

          {/* Rental Items List */}
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>
              <Package size={18} style={{ color: '#C5A880' }} />
              Trang phục thuê ({rentalItems.length} sản phẩm)
            </h3>

            {rentalItems.length === 0 ? (
              <p style={{ fontSize: 14, color: '#71717A', textAlign: 'center', padding: '24px 0' }}>
                Giỏ hàng không có sản phẩm thuê nào. Vui lòng quay lại giỏ hàng.
              </p>
            ) : (
              <>
                {/* Select-all bar */}
                <div style={styles.selectAllBar} onClick={toggleAll}>
                  {allSelected ? (
                    <CheckSquare size={18} color="#C5A880" />
                  ) : someSelected ? (
                    <CheckSquare size={18} color="#D4B896" />
                  ) : (
                    <Square size={18} color="#A1A1AA" />
                  )}
                  <span style={styles.selectAllLabel}>Chọn tất cả</span>
                  <span style={styles.selectCountBadge}>
                    Đã chọn {selectedCount}/{rentalItems.length}
                  </span>
                </div>

                {/* Item rows */}
                {rentalItems.map((item, idx) => {
                  const isSelected = !unselectedIds.has(item.cartItemId);
                  return (
                    <div
                      key={item.cartItemId || idx}
                      style={{
                        ...styles.itemRow,
                        ...(idx === rentalItems.length - 1 ? { borderBottom: 'none' } : {}),
                        background: isSelected ? '#FDFCFB' : 'transparent',
                        opacity: isSelected ? 1 : 0.45,
                      }}
                      onClick={() => toggleItem(item.cartItemId)}
                    >
                      {/* Checkbox */}
                      <div style={{ flexShrink: 0 }}>
                        {isSelected ? (
                          <CheckSquare size={18} color="#C5A880" />
                        ) : (
                          <Square size={18} color="#A1A1AA" />
                        )}
                      </div>

                      {/* Thumbnail */}
                      {item.thumbnailImage ? (
                        <img src={item.thumbnailImage} alt={item.name} style={styles.itemImage} />
                      ) : (
                        <div
                          style={{
                            ...styles.itemImage,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Package size={24} color="#D4D4D8" />
                        </div>
                      )}

                      {/* Details */}
                      <div style={styles.itemDetails}>
                        <p style={styles.itemName}>{item.name}</p>
                        <span style={styles.itemMeta}>
                          {[item.size, item.color].filter(Boolean).join(' / ')}
                          {item.quantity > 1 ? ` — SL: ${item.quantity}` : ''}
                        </span>
                        <span
                          style={{
                            fontSize: 11.5,
                            color: '#52525B',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 2,
                          }}
                        >
                          <Calendar size={12} />
                          {item.startDate
                            ? new Date(item.startDate).toLocaleDateString('vi-VN')
                            : '—'}{' '}
                          →{' '}
                          {item.dueDate
                            ? new Date(item.dueDate).toLocaleDateString('vi-VN')
                            : '—'}
                          {item.rentalDays ? ` (${item.rentalDays} ngày)` : ''}
                        </span>
                      </div>

                      {/* Price */}
                      <div style={styles.itemPrice}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>
                          {formatCurrencyVND(item.lineRentalFee || 0)}
                        </div>
                        <div style={{ fontSize: 11, color: '#71717A' }}>
                          {formatCurrencyVND(item.rentalPricePerDay || 0)}/ngày
                        </div>
                        {(item.lineDeposit || item.depositAmount) ? (
                          <div style={{ fontSize: 11, color: '#96723D', fontWeight: 600, marginTop: 2 }}>
                            Cọc: {formatCurrencyVND(item.lineDeposit || item.depositAmount || 0)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {/* No item selected warning */}
                {!hasSelectedItems && (
                  <div style={styles.noSelectionBanner}>
                    <AlertTriangle size={16} style={{ flexShrink: 0, color: '#EA580C' }} />
                    <span>Vui lòng chọn ít nhất một sản phẩm để tiến hành đặt thuê.</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Shipping Address Form */}
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>
              <MapPin size={18} style={{ color: '#C5A880' }} />
              Địa chỉ nhận trang phục
            </h3>
            <p style={{ fontSize: 13, color: '#71717A', margin: '-8px 0 16px 0' }}>
              Vestora sẽ giao trang phục đến tận nơi theo địa chỉ này trước ngày bắt đầu thuê.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={styles.label}>Họ và tên người nhận *</label>
                  <input
                    type="text"
                    required
                    value={shippingAddress.receiverName}
                    onChange={(e) => handleAddressChange('receiverName', e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn A"
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={styles.label}>Số điện thoại liên hệ *</label>
                  <input
                    type="tel"
                    required
                    value={shippingAddress.phone}
                    onChange={(e) => handleAddressChange('phone', e.target.value)}
                    placeholder="Ví dụ: 0912 345 678"
                    style={styles.input}
                  />
                </div>
              </div>

              <GhnAddressSelector
                provinceId={shippingAddress.provinceId}
                districtId={shippingAddress.districtId}
                wardCode={shippingAddress.wardCode}
                onChange={handleDivisionsChange}
                required
              />

              <div>
                <label style={styles.label}>Số nhà, tên đường chi tiết *</label>
                <input
                  type="text"
                  required
                  value={shippingAddress.street}
                  onChange={(e) => handleAddressChange('street', e.target.value)}
                  placeholder="Ví dụ: Số 72 Lê Thánh Tôn"
                  style={styles.input}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={styles.stickyCard}>
            <h3 style={styles.sectionTitle}>Thông tin đặt thuê</h3>

            {/* Branch info */}
            <div style={{ marginBottom: 18 }}>
              <label style={styles.label}>
                <MapPin size={14} style={{ color: '#C5A880' }} />
                Chi nhánh nhận đồ
              </label>
              {resolvingBranches ? (
                <div
                  style={{
                    fontSize: 13,
                    color: '#71717A',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 0',
                  }}
                >
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Đang xác định chi nhánh gần bạn nhất...</span>
                </div>
              ) : !hasSelectedItems ? (
                <div style={{ fontSize: 13, color: '#A1A1AA', padding: '6px 0' }}>
                  Chưa chọn sản phẩm
                </div>
              ) : branchesInCart.length === 0 ? (
                <div style={{ fontSize: 13, color: '#DC2626', padding: '6px 0' }}>
                  Không xác định được chi nhánh. Vui lòng thử lại sau giây lát.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {branchesInCart.map((branch, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#F8F7F4',
                        border: '1px solid #E5E0D8',
                        borderRadius: 10,
                        padding: '10px 14px',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <MapPin size={15} style={{ color: '#C5A880', flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div style={{ fontWeight: 600, color: '#171717' }}>
                          {branch.name || 'Chi nhánh Vestora'}
                        </div>
                        {branch.address && (
                          <div style={{ fontSize: 12, color: '#71717A', marginTop: 2 }}>
                            {branch.address}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Note */}
            <div style={{ marginBottom: 18 }}>
              <label style={styles.label}>
                <FileText size={14} style={{ color: '#C5A880' }} />
                Ghi chú (tuỳ chọn)
              </label>
              <textarea
                style={styles.textarea}
                placeholder="Ghi chú thêm cho đơn thuê..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </div>

            {/* Payment Method */}
            <div style={{ marginBottom: 20 }}>
              <label style={styles.label}>
                <Wallet size={14} style={{ color: '#C5A880' }} />
                Phương thức thanh toán
              </label>
              <div style={styles.paymentBadge}>
                <Wallet size={16} />
                Ví Vestora
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid #E5E0D8', margin: '0 0 16px 0' }} />

            {/* Price Summary */}
            <div style={styles.summaryRow}>
              <span>
                Phí thuê trang phục
                {selectedCount < rentalItems.length && rentalItems.length > 0 && (
                  <span style={{ fontSize: 11, color: '#A1A1AA', marginLeft: 4 }}>
                    ({selectedCount} sản phẩm)
                  </span>
                )}
              </span>
              <strong style={{ color: '#18181b' }}>{formatCurrencyVND(rentalFeeSubtotal)}</strong>
            </div>
            <div style={styles.summaryRow}>
              <span>Tiền cọc bảo đảm</span>
              <strong style={{ color: '#96723D' }}>{formatCurrencyVND(depositSubtotal)}</strong>
            </div>
            <div style={styles.summaryTotal}>
              <span style={styles.totalLabel}>Tổng thanh toán</span>
              <span style={styles.totalAmount}>{formatCurrencyVND(rentalTotal)}</span>
            </div>

            {/* Validation Error */}
            {validationError && (
              <div style={styles.errorBox}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1, color: '#DC2626' }} />
                <span>{validationError}</span>
              </div>
            )}

            {/* Submit Error */}
            {submitError && (
              <div style={styles.errorBox}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1, color: '#DC2626' }} />
                <span>{submitError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="button"
              style={{
                ...styles.submitButton,
                ...(isSubmitDisabled ? styles.submitButtonDisabled : {}),
              }}
              disabled={isSubmitDisabled}
              onClick={handleSubmit}
              aria-label="Xác nhận đặt thuê"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>
                    Xác nhận đặt thuê
                    {hasSelectedItems && selectedCount < rentalItems.length
                      ? ` (${selectedCount})`
                      : ''}
                  </span>
                </>
              )}
            </button>

            {/* Trust line */}
            <div style={styles.trustLine}>
              <ShieldCheck size={14} color="#C5A880" />
              <span>Giao dịch bảo mật qua Ví Vestora</span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {successModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(23, 23, 23, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              border: '1px solid #E5E0D8',
              padding: '36px 32px',
              maxWidth: 480,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#FDF8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto',
              }}
            >
              <CheckCircle2 size={36} color="#C5A880" />
            </div>

            <h3
              style={{
                fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
                fontSize: 24,
                fontWeight: 600,
                color: '#171717',
                margin: '0 0 10px 0',
              }}
            >
              Đặt Thuê Thành Công
            </h3>

            <p
              style={{
                fontSize: 14,
                color: '#57534E',
                lineHeight: 1.6,
                margin: '0 0 24px 0',
              }}
            >
              Đơn thuê trang phục Haute Couture của quý khách đã được tạo và lưu vào hệ thống.
              Tiền thuê và tiền cọc tương ứng đã được xử lý qua Ví Vestora.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => navigate('/rental-orders', { state: { newOrderId: confirmedOrderId } })}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  background: '#171717',
                  color: '#F8F7F4',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#C5A880'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#171717'; }}
              >
                Xem Lịch Sử Đơn Thuê
              </button>

              <button
                type="button"
                onClick={() => navigate('/catalog')}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  background: 'transparent',
                  color: '#57534E',
                  border: '1px solid #E5E0D8',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#171717';
                  e.currentTarget.style.color = '#171717';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E0D8';
                  e.currentTarget.style.color = '#57534E';
                }}
              >
                Tiếp Tục Khám Phá Bộ Sưu Tập
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
