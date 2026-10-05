import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
  || (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin);

let socket: Socket | null = null;

export function connectSocket(token?: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: token ? { token } : {},
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function joinGameRoom(gameId: string): void {
  socket?.emit('join:game', gameId);
}

export function leaveGameRoom(gameId: string): void {
  socket?.emit('leave:game', gameId);
}
