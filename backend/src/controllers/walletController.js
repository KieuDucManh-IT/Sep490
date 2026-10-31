import crypto from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { Wallet } from "../models/finance/Wallet.js";
import {
  WalletTransaction,
  WALLET_TYPES,
  WALLET_STATUSES,
} from "../models/finance/WalletTransaction.js";

import { sendEmail } from "../utils/sendEmail.js";

import {
  fail,
  encryptValue,
  newOTP,
  hashOTP,
  matchesOTP,
  validateAmount,
  validateWalletPassword,
  maskEmail,
} from "../utils/walletSecurity.js";

import {
  MONEY_SELECT,
  ensureWallet,
  readyWallet,
  readBalances,
  changeFunds,
  inTransaction,
  transactionDTO,
  syncTopup,
  syncWithdrawal,
} from "../services/walletService.js";

import {
  getCollectClient,
  checkPayoutConfig,
} from "../services/walletProvider.js";

const EPOCH = new Date(0);

function requireId(id) {
  if (!/^[a-f0-9]{24}$/i.test(String(id))) {
    fail(400, "Mã giao dịch không hợp lệ");
  }
}

async function ownedTransaction(req) {
  requireId(req.params.id);

  const transaction = await WalletTransaction.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!transaction) fail(404, "Không tìm thấy giao dịch");

  return transaction;
}

async function reserveOtpAttempt(model, filter, context, otp) {
  if (!/^\d{6}$/.test(String(otp))) {
    fail(400, "OTP phải gồm 6 chữ số");
  }

  // Mỗi lần kiểm tra chiếm một lượt bằng cập nhật nguyên tử.
  const document = await model.findOneAndUpdate(
    {
      ...filter,
      otpExpiresAt: { $gt: new Date() },
      otpAttempts: { $lt: 5 },
    },
    { $inc: { otpAttempts: 1 } },
    { new: true }
  ).select("+otpHash");

  if (!document) {
    fail(400, "OTP đã hết hạn, đã được dùng hoặc đã nhập sai quá 5 lần");
  }

  if (!matchesOTP(context, otp, document.otpHash)) {
    fail(400, "OTP không chính xác");
  }

  return document;
}

async function verifyPassword(walletId, password) {
  if (
    typeof password !== "string" ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    fail(400, "Mật khẩu Ví không hợp lệ");
  }

  const now = new Date();

  const wallet = await Wallet.findOneAndUpdate(
    {
      _id: walletId,
      status: "active",
      passwordLockedUntil: { $lte: now },
      nextPasswordAt: { $lte: now },
    },
    { $set: { nextPasswordAt: new Date(Date.now() + 1000) } },
    { new: true }
  ).select("+passwordHash");

  if (!wallet) {
    fail(429, "Vui lòng chờ; Ví có thể đang bị khóa tạm thời");
  }

  const valid =
    wallet.passwordHash &&
    (await bcrypt.compare(password, wallet.passwordHash));

  if (!valid) {
    const updated = await Wallet.findByIdAndUpdate(
      walletId,
      { $inc: { passwordFailures: 1 } },
      { new: true }
    );

    if (updated.passwordFailures >= 5) {
      await Wallet.updateOne(
        { _id: walletId },
        {
          $set: {
            passwordFailures: 0,
            passwordLockedUntil: new Date(Date.now() + 15 * 60000),
          },
        }
      );
    }

    fail(401, "Mật khẩu Ví không đúng");
  }

  await Wallet.updateOne(
    { _id: walletId },
    {
      $set: {
        passwordFailures: 0,
        passwordLockedUntil: EPOCH,
      },
    }
  );
}

export async function getWallet(req, res) {
  const base = await ensureWallet(req.user._id);

  const wallet = await Wallet.findById(base._id).select(
    `${MONEY_SELECT} +passwordHash`
  );

  if (!wallet.passwordHash) {
    return res.json({
      requiresSetup: true,
      email: maskEmail(req.user.Email),
    });
  }

  return res.json({
    requiresSetup: false,
    wallet: {
      id: String(wallet._id),
      currency: wallet.currency,
      status: wallet.status,
      ...readBalances(wallet),
    },
  });
}

