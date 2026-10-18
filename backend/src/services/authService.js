import crypto from "node:crypto";
import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";
import { registerOtpTemplate } from "../utils/registerOtpTemplate.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const pendingRegistrations = new Map();
const processingEmails = new Set();

const otpSecret = crypto.randomBytes(32);
const OTP_LIFETIME = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const googleClient = new OAuth2Client();

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

function lockEmail(email) {
  if (processingEmails.has(email)) {
    fail(409, "Yêu cầu trước đang xử lý. Vui lòng chờ hoàn tất");
  }

  processingEmails.add(email);
}

const cleanupTimer = setInterval(() => {
  for (const [email, pending] of pendingRegistrations) {
    if (pending.expiresAt <= Date.now()) {
      pendingRegistrations.delete(email);
    }
  }
}, 60 * 1000);

cleanupTimer.unref();

export function toPublicUser(user) {
  return {
    id: user._id.toString(),
    email: user.Email,
    fullName: user.FullName,
    role: user.Role,
    status: user.Status,
    avatar: user.Avatar || "",
    information: user.Information || [],
    authProvider: user.AuthProvider,
  };
}

export async function login(data = {}) {
  const email = normalizeEmail(data?.email);
  const password = data?.password;

  if (
    typeof password !== "string" ||
    !password ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    fail(400, "Vui lòng nhập mật khẩu hợp lệ");
  }

  const user = await User.findOne({
    Email: email,
  }).select("+PasswordHash");

  if (!user || !(await user.comparePassword(password))) {
    fail(401, "Email hoặc mật khẩu không đúng");
  }

  if (user.Status !== "active") {
    fail(403, "Tài khoản đã bị vô hiệu hóa");
  }

  if (!process.env.JWT_SECRET) {
    fail(500, "Server chưa cấu hình JWT_SECRET");
  }

  const token = jwt.sign(
    {},
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      subject: user._id.toString(),
      issuer: "vestora",
      audience: "vestora-web",
    }
  );

  return {
    token,
    user: toPublicUser(user),
  };
}

export async function register(data = {}) {
  const email = normalizeEmail(data?.email);

  const fullName =
    typeof data.fullName === "string"
      ? data.fullName.normalize("NFC").trim().replace(/ +/g, " ")
      : "";

  const nameRegex =
    /^[A-Za-zÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯàáâãèéêìíòóôõùúýăđĩũơưẠ-ỹ ]+$/u;

  if (!fullName || [...fullName].length > 25) {
    fail(400, "Họ tên phải có từ 1 đến 25 ký tự");
  }

  if (!nameRegex.test(fullName)) {
    fail(400, "Họ tên chỉ được chứa chữ cái và khoảng trắng");
  }

  const phone =
    typeof data.phone === "string"
      ? data.phone.replace(/\s/g, "")
      : "";

  if (phone && !/^\+?[0-9]{9,15}$/.test(phone)) {
    fail(400, "Số điện thoại không hợp lệ");
  }

  if (data.password !== data.confirmPassword) {
    fail(400, "Mật khẩu xác nhận không khớp");
  }

  lockEmail(email);

  try {
    if (await User.exists({ Email: email })) {
      fail(409, "Email đã được đăng ký");
    }

    const draft = new User({
      Email: email,
      FullName: fullName,
      Role: "customer",
      Status: "active",
      AuthProvider: "local",
      Information: phone ? [{ Phone: phone, Address: "" }] : [],
    });

    // Model kiểm tra quy tắc mật khẩu và băm.
    await draft.setPassword(data.password);
    await draft.validate();

    const otp = crypto.randomInt(100000, 1000000).toString();
    const challengeId = crypto.randomBytes(32).toString("hex");
    const mail = registerOtpTemplate(otp);

    try {
      await sendEmail(email, mail.subject, mail.text, mail.html);
    } catch (error) {
      console.error("Lỗi gửi OTP:", {
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
        message: error.message,
      });

      fail(503, "Không gửi được email OTP. Vui lòng thử lại");
    }

    // Chỉ thay lượt đăng ký cũ sau khi SMTP chấp nhận email mới.
    pendingRegistrations.set(email, {
      challengeId,
      email,
      fullName,
      phone,
      passwordHash: draft.PasswordHash,
      otpHash: hashOtp(challengeId, otp),
      expiresAt: Date.now() + OTP_LIFETIME,
      attempts: 0,
    });

    return {
      message: "Đã gửi OTP. Vui lòng kiểm tra email và thư rác",
      email,
      challengeId,
    };
  } finally {
    processingEmails.delete(email);
  }
}

