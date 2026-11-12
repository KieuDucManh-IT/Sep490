import mongoose from "mongoose";

import { Wallet } from "../models/finance/Wallet.js";
import { WalletTransaction } from "../models/finance/WalletTransaction.js";

import {
  encryptValue,
  decryptValue,
  fail,
} from "../utils/walletSecurity.js";

import {
  getCollectClient,
  createPayout,
  findPayout,
} from "./walletProvider.js";

export const MONEY_SELECT =
  "+balanceEncrypted +lockedBalanceEncrypted";

const WITHDRAW_ACTIVE = [
  "queued",
  "submitting",
  "processing",
  "review",
];

const TOPUP_FINAL = [
  "success",
  "reversed",
];

const TOPUP_OPEN = [
  "pending",
  "review",
];

function providerAmount(value) {
  if (
    typeof value !== "number" &&
    !(typeof value === "string" && /^\d+$/.test(value))
  ) {
    return null;
  }

  const amount = Number(value);

  return Number.isSafeInteger(amount) && amount >= 0
    ? amount
    : null;
}

function expiredQueueFilter() {
  return {
    transactionType: "withdraw",
    status: "queued",
    fundsReserved: true,
    submittedAt: null,
    payoutId: null,
    withdrawDeadlineAt: { $lte: new Date() },
  };
}

async function markTopupReview(transactionId, state, message) {
  await WalletTransaction.updateOne(
    {
      _id: transactionId,
      transactionType: "top_up",
      status: { $nin: TOPUP_FINAL },
    },
    {
      $set: {
        status: "review",
        providerState: state,
        lastSyncError: message,
      },
    }
  );

  return WalletTransaction.findById(transactionId);
}

export async function inTransaction(callback) {
  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(
      () => callback(session),
      {
        readPreference: "primary",
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      }
    );
  } finally {
    await session.endSession();
  }
}

export async function ensureWallet(userId) {
  let wallet = await Wallet.findOne({ userId });

  if (wallet) return wallet;

  const id = new mongoose.Types.ObjectId();

  try {
    return await Wallet.create({
      _id: id,
      userId,
      balanceEncrypted: encryptValue(0, `${id}:balance`),
      lockedBalanceEncrypted: encryptValue(0, `${id}:locked`),
    });
  } catch (error) {
    // Hai yêu cầu mở Ví đồng thời chỉ được tạo một Ví.
    if (error.code !== 11000) throw error;

    wallet = await Wallet.findOne({ userId });

    if (!wallet) throw error;

    return wallet;
  }
}

export async function readyWallet(userId) {
  const base = await ensureWallet(userId);

  const wallet = await Wallet.findById(base._id).select(
    `${MONEY_SELECT} +passwordHash`
  );

  if (!wallet) {
    fail(404, "Không tìm thấy Ví");
  }

  if (!wallet.passwordHash) {
    fail(403, "Bạn cần thiết lập mật khẩu Ví trước");
  }

  if (wallet.status !== "active") {
    fail(423, "Ví đang bị khóa");
  }

  return wallet;
}

export function readBalances(wallet) {
  if (!wallet) {
    throw new Error("Không tìm thấy Ví");
  }

  const balance = decryptValue(
    wallet.balanceEncrypted,
    `${wallet._id}:balance`
  );

  const lockedBalance = decryptValue(
    wallet.lockedBalanceEncrypted,
    `${wallet._id}:locked`
  );

  if (
    !Number.isSafeInteger(balance) ||
    !Number.isSafeInteger(lockedBalance) ||
    lockedBalance < 0 ||
    balance < lockedBalance
  ) {
    throw new Error("Số dư Ví không nhất quán");
  }

  return {
    balance,
    lockedBalance,
    availableBalance: balance - lockedBalance,
  };
}

