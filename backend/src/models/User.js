const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Mỗi phần tử Information chứa Phone và Address
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
  },
  { _id: false }
);

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

      // Tài khoản Google không bắt buộc có mật khẩu
      required: function () {
        return this.AuthProvider === "local";
      },

      // Chỉ nhận chuỗi có định dạng bcrypt hash
      match: [
        /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/,
        "PasswordHash phải là mật khẩu đã băm bằng bcrypt",
      ],
    },

    Role: {
      type: String,
      enum: {
        values: ["customer", "admin", "shop_owner", "operation_staff"],
        message: "Role không hợp lệ",
      },
      required: true,
      default: "customer",
    },

    FullName: {
      type: String,
      required: [true, "Họ tên không được để trống"],
      trim: true,
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

    AuthProvider: {
      type: String,
      enum: ["google", "local"],
      required: true,
      default: "local",
    },

    WarningsCount: {
      type: Number,
      default: 0,
      min: [0, "Số lần cảnh cáo không được âm"],
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

    // Không trả PasswordHash khi chuyển document thành JSON
    toJSON: {
      transform(doc, result) {
        delete result.PasswordHash;
        return result;
      },
    },

    toObject: {
      transform(doc, result) {
        delete result.PasswordHash;
        return result;
      },
    },
  }
);

// GoogleId duy nhất nếu có.
// Tài khoản local không cần khai báo GoogleId.
userSchema.index(
  { GoogleId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      GoogleId: { $type: "string" },
    },
  }
);

// Băm mật khẩu khi đăng ký hoặc đổi mật khẩu.
// Phương thức này chưa lưu vào database: cần gọi save() sau đó.
userSchema.methods.setPassword = async function (password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Mật khẩu phải có ít nhất 8 ký tự");
  }

  // bcrypt chỉ xử lý tối đa 72 byte
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Mật khẩu không được vượt quá 72 byte UTF-8");
  }

  this.PasswordHash = await bcrypt.hash(password, 12);
};

// So sánh mật khẩu nhập vào với mật khẩu đã băm
userSchema.methods.comparePassword = async function (password) {
  if (typeof password !== "string" || !this.PasswordHash) {
    return false;
  }

  return bcrypt.compare(password, this.PasswordHash);
};

// Tăng số lần cảnh cáo và cập nhật thời gian trong cùng một thao tác
userSchema.statics.addWarning = function (userId) {
  return this.findByIdAndUpdate(
    userId,
    {
      $inc: { WarningsCount: 1 },
      $currentDate: { LastWarning: true },
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

module.exports =
  mongoose.models.User || mongoose.model("User", userSchema);
