import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/system/User.js';
import registerChatHandlers from './chatHandler.js';

// Map theo dõi số kết nối đang hoạt động của mỗi User (Hỗ trợ nhiều tab an toàn)
// Map<userIdString, Set<socketId>>
export const userConnections = new Map();

/**
 * Trích xuất danh sách token ứng viên từ handshake Socket.IO
 */
function extractCandidateTokens(socket) {
  const tokens = [];

  // 1. Phân tích cookie từ socket.handshake.headers.cookie (Ưu tiên cookie HttpOnly chuẩn của VESTORA)
  const cookieHeader = socket.handshake.headers?.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith('vestora_token=')) {
        tokens.push(decodeURIComponent(c.substring('vestora_token='.length)));
      }
    }
  }

  // 2. Thử lấy từ socket.handshake.auth.token
  const authToken = socket.handshake.auth?.token;
  if (authToken && typeof authToken === 'string') {
    const clean = authToken.replace(/^Bearer\s+/i, '').trim();
    if (clean && clean !== 'undefined' && clean !== 'null') {
      tokens.push(clean);
    }
  }

  // 3. Thử lấy từ authorization header
  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader && typeof authHeader === 'string' && /^Bearer\s+/i.test(authHeader)) {
    const clean = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (clean && clean !== 'undefined' && clean !== 'null') {
      tokens.push(clean);
    }
  }

  return tokens;
}

export function initSocket(httpServer, allowedOrigins) {
  const io = new Server(httpServer, {
    cors: {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 15000,
  });

  // Middleware xác thực JWT cho Socket.IO
  io.use(async (socket, next) => {
    try {
      const tokens = extractCandidateTokens(socket);
      if (tokens.length === 0) {
        return next(new Error('AUTHENTICATION_ERROR: Bạn chưa đăng nhập'));
      }

      if (!process.env.JWT_SECRET) {
        return next(new Error('SERVER_CONFIG_ERROR: Chưa cấu hình JWT_SECRET'));
      }

      let payload = null;
      for (const token of tokens) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: 'vestora',
            audience: 'vestora-web',
          });
          if (decoded.sub && /^[a-f0-9]{24}$/i.test(decoded.sub)) {
            payload = decoded;
            break;
          }
        } catch (_) {}
      }

      if (!payload) {
        return next(new Error('AUTHENTICATION_ERROR: Token không hợp lệ hoặc đã hết hạn'));
      }

      const user = await User.findById(payload.sub).lean();
      if (!user) {
        return next(new Error('AUTHENTICATION_ERROR: Tài khoản không tồn tại'));
      }

      if (user.Status !== 'active') {
        return next(new Error('AUTHORIZATION_ERROR: Tài khoản đã bị khóa'));
      }

      // Theo yêu cầu người dùng: bỏ role admin không can thiệp vào chat
      const roleStr = String(user.Role || user.role || '').toLowerCase();
      if (roleStr === 'admin') {
        return next(new Error('AUTHORIZATION_ERROR: Admin không có quyền truy cập Chat tư vấn'));
      }

      socket.user = user;
      return next();
    } catch (err) {
      return next(new Error('AUTHENTICATION_ERROR: ' + (err.message || 'Xác thực thất bại')));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.user._id);

    // 1. Quản lý Presence (Online / Offline)
    let userSockets = userConnections.get(userId);
    if (!userSockets) {
      userSockets = new Set();
      userConnections.set(userId, userSockets);
      // Thông báo User đã Online nếu đây là kết nối đầu tiên
      io.emit('user:presence', { userId, isOnline: true });
    }
    userSockets.add(socket.id);

    // 2. Tự động đưa socket vào phòng riêng của người dùng
    socket.join(`user:${userId}`);

    // Gửi danh sách các user đang online cho socket mới kết nối
    const onlineUserIds = Array.from(userConnections.keys());
    socket.emit('users:online:list', { onlineUserIds });

    // 3. Đăng ký các sự kiện Chat
    registerChatHandlers(io, socket);

    // 4. Xử lý ngắt kết nối
    socket.on('disconnect', () => {
      const currentSockets = userConnections.get(userId);
      if (currentSockets) {
        currentSockets.delete(socket.id);
        if (currentSockets.size === 0) {
          userConnections.delete(userId);
          // Người dùng đã offline toàn bộ các tab
          io.emit('user:presence', { userId, isOnline: false });
        }
      }
    });
  });

  return io;
}
