import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, X, Sparkles, Download } from 'lucide-react';
import '../../styles/PhotoTryOn.css';
import tryOnApi from '../../services/tryOnApi';
import productService from '../../services/productService';
import wardrobeApi from '../../services/wardrobeApi';

const DEFAULT_MODEL_IMAGE =
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';

const PRODUCT_CATEGORY_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'dresses', label: 'Đầm / Váy dài' },
  { id: 'upper_body', label: 'Áo / Vest' },
  { id: 'lower_body', label: 'Quần / Chân váy' },
  { id: 'accessories', label: 'Phụ kiện' },
];

const DEFAULT_PRODUCT = {
  _id: 'sample-001',
  productCode: 'VESTORA-DR-089',
  name: 'Đầm Dạ Hội Lụa Satin Midnight Noir',
  brand: 'Thanh Lịch Boutique',
  rentalPricePerDay: 350000,
  rentalPricePer3Days: 1050000,
  salePrice: 3200000,
  category: ['Đầm dạ hội', 'Thời trang nữ'],
  image:
    'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80',
};

export default function PhotoTryOnPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef(null);

  const productParam = searchParams.get('product') || searchParams.get('productId');

  // Product state
  const [product, setProduct] = useState(DEFAULT_PRODUCT);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [productCategoryTab, setProductCategoryTab] = useState('all');

  // Bottom garment for 2-piece outfit combo (Áo + Chân váy / Quần)
  const [bottomProduct, setBottomProduct] = useState(null);
  const [bottomSelectedSize, setBottomSelectedSize] = useState('S');

  // Model, User Photo & Consent state
  const [userUploadedFile, setUserUploadedFile] = useState(null);
  const [activeModelImage, setActiveModelImage] = useState(DEFAULT_MODEL_IMAGE);
  const [hasPhotoConsent, setHasPhotoConsent] = useState(false);

  // Options & Try-On State
  const [selectedSize, setSelectedSize] = useState('S');
  const [category, setCategory] = useState('dresses');
  const [autoCrop, setAutoCrop] = useState(true);

  // Generation & Results
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [resultImage, setResultImage] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSavingWardrobe, setIsSavingWardrobe] = useState(false);
  const [lastSavedImageUrl, setLastSavedImageUrl] = useState('');

  // Auto-dismiss notification
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // 1. Fetch catalog products to allow switching products inside the try-on room
  useEffect(() => {
    setCatalogLoading(true);
    productService
      .getProducts({ page: 1, limit: 50 })
      .then((res) => {
        let list = [];
        if (res && res.success && Array.isArray(res.data)) {
          list = res.data;
        } else if (Array.isArray(res?.data)) {
          list = res.data;
        } else if (Array.isArray(res)) {
          list = res;
        }
        setCatalogProducts(list);
      })
      .catch((err) => {
        console.warn('Không thể tải danh sách sản phẩm phòng thử đồ:', err.message);
      })
      .finally(() => {
        setCatalogLoading(false);
      });
  }, []);

  // 2. Fetch product info if productParam is provided
  useEffect(() => {
    if (!productParam) return;
    if (product?._id === productParam && product._id !== 'sample-001') return;

    productService
      .getProductById(productParam)
      .then((res) => {
        const prodData = res?.data || res;
        if (prodData && prodData.name) {
          setProduct(prodData);

          // Auto-detect category (bao gồm phụ kiện, đầm, áo, quần)
          const catStr = (
            `${prodData.name} ` + (Array.isArray(prodData.category) ? prodData.category.join(' ') : '')
          ).toLowerCase();

          if (/túi|tui|bag|kính|kinh|glasses|khuyên|vòng|khăn|khan|giày|giay|shoes|phụ kiện|nón|mũ|hat|clutch/.test(catStr)) {
            setCategory('accessories');
          } else if (/đầm|dam|váy|vay|áo dài|ao dai|dress|gown|jumpsuit|set|bộ|bo|suit|outfit/.test(catStr)) {
            setCategory('dresses');
          } else if (/quần|quan|chân váy|skirt|pants|trouser/.test(catStr)) {
            setCategory('lower_body');
          } else {
            setCategory('upper_body');
          }

          if (Array.isArray(prodData.sizes) && prodData.sizes.length > 0) {
            setSelectedSize(prodData.sizes[0]);
          } else {
            setSelectedSize('Freesize');
          }
        }
      })
      .catch((err) => {
        console.warn('Không thể tải chi tiết sản phẩm:', err.message);
      });
  }, [productParam]);

  // Handle local user photo selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Vui lòng chọn đúng tệp hình ảnh (JPG, PNG, WEBP)');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('Dung lượng ảnh vượt quá 25MB. Vui lòng chọn ảnh nhẹ hơn.');
      return;
    }

    setErrorMessage('');
    setUserUploadedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setActiveModelImage(objectUrl);
    setResultImage(null); // Reset previous result
  };

  // Reset user uploaded photo back to default
  const handleResetUserPhoto = () => {
    setUserUploadedFile(null);
    setActiveModelImage(DEFAULT_MODEL_IMAGE);
    setResultImage(null);
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Switch product from in-room category list
  const handleSelectProduct = (selectedProd) => {
    if (!selectedProd) return;
    setProduct(selectedProd);
    setResultImage(null);
    setErrorMessage('');

    // Auto-detect category
    const catStr = (
      `${selectedProd.name || ''} ` +
      (Array.isArray(selectedProd.category) ? selectedProd.category.join(' ') : (selectedProd.category || ''))
    ).toLowerCase();

    if (/túi|tui|bag|kính|kinh|glasses|khuyên|vòng|khăn|khan|giày|giay|shoes|phụ kiện|nón|mũ|hat|clutch/.test(catStr)) {
      setCategory('accessories');
    } else if (/đầm|dam|váy|vay|áo dài|ao dai|dress|gown|jumpsuit|set|bộ|bo|suit|outfit/.test(catStr)) {
      setCategory('dresses');
    } else if (/quần|quan|chân váy|skirt|pants|trouser|short/.test(catStr)) {
      setCategory('lower_body');
    } else {
      setCategory('upper_body');
    }

    // Auto-select size
    const pSizes = (Array.isArray(selectedProd.sizes) && selectedProd.sizes.length > 0)
      ? selectedProd.sizes
      : (Array.isArray(selectedProd.availableSizes) && selectedProd.availableSizes.length > 0)
        ? selectedProd.availableSizes
        : (/túi|kính|nón|mũ|khăn|vòng|phụ kiện/.test(catStr) ? ['Freesize', 'Tiêu chuẩn'] : ['S', 'M', 'L']);
    setSelectedSize(pSizes[0] || 'S');

    // Update query params in-place on current route (does not navigate away)
    if (selectedProd._id) {
      setSearchParams({ productId: selectedProd._id }, { replace: true });
    }
  };

  // Filter products by selected category tab
  const displayedCatalogProducts = catalogProducts.filter((item) => {
    if (productCategoryTab === 'all') return true;
    const catStr = (
      `${item.name || ''} ` +
      (Array.isArray(item.category) ? item.category.join(' ') : (item.category || ''))
    ).toLowerCase();

    if (productCategoryTab === 'dresses') {
      return /đầm|dam|váy|vay|áo dài|ao dai|dress|gown|jumpsuit|set|bộ|bo|suit|outfit/.test(catStr);
    }
    if (productCategoryTab === 'upper_body') {
      return /áo|ao|vest|blazer|shirt|jacket|coat|hoodie|sweater/.test(catStr) && !/áo dài|ao dai/.test(catStr);
    }
    if (productCategoryTab === 'lower_body') {
      return /quần|quan|chân váy|skirt|pants|trouser|short/.test(catStr);
    }
    if (productCategoryTab === 'accessories') {
      return /túi|tui|bag|kính|kinh|glasses|khuyên|vòng|khăn|khan|giày|giay|shoes|phụ kiện/.test(catStr);
    }
    return true;
  });

  // Skirts & Pants catalog for pairing when upper_body top is chosen
  const bottomCatalogProducts = catalogProducts.filter((item) => {
    const catStr = (
      `${item.name || ''} ` +
      (Array.isArray(item.category) ? item.category.join(' ') : (item.category || ''))
    ).toLowerCase();
    return /quần|quan|chân váy|skirt|pants|trouser|short/.test(catStr);
  });

  // Trigger AI IDM-VTON Try-On
  const handleGenerateTryOn = async () => {
    if (!hasPhotoConsent) {
      setErrorMessage('Vui lòng tích chọn đồng ý cho phép ứng dụng sử dụng hình ảnh trước khi ghép đồ AI!');
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    setIsGenerating(true);
    setGenerationStep(
      bottomProduct
        ? 'Đang chuẩn bị ghép set cả bộ 2 bước: Áo + Chân váy/Quần...'
        : 'Đang chuẩn hoá tỷ lệ người mẫu và nhận diện trang phục...'
    );

    const stepTimer1 = setTimeout(() => {
      setGenerationStep(
        bottomProduct
          ? 'Bước 1: AI IDM-VTON đang ghép phom áo thân trên...'
          : 'AI IDM-VTON đang tính toán nếp gấp và độ rủ vải...'
      );
    }, 4500);

    const stepTimer2 = setTimeout(() => {
      setGenerationStep(
        bottomProduct
          ? 'Bước 2: Đang ghép tiếp chân váy/quần vào tổng thể trang phục...'
          : 'Đang kết xuất ánh sáng và hoàn thiện phom dáng...'
      );
    }, 12000);

    try {
      const formData = new FormData();

      if (userUploadedFile) {
        formData.append('photo', userUploadedFile);
      } else {
        formData.append('humanImageUrl', activeModelImage);
      }

      if (product?._id && product._id !== 'sample-001') {
        formData.append('productId', product._id);
      }

      const garmentImg =
        product?.image ||
        (Array.isArray(product?.images) && product.images[0]) ||
        DEFAULT_PRODUCT.image;

      formData.append('garmentImageUrl', garmentImg);
      formData.append('garmentDescription', product?.name || 'luxury clothing');
      formData.append('category', category);
      formData.append('crop', String(autoCrop));

      // Append paired bottom garment if user selects outfit combo
      if (category === 'upper_body' && bottomProduct) {
        const bottomImg =
          bottomProduct.image ||
          (Array.isArray(bottomProduct.images) && bottomProduct.images[0]);
        if (bottomImg) {
          formData.append('bottomGarmentImageUrl', bottomImg);
          formData.append('bottomGarmentDescription', bottomProduct.name || 'chân váy thời trang');
        }
        if (bottomProduct._id) {
          formData.append('bottomProductId', bottomProduct._id);
        }
      }

      const response = await tryOnApi.generate(formData);

      if (response?.data?.resultImageUrl || response?.resultImageUrl) {
        const finalUrl = response.data?.resultImageUrl || response.resultImageUrl;
        setResultImage(finalUrl);
        setLastSavedImageUrl(''); // Reset trạng thái lưu khi có ảnh ghép mới
        setShowOriginal(false);
        setSuccessMessage(
          bottomProduct
            ? 'Ghép thành công nguyên set cả bộ (Áo + Chân váy/Quần)!'
            : 'Ghép trang phục AI thành công!'
        );
      } else {
        throw new Error(response?.message || 'Mô hình không trả về ảnh kết quả');
      }
    } catch (err) {
      console.error('Lỗi ghép đồ AI:', err);
      setErrorMessage(
        err.message || 'Có lỗi trong quá trình xử lý ghép đồ AI, vui lòng thử lại sau.'
      );
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  // Lưu ảnh vừa thử kèm thông tin & link sản phẩm vào Tủ Đồ cá nhân
  const handleSaveToWardrobe = async () => {
    if (!resultImage) {
      alert('Vui lòng bấm "BẮT ĐẦU GHÉP ĐỒ AI" để tạo ảnh thử trước khi lưu vào tủ đồ!');
      return;
    }

    if (lastSavedImageUrl === resultImage) {
      setSuccessMessage('Trang phục và ảnh thử này đã được lưu trong Tủ Đồ của bạn rồi!');
      return;
    }

    setIsSavingWardrobe(true);
    try {
      const payload = {
        productId: product?._id && product._id !== 'sample-001' ? product._id : null,
        productCode: product?.productCode || '',
        title: bottomProduct
          ? `Set cả bộ: ${product?.name} + ${bottomProduct?.name}`
          : (product?.name || 'Trang phục thử đồ AI'),
        image: garmentImageUrl,
        tryOnImageUrl: resultImage,
        category: bottomProduct
          ? 'Set cả bộ (Áo + Váy/Quần)'
          : (Array.isArray(product?.category) ? product.category[0] : product?.category) ||
            'Thời trang cao cấp',
        price: (product?.rentalPricePerDay || 350000) + (bottomProduct?.rentalPricePerDay || 0),
        priceUnit: '/ ngày',
        selectedSize: bottomProduct ? `Áo: ${selectedSize} • Váy: ${bottomSelectedSize}` : selectedSize,
        aiNote: bottomProduct
          ? `Set cả bộ (Áo ${selectedSize} + Váy/Quần ${bottomSelectedSize}) ghép bằng công nghệ AI 2 bước IDM-VTON.`
          : `Đã thử bằng AI IDM-VTON cho vóc dáng Size ${selectedSize}. Trang phục vừa vặn và giữ phom dáng chuẩn.`,
        tags: bottomProduct ? ['tryon-history', 'ai-combo', 'set-outfit'] : ['tryon-history', 'ai-suggested'],
      };

      const res = await wardrobeApi.addToWardrobe(payload);
      setLastSavedImageUrl(resultImage);
      setSuccessMessage(res?.message || 'Đã lưu ảnh vừa thử và liên kết sản phẩm vào Tủ Đồ Cá Nhân thành công!');
    } catch (err) {
      console.error('Lỗi lưu vào tủ đồ:', err);
      alert('Có lỗi khi lưu vào tủ đồ: ' + (err.message || 'Vui lòng thử lại sau'));
    } finally {
      setIsSavingWardrobe(false);
    }
  };

  const garmentImageUrl =
    product?.image ||
    (Array.isArray(product?.images) && product.images[0]) ||
    DEFAULT_PRODUCT.image;

  const currentDisplayImage = showOriginal ? activeModelImage : resultImage || activeModelImage;

  return (
    <div className="tryon-room-container">
      {/* Toast Notification */}
      {successMessage && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 99999,
            background: '#ffffff',
            color: '#1f2421',
            border: '1.5px solid var(--color-gold, #5b6e4e)',
            borderRadius: 12,
            padding: '12px 20px',
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 10px 30px rgba(31, 36, 33, 0.12)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <CheckCircle2 size={18} color="var(--color-gold, #5b6e4e)" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="tryon-header-bar">
        <Link
          to="/"
          style={{
            color: '#6e7569',
            textDecoration: 'none',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontWeight: 500,
          }}
        >
          &larr; Rời phòng thử AI
        </Link>
        <Link
          to="/"
          style={{
            fontFamily: 'var(--font-title, sans-serif)',
            fontSize: '18px',
            letterSpacing: '2.5px',
            color: 'var(--color-text-primary, #1f2421)',
            textDecoration: 'none',
            fontWeight: 800,
          }}
        >
          VESTORA
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 600 }}>
          <span>BẢO MẬT SINH TRẮC HỌC</span>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#4a5246',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Đóng phòng thử"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Top Status Bar */}
      <div className="tryon-top-status">
        <button
          onClick={() => {
            if (product?._id && product._id !== 'sample-001') {
              navigate(`/product/${product._id}`);
            } else {
              navigate('/catalog');
            }
          }}
          className="tryon-back-btn"
        >
          &larr; Quay lại sản phẩm
        </button>

        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-gold, #5b6e4e)', letterSpacing: '0.6px' }}>
          PHÒNG THỬ ĐỒ ẢO AI — CÔNG NGHỆ IDM-VTON
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              background: 'rgba(91, 110, 78, 0.12)',
              color: 'var(--color-gold, #5b6e4e)',
              padding: '2px 8px',
              borderRadius: '99px',
              fontWeight: 700,
              fontSize: '10px',
            }}
          >
            VIRTUAL TRY-ON
          </span>
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div
          style={{
            background: '#FEE2E2',
            border: '1px solid #F87171',
            color: '#B91C1C',
            padding: '8px 20px',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage('')}
            style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: 3 Panels */}
      <div className="tryon-grid-main">
        {/* LEFT PANEL: Step 1 Upload Model */}
        <div className="panel-dark-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--color-gold, #5b6e4e)' }}>
              BƯỚC 1
            </span>
            <span
              style={{
                fontSize: '10px',
                background: userUploadedFile ? '#eaf2e6' : '#eff2eb',
                color: userUploadedFile ? '#5b6e4e' : '#4a5246',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              {userUploadedFile ? 'Ảnh của bạn' : 'Mẫu chuẩn'}
            </span>
          </div>

          <h2 style={{ fontFamily: 'var(--font-title, sans-serif)', fontSize: '14px', fontWeight: 700, margin: 0, color: '#1f2421' }}>
            1. Ảnh Người Thử / Cá Nhân
          </h2>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
          />

          <div
            className={`dropzone-box ${userUploadedFile ? 'has-file' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '2px', color: '#1f2421' }}>
              {userUploadedFile ? 'Đã tải ảnh cá nhân thành công' : 'Bấm để tải ảnh toàn thân của bạn'}
            </div>
            <div style={{ fontSize: '10px', color: '#6e7569', marginBottom: '8px' }}>
              {userUploadedFile
                ? `${userUploadedFile.name} (${(userUploadedFile.size / 1024 / 1024).toFixed(1)}MB)`
                : 'Hỗ trợ ảnh JPG, PNG chụp rõ toàn thân, phông trơn'}
            </div>
            <button
              type="button"
              className="btn-secondary"
              style={{ height: '28px', padding: '0 12px', fontSize: '10px', pointerEvents: 'none' }}
            >
              {userUploadedFile ? 'Chọn ảnh khác' : 'Tải ảnh toàn thân'}
            </button>
          </div>

          {/* Active model card */}
          <div
            style={{
              background: '#f4f6f1',
              borderRadius: '8px',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid var(--color-border, #e2e6dc)',
            }}
          >
            <img
              src={activeModelImage}
              alt="Model"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1.5px solid var(--color-gold, #5b6e4e)',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1f2421', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userUploadedFile ? 'Ảnh cá nhân của bạn' : 'Ảnh người mẫu mặc định'}
              </div>
              <div style={{ fontSize: '10px', color: userUploadedFile ? '#5b6e4e' : '#6e7569', marginTop: '1px', fontWeight: 500 }}>
                {userUploadedFile ? '✓ Đã sẵn sàng thử đồ' : 'Chưa tải ảnh — Dùng mẫu'}
              </div>
            </div>
            {userUploadedFile && (
              <button
                type="button"
                onClick={handleResetUserPhoto}
                style={{
                  height: '24px',
                  padding: '0 8px',
                  background: '#FEE2E2',
                  border: '1px solid #FCA5A5',
                  color: '#DC2626',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
                title="Huỷ ảnh cá nhân"
              >
                Huỷ
              </button>
            )}
          </div>

          {/* Quy chuẩn chụp ảnh */}
          <div
            style={{
              fontSize: '10px',
              color: '#4a5246',
              lineHeight: 1.45,
              background: '#f4f6f1',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e2e6dc)',
            }}
          >
            <strong style={{ color: '#1f2421', display: 'block', marginBottom: '2px' }}>
              Mẹo chụp ảnh đẹp nhất:
            </strong>
            • Đứng thẳng người, tay không che ngực hay eo.<br />
            • Nền tường trơn, không có vật cản phía sau.<br />
            • Đảm bảo đủ ánh sáng tự nhiên rõ nét.
          </div>
        </div>

        {/* CENTER PANEL: Real-time 3D AR Stage - Dual Split View */}
        <div className="stage-viewport-card">
          <div className="stage-split-container">
            {/* Left Split Pane: Original Photo */}
            <div className="stage-split-pane">
              <div className="tryon-compare-badge badge-before">
                {userUploadedFile ? 'ẢNH BẠN TẢI LÊN' : 'ẢNH MẪU GỐC'}
              </div>
              <img
                src={activeModelImage}
                alt="Original Model"
                className="stage-split-image"
              />
            </div>

            {/* Right Split Pane: AI Try-On Result or Pending State */}
            <div className="stage-split-pane">
              {/* Scanning Overlay when AI is generating */}
              {isGenerating && (
                <div className="tryon-scan-overlay">
                  <div className="tryon-scan-line" />
                  <div className="tryon-status-overlay">
                    <div className="tryon-spinner" />
                    <span>{generationStep || 'AI IDM-VTON đang xử lý trang phục...'}</span>
                  </div>
                </div>
              )}

              {resultImage ? (
                <>
                  <div className="tryon-compare-badge badge-after">
                    AI TRY-ON (KẾT QUẢ)
                  </div>
                  <img
                    src={resultImage}
                    alt="AI Try-On Result"
                    className="stage-split-image"
                  />
                </>
              ) : (
                <div className="stage-placeholder-pane">
                  <Sparkles size={26} color="var(--color-gold, #5b6e4e)" style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1f2421', marginBottom: '3px' }}>
                    KẾT QUẢ THỬ ĐỒ AI
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#6e7569', maxWidth: '190px', lineHeight: 1.4 }}>
                    Bấm <strong>"BẮT ĐẦU GHÉP ĐỒ AI"</strong> để xem trang phục kết xuất lên cơ thể
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Measurements & Download Control bar */}
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '12px',
              right: '12px',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--color-border, #e2e6dc)',
              borderRadius: '9999px',
              padding: '5px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              color: '#1f2421',
              boxShadow: '0 2px 8px rgba(31, 36, 33, 0.08)',
              zIndex: 15,
            }}
          >
            <div>
              <span>Kích cỡ: <strong>Size {selectedSize}</strong></span>
              {bottomProduct && (
                <> &bull; <span>Chân váy: <strong>Size {bottomSelectedSize}</strong></span></>
              )} &bull;{' '}
              <span>Phân loại: <strong>{bottomProduct ? 'SET CẢ BỘ (ÁO + VÁY)' : category.toUpperCase()}</strong></span>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {resultImage && (
                <a
                  href={resultImage}
                  target="_blank"
                  rel="noreferrer"
                  download="vestora-ai-tryon.png"
                  className="btn-secondary"
                  style={{
                    height: '24px',
                    fontSize: '10px',
                    padding: '0 8px',
                    textDecoration: 'none',
                    color: '#1f2421',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Download size={11} />
                  <span>Tải ảnh</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Step 2 Item Selection & Adjustments */}
        <div className="panel-dark-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--color-gold, #5b6e4e)' }}>
              BƯỚC 2
            </span>
            <span
              style={{
                fontSize: '10px',
                background: '#eaf2e6',
                color: 'var(--color-gold, #5b6e4e)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 700,
              }}
            >
              CHỌN & THỬ ĐỒ
            </span>
          </div>

          <h2 style={{ fontFamily: 'var(--font-title, sans-serif)', fontSize: '14px', fontWeight: 700, margin: 0, color: '#1f2421' }}>
            2. Trang Phục Đang Thử
          </h2>

          {/* Product Category Filter Tabs & Carousel */}
          <div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                marginBottom: '4px',
                color: '#4a5246',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>DANH MỤC TRANG PHỤC</span>
              <span style={{ fontSize: '10px', color: '#6e7569', fontWeight: 500 }}>
                {displayedCatalogProducts.length} sản phẩm
              </span>
            </div>

            {/* Category Tabs */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                overflowX: 'auto',
                paddingBottom: '2px',
                scrollbarWidth: 'none',
              }}
            >
              {PRODUCT_CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`category-pill-btn ${productCategoryTab === tab.id ? 'active' : ''}`}
                  onClick={() => setProductCategoryTab(tab.id)}
                  style={{ height: '26px', padding: '0 8px', fontSize: '10px', borderRadius: '5px' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Horizontal Mini Product Carousel */}
            <div
              className="tryon-products-carousel"
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                padding: '4px 1px',
                marginTop: '2px',
              }}
            >
              {catalogLoading ? (
                <div style={{ fontSize: '10px', color: '#6e7569', padding: '6px 0' }}>
                  Đang tải danh sách...
                </div>
              ) : displayedCatalogProducts.length === 0 ? (
                <div style={{ fontSize: '10px', color: '#6e7569', padding: '6px 0' }}>
                  Không có sản phẩm trong danh mục này.
                </div>
              ) : (
                displayedCatalogProducts.map((p) => {
                  const isSelected = p._id === product?._id;
                  const pImg = p.image || (Array.isArray(p.images) && p.images[0]) || DEFAULT_PRODUCT.image;
                  return (
                    <div
                      key={p._id || p.name}
                      onClick={() => handleSelectProduct(p)}
                      style={{
                        flex: '0 0 74px',
                        cursor: 'pointer',
                        background: isSelected ? '#f2f6ee' : '#ffffff',
                        border: isSelected ? '1.5px solid var(--color-gold, #5b6e4e)' : '1px solid var(--color-border, #e2e6dc)',
                        borderRadius: '7px',
                        padding: '3px',
                        transition: 'all 0.2s ease',
                        textAlign: 'center',
                        boxShadow: isSelected ? '0 2px 6px rgba(91, 110, 78, 0.15)' : 'none',
                      }}
                    >
                      <img
                        src={pImg}
                        alt={p.name}
                        style={{
                          width: '100%',
                          height: '52px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          marginBottom: '2px',
                        }}
                      />
                      <div
                        style={{
                          fontSize: '9.5px',
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? 'var(--color-gold, #5b6e4e)' : '#1f2421',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={p.name}
                      >
                        {p.name}
                      </div>
                      <div style={{ fontSize: '9px', color: '#6e7569', fontWeight: 600 }}>
                        {(p.rentalPricePerDay || 300000).toLocaleString('vi-VN')} đ
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Item Card */}
          <div
            style={{
              background: '#f4f6f1',
              borderRadius: '8px',
              padding: '6px 8px',
              border: '1px solid var(--color-border, #e2e6dc)',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <img
              src={garmentImageUrl}
              alt={product?.name}
              style={{
                width: '42px',
                height: '54px',
                borderRadius: '5px',
                objectFit: 'cover',
                border: '1px solid var(--color-border, #e2e6dc)',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '9px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 700, textTransform: 'uppercase' }}>
                {product?.brand || 'Vestora Atelier'}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  margin: '1px 0',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: '#1f2421',
                }}
              >
                {product?.name || 'Trang phục cao cấp'}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-gold, #5b6e4e)' }}>
                {(product?.rentalPricePerDay || 350000).toLocaleString('vi-VN')} đ{' '}
                <small style={{ fontWeight: 400, fontSize: '9px', color: '#6e7569' }}>/ ngày</small>
              </div>
            </div>
          </div>

          {/* Category Picker (Đầm, Áo, Quần, Phụ kiện) */}
          <div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                marginBottom: '3px',
                color: '#4a5246',
              }}
            >
              LOẠI TRANG PHỤC (AI CLASSIFICATION)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
              {[
                { id: 'dresses', label: 'Đầm / Cả bộ' },
                { id: 'upper_body', label: 'Áo / Thân trên' },
                { id: 'lower_body', label: 'Quần / Chân váy' },
                { id: 'accessories', label: 'Phụ kiện (Túi, Kính)' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`category-pill-btn ${category === c.id ? 'active' : ''}`}
                  onClick={() => setCategory(c.id)}
                  style={{
                    height: '26px',
                    fontSize: '10px',
                    padding: '0 4px',
                    borderRadius: '5px',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size picker */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '10px',
                marginBottom: '3px',
                color: '#4a5246',
              }}
            >
              <span style={{ fontWeight: 700, letterSpacing: '0.5px' }}>
                {category === 'upper_body' ? 'CHỌN KÍCH CỠ ÁO' : 'CHỌN KÍCH CỠ'}
              </span>
              <span style={{ color: 'var(--color-gold, #5b6e4e)', fontSize: '10px', fontWeight: 600 }}>
                Size: <strong>{selectedSize}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {((Array.isArray(product?.sizes) && product.sizes.length > 0)
                ? product.sizes
                : (Array.isArray(product?.availableSizes) && product.availableSizes.length > 0)
                  ? product.availableSizes
                  : (category === 'accessories' ? ['Freesize', 'Tiêu chuẩn'] : ['XS', 'S', 'M', 'L', 'XL'])
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`size-btn ${selectedSize === s ? 'active' : ''}`}
                  style={{
                    height: '26px',
                    minWidth: '34px',
                    padding: '0 6px',
                    fontSize: '10.5px',
                    background: selectedSize === s ? 'var(--color-gold, #5b6e4e)' : '#f4f6f1',
                    color: selectedSize === s ? '#ffffff' : '#1f2421',
                    border: selectedSize === s ? '1px solid var(--color-gold, #5b6e4e)' : '1px solid var(--color-border, #e2e6dc)',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: selectedSize === s ? 700 : 500,
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setSelectedSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Outfit Combo Pairing: When Top (upper_body) is selected, allow picking Bottom (chân váy / quần) */}
          {category === 'upper_body' && (
            <div
              className="outfit-combo-box"
              style={{
                background: '#f8faf6',
                border: '1.5px dashed var(--color-gold, #5b6e4e)',
                borderRadius: '8px',
                padding: '7px 8px',
                marginTop: '1px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-gold, #5b6e4e)', letterSpacing: '0.4px' }}>
                  👗 PHỐI CẢ BỘ VỚI CHÂN VÁY / QUẦN
                </div>
                {bottomProduct && (
                  <button
                    type="button"
                    onClick={() => setBottomProduct(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#b91c1c',
                      fontSize: '9.5px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    ✕ Bỏ phối
                  </button>
                )}
              </div>

              {bottomProduct ? (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '7px',
                      alignItems: 'center',
                      background: '#ffffff',
                      border: '1px solid var(--color-border, #e2e6dc)',
                      borderRadius: '6px',
                      padding: '5px 7px',
                    }}
                  >
                    <img
                      src={
                        bottomProduct.image ||
                        (Array.isArray(bottomProduct.images) && bottomProduct.images[0]) ||
                        DEFAULT_PRODUCT.image
                      }
                      alt={bottomProduct.name}
                      style={{
                        width: '36px',
                        height: '46px',
                        borderRadius: '4px',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          color: '#1f2421',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {bottomProduct.name}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 600 }}>
                        +{(bottomProduct.rentalPricePerDay || 200000).toLocaleString('vi-VN')} đ/ngày
                      </div>
                      {/* Bottom Size Picker */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                        <span style={{ fontSize: '9px', color: '#6e7569', fontWeight: 600 }}>Size váy:</span>
                        {['XS', 'S', 'M', 'L'].map((bsz) => (
                          <button
                            key={bsz}
                            type="button"
                            onClick={() => setBottomSelectedSize(bsz)}
                            style={{
                              padding: '1px 5px',
                              fontSize: '9px',
                              borderRadius: '3px',
                              border: bottomSelectedSize === bsz ? '1px solid var(--color-gold, #5b6e4e)' : '1px solid #dce1d5',
                              background: bottomSelectedSize === bsz ? 'var(--color-gold, #5b6e4e)' : '#f4f6f1',
                              color: bottomSelectedSize === bsz ? '#fff' : '#1f2421',
                              cursor: 'pointer',
                              fontWeight: bottomSelectedSize === bsz ? 700 : 500,
                            }}
                          >
                            {bsz}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '9.5px', color: '#6e7569', marginBottom: '4px' }}>
                    Bấm chọn 1 chân váy/quần dưới đây để AI ghép nguyên set cả bộ:
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '5px',
                      overflowX: 'auto',
                      paddingBottom: '2px',
                      scrollbarWidth: 'none',
                    }}
                  >
                    {bottomCatalogProducts.slice(0, 10).map((bp) => {
                      const bpImg = bp.image || (Array.isArray(bp.images) && bp.images[0]) || DEFAULT_PRODUCT.image;
                      return (
                        <div
                          key={bp._id || bp.name}
                          onClick={() => {
                            setBottomProduct(bp);
                            setBottomSelectedSize('S');
                          }}
                          style={{
                            flex: '0 0 62px',
                            cursor: 'pointer',
                            background: '#ffffff',
                            border: '1px solid var(--color-border, #e2e6dc)',
                            borderRadius: '5px',
                            padding: '3px',
                            textAlign: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          title={`Phối cùng ${bp.name}`}
                        >
                          <img
                            src={bpImg}
                            alt={bp.name}
                            style={{
                              width: '100%',
                              height: '42px',
                              objectFit: 'cover',
                              borderRadius: '3px',
                            }}
                          />
                          <div
                            style={{
                              fontSize: '8.5px',
                              fontWeight: 600,
                              color: '#1f2421',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginTop: '2px',
                            }}
                          >
                            {bp.name}
                          </div>
                          <div
                            style={{
                              fontSize: '8px',
                              color: 'var(--color-gold, #5b6e4e)',
                              fontWeight: 700,
                            }}
                          >
                            + Phối váy
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Auto crop checkbox */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '10px',
              color: '#4a5246',
              background: '#f4f6f1',
              padding: '5px 8px',
              borderRadius: '6px',
              border: '1px solid var(--color-border, #e2e6dc)',
            }}
          >
            <input
              type="checkbox"
              id="autoCropCheck"
              checked={autoCrop}
              onChange={(e) => setAutoCrop(e.target.checked)}
              style={{ accentColor: 'var(--color-gold, #5b6e4e)', cursor: 'pointer', width: '13px', height: '13px' }}
            />
            <label htmlFor="autoCropCheck" style={{ cursor: 'pointer', fontWeight: 500 }}>
              Tự động cắt tỷ lệ 3:4 nếu ảnh người mẫu không chuẩn
            </label>
          </div>

          {/* Mandatory User Photo Consent Checkbox */}
          <div
            className={`tryon-consent-card ${hasPhotoConsent ? 'checked' : ''}`}
            style={{
              background: hasPhotoConsent ? '#eff4eb' : '#f8faf6',
              border: hasPhotoConsent ? '1px solid var(--color-gold, #5b6e4e)' : '1px solid var(--color-border, #e2e6dc)',
              borderRadius: '6px',
              padding: '6px 8px',
              transition: 'all 0.2s ease',
            }}
          >
            <label
              htmlFor="tryonPhotoConsent"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                id="tryonPhotoConsent"
                checked={hasPhotoConsent}
                onChange={(e) => {
                  setHasPhotoConsent(e.target.checked);
                  if (e.target.checked) setErrorMessage('');
                }}
                style={{
                  marginTop: '1px',
                  accentColor: 'var(--color-gold, #5b6e4e)',
                  width: '14px',
                  height: '14px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
              <div style={{ fontSize: '9.5px', color: '#2b332c', lineHeight: 1.35 }}>
                <strong style={{ color: 'var(--color-gold, #5b6e4e)' }}>Bảo mật:</strong> Đồng ý để VESTORA sử dụng hình ảnh thử đồ AI (Bảo mật 256-bit, không chia sẻ).
              </div>
            </label>
          </div>

          {/* AI Trigger Button */}
          <button
            type="button"
            className={`btn-generate-ai ${!hasPhotoConsent ? 'consent-locked' : ''}`}
            onClick={handleGenerateTryOn}
            disabled={isGenerating || !hasPhotoConsent}
            style={{ height: '36px', fontSize: '11.5px', borderRadius: '7px' }}
          >
            {isGenerating ? (
              <>
                <div className="tryon-spinner" />
                <span>ĐANG XỬ LÝ GHÉP ĐỒ AI...</span>
              </>
            ) : (
              <span>BẮT ĐẦU GHÉP ĐỒ AI</span>
            )}
          </button>

          {!hasPhotoConsent && (
            <div style={{ textAlign: 'center', fontSize: '9.5px', color: '#B45309', marginTop: '-2px', fontWeight: 500 }}>
              * Tích chọn đồng ý điều khoản ở trên để bắt đầu ghép đồ
            </div>
          )}
        </div>
      </div>

      {/* Bottom Fixed Action Bar */}
      <footer className="bottom-action-bar">
        {(() => {
          const topPrice3Days = product?.rentalPricePer3Days || (product?.rentalPricePerDay ? product.rentalPricePerDay * 3 : 1050000);
          const bottomPrice3Days = bottomProduct
            ? (bottomProduct.rentalPricePer3Days || (bottomProduct.rentalPricePerDay ? bottomProduct.rentalPricePerDay * 3 : 600000))
            : 0;
          const totalEstimatedRental = topPrice3Days + bottomPrice3Days;

          return (
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#6e7569' }}>Thời gian thuê gợi ý: </span>
                <strong style={{ fontSize: '13px', color: '#1f2421' }}>3 Ngày</strong>
              </div>
              <div style={{ borderLeft: '1px solid var(--color-border, #e2e6dc)', paddingLeft: '20px' }}>
                <span style={{ fontSize: '10px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 600 }}>
                  {bottomProduct ? 'Giá thuê cả set (Áo + Váy): ' : 'Giá thuê dự kiến: '}
                </span>
                <strong style={{ fontSize: '16px', color: 'var(--color-gold, #5b6e4e)' }}>
                  {totalEstimatedRental.toLocaleString('vi-VN')} đ
                </strong>
                {bottomProduct && (
                  <span
                    style={{
                      fontSize: '9.5px',
                      background: '#eaf2e6',
                      color: 'var(--color-gold, #5b6e4e)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      marginLeft: '8px',
                    }}
                  >
                    Set 2 món
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleSaveToWardrobe}
            disabled={isSavingWardrobe || (Boolean(resultImage) && lastSavedImageUrl === resultImage)}
            style={{
              height: '34px',
              padding: '0 12px',
              fontSize: '11px',
              background:
                resultImage && lastSavedImageUrl === resultImage
                  ? '#eaf2e6'
                  : undefined,
              borderColor:
                resultImage && lastSavedImageUrl === resultImage ? 'var(--color-gold, #5b6e4e)' : undefined,
              color:
                resultImage && lastSavedImageUrl === resultImage ? 'var(--color-gold, #5b6e4e)' : '#1f2421',
              cursor:
                resultImage && lastSavedImageUrl === resultImage ? 'default' : 'pointer',
              opacity: isSavingWardrobe ? 0.7 : 1,
            }}
          >
            {isSavingWardrobe
              ? 'Đang lưu...'
              : resultImage && lastSavedImageUrl === resultImage
                ? '✓ Đã lưu tủ đồ'
                : 'Lưu tủ đồ'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ height: '34px', padding: '0 12px', fontSize: '11px' }}
            onClick={() => navigate('/wardrobe')}
          >
            Xem tủ đồ
          </button>
          <button
            type="button"
            className="btn-primary-rent"
            style={{ height: '34px', padding: '0 16px', fontSize: '11.5px' }}
            onClick={() => {
              if (product?._id && product._id !== 'sample-001') {
                navigate(`/product/${product._id}`);
              } else {
                navigate('/catalog');
              }
            }}
          >
            {bottomProduct ? 'Đặt thuê cả set này \u2192' : 'Đặt thuê sản phẩm này \u2192'}
          </button>
        </div>
      </footer>
    </div>
  );
}
