const authService = require("../services/authService");

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function verifyRegisterOtp(req, res, next) {
  try {
    const result = await authService.verifyRegisterOtp(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  verifyRegisterOtp,
};