export function transactionDTO(transaction) {
  return {
    id: String(transaction._id),
    code: transaction.code,
    type: transaction.transactionType,
    direction: transaction.direction,
    amount: transaction.amount,
    status: transaction.status,
    createdAt: transaction.createdAt,
    completedAt: transaction.completedAt,

    orderCode: transaction.orderCode,
    checkoutUrl: transaction.checkoutUrl,
    qrCode: transaction.qrCode,

    expiresAt:
      transaction.transactionType === "top_up"
        ? transaction.topupExpiresAt ||
          new Date(
            new Date(transaction.createdAt).getTime() +
              15 * 60 * 1000
          )
        : undefined,

    bankBin: transaction.bankBin,
    bankAccount: transaction.bankLast4
      ? `******${transaction.bankLast4}`
      : undefined,

    referenceType: transaction.referenceType,
    referenceId: transaction.referenceId,
  };
}

// Chỉ gọi bên trong MongoDB transaction.
export async function changeFunds(
  wallet,
  transaction,
  balanceDelta,
  lockedDelta,
  phase,
  session
) {
  if (!session?.inTransaction()) {
    throw new Error(
      "Cập nhật tiền phải nằm trong database transaction"
    );
  }

  const before = readBalances(wallet);

  const balance = before.balance + balanceDelta;
  const lockedBalance = before.lockedBalance + lockedDelta;

  if (
    !Number.isSafeInteger(balance) ||
    !Number.isSafeInteger(lockedBalance) ||
    lockedBalance < 0 ||
    balance < lockedBalance
  ) {
    fail(
      409,
      "Số dư khả dụng không đủ hoặc tiền khóa không khớp"
    );
  }

  wallet.balanceEncrypted = encryptValue(
    balance,
    `${wallet._id}:balance`
  );

  wallet.lockedBalanceEncrypted = encryptValue(
    lockedBalance,
    `${wallet._id}:locked`
  );

  const snapshot = encryptValue(
    {
      before,
      after: {
        balance,
        lockedBalance,
        availableBalance: balance - lockedBalance,
      },
    },
    `${transaction._id}:${phase}`
  );

  if (phase === "reserve") {
    transaction.reserveSnapshotEncrypted = snapshot;
  } else {
    transaction.settleSnapshotEncrypted = snapshot;
  }

  await wallet.save({ session });
}