export async function sendSetupOtp(req, res) {
  const wallet = await ensureWallet(req.user._id);
  const otp = newOTP();
  const context = `setup:${req.user._id}`;
  const otpHash = hashOTP(context, otp);

  const updated = await Wallet.findOneAndUpdate(
    {
      _id: wallet._id,
      status: "active",
      passwordHash: null,
      nextOtpAt: { $lte: new Date() },
    },
    {
      $set: {
        otpHash,
        otpAttempts: 0,
        otpExpiresAt: new Date(Date.now() + 5 * 60000),
        nextOtpAt: new Date(Date.now() + 60000),
      },
    },
    { new: true }
  );

  if (!updated) {
    fail(429, "Ví đã có mật khẩu hoặc bạn cần chờ 60 giây để gửi lại");
  }

  try {
    await sendEmail(
      req.user.Email,
      "VESTORA — Thiết lập mật khẩu Ví",
      `Mã OTP của bạn: ${otp}. Mã có hiệu lực trong 5 phút.`
    );
  } catch {
    await Wallet.updateOne(
      { _id: wallet._id, otpHash },
      { $unset: { otpHash: 1, otpExpiresAt: 1 } }
    );

    fail(503, "Chưa gửi được email OTP. Kiểm tra SMTP rồi thử lại");
  }

  res.json({
    message: `Đã gửi OTP đến ${maskEmail(req.user.Email)}`,
  });
}

export async function setupPassword(req, res) {
  const { password, confirmPassword, otp } = req.body;

  validateWalletPassword(password);

  if (password !== confirmPassword) {
    fail(400, "Mật khẩu xác nhận không khớp");
  }

  const verified = await reserveOtpAttempt(
    Wallet,
    {
      userId: req.user._id,
      status: "active",
      passwordHash: null,
    },
    `setup:${req.user._id}`,
    otp
  );

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await Wallet.updateOne(
    {
      _id: verified._id,
      passwordHash: null,
      otpHash: verified.otpHash,
      otpExpiresAt: { $gt: new Date() },
    },
    {
      $set: { passwordHash },
      $unset: { otpHash: 1, otpExpiresAt: 1 },
    }
  );

  if (result.modifiedCount !== 1) {
    fail(409, "OTP đã thay đổi hoặc mật khẩu đã được thiết lập");
  }

  res.json({ message: "Thiết lập mật khẩu Ví thành công" });
}

