import mongoose from 'mongoose';
import { Product } from '../models/masterdata/Product.js';
import { Category } from '../models/masterdata/Category.js';
import { ProductVariant } from '../models/masterdata/ProductVariant.js';

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
      status: { $ne: 'inactive' },
    };

    // Search
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

    // Type filter (Cho thuê / Mua đồ cũ)
    if (type && type !== 'all') {
      if (type === 'rental') {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { productType: { $in: ['rental', 'both'] } },
            { tag: { $in: ['rental', 'both'] } },
          ],
        });
      } else if (type === 'sale') {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { productType: { $in: ['sale', 'both'] } },
            { tag: { $in: ['sale', 'both'] } },
          ],
        });
      }
    }

    // Category filter
    if (category && category !== 'all' && category !== 'Tất cả') {
      const categoryList = Array.isArray(category)
        ? category
        : category.split(',').map((c) => c.trim()).filter(Boolean);

      if (categoryList.length > 0) {
        const objectIdList = categoryList
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));

        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { categoryId: { $in: objectIdList } },
            { category: { $in: categoryList } },
            { name: { $in: categoryList.map((c) => new RegExp(c, 'i')) } },
          ],
        });
      }
    }

    // Price range
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

    // Sizes
    if (sizes) {
      const sizeList = Array.isArray(sizes)
        ? sizes
        : sizes.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (sizeList.length > 0) {
        query.sizes = { $in: sizeList };
      }
    }

    // Colors
    if (colors) {
      const colorList = Array.isArray(colors)
        ? colors
        : colors.split(',').map((c) => c.trim()).filter(Boolean);
      if (colorList.length > 0) {
        query.colors = { $in: colorList };
      }
    }

    // Condition
    if (condition) {
      const conditionList = Array.isArray(condition)
        ? condition
        : condition.split(',').map((c) => c.trim()).filter(Boolean);
      if (conditionList.length > 0) {
        query.condition = { $in: conditionList };
      }
    }

    // AI Try-On
    if (aiTryOn === 'true' || aiTryOn === true) {
      query.aiTryOn = true;
    }

    // Sorting
    let sortObj = { createdAt: -1 };
    if (sort === 'price_asc') {
      sortObj = { rentalPricePer3Days: 1, salePrice: 1 };
    } else if (sort === 'price_desc') {
      sortObj = { rentalPricePer3Days: -1, salePrice: -1 };
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

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('categoryId')
        .populate('shopId')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let product = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id)
        .populate('categoryId')
        .populate('shopId')
        .lean();
    }

    if (!product) {
      product = await Product.findOne({
        $or: [{ productCode: id }, { sku: id }],
        isDeleted: { $ne: true },
      })
        .populate('categoryId')
        .populate('shopId')
        .lean();
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
    }

    // Also fetch product variants if any
    const variants = await ProductVariant.find({ productId: product._id, status: 'active' }).lean();

    res.json({
      success: true,
      data: {
        ...product,
        variants,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getFilterMeta = async (req, res, next) => {
  try {
    const [categories, products] = await Promise.all([
      Category.find({ status: 'active' }).lean(),
      Product.find({ isDeleted: { $ne: true }, status: 'active' }).lean(),
    ]);

    // Aggregate category counts
    const categoryCounts = {};
    categories.forEach((cat) => {
      categoryCounts[cat.name] = 0;
    });

    // Counts for sizes and conditions
    const sizeCounts = { S: 0, M: 0, L: 0, XL: 0 };
    const conditionCounts = { new_99: 0, very_good: 0, good: 0 };

    products.forEach((p) => {
      // Category count
      if (p.category && Array.isArray(p.category)) {
        p.category.forEach((c) => {
          categoryCounts[c] = (categoryCounts[c] || 0) + 1;
        });
      }
      if (p.categoryId && p.categoryId.name) {
        categoryCounts[p.categoryId.name] = (categoryCounts[p.categoryId.name] || 0) + 1;
      }

      // Sizes count
      if (p.sizes && Array.isArray(p.sizes)) {
        p.sizes.forEach((s) => {
          const upper = String(s).toUpperCase();
          if (sizeCounts[upper] !== undefined) {
            sizeCounts[upper]++;
          }
        });
      }

      // Condition count
      if (p.condition) {
        if (conditionCounts[p.condition] !== undefined) {
          conditionCounts[p.condition]++;
        }
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
        conditionCounts,
        totalProducts: products.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

