import React, { useEffect, useMemo, useState } from 'react';
import SearchableSelect from '../SearchableSelect';
import productVariantService from '../../services/masterdata/productVariantService';
import productService from '../../services/masterdata/productService';
import { formatVariantName } from '../../constants/warehouseLabels';

// Nhiều ô chọn trên cùng một form dùng chung một lần tải, tránh gọi API lặp lại.
const CACHE_MS = 30 * 1000;
let cachedLoad = null;
let cachedAt = 0;

const idOf = (value) => String(value?._id || value || '');

function isPopulated(productRef) {
  return Boolean(productRef && typeof productRef === 'object' && productRef.name);
}

/** Gắn thông tin sản phẩm vào các biến thể có `productId` chưa populate. */
async function attachProducts(variants) {
  const needProducts = variants.some((variant) => !isPopulated(variant.productId));
  if (!needProducts) return variants;
  const products = await productService.list();
  const productById = new Map(products.map((product) => [idOf(product), product]));
  return variants.map((variant) => {
    if (isPopulated(variant.productId)) return variant;
    const product = productById.get(idOf(variant.productId));
    if (!product) return variant;
    return { ...variant, productId: product };
  });
}

export function loadVariantsWithProducts() {
  const cacheIsFresh = Date.now() - cachedAt < CACHE_MS;
  if (cachedLoad && cacheIsFresh) return cachedLoad;
  cachedAt = Date.now();
  cachedLoad = productVariantService.list().then(attachProducts);
  cachedLoad.catch(() => {
    cachedLoad = null;
  });
  return cachedLoad;
}

/** Biến thể còn dùng được: biến thể đang bán và sản phẩm (nếu biết) chưa ngừng / chưa xóa. */
function isActiveVariant(variant) {
  if (variant.isDeleted === true) return false;
  if (variant.status && variant.status !== 'active') return false;
  const product = variant.productId;
  if (!isPopulated(product)) return true;
  if (product.isDeleted === true) return false;
  if (product.status && product.status !== 'active') return false;
  return true;
}

function toOption(variant) {
  const product = isPopulated(variant.productId) ? variant.productId : null;
  return {
    value: idOf(variant),
    label: formatVariantName(variant, product?.name),
    subLabel: product?.productCode || product?.code || '',
    variant,
  };
}

/** Tự tải danh sách biến thể khi trang không truyền `variants`. */
function useVariantSource(variants) {
  const shouldLoad = variants === undefined;
  const [loaded, setLoaded] = useState([]);
  const [loading, setLoading] = useState(shouldLoad);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shouldLoad) return undefined;
    let active = true;
    setLoading(true);
    loadVariantsWithProducts()
      .then((rows) => {
        if (active) setLoaded(Array.isArray(rows) ? rows : []);
      })
      .catch((loadError) => {
        if (active) setError(loadError?.message || 'Không tải được danh sách sản phẩm.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [shouldLoad]);

  if (!shouldLoad) return { rows: variants || [], loading: false, error: '' };
  return { rows: loaded, loading, error };
}

/**
 * Một ô tìm và chọn thẳng biến thể sản phẩm, tìm theo tên sản phẩm, mã sản phẩm hoặc SKU.
 * Mỗi lựa chọn hiển thị "Tên · SKU · size · màu".
 * @param {object} props
 * @param {string} props.value id biến thể đang chọn ('' nếu chưa chọn)
 * @param {(variantId: string, variant: object|null) => void} props.onChange gọi khi chọn / bỏ chọn
 * @param {object[]} [props.variants] danh sách biến thể đã populate `productId`;
 *   không truyền thì component tự tải qua productVariantService (+ productService khi cần)
 * @param {string[]} [props.excludeIds] id biến thể cần ẩn (ví dụ đã có ở dòng khác), trừ `value`
 * @param {boolean} [props.onlyActive=true] chỉ hiện biến thể / sản phẩm đang hoạt động
 * @param {(variant: object) => boolean} [props.filter] lọc thêm theo nghiệp vụ của trang
 * @param {string} [props.placeholder] chữ khi chưa chọn
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.isInvalid] tô viền lỗi
 * @param {boolean} [props.allowClear] cho phép bỏ chọn
 * @param {string} [props.id]
 */
export default function ProductVariantPicker({
  value = '',
  onChange,
  variants,
  excludeIds = [],
  onlyActive = true,
  filter,
  placeholder = 'Tìm theo tên sản phẩm hoặc SKU...',
  disabled = false,
  isInvalid = false,
  allowClear = false,
  id,
}) {
  const { rows, loading, error } = useVariantSource(variants);

  const options = useMemo(() => {
    const hidden = new Set(excludeIds.map(String).filter((excluded) => excluded !== String(value)));
    return rows
      .filter((variant) => !onlyActive || isActiveVariant(variant))
      .filter((variant) => !filter || filter(variant))
      .filter((variant) => !hidden.has(idOf(variant)))
      .map(toOption);
  }, [rows, excludeIds, value, onlyActive, filter]);

  let shownPlaceholder = placeholder;
  if (loading) shownPlaceholder = 'Đang tải sản phẩm...';
  if (error) shownPlaceholder = error;

  const handleChange = (variantId, option) => {
    if (!onChange) return;
    onChange(variantId || '', option?.variant || null);
  };

  return (
    <SearchableSelect
      id={id}
      options={options}
      value={value}
      onChange={handleChange}
      placeholder={shownPlaceholder}
      searchPlaceholder="Gõ tên sản phẩm hoặc SKU..."
      disabled={disabled || loading}
      isInvalid={isInvalid || Boolean(error)}
      allowClear={allowClear}
    />
  );
}
