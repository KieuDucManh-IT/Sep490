import { useCallback, useEffect, useState } from 'react';
import stockTransferService from '../../../services/warehouse/stockTransferService';

/**
 * Đọc khả dụng kho tổng + gợi ý lấy hàng của một phiếu (API chỉ đọc, không giữ chỗ).
 * `auto` = tải ngay khi mount (màn duyệt); không thì gọi `load()` khi người dùng bấm.
 * @returns {{ byDetail: Map<string, object>, lines: object[], loading: boolean, error: string, load: () => Promise<object[]> }}
 */
export default function usePickSuggestion(transferId, { auto = false } = {}) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await stockTransferService.pickSuggestion(transferId);
      const next = result?.lines || [];
      setLines(next);
      return next;
    } catch (loadError) {
      setError(loadError.message || 'Không tải được số khả dụng của kho tổng.');
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, [transferId]);

  useEffect(() => {
    if (auto) load().catch(() => {});
  }, [auto, load]);

  return { byDetail: new Map(lines.map((line) => [String(line.detailId), line])), lines, loading, error, load };
}
