import React, { useMemo } from 'react';

const idOf = (value) => String(value?._id || value || '');

export default function StocktakeScopeSelector({ storages, products, variants, selectedStorageIds, onStorageChange, selectedProductIds, onProductChange, selectedVariantIds, onVariantChange }) {
  const storageById = useMemo(() => new Map(storages.map((storage) => [idOf(storage), storage])), [storages]);
  const selectedStorage = storageById.get(selectedStorageIds[0]);
  const selectedRow = selectedStorage?.type === 'shelf' ? storageById.get(idOf(selectedStorage.parentStorageId)) : selectedStorage?.type === 'row' ? selectedStorage : null;
  const selectedZone = selectedRow ? storageById.get(idOf(selectedRow.parentStorageId)) : selectedStorage?.type === 'zone' ? selectedStorage : null;
  const zones = storages.filter((storage) => storage.type === 'zone' && !idOf(storage.parentStorageId));
  const rows = storages.filter((storage) => storage.type === 'row' && idOf(storage.parentStorageId) === idOf(selectedZone));
  const shelves = storages.filter((storage) => storage.type === 'shelf' && idOf(storage.parentStorageId) === idOf(selectedRow));
  const selectedVariant = variants.find((variant) => idOf(variant) === selectedVariantIds[0]);
  const selectedProductId = selectedProductIds[0] || idOf(selectedVariant?.productId);
  const productVariants = variants.filter((variant) => idOf(variant.productId) === selectedProductId);

  const setLocation = (id) => onStorageChange(id ? [id] : []);
  const selectProduct = (id) => {
    onProductChange(id ? [id] : []);
    onVariantChange([]);
  };
  const selectVariant = (id) => {
    if (!id) {
      onVariantChange([]);
      onProductChange(selectedProductId ? [selectedProductId] : []);
      return;
    }
    onProductChange([]);
    onVariantChange([id]);
  };

  return <div className="wm-scope-selector">
    <div className="wm-scope-dropdown-row">
      <label>Khu<select value={idOf(selectedZone)} onChange={(event) => setLocation(event.target.value)}><option value="">Tất cả khu</option>{zones.map((zone) => <option key={idOf(zone)} value={idOf(zone)}>{zone.code} · {zone.name}</option>)}</select></label>
      <label>Dãy<select value={idOf(selectedRow)} disabled={!selectedZone} onChange={(event) => setLocation(event.target.value || idOf(selectedZone))}><option value="">Tất cả dãy trong khu</option>{rows.map((row) => <option key={idOf(row)} value={idOf(row)}>{row.code} · {row.name}</option>)}</select></label>
      <label>Kệ<select value={selectedStorage?.type === 'shelf' ? idOf(selectedStorage) : ''} disabled={!selectedRow} onChange={(event) => setLocation(event.target.value || idOf(selectedRow))}><option value="">Tất cả kệ trong dãy</option>{shelves.map((shelf) => <option key={idOf(shelf)} value={idOf(shelf)}>{shelf.code} · {shelf.name}</option>)}</select></label>
    </div>
    <div className="wm-scope-dropdown-row wm-scope-product-row">
      <label>Sản phẩm<select value={selectedProductId} onChange={(event) => selectProduct(event.target.value)}><option value="">Tất cả sản phẩm</option>{products.map((product) => <option key={idOf(product)} value={idOf(product)}>{product.productCode} · {product.name}</option>)}</select></label>
      <label>Biến thể<select value={idOf(selectedVariant)} disabled={!selectedProductId} onChange={(event) => selectVariant(event.target.value)}><option value="">Tất cả biến thể của sản phẩm</option>{productVariants.map((variant) => <option key={idOf(variant)} value={idOf(variant)}>{variant.sku} · {variant.color || '—'} · {variant.size || '—'}</option>)}</select></label>
    </div>
  </div>;
}
