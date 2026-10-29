import crypto from "node:crypto";

export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function readKey(name) {
  const value = process.env[name];

  if (!/^[a-fA-F0-9]{64}$/.test(value || "")) {
    throw new Error(`${name} phải gồm 64 ký tự hex`);
  }

  return Buffer.from(value, "hex");
}

export function checkWalletKeys() {
  readKey("WALLET_ENCRYPTION_KEY");
  readKey("WALLET_OTP_SECRET");
}

// AAD ràng buộc dữ liệu mã hóa với đúng Ví và đúng trường dữ liệu.
export function encryptValue(value, aad) {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    readKey("WALLET_ENCRYPTION_KEY"),
    iv
  );

  cipher.setAAD(Buffer.from(aad));

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);

  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptValue(value, aad) {
  if (typeof value !== "string") {
    throw new Error("Thiếu dữ liệu Ví đã mã hóa");
  }

  const [version, iv, tag, encrypted] = value.split(".");

  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Dữ liệu mã hóa Ví không hợp lệ");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    readKey("WALLET_ENCRYPTION_KEY"),
    Buffer.from(iv, "base64url")
  );

  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

export function newOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOTP(context, otp) {
  return crypto
    .createHmac("sha256", readKey("WALLET_OTP_SECRET"))
    .update(`${context}:${otp}`)
    .digest("hex");
}

export function matchesOTP(context, otp, storedHash) {
  if (!/^\d{6}$/.test(String(otp))) return false;
  if (!/^[a-f0-9]{64}$/i.test(storedHash || "")) return false;

  return crypto.timingSafeEqual(
    Buffer.from(hashOTP(context, otp), "hex"),
    Buffer.from(storedHash, "hex")
  );
}

export function validateAmount(amount) {
  if (
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount < 10000 ||
    amount > 20000000
  ) {
    fail(400, "Số tiền phải là số nguyên từ 10.000đ đến 20.000.000đ");
  }

  return amount;
}

export function validateWalletPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9\s]/.test(password) ||
    /\s/.test(password)
  ) {
    fail(
      400,
      "Mật khẩu Ví cần ít nhất 8 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt và không có khoảng trắng"
    );
  }
}

export function maskEmail(email) {
  const [name, domain] = String(email).split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}