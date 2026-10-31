import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getBranchesListApi,
  getBranchManagersApi,
  toggleSuspendShopApi,
  deleteBranchApi,
} from '../../../../services/shopApi';

export function useBranchesData() {
  const [branches, setBranches] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [branchesResponse, managersResponse] = await Promise.all([
        getBranchesListApi({ limit: 100 }),
        getBranchManagersApi().catch(() => ({ success: true, data: [] })),
      ]);

      const branchList = (branchesResponse?.success && Array.isArray(branchesResponse.data))
        ? branchesResponse.data
        : [];
      setBranches(branchList);

      // Lọc nghiêm ngặt: Chỉ những tài khoản có vai trò Branch Manager mới hiển thị để bổ nhiệm
      if (managersResponse?.success && Array.isArray(managersResponse.data)) {
        const branchManagersOnly = managersResponse.data.filter((manager) => {
          const roleNormalized = String(manager?.Role || manager?.role || '')
            .trim()
            .toLowerCase()
            .replace(/[\s_-]/g, '');

          const isManagerRole = roleNormalized === 'branchmanager' || roleNormalized === 'brandmanager';
          const isNotCustomer = roleNormalized !== 'customer';

          return isManagerRole && isNotCustomer;
        });

        setManagers(branchManagersOnly);
      }
    } catch (err) {
      showToast(err.message || 'Không thể tải dữ liệu chi nhánh.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredBranches = useMemo(() => {
    const matched = branches.filter((branch) => {
      if (selectedStatus !== 'ALL' && branch.status !== selectedStatus) {
        return false;
      }

      if (selectedCity !== 'ALL') {
        const branchCity = (branch.city || '').toLowerCase();
        const filterCity = selectedCity.toLowerCase();
        if (!branchCity.includes(filterCity) && !filterCity.includes(branchCity)) {
          return false;
        }
      }

      const cleanTerm = searchTerm.trim().toLowerCase();
      if (cleanTerm.length > 0) {
        const nameMatched = (branch.name || '').toLowerCase().includes(cleanTerm);
        const addressMatched = (branch.address || '').toLowerCase().includes(cleanTerm);
        const phoneMatched = (branch.phone || '').toLowerCase().includes(cleanTerm);

        const managerName = (branch.managerId?.FullName || '').toLowerCase();
        const managerEmail = (branch.managerId?.Email || '').toLowerCase();
        const managerMatched = managerName.includes(cleanTerm) || managerEmail.includes(cleanTerm);

        if (!nameMatched && !addressMatched && !phoneMatched && !managerMatched) {
          return false;
        }
      }

      return true;
    });

    // Trụ sở chính luôn được ưu tiên ghim ở đầu tiên.
    // Các chi nhánh thông thường được hiển thị theo thứ tự từ cũ đến mới (ngày thành lập tăng dần).
    return matched.sort((a, b) => {
      if (a.isHQ && !b.isHQ) return -1;
      if (!a.isHQ && b.isHQ) return 1;

      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();

      if (timeA === timeB) {
        return String(a._id || '').localeCompare(String(b._id || ''));
      }

      return timeA - timeB;
    });
  }, [branches, selectedStatus, selectedCity, searchTerm]);

  const branchStats = useMemo(() => {
    const total = branches.length;
    const active = branches.filter((b) => b.status === 'ACTIVE').length;
    const mapped = branches.filter((b) => b.latitude != null && b.longitude != null).length;
    const staffed = branches.filter((b) => Boolean(b.managerId)).length;

    return { total, active, mapped, staffed };
  }, [branches]);

  const handleToggleSuspend = useCallback(async (branch) => {
    if (!branch || !branch._id) return;

    try {
      const response = await toggleSuspendShopApi(branch._id, {});
      if (response?.success) {
        showToast(response.message || 'Thay đổi trạng thái chi nhánh thành công!', 'success');
        await loadData();
      } else {
        throw new Error(response?.message || 'Có lỗi khi thay đổi trạng thái.');
      }
    } catch (err) {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái chi nhánh.', 'warning');
    }
  }, [loadData, showToast]);

  const handleDeleteBranch = useCallback(async (branchOrId) => {
    const id = typeof branchOrId === 'object' ? branchOrId?._id : branchOrId;
    if (!id) return false;

    try {
      const response = await deleteBranchApi(id);
      if (response?.success) {
        showToast(response.message || 'Đã xóa chi nhánh thành công.', 'success');
        await loadData();
        return true;
      } else {
        throw new Error(response?.message || 'Không thể xóa chi nhánh.');
      }
    } catch (err) {
      showToast(err.message || 'Lỗi khi xóa chi nhánh.', 'warning');
      return false;
    }
  }, [loadData, showToast]);

  return {
    branches,
    filteredBranches,
    managers,
    loading,
    toast,
    showToast,
    searchTerm,
    setSearchTerm,
    selectedCity,
    setSelectedCity,
    selectedStatus,
    setSelectedStatus,
    branchStats,
    loadData,
    handleToggleSuspend,
    handleDeleteBranch,
  };
}