export async function getTransactions(req, res) {
  await readyWallet(req.user._id);

  const page = Number(req.query.page || 1);
  const limit = 10;

  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) {
    fail(400, "Trang lịch sử không hợp lệ");
  }

  const filter = { userId: req.user._id };

  if (req.query.type && req.query.type !== "all") {
    if (!WALLET_TYPES.includes(req.query.type)) {
      fail(400, "Loại giao dịch không hợp lệ");
    }

    filter.transactionType = req.query.type;
  }

  if (req.query.status && req.query.status !== "all") {
    if (!WALLET_STATUSES.includes(req.query.status)) {
      fail(400, "Trạng thái không hợp lệ");
    }

    filter.status = req.query.status;
  }

  const [items, total] = await Promise.all([
    WalletTransaction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    WalletTransaction.countDocuments(filter),
  ]);

  res.json({
    items: items.map(transactionDTO),
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
}

export async function createTopup(req, res) {
  const amount = validateAmount(req.body.amount);
  const wallet = await readyWallet(req.user._id);
  const provider = getCollectClient();

  const id = new mongoose.Types.ObjectId();
  const orderCode = crypto.randomInt(1, 281474976710655);

  // Ghi yêu cầu trước khi gọi nhà cung cấp.
  const transaction = await WalletTransaction.create({
    _id: id,
    userId: req.user._id,
    walletId: wallet._id,
    code: `NAP${id}`,
    transactionType: "top_up",
    direction: "credit",
    amount,
    orderCode,
    status: "pending",
  });

  try {
    const origin = new URL(process.env.FRONTEND_URL).origin;

    const payment = await provider.paymentRequests.create({
      orderCode,
      amount,
      description: String(req.user._id),
      returnUrl: `${origin}/wallet?orderCode=${orderCode}`,
      cancelUrl: `${origin}/wallet?orderCode=${orderCode}`,
      expiredAt: Math.floor(Date.now() / 1000) + 15 * 60,
    });

    // Không ghi đè trạng thái nếu webhook đã xử lý trước.
    await WalletTransaction.updateOne(
      { _id: id },
      {
        $set: {
          paymentLinkId: payment.paymentLinkId,
          checkoutUrl: payment.checkoutUrl,
          qrCode: payment.qrCode,
          nextCheckAt: new Date(Date.now() + 10000),
        },
      }
    );
  } catch {
    await WalletTransaction.updateOne(
      { _id: id, status: "pending" },
      { $set: { status: "review" } }
    );
  }

  const saved = await WalletTransaction.findById(transaction._id);

  res.status(201).json({
    transaction: transactionDTO(saved),
    message: saved.checkoutUrl
      ? "Đã tạo yêu cầu nạp tiền"
      : "Chưa nhận được link thanh toán; yêu cầu đang chờ đối soát",
  });
}

export async function sendWithdrawOtp(req, res) {
  const amount = validateAmount(req.body.amount);

  const bankBin = String(req.body.bankBin || "").trim();
  const accountNumber = String(req.body.accountNumber || "").trim();
  const accountName = String(req.body.accountName || "").trim();

  if (
    !/^\d{6}$/.test(bankBin) ||
    !/^\d{6,20}$/.test(accountNumber) ||
    accountName.length < 2 ||
    accountName.length > 100 ||
    /[@\r\n]/.test(accountName) ||
    !/\p{L}/u.test(accountName)
  ) {
    fail(400, "Thông tin tài khoản ngân hàng không hợp lệ");
  }

  checkPayoutConfig();

  const wallet = await readyWallet(req.user._id);

  await verifyPassword(wallet._id, req.body.walletPassword);

  // Chỉ là kiểm tra sớm; lúc xác nhận OTP sẽ kiểm tra lại.
  if (readBalances(wallet).availableBalance < amount) {
    fail(400, "Số dư khả dụng không đủ");
  }

  const rateGate = await Wallet.updateOne(
    {
      _id: wallet._id,
      nextOtpAt: { $lte: new Date() },
    },
    {
      $set: {
        nextOtpAt: new Date(Date.now() + 60000),
      },
    }
  );

  if (rateGate.modifiedCount !== 1) {
    fail(429, "Vui lòng chờ 60 giây trước khi yêu cầu OTP tiếp theo");
  }

  const id = new mongoose.Types.ObjectId();
  const otp = newOTP();

  const transaction = await WalletTransaction.create({
    _id: id,
    walletId: wallet._id,
    userId: req.user._id,
    code: `RUT${id}`,
    transactionType: "withdraw",
    direction: "debit",
    amount,
    status: "otp_pending",
    bankBin,
    bankLast4: accountNumber.slice(-4),
    bankEncrypted: encryptValue(
      { bankBin, accountNumber, accountName },
      `${id}:bank`
    ),
    otpHash: hashOTP(`withdraw:${id}`, otp),
    otpEmail: req.user.Email,
    otpExpiresAt: new Date(Date.now() + 5 * 60000),
  });

  try {
    await sendEmail(
      req.user.Email,
      "VESTORA — Xác nhận rút tiền",
      [
        `Số tiền: ${amount.toLocaleString("vi-VN")} VND`,
        `Mã ngân hàng: ${bankBin}`,
        `Tài khoản nhận: ******${accountNumber.slice(-4)}`,
        `OTP: ${otp}`,
        "Mã có hiệu lực trong 5 phút.",
        "Không cung cấp OTP cho người khác.",
      ].join("\n")
    );
  } catch (error) {
    console.error("[wallet/send-otp]", {
      transactionId: String(id),
      code: error.code || "EMAIL_ERROR",
      command: error.command,
      responseCode: error.responseCode,
    });

    await WalletTransaction.updateOne(
      { _id: id, status: "otp_pending" },
      {
        $set: { status: "failed" },
        $unset: {
          otpHash: 1,
          otpExpiresAt: 1,
        },
      }
    );

    fail(503, "Không gửi được OTP email; chưa khóa hoặc trừ tiền");
  }

  res.status(201).json({
    transaction: transactionDTO(transaction),
    message: `Đã gửi OTP đến ${maskEmail(req.user.Email)}`,
  });
}

export async function confirmWithdraw(req, res) {
  const { transactionId, otp } = req.body;

  requireId(transactionId);

  const verified = await reserveOtpAttempt(
    WalletTransaction,
    {
      _id: transactionId,
      userId: req.user._id,
      transactionType: "withdraw",
      status: "otp_pending",
      otpEmail: req.user.Email,
    },
    `withdraw:${transactionId}`,
    otp
  );

  await inTransaction(async (session) => {
    const transaction = await WalletTransaction.findOne({
      _id: transactionId,
      userId: req.user._id,
      status: "otp_pending",
      otpHash: verified.otpHash,
      otpEmail: req.user.Email,
      otpExpiresAt: { $gt: new Date() },
    }).session(session);

    if (!transaction) {
      fail(409, "Yêu cầu đã được xử lý hoặc OTP hết hạn");
    }

    const wallet = await Wallet.findOne({
      _id: transaction.walletId,
      status: "active",
    })
      .select(MONEY_SELECT)
      .session(session);

    if (!wallet) fail(423, "Ví đang bị khóa");

    await changeFunds(
      wallet,
      transaction,
      0,
      transaction.amount,
      "reserve",
      session
    );

    transaction.fundsReserved = true;
    transaction.status = "queued";
    transaction.withdrawDeadlineAt = new Date(Date.now() + 60000);
    transaction.nextCheckAt = new Date();
    transaction.otpHash = undefined;

    await transaction.save({ session });
  });

  res.status(202).json({
    message: "OTP hợp lệ. Yêu cầu rút đang được xử lý",
  });
}

export async function syncTransaction(req, res) {
  await readyWallet(req.user._id);
  const transaction = await ownedTransaction(req);

  const claimed = await WalletTransaction.findOneAndUpdate(
    {
      _id: transaction._id,
      nextUserSyncAt: { $lte: new Date() },
    },
    {
      $set: {
        nextUserSyncAt: new Date(Date.now() + 10000),
      },
    },
    { new: true }
  );

  if (!claimed) {
    fail(429, "Vui lòng chờ 10 giây trước khi kiểm tra lại");
  }

  let result = transaction;

  if (transaction.transactionType === "top_up") {
    result = await syncTopup(transaction._id);
  } else if (transaction.transactionType === "withdraw") {
    result = await syncWithdrawal(transaction._id, {
      throwOnError: true,
    });
  }

  if (!result) {
    fail(404, "Không tìm thấy giao dịch");
  }

  let message;

  if (result.transactionType === "withdraw") {
    if (result.status === "success") {
      message = "Rút tiền thành công. Số dư đã được cập nhật.";
    } else if (
      result.status === "failed" &&
      result.fundsReserved === false
    ) {
      message =
        "Rút tiền không thành công. Khoản tiền của giao dịch này không còn bị tạm khóa.";
    } else if (result.status === "expired") {
      message = "Yêu cầu rút tiền đã hết hạn.";
    } else {
      message =
        result.lastSyncError ||
        "Yêu cầu rút chưa có kết quả cuối cùng. Tiền đang chờ đối soát.";
    }
  } else if (result.status === "success") {
    message = "Nạp tiền thành công. Số dư đã được cập nhật.";
  } else if (["failed", "expired"].includes(result.status)) {
    message = "Giao dịch nạp tiền đã thất bại hoặc hết hạn.";
  } else {
    message = "Chưa nhận được xác nhận nạp tiền thành công.";
  }

  return res.json({
    transaction: transactionDTO(result),
    message,
  });
}
export async function syncReturnedTopup(req, res) {
  await readyWallet(req.user._id);

  const orderCode = Number(req.params.orderCode);

  if (!Number.isSafeInteger(orderCode) || orderCode <= 0) {
    fail(400, "Mã nạp tiền không hợp lệ");
  }

  const transaction = await WalletTransaction.findOne({
    userId: req.user._id,
    transactionType: "top_up",
    orderCode,
  });

  if (!transaction) fail(404, "Không tìm thấy yêu cầu nạp tiền");

  // Dùng cùng giới hạn đồng bộ với endpoint lịch sử.
  req.params.id = String(transaction._id);
  return syncTransaction(req, res);
}

export async function payosWebhook(req, res) {
  let verified;

  try {
    verified = await getCollectClient().webhooks.verify(req.body);
  } catch {
    return res.status(400).json({ message: "Chữ ký webhook không hợp lệ" });
  }

  const transaction = await WalletTransaction.findOne({
    transactionType: "top_up",
    orderCode: Number(verified.orderCode),
  });

  // Bao gồm webhook mẫu dùng lúc đăng ký URL.
  if (!transaction) return res.json({ received: true });

  // Đối soát dữ liệu thanh toán trực tiếp trước khi cộng tiền.
  await syncTopup(transaction._id);

  return res.json({ received: true });
}