import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '../../styles/PhotoTryOn.css';
import tryOnApi from '../../services/tryOnApi';
import productService from '../../services/productService';
import wardrobeApi from '../../services/wardrobeApi';

const DEFAULT_SAMPLE_MODELS = [
  {
    id: 'female-s',
    label: 'Nữ - Size S (1m65, 48kg)',
    gender: 'female',
    size: 'S',
    imageUrl:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'female-m',
    label: 'Nữ - Size M (1m68, 54kg)',
    gender: 'female',
    size: 'M',
    imageUrl:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'male-m',
    label: 'Nam - Size M (1m75, 68kg)',
    gender: 'male',
    size: 'M',
    imageUrl:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'male-l',
    label: 'Nam - Size L (1m80, 75kg)',
    gender: 'male',
    size: 'L',
    imageUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
  },
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
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef(null);

  const productParam = searchParams.get('product') || searchParams.get('productId');

  // Product state
  const [product, setProduct] = useState(DEFAULT_PRODUCT);

  // Model & User Photo state
  const [sampleModels, setSampleModels] = useState(DEFAULT_SAMPLE_MODELS);
  const [selectedSampleId, setSelectedSampleId] = useState('female-s');
  const [userUploadedFile, setUserUploadedFile] = useState(null);
  const [activeModelImage, setActiveModelImage] = useState(DEFAULT_SAMPLE_MODELS[0].imageUrl);

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

  // 1. Fetch sample models from server on mount
  useEffect(() => {
    tryOnApi
      .getSampleModels()
      .then((models) => {
        if (Array.isArray(models) && models.length > 0) {
          setSampleModels(models);
          setSelectedSampleId(models[0].id);
          setActiveModelImage(models[0].imageUrl);
        }
      })
      .catch((err) => {
        console.warn('Lấy sample models mặc định:', err.message);
      });
  }, []);

  // 2. Fetch product info if productParam is provided
  useEffect(() => {
    if (!productParam) return;

    productService
      .getProductById(productParam)
      .then((res) => {
        const prodData = res?.data || res;
        if (prodData && prodData.name) {
          setProduct(prodData);

          // Auto-detect category (bao gồm cả 'cả bộ', 'suit', 'set', 'đầm', 'áo dài')
          const catStr = (
            `${prodData.name} ` + (Array.isArray(prodData.category) ? prodData.category.join(' ') : '')
          ).toLowerCase();

          if (/đầm|dam|váy|vay|áo dài|ao dai|dress|gown|jumpsuit|set|bộ|bo|suit|outfit/.test(catStr)) {
            setCategory('dresses');
          } else if (/quần|quan|chân váy|skirt|pants|trouser/.test(catStr)) {
            setCategory('lower_body');
          } else {
            setCategory('upper_body');
          }

          if (Array.isArray(prodData.sizes) && prodData.sizes.length > 0) {
            setSelectedSize(prodData.sizes[0]);
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
    setSelectedSampleId('custom');
    setResultImage(null); // Reset previous result
  };

  // Select sample mannequin preset
  const handleSelectSample = (sample) => {
    setUserUploadedFile(null);
    setSelectedSampleId(sample.id);
    setActiveModelImage(sample.imageUrl);
    setSelectedSize(sample.size || 'M');
    setResultImage(null);
    setErrorMessage('');
  };

  // Trigger AI IDM-VTON Try-On
  const handleGenerateTryOn = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsGenerating(true);
    setGenerationStep('Đang chuẩn hoá tỷ lệ người mẫu và nhận diện trang phục...');

    const stepTimer1 = setTimeout(() => {
      setGenerationStep('AI IDM-VTON đang tính toán nếp gấp và độ rủ vải...');
    }, 4500);

    const stepTimer2 = setTimeout(() => {
      setGenerationStep('Đang kết xuất ánh sáng và hoàn thiện phom dáng...');
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

      const response = await tryOnApi.generate(formData);

      if (response?.data?.resultImageUrl || response?.resultImageUrl) {
        const finalUrl = response.data?.resultImageUrl || response.resultImageUrl;
        setResultImage(finalUrl);
        setLastSavedImageUrl(''); // Reset trạng thái lưu khi có ảnh ghép mới
        setShowOriginal(false);
        setSuccessMessage('Ghép trang phục AI thành công!');
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
        title: product?.name || 'Trang phục thử đồ AI',
        image: garmentImageUrl,
        tryOnImageUrl: resultImage,
        category:
          (Array.isArray(product?.category) ? product.category[0] : product?.category) ||
          'Thời trang cao cấp',
        price: product?.rentalPricePerDay || product?.salePrice || 350000,
        priceUnit: product?.rentalPricePerDay ? '/ ngày' : '',
        selectedSize: selectedSize || 'S',
        aiNote: `Đã thử bằng AI IDM-VTON cho vóc dáng Size ${selectedSize}. Trang phục vừa vặn và giữ phom dáng chuẩn.`,
        tags: ['tryon-history', 'ai-suggested'],
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
      {/* Top Header Bar */}
      <header className="tryon-header-bar">
        <Link
          to="/"
          style={{
            color: '#A3A3A3',
            textDecoration: 'none',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          &larr; Rời phòng thử AI
        </Link>
        <Link
          to="/"
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: '24px',
            letterSpacing: '4px',
            color: '#FFF',
            textDecoration: 'none',
            fontWeight: 700,
          }}
        >
          VESTORA
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#34C759' }}>
          <span>BẢO MẬT SINH TRẮC HỌC</span>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#FFF',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            ✕
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
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#FFF',
            padding: '6px 14px',
            borderRadius: '99px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          &larr; Quay lại sản phẩm
        </button>

        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-gold)', letterSpacing: '1px' }}>
          PHÒNG THỬ ĐỒ ẢO AI — CÔNG NGHỆ IDM-VTON
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span
            style={{
              background: 'rgba(52, 199, 89, 0.15)',
              color: '#34C759',
              padding: '4px 10px',
              borderRadius: '99px',
              fontWeight: 600,
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
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #EF4444',
            color: '#FCA5A5',
            padding: '10px 24px',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage('')}
            style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div
          style={{
            background: 'rgba(52, 199, 89, 0.2)',
            border: '1px solid #34C759',
            color: '#86EFAC',
            padding: '12px 24px',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span>✓ {successMessage}</span>
            <Link
              to="/wardrobe"
              style={{
                color: '#FFF',
                background: 'rgba(52, 199, 89, 0.25)',
                border: '1px solid #34C759',
                padding: '4px 12px',
                borderRadius: '99px',
                fontSize: '11px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Mở Tủ Đồ xem ngay &rarr;
            </Link>
          </div>
          <button
            onClick={() => setSuccessMessage('')}
            style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', fontSize: '14px' }}
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
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: 'var(--color-gold)' }}>
              BƯỚC 1
            </span>
            <span
              style={{
                fontSize: '10px',
                background: userUploadedFile ? '#059669' : 'rgba(255,255,255,0.08)',
                color: userUploadedFile ? '#FFF' : '#A3A3A3',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              {userUploadedFile ? 'Ảnh của bạn' : 'Mẫu tiêu chuẩn'}
            </span>
          </div>

          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', margin: 0 }}>
            1. Ảnh Người Mẫu / Cá Nhân
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
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              {userUploadedFile ? 'Đã tải ảnh cá nhân thành công' : 'Bấm để tải ảnh toàn thân của bạn'}
            </div>
            <div style={{ fontSize: '11px', color: '#A3A3A3', marginBottom: '12px' }}>
              {userUploadedFile
                ? `${userUploadedFile.name} (${(userUploadedFile.size / 1024 / 1024).toFixed(1)}MB)`
                : 'Hỗ trợ ảnh JPG, PNG chụp rõ toàn thân, phông trơn'}
            </div>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '11px', padding: '6px 16px', pointerEvents: 'none' }}
            >
              {userUploadedFile ? 'Chọn ảnh khác' : 'Tải ảnh toàn thân'}
            </button>
          </div>

          {/* Active model card */}
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '14px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <img
              src={activeModelImage}
              alt="Model"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid var(--color-gold)',
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>
                {userUploadedFile ? 'Ảnh người dùng tải lên' : 'Người mẫu mannequin chuẩn'}
              </div>
              <div style={{ fontSize: '10px', color: '#A3A3A3' }}>
                {userUploadedFile ? 'Ảnh sẵn sàng thử đồ' : `Size: ${selectedSize}`}
              </div>
            </div>
            {userUploadedFile && (
              <button
                type="button"
                onClick={() => {
                  setUserUploadedFile(null);
                  setSelectedSampleId('female-s');
                  setActiveModelImage(DEFAULT_SAMPLE_MODELS[0].imageUrl);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
                title="Bỏ ảnh cá nhân"
              >
                Huỷ ảnh
              </button>
            )}
          </div>

          {/* Mannequin presets */}
          <div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '1px',
                marginBottom: '8px',
                color: '#A3A3A3',
              }}
            >
              HOẶC CHỌN NHANH MANNEQUIN TIÊU CHUẨN
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {sampleModels.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  className={`model-preset-btn ${selectedSampleId === sample.id ? 'active' : ''}`}
                  onClick={() => handleSelectSample(sample)}
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quy chuẩn chụp ảnh */}
          <div
            style={{
              fontSize: '11px',
              color: '#A3A3A3',
              lineHeight: 1.6,
              background: 'rgba(255,255,255,0.02)',
              padding: '10px',
              borderRadius: '10px',
            }}
          >
            <strong style={{ color: '#FFF', display: 'block', marginBottom: '4px' }}>
              Mẹo để ghép đồ đẹp nhất:
            </strong>
            • Đứng thẳng người, tay không che ngực hay eo.<br />
            • Nền tường trơn, không có vật cản phía sau.<br />
            • Đảm bảo đủ ánh sáng tự nhiên rõ nét.
          </div>
        </div>

        {/* CENTER PANEL: Real-time 3D AR Stage */}
        <div className="stage-viewport-card">
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

          {/* Before/After Tag Badge */}
          {resultImage && (
            <div
              className={`tryon-compare-badge ${showOriginal ? 'badge-before' : 'badge-after'}`}
            >
              {showOriginal ? 'ẢNH GỐC (TRƯỚC)' : 'AI TRY-ON (KẾT QUẢ)'}
            </div>
          )}

          <img
            src={currentDisplayImage}
            alt="Virtual Try-On Stage"
            className="stage-bg-image"
          />

          {/* Bottom Measurements & Compare Control bar */}
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              right: '16px',
              background: 'rgba(26, 27, 30, 0.92)',
              backdropFilter: 'blur(10px)',
              borderRadius: '9999px',
              padding: '10px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              zIndex: 15,
            }}
          >
            <div>
              <span>Kích cỡ: <strong>Size {selectedSize}</strong></span> &bull;{' '}
              <span>Phân loại: <strong>{category.toUpperCase()}</strong></span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {resultImage && (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '11px', padding: '6px 14px' }}
                    onClick={() => setShowOriginal(!showOriginal)}
                  >
                    {showOriginal ? 'Xem kết quả AI' : 'So sánh ảnh gốc'}
                  </button>
                  <a
                    href={resultImage}
                    target="_blank"
                    rel="noreferrer"
                    download="vestora-ai-tryon.png"
                    className="btn-secondary"
                    style={{
                      fontSize: '11px',
                      padding: '6px 14px',
                      textDecoration: 'none',
                      color: '#FFF',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    Tải ảnh
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Step 2 Item Selection & Adjustments */}
        <div className="panel-dark-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: 'var(--color-gold)' }}>
              BƯỚC 2
            </span>
            <span
              style={{
                fontSize: '10px',
                background: '#ECFDF5',
                color: '#059669',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              SẢN PHẨM HỢP LỆ
            </span>
          </div>

          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', margin: 0 }}>
            2. Trang Phục Đang Thử
          </h2>

          {/* Item Card */}
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '16px',
              padding: '14px',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              gap: '12px',
            }}
          >
            <img
              src={garmentImageUrl}
              alt={product?.name}
              style={{
                width: '64px',
                height: '84px',
                borderRadius: '10px',
                objectFit: 'cover',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: 'var(--color-gold)', fontWeight: 600 }}>
                {product?.brand || 'Vestora Atelier'}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  margin: '3px 0',
                  lineHeight: 1.3,
                  maxHeight: '36px',
                  overflow: 'hidden',
                }}
              >
                {product?.name || 'Trang phục cao cấp'}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>
                {(product?.rentalPricePerDay || 350000).toLocaleString('vi-VN')} đ{' '}
                <small style={{ fontWeight: 400, fontSize: '10px', color: '#A3A3A3' }}>/ ngày</small>
              </div>
            </div>
          </div>

          {/* Category Picker */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.8px',
                marginBottom: '8px',
                color: '#CCC',
              }}
            >
              LOẠI TRANG PHỤC (AI CLASSIFICATION)
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'dresses', label: 'Đầm / Cả bộ' },
                { id: 'upper_body', label: 'Áo / Thân trên' },
                { id: 'lower_body', label: 'Quần / Chân váy' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`category-pill-btn ${category === c.id ? 'active' : ''}`}
                  onClick={() => setCategory(c.id)}
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
                fontSize: '11px',
                marginBottom: '8px',
              }}
            >
              <span>CHỌN KÍCH CỠ</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {['XS', 'S', 'M', 'L', 'XL'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`size-btn ${selectedSize === s ? 'active' : ''}`}
                  style={{
                    height: '36px',
                    fontSize: '11px',
                    background: selectedSize === s ? 'var(--color-gold)' : 'rgba(255,255,255,0.05)',
                    color: selectedSize === s ? '#000' : '#FFF',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: selectedSize === s ? 700 : 400,
                  }}
                  onClick={() => setSelectedSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Auto crop checkbox */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              color: '#A3A3A3',
              background: 'rgba(255,255,255,0.03)',
              padding: '8px 12px',
              borderRadius: '8px',
            }}
          >
            <input
              type="checkbox"
              id="autoCropCheck"
              checked={autoCrop}
              onChange={(e) => setAutoCrop(e.target.checked)}
              style={{ accentColor: 'var(--color-gold)', cursor: 'pointer' }}
            />
            <label htmlFor="autoCropCheck" style={{ cursor: 'pointer' }}>
              Tự động cắt tỷ lệ 3:4 nếu ảnh người mẫu không chuẩn
            </label>
          </div>

          {/* AI Trigger Button */}
          <button
            type="button"
            className="btn-generate-ai"
            onClick={handleGenerateTryOn}
            disabled={isGenerating}
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

          {/* Security note */}
          <div
            style={{
              fontSize: '10px',
              color: '#A3A3A3',
              background: 'rgba(255,255,255,0.02)',
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            Bảo mật sinh trắc học theo chuẩn mã hoá 256-bit. Ảnh cá nhân được lưu an toàn và chỉ dùng để mô phỏng trang phục.
          </div>
        </div>
      </div>

      {/* Bottom Fixed Action Bar */}
      <footer className="bottom-action-bar">
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#A3A3A3' }}>Thời gian thuê gợi ý: </span>
            <strong style={{ fontSize: '14px', color: '#FFF' }}>3 Ngày</strong>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '24px' }}>
            <span style={{ fontSize: '11px', color: '#34C759' }}>Giá thuê dự kiến: </span>
            <strong style={{ fontSize: '18px', color: 'var(--color-gold)' }}>
              {(product?.rentalPricePer3Days || (product?.rentalPricePerDay ? product.rentalPricePerDay * 3 : 1050000)).toLocaleString('vi-VN')} đ
            </strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleSaveToWardrobe}
            disabled={isSavingWardrobe || (Boolean(resultImage) && lastSavedImageUrl === resultImage)}
            style={{
              background:
                resultImage && lastSavedImageUrl === resultImage
                  ? 'rgba(52, 199, 89, 0.15)'
                  : undefined,
              borderColor:
                resultImage && lastSavedImageUrl === resultImage ? '#34C759' : undefined,
              color:
                resultImage && lastSavedImageUrl === resultImage ? '#86EFAC' : '#FFF',
              cursor:
                resultImage && lastSavedImageUrl === resultImage ? 'default' : 'pointer',
              opacity: isSavingWardrobe ? 0.7 : 1,
            }}
          >
            {isSavingWardrobe
              ? 'Đang lưu vào tủ đồ...'
              : resultImage && lastSavedImageUrl === resultImage
                ? '✓ Đã lưu vào tủ đồ'
                : 'Lưu vào tủ đồ'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: '11px', padding: '10px 18px' }}
            onClick={() => navigate('/wardrobe')}
          >
            Xem tủ đồ
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '12px 28px' }}
            onClick={() => {
              if (product?._id && product._id !== 'sample-001') {
                navigate(`/product/${product._id}`);
              } else {
                navigate('/catalog');
              }
            }}
          >
            Đặt thuê sản phẩm này
          </button>
        </div>
      </footer>
    </div>
  );
}
