import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!token) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    return null;
  }

  if (!socket || !socket.connected) {
    const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5015';
    // Strip trailing /api/v1 so Socket.io connects to the host root
    const socketUrl = rawApiUrl.replace(/\/api\/v1\/?$/, '');

    if (!socket) {
      socket = io(socketUrl, {
        auth: {
          token,
          username: user.username
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });

      socket.on('connect', () => {
        // Connected to SOLITX real-time socket
      });

      socket.on('connect_error', (err) => {
        console.warn('Socket connection notice:', err.message);
      });
    } else if (!socket.connected) {
      socket.auth = { token, username: user.username };
      socket.connect();
    }
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
