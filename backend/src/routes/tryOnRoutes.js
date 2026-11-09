import express from "express";
import rateLimit from "express-rate-limit";
import { createDecartClient } from "@decartai/sdk";
import { authMiddleware } from "../middlewares/errorMiddleware.js";

const router = express.Router();

const limiter = rateLimit({
    windowMs: 60_000,
    max: 5,
    keyGenerator: (req) => String(req.user._id),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Bạn đã mở nhiều phiên thử đồ. Hãy chờ một phút.",
    },
});

router.post("/token", authMiddleware, limiter, async (req, res) => {
    res.set("Cache-Control", "no-store");

    const apiKey = process.env.DECART_API_KEY?.trim();

    if (!apiKey) {
        return res.status(503).json({
            message: "Backend chưa có DECART_API_KEY.",
        });
    }

    try {
        const client = createDecartClient({ apiKey });

        const token = await client.tokens.create({
            expiresIn: 120,
            allowedModels: ["lucy-vton-3.6"],
            allowedOrigins: (
                process.env.DECART_ALLOWED_ORIGINS || "http://localhost:3000"
            )
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            constraints: {
                realtime: {
                    maxSessionDuration: 30,
                },
            },
        });

        return res.json({
            apiKey: token.apiKey,
            expiresAt: token.expiresAt,
        });
    } catch (error) {
        const secret = process.env.DECART_API_KEY?.trim();
        const originalMessage = String(
            error?.message || "Không có thông tin lỗi"
        );

        // Che API key nếu nhà cung cấp trả lại trong thông báo.
        const safeMessage = secret
            ? originalMessage.split(secret).join("[HIDDEN]")
            : originalMessage;

        console.error("DECART_TOKEN_ERROR", {
            code: error?.code || null,
            httpStatus: error?.data?.status ?? error?.status ?? null,
            message: safeMessage.slice(0, 1500),
            causeCode: error?.cause?.code || null,
        });

        return res.status(502).json({
            message:
                "Không tạo được phiên Decart. Xem DECART_TOKEN_ERROR trong terminal backend.",
        });
    }
});

export default router;