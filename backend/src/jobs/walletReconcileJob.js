import { WalletTransaction } from "../models/finance/WalletTransaction.js";

import {
  syncTopup,
  syncWithdrawal,
} from "../services/walletService.js";

export function startWalletReconcileJob() {
  let running = false;

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

      for (let i = 0; i < 10; i += 1) {
        // Claim bằng database để các instance không quét cùng lúc.
        const transaction = await WalletTransaction.findOneAndUpdate(
          {
            transactionType: { $in: ["top_up", "withdraw"] },
            status: {
              $in: [
                "pending",
                "queued",
                "submitting",
                "processing",
                "review",
              ],
            },
            nextCheckAt: { $lte: new Date() },
          },
          {
            $set: {
              nextCheckAt: new Date(Date.now() + 60000),
            },
          },
          {
            new: true,
            sort: { nextCheckAt: 1 },
          }
        );

        if (!transaction) break;

        try {
          if (transaction.transactionType === "top_up") {
            const synced = await syncTopup(transaction._id);

            if (synced?.status === "pending") {
              await WalletTransaction.updateOne(
                {
                  _id: transaction._id,
                  status: "pending",
                  nextCheckAt: transaction.nextCheckAt,
                },
                {
                  $set: {
                    nextCheckAt: new Date(Date.now() + 10000),
                  },
                }
              );
            }
          } else {
            await syncWithdrawal(transaction._id);
          }
        } catch {
          console.warn(
            "Chưa đối soát được giao dịch Ví:",
            String(transaction._id)
          );
        }
      }
    } catch {
      console.error("Tác vụ đối soát Ví tạm thời không chạy được");
    } finally {
      running = false;
    }
  }

  const timer = setInterval(run, 3000);
  timer.unref();

  void run();

  return () => clearInterval(timer);
}