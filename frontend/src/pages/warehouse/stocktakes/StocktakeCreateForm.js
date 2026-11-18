import React from 'react';
import StocktakeScopeSelector from '../../../components/StocktakeScopeSelector';
import { codeAndName, idOf } from '../shared/slipHelpers';
import { storageScopeSize, variantScopeSize } from './stocktakeHelpers';

function ScopePreview({ form, storages, variants }) {
  const storageCount = storageScopeSize(storages, form.storageIds);
  const variantCount = variantScopeSize(variants, form.productIds, form.variantIds);
  const hasStorage = form.storageIds.length > 0;
  const hasProduct = form.productIds.length > 0 || form.variantIds.length > 0;
  return (
    <div className="wm-scope-summary">
      <strong>Phạm vi xem trước</strong>
      <span>
        {hasStorage
          ? `${form.storageIds.length} vị trí được chọn · ${storageCount} vị trí tính cả cấp con`
          : 'Toàn bộ vị trí trong kho tổng'}
      </span>
      <span>
        {hasProduct
          ? `${form.productIds.length} sản phẩm chọn toàn bộ · ${form.variantIds.length} biến thể chọn riêng`
            + ` · ${variantCount} biến thể dự kiến`
          : 'Toàn bộ sản phẩm và biến thể'}
      </span>
      <small>Phiếu chụp tồn sổ khi bắt đầu. Phạm vi này được giữ cố định trong suốt đợt kiểm kê.</small>
    </div>
  );
}

/**
 * Form tạo phiếu kiểm kê nháp (chủ kho): chọn phạm vi vị trí / sản phẩm và nhân viên kiểm.
 * Kho kiểm kê luôn là kho tổng duy nhất đang hoạt động.
 */
export default function StocktakeCreateForm({
  form, setForm, central, storages, products, variants, staff, busy, onSubmit, onCancel,
}) {
  const storagesOfLocation = storages.filter((storage) => idOf(storage.locationId) === idOf(form.locationId));
  const update = (patch) => setForm((old) => ({ ...old, ...patch }));

  return (
    <form className="wm-panel wm-form wm-stock-create" onSubmit={onSubmit}>
      <div className="wm-central-warehouse">
        <small>Kho kiểm kê (kho tổng)</small>
        <strong>{central ? codeAndName(central) : 'Chưa xác định duy nhất kho tổng'}</strong>
      </div>
      <StocktakeScopeSelector
        storages={storagesOfLocation}
        products={products}
        variants={variants}
        selectedStorageIds={form.storageIds}
        onStorageChange={(storageIds) => update({ storageIds })}
        selectedProductIds={form.productIds}
        onProductChange={(productIds) => update({ productIds })}
        selectedVariantIds={form.variantIds}
        onVariantChange={(variantIds) => update({ variantIds })}
      />
      <ScopePreview form={form} storages={storagesOfLocation} variants={variants} />
      <label>
        Nhân viên kiểm kê
        <select value={form.assignedStaffId} onChange={(event) => update({ assignedStaffId: event.target.value })}>
          <option value="">Tự kiểm kê / chưa giao</option>
          {staff.map((member) => (
            <option key={member._id} value={member._id}>{member.FullName} · {member.Email}</option>
          ))}
        </select>
      </label>
      <footer>
        <button type="button" className="secondary" onClick={onCancel}>Hủy</button>
        <button type="submit" disabled={busy || !form.locationId}>Tạo phiếu</button>
      </footer>
    </form>
  );
}
