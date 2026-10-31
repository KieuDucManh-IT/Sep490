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
        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ProductVariant',
            default: null,
            index: true,
            alias: 'variant_id',
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

