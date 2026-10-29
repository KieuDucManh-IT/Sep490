const API_URL = (
  process.env.REACT_APP_API_URL || "http://localhost:5001/api"
).replace(/\/$/, "");

export async function walletRequest(path = "", options = {}) {
  const { method = "GET", body } = options;

  const response = await fetch(`${API_URL}/wallet${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
    headers:
      method === "GET"
        ? {}
        : { "Content-Type": "application/json" },
    ...(method === "GET"
      ? {}
      : { body: JSON.stringify(body || {}) }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.message || "Không thực hiện được thao tác Ví"
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

export function walletPost(path, body = {}) {
  return walletRequest(path, {
    method: "POST",
    body,
  });
}