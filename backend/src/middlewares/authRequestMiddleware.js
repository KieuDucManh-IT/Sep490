export default function authRequestMiddleware(req, res, next) {
  const allowedOrigin =
    process.env.FRONTEND_URL || "http://localhost:3000";

  const origin = req.get("Origin");

  if (origin && origin !== allowedOrigin) {
    return res.status(403).json({
      message: "Nguồn yêu cầu không được phép",
    });
  }

  if (!req.is("application/json")) {
    return res.status(415).json({
      message: "Request phải sử dụng application/json",
    });
  }

  next();
}