import mongoose from 'mongoose';
import { Product } from '../models/masterdata/Product.js';
import { Category } from '../models/masterdata/Category.js';
import { ProductVariant } from '../models/masterdata/ProductVariant.js';
import { Shop } from '../models/Shop.js';

/**
 * Lấy danh sách sản phẩm theo bộ lọc, tìm kiếm, phân trang và sắp xếp
 * Endpoint: GET /api/products
 * 100% dữ liệu thực từ MongoDB Atlas, không sử dụng mock data.
 */
export const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      type, // 'all', 'rental', 'sale'
      category,
      minPrice,
      maxPrice,
      sizes,
      colors,
      condition,
      aiTryOn,
      sort = 'newest',
      page = 1,
      limit = 12,
    } = req.query;

    const query = {
      isDeleted: { $ne: true },
      status: { $nin: ['inactive', 'INACTIVE', 'discontinued', 'DISCONTINUED'] },
    };

    // Tìm kiếm theo từ khóa
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { brand: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { sku: searchRegex },
        { productCode: searchRegex },
      ];
    }

    // Lọc theo hình thức: Cho thuê (rental) / Mua bán (sale) / Tất cả
    if (type && type !== 'all') {
      query.$and = query.$and || [];
      if (type === 'rental') {
        query.$and.push({
          $or: [
            { productType: { $in: ['rental', 'both', 'RENTAL', 'BOTH'] } },
            { tag: { $in: ['rental', 'both', 'RENTAL', 'BOTH'] } },
            { rentalPricePerDay: { $gt: 0 } },
            { rentalPricePer3Days: { $gt: 0 } },
          ],
        });
      } else if (type === 'sale') {
        query.$and.push({
          $or: [
            { productType: { $in: ['sale', 'both', 'SALE', 'BOTH'] } },
            { tag: { $in: ['sale', 'both', 'SALE', 'BOTH'] } },
            { salePrice: { $gt: 0 } },
          ],
        });
      }
    }

    // Lọc theo danh mục
    if (category && category !== 'all' && category !== 'Tất cả') {
      const categoryList = Array.isArray(category)
        ? category
        : category.split(',').map((c) => c.trim()).filter(Boolean);

      if (categoryList.length > 0) {
        const objectIdList = categoryList
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));

        // Tìm thêm danh mục theo tên trong bảng Category
        let matchedCategoryIds = [];
        try {
          const matchedCats = await Category.find({
            name: { $in: categoryList.map((c) => new RegExp(`^${c}$`, 'i')) },
          }).select('_id').lean();
          matchedCategoryIds = matchedCats.map((c) => c._id);
        } catch (_) {}

        const allTargetCategoryIds = [...objectIdList, ...matchedCategoryIds];

        query.$and = query.$and || [];
        const catOrConditions = [
          { category: { $in: categoryList } },
          { category: { $in: categoryList.map((c) => new RegExp(c, 'i')) } },
          { name: { $in: categoryList.map((c) => new RegExp(c, 'i')) } },
        ];

        if (allTargetCategoryIds.length > 0) {
          catOrConditions.push({ categoryId: { $in: allTargetCategoryIds } });
        }

        query.$and.push({ $or: catOrConditions });
      }
    }

    // Lọc theo khoảng giá
    const parsedMinPrice = minPrice ? Number(minPrice) : null;
    const parsedMaxPrice = maxPrice ? Number(maxPrice) : null;
    if (parsedMinPrice !== null || parsedMaxPrice !== null) {
      const priceConditions = [];
      const makeRange = (field) => {
        const cond = {};
        if (parsedMinPrice !== null) cond.$gte = parsedMinPrice;
        if (parsedMaxPrice !== null) cond.$lte = parsedMaxPrice;
        return { [field]: cond };
      };

      priceConditions.push(makeRange('rentalPricePer3Days'));
      priceConditions.push(makeRange('rentalPricePerDay'));
      priceConditions.push(makeRange('salePrice'));

      query.$and = query.$and || [];
      query.$and.push({ $or: priceConditions });
    }

    // Lọc theo kích cỡ (sizes)
    if (sizes) {
      const sizeList = Array.isArray(sizes)
        ? sizes
        : sizes.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (sizeList.length > 0) {
        query.sizes = { $in: sizeList };
      }
    }

    // Lọc theo màu sắc (colors)
    if (colors) {
      const colorList = Array.isArray(colors)
        ? colors
        : colors.split(',').map((c) => c.trim()).filter(Boolean);
      if (colorList.length > 0) {
        query.colors = { $in: colorList };
      }
    }

    // Lọc theo tình trạng (condition)
    if (condition) {
      const conditionList = Array.isArray(condition)
        ? condition
        : condition.split(',').map((c) => c.trim()).filter(Boolean);
      if (conditionList.length > 0) {
        query.condition = { $in: conditionList };
      }
    }

    // Lọc hỗ trợ thử đồ AI
    if (aiTryOn === 'true' || aiTryOn === true) {
      query.aiTryOn = true;
    }

    // Cấu hình sắp xếp
    let sortObj = { createdAt: -1 };
    if (sort === 'price_asc') {
      sortObj = { rentalPricePer3Days: 1, rentalPricePerDay: 1, salePrice: 1 };
    } else if (sort === 'price_desc') {
      sortObj = { rentalPricePer3Days: -1, rentalPricePerDay: -1, salePrice: -1 };
    } else if (sort === 'rating') {
      sortObj = { rating: -1, reviewsCount: -1 };
    } else if (sort === 'popular') {
      sortObj = { reviewsCount: -1, rating: -1 };
    } else if (sort === 'newest') {
      sortObj = { createdAt: -1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);
    const skip = (pageNum - 1) * limitNum;

    let products = [];
    let total = 0;

    try {
      [products, total] = await Promise.all([
        Product.find(query)
          .populate('categoryId')
          .populate('shopId')
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Product.countDocuments(query),
      ]);
    } catch (popErr) {
      console.warn('Populate lỗi, fallback về truy vấn không populate:', popErr.message);
      [products, total] = await Promise.all([
        Product.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Product.countDocuments(query),
      ]);
    }

    // Lấy variants từ database để làm giàu thông tin sản phẩm
    const productIds = products.map((p) => p._id);
    let variants = [];
    try {
      variants = await ProductVariant.find({
        productId: { $in: productIds },
        status: { $nin: ['inactive', 'INACTIVE'] },
      }).lean();
    } catch (varErr) {
      console.warn('Lỗi lấy variants:', varErr.message);
    }

    const variantsByProduct = {};
    variants.forEach((v) => {
      const pid = String(v.productId);
      if (!variantsByProduct[pid]) variantsByProduct[pid] = [];
      variantsByProduct[pid].push(v);
    });

    // Chuẩn hóa dữ liệu 100% dựa trên database thật, tuyệt đối không dùng mock data
    const enrichedProducts = products.map((p) => {
      const pVariants = variantsByProduct[String(p._id)] || [];

      // Kích cỡ thực tế từ product hoặc variants
      const sizesSet = new Set(Array.isArray(p.sizes) ? p.sizes : []);
      pVariants.forEach((v) => {
        if (v.size) sizesSet.add(String(v.size));
      });
      const finalSizes = Array.from(sizesSet);

      // Màu sắc thực tế từ product hoặc variants
      const colorsSet = new Set(Array.isArray(p.colors) ? p.colors : []);
      pVariants.forEach((v) => {
        if (v.color) colorsSet.add(String(v.color));
      });
      const finalColors = Array.from(colorsSet);

      // Giá thuê thực tế
      let rentalPricePerDay = p.rentalPricePerDay || 0;
      let rentalPricePer3Days = p.rentalPricePer3Days || 0;
      if (!rentalPricePerDay && pVariants.length > 0) {
        const variantPrices = pVariants.map((v) => v.rentalPricePerDay).filter(Boolean);
        if (variantPrices.length > 0) rentalPricePerDay = Math.min(...variantPrices);
      }
      if (!rentalPricePer3Days && rentalPricePerDay) {
        rentalPricePer3Days = rentalPricePerDay * 3;
      }

      // Giá bán thực tế
      let salePrice = p.salePrice || 0;
      if (!salePrice && pVariants.length > 0) {
        const variantSales = pVariants.map((v) => v.salePrice).filter(Boolean);
        if (variantSales.length > 0) salePrice = Math.min(...variantSales);
      }

      // Tiền cọc thực tế
      let deposit = p.deposit || 0;
      if (!deposit && pVariants.length > 0) {
        const variantDeposits = pVariants.map((v) => v.depositAmount).filter(Boolean);
        if (variantDeposits.length > 0) deposit = Math.min(...variantDeposits);
      }

      // Hình ảnh thực tế từ database
      let images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
      if (images.length === 0 && p.image) {
        images = [p.image];
      }

      // Tên danh mục thực tế
      const categoryName =
        p.categoryId?.name ||
        (Array.isArray(p.category) && p.category.length > 0 ? p.category[0] : null) ||
        '';

      return {
        ...p,
        variants: pVariants,
        sizes: finalSizes,
        colors: finalColors,
        rentalPricePerDay,
        rentalPricePer3Days,
        salePrice,
        deposit,
        images,
        categoryName,
        rating: typeof p.rating === 'number' ? p.rating : null,
        reviewsCount: typeof p.reviewsCount === 'number' ? p.reviewsCount : 0,
        inStock:
          p.inStock !== false &&
          (pVariants.length === 0 || pVariants.some((v) => v.status !== 'inactive')),
      };
    });

    res.json({
      success: true,
      data: enrichedProducts,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error('Lỗi getProducts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy danh sách sản phẩm',
      data: [],
      pagination: {
        total: 0,
        page: 1,
        totalPages: 1,
        limit: 12,
      },
    });
  }
};

