const API_URL = (
  process.env.REACT_APP_API_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

async function request(path, { method = "GET", body } = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      headers:
        body === undefined
          ? {}
          : { "Content-Type": "application/json" },
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(
      "Không kết nối được backend. Kiểm tra server và cấu hình CORS."
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
    const error = new Error(
      data.message || "Yêu cầu không thành công"
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

function post(path, body) {
  return request(path, {
    method: "POST",
    body,
  });
}

// Giữ chức năng đăng ký.
export async function requestRegisterOtp(formData) {
  const data = await post("/auth/register", formData);

  if (!data.email || !data.challengeId) {
    throw new Error(
      "Backend chưa trả về thông tin xác minh OTP"
    );
  }

  return data;
}

export async function verifyRegisterOtp(payload) {
  const data = await post("/auth/register/verify-otp", payload);

  if (!data.user?.id) {
    throw new Error(
      "Chưa nhận được xác nhận tạo tài khoản từ backend"
    );
  }

  return data;
}

// Đăng nhập không OTP.
export async function loginApi(email, password) {
  const data = await post("/auth/login", {
    email,
    password,
  });

  if (!data.user?.id) {
    throw new Error(
      "Backend chưa trả về thông tin tài khoản"
    );
  }

  return data;
}

export async function getMeApi() {
  const apiUrl =
    process.env.REACT_APP_API_URL ||
    "http://localhost:5000/api";

  const response = await fetch(`${apiUrl}/auth/me`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.message || "Không lấy được thông tin đăng nhập"
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

export function logoutApi() {
  return post("/auth/logout", {});
}

export async function loginGoogleApi(credential) {
  const apiUrl =
    process.env.REACT_APP_API_URL ||
    "http://localhost:5000/api";

  const response = await fetch(`${apiUrl}/auth/google`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credential }),
  });

  const data = await response.json();

  if (!response.ok) {
    const details = Array.isArray(data.errors)
      ? data.errors
        .map((item) => `${item.field}: ${item.message}`)
        .join("; ")
      : "";

    const error = new Error(
      details ||
      data.message ||
      "Đăng nhập Google thất bại"
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

async function passwordRecoveryRequest(path, body) {
  const apiUrl =
    process.env.REACT_APP_API_URL ||
    "http://localhost:5000/api";

  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const details = Array.isArray(data.errors)
      ? data.errors.map((item) => item.message).join("; ")
      : "";

    const error = new Error(
      details || data.message || "Không thực hiện được yêu cầu"
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

export function forgotPasswordApi(email) {
  return passwordRecoveryRequest("/auth/forgot-password", {
    email,
  });
}

export function verifyForgotPasswordOtpApi(
  email,
  challengeId,
  otp
) {
  return passwordRecoveryRequest(
    "/auth/forgot-password/verify-otp",
    {
      email,
      challengeId,
      otp,
    }
  );
}

export function resetPasswordApi(
  email,
  resetToken,
  password,
  confirmPassword
) {
  return passwordRecoveryRequest("/auth/reset-password", {
    email,
    resetToken,
    password,
    confirmPassword,
  });
}

export async function changePasswordApi(
  currentPassword,
  newPassword,
  confirmNewPassword
) {
  const apiUrl =
    process.env.REACT_APP_API_URL ||
    "http://localhost:5000/api";

  const response = await fetch(`${apiUrl}/auth/change-password`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPassword,
      newPassword,
      confirmNewPassword,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const details = Array.isArray(data.errors)
      ? data.errors.map((item) => item.message).join("; ")
      : "";

    const error = new Error(
      details || data.message || "Không thể đổi mật khẩu"
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

export async function updateAvatarApi(file) {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await fetch(`${API_URL}/auth/avatar`, {
    method: "PATCH",
    credentials: "include",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.message || "Không cập nhật được ảnh đại diện"
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

export function updateProfileApi(payload) {
  return request("/auth/profile", {
    method: "PATCH",
    body: payload,
  });
}