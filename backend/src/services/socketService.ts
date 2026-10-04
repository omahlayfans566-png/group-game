import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware for socket connections
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      // Allow unauthenticated connections to public rooms (landing page)
      socket.data.userId = null;
      socket.data.role = 'guest';
      return next();
    }

    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET not configured');
      const decoded = jwt.verify(token, secret) as { userId: string; role: string };
      socket.data.userId = decoded.userId;
      socket.data.role = decoded.role;
      next();
    } catch {
      socket.data.userId = null;
      socket.data.role = 'guest';
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string | null;
    const role = socket.data.role as string;

    // Join personal room if authenticated
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // Admins join admin room
    if (role === 'admin') {
      socket.join('admin');
    }

    // Join game room
    socket.on('join:game', (gameId: string) => {
      if (typeof gameId === 'string' && gameId.length > 0) {
        socket.join(`game:${gameId}`);
      }
    });

    // Leave game room
    socket.on('leave:game', (gameId: string) => {
      socket.leave(`game:${gameId}`);
    });

    socket.on('disconnect', () => {
      // cleanup handled automatically
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

// ─── Emit helpers ─────────────────────────────────────────────────────────────

export function emitToGame(gameId: string, event: string, data: unknown): void {
  io?.to(`game:${gameId}`).emit(event, data);
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  io?.to(`user:${userId}`).emit(event, data);
}

export function emitToAdmins(event: string, data: unknown): void {
  io?.to('admin').emit(event, data);
}

export function emitToAll(event: string, data: unknown): void {
  io?.emit(event, data);
}

// ─── Game Events ──────────────────────────────────────────────────────────────

export function broadcastAnnouncement(gameId: string, announcement: unknown): void {
  emitToGame(gameId, 'announcement', announcement);
}

export function broadcastChallengeOpened(gameId: string, challengeData: unknown): void {
  emitToGame(gameId, 'challenge:opened', challengeData);
}

export function broadcastChallengeClosed(gameId: string, challengeId: string): void {
  emitToGame(gameId, 'challenge:closed', { challengeId });
}

export function broadcastElimination(gameId: string, data: unknown): void {
  emitToGame(gameId, 'elimination', data);
}

export function broadcastGameStatusUpdate(gameId: string, data: unknown): void {
  emitToGame(gameId, 'game:status', data);
}

export function broadcastPlayerCount(gameId: string, remaining: number): void {
  emitToGame(gameId, 'players:count', { remaining });
}
