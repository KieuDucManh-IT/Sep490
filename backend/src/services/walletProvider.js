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

async function payoutRequest(path, body, idempotencyKey) {
  const client = getPayoutClient();
  const credentials = config("PAYOS_PAYOUT");

  const headers = {
    "Content-Type": "application/json",
    "x-client-id": credentials.clientId,
    "x-api-key": credentials.apiKey,
  };

  if (body) {
    headers["x-idempotency-key"] = idempotencyKey;

    headers["x-signature"] = await client.crypto.createSignature(
      credentials.checksumKey,
      body
    );
  }

  const response = await fetch(
    `https://api-merchant.payos.vn${path}`,
    {
      method: body ? "POST" : "GET",
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    }
  );

  const data = await response.json();

  if (!response.ok || data.code !== "00") {
    const error = new Error(
      data.desc || "payOS chưa xác nhận được kết quả lệnh chi"
    );

    error.httpStatus = response.status;
    error.providerCode = data.code;

    throw error;
  }

  return data.data;
}

export function createPayout(transaction, bank) {
  const body = {
    referenceId: transaction.code,
    amount: transaction.amount,
    description: "Rut vi VESTORA",
    toBin: bank.bankBin,
    toAccountNumber: bank.accountNumber,
  };

  return payoutRequest("/v1/payouts", body, transaction.code);
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