export async function syncTopup(transactionId) {
  const transaction = await WalletTransaction.findById(
    transactionId
  );

  if (!transaction || transaction.transactionType !== "top_up") {
    fail(404, "Không tìm thấy giao dịch nạp");
  }

  // Không cộng lại giao dịch đã thành công hoặc đã đảo.
  if (TOPUP_FINAL.includes(transaction.status)) {
    return transaction;
  }

  let payment;

  try {
    payment = await getCollectClient().paymentRequests.get(
      transaction.orderCode
    );
  } catch {
    const message =
      "Chưa tra cứu được kết quả nạp tiền từ payOS. " +
      "Hệ thống sẽ thử lại.";

    await WalletTransaction.updateOne(
      {
        _id: transactionId,
        transactionType: "top_up",
        status: { $in: TOPUP_OPEN },
      },
      {
        $set: { lastSyncError: message },
      }
    );

    fail(502, message);
  }

  if (
    !payment ||
    Number(payment.orderCode) !== transaction.orderCode ||
    typeof payment.id !== "string" ||
    !payment.id ||
    (
      transaction.paymentLinkId &&
      transaction.paymentLinkId !== payment.id
    )
  ) {
    return markTopupReview(
      transactionId,
      "PAYMENT_MISMATCH",
      "Thông tin link thanh toán không khớp yêu cầu nạp tiền."
    );
  }

  const amount = providerAmount(payment.amount);
  const amountPaid = providerAmount(payment.amountPaid);

  if (
    amount !== transaction.amount ||
    amountPaid === null
  ) {
    return markTopupReview(
      transactionId,
      "AMOUNT_MISMATCH",
      "Thông tin số tiền không khớp. Giao dịch cần được đối soát."
    );
  }

  if (payment.status === "PAID") {
    if (amountPaid !== transaction.amount) {
      return markTopupReview(
        transactionId,
        "AMOUNT_MISMATCH",
        "Số tiền thực nhận khác số tiền yêu cầu. " +
          "Giao dịch cần đối soát."
      );
    }

    await inTransaction(async (session) => {
      const current = await WalletTransaction.findById(
        transactionId
      ).session(session);

      if (!current || current.transactionType !== "top_up") {
        fail(404, "Không tìm thấy giao dịch nạp");
      }

      // Chặn cộng lặp khi webhook và job cùng xử lý.
      if (TOPUP_FINAL.includes(current.status)) {
        return;
      }

      if (
        current.orderCode !== Number(payment.orderCode) ||
        current.amount !== amountPaid ||
        (
          current.paymentLinkId &&
          current.paymentLinkId !== payment.id
        )
      ) {
        fail(
          409,
          "Thông tin giao dịch đã thay đổi; chưa thể cộng tiền"
        );
      }

      const wallet = await Wallet.findById(current.walletId)
        .select(MONEY_SELECT)
        .session(session);

      if (
        !wallet ||
        String(wallet.userId) !== String(current.userId)
      ) {
        throw new Error(
          "Không tìm thấy Ví phù hợp với giao dịch"
        );
      }

      await changeFunds(
        wallet,
        current,
        current.amount,
        0,
        "settle",
        session
      );

      current.status = "success";
      current.providerState = "PAID";
      current.paymentLinkId = payment.id;
      current.completedAt = new Date();
      current.lastSyncError = undefined;

      await current.save({ session });
    });
  } else if (
    ["CANCELLED", "EXPIRED", "FAILED"].includes(payment.status)
  ) {
    // Link kết thúc nhưng có tiền thực nhận:
    // giữ lại để đối soát, không bỏ qua khoản tiền này.
    if (amountPaid > 0) {
      return markTopupReview(
        transactionId,
        payment.status,
        "Link thanh toán đã kết thúc nhưng có tiền thực nhận. " +
          "Cần đối soát."
      );
    }

    await WalletTransaction.updateOne(
      {
        _id: transactionId,
        transactionType: "top_up",
        status: { $nin: TOPUP_FINAL },
      },
      {
        $set: {
          status:
            payment.status === "EXPIRED"
              ? "expired"
              : "failed",
          providerState: payment.status,
          paymentLinkId: payment.id,
          completedAt: new Date(),
        },
        $unset: {
          lastSyncError: 1,
        },
      }
    );
  } else if (payment.status === "PENDING") {
    if (amountPaid > 0) {
      return markTopupReview(
        transactionId,
        "PARTIAL_PAYMENT",
        "Đã ghi nhận tiền nhưng thanh toán chưa hoàn tất. " +
          "Cần đối soát."
      );
    }

    const hasPaymentDetails = Boolean(
      transaction.qrCode && transaction.checkoutUrl
    );

    const update = {
      $set: {
        status: hasPaymentDetails ? "pending" : "review",
        providerState: "PENDING",
        paymentLinkId: payment.id,
      },
    };

    if (hasPaymentDetails) {
      update.$unset = {
        lastSyncError: 1,
      };
    } else {
      update.$set.lastSyncError =
        "payOS đã có link thanh toán nhưng hệ thống " +
        "chưa nhận đủ dữ liệu QR.";
    }

    // Không để kết quả PENDING cũ ghi đè trạng thái đã hoàn tất.
    await WalletTransaction.updateOne(
      {
        _id: transactionId,
        transactionType: "top_up",
        status: { $in: TOPUP_OPEN },
      },
      update
    );
  } else {
    return markTopupReview(
      transactionId,
      "UNKNOWN_PAYMENT_STATE",
      "Chưa xác định được trạng thái thanh toán. Cần đối soát."
    );
  }

  return WalletTransaction.findById(transactionId);
}