/**
 * Lấy chi tiết sản phẩm theo ID hoặc mã sản phẩm / sku
 * Endpoint: GET /api/products/:id
 */
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let product = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      try {
        product = await Product.findById(id)
          .populate('categoryId')
          .populate('shopId')
          .lean();
      } catch (e) {
        product = await Product.findById(id).lean();
      }
    }

    if (!product) {
      try {
        product = await Product.findOne({
          $or: [{ productCode: id }, { sku: id }],
          isDeleted: { $ne: true },
        })
          .populate('categoryId')
          .populate('shopId')
          .lean();
      } catch (e) {
        product = await Product.findOne({
          $or: [{ productCode: id }, { sku: id }],
          isDeleted: { $ne: true },
        }).lean();
      }
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    }

    let variants = [];
    try {
      variants = await ProductVariant.find({
        productId: product._id,
        status: { $nin: ['inactive', 'INACTIVE'] },
      }).lean();
    } catch (e) {
      console.warn('Lỗi lấy variants:', e.message);
    }

    res.json({
      success: true,
      data: {
        ...product,
        variants,
      },
    });
  } catch (error) {
    console.error('Lỗi getProductById:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi lấy chi tiết sản phẩm' });
  }
};

/**
 * Lấy danh sách danh mục và số lượng phục vụ bộ lọc sidebar
 * Endpoint: GET /api/products/meta/filters
 * 100% dữ liệu thực từ MongoDB Atlas.
 */
