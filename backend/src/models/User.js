import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const nameRegex =
  /^[A-Za-zÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯàáâãèéêìíòóôõùúýăđĩũơưẠ-ỹ ]+$/u;

const punctuationRegex =
  /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/;

const informationSchema = new mongoose.Schema(
  {
    Phone: {
      type: String,
      trim: true,
      default: "",
    },

    Address: {
      type: String,
      trim: true,
      default: "",
    },

    ProvinceCode: {
      type: String,
      default: "",
    },

    ProvinceName: {
      type: String,
      default: "",
    },

    WardCode: {
      type: String,
      default: "",
    },

    WardName: {
      type: String,
      default: "",
    },

    AddressDetail: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },
  },
  { _id: false }
);

function hidePassword(doc, result) {
  delete result.PasswordHash;
  return result;
}

const userSchema = new mongoose.Schema(
  {
    Email: {
      type: String,
      required: [true, "Email không được để trống"],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Email không đúng định dạng",
      ],
    },

    PasswordHash: {
      type: String,
      select: false,

      required: function () {
        return this.AuthProvider === "local";
      },

      match: [
        /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/,
        "PasswordHash phải là mật khẩu đã băm bằng bcrypt",
      ],
    },

    Role: {
      type: String,
      enum: ["customer", "admin", "shop_owner", "operation_staff"],
      required: true,
      default: "customer",
    },

    FullName: {
      type: String,
      required: [true, "Họ tên không được để trống"],
      trim: true,
      validate: {
        validator: function (value) {
          return typeof value === "string" && [...value].length <= 25;
        },
        message: "Họ tên không được vượt quá 25 ký tự",
      },
    },

    Status: {
      type: String,
      enum: ["active", "deactive"],
      default: "active",
    },

    Information: {
      type: [informationSchema],
      default: [],
    },

    GoogleId: {
      type: String,
      trim: true,
      required: function () {
        return this.AuthProvider === "google";
      },
    },

    Avatar: {
      type: String,
      trim: true,
      default: "",
    },

    AvatarPublicId: {
      type: String,
      default: "",
    },

    AuthProvider: {
      type: String,
      enum: ["google", "local"],
      required: true,
      default: "local",
    },

    WarningsCount: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Số lần cảnh cáo phải là số nguyên",
      },
    },

    LastWarning: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { transform: hidePassword },
    toObject: { transform: hidePassword },
  }
);

userSchema.index(
  { GoogleId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      GoogleId: { $type: "string" },
    },
  }
);

userSchema.methods.setPassword = async function (password) {
  if (
    typeof password !== "string" ||
    [...password].length < 9 ||
    [...password].length > 16
  ) {
    const error = new Error("Mật khẩu phải có từ 9 đến 16 ký tự");
    error.status = 400;
    throw error;
  }

  if (
    !/\p{Lu}/u.test(password) ||
    !/\p{Ll}/u.test(password) ||
    !/[0-9]/.test(password) ||
    !punctuationRegex.test(password) ||
    /\s/u.test(password)
  ) {
    const error = new Error(
      "Mật khẩu phải có chữ hoa, chữ thường, số, dấu câu và không chứa khoảng trắng"
    );
    error.status = 400;
    throw error;
  }

  this.PasswordHash = await bcrypt.hash(password, 12);
};

userSchema.methods.comparePassword = async function (password) {
  if (typeof password !== "string" || !this.PasswordHash) {
    return false;
  }

  return bcrypt.compare(password, this.PasswordHash);
};

userSchema.statics.addWarning = function (userId) {
  return this.findByIdAndUpdate(
    userId,
    {
      $inc: { WarningsCount: 1 },
      $currentDate: { LastWarning: true },
    },
    { new: true, runValidators: true }
  );
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;