async function finishWithdrawal(
  transactionId,
  succeeded,
  state,
  guard = {}
) {
  await inTransaction(async (session) => {
    const current = await WalletTransaction.findOne({
      _id: transactionId,
      transactionType: "withdraw",
      status: { $in: WITHDRAW_ACTIVE },
      ...guard,
    }).session(session);

    if (
      !current ||
      !WITHDRAW_ACTIVE.includes(current.status)
    ) {
      return;
    }

    if (!current.fundsReserved) {
      throw new Error(
        "Giao dịch rút chưa có tiền khóa tương ứng"
      );
    }

    const wallet = await Wallet.findById(current.walletId)
      .select(MONEY_SELECT)
      .session(session);

    if (!wallet) {
      throw new Error("Không tìm thấy Ví");
    }

    await changeFunds(
      wallet,
      current,
      succeeded ? -current.amount : 0,
      -current.amount,
      "settle",
      session
    );

    current.fundsReserved = false;
    current.status = succeeded ? "success" : "failed";
    current.providerState = state;
    current.completedAt = new Date();

    if (succeeded) {
      current.lastSyncError = undefined;
    }

    await current.save({ session });
  });
}

export async function expireQueuedWithdrawals() {
  const guard = expiredQueueFilter();

  const items = await WalletTransaction.find(guard)
    .select("_id")
    .limit(100)
    .lean();

  for (const item of items) {
    try {
      await finishWithdrawal(
        item._id,
        false,
        "QUEUE_TIMEOUT",
        guard
      );
    } catch {
      console.error(
        "Chưa giải phóng được khoản quá hạn:",
        String(item._id)
      );
    }
  }
}

