import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, X, Sparkles, Download } from 'lucide-react';
import '../../styles/PhotoTryOn.css';
import tryOnApi from '../../services/tryOnApi';
import productService from '../../services/productService';
import wardrobeApi from '../../services/wardrobeApi';

export default function PhotoTryOnPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef(null);

  const productParam = searchParams.get('product') || searchParams.get('productId');

  // Product state - khởi tạo null, tải sản phẩm thật 100% từ cơ sở dữ liệu
  const [product, setProduct] = useState(null);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [productCategoryTab, setProductCategoryTab] = useState('all');

  // Paired outfit & accessories for full styling combo
  const [pairedGarment, setPairedGarment] = useState(null); // Quần/Váy nếu đang chọn Áo; Áo/Vest nếu đang chọn Quần
  const [pairedGarmentSize, setPairedGarmentSize] = useState('S');
  const [pairedAccessory, setPairedAccessory] = useState(null); // Túi xách phối kèm (đã loại bỏ trang sức)
  const [pairingTab, setPairingTab] = useState('outfit'); // 'outfit' | 'accessory'

  const FALLBACK_GARMENT_IMAGE =
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80';

  const isJewelry = (item) => {
    if (!item) return false;
    const text = `${item.name || ''} ${
      Array.isArray(item.category) ? item.category.join(' ') : item.category || ''
    }`.toLowerCase();
    return /nhẫn|nhan|bông tai|bong tai|khuyên|khuyen|vòng|vong|dây chuyền|day chuyen|lắc|lac|trang sức|trang suc|jewelry|earring|necklace|ring|bracelet/.test(
      text
    );
  };

  const isTestItem = (item) => {
    if (!item) return false;
    const text = `${item.name || ''} ${item.description || ''} ${
      Array.isArray(item.category) ? item.category.join(' ') : item.category || ''
    }`.toLowerCase();
    return text.includes('test') || text.includes('(test)');
  };

  // Sample Models & User Photo state
  const [sampleModels, setSampleModels] = useState([]);
  const [userUploadedFile, setUserUploadedFile] = useState(null);
  const [activeModelImage, setActiveModelImage] = useState('');
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

  // 0. Fetch danh sách người mẫu chuẩn từ API máy chủ backend
  useEffect(() => {
    tryOnApi
      .getSampleModels()
      .then((models) => {
        if (Array.isArray(models) && models.length > 0) {
          setSampleModels(models);
          // Gán ảnh mẫu đầu tiên từ backend nếu người dùng chưa chọn ảnh
          setActiveModelImage((prev) => prev || models[0].imageUrl);
        }
      })
      .catch((err) => {
        console.warn('Không thể tải danh sách mẫu chuẩn từ backend:', err.message);
      });
  }, []);

  // 1. Fetch danh sách sản phẩm thật từ cơ sở dữ liệu
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

        // Lọc bỏ 100% trang sức (nhẫn, bông tai, vòng...) và các sản phẩm test / lỗi
        list = list.filter((item) => !isJewelry(item) && !isTestItem(item));
        setCatalogProducts(list);

        // Nếu trên URL không có param ?product/productId, tự động lấy sản phẩm thật đầu tiên từ database
        if (!productParam && list.length > 0) {
          const firstProd = list[0];
          setProduct(firstProd);

          const catStr = (
            `${firstProd.name || ''} ` +
            (Array.isArray(firstProd.category) ? firstProd.category.join(' ') : (firstProd.category || ''))
          ).toLowerCase();

          if (/túi|tui|bag|kính|kinh|glasses|khăn|khan|giày|giay|shoes|phụ kiện|nón|mũ|hat|clutch/.test(catStr)) {
            setCategory('accessories');
          } else if (/đầm|dam|váy|vay|áo dài|ao dai|dress|gown|jumpsuit|set|bộ|bo|suit|outfit/.test(catStr)) {
            setCategory('dresses');
          } else if (/quần|quan|chân váy|skirt|pants|trouser/.test(catStr)) {
            setCategory('lower_body');
          } else {
            setCategory('upper_body');
          }

          const pSizes = (Array.isArray(firstProd.sizes) && firstProd.sizes.length > 0)
            ? firstProd.sizes
            : (Array.isArray(firstProd.availableSizes) && firstProd.availableSizes.length > 0)
              ? firstProd.availableSizes
              : ['S', 'M', 'L'];
          setSelectedSize(pSizes[0] || 'S');
        }
      })
      .catch((err) => {
        console.warn('Không thể tải danh sách sản phẩm phòng thử đồ:', err.message);
      })
      .finally(() => {
        setCatalogLoading(false);
      });
  }, [productParam]);

  // 2. Fetch chi tiết sản phẩm nếu có productParam trên URL
  useEffect(() => {
    if (!productParam) return;
    if (product?._id === productParam) return;

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

          if (/túi|tui|bag|kính|kinh|glasses|khăn|khan|giày|giay|shoes|phụ kiện|nón|mũ|hat|clutch/.test(catStr)) {
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
  }, [productParam, product?._id]);

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

  // Reset user uploaded photo back to default sample model
  const handleResetUserPhoto = () => {
    setUserUploadedFile(null);
    const fallbackModel = sampleModels[0]?.imageUrl || '';
    setActiveModelImage(fallbackModel);
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

    if (/túi|tui|bag|kính|kinh|glasses|khăn|khan|giày|giay|shoes|phụ kiện|nón|mũ|hat|clutch/.test(catStr)) {
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
        : (/túi|kính|nón|mũ|khăn|phụ kiện/.test(catStr) ? ['Freesize', 'Tiêu chuẩn'] : ['S', 'M', 'L']);
    setSelectedSize(pSizes[0] || 'S');

    // Update query params in-place on current route (does not navigate away)
    if (selectedProd._id) {
      setSearchParams({ productId: selectedProd._id }, { replace: true });
    }
  };

  // Trích xuất danh mục động thực tế từ danh sách sản phẩm trong cơ sở dữ liệu (đã lọc sạch test & trang sức)
  const productCategoryTabs = useMemo(() => {
    const categoriesMap = new Map();
    categoriesMap.set('all', 'Tất cả');

    catalogProducts.forEach((p) => {
      const cats = Array.isArray(p.category) ? p.category : [p.category];
      cats.forEach((c) => {
        if (c && typeof c === 'string' && c.trim()) {
          const trimmed = c.trim();
          const lower = trimmed.toLowerCase();
          // Bỏ qua các tab có chứa test hoặc danh mục trang sức
          if (
            !lower.includes('test') &&
            !/nhẫn|nhan|bông tai|bong tai|khuyên|khuyen|vòng|vong|dây chuyền|day chuyen|lắc|lac|trang sức|trang suc|jewelry/.test(lower)
          ) {
            if (!categoriesMap.has(lower)) {
              categoriesMap.set(lower, trimmed);
            }
          }
        }
      });
    });

    return Array.from(categoriesMap.entries()).map(([id, label]) => ({
      id,
      label,
    }));
  }, [catalogProducts]);

  // Lọc sản phẩm hiển thị theo tab danh mục động
  const displayedCatalogProducts = useMemo(() => {
    if (productCategoryTab === 'all') return catalogProducts;
    return catalogProducts.filter((item) => {
      if (Array.isArray(item.category)) {
        return item.category.some(
          (c) => c && c.toLowerCase() === productCategoryTab.toLowerCase()
        );
      }
      if (item.category && typeof item.category === 'string') {
        return item.category.toLowerCase() === productCategoryTab.toLowerCase();
      }
      const catStr = `${item.name || ''}`.toLowerCase();
      return catStr.includes(productCategoryTab.toLowerCase());
    });
  }, [catalogProducts, productCategoryTab]);

  // Phân loại danh mục sản phẩm gợi ý thông minh từ cơ sở dữ liệu thật
  const topCatalogProducts = useMemo(() => {
    return catalogProducts.filter((item) => {
      if (item._id === product?._id) return false;
      const catStr = (`${item.name || ''} ${(Array.isArray(item.category) ? item.category.join(' ') : (item.category || ''))}`).toLowerCase();
      return /áo|ao|vest|blazer|shirt|jacket|coat|hoodie|sweater/.test(catStr) && !/áo dài|ao dai/.test(catStr);
    });
  }, [catalogProducts, product?._id]);

  const bottomCatalogProducts = useMemo(() => {
    return catalogProducts.filter((item) => {
      if (item._id === product?._id) return false;
      const catStr = (`${item.name || ''} ${(Array.isArray(item.category) ? item.category.join(' ') : (item.category || ''))}`).toLowerCase();
      return /quần|quan|chân váy|skirt|pants|trouser|short/.test(catStr);
    });
  }, [catalogProducts, product?._id]);

  const accessoryCatalogProducts = useMemo(() => {
    return catalogProducts.filter((item) => {
      if (item._id === product?._id) return false;
      if (isJewelry(item) || isTestItem(item)) return false;
      const catStr = (`${item.name || ''} ${(Array.isArray(item.category) ? item.category.join(' ') : (item.category || ''))}`).toLowerCase();
      return /túi|tui|bag|kính|kinh|glasses|khăn|khan|giày|giay|shoes|phụ kiện|nón|mũ|hat|clutch|thắt lưng|that lung|belt/.test(catStr);
    });
  }, [catalogProducts, product?._id]);

  const dressCatalogProducts = useMemo(() => {
    return catalogProducts.filter((item) => {
      if (item._id === product?._id) return false;
      const catStr = (`${item.name || ''} ${(Array.isArray(item.category) ? item.category.join(' ') : (item.category || ''))}`).toLowerCase();
      return /đầm|dam|váy|vay|áo dài|ao dai|dress|gown|jumpsuit|set|bộ|bo|suit|outfit/.test(catStr);
    });
  }, [catalogProducts, product?._id]);

  // Gợi ý trang phục chính phối cùng
  const currentOutfitSuggestions = useMemo(() => {
    let list = [];
    if (category === 'upper_body') {
      list = bottomCatalogProducts;
    } else if (category === 'lower_body') {
      list = topCatalogProducts;
    } else if (category === 'dresses') {
      list = topCatalogProducts;
    } else {
      list = dressCatalogProducts.length > 0 ? dressCatalogProducts : topCatalogProducts;
    }
    return list.length > 0 ? list : catalogProducts.filter((p) => p._id !== product?._id);
  }, [category, bottomCatalogProducts, topCatalogProducts, dressCatalogProducts, catalogProducts, product?._id]);

  // Gợi ý phụ kiện thật từ cơ sở dữ liệu
  const currentAccessorySuggestions = useMemo(() => {
    return accessoryCatalogProducts;
  }, [accessoryCatalogProducts]);

  // Trigger AI IDM-VTON Try-On
  const handleGenerateTryOn = async () => {
    if (!hasPhotoConsent) {
      setErrorMessage('Vui lòng tích chọn đồng ý cho phép ứng dụng sử dụng hình ảnh trước khi ghép đồ AI!');
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    setIsGenerating(true);

    const pairedCount = (pairedGarment ? 1 : 0) + (pairedAccessory ? 1 : 0);
    const totalSetItems = 1 + pairedCount;

    setGenerationStep(
      totalSetItems === 3
        ? 'Đang chuẩn bị ghép set 3 món hoàn chỉnh: Món chính + Trang phục phối + Túi xách thời trang...'
        : totalSetItems === 2
          ? 'Đang chuẩn bị ghép set 2 món phối hoàn chỉnh...'
          : 'Đang chuẩn hoá tỷ lệ người mẫu và nhận diện trang phục...'
    );

    const stepTimer1 = setTimeout(() => {
      setGenerationStep(
        totalSetItems > 1
          ? 'Bước 1: AI IDM-VTON đang tính toán phom dáng trang phục chính...'
          : 'AI IDM-VTON đang tính toán nếp gấp và độ rủ vải...'
      );
    }, 4500);

    const stepTimer2 = setTimeout(() => {
      setGenerationStep(
        totalSetItems === 3
          ? 'Bước 2 & 3: Đang ghép tiếp trang phục phối và túi xách thời trang...'
          : totalSetItems === 2
            ? 'Bước 2: Đang ghép tiếp món phối vào tổng thể người mẫu...'
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

      if (product?._id) {
        formData.append('productId', product._id);
      }

      const garmentImg =
        product?.image ||
        (Array.isArray(product?.images) && product.images[0]) ||
        '';

      formData.append('garmentImageUrl', garmentImg);
      formData.append('garmentDescription', product?.name || 'luxury clothing');
      formData.append('category', category);
      formData.append('crop', String(autoCrop));

      // 1. Trang phục phối kèm (Quần / Chân váy hoặc Áo / Blazer)
      if (pairedGarment) {
        const pairedImg =
          pairedGarment.image ||
          (Array.isArray(pairedGarment.images) && pairedGarment.images[0]);
        if (pairedImg) {
          const pairedCat =
            category === 'upper_body' ? 'lower_body' : category === 'lower_body' ? 'upper_body' : 'upper_body';
          formData.append('pairedGarmentImageUrl', pairedImg);
          formData.append('pairedGarmentDescription', pairedGarment.name || 'trang phục phối');
          formData.append('pairedGarmentCategory', pairedCat);
          // Tương thích ngược
          formData.append('bottomGarmentImageUrl', pairedImg);
          formData.append('bottomGarmentDescription', pairedGarment.name || 'trang phục phối');
        }
        if (pairedGarment._id) {
          formData.append('pairedGarmentId', pairedGarment._id);
          formData.append('bottomProductId', pairedGarment._id);
        }
      }

      // 2. Phụ kiện phối kèm (Túi xách, Kính mắt...)
      if (pairedAccessory) {
        const accImg =
          pairedAccessory.image ||
          (Array.isArray(pairedAccessory.images) && pairedAccessory.images[0]);
        if (accImg) {
          formData.append('accessoryGarmentImageUrl', accImg);
          formData.append('accessoryGarmentDescription', pairedAccessory.name || 'phụ kiện túi xách thời trang');
          formData.append('accessoryCategory', 'accessories');
        }
        if (pairedAccessory._id) {
          formData.append('accessoryGarmentId', pairedAccessory._id);
        }
      }

      const response = await tryOnApi.generate(formData);

      if (response?.data?.resultImageUrl || response?.resultImageUrl) {
        const finalUrl = response.data?.resultImageUrl || response.resultImageUrl;
        setResultImage(finalUrl);
        setLastSavedImageUrl(''); // Reset trạng thái lưu khi có ảnh ghép mới
        setShowOriginal(false);
        setSuccessMessage(
          totalSetItems === 3
            ? 'Ghép thành công trọn bộ set 3 món (Trang phục + Túi xách thời trang)!'
            : totalSetItems === 2
              ? 'Ghép thành công set 2 món phối!'
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
      const isCombo = Boolean(pairedGarment || pairedAccessory);
      const totalItems = 1 + (pairedGarment ? 1 : 0) + (pairedAccessory ? 1 : 0);

      const titleParts = [product?.name];
      if (pairedGarment?.name) titleParts.push(pairedGarment.name);
      if (pairedAccessory?.name) titleParts.push(pairedAccessory.name);

      const payload = {
        productId: product?._id || null,
        productCode: product?.productCode || '',
        title: isCombo ? `Set đồ: ${titleParts.join(' + ')}` : (product?.name || 'Trang phục thử đồ AI'),
        image: garmentImageUrl,
        tryOnImageUrl: resultImage,
        category: isCombo
          ? `Set phối ${totalItems} món`
          : (Array.isArray(product?.category) ? product.category[0] : product?.category) || 'Thời trang cao cấp',
        price: (product?.rentalPricePerDay || 0) + (pairedGarment?.rentalPricePerDay || 0) + (pairedAccessory?.rentalPricePerDay || 0),
        priceUnit: '/ ngày',
        selectedSize: pairedGarment ? `Món chính: ${selectedSize} • Món phối: ${pairedGarmentSize}` : selectedSize,
        aiNote: isCombo
          ? `Set phối ${totalItems} món hoàn chỉnh được ghép bằng công nghệ AI IDM-VTON.`
          : `Đã thử bằng AI IDM-VTON cho vóc dáng Size ${selectedSize}. Trang phục vừa vặn và giữ phom dáng chuẩn.`,
        tags: isCombo ? ['tryon-history', 'ai-combo', 'set-outfit'] : ['tryon-history', 'ai-suggested'],
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
    '';

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
                  {pairedAccessory && (
                    <div
                      className="stage-accessory-card"
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        right: '10px',
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(8px)',
                        border: '1.5px solid var(--color-gold, #5b6e4e)',
                        borderRadius: '9px',
                        padding: '5px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        boxShadow: '0 4px 12px rgba(31, 36, 33, 0.18)',
                        zIndex: 10,
                        maxWidth: '190px',
                      }}
                    >
                      <img
                        src={
                          pairedAccessory.image ||
                          (Array.isArray(pairedAccessory.images) && pairedAccessory.images[0]) ||
                          FALLBACK_GARMENT_IMAGE
                        }
                        alt={pairedAccessory.name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = FALLBACK_GARMENT_IMAGE;
                        }}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '5px',
                          objectFit: 'cover',
                          border: '1px solid #e2e6dc',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '8px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 700, textTransform: 'uppercase' }}>
                          👜 Phụ kiện set
                        </div>
                        <div
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            color: '#1f2421',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={pairedAccessory.name}
                        >
                          {pairedAccessory.name}
                        </div>
                        <div style={{ fontSize: '8.5px', color: '#6e7569', fontWeight: 600 }}>
                          +{(pairedAccessory.rentalPricePerDay || 150000).toLocaleString('vi-VN')} đ
                        </div>
                      </div>
                    </div>
                  )}
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
              {pairedGarment && (
                <> &bull; <span>Món phối: <strong>Size {pairedGarmentSize}</strong></span></>
              )}
              {pairedAccessory && (
                <> &bull; <span>Phụ kiện: <strong>{pairedAccessory.name}</strong></span></>
              )} &bull;{' '}
              <span>Phân loại: <strong>
                {(pairedGarment || pairedAccessory)
                  ? `SET PHỐI (${1 + (pairedGarment ? 1 : 0) + (pairedAccessory ? 1 : 0)} MÓN)`
                  : category.toUpperCase()}
              </strong></span>
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
              {productCategoryTabs.map((tab) => (
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
                  const pImg = p.image || (Array.isArray(p.images) && p.images[0]) || '';
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
                        src={pImg || FALLBACK_GARMENT_IMAGE}
                        alt={p.name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = FALLBACK_GARMENT_IMAGE;
                        }}
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
              src={garmentImageUrl || FALLBACK_GARMENT_IMAGE}
              alt={product?.name}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = FALLBACK_GARMENT_IMAGE;
              }}
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

          {/* Gợi Ý Phối Cả Set Linh Hoạt: Quần / Chân Váy, Áo, Túi Xách Thời Trang */}
          <div
            className="outfit-combo-box"
            style={{
              background: '#f8faf6',
              border: '1.5px dashed var(--color-gold, #5b6e4e)',
              borderRadius: '9px',
              padding: '8px 10px',
              marginTop: '2px',
            }}
          >
            {/* Header của khối gợi ý */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Sparkles size={12} color="var(--color-gold, #5b6e4e)" />
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-gold, #5b6e4e)', letterSpacing: '0.4px' }}>
                  GỢI Ý PHỐI CẢ SET HOÀN CHỈNH
                </span>
                {(pairedGarment || pairedAccessory) && (
                  <span
                    style={{
                      fontSize: '9px',
                      background: 'var(--color-gold, #5b6e4e)',
                      color: '#ffffff',
                      padding: '1px 6px',
                      borderRadius: '99px',
                      fontWeight: 700,
                    }}
                  >
                    {(pairedGarment ? 1 : 0) + (pairedAccessory ? 1 : 0)} món phối
                  </span>
                )}
              </div>

              {(pairedGarment || pairedAccessory) && (
                <button
                  type="button"
                  onClick={() => {
                    setPairedGarment(null);
                    setPairedAccessory(null);
                  }}
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
                  ✕ Bỏ tất cả phối
                </button>
              )}
            </div>

            {/* Các món ĐÃ ĐƯỢC CHỌN trong set */}
            {(pairedGarment || pairedAccessory) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '8px' }}>
                {/* 1. Món quần / chân váy hoặc áo phối kèm */}
                {pairedGarment && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '7px',
                      alignItems: 'center',
                      background: '#ffffff',
                      border: '1px solid var(--color-border, #e2e6dc)',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={
                        pairedGarment.image ||
                        (Array.isArray(pairedGarment.images) && pairedGarment.images[0]) ||
                        FALLBACK_GARMENT_IMAGE
                      }
                      alt={pairedGarment.name}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = FALLBACK_GARMENT_IMAGE;
                      }}
                      style={{
                        width: '34px',
                        height: '42px',
                        borderRadius: '4px',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: '#1f2421',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {pairedGarment.name}
                      </div>
                      <div style={{ fontSize: '9.5px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 600 }}>
                        +{(pairedGarment.rentalPricePerDay || 200000).toLocaleString('vi-VN')} đ/ngày
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <span style={{ fontSize: '8.5px', color: '#6e7569', fontWeight: 600 }}>Size:</span>
                        {['XS', 'S', 'M', 'L'].map((bsz) => (
                          <button
                            key={bsz}
                            type="button"
                            onClick={() => setPairedGarmentSize(bsz)}
                            style={{
                              padding: '1px 4px',
                              fontSize: '8.5px',
                              borderRadius: '3px',
                              border: pairedGarmentSize === bsz ? '1px solid var(--color-gold, #5b6e4e)' : '1px solid #dce1d5',
                              background: pairedGarmentSize === bsz ? 'var(--color-gold, #5b6e4e)' : '#f4f6f1',
                              color: pairedGarmentSize === bsz ? '#fff' : '#1f2421',
                              cursor: 'pointer',
                              fontWeight: pairedGarmentSize === bsz ? 700 : 500,
                            }}
                          >
                            {bsz}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPairedGarment(null)}
                      title="Bỏ món này"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#9ca3af',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: '2px 4px',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* 2. Món phụ kiện túi xách phối kèm */}
                {pairedAccessory && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '7px',
                      alignItems: 'center',
                      background: '#ffffff',
                      border: '1px solid var(--color-border, #e2e6dc)',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={
                        pairedAccessory.image ||
                        (Array.isArray(pairedAccessory.images) && pairedAccessory.images[0]) ||
                        FALLBACK_GARMENT_IMAGE
                      }
                      alt={pairedAccessory.name}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = FALLBACK_GARMENT_IMAGE;
                      }}
                      style={{
                        width: '34px',
                        height: '42px',
                        borderRadius: '4px',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: '#1f2421',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {pairedAccessory.name}
                      </div>
                      <div style={{ fontSize: '9.5px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 600 }}>
                        +{(pairedAccessory.rentalPricePerDay || 150000).toLocaleString('vi-VN')} đ/ngày
                      </div>
                      <span
                        style={{
                          fontSize: '8px',
                          background: '#f0f5ec',
                          color: 'var(--color-gold, #5b6e4e)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          fontWeight: 600,
                          display: 'inline-block',
                          marginTop: '2px',
                        }}
                      >
                        👜 Túi xách phối kèm
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPairedAccessory(null)}
                      title="Bỏ món này"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#9ca3af',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: '2px 4px',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tabs chuyển đổi danh mục gợi ý */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              <button
                type="button"
                onClick={() => setPairingTab('outfit')}
                style={{
                  flex: 1,
                  padding: '4px 6px',
                  fontSize: '9px',
                  fontWeight: pairingTab === 'outfit' ? 700 : 500,
                  borderRadius: '4px',
                  border: pairingTab === 'outfit' ? '1px solid var(--color-gold, #5b6e4e)' : '1px solid #dce1d5',
                  background: pairingTab === 'outfit' ? 'var(--color-gold, #5b6e4e)' : '#ffffff',
                  color: pairingTab === 'outfit' ? '#ffffff' : '#4a5246',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                }}
              >
                {category === 'upper_body'
                  ? '👗 Chân váy / Quần'
                  : category === 'lower_body'
                    ? '👚 Áo / Blazer'
                    : '👗 Trang phục phối'}
                {pairedGarment && (
                  <CheckCircle2 size={10} color={pairingTab === 'outfit' ? '#fff' : 'var(--color-gold, #5b6e4e)'} />
                )}
              </button>

              <button
                type="button"
                onClick={() => setPairingTab('accessory')}
                style={{
                  flex: 1,
                  padding: '4px 6px',
                  fontSize: '9px',
                  fontWeight: pairingTab === 'accessory' ? 700 : 500,
                  borderRadius: '4px',
                  border: pairingTab === 'accessory' ? '1px solid var(--color-gold, #5b6e4e)' : '1px solid #dce1d5',
                  background: pairingTab === 'accessory' ? 'var(--color-gold, #5b6e4e)' : '#ffffff',
                  color: pairingTab === 'accessory' ? '#ffffff' : '#4a5246',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                }}
              >
                👜 Túi xách phối kèm
                {pairedAccessory && (
                  <CheckCircle2 size={10} color={pairingTab === 'accessory' ? '#fff' : 'var(--color-gold, #5b6e4e)'} />
                )}
              </button>
            </div>

            {/* Danh sách sản phẩm gợi ý cuộn ngang */}
            <div
              style={{
                display: 'flex',
                gap: '5px',
                overflowX: 'auto',
                paddingBottom: '2px',
                scrollbarWidth: 'none',
              }}
            >
              {(pairingTab === 'outfit' ? currentOutfitSuggestions : currentAccessorySuggestions)
                .slice(0, 15)
                .map((item) => {
                  const itemImg =
                    item.image || (Array.isArray(item.images) && item.images[0]) || '';
                  const isSelected = pairedGarment?._id === item._id || pairedAccessory?._id === item._id;

                  return (
                    <div
                      key={item._id || item.name}
                      onClick={() => {
                        if (pairingTab === 'outfit') {
                          if (pairedGarment?._id === item._id) {
                            setPairedGarment(null);
                          } else {
                            setPairedGarment(item);
                            setPairedGarmentSize('S');
                          }
                        } else {
                          if (pairedAccessory?._id === item._id) {
                            setPairedAccessory(null);
                          } else {
                            setPairedAccessory(item);
                          }
                        }
                      }}
                      style={{
                        flex: '0 0 68px',
                        cursor: 'pointer',
                        background: isSelected ? '#edf3e9' : '#ffffff',
                        border: isSelected
                          ? '1.5px solid var(--color-gold, #5b6e4e)'
                          : '1px solid var(--color-border, #e2e6dc)',
                        borderRadius: '5px',
                        padding: '3px',
                        textAlign: 'center',
                        position: 'relative',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 1px 4px rgba(91,110,78,0.2)' : 'none',
                      }}
                      title={`Bấm để ${isSelected ? 'bỏ chọn' : 'thêm vào set'}: ${item.name}`}
                    >
                      <img
                        src={itemImg || FALLBACK_GARMENT_IMAGE}
                        alt={item.name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = FALLBACK_GARMENT_IMAGE;
                        }}
                        style={{
                          width: '100%',
                          height: '44px',
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
                        {item.name}
                      </div>
                      <div
                        style={{
                          fontSize: '8px',
                          color: isSelected ? 'var(--color-gold, #5b6e4e)' : '#6e7569',
                          fontWeight: 700,
                        }}
                      >
                        {isSelected
                          ? '✓ Đang phối'
                          : `+ ${(item.rentalPricePerDay || 150000).toLocaleString('vi-VN')} đ`}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

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
          const mainPrice3Days =
            product?.rentalPricePer3Days ||
            (product?.rentalPricePerDay ? product.rentalPricePerDay * 3 : 1050000);
          const pairedGarmentPrice3Days = pairedGarment
            ? pairedGarment.rentalPricePer3Days ||
            (pairedGarment.rentalPricePerDay ? pairedGarment.rentalPricePerDay * 3 : 600000)
            : 0;
          const pairedAccessoryPrice3Days = pairedAccessory
            ? pairedAccessory.rentalPricePer3Days ||
            (pairedAccessory.rentalPricePerDay ? pairedAccessory.rentalPricePerDay * 3 : 300000)
            : 0;

          const totalEstimatedRental =
            mainPrice3Days + pairedGarmentPrice3Days + pairedAccessoryPrice3Days;
          const totalItems = 1 + (pairedGarment ? 1 : 0) + (pairedAccessory ? 1 : 0);

          return (
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#6e7569' }}>Thời gian thuê gợi ý: </span>
                <strong style={{ fontSize: '13px', color: '#1f2421' }}>3 Ngày</strong>
              </div>
              <div style={{ borderLeft: '1px solid var(--color-border, #e2e6dc)', paddingLeft: '20px' }}>
                <span style={{ fontSize: '10px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 600 }}>
                  {totalItems > 1 ? `Giá thuê cả set (${totalItems} món): ` : 'Giá thuê dự kiến: '}
                </span>
                <strong style={{ fontSize: '16px', color: 'var(--color-gold, #5b6e4e)' }}>
                  {totalEstimatedRental.toLocaleString('vi-VN')} đ
                </strong>
                {totalItems > 1 && (
                  <span
                    style={{
                      fontSize: '9.5px',
                      background: '#eaf2e6',
                      color: 'var(--color-gold, #5b6e4e)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      marginLeft: '8px',
                    }}
                  >
                    Set {totalItems} món hoàn chỉnh
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
            {(pairedGarment || pairedAccessory)
              ? `Đặt thuê cả set (${1 + (pairedGarment ? 1 : 0) + (pairedAccessory ? 1 : 0)} món) \u2192`
              : 'Đặt thuê sản phẩm này \u2192'}
          </button>
        </div>
      </footer>
    </div>
  );
}