export async function verifyRegisterOtp(data = {}) {
  const email = normalizeEmail(data?.email);

  if (
    typeof data.challengeId !== "string" ||
    !/^[a-f0-9]{64}$/.test(data.challengeId)
  ) {
    fail(400, "Lượt đăng ký không hợp lệ");
  }

  const otp = typeof data.otp === "string" ? data.otp.trim() : "";

  if (!/^\d{6}$/.test(otp)) {
    fail(400, "OTP phải gồm 6 chữ số");
  }

  lockEmail(email);

  try {
    const pending = pendingRegistrations.get(email);

    if (!pending || pending.challengeId !== data.challengeId) {
      fail(400, "Lượt đăng ký không còn hiệu lực. Vui lòng gửi lại OTP");
    }

    if (pending.expiresAt <= Date.now()) {
      pendingRegistrations.delete(email);
      fail(400, "OTP đã hết hạn. Vui lòng gửi lại mã");
    }

    const correct = crypto.timingSafeEqual(
      Buffer.from(hashOtp(data.challengeId, otp), "hex"),
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

    // Tiêu thụ OTP; không cho dùng lại.
    pendingRegistrations.delete(email);

    const user = new User({
      Email: pending.email,
      FullName: pending.fullName,
      PasswordHash: pending.passwordHash,
      Role: "customer",
      Status: "active",
      AuthProvider: "local",
      Information: pending.phone
        ? [{ Phone: pending.phone, Address: "" }]
        : [],
    });

    try {
      // Chỉ lưu MongoDB sau khi xác thực thành công.
      await user.save();
    } catch (error) {
      if (error.code === 11000) {
        fail(409, "Thông tin tài khoản đã tồn tại");
      }

      console.error("Lỗi lưu tài khoản:", {
        name: error.name,
        code: error.code,
      });

      fail(503, "Chưa lưu được tài khoản. Vui lòng đăng ký lại");
    }

    console.log("Đăng ký thành công:", {
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
  } finally {
    processingEmails.delete(email);
  }
}

export async function loginGoogle(data = {}) {
  if (
    typeof data?.credential !== "string" ||
    !data.credential.trim()
  ) {
    fail(400, "Thiếu thông tin đăng nhập Google");
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    fail(500, "Server chưa cấu hình GOOGLE_CLIENT_ID");
  }

  if (!process.env.JWT_SECRET) {
    fail(500, "Server chưa cấu hình JWT_SECRET");
  }

  // Xác thực chữ ký, thời hạn và Client ID của Google token.
  let payload;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: data.credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    payload = ticket.getPayload();
  } catch {
    fail(
      401,
      "Không xác thực được Google. Vui lòng đăng nhập lại"
    );
  }

  if (
    !payload?.sub ||
    !payload.email ||
    payload.email_verified !== true
  ) {
    fail(401, "Tài khoản Google chưa có email được xác minh");
  }

  const email = normalizeEmail(payload.email);
  const googleId = payload.sub;

  // Ưu tiên định danh Google đã liên kết.
  let user = await User.findOne({
    GoogleId: googleId,
  });

  if (!user) {
    const existingUser = await User.findOne({
      Email: email,
    });

    if (existingUser) {
      if (existingUser.Status !== "active") {
        fail(403, "Tài khoản đã bị vô hiệu hóa");
      }

      if (
        existingUser.GoogleId &&
        existingUser.GoogleId !== googleId
      ) {
        fail(
          409,
          "Tài khoản đã liên kết với một tài khoản Google khác"
        );
      }

      // Chỉ tự liên kết email khi Google quản lý email đó.
      const googleOwnsEmail =
        email.endsWith("@gmail.com") ||
        (
          payload.email_verified === true &&
          typeof payload.hd === "string" &&
          payload.hd.length > 0
        );

      if (!existingUser.GoogleId && !googleOwnsEmail) {
        fail(
          409,
          "Email đã có tài khoản VESTORA. Vui lòng đăng nhập bằng mật khẩu"
        );
      }

      // Không thay mật khẩu, vai trò hoặc thông tin tài khoản cũ.
      // Điều kiện cập nhật ngăn ghi đè liên kết Google khác.
      user = await User.findOneAndUpdate(
        {
          _id: existingUser._id,
          Status: "active",
          $or: [
            { GoogleId: { $exists: false } },
            { GoogleId: null },
            { GoogleId: "" },
            { GoogleId: googleId },
          ],
        },
        {
          $set: {
            GoogleId: googleId,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!user) {
        fail(
          409,
          "Thông tin tài khoản đã thay đổi. Vui lòng thử lại"
        );
      }
    } else {
      // Chưa có tài khoản: tạo user Google.
      try {
        user = await User.create({
          Email: email,
          FullName:
            typeof payload.name === "string" && payload.name.trim()
              ? [...payload.name.normalize("NFC").trim()]
                .slice(0, 25)
                .join("")
                .trim()
              : "Người dùng Google",
          GoogleId: googleId,
          Avatar:
            typeof payload.picture === "string"
              ? payload.picture
              : "",
          AuthProvider: "google",
          Role: "customer",
          Status: "active",
          Information: [],
        });
      } catch (error) {
        if (error.code === 11000) {
          fail(
            409,
            "Tài khoản vừa được tạo hoặc liên kết. Vui lòng đăng nhập lại"
          );
        }

        throw error;
      }
    }
  }

  if (user.Status !== "active") {
    fail(403, "Tài khoản đã bị vô hiệu hóa");
  }

  // JWT của VESTORA dùng chung với đăng nhập email/mật khẩu.
  const token = jwt.sign(
    {},
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      subject: user._id.toString(),
      issuer: "vestora",
      audience: "vestora-web",
    }
  );

  return {
    token,
    user: toPublicUser(user),
  };
}

const passwordResetRequests = new Map();
const passwordResetLocks = new Set();

const RESET_OTP_LIFETIME = 5 * 60 * 1000;
const RESET_TOKEN_LIFETIME = 10 * 60 * 1000;
const RESET_RESEND_DELAY = 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;

const passwordResetSecret = crypto.randomBytes(32);

function hashResetValue(value) {
  return crypto
    .createHmac("sha256", passwordResetSecret)
    .update(value)
    .digest("hex");
}

function lockPasswordReset(email) {
  if (passwordResetLocks.has(email)) {
    fail(409, "Yêu cầu trước đang xử lý. Vui lòng chờ");
  }

  passwordResetLocks.add(email);
}

const passwordResetCleanup = setInterval(() => {
  const now = Date.now();

  for (const [email, request] of passwordResetRequests) {
    if (
      request.expiresAt <= now &&
      request.resendAfter <= now &&
      !passwordResetLocks.has(email)
    ) {
      passwordResetRequests.delete(email);
    }
  }
}, 60 * 1000);

passwordResetCleanup.unref();

// Bước 1: Kiểm tra email và gửi OTP.
export async function forgotPassword(data = {}) {
  const email = normalizeEmail(data?.email);

  lockPasswordReset(email);

  try {
    const previous = passwordResetRequests.get(email);

    if (previous && previous.resendAfter > Date.now()) {
      const seconds = Math.ceil(
        (previous.resendAfter - Date.now()) / 1000
      );

      fail(
        429,
        `Vui lòng chờ ${seconds} giây trước khi gửi lại OTP`
      );
    }

    const user = await User.findOne({ Email: email });

    if (!user) {
      fail(404, "Email chưa được đăng ký");
    }

    if (user.Status !== "active") {
      fail(403, "Tài khoản đã bị vô hiệu hóa");
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const challengeId = crypto.randomBytes(32).toString("hex");

    try {
      await sendEmail(
        email,
        "VESTORA - Mã OTP đặt lại mật khẩu",
        [
          `Mã OTP đặt lại mật khẩu của bạn là: ${otp}`,
          "Mã có hiệu lực trong 5 phút.",
          "Không chia sẻ mã này với người khác.",
          "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.",
        ].join("\n"),
        `
          <div style="font-family:Arial,sans-serif;line-height:1.7;color:#302c26">
            <h2 style="color:#96723d">VESTORA</h2>
            <p>Bạn vừa yêu cầu đặt lại mật khẩu.</p>
            <p>Mã xác thực của bạn:</p>
            <div style="font-size:30px;font-weight:700;letter-spacing:6px">
              ${otp}
            </div>
            <p>Mã có hiệu lực trong <strong>5 phút</strong>.</p>
            <p>Không chia sẻ mã này với người khác.</p>
            <p>Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
          </div>
        `
      );
    } catch {
      fail(503, "Không gửi được OTP. Vui lòng thử lại");
    }

    const now = Date.now();

    // Chỉ thay yêu cầu cũ khi gửi email thành công.
    passwordResetRequests.set(email, {
      userId: user._id.toString(),
      challengeId,
      stage: "otp",
      otpHash: hashResetValue(`${challengeId}:${otp}`),
      attempts: 0,
      expiresAt: now + RESET_OTP_LIFETIME,
      resendAfter: now + RESET_RESEND_DELAY,
    });

    return {
      message: "Đã gửi OTP. Vui lòng kiểm tra email và thư rác",
      email,
      challengeId,
    };
  } finally {
    passwordResetLocks.delete(email);
  }
}

// Bước 2: Kiểm tra OTP, cấp quyền đặt lại mật khẩu.
export async function verifyForgotPasswordOtp(data = {}) {
  const email = normalizeEmail(data?.email);
  const otp = typeof data?.otp === "string"
    ? data.otp.trim()
    : "";

  if (
    typeof data?.challengeId !== "string" ||
    !/^[a-f0-9]{64}$/.test(data.challengeId)
  ) {
    fail(400, "Yêu cầu không hợp lệ. Vui lòng gửi lại OTP");
  }

  if (!/^\d{6}$/.test(otp)) {
    fail(400, "OTP phải gồm 6 chữ số");
  }

  lockPasswordReset(email);

  try {
    const request = passwordResetRequests.get(email);

    if (
      !request ||
      request.stage !== "otp" ||
      request.challengeId !== data.challengeId
    ) {
      fail(400, "Yêu cầu không còn hiệu lực. Vui lòng gửi lại OTP");
    }

    if (request.expiresAt <= Date.now()) {
      fail(400, "OTP đã hết hạn. Vui lòng gửi lại mã");
    }

    if (request.attempts >= RESET_MAX_ATTEMPTS) {
      fail(400, "Đã nhập sai 5 lần. Vui lòng gửi lại OTP");
    }

    const receivedHash = hashResetValue(
      `${request.challengeId}:${otp}`
    );

    const valid = crypto.timingSafeEqual(
      Buffer.from(receivedHash, "hex"),
      Buffer.from(request.otpHash, "hex")
    );

    if (!valid) {
      request.attempts += 1;

      const remaining = RESET_MAX_ATTEMPTS - request.attempts;

      fail(
        400,
        remaining > 0
          ? `OTP không đúng. Còn ${remaining} lần thử`
          : "Đã nhập sai 5 lần. Vui lòng gửi lại OTP"
      );
    }

    // OTP dùng xong không được xác thực lại.
    const resetToken = crypto.randomBytes(32).toString("hex");

    request.stage = "reset";
    request.resetTokenHash = hashResetValue(resetToken);
    request.expiresAt = Date.now() + RESET_TOKEN_LIFETIME;

    delete request.otpHash;

    return {
      message: "Xác thực OTP thành công",
      resetToken,
    };
  } finally {
    passwordResetLocks.delete(email);
  }
}

// Bước 3: Kiểm tra quyền đặt lại mật khẩu và lưu mật khẩu mới.
export async function resetPassword(data = {}) {
  const email = normalizeEmail(data?.email);

  if (
    typeof data?.resetToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(data.resetToken)
  ) {
    fail(400, "Vui lòng xác thực OTP trước khi đặt lại mật khẩu");
  }

  if (
    typeof data?.password !== "string" ||
    data.password.length < 8 ||
    Buffer.byteLength(data.password, "utf8") > 72
  ) {
    fail(
      400,
      "Mật khẩu phải có ít nhất 8 ký tự và không vượt quá 72 byte"
    );
  }

  if (data.password !== data.confirmPassword) {
    fail(400, "Mật khẩu xác nhận không khớp");
  }

  lockPasswordReset(email);

  try {
    const request = passwordResetRequests.get(email);

    if (
      !request ||
      request.stage !== "reset" ||
      request.expiresAt <= Date.now()
    ) {
      fail(400, "Yêu cầu đã hết hạn. Vui lòng xác thực OTP lại");
    }

    const valid = crypto.timingSafeEqual(
      Buffer.from(hashResetValue(data.resetToken), "hex"),
      Buffer.from(request.resetTokenHash, "hex")
    );

    if (!valid) {
      fail(400, "Yêu cầu đặt lại mật khẩu không hợp lệ");
    }

    const user = await User.findOne({
      _id: request.userId,
      Email: email,
    }).select("+PasswordHash");

    if (!user) {
      fail(404, "Tài khoản không còn tồn tại");
    }

    if (user.Status !== "active") {
      fail(403, "Tài khoản đã bị vô hiệu hóa");
    }

    // Dùng phương thức băm mật khẩu sẵn có trong User.js.
    await user.setPassword(data.password);
    await user.save();

    // Chỉ dùng quyền đặt lại mật khẩu một lần.
    passwordResetRequests.delete(email);

    return {
      message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập",
    };
  } finally {
    passwordResetLocks.delete(email);
  }
}

export async function changePassword(userId, data = {}) {
  const {
    currentPassword,
    newPassword,
    confirmNewPassword,
  } = data ?? {};

  if (
    typeof currentPassword !== "string" ||
    !currentPassword ||
    Buffer.byteLength(currentPassword, "utf8") > 72
  ) {
    fail(400, "Vui lòng nhập mật khẩu hiện tại hợp lệ");
  }

  if (
    typeof newPassword !== "string" ||
    newPassword.length < 8 ||
    Buffer.byteLength(newPassword, "utf8") > 72
  ) {
    fail(
      400,
      "Mật khẩu mới phải có ít nhất 8 ký tự và không vượt quá 72 byte"
    );
  }

  if (newPassword !== confirmNewPassword) {
    fail(400, "Mật khẩu xác nhận không khớp");
  }

  const user = await User.findById(userId)
    .select("+PasswordHash");

  if (!user) {
    fail(401, "Tài khoản không còn tồn tại");
  }

  if (user.AuthProvider === "google") {
    fail(
      403,
      "Tài khoản đăng nhập bằng Google không hỗ trợ đổi mật khẩu tại VESTORA"
    );
  }

  if (user.Status !== "active") {
    fail(403, "Tài khoản đã bị vô hiệu hóa");
  }

  // Tài khoản tạo bằng Google có thể chưa có mật khẩu riêng.
  if (!user.PasswordHash) {
    fail(
      400,
      "Tài khoản chưa có mật khẩu VESTORA. Hãy dùng Quên mật khẩu để thiết lập mật khẩu trước"
    );
  }

  const correctPassword = await user.comparePassword(
    currentPassword
  );

  if (!correctPassword) {
    fail(400, "Mật khẩu hiện tại không đúng");
  }

  const previousHash = user.PasswordHash;

  // Dùng phương thức băm mật khẩu hiện có trong User.js.
  await user.setPassword(newPassword);

  // Chỉ cập nhật nếu mật khẩu chưa bị thay đổi bởi yêu cầu khác.
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: user._id,
      Status: "active",
      PasswordHash: previousHash,
    },
    {
      $set: {
        PasswordHash: user.PasswordHash,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedUser) {
    fail(
      409,
      "Thông tin tài khoản đã thay đổi. Vui lòng thử lại"
    );
  }

  return {
    message: "Đổi mật khẩu thành công",
  };
}