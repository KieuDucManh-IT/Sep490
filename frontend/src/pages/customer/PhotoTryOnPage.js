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
  const handledAccessoryParamRef = useRef('');

  const productParam = searchParams.get('product') || searchParams.get('productId');
  const pairedParam = searchParams.get('paired') || searchParams.get('pairedId') || searchParams.get('bottomId');
  const accessoryParam = searchParams.get('accessory') || searchParams.get('accessoryId');

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
        }
      })
      .catch((err) => {
        console.warn('Không thể tải món phối kèm từ URL:', err.message);
      });
  }, [pairedParam, setSearchParams]);

  // 2.2. Fetch chi tiết phụ kiện nếu có accessoryParam trên URL (từ AI Stylist chuyển sang)
  useEffect(() => {
    if (!accessoryParam) {
      handledAccessoryParamRef.current = '';
      return;
    }
    // Chỉ nạp 1 lần cho mỗi URL param, không tự nạp lại khi người dùng đã chủ động bỏ chọn
    if (handledAccessoryParamRef.current === accessoryParam) return;
    handledAccessoryParamRef.current = accessoryParam;

    productService
      .getProductById(accessoryParam)
      .then((res) => {
        const prodData = res?.data || res;
        if (prodData && prodData.name) {
          // Bỏ qua trang sức
          if (isJewelry(prodData)) {
            console.warn('Bỏ qua phụ kiện không hợp lệ (trang sức):', prodData.name);
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('accessory');
              next.delete('accessoryId');
              return next;
            }, { replace: true });
            return;
          }
          setPairedAccessory(prodData);
        }
      })
      .catch((err) => {
        console.warn('Không thể tải phụ kiện phối kèm từ URL:', err.message);
      });
  }, [accessoryParam, setSearchParams]);

  // Các hàm gỡ bỏ món phối - xóa sạch cả state lẫn URL param để không bị load lại
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

  const handleRemovePairedAccessory = () => {
    setPairedAccessory(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('accessory');
      next.delete('accessoryId');
      return next;
    }, { replace: true });
  };

  const handleClearAllPaired = () => {
    setPairedGarment(null);
    setPairedAccessory(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('paired');
      next.delete('pairedId');
      next.delete('bottomId');
      next.delete('accessory');
      next.delete('accessoryId');
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
      if (isJewelry(item)) return false;
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

    if (category === 'accessories') {
      setErrorMessage(
        'Phụ kiện (Túi xách, Giày, Kính...) là món phối hoàn thiện phong cách (Complete The Look). Vui lòng chọn trang phục chính (Đầm, Áo, hoặc Quần/Chân váy) để AI ướm thử phom dáng lên cơ thể!'
      );
      return;
    }

    const garmentImg =
      product?.primaryImageUrl ||
      product?.imageUrl ||
      product?.image ||
      (Array.isArray(product?.images) && product.images[0]) ||
      FALLBACK_GARMENT_IMAGE;

    setErrorMessage('');
    setSuccessMessage('');
    setIsGenerating(true);

    const pairedCount = (pairedGarment ? 1 : 0) + (pairedAccessory ? 1 : 0);
    const totalSetItems = 1 + pairedCount;

    setGenerationStep(
      totalSetItems === 3
        ? 'Đang chuẩn bị ghép set 3 món hoàn chỉnh: Món chính + Trang phục phối + Phụ kiện thời trang...'
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
          ? 'Bước 2 & 3: Đang ghép tiếp trang phục phối và hoàn thiện Lookbook...'
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

      formData.append('garmentImageUrl', garmentImg);
      formData.append('garmentDescription', product?.name || 'luxury clothing');
      formData.append('category', category);
      formData.append('crop', String(autoCrop));

      // 1. Trang phục phối kèm (Quần / Chân váy hoặc Áo / Blazer)
      if (pairedGarment) {
        const pairedImg =
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
          // Tương thích ngược
          formData.append('bottomGarmentImageUrl', pairedImg);
          formData.append('bottomGarmentDescription', pairedGarment.name || 'trang phục phối');
        }
        if (pairedGarment._id) {
          formData.append('pairedGarmentId', pairedGarment._id);
          formData.append('bottomProductId', pairedGarment._id);
        }
      }

      // 2. Phụ kiện phối kèm (Túi xách, Giày, Kính mắt...)
      if (pairedAccessory) {
        const accImg =
          pairedAccessory.primaryImageUrl ||
          pairedAccessory.imageUrl ||
          pairedAccessory.image ||
          (Array.isArray(pairedAccessory.images) && pairedAccessory.images[0]) ||
          FALLBACK_GARMENT_IMAGE;
        if (accImg) {
          formData.append('accessoryGarmentImageUrl', accImg);
          formData.append('accessoryGarmentDescription', pairedAccessory.name || 'phụ kiện thời trang');
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
          pairedAccessory={pairedAccessory}
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
            handleRemovePairedGarment={handleRemovePairedGarment}
            pairedAccessory={pairedAccessory}
            setPairedAccessory={setPairedAccessory}
            handleRemovePairedAccessory={handleRemovePairedAccessory}
            handleClearAllPaired={handleClearAllPaired}
            category={category}
            pairingTab={pairingTab}
            setPairingTab={setPairingTab}
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
        pairedAccessory={pairedAccessory}
        resultImage={resultImage}
        lastSavedImageUrl={lastSavedImageUrl}
        isSavingWardrobe={isSavingWardrobe}
        onSaveToWardrobe={handleSaveToWardrobe}
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
