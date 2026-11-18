import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import SearchableSelect from '../SearchableSelect';
import { loadVariantsWithProducts } from './ProductVariantPicker';
import {
  idOf, pickedLines, productsOfVariants, quantityByVariant, quantityError, variantsOfProduct,
} from './variantQuantityRules';

/** Tải biến thể (đã populate sản phẩm) khi trang không truyền `variants`; dùng chung bộ nhớ đệm với ProductVariantPicker. */
function useVariants(variants) {
  const shouldLoad = variants === undefined;
  const [state, setState] = useState({ rows: [], loading: shouldLoad, error: '' });
  useEffect(() => {
    if (!shouldLoad) return undefined;
    let active = true;
    loadVariantsWithProducts()
      .then((rows) => { if (active) setState({ rows: Array.isArray(rows) ? rows : [], loading: false, error: '' }); })
      .catch((error) => { if (active) setState({ rows: [], loading: false, error: error?.message || 'Không tải được danh sách sản phẩm.' }); });
    return () => { active = false; };
  }, [shouldLoad]);
  return shouldLoad ? state : { rows: variants || [], loading: false, error: '' };
}

/** Tồn theo biến thể của sản phẩm đang chọn (một lần gọi `stockResolver` cho cả bảng). */
function useStock(stockResolver, variantIds) {
  const key = variantIds.join(',');
  const [state, setState] = useState({ key: '', map: new Map(), loading: false, error: '' });
  useEffect(() => {
    if (!stockResolver || !key) return undefined;
    let active = true;
    setState({ key, map: new Map(), loading: true, error: '' });
    Promise.resolve(stockResolver(key.split(',')))
      .then((map) => { if (active) setState({ key, map: map instanceof Map ? map : new Map(Object.entries(map || {})), loading: false, error: '' }); })
      .catch((error) => { if (active) setState({ key, map: new Map(), loading: false, error: error?.message || 'Không tải được tồn kho.' }); });
    return () => { active = false; };
  }, [stockResolver, key]);
  return state.key === key ? state : { map: new Map(), loading: Boolean(stockResolver && key), error: '' };
}

/**
 * Chọn nhiều biến thể của một sản phẩm cùng lúc (TASK-014 B1).
 * Chọn sản phẩm → bảng biến thể đang hoạt động (sắp theo màu rồi size) → nhập số lượng → "Thêm vào phiếu".
 * Component chỉ trả các dòng được chọn; màn gọi tự cộng dồn vào dòng phiếu (`mergeQuantityLines`) nên payload không đổi.
 * @param {object} props
 * @param {(lines: {variantId: string, variant: object, quantity: number}[]) => void} props.onAdd
 * @param {{variantId: string|object, quantity: number|string}[]} [props.existingLines] dòng đang có trong phiếu
 * @param {(variantIds: string[]) => Promise<Map<string, number>>} [props.stockResolver] đọc tồn cho cột tồn
 *   (bọc bằng useCallback ở màn gọi: đổi tham chiếu sẽ đọc lại tồn)
 * @param {string} [props.stockLabel] tiêu đề cột tồn (mặc định "Tồn")
 * @param {boolean} [props.maxByStock] chặn nhập quá tồn (tính cả số đã có trong phiếu)
 * @param {(variant: object) => boolean} [props.filterVariant] lọc thêm theo nghiệp vụ
 * @param {object[]} [props.variants] danh sách biến thể đã populate `productId` (không truyền thì tự tải)
 * @param {boolean} [props.disabled]
 * @param {string} [props.addText] chữ trên nút thêm
 */
