import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import productService from '../../services/productService';
import '../../styles/Catalog.css';

// Default mock fallbacks in case backend is offline
const FALLBACK_PRODUCTS = [
  {
    _id: 'VESTORA-DR-089',
    productCode: 'VESTORA-DR-089',
    name: 'Đầm dạ hội ánh tím',
    productType: 'rental',
    tag: 'rental',
    rentalPricePer3Days: 350000,
    rentalPricePerDay: 120000,
    salePrice: 0,
    rating: 4.9,
    reviewsCount: 128,
    inStock: true,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['purple', 'tím'],
    brand: 'Elise',
    condition: 'very_good',
    images: ['/assets/purple_gown.jpg'],
    aiTryOn: true,
  },
  {
    _id: 'VESTORA-BZ-012',
    productCode: 'VESTORA-BZ-012',
    name: 'Blazer thanh lịch',
    productType: 'rental',
    tag: 'rental',
    rentalPricePer3Days: 180000,
    rentalPricePerDay: 60000,
    salePrice: 0,
    rating: 4.8,
    reviewsCount: 96,
    inStock: true,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['beige', 'kem'],
    brand: 'Zara',
    condition: 'very_good',
    images: ['/assets/beige_blazer.jpg'],
    aiTryOn: true,
  },
  {
    _id: 'VESTORA-AD-007',
    productCode: 'VESTORA-AD-007',
    name: 'Áo dài cách tân',
    productType: 'sale',
    tag: 'sale',
    rentalPricePer3Days: 0,
    rentalPricePerDay: 0,
    salePrice: 250000,
    rating: 4.9,
    reviewsCount: 74,
    inStock: true,
    sizes: ['S', 'M', 'L'],
    colors: ['pink', 'hồng'],
    brand: 'Áo Dài Di Sản',
    condition: 'very_good',
    images: ['/assets/ao_dai.jpg'],
    aiTryOn: true,
  },
  {
    _id: 'VESTORA-BG-045',
    productCode: 'VESTORA-BG-045',
    name: 'Túi dự tiệc mini',
    productType: 'sale',
    tag: 'sale',
    rentalPricePer3Days: 0,
    rentalPricePerDay: 0,
    salePrice: 120000,
    rating: 4.7,
    reviewsCount: 52,
    inStock: true,
    sizes: [],
    colors: ['white', 'trắng ngà'],
    brand: 'Handmade Luxury',
    condition: 'new_99',
    images: ['/assets/mini_bag.jpg'],
    aiTryOn: false,
  },
  {
    _id: 'VESTORA-BD-022',
    productCode: 'VESTORA-BD-022',
    name: 'Đầm body đen',
    productType: 'rental',
    tag: 'rental',
    rentalPricePer3Days: 300000,
    rentalPricePerDay: 100000,
    salePrice: 0,
    rating: 4.8,
    reviewsCount: 110,
    inStock: true,
    sizes: ['S', 'M', 'L'],
    colors: ['black', 'đen'],
    brand: 'Trendyol',
    condition: 'very_good',
    images: ['/assets/black_dress.jpg'],
    aiTryOn: true,
  },
  {
    _id: 'VESTORA-JK-061',
    productCode: 'VESTORA-JK-061',
    name: 'Áo khoác denim vintage',
    productType: 'sale',
    tag: 'sale',
    rentalPricePer3Days: 0,
    rentalPricePerDay: 0,
    salePrice: 150000,
    rating: 4.6,
    reviewsCount: 73,
    inStock: true,
    sizes: ['M', 'L'],
    colors: ['blue', 'xanh'],
    brand: "Levi's Vintage",
    condition: 'good',
    images: ['https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80'],
    aiTryOn: true,
  },
  {
    _id: 'VESTORA-TB-088',
    productCode: 'VESTORA-TB-088',
    name: 'Túi xách da thật',
    productType: 'sale',
    tag: 'sale',
    rentalPricePer3Days: 0,
    rentalPricePerDay: 0,
    salePrice: 420000,
    rating: 4.8,
    reviewsCount: 91,
    inStock: true,
    sizes: [],
    colors: ['cream', 'kem', 'beige'],
    brand: 'Charles & Keith',
    condition: 'very_good',
    images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80'],
    aiTryOn: false,
  },
  {
    _id: 'VESTORA-ST-033',
    productCode: 'VESTORA-ST-033',
    name: 'Set vest công sở',
    productType: 'rental',
    tag: 'rental',
    rentalPricePer3Days: 320000,
    rentalPricePerDay: 110000,
    salePrice: 0,
    rating: 4.7,
    reviewsCount: 68,
    inStock: true,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['beige', 'be', 'nâu'],
    brand: 'Mango',
    condition: 'new_99',
    images: ['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80'],
    aiTryOn: true,
  },
];

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
  const navigate = useNavigate();

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
  const [maxPrice, setMaxPrice] = useState(5000000);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Data States
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1, limit: 8 });
  const [filterMeta, setFilterMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('vestora_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load filter metadata once
  useEffect(() => {
    let isMounted = true;
    productService
      .getFilterMeta()
      .then((res) => {
        if (isMounted && res?.data) {
          setFilterMeta(res.data);
        }
      })
      .catch((err) => console.warn('Could not load filter metadata:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch products from real backend
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: 8,
        sort: sortOption,
      };

      if (activeTab && activeTab !== 'all') params.type = activeTab;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (selectedCategories.length > 0) params.category = selectedCategories.join(',');
      if (selectedSizes.length > 0) params.sizes = selectedSizes.join(',');
      if (selectedColors.length > 0) params.colors = selectedColors.join(',');
      if (selectedConditions.length > 0) params.condition = selectedConditions.join(',');
      if (aiTryOnOnly) params.aiTryOn = true;
      if (minPrice > 0) params.minPrice = minPrice;
      if (maxPrice < 10000000) params.maxPrice = maxPrice;

      const res = await productService.getProducts(params);
      if (res && res.success && res.data) {
        setProducts(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        // Fallback
        setProducts(FALLBACK_PRODUCTS);
        setPagination({ total: FALLBACK_PRODUCTS.length, page: 1, totalPages: 1, limit: 8 });
      }
    } catch (err) {
      console.warn('Backend fetch failed, using fallback mock data:', err);
      // Client-side fallback filter
      let filtered = [...FALLBACK_PRODUCTS];
      if (activeTab === 'rental') {
        filtered = filtered.filter((p) => p.productType === 'rental' || p.tag === 'rental');
      } else if (activeTab === 'sale') {
        filtered = filtered.filter((p) => p.productType === 'sale' || p.tag === 'sale');
      }
      if (selectedCategories.length > 0) {
        filtered = filtered.filter((p) =>
          selectedCategories.some((c) => p.category?.includes(c) || p.name.includes(c))
        );
      }
      if (selectedSizes.length > 0) {
        filtered = filtered.filter((p) =>
          selectedSizes.some((s) => p.sizes?.includes(s))
        );
      }
      if (aiTryOnOnly) {
        filtered = filtered.filter((p) => p.aiTryOn);
      }
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        filtered = filtered.filter((p) => p.name.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q));
      }
      setProducts(filtered);
      setPagination({ total: filtered.length, page: 1, totalPages: Math.ceil(filtered.length / 8) || 1, limit: 8 });
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

  // Trigger fetch when any filter changes
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

  // Toggle category
  const toggleCategory = (catName) => {
    setCurrentPage(1);
    setSelectedCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  };

  // Toggle size
  const toggleSize = (size) => {
    setCurrentPage(1);
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  // Toggle color
  const toggleColor = (colorKey) => {
    setCurrentPage(1);
    setSelectedColors((prev) =>
      prev.includes(colorKey) ? prev.filter((c) => c !== colorKey) : [...prev, colorKey]
    );
  };

  // Toggle condition
  const toggleCondition = (cond) => {
    setCurrentPage(1);
    setSelectedConditions((prev) =>
      prev.includes(cond) ? prev.filter((c) => c !== cond) : [...prev, cond]
    );
  };

  // Clear all filters
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
    setMaxPrice(5000000);
    setSortOption('newest');
    setCurrentPage(1);
  };

  // Format VND
  const formatVND = (amount) => {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  };

  // Available categories with count
  const categoryItems = [
    { name: 'Đầm & Váy Dạ Hội', count: filterMeta?.categoryCounts?.['Đầm & Váy Dạ Hội'] ?? 42 },
    { name: 'Áo Blazer & Coat', count: filterMeta?.categoryCounts?.['Áo Blazer & Coat'] ?? 28 },
    { name: 'Vest & Suit', count: filterMeta?.categoryCounts?.['Vest & Suit'] ?? 36 },
    { name: 'Túi Xách', count: filterMeta?.categoryCounts?.['Túi Xách'] ?? 22 },
    { name: 'Áo dài', count: filterMeta?.categoryCounts?.['Áo dài'] ?? 18 },
  ];

  // Sizes with count
  const sizeItems = [
    { name: 'S', count: filterMeta?.sizeCounts?.S ?? 18 },
    { name: 'M', count: filterMeta?.sizeCounts?.M ?? 45 },
    { name: 'L', count: filterMeta?.sizeCounts?.L ?? 36 },
    { name: 'XL', count: filterMeta?.sizeCounts?.XL ?? 20 },
  ];

  // Condition items with count
  const conditionItems = [
    { key: 'new_99', label: 'Mới 99%', count: filterMeta?.conditionCounts?.new_99 ?? 32 },
    { key: 'very_good', label: 'Rất tốt', count: filterMeta?.conditionCounts?.very_good ?? 56 },
    { key: 'good', label: 'Tốt', count: filterMeta?.conditionCounts?.good ?? 18 },
  ];

  // Calculate has active filters
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
          <Link to="/">TRANG CHỦ</Link> <span>/</span> <span>BỘ SƯU TẬP</span>
        </div>

        <div className="catalog-header-row">
          <div>
            <h1 className="catalog-title">Thời trang dành riêng cho bạn</h1>
            <p className="catalog-subtitle">
              Khám phá hàng ngàn thiết kế đẹp mắt, từ các set đồ cho thuê hiện đại đến những món đồ
              secondhand chất lượng, giúp bạn luôn tự tin và thể hiện phong cách riêng.
            </p>
          </div>
          <div className="catalog-result-count">
            Hiển thị <strong>{pagination.total || products.length}</strong> kết quả
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Sort & Tabs */}
      <div className="catalog-controls-container">
        <div className="catalog-search-sort-row">
          <div className="catalog-search-wrapper">
            <span className="catalog-search-icon">🔍</span>
            <input
              type="text"
              className="catalog-search-input"
              placeholder="Tìm kiếm trang phục, thương hiệu, phong cách..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="catalog-search-clear" onClick={() => setSearchQuery('')}>
                ✕
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
                <button className="catalog-chip-remove" onClick={() => toggleCategory(cat)}>
                  ✕
                </button>
              </span>
            ))}

            {selectedSizes.map((sz) => (
              <span key={sz} className="catalog-chip-pill">
                Size: {sz}
                <button className="catalog-chip-remove" onClick={() => toggleSize(sz)}>
                  ✕
                </button>
              </span>
            ))}

            {selectedConditions.map((cond) => {
              const label = conditionItems.find((c) => c.key === cond)?.label || cond;
              return (
                <span key={cond} className="catalog-chip-pill">
                  Tình trạng: {label}
                  <button className="catalog-chip-remove" onClick={() => toggleCondition(cond)}>
                    ✕
                  </button>
                </span>
              );
            })}

            {selectedColors.map((clr) => (
              <span key={clr} className="catalog-chip-pill">
                Màu sắc
                <button className="catalog-chip-remove" onClick={() => toggleColor(clr)}>
                  ✕
                </button>
              </span>
            ))}

            {aiTryOnOnly && (
              <span className="catalog-chip-pill" style={{ color: '#7C3AED', borderColor: '#C4B5FD' }}>
                ✨ Thử đồ AI
                <button className="catalog-chip-remove" onClick={() => setAiTryOnOnly(false)}>
                  ✕
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
                >
                  ✕
                </button>
              </span>
            )}

            <button className="catalog-chip-clear-all" onClick={resetFilters}>
              ⟳ Xóa tất cả
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
            <span className="catalog-sidebar-title">🧰 Bộ lọc tìm kiếm</span>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
              {sidebarCollapsed ? '▼' : '▲'}
            </span>
          </div>

          {!sidebarCollapsed && (
            <>
              {/* AI Try-on Toggle */}
              <div className="catalog-ai-box">
                <div>
                  <div className="catalog-ai-title">✨ Hỗ trợ thử đồ AI</div>
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

              {/* Category Filter */}
              <div className="catalog-filter-group">
                <div className="catalog-filter-heading">👗 Danh mục</div>
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
                <div className="catalog-filter-heading">💰 Khoảng giá</div>
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
                <div className="catalog-filter-heading">📏 Kích cỡ</div>
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
                <div className="catalog-filter-heading">🎨 Màu sắc</div>
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
                          <span
                            style={{
                              color: clr.code === '#F9FAFB' ? '#111' : '#FFF',
                              fontSize: '10px',
                              fontWeight: 700,
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Condition Filter */}
              <div className="catalog-filter-group">
                <div className="catalog-filter-heading">🏷️ Tình trạng (đồ cũ)</div>
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
                  <span>✨ Thử đồ AI</span>
                </div>
                <p className="catalog-promo-text">
                  Khám phá phiên bản tốt nhất của bạn chỉ với 1 bức ảnh!
                </p>
                <Link to="/try-on-photo" className="catalog-promo-btn">
                  Thử đồ ngay →
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
                ⟳ Xóa bộ lọc
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
          ) : products.length === 0 ? (
            <div className="catalog-empty-state">
              <div className="catalog-empty-icon">👗</div>
              <div className="catalog-empty-title">Không tìm thấy sản phẩm phù hợp</div>
              <p className="catalog-empty-desc">
                Hãy thử nới lỏng các tiêu chí lọc hoặc tìm kiếm với từ khóa khác.
              </p>
              <button className="catalog-tab-btn active" onClick={resetFilters}>
                Khôi phục bộ lọc
              </button>
            </div>
          ) : (
            <div className="catalog-grid-4cols">
              {products.map((item) => {
                const isRental =
                  item.productType === 'rental' || item.tag === 'rental' || item.rentalPricePer3Days > 0;
                const priceMain = isRental
                  ? formatVND(item.rentalPricePer3Days || item.rentalPricePerDay * 3 || 350000)
                  : formatVND(item.salePrice || 250000);
                const priceUnit = isRental ? ' / 3 ngày' : '';
                const isFavorited = favorites.includes(item._id || item.productCode);
                const mainImage =
                  item.images && item.images.length > 0
                    ? item.images[0]
                    : '/assets/purple_gown.jpg';

                // Condition display text
                let conditionText = 'Rất tốt';
                if (item.condition === 'new_99') conditionText = 'Mới 99%';
                else if (item.condition === 'good') conditionText = 'Tốt';

                return (
                  <Link
                    key={item._id || item.productCode || item.sku}
                    to={`/product/${item._id || item.productCode || item.sku}`}
                    className="product-card-item"
                  >
                    <div className="product-card-image-box">
                      {/* Type Badge */}
                      <span
                        className={`product-card-type-badge ${isRental ? 'rental' : 'sale'}`}
                      >
                        {isRental ? 'Cho thuê' : 'Mua đồ cũ'}
                      </span>

                      {/* Favorite Button */}
                      <button
                        className={`product-card-fav-btn ${isFavorited ? 'favorited' : ''}`}
                        onClick={(e) => toggleFavorite(e, item._id || item.productCode)}
                        title={isFavorited ? 'Bỏ thích' : 'Yêu thích'}
                      >
                        {isFavorited ? '♥' : '♡'}
                      </button>

                      {/* Product Image */}
                      <img
                        src={mainImage}
                        alt={item.name}
                        className="product-card-img"
                        onError={(e) => {
                          e.target.src = '/assets/purple_gown.jpg';
                        }}
                      />
                    </div>

                    <div className="product-card-body">
                      {/* Title */}
                      <h3 className="product-card-title" title={item.name}>
                        {item.name}
                      </h3>

                      {/* Rating & Stock */}
                      <div className="product-card-rating-row">
                        <span className="product-card-star">★</span>
                        <span style={{ fontWeight: 600, color: '#1F2937' }}>
                          {item.rating || '4.9'}
                        </span>
                        <span>({item.reviewsCount || 128})</span>
                        <span className="product-card-stock-dot">•</span>
                        <span className="product-card-stock-text">
                          {item.inStock !== false ? 'Còn hàng' : 'Hết hàng'}
                        </span>
                      </div>

                      {/* Price */}
                      <div className="product-card-price-row">
                        <span className="product-card-price-main">{priceMain}</span>
                        {priceUnit && (
                          <span className="product-card-price-unit">{priceUnit}</span>
                        )}
                      </div>

                      {/* Attributes */}
                      <div className="product-card-attributes">
                        {item.sizes && item.sizes.length > 0 ? (
                          <div className="product-card-attr-item">
                            Size: {item.sizes.join(', ')}
                          </div>
                        ) : item.colors && item.colors.length > 0 ? (
                          <div className="product-card-attr-item">
                            Màu: {item.colors[0]}
                          </div>
                        ) : null}

                        {item.brand && item.brand !== 'Không' ? (
                          <div className="product-card-attr-item">
                            Thương hiệu: {item.brand}
                          </div>
                        ) : (
                          <div className="product-card-attr-item">
                            Tình trạng: {conditionText}
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <button className="product-card-action-btn">
                        Xem chi tiết
                      </button>
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
              >
                ‹
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
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Trust & Value Proposition Footer Bar */}
      <div className="catalog-trust-bar">
        <div className="catalog-trust-item">
          <div className="catalog-trust-icon-box">🛡️</div>
          <div>
            <h4 className="catalog-trust-title">Sản phẩm được kiểm duyệt</h4>
            <p className="catalog-trust-desc">Đảm bảo chất lượng, nguồn gốc rõ ràng</p>
          </div>
        </div>

        <div className="catalog-trust-item">
          <div className="catalog-trust-icon-box">💳</div>
          <div>
            <h4 className="catalog-trust-title">Thanh toán an toàn</h4>
            <p className="catalog-trust-desc">Bảo mật thông tin, linh hoạt phương thức</p>
          </div>
        </div>

        <div className="catalog-trust-item">
          <div className="catalog-trust-icon-box">🎧</div>
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
