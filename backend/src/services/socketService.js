import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

let io = null;

// Track online users: normalized username (lowercase) -> Set of socket IDs
const onlineUsers = new Map();

// Track socket to user mapping: socketId -> { id, username, name }
const socketUsers = new Map();

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "https://solitx.soumya.site",
        "https://study.soumya.site",
      ],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  // Authentication Middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error("Authentication token required"));
      }

      const secret = process.env.JWT_SECRET || "solitx_development_secret_key";
      const decoded = jwt.verify(token, secret);

      const userRes = await pool.query(
        "SELECT id, username, name FROM users WHERE id = $1",
        [decoded.id],
      );

      if (userRes.rowCount === 0) {
        return next(new Error("User account not found"));
      }

      socket.user = userRes.rows[0];
      next();
    } catch (err) {
      console.warn("Socket authentication failed:", err.message);
      next(new Error("Authentication error: " + err.message));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    if (!user || !user.username) {
      socket.disconnect();
      return;
    }

    const username = user.username.toLowerCase();
    const userId = user.id;

    // Join user-specific rooms
    socket.join(`user:${username}`);
    socket.join(`user_id:${userId}`);

    // Register active socket for user
    const wasOnline =
      onlineUsers.has(username) && onlineUsers.get(username).size > 0;
    if (!onlineUsers.has(username)) {
      onlineUsers.set(username, new Set());
    }
    onlineUsers.get(username).add(socket.id);
    socketUsers.set(socket.id, user);

    // If user just came online, notify others
    if (!wasOnline) {
      socket.broadcast.emit("user_status", {
        username: user.username,
        isOnline: true,
      });
    }

    // Send the newly connected user the list of currently online usernames
    const currentOnline = Array.from(onlineUsers.keys());
    socket.emit("initial_online_users", currentOnline);

    // ─── Real-Time Typing Indicator Event ────────────────────────────────────
    socket.on("typing", ({ recipientUsername, isTyping }) => {
      if (!recipientUsername) return;
      const targetUser = recipientUsername.toLowerCase().trim();

      // Emit typing event to recipient's personal room
      io.to(`user:${targetUser}`).emit("user_typing", {
        senderUsername: user.username,
        isTyping: Boolean(isTyping),
      });
    });

    // ─── Query Online Status Event ──────────────────────────────────────────
    socket.on("check_online", (usernames, callback) => {
      if (!Array.isArray(usernames)) return;
      const statusMap = {};
      usernames.forEach((u) => {
        const norm = String(u).toLowerCase().trim();
        statusMap[u] = onlineUsers.has(norm) && onlineUsers.get(norm).size > 0;
      });
      if (typeof callback === "function") {
        callback(statusMap);
      } else {
        socket.emit("online_status_response", statusMap);
      }
    });

    // ─── Disconnect Handling ────────────────────────────────────────────────
    socket.on("disconnect", () => {
      socketUsers.delete(socket.id);

      const userSockets = onlineUsers.get(username);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(username);
          // Broadcast offline event to all remaining clients
          socket.broadcast.emit("user_status", {
            username: user.username,
            isOnline: false,
            lastSeen: new Date().toISOString(),
          });
        }
      }
    });
  });

  return io;
};

export const getIO = () => {
  return io;
};

export const isUserOnline = (username) => {
  if (!username) return false;
  const norm = String(username).toLowerCase().trim();
  return onlineUsers.has(norm) && onlineUsers.get(norm).size > 0;
};

export const getOnlineUsernames = () => {
  return Array.from(onlineUsers.keys());
};

export const emitToUser = (username, event, payload) => {
  if (!io || !username) return;
  const norm = String(username).toLowerCase().trim();
  io.to(`user:${norm}`).emit(event, payload);
};

export const emitNewMessage = (recipientUsername, message) => {
  emitToUser(recipientUsername, "receive_message", message);
};
