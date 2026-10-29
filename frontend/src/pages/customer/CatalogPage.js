import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import productService from '../../services/productService';
import '../../styles/Catalog.css';

const COLOR_SWATCHES = [
  { name: 'Đen', code: '#111827', key: 'black' },
  { name: 'Trắng/Kem', code: '#F9FAFB', key: 'white', border: true },
  { name: 'Xám', code: '#9CA3AF', key: 'grey' },
  { name: 'Xanh nhạt', code: '#93C5FD', key: 'lightblue' },
  { name: 'Xanh dương', code: '#2563EB', key: 'blue' },
  { name: 'Xanh đậm', code: '#1E3A8A', key: 'navy' },
  { name: 'Xanh ngọc', code: '#059669', key: 'green' },
  { name: 'Olive', code: '#65A30D', key: 'olive' },
  { name: 'Vàng', code: '#EAB308', key: 'yellow' },
  { name: 'Đào', code: '#FDBA74', key: 'peach' },
  { name: 'Cam', code: '#F97316', key: 'orange' },
  { name: 'Đỏ', code: '#EF4444', key: 'red' },
  { name: 'Tím', code: '#7C3AED', key: 'purple' },
  { name: 'Tím nhạt', code: '#C084FC', key: 'lilac' },
];

export default function CatalogPage() {
  const location = useLocation();

  // Parse URL query params
  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialType = urlParams.get('type') || 'all';
  const initialCategory = urlParams.get('category') || '';
  const initialSearch = urlParams.get('search') || '';

  // Filter States
  const [activeTab, setActiveTab] = useState(initialType);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [sortOption, setSortOption] = useState('newest');
  const [aiTryOnOnly, setAiTryOnOnly] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(initialCategory ? [initialCategory] : []);
  const [minPrice, setMinPrice] = useState(100000);
  const [maxPrice, setMaxPrice] = useState(10000000);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Backend Data States
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1, limit: 12 });
  const [filterMeta, setFilterMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Favorites
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('vestora_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load filter metadata from GET /api/products/meta/filters
  useEffect(() => {
    let isMounted = true;
    productService
      .getFilterMeta()
      .then((res) => {
        if (isMounted && res?.data) {
          setFilterMeta(res.data);
        }
      })
      .catch((err) => console.warn('Lỗi nạp metadata bộ lọc:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch products from GET /api/products with params
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = {
        page: currentPage,
        limit: 12,
        sort: sortOption,
      };

      if (activeTab && activeTab !== 'all') params.type = activeTab;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (selectedCategories.length > 0) params.category = selectedCategories.join(',');
      if (selectedSizes.length > 0) params.sizes = selectedSizes.join(',');
      if (selectedColors.length > 0) params.colors = selectedColors.join(',');
      if (selectedConditions.length > 0) params.condition = selectedConditions.join(',');
      if (aiTryOnOnly) params.aiTryOn = true;
      if (minPrice > 100000) params.minPrice = minPrice;
      if (maxPrice < 10000000) params.maxPrice = maxPrice;

      const res = await productService.getProducts(params);
      if (res && res.success && Array.isArray(res.data)) {
        setProducts(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else if (Array.isArray(res)) {
        setProducts(res);
        setPagination({ total: res.length, page: 1, totalPages: 1, limit: 12 });
      } else {
        setProducts([]);
        setPagination({ total: 0, page: 1, totalPages: 1, limit: 12 });
      }
    } catch (err) {
      console.error('Lỗi khi gọi API /api/products:', err);
      setErrorMsg(err.message || 'Không thể kết nối đến máy chủ backend.');
      setProducts([]);
      setPagination({ total: 0, page: 1, totalPages: 1, limit: 12 });
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    activeTab,
    debouncedSearch,
    selectedCategories,
    selectedSizes,
    selectedColors,
    selectedConditions,
    aiTryOnOnly,
    minPrice,
    maxPrice,
    sortOption,
  ]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Toggle favorite
  const toggleFavorite = (e, productId) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const updated = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      try {
        localStorage.setItem('vestora_favorites', JSON.stringify(updated));
      } catch { }
      return updated;
    });
  };

  const toggleCategory = (catName) => {
    setCurrentPage(1);
    setSelectedCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  };

  const toggleSize = (size) => {
    setCurrentPage(1);
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const toggleColor = (colorKey) => {
    setCurrentPage(1);
    setSelectedColors((prev) =>
      prev.includes(colorKey) ? prev.filter((c) => c !== colorKey) : [...prev, colorKey]
    );
  };

  const toggleCondition = (cond) => {
    setCurrentPage(1);
    setSelectedConditions((prev) =>
      prev.includes(cond) ? prev.filter((c) => c !== cond) : [...prev, cond]
    );
  };

  const resetFilters = () => {
    setActiveTab('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedCategories([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setSelectedConditions([]);
    setAiTryOnOnly(false);
    setMinPrice(100000);
    setMaxPrice(10000000);
    setSortOption('newest');
    setCurrentPage(1);
  };

  const formatVND = (amount) => {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  };

  // Categories dynamically loaded from backend
  const categoryItems = useMemo(() => {
    if (filterMeta?.categories && Array.isArray(filterMeta.categories)) {
      return filterMeta.categories
        .filter((c) => c && c.name)
        .map((c) => ({
          _id: c._id,
          name: c.name,
          count: c.count ?? (filterMeta.categoryCounts?.[c.name] ?? 0),
        }));
    }
    return [];
  }, [filterMeta]);

  // Sizes with real counts from backend
  const sizeItems = useMemo(() => {
    if (filterMeta?.sizeCounts && typeof filterMeta.sizeCounts === 'object') {
      return Object.entries(filterMeta.sizeCounts).map(([name, count]) => ({
        name,
        count,
      }));
    }
    return [];
  }, [filterMeta]);

  // Condition items with real counts from backend
  const conditionItems = useMemo(() => {
    if (filterMeta?.conditionCounts && typeof filterMeta.conditionCounts === 'object') {
      const labels = {
        new_99: 'Mới 99%',
        new: 'Mới 100%',
        very_good: 'Rất tốt',
        good: 'Tốt',
      };
      return Object.entries(filterMeta.conditionCounts).map(([key, count]) => ({
        key,
        label: labels[key] || key,
        count,
      }));
    }
    return [];
  }, [filterMeta]);

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedSizes.length > 0 ||
    selectedColors.length > 0 ||
    selectedConditions.length > 0 ||
    aiTryOnOnly ||
    activeTab !== 'all' ||
    debouncedSearch.trim() !== '';

  return (
    <div className="catalog-page-container">
      <Navbar />

      {/* Header Hero Section */}
      <div className="catalog-header-hero">
        <div className="catalog-breadcrumb">
          <Link to="/">TRANG CHỦ</Link>
          <span className="catalog-breadcrumb-separator">/</span>
          <span>BỘ SƯU TẬP</span>
        </div>

        <div className="catalog-header-row">
          <div>
            <h1 className="catalog-title">Thời trang dành riêng cho bạn</h1>
            <p className="catalog-subtitle">
              Khám phá các thiết kế đẹp mắt từ hệ thống cơ sở dữ liệu VESTORA, từ các set đồ cho thuê hiện đại
              đến những món đồ secondhand chất lượng, giúp bạn luôn tự tin và thể hiện phong cách riêng.
            </p>
          </div>
          <div className="catalog-result-count">
            Hiển thị <strong>{pagination.total}</strong> sản phẩm từ máy chủ
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Sort & Tabs */}
      <div className="catalog-controls-container">
        <div className="catalog-search-sort-row">
          <div className="catalog-search-wrapper">
            <i className="fa-solid fa-magnifying-glass catalog-search-icon"></i>
            <input
              type="text"
              className="catalog-search-input"
              placeholder="Tìm kiếm trang phục, thương hiệu, phong cách..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="catalog-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa tìm kiếm"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          <select
            className="catalog-sort-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="newest">Sắp xếp: Mới nhất</option>
            <option value="price_asc">Giá: Thấp đến Cao</option>
            <option value="price_desc">Giá: Cao đến Thấp</option>
            <option value="rating">Được yêu thích nhất</option>
            <option value="popular">Phổ biến nhất</option>
          </select>
        </div>

        {/* Mode Tabs */}
        <div className="catalog-tabs-row">
          <button
            className={`catalog-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('all');
              setCurrentPage(1);
            }}
          >
            Tất cả
          </button>
          <button
            className={`catalog-tab-btn ${activeTab === 'rental' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('rental');
              setCurrentPage(1);
            }}
          >
            Cho thuê
          </button>
          <button
            className={`catalog-tab-btn ${activeTab === 'sale' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('sale');
              setCurrentPage(1);
            }}
          >
            Mua đồ cũ
          </button>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="catalog-active-chips-row">
            {selectedCategories.map((cat) => (
              <span key={cat} className="catalog-chip-pill">
                {cat}
                <button
                  className="catalog-chip-remove"
                  onClick={() => toggleCategory(cat)}
                  aria-label="Xóa danh mục"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </span>
            ))}

            {selectedSizes.map((sz) => (
              <span key={sz} className="catalog-chip-pill">
                Size: {sz}
                <button
                  className="catalog-chip-remove"
                  onClick={() => toggleSize(sz)}
                  aria-label="Xóa kích cỡ"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </span>
            ))}

            {selectedConditions.map((cond) => {
              const label = conditionItems.find((c) => c.key === cond)?.label || cond;
              return (
                <span key={cond} className="catalog-chip-pill">
                  Tình trạng: {label}
                  <button
                    className="catalog-chip-remove"
                    onClick={() => toggleCondition(cond)}
                    aria-label="Xóa tình trạng"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </span>
              );
            })}

            {selectedColors.map((clr) => {
              const clrItem = COLOR_SWATCHES.find((c) => c.key === clr);
              return (
                <span key={clr} className="catalog-chip-pill">
                  Màu: {clrItem?.name || clr}
                  <button
                    className="catalog-chip-remove"
                    onClick={() => toggleColor(clr)}
                    aria-label="Xóa màu"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </span>
              );
            })}

            {aiTryOnOnly && (
              <span
                className="catalog-chip-pill"
                style={{ color: '#6e3eb3', borderColor: '#dfd1ef', background: '#f5f0fb' }}
              >
                <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '4px' }}></i>
                Thử đồ AI
                <button
                  className="catalog-chip-remove"
                  onClick={() => setAiTryOnOnly(false)}
                  aria-label="Tắt thử đồ AI"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </span>
            )}

            {debouncedSearch && (
              <span className="catalog-chip-pill">
                Tìm kiếm: “{debouncedSearch}”
                <button
                  className="catalog-chip-remove"
                  onClick={() => {
                    setSearchQuery('');
                    setDebouncedSearch('');
                  }}
                  aria-label="Xóa từ khóa tìm kiếm"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </span>
            )}

            <button className="catalog-chip-clear-all" onClick={resetFilters}>
              <i className="fa-solid fa-rotate-right"></i>
              Xóa tất cả
            </button>
          </div>
        )}
      </div>

      {/* Main Catalog Content */}
      <div className="catalog-content-layout">
        {/* Left Sidebar Filter Panel */}
        <aside className="catalog-sidebar">
          <div
            className="catalog-sidebar-header"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <span className="catalog-sidebar-title">
              <i className="fa-solid fa-sliders catalog-sidebar-icon"></i>
              Bộ lọc tìm kiếm
            </span>
            <i
              className={`fa-solid fa-chevron-${sidebarCollapsed ? 'down' : 'up'} catalog-collapse-arrow`}
            ></i>
          </div>

          {!sidebarCollapsed && (
            <>
              {/* AI Try-on Toggle */}
              <div className="catalog-ai-box">
                <div>
                  <div className="catalog-ai-title">
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    Hỗ trợ thử đồ AI
                  </div>
                  <div className="catalog-ai-desc">Chỉ hiển thị sản phẩm có thể thử đồ AI</div>
                </div>
                <label className="catalog-switch">
                  <input
                    type="checkbox"
                    checked={aiTryOnOnly}
                    onChange={(e) => setAiTryOnOnly(e.target.checked)}
                  />
                  <span className="catalog-slider"></span>
                </label>
              </div>

              {/* Category Filter from Backend */}
              <div className="catalog-filter-group">
                <div className="catalog-filter-heading">
                  <i className="fa-solid fa-shirt"></i>
                  Danh mục
                </div>
                <div className="catalog-checkbox-list">
                  {categoryItems.map((cat) => (
                    <label key={cat.name} className="catalog-checkbox-label">
                      <div className="catalog-checkbox-left">
                        <input
                          type="checkbox"
                          className="catalog-checkbox-input"
                          checked={selectedCategories.includes(cat.name)}
                          onChange={() => toggleCategory(cat.name)}
                        />
                        <span>{cat.name}</span>
                      </div>
                      <span className="catalog-checkbox-count">{cat.count}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Filter */}
              <div className="catalog-filter-group">
                <div className="catalog-filter-heading">
                  <i className="fa-solid fa-tag"></i>
                  Khoảng giá
                </div>
                <div className="catalog-price-inputs">
                  <select
                    className="catalog-price-select"
                    value={minPrice}
                    onChange={(e) => setMinPrice(Number(e.target.value))}
                  >
                    <option value={100000}>Từ 100.000 đ</option>
                    <option value={200000}>Từ 200.000 đ</option>
                    <option value={500000}>Từ 500.000 đ</option>
                    <option value={1000000}>Từ 1.000.000 đ</option>
                  </select>
                  <select
                    className="catalog-price-select"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                  >
                    <option value={1000000}>Đến 1.000.000 đ</option>
                    <option value={2000000}>Đến 2.000.000 đ</option>
                    <option value={5000000}>Đến 5.000.000 đ</option>
                    <option value={10000000}>Đến 10.000.000 đ</option>
                    <option value={50000000}>Đến 50.000.000 đ</option>
                  </select>
                </div>
                <input
                  type="range"
                  className="catalog-range-slider"
                  min="100000"
                  max="10000000"
                  step="100000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                />
              </div>

              {/* Size Filter */}
              <div className="catalog-filter-group">
                <div className="catalog-filter-heading">
                  <i className="fa-solid fa-ruler-combined"></i>
                  Kích cỡ
                </div>
                <div className="catalog-checkbox-list">
                  {sizeItems.map((sz) => (
                    <label key={sz.name} className="catalog-checkbox-label">
                      <div className="catalog-checkbox-left">
                        <input
                          type="checkbox"
                          className="catalog-checkbox-input"
                          checked={selectedSizes.includes(sz.name)}
                          onChange={() => toggleSize(sz.name)}
                        />
                        <span>{sz.name}</span>
                      </div>
                      <span className="catalog-checkbox-count">{sz.count}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Color Filter */}
              <div className="catalog-filter-group">
                <div className="catalog-filter-heading">
                  <i className="fa-solid fa-palette"></i>
                  Màu sắc
                </div>
                <div className="catalog-color-grid">
                  {COLOR_SWATCHES.map((clr) => {
                    const isSelected = selectedColors.includes(clr.key);
                    return (
                      <div
                        key={clr.key}
                        className={`catalog-color-dot ${isSelected ? 'active' : ''} ${clr.border ? 'border-gray' : ''
                          }`}
                        style={{ backgroundColor: clr.code }}
                        title={clr.name}
                        onClick={() => toggleColor(clr.key)}
                      >
                        {isSelected && (
                          <i
                            className="fa-solid fa-check"
                            style={{
                              color: clr.code === '#F9FAFB' ? '#111827' : '#ffffff',
                              fontSize: '9px',
                            }}
                          ></i>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Condition Filter */}
              <div className="catalog-filter-group">
                <div className="catalog-filter-heading">
                  <i className="fa-solid fa-certificate"></i>
                  Tình trạng (đồ cũ)
                </div>
                <div className="catalog-checkbox-list">
                  {conditionItems.map((cond) => (
                    <label key={cond.key} className="catalog-checkbox-label">
                      <div className="catalog-checkbox-left">
                        <input
                          type="checkbox"
                          className="catalog-checkbox-input"
                          checked={selectedConditions.includes(cond.key)}
                          onChange={() => toggleCondition(cond.key)}
                        />
                        <span>{cond.label}</span>
                      </div>
                      <span className="catalog-checkbox-count">{cond.count}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Promo Card: Thử đồ AI */}
              <div className="catalog-promo-card">
                <div className="catalog-promo-badge">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <span>Thử đồ AI</span>
                </div>
                <p className="catalog-promo-text">
                  Khám phá phiên bản tốt nhất của bạn chỉ với 1 bức ảnh!
                </p>
                <Link to="/try-on-photo" className="catalog-promo-btn">
                  Thử đồ ngay <i className="fa-solid fa-arrow-right"></i>
                </Link>
                <img
                  src="/assets/hero_model.jpg"
                  alt="Thử đồ AI"
                  className="catalog-promo-model"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>

              {/* Reset Filter Button */}
              <button className="catalog-clear-btn" onClick={resetFilters}>
                <i className="fa-solid fa-rotate-right"></i>
                Xóa bộ lọc
              </button>
            </>
          )}
        </aside>

        {/* Right Product Grid */}
        <div className="catalog-products-column">
          {loading ? (
            <div className="catalog-grid-4cols">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="product-card-skeleton">
                  <div className="skeleton-img"></div>
                  <div className="skeleton-text long"></div>
                  <div className="skeleton-text short"></div>
                  <div className="skeleton-text short"></div>
                </div>
              ))}
            </div>
          ) : errorMsg ? (
            <div className="catalog-empty-state">
              <i
                className="fa-solid fa-triangle-exclamation catalog-empty-icon"
                style={{ color: '#dc2626' }}
              ></i>
              <div className="catalog-empty-title">Không thể tải dữ liệu từ máy chủ</div>
              <p className="catalog-empty-desc">{errorMsg}</p>
              <button className="catalog-tab-btn active" onClick={fetchProducts}>
                <i className="fa-solid fa-rotate-right" style={{ marginRight: '6px' }}></i>
                Thử lại
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="catalog-empty-state">
              <i className="fa-solid fa-shirt catalog-empty-icon"></i>
              <div className="catalog-empty-title">Không tìm thấy sản phẩm trong cơ sở dữ liệu</div>
              <p className="catalog-empty-desc">
                Không có sản phẩm nào khớp với tiêu chí lọc hiện tại của bạn.
              </p>
              <button className="catalog-tab-btn active" onClick={resetFilters}>
                Khôi phục bộ lọc
              </button>
            </div>
          ) : (
            <div className="catalog-grid-4cols">
              {products.map((item) => {
                const isRental =
                  item.productType === 'rental' ||
                  item.tag === 'rental' ||
                  (item.rentalPricePer3Days && item.rentalPricePer3Days > 0) ||
                  (item.rentalPricePerDay && item.rentalPricePerDay > 0);

                const priceNumber = isRental
                  ? item.rentalPricePer3Days || (item.rentalPricePerDay ? item.rentalPricePerDay * 3 : 0)
                  : item.salePrice || 0;

                const priceMain = priceNumber > 0 ? formatVND(priceNumber) : 'Liên hệ';
                const priceUnit = isRental && priceNumber > 0 ? '/ 3 ngày' : '';
                const isFavorited = favorites.includes(item._id || item.productCode);
                const mainImage =
                  item.images && item.images.length > 0 && item.images[0]
                    ? item.images[0]
                    : item.image || '';

                const conditionLabels = {
                  new_99: 'Mới 99%',
                  new: 'Mới 100%',
                  very_good: 'Rất tốt',
                  good: 'Tốt',
                };
                const conditionText = item.condition
                  ? conditionLabels[item.condition] || item.condition
                  : null;

                return (
                  <Link
                    key={item._id || item.productCode || item.sku}
                    to={`/product/${item._id || item.productCode || item.sku}`}
                    className="modern-product-card"
                  >
                    <div className="card-media-box">
                      {/* Type Badge */}
                      <span
                        className={`product-type-badge ${isRental ? 'badge-rental' : 'badge-resale'}`}
                      >
                        {isRental ? 'Cho thuê' : 'Mua đồ cũ'}
                      </span>

                      {/* Favorite Button */}
                      <button
                        className={`card-heart-btn ${isFavorited ? 'favorited' : ''}`}
                        onClick={(e) => toggleFavorite(e, item._id || item.productCode)}
                        title={isFavorited ? 'Bỏ thích' : 'Yêu thích'}
                        aria-label="Lưu vào yêu thích"
                      >
                        <i className={isFavorited ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}></i>
                      </button>

                      {/* Product Image */}
                      {mainImage ? (
                        <img
                          src={mainImage}
                          alt={item.name}
                          className="product-card-img"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fallback = e.target.parentElement.querySelector('.product-card-placeholder-box');
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="product-card-placeholder-box"
                        style={{ display: mainImage ? 'none' : 'flex' }}
                      >
                        <i className="fa-solid fa-shirt"></i>
                      </div>
                    </div>

                    <div className="card-info-box">
                      {/* Title */}
                      <h3 className="card-product-name" title={item.name}>
                        {item.name}
                      </h3>

                      {/* Rating & Stock */}
                      <div className="card-meta-line">
                        {item.rating > 0 ? (
                          <>
                            <i className="fa-solid fa-star rating-star"></i>
                            <span className="rating-score">{item.rating}</span>
                            {item.reviewsCount > 0 && <span>({item.reviewsCount})</span>}
                            <span className="meta-separator">•</span>
                          </>
                        ) : null}
                        <span className="stock-indicator">
                          <span
                            className={`stock-dot ${item.inStock === false ? 'out-of-stock' : ''}`}
                          ></span>
                          <span>{item.inStock !== false ? 'Còn hàng' : 'Hết hàng'}</span>
                        </span>
                      </div>

                      {/* Price */}
                      <div className="card-pricing-line">
                        <span className="price-main">{priceMain}</span>
                        {priceUnit && <span className="price-unit">{priceUnit}</span>}
                      </div>

                      {/* Attributes */}
                      <div className="card-attributes-list">
                        {item.sizes && item.sizes.length > 0 ? (
                          <div className="card-attr-row">Size: {item.sizes.join(', ')}</div>
                        ) : item.colors && item.colors.length > 0 ? (
                          <div className="card-attr-row">Màu: {item.colors[0]}</div>
                        ) : null}

                        {item.brand ? (
                          <div className="card-attr-row">Thương hiệu: {item.brand}</div>
                        ) : conditionText ? (
                          <div className="card-attr-row">Tình trạng: {conditionText}</div>
                        ) : null}
                      </div>

                      {/* Action Button */}
                      <span className="card-action-btn">Xem chi tiết</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="catalog-pagination-row">
              <button
                className="catalog-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Trang trước"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>

              {Array.from({ length: pagination.totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    className={`catalog-page-btn ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                className="catalog-page-btn"
                disabled={currentPage >= pagination.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                aria-label="Trang tiếp"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Trust & Value Proposition Footer Bar */}
      <div className="catalog-trust-bar">
        <div className="catalog-trust-item">
          <div className="catalog-trust-icon-box">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <div>
            <h4 className="catalog-trust-title">Sản phẩm được kiểm duyệt</h4>
            <p className="catalog-trust-desc">Đảm bảo chất lượng, nguồn gốc rõ ràng</p>
          </div>
        </div>

        <div className="catalog-trust-item">
          <div className="catalog-trust-icon-box">
            <i className="fa-solid fa-credit-card"></i>
          </div>
          <div>
            <h4 className="catalog-trust-title">Thanh toán an toàn</h4>
            <p className="catalog-trust-desc">Bảo mật thông tin, linh hoạt phương thức</p>
          </div>
        </div>

        <div className="catalog-trust-item">
          <div className="catalog-trust-icon-box">
            <i className="fa-solid fa-headset"></i>
          </div>
          <div>
            <h4 className="catalog-trust-title">Hỗ trợ khách hàng</h4>
            <p className="catalog-trust-desc">Tư vấn 24/7, luôn đồng hành cùng bạn</p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
