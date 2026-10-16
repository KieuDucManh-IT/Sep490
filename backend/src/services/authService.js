import crypto from "crypto";
import User from "../models/User.js";
import sendEmail from "../utils/sendEmail.js";

const pendingRegistrations = new Map();
const otpSecret = crypto.randomBytes(32);

const OTP_LIFETIME = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function normalizeEmail(value) {
  if (typeof value !== "string") {
    fail(400, "Vui lòng nhập email");
  }

  const email = value.trim().toLowerCase();

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    fail(400, "Email không đúng định dạng");
  }

  return email;
}

function hashOtp(challengeId, otp) {
  return crypto
    .createHmac("sha256", otpSecret)
    .update(`${challengeId}:${otp}`)
    .digest("hex");
}

// Dọn dữ liệu tạm đã hết hạn.
// Đây không phải thời gian chờ gửi lại OTP.
const cleanupTimer = setInterval(() => {
  for (const [email, pending] of pendingRegistrations) {
    if (pending.expiresAt <= Date.now()) {
      pendingRegistrations.delete(email);
    }
  }
}, 60 * 1000);

cleanupTimer.unref();

async function register(data = {}) {
  const email = normalizeEmail(data.email);

  const fullName =
    typeof data.fullName === "string"
      ? data.fullName.trim()
      : "";

  if (!fullName || fullName.length > 100) {
    fail(400, "Họ tên phải có từ 1 đến 100 ký tự");
  }

  if (
    typeof data.password !== "string" ||
    data.password.length < 8 ||
    Buffer.byteLength(data.password, "utf8") > 72
  ) {
    fail(400, "Mật khẩu phải có ít nhất 8 ký tự và tối đa 72 byte");
  }

  if (data.password !== data.confirmPassword) {
    fail(400, "Mật khẩu xác nhận không khớp");
  }

  const phone =
    typeof data.phone === "string" ? data.phone.trim() : "";

  if (phone && !/^\+?[0-9]{9,15}$/.test(phone)) {
    fail(400, "Số điện thoại không hợp lệ");
  }

  if (await User.exists({ Email: email })) {
    fail(409, "Email đã được đăng ký");
  }

  // Chỉ tạo document trong RAM, chưa lưu MongoDB.
  const draft = new User({
    Email: email,
    FullName: fullName,
    Role: "customer",
    Status: "active",
    AuthProvider: "local",
    Information: phone
      ? [{ Phone: phone, Address: "" }]
      : [],
  });

  await draft.setPassword(data.password);
  await draft.validate();

  const otp = crypto.randomInt(100000, 1000000).toString();
  const challengeId = crypto.randomBytes(32).toString("hex");

  const pending = {
    challengeId,
    email,
    fullName,
    phone,
    passwordHash: draft.PasswordHash,
    otpHash: hashOtp(challengeId, otp),
    expiresAt: Date.now() + OTP_LIFETIME,
    attempts: 0,
    ready: false,
  };

  // Gửi lại đăng ký sẽ thay OTP cũ.
  pendingRegistrations.set(email, pending);

  try {
    await sendEmail(
      email,
      "VESTORA - Xác thực đăng ký",
      `Mã OTP của bạn là: ${otp}\n` +
      "Mã có hiệu lực trong 5 phút.\n" +
      "Không chia sẻ mã này với người khác."
    );
  } catch (error) {
    if (pendingRegistrations.get(email) === pending) {
      pendingRegistrations.delete(email);
    }

    // Chỉ log mã lỗi, không log mật khẩu SMTP.
    console.error("Gửi email thất bại:", error.code || "SMTP_ERROR");

    fail(503, "Không gửi được OTP. Vui lòng thử lại");
  }

  if (pendingRegistrations.get(email) !== pending) {
    fail(409, "Yêu cầu này đã được thay thế bởi lượt đăng ký mới");
  }

  pending.ready = true;

  return {
    message: "Đã gửi OTP. Vui lòng kiểm tra email",
    email,
    challengeId,
  };
}

async function verifyRegisterOtp(data = {}) {
  const email = normalizeEmail(data.email);

  if (
    typeof data.challengeId !== "string" ||
    !/^[a-f0-9]{64}$/.test(data.challengeId)
  ) {
    fail(400, "Lượt đăng ký không hợp lệ");
  }

  if (
    typeof data.otp !== "string" ||
    !/^\d{6}$/.test(data.otp)
  ) {
    fail(400, "OTP phải gồm 6 chữ số");
  }

  const pending = pendingRegistrations.get(email);

  if (
    !pending ||
    pending.challengeId !== data.challengeId ||
    !pending.ready
  ) {
    fail(400, "Lượt đăng ký không còn hiệu lực. Vui lòng gửi lại OTP");
  }

  if (pending.expiresAt <= Date.now()) {
    pendingRegistrations.delete(email);
    fail(400, "OTP đã hết hạn. Vui lòng gửi lại mã");
  }

  const submittedHash = hashOtp(data.challengeId, data.otp);

  const correct = crypto.timingSafeEqual(
    Buffer.from(submittedHash, "hex"),
    Buffer.from(pending.otpHash, "hex")
  );

  if (!correct) {
    pending.attempts += 1;

    if (pending.attempts >= MAX_ATTEMPTS) {
      pendingRegistrations.delete(email);
      fail(400, "Đã nhập sai 5 lần. Vui lòng gửi lại OTP");
    }

    fail(
      400,
      `OTP không đúng. Còn ${MAX_ATTEMPTS - pending.attempts} lần thử`
    );
  }

  // Xóa ngay trước khi await để OTP không bị dùng hai lần.
  pendingRegistrations.delete(email);

  const user = new User({
    Email: pending.email,
    FullName: pending.fullName,

    // Mật khẩu đã băm, không băm lần nữa.
    PasswordHash: pending.passwordHash,

    Role: "customer",
    Status: "active",
    AuthProvider: "local",
    Information: pending.phone
      ? [{ Phone: pending.phone, Address: "" }]
      : [],
  });

  try {
    // Chỉ lưu database tại bước này.
    await user.save();
  } catch (error) {
    if (error.code === 11000) {
      fail(409, "Email đã được đăng ký");
    }

    console.error("Lỗi lưu User:", error.name);

    fail(500, "Chưa lưu được tài khoản. Vui lòng đăng ký lại");
  }

  console.log("Đã lưu tài khoản:", {
    id: user._id.toString(),
    database: User.db.name,
    collection: User.collection.name,
  });

  return {
    message: "Đăng ký thành công",
    user: {
      id: user._id.toString(),
      email: user.Email,
      fullName: user.FullName,
      role: user.Role,
    },
  };
}

export {
  register,
  verifyRegisterOtp,
};

export default {
  register,
  verifyRegisterOtp,
};