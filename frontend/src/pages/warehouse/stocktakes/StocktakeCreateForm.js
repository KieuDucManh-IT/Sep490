import React from 'react';
import { Button } from 'react-bootstrap';
import StocktakeScopeSelector from '../../../components/StocktakeScopeSelector';
import { codeAndName, idOf } from '../shared/slipHelpers';
import StocktakePreviewTable from './StocktakePreviewTable';

/**
 * Form tạo phiếu kiểm kê nháp (chủ kho): chọn phạm vi vị trí / sản phẩm và nhân viên kiểm.
 * Kho kiểm kê luôn là kho tổng duy nhất đang hoạt động. "Lấy danh sách hàng hóa" hiện các dòng sẽ kiểm;
 * bỏ chọn dòng nào thì phiếu không gồm dòng đó. Không lấy danh sách → phiếu gồm mọi dòng trong phạm vi.
 */
export default function StocktakeCreateForm({
  form, setForm, central, storages, products, variants, staff, busy, onSubmit, onCancel, preview,
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
      <div className="wm-stock-preview-actions">
        <Button variant="outline-dark" disabled={busy || preview.loading || !form.locationId} onClick={preview.load}>
          {preview.loading ? 'Đang lấy danh sách…' : 'Lấy danh sách hàng hóa'}
        </Button>
        {preview.items && (
          <Button variant="link" disabled={busy} onClick={preview.clear}>Bỏ danh sách (kiểm mọi dòng trong phạm vi)</Button>
        )}
      </div>
      {preview.items && (
        <StocktakePreviewTable
          items={preview.items}
          excludedKeys={preview.excluded}
          onToggle={preview.toggle}
          onToggleAll={preview.toggleAll}
        />
      )}
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
