import { useEffect, useState } from 'react';
import stocktakeService from '../../../services/warehouse/stocktakeService';
import { previewScopePayload, selectedPreviewLines } from './stocktakeHelpers';

/**
 * Trạng thái bảng "Lấy danh sách hàng hóa" của form tạo phiếu kiểm kê.
 * Đổi phạm vi → bỏ danh sách cũ (tránh tạo phiếu theo danh sách của phạm vi khác).
 */
export default function useStocktakePreview(form, onError) {
  const [items, setItems] = useState(null);
  const [excluded, setExcluded] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const scopeKey = JSON.stringify(previewScopePayload(form));

  useEffect(() => {
    setItems(null);
    setExcluded(new Set());
  }, [scopeKey]);

  const load = async () => {
    setLoading(true);
    try {
      const result = await stocktakeService.preview(previewScopePayload(form));
      setItems(result?.items || []);
      setExcluded(new Set());
    } catch (error) {
      onError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key) => setExcluded((old) => {
    const next = new Set(old);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const toggleAll = (checked) => setExcluded(checked ? new Set() : new Set((items || []).map((item) => item.key)));

  const clear = () => {
    setItems(null);
    setExcluded(new Set());
  };

  return {
    items,
    excluded,
    loading,
    load,
    toggle,
    toggleAll,
    clear,
    /** `lines` gửi khi tạo phiếu: null nếu chưa lấy danh sách (hành vi cũ). */
    lines: () => (items ? selectedPreviewLines(items, excluded) : null),
  };
}
