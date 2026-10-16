import {
  register as registerAccount,
  verifyRegisterOtp as verifyRegistration,
  login as loginAccount,
  loginGoogle as loginGoogleAccount,
  toPublicUser,
} from "../services/authService.js";

const COOKIE_NAME = "vestora_token";
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

export async function register(req, res, next) {
  try {
    const result = await registerAccount(req.body);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyRegisterOtp(req, res, next) {
  try {
    const result = await verifyRegistration(req.body);

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = await loginAccount(req.body);

    res.cookie(COOKIE_NAME, result.token, {
      ...cookieOptions(),
      maxAge: COOKIE_MAX_AGE,
    });

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      message: "Đăng nhập thành công",
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

// Đăng nhập bằng Google.
export async function loginGoogle(req, res, next) {
  try {
    const result = await loginGoogleAccount(req.body);

    res.cookie(COOKIE_NAME, result.token, {
      ...cookieOptions(),
      maxAge: COOKIE_MAX_AGE,
    });

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      message: "Đăng nhập Google thành công",
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

export function getMe(req, res) {
  res.cookie(COOKIE_NAME, req.cookies[COOKIE_NAME], {
    ...cookieOptions(),
    maxAge: COOKIE_MAX_AGE,
  });

  res.set("Cache-Control", "no-store");

  return res.status(200).json({
    user: toPublicUser(req.user),
  });
}

export function logout(req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());

  res.set("Cache-Control", "no-store");

  return res.status(200).json({
    message: "Đăng xuất thành công",
  });
}