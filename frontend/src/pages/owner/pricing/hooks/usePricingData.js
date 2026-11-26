import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import productService from '../../../../services/productService';
import {
  calculateRentalPrice,
  calculateDeposit,
  matchesProductTagFilter,
  computePricingKpis,
} from '../utils/pricingHelpers';

const DEFAULT_PAGE_SIZE = 10;

/**
 * Custom hook quản lý toàn bộ dữ liệu, tìm kiếm, lọc, phân trang và trạng thái cập nhật bảng giá
 */
export function usePricingData() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearchState] = useState('');
  const [selectedCategory, setSelectedCategoryState] = useState('ALL');
  // Mặc định chọn "Tất cả" khi mới truy cập trang
  const [pricingFilter, setPricingFilterState] = useState('all');
  // Lọc theo hình thức: 'ALL' | 'rental' | 'sale' | 'both'
  const [tagFilter, setTagFilterState] = useState('ALL');
  // Phân trang
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);

  // Deferred search value để giao diện luôn mượt mà khi lọc danh sách
  const deferredSearch = useDeferredValue(search);

  // Trạng thái modal chỉnh sửa giá & tiền cọc
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    salePrice: '',
    rentalPercent: 10,
    rentalPricePerDay: 0,
    depositPercent: 50,
    deposit: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [modalError, setModalError] = useState('');

  // Tải danh sách sản phẩm từ MongoDB Atlas (tự động gộp đủ trang nếu > 200 sản phẩm)
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // TASK-008: API riêng cho Owner, gồm cả sản phẩm chưa định giá (API public đã ẩn chúng).
      const firstRes = await productService.getOwnerPricingProducts({ pricingStatus: 'all', page: 1, limit: 200 });
      let rawList = [];
      if (firstRes && firstRes.data) {
        if (Array.isArray(firstRes.data.data)) {
          rawList = [...firstRes.data.data];
        } else if (Array.isArray(firstRes.data)) {
          rawList = [...firstRes.data];
        }
      }

      const serverTotalPages = Number(firstRes?.data?.pagination?.totalPages || 1);
      if (serverTotalPages > 1) {
        const restResponses = await Promise.all(
          Array.from({ length: serverTotalPages - 1 }, (_, idx) =>
            productService.getOwnerPricingProducts({ pricingStatus: 'all', page: idx + 2, limit: 200 })
          )
        );
        restResponses.forEach((res) => {
          if (Array.isArray(res?.data?.data)) {
            rawList.push(...res.data.data);
          }
        });
      }

      const mapped = rawList.map((p) => {
        const id = p._id || p.id;
        const code = p.productCode || p.sku || 'VESTORA';
        const name = p.name || 'Sản phẩm cao cấp';
        const category =
          p.categoryName ||
          (Array.isArray(p.category) ? p.category.join(', ') : 'Thời Trang Dạ Tiệc');
        const salePrice = Number(p.salePrice || 0);
        const rentalPricePerDay = Number(p.rentalPricePerDay || 0);
        const deposit = Number(p.deposit || 0);
        const image = (Array.isArray(p.images) && p.images[0]) || p.image || null;
        const variantsCount = Array.isArray(p.variants) ? p.variants.length : 0;
        const updatedAt = p.updatedAt;
        const isSetPrice = p.isSetPrice === true;

        return {
          id,
          code,
          name,
          category,
          salePrice,
          rentalPricePerDay,
          deposit,
          image,
          variantsCount,
          updatedAt,
          brand: p.brand || '',
          tag: p.tag || '',
          isSetPrice,
          priceSetAt: p.priceSetAt || null,
          missingPrices: Array.isArray(p.missingPrices) ? p.missingPrices : [],
        };
      });

      setItems(mapped);
    } catch (err) {
      console.error('Lỗi tải danh sách sản phẩm:', err);
      setErrorMsg('Không thể kết nối đến máy chủ để tải bảng giá. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const setSearch = useCallback((value) => {
    setSearchState(value);
    setPage(1);
  }, []);

  const setSelectedCategory = useCallback((value) => {
    setSelectedCategoryState(value);
    setPage(1);
  }, []);

  const setPricingFilter = useCallback((value) => {
    setPricingFilterState(value);
    setPage(1);
  }, []);

  const setTagFilter = useCallback((value) => {
    setTagFilterState(value);
    setPage(1);
  }, []);

  const setPageSize = useCallback((size) => {
    setPageSizeState(Number(size) || DEFAULT_PAGE_SIZE);
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchState('');
    setSelectedCategoryState('ALL');
    setPricingFilterState('all');
    setTagFilterState('ALL');
    setPage(1);
  }, []);

  const pricingCounts = useMemo(() => {
    const unset = items.filter((it) => !it.isSetPrice).length;
    return {
      unset,
      set: items.length - unset,
      all: items.length,
    };
  }, [items]);

  const tagCounts = useMemo(() => {
    const rental = items.filter((it) => matchesProductTagFilter(it.tag, 'rental')).length;
    const sale = items.filter((it) => matchesProductTagFilter(it.tag, 'sale')).length;
    const both = items.filter((it) => matchesProductTagFilter(it.tag, 'both')).length;
    return {
      all: items.length,
      rental,
      sale,
      both,
      unknown: items.length - rental - sale - both,
    };
  }, [items]);

  // Danh mục lấy từ dữ liệu thực kèm số lượng sản phẩm mỗi danh mục
  const categoryOptions = useMemo(() => {
    const map = new Map();
    items.forEach((i) => {
      if (i.category) {
        map.set(i.category, (map.get(i.category) || 0) + 1);
      }
    });

    const list = [{ name: 'ALL', label: 'Tất cả danh mục', count: items.length }];
    map.forEach((count, name) => {
      list.push({ name, label: name, count });
    });
    return list;
  }, [items]);

  // Lọc sản phẩm theo từ khóa tìm kiếm, danh mục, loại hình và trạng thái định giá
  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return items.filter((it) => {
      const matchSearch =
        !query ||
        it.name.toLowerCase().includes(query) ||
        it.code.toLowerCase().includes(query) ||
        it.brand.toLowerCase().includes(query);
      const matchCategory =
        selectedCategory === 'ALL' || it.category === selectedCategory;
      const matchTag = matchesProductTagFilter(it.tag, tagFilter);
      const matchPricing =
        pricingFilter === 'all' ||
        (pricingFilter === 'unset' ? !it.isSetPrice : it.isSetPrice);

      return matchSearch && matchCategory && matchTag && matchPricing;
    });
  }, [items, deferredSearch, selectedCategory, tagFilter, pricingFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredItems.length / pageSize)),
    [filteredItems.length, pageSize]
  );

  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safePage, pageSize]);

  // Tính toán KPI động (trung bình chỉ tính trên các mẫu có giá thuê / tiền cọc > 0)
  const kpiStats = useMemo(() => computePricingKpis(items), [items]);

  // Mở modal chỉnh sửa giá & cọc
  const handleOpenEdit = useCallback((it) => {
    setEditingItem(it);
    setModalError('');
    setSaveSuccess(false);

    const sale = Number(it.salePrice || 0);
    const currentRental = Number(it.rentalPricePerDay || 0);
    const currentDep = Number(it.deposit || 0);

    // Tính % ban đầu dựa trên giá trị mặt hàng, hoặc fallback theo preset gợi ý
    let initRentalPct = 10;
    if (sale > 0 && currentRental > 0) {
      initRentalPct = Math.round((currentRental / sale) * 100);
    }

    let initDepositPct = 50;
    if (sale > 0 && currentDep > 0) {
      initDepositPct = Math.min(100, Math.round((currentDep / sale) * 100));
    }

    const calculatedRental = calculateRentalPrice(sale, initRentalPct);
    const calculatedDeposit = calculateDeposit(sale, initDepositPct);

    setEditForm({
      salePrice: sale > 0 ? sale : '',
      rentalPercent: initRentalPct,
      rentalPricePerDay: currentRental > 0 ? currentRental : calculatedRental,
      depositPercent: initDepositPct,
      deposit: currentDep > 0 ? currentDep : calculatedDeposit,
    });
  }, []);

  const closeEditModal = useCallback(() => {
    if (!submitting) {
      setEditingItem(null);
      setModalError('');
      setSaveSuccess(false);
    }
  }, [submitting]);

  // Handler khi đổi Giá trị trang phục / Giá bán (kho đã nhập, cho phép sửa)
  // Tự động tính toán lại cả Giá thuê theo ngày và Tiền cọc dựa trên % tương ứng
  const handleSalePriceChange = useCallback((val) => {
    const newPrice = val === '' ? '' : Math.max(0, Number(val));
    setEditForm((prev) => {
      const autoRental = calculateRentalPrice(newPrice, prev.rentalPercent);
      const autoDeposit = calculateDeposit(newPrice, prev.depositPercent);
      return {
        ...prev,
        salePrice: newPrice,
        rentalPricePerDay: autoRental,
        deposit: autoDeposit,
      };
    });
  }, []);

  // Handler khi Shop Owner nhập % giá thuê mỗi ngày (hoặc click nút % gợi ý nhanh)
  const handleRentalPercentChange = useCallback((val) => {
    const p = val === '' ? '' : Math.max(0, Math.min(100, Number(val)));
    setEditForm((prev) => {
      const autoRental = calculateRentalPrice(prev.salePrice, p);
      return {
        ...prev,
        rentalPercent: p,
        rentalPricePerDay: autoRental,
      };
    });
  }, []);

  // Handler khi Shop Owner nhập số % cọc bằng tay (hoặc click nút % gợi ý nhanh)
  const handleDepositPercentChange = useCallback((val) => {
    const p = val === '' ? '' : Math.max(0, Math.min(100, Number(val)));
    setEditForm((prev) => {
      const autoDeposit = calculateDeposit(prev.salePrice, p);
      return {
        ...prev,
        depositPercent: p,
        deposit: autoDeposit,
      };
    });
  }, []);

  const handleQuickRentalPercent = handleRentalPercentChange;
  const handleQuickDepositPercent = handleDepositPercentChange;

  // Handler lưu bảng giá (chỉ lưu các trường hiện có trong DB)
  const handleSavePrice = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    setModalError('');
    const sale = Number(editForm.salePrice);
    const rent = Number(editForm.rentalPricePerDay);
    const dep = Number(editForm.deposit);

    if (isNaN(sale) || sale < 0) {
      setModalError('Vui lòng nhập giá trị trang phục hợp lệ (không âm).');
      return;
    }

    if (isNaN(rent) || rent < 0) {
      setModalError('Vui lòng nhập giá thuê mỗi ngày hợp lệ (không âm).');
      return;
    }

    if (isNaN(dep) || dep < 0) {
      setModalError('Vui lòng nhập tiền cọc hợp lệ (không âm).');
      return;
    }

    if (sale > 0 && dep > sale) {
      setModalError(`Tiền cọc bảo đảm không được vượt quá 100% giá trị trang phục (tối đa ${sale.toLocaleString('vi-VN')} VND).`);
      return;
    }

    setSubmitting(true);
    try {
      await productService.updatePricing(editingItem.id, {
        salePrice: sale,
        rentalPricePerDay: rent,
        deposit: dep,
      });

      // Cập nhật state cục bộ ngay tức thì
      setItems((prevItems) =>
        prevItems.map((it) => {
          if (it.id === editingItem.id) {
            return {
              ...it,
              salePrice: sale,
              rentalPricePerDay: rent,
              deposit: dep,
              updatedAt: new Date().toISOString(),
              isSetPrice: true,
              priceSetAt: new Date().toISOString(),
              missingPrices: [],
            };
          }
          return it;
        })
      );

      setSaveSuccess(true);
      setTimeout(() => {
        setEditingItem(null);
        setSaveSuccess(false);
      }, 700);
    } catch (err) {
      console.error('Lỗi cập nhật bảng giá:', err);
      const resMsg = err.response?.data?.message;
      setModalError(
        resMsg || 'Không thể lưu bảng giá. Vui lòng kiểm tra quyền Shop Owner và kết nối mạng.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return {
    items,
    loading,
    errorMsg,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    categoryOptions,
    filteredItems,
    paginatedItems,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    kpiStats,
    pricingFilter,
    setPricingFilter,
    pricingCounts,
    tagFilter,
    setTagFilter,
    tagCounts,
    resetFilters,
    fetchProducts,
    // Modal
    editingItem,
    editForm,
    submitting,
    saveSuccess,
    modalError,
    handleOpenEdit,
    closeEditModal,
    handleSalePriceChange,
    handleRentalPercentChange,
    handleQuickRentalPercent,
    handleDepositPercentChange,
    handleQuickDepositPercent,
    handleSavePrice,
  };
}
