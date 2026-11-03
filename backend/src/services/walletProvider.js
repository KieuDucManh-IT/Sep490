import { PayOS } from "@payos/node";

let collectClient;
let payoutClient;

function config(prefix) {
  const names = ["CLIENT_ID", "API_KEY", "CHECKSUM_KEY"];

  const values = names.map((name) => {
    const value = process.env[`${prefix}_${name}`]?.trim();

    if (!value) {
      throw new Error(`Thiếu ${prefix}_${name}`);
    }

    return value;
  });

  return {
    clientId: values[0],
    apiKey: values[1],
    checksumKey: values[2],
    timeout: 15000,
    maxRetries: 0,
    logLevel: "off",
  };
}

export function getCollectClient() {
  collectClient ||= new PayOS(config("PAYOS"));
  return collectClient;
}

function getPayoutClient() {
  payoutClient ||= new PayOS(config("PAYOS_PAYOUT"));
  return payoutClient;
}

export function checkPayoutConfig() {
  getPayoutClient();
}

async function payoutRequest(path, body, idempotencyKey, deadline) {
  const creating = Boolean(body);
  let requestStarted = false;

  try {
    const client = getPayoutClient();
    const credentials = config("PAYOS_PAYOUT");

    const headers = {
      "Content-Type": "application/json",
      "x-client-id": credentials.clientId,
      "x-api-key": credentials.apiKey,
    };

    if (creating) {
      headers["x-idempotency-key"] = idempotencyKey;

      headers["x-signature"] = await client.crypto.createSignature(
        credentials.checksumKey,
        body
      );
    }

    const payload = creating ? JSON.stringify(body) : undefined;

    // Kiểm tra lại hạn ngay trước khi gửi yêu cầu.
    if (creating && deadline != null) {
      const time = new Date(deadline).getTime();

      if (!Number.isFinite(time) || time <= Date.now()) {
        throw Object.assign(
          new Error("Hết thời hạn gửi lệnh rút"),
          {
            publicMessage: "Yêu cầu rút đã hết thời hạn gửi lệnh.",
          }
        );
      }
    }

    requestStarted = true;

    const response = await fetch(
      `https://api-merchant.payos.vn${path}`,
      {
        method: creating ? "POST" : "GET",
        headers,
        ...(creating ? { body: payload } : {}),
        signal: AbortSignal.timeout(15000),
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.code !== "00") {
      const error = new Error(
        data?.desc || "Phản hồi payOS không hợp lệ"
      );

      error.httpStatus = response.status;
      error.providerCode = data?.code;

      error.publicMessage = [401, 403].includes(response.status)
        ? "Dịch vụ chuyển tiền từ chối kết nối của hệ thống."
        : "Chưa xác minh được kết quả từ dịch vụ chuyển tiền.";

      // GET bị 403 không được coi là tạo lệnh thất bại.
      error.payoutNotCreated =
        creating &&
        [401, 403].includes(response.status) &&
        data?.code !== "00";

      throw error;
    }

    return data.data;
  } catch (error) {
    // Lỗi xảy ra trước khi gửi request: chắc chắn chưa tạo lệnh.
    if (creating && !requestStarted) {
      error.payoutNotCreated = true;
    }

    error.operation = creating ? "CREATE" : "LOOKUP";
    throw error;
  }
}

export function createPayout(transaction, bank) {
  return payoutRequest(
    "/v1/payouts",
    {
      referenceId: transaction.code,
      amount: transaction.amount,
      description: "Rut vi VESTORA",
      toBin: bank.bankBin,
      toAccountNumber: bank.accountNumber,
    },
    transaction.code,
    transaction.withdrawDeadlineAt
  );
}

export async function findPayout(transaction) {
  if (transaction.payoutId) {
    return payoutRequest(
      `/v1/payouts/${encodeURIComponent(transaction.payoutId)}`
    );
  }

  const query = new URLSearchParams({
    referenceId: transaction.code,
    limit: "2",
  });

  const data = await payoutRequest(`/v1/payouts?${query}`);

  const items = Object.values(data.payouts || {}).filter(
    (item) => item.referenceId === transaction.code
  );

  if (items.length > 1) {
    throw new Error("Có nhiều lệnh chi trùng mã tham chiếu");
  }

  return items[0] || null;
}