export async function syncWithdrawal(
  transactionId,
  { throwOnError = false } = {}
) {
  let transaction = await WalletTransaction.findById(
    transactionId
  ).select("+bankEncrypted");

  if (
    !transaction ||
    transaction.transactionType !== "withdraw" ||
    !WITHDRAW_ACTIVE.includes(transaction.status)
  ) {
    return transaction;
  }

  let claimedHere = false;
  let callingCreate = false;

  try {
    // Phục hồi nếu đã ghi nhận tạo lệnh bị từ chối,
    // nhưng lần trước chưa hoàn tất giải phóng tiền.
    if (
      transaction.createRejected &&
      !transaction.payoutId
    ) {
      await finishWithdrawal(
        transactionId,
        false,
        "CREATE_REJECTED",
        {
          createRejected: true,
          payoutId: null,
        }
      );

      return WalletTransaction.findById(transactionId);
    }

    let payout;

    if (transaction.status === "queued") {
      // Bổ sung hạn một lần cho yêu cầu cũ chưa từng gửi.
      if (!transaction.withdrawDeadlineAt) {
        await WalletTransaction.updateOne(
          {
            _id: transactionId,
            status: "queued",
            submittedAt: null,
            payoutId: null,
            withdrawDeadlineAt: null,
          },
          {
            $set: {
              withdrawDeadlineAt: new Date(
                Date.now() + 60000
              ),
            },
          }
        );
      }

      // Chỉ một tiến trình được gửi lệnh.
      transaction = await WalletTransaction.findOneAndUpdate(
        {
          _id: transactionId,
          status: "queued",
          fundsReserved: true,
          submittedAt: null,
          payoutId: null,
          withdrawDeadlineAt: { $gt: new Date() },
        },
        {
          $set: {
            status: "submitting",
            submittedAt: new Date(),
          },
        },
        { returnDocument: "after" }
      ).select("+bankEncrypted");

      if (!transaction) {
        // Có thể yêu cầu đã quá hạn hoặc được tiến trình khác nhận.
        // Guard chỉ cho giải phóng yêu cầu chưa từng gửi sang payOS.
        await finishWithdrawal(
          transactionId,
          false,
          "QUEUE_TIMEOUT",
          expiredQueueFilter()
        );

        return WalletTransaction.findById(transactionId);
      }

      claimedHere = true;

      const bank = decryptValue(
        transaction.bankEncrypted,
        `${transaction._id}:bank`
      );

      callingCreate = true;

      payout = await createPayout(transaction, bank);
    } else {
      // Tránh đối soát khi request tạo lệnh còn đang chạy.
      if (
        transaction.status === "submitting" &&
        Date.now() -
          new Date(transaction.submittedAt).getTime() <
          45000
      ) {
        return transaction;
      }

      payout = await findPayout(transaction);
    }

    if (!payout) {
      throw Object.assign(
        new Error("Không tìm thấy payout"),
        {
          publicMessage:
            "Chưa tìm thấy lệnh chi để đối soát. " +
            "Chưa thể xác nhận hoàn tiền.",
        }
      );
    }

    const bank = decryptValue(
      transaction.bankEncrypted,
      `${transaction._id}:bank`
    );

    const entries = Object.values(
      payout.transactions || {}
    );

    const entry = entries.length === 1
      ? entries[0]
      : null;

    if (
      typeof payout.id !== "string" ||
      !payout.id ||
      payout.referenceId !== transaction.code ||
      !entry ||
      entry.referenceId !== transaction.code ||
      providerAmount(entry.amount) !== transaction.amount ||
      String(entry.toBin) !== bank.bankBin ||
      String(entry.toAccountNumber) !== bank.accountNumber
    ) {
      throw Object.assign(
        new Error("Payout không khớp giao dịch"),
        {
          publicMessage:
            "Kết quả chuyển tiền chưa khớp yêu cầu rút.",
        }
      );
    }

    await WalletTransaction.updateOne(
      {
        _id: transactionId,
        status: { $in: WITHDRAW_ACTIVE },
      },
      {
        $set: {
          payoutId: payout.id,
          providerState: entry.state,
        },
        $unset: {
          lastSyncError: 1,
        },
      }
    );

    if (entry.state === "SUCCEEDED") {
      await finishWithdrawal(
        transactionId,
        true,
        entry.state
      );
    } else if (
      ["FAILED", "CANCELLED"].includes(entry.state)
    ) {
      await finishWithdrawal(
        transactionId,
        false,
        entry.state
      );
    } else {
      await WalletTransaction.updateOne(
        {
          _id: transactionId,
          status: { $in: WITHDRAW_ACTIVE },
        },
        {
          $set: {
            status: "processing",
          },
        }
      );
    }
  } catch (error) {
    const message =
      error.publicMessage ||
      "Chưa xác minh được kết quả rút tiền. " +
        "Giao dịch đang chờ đối soát.";

    if (process.env.DEBUG_WALLET) {
      console.warn("[wallet-withdraw]", {
        transactionId: String(transactionId),
        operation: error.operation,
        httpStatus: error.httpStatus,
        providerCode: error.providerCode,
        providerMessage: error.message,
      });
    }

    const definitelyNotCreated =
      claimedHere &&
      (
        !callingCreate ||
        error.payoutNotCreated === true
      );

    if (definitelyNotCreated) {
      // Ghi nhận bằng chứng trước khi giải phóng tiền.
      await WalletTransaction.updateOne(
        {
          _id: transactionId,
          status: { $in: WITHDRAW_ACTIVE },
          payoutId: null,
        },
        {
          $set: {
            status: "review",
            createRejected: true,
            providerState: "CREATE_REJECTED",
            lastSyncError: message,
          },
        }
      );

      await finishWithdrawal(
        transactionId,
        false,
        "CREATE_REJECTED",
        {
          createRejected: true,
          payoutId: null,
        }
      );

      return WalletTransaction.findById(transactionId);
    }

    // Timeout/lỗi tra cứu không chứng minh lệnh chi thất bại.
    // Giữ queued nếu chưa gửi để lần sau còn xử lý hoặc hết hạn.
    await WalletTransaction.updateOne(
      {
        _id: transactionId,
        status: {
          $in: ["submitting", "processing", "review"],
        },
      },
      {
        $set: {
          status: "review",
          lastSyncError: message,
        },
      }
    );

    const latest = await WalletTransaction.findById(
      transactionId
    );

    if (
      latest &&
      !WITHDRAW_ACTIVE.includes(latest.status)
    ) {
      return latest;
    }

    if (throwOnError) {
      fail(502, message);
    }

    return latest;
  }

  return WalletTransaction.findById(transactionId);
}