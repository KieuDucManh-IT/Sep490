const API_URL = (
  process.env.REACT_APP_API_URL || "http://localhost:5001/api"
).replace(/\/$/, "");

export async function walletRequest(path = "", options = {}) {
  const { method = "GET", body } = options;

  const controller = new AbortController();
  const timeout = path.endsWith("/send-otp") ? 65000 : 30000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_URL}/wallet${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
      headers: method === "GET"
        ? {}
        : { "Content-Type": "application/json" },
      ...(method === "GET"
        ? {}
        : { body: JSON.stringify(body || {}) }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      throw Object.assign(
        new Error(
          data?.message || "Phản hồi từ hệ thống không hợp lệ."
        ),
        {
          status: response.status,
        }
      );
    }

    return data;
  } catch (error) {
    if (error.status) throw error;

    const hint = method === "GET"
      ? "Vui lòng tải lại sau."
      : "Kiểm tra email và lịch sử giao dịch trước khi thực hiện lại.";

    throw new Error(
      (controller.signal.aborted
        ? "Hệ thống phản hồi quá lâu. "
        : "Không kết nối được tới hệ thống. ") + hint
    );
  } finally {
    clearTimeout(timer);
  }
}

export function walletPost(path, body = {}) {
  return walletRequest(path, {
    method: "POST",
    body,
  });
}