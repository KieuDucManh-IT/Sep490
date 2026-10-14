import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    UserId: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },
    Email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    PasswordHash: {
      type: String,
      default: '',
    },
    Role: {
      type: String,
      enum: ['CUSTOMER', 'SHOP_OWNER', 'ADMIN', 'STAFF'],
      default: 'CUSTOMER',
    },
    FullName: {
      type: String,
      default: '',
      trim: true,
    },
    Status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BANNED', 'PENDING'],
      default: 'ACTIVE',
    },
    Infomation: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.virtual('email').get(function () { return this.Email; }).set(function (v) { this.Email = v; });
userSchema.virtual('fullName').get(function () { return this.FullName; }).set(function (v) { this.FullName = v; });
userSchema.virtual('role').get(function () { return this.Role; }).set(function (v) { this.Role = v; });
userSchema.virtual('status').get(function () { return this.Status; }).set(function (v) { this.Status = v; });
userSchema.virtual('passwordHash').get(function () { return this.PasswordHash; }).set(function (v) { this.PasswordHash = v; });
userSchema.virtual('infomation').get(function () { return this.Infomation; }).set(function (v) { this.Infomation = v; });
userSchema.virtual('userId').get(function () { return this.UserId || this._id; }).set(function (v) { this.UserId = v; });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
