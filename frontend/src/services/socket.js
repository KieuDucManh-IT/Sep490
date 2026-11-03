import { io } from 'socket.io-client';

const rawBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000').trim();
const SOCKET_URL = rawBase.replace(/\/api\/?$/, '').replace(/\/+$/, '');

let socket = null;
let activeConversationId = null;

/**
 * Khởi tạo hoặc lấy kết nối Socket.IO
 */
export const getSocket = () => {
  if (socket && socket.connected) {
    return socket;
  }

  if (!socket) {
    let token = null;
    try {
      token = localStorage.getItem('token');
    } catch (_) {}

    socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: {
        token: token ? `Bearer ${token}` : '',
      },
    });

    socket.on('connect', () => {
      console.log('✅ Socket.IO đã kết nối:', socket.id);
      // Nếu trước đó đang mở cuộc trò chuyện thì tự động join lại
      if (activeConversationId) {
        socket.emit('conversation:join', { conversationId: activeConversationId });
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Lỗi kết nối Socket.IO:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO đã ngắt kết nối:', reason);
    });
  } else if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

/**
 * Ngắt kết nối socket (dùng khi đăng xuất)
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    activeConversationId = null;
  }
};

/**
 * Helper: Tham gia phòng hội thoại
 */
export const joinConversationRoom = (conversationId, callback) => {
  const s = getSocket();
  activeConversationId = conversationId;
  s.emit('conversation:join', { conversationId }, callback);
};

/**
 * Helper: Rời phòng hội thoại
 */
export const leaveConversationRoom = (conversationId) => {
  const s = getSocket();
  if (activeConversationId === conversationId) {
    activeConversationId = null;
  }
  s.emit('conversation:leave', { conversationId });
};

/**
 * Helper: Gửi tin nhắn qua Socket
 */
export const emitSendMessage = (data, callback) => {
  const s = getSocket();
  s.emit('message:send', data, callback);
};

/**
 * Helper: Đánh dấu đã đọc
 */
export const emitMarkRead = (conversationId) => {
  const s = getSocket();
  s.emit('message:read', { conversationId });
};

/**
 * Helper: Báo đang gõ
 */
export const emitTyping = (conversationId, isTyping) => {
  const s = getSocket();
  if (isTyping) {
    s.emit('typing:start', { conversationId });
  } else {
    s.emit('typing:stop', { conversationId });
  }
};

const socketService = {
  getSocket,
  disconnectSocket,
  joinConversationRoom,
  leaveConversationRoom,
  emitSendMessage,
  emitMarkRead,
  emitTyping,
};

export default socketService;