export default function VariantQuantityPicker({
  onAdd, existingLines = [], stockResolver, stockLabel = 'Tồn', maxByStock = false, filterVariant, variants,
  disabled = false, addText = 'Thêm vào phiếu',
}) {
  const source = useVariants(variants);
  const [productId, setProductId] = useState('');
  const [quantities, setQuantities] = useState({});

  const productOptions = useMemo(() => productsOfVariants(source.rows)
    .filter((product) => variantsOfProduct(source.rows, product, filterVariant).length)
    .map((product) => ({ value: idOf(product), label: product.name || product.productCode, subLabel: product.productCode || '' })),
  [source.rows, filterVariant]);
  const rows = useMemo(() => (productId ? variantsOfProduct(source.rows, productId, filterVariant) : []), [source.rows, productId, filterVariant]);
  const variantIds = useMemo(() => rows.map(idOf), [rows]);
  const stock = useStock(stockResolver, variantIds);
  const inSlip = useMemo(() => quantityByVariant(existingLines), [existingLines]);

  const maxFor = (variantId) => {
    if (!maxByStock || !stock.map.has(variantId)) return null;
    return Math.max(0, stock.map.get(variantId) - (inSlip.get(variantId) || 0));
  };
  const errors = Object.fromEntries(rows.map((variant) => [idOf(variant), quantityError(quantities[idOf(variant)], maxFor(idOf(variant)))]));
  const picked = pickedLines(rows, quantities);
  const hasError = Object.values(errors).some(Boolean);
  const blockedByStock = maxByStock && (stock.loading || Boolean(stock.error));
  const canAdd = !disabled && picked.length > 0 && !hasError && !blockedByStock;

  const chooseProduct = (value) => { setProductId(value || ''); setQuantities({}); };
  const add = () => {
    if (!canAdd) return;
    onAdd(picked);
    setQuantities({});
  };

  let placeholder = 'Tìm sản phẩm theo tên hoặc mã...';
  if (source.loading) placeholder = 'Đang tải sản phẩm...';
  if (source.error) placeholder = source.error;

  return (
    <div className="wh-variant-picker">
      <Form.Group className="mb-2">
        <Form.Label>Sản phẩm</Form.Label>
        <SearchableSelect options={productOptions} value={productId} onChange={chooseProduct} placeholder={placeholder}
          searchPlaceholder="Gõ tên hoặc mã sản phẩm..." disabled={disabled || source.loading} isInvalid={Boolean(source.error)} allowClear />
      </Form.Group>
      {productId && !rows.length && <small className="text-muted">Sản phẩm không có biến thể đang hoạt động.</small>}
      {rows.length > 0 && (
        <>
          {stock.error && <div className="wm-error">{stock.error}</div>}
          <Table size="sm" responsive className="align-middle mb-2">
            <thead>
              <tr>
                <th>Màu</th><th>Size</th><th>SKU</th>
                {stockResolver && <th className="text-end">{stockLabel}</th>}
                <th style={{ width: 150 }}>Số lượng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((variant) => {
                const id = idOf(variant);
                const already = inSlip.get(id) || 0;
                return (
                  <tr key={id}>
                    <td>{variant.color || '—'}</td>
                    <td>{variant.size || '—'}</td>
                    <td><small>{variant.sku}</small></td>
                    {stockResolver && <td className="text-end">{stock.loading ? '…' : (stock.map.get(id) ?? '—')}</td>}
                    <td>
                      <Form.Control size="sm" type="number" min="0" step="1" inputMode="numeric" value={quantities[id] ?? ''}
                        isInvalid={Boolean(errors[id])} disabled={disabled} aria-label={`Số lượng ${variant.sku}`}
                        max={maxFor(id) ?? undefined}
                        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }}
                        onChange={(event) => setQuantities((old) => ({ ...old, [id]: event.target.value }))} />
                      <Form.Control.Feedback type="invalid">{errors[id]}</Form.Control.Feedback>
                      {already > 0 && <Form.Text>Đã có trong phiếu: {already}</Form.Text>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <div className="d-flex justify-content-end align-items-center gap-2">
            <small className="text-muted">{picked.length} biến thể có số lượng</small>
            <Button size="sm" variant="dark" type="button" disabled={!canAdd} onClick={add}>{addText}</Button>
          </div>
        </>
      )}
    </div>
  );
}
