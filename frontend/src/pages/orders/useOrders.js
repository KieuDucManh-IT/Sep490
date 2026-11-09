import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getRentalOrdersApi,
  getSaleOrdersApi,
  getOrderMetricsApi,
} from '../../services/orderApi';
import { getAssignedBranchApi, getBranchesListApi } from '../../services/shopApi';

export function useOrders(type = 'rental', initialBranchId = '', isBranchProp) {
  const isBranchMode =
    typeof isBranchProp === 'boolean'
      ? isBranchProp
      : typeof window !== 'undefined' && window.location.pathname.startsWith('/branch');

  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    if (initialBranchId) return initialBranchId;
    if (isBranchMode) return localStorage.getItem('vestora_active_branch_id') || '';
    return '';
  });

  const [assignedBranches, setAssignedBranches] = useState(() => {
    try {
      const cached = localStorage.getItem('vestora_managed_branches_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [ownerBranches, setOwnerBranches] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [scopeInfo, setScopeInfo] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Tải danh sách chi nhánh (Phân biệt Owner vs Branch Manager)
  useEffect(() => {
    let isMounted = true;
    if (isBranchMode) {
      getAssignedBranchApi(selectedBranchId)
        .then((res) => {
          if (!isMounted || !res?.success) return;
          if (Array.isArray(res.assignedBranches) && res.assignedBranches.length > 0) {
            setAssignedBranches(res.assignedBranches);
            try {
              localStorage.setItem('vestora_managed_branches_cache', JSON.stringify(res.assignedBranches));
            } catch {}
          }
          if (!selectedBranchId && res.data?._id) {
            setSelectedBranchId(res.data._id);
            try {
              localStorage.setItem('vestora_active_branch_id', res.data._id);
              localStorage.setItem('vestora_branch_cache', JSON.stringify(res.data));
            } catch {}
            window.dispatchEvent(
              new CustomEvent('vestora_branch_changed', {
                detail: { branch: res.data, branchId: res.data._id },
              })
            );
          }
        })
        .catch(() => {});
    } else {
      getBranchesListApi({ limit: 100 })
        .then((res) => {
          if (!isMounted || !res?.success) return;
          const list = Array.isArray(res.data) ? res.data : [];
          setOwnerBranches(list);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [isBranchMode, selectedBranchId]);

  // 2. Tải danh sách đơn hàng & metrics
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (type === 'rental') {
        if (activeTab !== 'all') params.rentalStatus = activeTab;
      } else {
        if (activeTab !== 'all') params.orderStatus = activeTab;
      }

      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedBranchId) params.branchId = selectedBranchId;

      const fetchApi = type === 'rental' ? getRentalOrdersApi : getSaleOrdersApi;
      const res = await fetchApi(params);

      if (res.success) {
        const orderList = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.orders)
          ? res.data.orders
          : [];
        setOrders(orderList);

        if (res.pagination) {
          setPagination((prev) => ({
            ...prev,
            totalPages: res.pagination.totalPages || 1,
            totalItems: res.pagination.totalItems ?? orderList.length,
          }));
        }
        const metricsData = type === 'rental' ? res.data?.rentalMetrics : res.data?.salesMetrics;
        if (metricsData) {
          setMetrics(metricsData);
        }
        const scope = res.scope || res.data?.scope;
        if (scope) {
          setScopeInfo(scope);
        }
      } else {
        setError(res.message || `Không thể tải danh sách đơn ${type === 'rental' ? 'thuê' : 'bán'}.`);
      }
    } catch (err) {
      setError(err.message || `Lỗi khi tải danh sách đơn ${type === 'rental' ? 'thuê' : 'bán'}.`);
    } finally {
      setLoading(false);
    }
  }, [type, pagination.page, pagination.limit, activeTab, searchQuery, selectedBranchId]);

  // Tải riêng metrics khi cần
  const fetchMetrics = useCallback(async () => {
    try {
      const params = selectedBranchId ? { branchId: selectedBranchId } : {};
      const res = await getOrderMetricsApi(params);
      if (res.success && res.data) {
        setMetrics(type === 'rental' ? res.data.rentalMetrics : res.data.salesMetrics);
      }
    } catch {}
  }, [type, selectedBranchId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // 3. Danh sách chi nhánh & chi nhánh đang chọn
  const branchesList = useMemo(() => {
    return isBranchMode ? assignedBranches : ownerBranches;
  }, [isBranchMode, assignedBranches, ownerBranches]);

  const activeBranch = useMemo(() => {
    if (!selectedBranchId) return null;
    return branchesList.find((item) => String(item._id) === String(selectedBranchId)) || null;
  }, [branchesList, selectedBranchId]);

  const activeBranchName = useMemo(() => {
    if (activeBranch) return activeBranch.name || activeBranch.shopName || '';
    return '';
  }, [activeBranch]);

  const isActiveBranchHQ = useMemo(() => {
    return Boolean(activeBranch?.isHQ);
  }, [activeBranch]);

  const isChainScope = !selectedBranchId;

  // 4. Lắng nghe sự kiện đồng bộ khi người dùng chọn chi nhánh từ TopHeader
  useEffect(() => {
    const handleSyncFromHeader = (e) => {
      const incomingId = e.detail?.branchId || e.detail?.branch?._id;
      if (incomingId !== undefined) {
        setSelectedBranchId((currentId) => {
          if (String(currentId || '') !== String(incomingId || '')) {
            return String(incomingId || '');
          }
          return currentId;
        });
        if (e.detail?.branch && isBranchMode) {
          setAssignedBranches((prev) => {
            if (!prev.some((b) => String(b._id) === String(incomingId))) {
              return [...prev, e.detail.branch];
            }
            return prev;
          });
        }
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    };

    window.addEventListener('vestora_branch_changed', handleSyncFromHeader);
    return () => {
      window.removeEventListener('vestora_branch_changed', handleSyncFromHeader);
    };
  }, [isBranchMode]);

  // 5. Tương tác bộ lọc (Đổi tab, đổi chi nhánh, đổi trang)
  const changeTab = useCallback((tabKey) => {
    setActiveTab(tabKey);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const changeBranch = useCallback((branchId) => {
    setSelectedBranchId(branchId);
    setPagination((prev) => ({ ...prev, page: 1 }));

    if (branchId) {
      const branchObj = branchesList.find((b) => String(b?._id) === String(branchId));
      try {
        localStorage.setItem('vestora_active_branch_id', String(branchId));
        if (branchObj) {
          localStorage.setItem('vestora_branch_cache', JSON.stringify(branchObj));
        }
      } catch {}

      // Đồng bộ ngay lập tức lên Header và các component khác
      window.dispatchEvent(
        new CustomEvent('vestora_branch_changed', {
          detail: { branch: branchObj || null, branchId: String(branchId) },
        })
      );
    } else {
      try {
        localStorage.removeItem('vestora_active_branch_id');
        localStorage.removeItem('vestora_branch_cache');
      } catch {}

      window.dispatchEvent(
        new CustomEvent('vestora_branch_changed', {
          detail: { branch: null, branchId: '' },
        })
      );
    }
  }, [branchesList]);

  const changePage = useCallback((newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }, []);

  const openOrderDetail = useCallback((orderId) => {
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
  }, []);

  const closeOrderDetail = useCallback(() => {
    setSelectedOrderId(null);
    setIsModalOpen(false);
  }, []);

  return {
    orders,
    metrics,
    scopeInfo,
    pagination,
    loading,
    error,
    activeTab,
    searchQuery,
    selectedBranchId,
    branchesList,
    activeBranch,
    activeBranchName,
    isActiveBranchHQ,
    isChainScope,
    isBranchMode,
    selectedOrderId,
    isModalOpen,
    setSearchQuery,
    changeTab,
    changeBranch,
    changePage,
    openOrderDetail,
    closeOrderDetail,
    refetch: fetchOrders,
  };
}

export const useRentalOrders = (initialBranchId, isBranch) =>
  useOrders('rental', initialBranchId, isBranch);

export const useSaleOrders = (initialBranchId, isBranch) =>
  useOrders('sale', initialBranchId, isBranch);

