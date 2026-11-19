import { useCallback, useEffect, useRef, useState } from 'react';

const SEARCH_DELAY_MS = 350;

/** API phân trang trả `{ items, total }`; nếu backend cũ trả mảng thì coi cả mảng là một trang. */
function normalizeResult(result) {
  if (Array.isArray(result)) return { items: result, total: result.length };
  return { items: result?.items || [], total: Number(result?.total) || 0 };
}

/**
 * Danh sách phiếu phân trang phía server.
 * Đổi trang, số dòng, trạng thái hoặc từ khóa (chờ người dùng ngừng gõ) đều gọi lại API;
 * không lọc hay cắt trang ở phía trình duyệt.
 * @param {(params: {page: number, limit: number, status: string, search: string}) => Promise<object>} fetchPage
 *   hàm gọi API, phải ổn định (bọc useCallback) để không gọi lặp
 * @param {object} [options]
 * @param {string} [options.initialStatus=''] trạng thái lọc ban đầu
 * @param {number} [options.initialLimit=10] số dòng mỗi trang ban đầu
 * @param {boolean} [options.enabled=true] false thì chưa gọi API (ví dụ chờ đủ dữ liệu ngữ cảnh)
 */
export default function usePagedList(fetchPage, { initialStatus = '', initialLimit = 10, enabled = true } = {}) {
  const [query, setQuery] = useState({ page: 1, limit: initialLimit, status: initialStatus, search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [list, setList] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled) return;
    requestId.current += 1;
    const current = requestId.current;
    setLoading(true);
    setError('');
    try {
      const result = normalizeResult(await fetchPage(query));
      // Bỏ kết quả của lần gọi cũ nếu người dùng đã đổi bộ lọc trong lúc chờ.
      if (current === requestId.current) setList(result);
    } catch (loadError) {
      if (current === requestId.current) setError(loadError?.message || 'Không tải được danh sách.');
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [fetchPage, query, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Chờ người dùng ngừng gõ rồi mới tìm, và quay về trang 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      const search = searchInput.trim();
      setQuery((old) => {
        if (old.search === search) return old;
        return { ...old, search, page: 1 };
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Trang hiện tại vượt quá số trang (ví dụ vừa có phiếu đổi trạng thái) thì lùi về trang cuối.
  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(list.total / query.limit));
    if (!loading && query.page > lastPage) setQuery((old) => ({ ...old, page: lastPage }));
  }, [list.total, query.limit, query.page, loading]);

  const setPage = useCallback((page) => setQuery((old) => ({ ...old, page })), []);
  const setLimit = useCallback((limit) => setQuery((old) => ({ ...old, limit, page: 1 })), []);
  const setStatus = useCallback((status) => setQuery((old) => ({ ...old, status, page: 1 })), []);

  return {
    items: list.items,
    total: list.total,
    page: query.page,
    limit: query.limit,
    status: query.status,
    search: query.search,
    searchInput,
    loading,
    error,
    setPage,
    setLimit,
    setStatus,
    setSearchInput,
    reload,
  };
}