export const getFilterMeta = async (req, res, next) => {
  try {
    const [categories, products, variants] = await Promise.all([
      Category.find({ status: { $nin: ['inactive', 'INACTIVE'] } }).lean(),
      Product.find({ isDeleted: { $ne: true }, status: { $nin: ['inactive', 'INACTIVE'] } })
        .populate('categoryId')
        .lean(),
      ProductVariant.find({ status: { $nin: ['inactive', 'INACTIVE'] } }).lean(),
    ]);

    const categoryCounts = {};
    categories.forEach((cat) => {
      if (cat?.name) {
        categoryCounts[cat.name] = 0;
      }
    });

    const sizeCounts = {};
    const colorCounts = {};
    const conditionCounts = {};

    products.forEach((p) => {
      // Đếm theo danh mục
      if (p.categoryId?.name) {
        categoryCounts[p.categoryId.name] = (categoryCounts[p.categoryId.name] || 0) + 1;
      } else if (p.category && Array.isArray(p.category)) {
        p.category.forEach((c) => {
          if (c) categoryCounts[c] = (categoryCounts[c] || 0) + 1;
        });
      }

      // Đếm theo kích cỡ
      if (Array.isArray(p.sizes)) {
        p.sizes.forEach((s) => {
          if (s) {
            const sz = String(s).toUpperCase();
            sizeCounts[sz] = (sizeCounts[sz] || 0) + 1;
          }
        });
      }

      // Đếm theo màu sắc
      if (Array.isArray(p.colors)) {
        p.colors.forEach((c) => {
          if (c) {
            colorCounts[c] = (colorCounts[c] || 0) + 1;
          }
        });
      }

      // Đếm theo tình trạng
      if (p.condition) {
        conditionCounts[p.condition] = (conditionCounts[p.condition] || 0) + 1;
      }
    });

    // Bổ sung kích cỡ và màu sắc từ bảng ProductVariant
    variants.forEach((v) => {
      if (v.size) {
        const sz = String(v.size).toUpperCase();
        sizeCounts[sz] = (sizeCounts[sz] || 0) + 1;
      }
      if (v.color) {
        colorCounts[v.color] = (colorCounts[v.color] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: {
        categories: categories.map((c) => ({
          _id: c._id,
          name: c.name,
          count: categoryCounts[c.name] || 0,
        })),
        categoryCounts,
        sizeCounts,
        colorCounts,
        conditionCounts,
        totalProducts: products.length,
      },
    });
  } catch (error) {
    console.error('Lỗi getFilterMeta:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy thông tin bộ lọc',
      data: {
        categories: [],
        categoryCounts: {},
        sizeCounts: {},
        colorCounts: {},
        conditionCounts: {},
        totalProducts: 0,
      },
    });
  }
};
