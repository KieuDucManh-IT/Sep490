import mongoose from 'mongoose';

const productImageSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true,
            alias: 'product_id',
        },
        // Ảnh thuộc về một màu (dùng cho mọi size của màu đó); null = ảnh chung của sản phẩm.
        // Trường variantId cũ đã bỏ — chạy scripts/migrateProductImageColor.js để chuyển dữ liệu.
        color: {
            type: String,
            trim: true,
            default: null,
            maxlength: 80,
        },
        imageUrl: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
            alias: 'image_url',
        },
        imageType: {
            type: String,
            enum: ['MAIN', 'GALLERY', 'DETAIL'],
            default: 'GALLERY',
            uppercase: true,
            trim: true,
            alias: 'image_type',
        },
        isPrimary: {
            type: Boolean,
            default: false,
            index: true,
            alias: 'is_primary',
        },
        displayOrder: {
            type: Number,
            default: 0,
            alias: 'display_order',
        },
    },
    {
        timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

productImageSchema.index({ productId: 1, color: 1, displayOrder: 1 });

// Virtual alias cho image_id và created_at
productImageSchema.virtual('image_id').get(function () {
    return this._id;
});

productImageSchema.virtual('created_at').get(function () {
    return this.createdAt;
});

export const ProductImage =
    mongoose.models.ProductImage || mongoose.model('ProductImage', productImageSchema);

export const ProductImages = ProductImage;
export default ProductImage;

