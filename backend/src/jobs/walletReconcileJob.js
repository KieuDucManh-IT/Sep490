import { WalletTransaction } from "../models/finance/WalletTransaction.js";

import {
  syncTopup,
  syncWithdrawal,
  expireQueuedWithdrawals,
} from "../services/walletService.js";

const ACTIVE = [
  "pending",
  "queued",
  "submitting",
  "processing",
  "review",
];

export function startWalletReconcileJob() {
  let running = false;
  let expiring = false;

  async function expire() {
    if (expiring) return;
    expiring = true;

    try {
      await expireQueuedWithdrawals();
    } catch {
      console.error("Chưa chạy được tác vụ giải phóng tiền quá hạn");
    } finally {
      expiring = false;
    }
  }

  async function worker() {
    for (let i = 0; i < 5; i += 1) {
      const lease = new Date(Date.now() + 60000);

      const transaction = await WalletTransaction.findOneAndUpdate(
        {
          transactionType: { $in: ["top_up", "withdraw"] },
          status: { $in: ACTIVE },
          nextCheckAt: { $lte: new Date() },
        },
        {
          $set: {
            nextCheckAt: lease,
          },
        },
        {
          new: true,
          sort: { nextCheckAt: 1 },
        }
      );

      if (!transaction) return;

      let result;

      try {
        result = transaction.transactionType === "top_up"
          ? await syncTopup(transaction._id)
          : await syncWithdrawal(transaction._id);
      } catch {
        console.warn(
          "Chưa đối soát được giao dịch:",
          String(transaction._id)
        );
      } finally {
        const delay = !result || result.status === "review"
          ? 30000
          : transaction.transactionType === "top_up"
            ? 10000
            : 5000;

        await WalletTransaction.updateOne(
          {
            _id: transaction._id,
            nextCheckAt: lease,
            status: { $in: ACTIVE },
          },
          {
            $set: {
              nextCheckAt: new Date(Date.now() + delay),
            },
          }
        );
      }
    }
  }

  async function run() {
    if (running) return;
    running = true;

    try {
      await WalletTransaction.updateMany(
        {
          transactionType: "withdraw",
          status: "otp_pending",
          otpExpiresAt: { $lte: new Date() },
        },
        {
          $set: { status: "expired" },
          $unset: { otpHash: 1 },
        }
      );

      // Tối đa hai tiến trình gọi payOS đồng thời.
      const results = await Promise.allSettled([
        worker(),
        worker(),
      ]);

      if (results.some((item) => item.status === "rejected")) {
        console.error("Một tiến trình đối soát Ví gặp lỗi database");
      }
    } catch {
      console.error("Tác vụ đối soát Ví gặp lỗi");
    } finally {
      running = false;
    }
  }

  const timer = setInterval(run, 3000);

  // Chạy riêng, không phải chờ lời gọi payOS.
  const expiryTimer = setInterval(expire, 1000);

  timer.unref();
  expiryTimer.unref();

  void run();
  void expire();

  return () => {
    clearInterval(timer);
    clearInterval(expiryTimer);
  };
}