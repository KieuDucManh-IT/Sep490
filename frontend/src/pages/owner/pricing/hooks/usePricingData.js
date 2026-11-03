import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import productService from '../../../../services/productService';
import { calculateRentalPrice, calculateDeposit } from '../utils/pricingHelpers';

/**
 * Custom hook quản lý toàn bộ dữ liệu, tìm kiếm, lọc và trạng thái cập nhật bảng giá
 */
export function usePricingData() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

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

  // Tải danh sách sản phẩm từ MongoDB Atlas
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await productService.getProducts({ limit: 100 });
      let rawList = [];
      if (res && res.data) {
        if (Array.isArray(res.data.data)) {
          rawList = res.data.data;
        } else if (Array.isArray(res.data)) {
          rawList = res.data;
        }
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

  // Lọc sản phẩm theo từ khóa tìm kiếm (dùng deferredSearch) và danh mục
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
      return matchSearch && matchCategory;
    });
  }, [items, deferredSearch, selectedCategory]);

  // Tính toán KPI động
  const kpiStats = useMemo(() => {
    const total = items.length;
    if (!total) {
      return { total: 0, avgRental: 0, avgDeposit: 0 };
    }
    const sumRental = items.reduce((s, i) => s + (i.rentalPricePerDay || 0), 0);
    const sumDeposit = items.reduce((s, i) => s + (i.deposit || 0), 0);
    return {
      total,
      avgRental: Math.round(sumRental / total),
      avgDeposit: Math.round(sumDeposit / total),
    };
  }, [items]);

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
      initDepositPct = Math.round((currentDep / sale) * 100);
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
    const p = val === '' ? '' : Math.max(0, Math.min(200, Number(val)));
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
    kpiStats,
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
