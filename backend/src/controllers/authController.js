import authService from "../services/authService.js";

export async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyRegisterOtp(req, res, next) {
  try {
    const result = await authService.verifyRegisterOtp(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export default {
  register,
  verifyRegisterOtp,
};