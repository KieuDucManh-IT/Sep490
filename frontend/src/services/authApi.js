const API_URL = (
  process.env.REACT_APP_API_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

async function post(path, body) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Không kết nối được backend. Kiểm tra backend đang chạy và cấu hình CORS."
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Backend trả về dữ liệu không hợp lệ. Kiểm tra địa chỉ API."
    );
  }

  if (!response.ok) {
    throw new Error(data.message || "Yêu cầu không thành công");
  }

  return data;
}

export async function requestRegisterOtp(formData) {
  const data = await post("/auth/register", formData);

  if (!data.email || !data.challengeId) {
    throw new Error("Backend chưa trả về thông tin xác minh OTP");
  }

  return data;
}

export async function verifyRegisterOtp(payload) {
  const data = await post("/auth/register/verify-otp", payload);

  if (!data.user?.id) {
    throw new Error("Chưa nhận được xác nhận tạo tài khoản từ backend");
  }

  return data;
}