import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import connectDB from './config/db';
import { initSocket } from './services/socketService';
import { apiLimiter } from './middleware/rateLimiter';

import authRoutes from './routes/auth';
import gameRoutes from './routes/games';
import challengeRoutes from './routes/challenges';
import playerRoutes from './routes/players';
import eliminationRoutes from './routes/elimination';

const app = express();
const httpServer = http.createServer(app);

// ─── Security & Middleware ────────────────────────────────────────────────────

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy for accurate IP addresses behind reverse proxies
app.set('trust proxy', 1);

// ─── Rate limiting ────────────────────────────────────────────────────────────

app.use('/api/', apiLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/elimination', eliminationRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─── Startup ──────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = '0.0.0.0';

async function start(): Promise<void> {
  await connectDB();

  initSocket(httpServer);

  httpServer.listen(PORT, HOST, () => {
    console.log(`\n🚀 Survival Game Server running on ${HOST}:${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV}`);
    console.log(`   Client URL  : ${process.env.CLIENT_URL}`);
    console.log(`   Health      : http://localhost:${PORT}/api/health\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app, httpServer };
