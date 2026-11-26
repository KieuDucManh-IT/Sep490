import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, X, Sparkles, Download } from 'lucide-react';
import '../../styles/PhotoTryOn.css';
import tryOnApi from '../../services/tryOnApi';
import productService from '../../services/productService';
import wardrobeApi from '../../services/wardrobeApi';
import TryOnModelUploader from '../../components/tryon/TryOnModelUploader';
import TryOnStageViewer from '../../components/tryon/TryOnStageViewer';
import TryOnProductSelector from '../../components/tryon/TryOnProductSelector';
import TryOnOutfitPairing from '../../components/tryon/TryOnOutfitPairing';
import TryOnBottomBar from '../../components/tryon/TryOnBottomBar';
import TryOnPhotoGuideModal from '../../components/tryon/TryOnPhotoGuideModal';

export default function PhotoTryOnPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef(null);
  const handledPairedParamRef = useRef('');

  const productParam = searchParams.get('product') || searchParams.get('productId');
  const pairedParam = searchParams.get('paired') || searchParams.get('pairedId') || searchParams.get('bottomId');

  // Product state - khởi tạo null, tải sản phẩm thật 100% từ cơ sở dữ liệu
  const [product, setProduct] = useState(null);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [productCategoryTab, setProductCategoryTab] = useState('all');

  // Paired outfit (quần/váy/áo) ghép cùng trang phục chính bằng AI IDM-VTON
  const [pairedGarment, setPairedGarment] = useState(null);
  const [pairedGarmentSize, setPairedGarmentSize] = useState('S');

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

  const isAccessory = (item) => {
    if (!item) return false;
    if (isJewelry(item)) return true;
    const text = `${item.name || ''} ${
      Array.isArray(item.category) ? item.category.join(' ') : item.category || ''
    }`.toLowerCase();
    return /túi|tui|bag|kính|kinh|glasses|khăn|khan|scarf|giày|giay|shoes|cao gót|sneaker|boot|sandal|phụ kiện|accessory|nón|mũ|hat|clutch|thắt lưng|that lung|belt|cà vạt|ca vat|tie/.test(
      text
    );
  };

  // Sample Models & User Photo state
  const [sampleModels, setSampleModels] = useState([]);
  const [userUploadedFile, setUserUploadedFile] = useState(null);
  const [activeModelImage, setActiveModelImage] = useState('');
  const [hasPhotoConsent, setHasPhotoConsent] = useState(false);

  // Options & Try-On State
  const [selectedSize, setSelectedSize] = useState('S');
  const [selectedColor, setSelectedColor] = useState('');
  const [pairedGarmentColor, setPairedGarmentColor] = useState('');
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
  const [showPhotoGuideModal, setShowPhotoGuideModal] = useState(false);

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

        // Lọc bỏ 100% trang sức (nhẫn, bông tai, vòng...)
        list = list.filter((item) => !isJewelry(item));
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
          setSelectedColor(Array.isArray(firstProd.colors) && firstProd.colors.length > 0 ? firstProd.colors[0] : '');
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
          setSelectedColor(Array.isArray(prodData.colors) && prodData.colors.length > 0 ? prodData.colors[0] : '');
        }
      })
      .catch((err) => {
        console.warn('Không thể tải chi tiết sản phẩm:', err.message);
      });
  }, [productParam, product?._id]);

  // 2.1. Fetch chi tiết món phối kèm nếu có pairedParam trên URL (từ AI Stylist chuyển sang)
  useEffect(() => {
    if (!pairedParam) {
      handledPairedParamRef.current = '';
      return;
    }
    // Chỉ nạp 1 lần cho mỗi URL param, không tự nạp lại khi người dùng đã chủ động bỏ chọn
    if (handledPairedParamRef.current === pairedParam) return;
    handledPairedParamRef.current = pairedParam;

    productService
      .getProductById(pairedParam)
      .then((res) => {
        const prodData = res?.data || res;
        if (prodData && prodData.name) {
          // Bỏ qua trang sức
          if (isJewelry(prodData)) {
            console.warn('Bỏ qua món phối không hợp lệ (trang sức):', prodData.name);
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('paired');
              next.delete('pairedId');
              next.delete('bottomId');
              return next;
            }, { replace: true });
            return;
          }
          setPairedGarment(prodData);
          const pSizes = Array.isArray(prodData.sizes) && prodData.sizes.length > 0 ? prodData.sizes : ['S', 'M', 'L'];
          setPairedGarmentSize(pSizes[0] || 'S');
          setPairedGarmentColor(Array.isArray(prodData.colors) && prodData.colors.length > 0 ? prodData.colors[0] : '');
        }
      })
      .catch((err) => {
        console.warn('Không thể tải món phối kèm từ URL:', err.message);
      });
  }, [pairedParam, setSearchParams]);

  // Hàm gỡ bỏ món phối trang phục
  const handleRemovePairedGarment = () => {
    setPairedGarment(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('paired');
      next.delete('pairedId');
      next.delete('bottomId');
      return next;
    }, { replace: true });
  };

  const handleClearAllPaired = () => {
    setPairedGarment(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('paired');
      next.delete('pairedId');
      next.delete('bottomId');
      return next;
    }, { replace: true });
  };

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
    setSelectedColor(Array.isArray(selectedProd.colors) && selectedProd.colors.length > 0 ? selectedProd.colors[0] : '');

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

  // Phân loại danh mục sản phẩm gợi ý thông minh từ cơ sở dữ liệu thật (chỉ lấy quần áo, loại bỏ phụ kiện)
  const topCatalogProducts = useMemo(() => {
    return catalogProducts.filter((item) => {
      if (item._id === product?._id) return false;
      if (isAccessory(item)) return false;
      const catStr = (`${item.name || ''} ${(Array.isArray(item.category) ? item.category.join(' ') : (item.category || ''))}`).toLowerCase();
      return /(^|[\s_-])(áo|ao|sơ mi|so mi|vest|blazer|shirt|jacket|coat|hoodie|sweater)([\s_-]|$)/i.test(catStr) && !/áo dài|ao dai/.test(catStr);
    });
  }, [catalogProducts, product?._id]);

  const bottomCatalogProducts = useMemo(() => {
    return catalogProducts.filter((item) => {
      if (item._id === product?._id) return false;
      if (isAccessory(item)) return false;
      const catStr = (`${item.name || ''} ${(Array.isArray(item.category) ? item.category.join(' ') : (item.category || ''))}`).toLowerCase();
      return /quần|quan|chân váy|chan vay|skirt|pants|trouser|short/.test(catStr);
    });
  }, [catalogProducts, product?._id]);

  const accessoryCatalogProducts = useMemo(() => {
    return catalogProducts.filter((item) => {
      if (item._id === product?._id) return false;
      if (isJewelry(item)) return false;
      return isAccessory(item);
    });
  }, [catalogProducts, product?._id]);

  const dressCatalogProducts = useMemo(() => {
    return catalogProducts.filter((item) => {
      if (item._id === product?._id) return false;
      if (isAccessory(item)) return false;
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
    return list.filter((p) => p && p._id !== product?._id && !isAccessory(p));
  }, [category, bottomCatalogProducts, topCatalogProducts, dressCatalogProducts, product?._id]);

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

    if (category === 'accessories') {
      setErrorMessage(
        'Phụ kiện (Túi xách, Giày, Kính...) là món phối hoàn thiện phong cách (Complete The Look). Vui lòng chọn trang phục chính (Đầm, Áo, hoặc Quần/Chân váy) để AI ướm thử phom dáng lên cơ thể!'
      );
      return;
    }

    const garmentImg =
      (selectedColor && product?.colorImages?.[selectedColor]) ||
      product?.primaryImageUrl ||
      product?.imageUrl ||
      product?.image ||
      (Array.isArray(product?.images) && product.images[0]) ||
      FALLBACK_GARMENT_IMAGE;

    setErrorMessage('');
    setSuccessMessage('');
    setIsGenerating(true);

    const totalSetItems = 1 + (pairedGarment ? 1 : 0);

    setGenerationStep(
      totalSetItems === 2
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
        totalSetItems === 2
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

      formData.append('garmentImageUrl', garmentImg);
      formData.append('garmentDescription', product?.name || 'luxury clothing');
      formData.append('category', category);
      formData.append('crop', String(autoCrop));

      if (selectedColor) {
        formData.append('color', selectedColor);
        formData.append('selectedColor', selectedColor);
      }

      // 1. Trang phục phối kèm (Quần / Chân váy hoặc Áo / Blazer)
      if (pairedGarment) {
        const pairedImg =
          (pairedGarmentColor && pairedGarment?.colorImages?.[pairedGarmentColor]) ||
          pairedGarment.primaryImageUrl ||
          pairedGarment.imageUrl ||
          pairedGarment.image ||
          (Array.isArray(pairedGarment.images) && pairedGarment.images[0]) ||
          FALLBACK_GARMENT_IMAGE;
        if (pairedImg) {
          const pairedCat =
            category === 'upper_body' ? 'lower_body' : category === 'lower_body' ? 'upper_body' : 'upper_body';
          formData.append('pairedGarmentImageUrl', pairedImg);
          formData.append('pairedGarmentDescription', pairedGarment.name || 'trang phục phối');
          formData.append('pairedGarmentCategory', pairedCat);
          if (pairedGarmentColor) {
            formData.append('pairedGarmentColor', pairedGarmentColor);
            formData.append('bottomGarmentColor', pairedGarmentColor);
          }
          // Tương thích ngược
          formData.append('bottomGarmentImageUrl', pairedImg);
          formData.append('bottomGarmentDescription', pairedGarment.name || 'trang phục phối');
        }
        if (pairedGarment._id) {
          formData.append('pairedGarmentId', pairedGarment._id);
          formData.append('bottomProductId', pairedGarment._id);
        }
      }

      const response = await tryOnApi.generate(formData);

      if (response?.data?.resultImageUrl || response?.resultImageUrl) {
        const finalUrl = response.data?.resultImageUrl || response.resultImageUrl;
        setResultImage(finalUrl);
        setLastSavedImageUrl(''); // Reset trạng thái lưu khi có ảnh ghép mới
        setShowOriginal(false);
        setSuccessMessage(
          totalSetItems === 2
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

  // UC-64: Download ảnh kết quả try-on về máy (WBS yêu cầu "download the resulting images")
  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `vestora-tryon-${Date.now()}.jpg`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
      const isCombo = Boolean(pairedGarment);
      const totalItems = 1 + (pairedGarment ? 1 : 0);

      const titleParts = [product?.name];
      if (pairedGarment?.name) titleParts.push(pairedGarment.name);

      const payload = {
        productId: product?._id || null,
        productCode: product?.productCode || '',
        title: isCombo ? `Set đồ: ${titleParts.join(' + ')}` : (product?.name || 'Trang phục thử đồ AI'),
        image: garmentImageUrl,
        tryOnImageUrl: resultImage,
        category: isCombo
          ? `Set phối ${totalItems} món`
          : (Array.isArray(product?.category) ? product.category[0] : product?.category) || 'Thời trang cao cấp',
        price: (product?.rentalPricePerDay || 0) + (pairedGarment?.rentalPricePerDay || 0),
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
    (selectedColor && product?.colorImages?.[selectedColor]) ||
    product?.primaryImageUrl ||
    product?.imageUrl ||
    product?.image ||
    (Array.isArray(product?.images) && product.images[0]) ||
    FALLBACK_GARMENT_IMAGE;

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

      {/* Top Header Bar - Duy nhất 1 thanh điều hướng tinh gọn */}
      <header className="tryon-header-bar">
        <button
          onClick={() => {
            if (product?._id && product._id !== 'sample-001') {
              navigate(`/product/${product._id}`);
            } else {
              navigate('/');
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#6e7569',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontWeight: 500,
            padding: 0,
          }}
        >
          &larr; Quay lại sản phẩm
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link
            to="/"
            style={{
              fontFamily: 'var(--font-title, sans-serif)',
              fontSize: '17px',
              letterSpacing: '2px',
              color: 'var(--color-text-primary, #1f2421)',
              textDecoration: 'none',
              fontWeight: 800,
            }}
          >
            VESTORA
          </Link>
          <span style={{ color: '#d2d8ce' }}>|</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-gold, #5b6e4e)', letterSpacing: '0.6px' }}>
            PHÒNG THỬ ĐỒ ẢO AI — CÔNG NGHỆ IDM-VTON
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#4a5246',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 0,
            }}
            title="Đóng phòng thử"
          >
            <X size={16} />
          </button>
        </div>
      </header>

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
        <TryOnModelUploader
          userUploadedFile={userUploadedFile}
          activeModelImage={activeModelImage}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          onResetUserPhoto={handleResetUserPhoto}
          onOpenGuideModal={() => setShowPhotoGuideModal(true)}
        />

        {/* CENTER PANEL: Real-time 3D AR Stage - Dual Split View */}
        <TryOnStageViewer
          product={product}
          userUploadedFile={userUploadedFile}
          activeModelImage={activeModelImage}
          resultImage={resultImage}
          isGenerating={isGenerating}
          generationStep={generationStep}
          pairedGarment={pairedGarment}
          pairedGarmentSize={pairedGarmentSize}
          selectedSize={selectedSize}
          category={category}
          fallbackImage={FALLBACK_GARMENT_IMAGE}
        />

        {/* RIGHT PANEL: Step 2 Item Selection & Adjustments */}
        <div className="panel-dark-box">
          <TryOnProductSelector
            product={product}
            displayedCatalogProducts={displayedCatalogProducts}
            productCategoryTabs={productCategoryTabs}
            productCategoryTab={productCategoryTab}
            catalogLoading={catalogLoading}
            category={category}
            selectedSize={selectedSize}
            selectedColor={selectedColor}
            onSelectColor={setSelectedColor}
            garmentImageUrl={garmentImageUrl}
            fallbackImage={FALLBACK_GARMENT_IMAGE}
            onSelectProduct={handleSelectProduct}
            onSelectCategoryTab={setProductCategoryTab}
            onChangeCategory={setCategory}
            onSelectSize={setSelectedSize}
          />

          <TryOnOutfitPairing
            pairedGarment={pairedGarment}
            setPairedGarment={setPairedGarment}
            pairedGarmentSize={pairedGarmentSize}
            setPairedGarmentSize={setPairedGarmentSize}
            pairedGarmentColor={pairedGarmentColor}
            setPairedGarmentColor={setPairedGarmentColor}
            handleRemovePairedGarment={handleRemovePairedGarment}
            handleClearAllPaired={handleClearAllPaired}
            category={category}
            currentOutfitSuggestions={currentOutfitSuggestions}
            currentAccessorySuggestions={currentAccessorySuggestions}
            fallbackGarmentImage={FALLBACK_GARMENT_IMAGE}
            autoCrop={autoCrop}
            setAutoCrop={setAutoCrop}
            hasPhotoConsent={hasPhotoConsent}
            setHasPhotoConsent={setHasPhotoConsent}
            setErrorMessage={setErrorMessage}
            handleGenerateTryOn={handleGenerateTryOn}
            isGenerating={isGenerating}
          />
        </div>
      </div>

      {/* Bottom Fixed Action Bar */}
      <TryOnBottomBar
        product={product}
        pairedGarment={pairedGarment}
        resultImage={resultImage}
        lastSavedImageUrl={lastSavedImageUrl}
        isSavingWardrobe={isSavingWardrobe}
        onSaveToWardrobe={handleSaveToWardrobe}
        onDownload={handleDownload}
      />

      {/* POPUP MODAL: Mẹo chọn ảnh chuẩn để AI ghép đẹp nhất */}
      <TryOnPhotoGuideModal
        isOpen={showPhotoGuideModal}
        onClose={() => setShowPhotoGuideModal(false)}
        onUploadClick={() => fileInputRef.current?.click()}
      />
    </div>
  );
}
