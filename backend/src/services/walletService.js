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

export async function inTransaction(callback) {
  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(
      () => callback(session),
      {
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

  if (!wallet.passwordHash) {
    fail(403, "Bạn cần thiết lập mật khẩu Ví trước");
  }

  if (wallet.status !== "active") {
    fail(423, "Ví đang bị khóa");
  }

  return wallet;
}

export function readBalances(wallet) {
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
    throw new Error("Cập nhật tiền phải nằm trong database transaction");
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
    fail(409, "Số dư khả dụng không đủ hoặc tiền khóa không khớp");
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
  const transaction = await WalletTransaction.findById(transactionId);

  if (!transaction || transaction.transactionType !== "top_up") {
    fail(404, "Không tìm thấy giao dịch nạp");
  }

  if (transaction.status === "success") return transaction;

  const payment = await getCollectClient().paymentRequests.get(
    transaction.orderCode
  );

  if (Number(payment.orderCode) !== transaction.orderCode) {
    throw new Error("Mã thanh toán trả về không khớp");
  }

  if (payment.status === "PAID") {
    if (
      Number(payment.amount) !== transaction.amount ||
      Number(payment.amountPaid) !== transaction.amount
    ) {
      await WalletTransaction.updateOne(
        { _id: transactionId, status: { $ne: "success" } },
        {
          $set: {
            status: "review",
            providerState: "AMOUNT_MISMATCH",
          },
        }
      );

      return WalletTransaction.findById(transactionId);
    }

    await inTransaction(async (session) => {
      const current = await WalletTransaction.findById(
        transactionId
      ).session(session);

      if (current.status === "success") return;

      const wallet = await Wallet.findById(current.walletId)
        .select(MONEY_SELECT)
        .session(session);

      if (!wallet) throw new Error("Không tìm thấy Ví");

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
      current.completedAt = new Date();

      await current.save({ session });
    });
  } else if (
    ["CANCELLED", "EXPIRED", "FAILED"].includes(payment.status)
  ) {
    await WalletTransaction.updateOne(
      { _id: transactionId, status: { $ne: "success" } },
      {
        $set: {
          status: payment.status === "EXPIRED" ? "expired" : "failed",
          providerState: payment.status,
        },
      }
    );
  }

  return WalletTransaction.findById(transactionId);
}

async function finishWithdrawal(transactionId, succeeded, state, guard = {}) {
  await inTransaction(async (session) => {
    const current = await WalletTransaction.findOne({
      _id: transactionId,
      transactionType: "withdraw",
      status: { $in: WITHDRAW_ACTIVE },
      ...guard,
    }).session(session);

    if (!current || !WITHDRAW_ACTIVE.includes(current.status)) {
      return;
    }

    if (!current.fundsReserved) {
      throw new Error("Giao dịch rút chưa có tiền khóa tương ứng");
    }

    const wallet = await Wallet.findById(current.walletId)
      .select(MONEY_SELECT)
      .session(session);

    if (!wallet) throw new Error("Không tìm thấy Ví");

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

    await current.save({ session });
  });
}
export async function expireQueuedWithdrawals() {
  const guard = {
    transactionType: "withdraw",
    status: "queued",
    fundsReserved: true,
    submittedAt: null,
    payoutId: null,
    withdrawDeadlineAt: { $lte: new Date() },
  };

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
  let transaction = await WalletTransaction.findById(transactionId)
    .select("+bankEncrypted");

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
    if (transaction.createRejected && !transaction.payoutId) {
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
      // Yêu cầu cũ còn trong hàng chờ, chưa gửi:
      // bổ sung hạn một lần khi bắt đầu xử lý.
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
              withdrawDeadlineAt: new Date(Date.now() + 60000),
            },
          }
        );
      }

      // Chỉ một tiến trình được gửi lệnh.
      // Không nhận xử lý yêu cầu đã hết hạn.
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
        { new: true }
      ).select("+bankEncrypted");

      if (!transaction) {
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
      // Tránh đối soát khi yêu cầu tạo lệnh còn đang chạy.
      if (
        transaction.status === "submitting" &&
        Date.now() -
        new Date(transaction.submittedAt).getTime() < 45000
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
            "Chưa tìm thấy lệnh chi để đối soát. Chưa thể xác nhận hoàn tiền.",
        }
      );
    }

    const bank = decryptValue(
      transaction.bankEncrypted,
      `${transaction._id}:bank`
    );

    const entries = Object.values(payout.transactions || {});
    const entry = entries.length === 1 ? entries[0] : null;

    if (
      payout.referenceId !== transaction.code ||
      !entry ||
      entry.referenceId !== transaction.code ||
      Number(entry.amount) !== transaction.amount ||
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
    } else if (["FAILED", "CANCELLED"].includes(entry.state)) {
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
      "Chưa xác minh được kết quả rút tiền. Giao dịch đang chờ đối soát.";

    console.warn("[wallet-withdraw]", {
      transactionId: String(transactionId),
      operation: error.operation,
      httpStatus: error.httpStatus,
      providerCode: error.providerCode,
    });

    const definitelyNotCreated =
      claimedHere &&
      (!callingCreate || error.payoutNotCreated === true);

    if (definitelyNotCreated) {
      // Lưu bằng chứng trước khi giải phóng tiền.
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

    // Timeout hoặc lỗi tra cứu chưa chứng minh lệnh thất bại.
    await WalletTransaction.updateOne(
      {
        _id: transactionId,
        status: { $in: WITHDRAW_ACTIVE },
      },
      {
        $set: {
          status: "review",
          lastSyncError: message,
        },
      }
    );

    const latest = await WalletTransaction.findById(transactionId);

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