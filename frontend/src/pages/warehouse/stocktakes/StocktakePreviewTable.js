import React, { useMemo, useState } from 'react';
import { EmptyState, Pagination } from '../../../components/warehouse';

const PAGE_LIMIT = 20;

const variantLabel = (variant) => [variant?.sku, variant?.size, variant?.color].filter(Boolean).join(' · ') || '—';
const trackingLabel = (item) => (item.trackingType === 'individual' ? 'Theo từng mã hàng' : 'Theo số lượng');
const systemLabel = (item) => (item.trackingType === 'individual' ? `${item.systemQuantity} món` : item.systemQuantity);
const storageLabel = (item) => {
  if (!item.storageId) return 'Không có kệ';
  return item.storage?.code || item.storage?.name || 'Vị trí không xác định';
};

/**
 * Bảng "Lấy danh sách hàng hóa": các cặp (biến thể, vị trí) sẽ có trong phiếu theo phạm vi đã chọn.
 * WM bỏ chọn dòng nào thì phiếu không gồm dòng đó. Phân trang phía client (API trả toàn bộ danh sách).
 */
export default function StocktakePreviewTable({ items, excludedKeys, onToggle, onToggleAll }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_LIMIT);
  const pageItems = useMemo(() => items.slice((page - 1) * limit, page * limit), [items, page, limit]);
  const selectedCount = items.length - excludedKeys.size;

  if (!items.length) {
    return (
      <EmptyState
        title="Không có hàng hóa trong phạm vi này"
        description="Phạm vi đã chọn hiện không có tồn sổ. Hãy đổi vị trí / sản phẩm rồi lấy lại danh sách."
      />
    );
  }

  return (
    <div className="wm-stock-preview">
      <p className="wm-stock-subline">
        Đã chọn {selectedCount}/{items.length} dòng.
        {' '}Tồn sổ sẽ được chụp lại lúc bắt đầu kiểm; số ở đây chỉ để tham khảo.
      </p>
      <div className="wm-table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả dòng"
                  checked={excludedKeys.size === 0}
                  onChange={(event) => onToggleAll(event.target.checked)}
                />
              </th>
              <th>Sản phẩm</th>
              <th>Biến thể</th>
              <th>Vị trí</th>
              <th>Kiểu quản lý</th>
              <th>Tồn sổ hiện tại</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item) => (
              <tr key={item.key}>
                <td>
                  <input
                    type="checkbox"
                    aria-label="Chọn dòng"
                    checked={!excludedKeys.has(item.key)}
                    onChange={() => onToggle(item.key)}
                  />
                </td>
                <td>{item.variant?.productId?.name || '—'}</td>
                <td>{variantLabel(item.variant)}</td>
                <td>{storageLabel(item)}</td>
                <td>{trackingLabel(item)}</td>
                <td>{systemLabel(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        limit={limit}
        total={items.length}
        onChange={setPage}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
      />
    </div>
  );
}
