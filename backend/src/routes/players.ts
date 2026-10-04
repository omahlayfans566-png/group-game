import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import User from '../models/User';
import PlayerGame from '../models/PlayerGame';
import ChallengeAttempt from '../models/ChallengeAttempt';
import Submission from '../models/Submission';
import Elimination from '../models/Elimination';
import Game from '../models/Game';
import GameDay from '../models/GameDay';

const router = Router();

// ─── Admin: Player Management ─────────────────────────────────────────────────

// GET /api/players  (admin only)
router.get('/', authenticate, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const players = await User.find({ role: 'player' })
      .select('-passwordHash')
      .sort({ playerNumber: 1 });
    res.json({ success: true, players });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/players  (admin manually creates a player account)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const Schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      nickname: z.string().min(2).max(30).optional().default(''),
    });

    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.flatten() });
      return;
    }

    const { email, password, nickname } = parsed.data;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ success: false, message: 'Email already in use' });
      return;
    }

    const user = new User({
      email: email.toLowerCase(),
      passwordHash: password,
      nickname,
      role: 'player',
      isSetupComplete: nickname.length > 0,
    });
    await user.save();

    res.status(201).json({ success: true, player: user });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/players/:userId  (admin: full; player: own profile only)
router.get('/:userId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user!.role === 'admin';
    const isOwn = String(req.user!._id) === req.params.userId;

    if (!isAdmin && !isOwn) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const user = await User.findById(req.params.userId).select('-passwordHash');
    if (!user) { res.status(404).json({ success: false, message: 'Player not found' }); return; }

    res.json({ success: true, player: user });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/players/:userId  (admin only)
router.patch('/:userId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const Schema = z.object({
      nickname: z.string().min(2).max(30).optional(),
      email: z.string().email().optional(),
      isActive: z.boolean().optional(),
      isSetupComplete: z.boolean().optional(),
      status: z.enum(['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE', 'ELIMINATED', 'FINALIST', 'WINNER']).optional(),
    });

    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.flatten() });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      parsed.data,
      { new: true }
    ).select('-passwordHash');

    if (!user) { res.status(404).json({ success: false, message: 'Player not found' }); return; }

    res.json({ success: true, player: user });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/players/:userId/reset-password  (admin only)
router.post('/:userId/reset-password', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { newPassword } = req.body as { newPassword: string };
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }

    const user = await User.findById(req.params.userId);
    if (!user) { res.status(404).json({ success: false, message: 'Player not found' }); return; }

    // Bypass pre-save hook to avoid double-hashing
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(newPassword, salt);
    await User.updateOne({ _id: user._id }, { $set: { passwordHash: hashed } });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/players/:userId  (admin only — deactivates, does not hard-delete)
router.delete('/:userId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findByIdAndUpdate(req.params.userId, { isActive: false }, { new: true });
    if (!user) { res.status(404).json({ success: false, message: 'Player not found' }); return; }
    res.json({ success: true, message: 'Player deactivated' });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Player: own game history ─────────────────────────────────────────────────

// GET /api/players/:userId/games
router.get('/:userId/games', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user!.role === 'admin';
    const isOwn = String(req.user!._id) === req.params.userId;
    if (!isAdmin && !isOwn) { res.status(403).json({ success: false, message: 'Forbidden' }); return; }

    const playerGames = await PlayerGame.find({ userId: req.params.userId })
      .populate('gameId', 'name status startDate currentDay')
      .sort({ createdAt: -1 });

    res.json({ success: true, games: playerGames });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/players/:userId/submissions?gameId=...
router.get('/:userId/submissions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user!.role === 'admin';
    const isOwn = String(req.user!._id) === req.params.userId;
    if (!isAdmin && !isOwn) { res.status(403).json({ success: false, message: 'Forbidden' }); return; }

    const filter: Record<string, unknown> = { userId: req.params.userId };
    if (req.query.gameId) filter.gameId = req.query.gameId;

    const submissions = await Submission.find(filter)
      .populate('challengeId', 'title dayNumber difficulty')
      .sort({ submittedAt: -1 });

    res.json({ success: true, submissions });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/players/:userId/attempts?challengeId=...
router.get('/:userId/attempts', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user!.role === 'admin';
    const isOwn = String(req.user!._id) === req.params.userId;
    if (!isAdmin && !isOwn) { res.status(403).json({ success: false, message: 'Forbidden' }); return; }

    const filter: Record<string, unknown> = { userId: req.params.userId };
    if (req.query.challengeId) filter.challengeId = req.query.challengeId;

    const attempts = await ChallengeAttempt.find(filter)
      .select('-individualPuzzleData')
      .sort({ createdAt: -1 });

    res.json({ success: true, attempts });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Elimination ──────────────────────────────────────────────────────────────

// POST /api/players/eliminate  (admin only)
router.post('/eliminate', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId, gameDayId, dayNumber, eliminationCount } = req.body as {
      gameId: string;
      gameDayId: string;
      dayNumber: number;
      eliminationCount: number;
    };

    if (!gameId || !gameDayId || !dayNumber || !eliminationCount) {
      res.status(400).json({ success: false, message: 'gameId, gameDayId, dayNumber, eliminationCount required' });
      return;
    }

    const gameDay = await GameDay.findById(gameDayId);
    if (!gameDay) { res.status(404).json({ success: false, message: 'Game day not found' }); return; }
    if (gameDay.eliminationsProcessed) {
      res.status(400).json({ success: false, message: 'Eliminations already processed for this day' });
      return;
    }

    const activePlayers = await PlayerGame.find({
      gameId,
      status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE'] },
    }).populate('userId', 'nickname playerNumber');

    const attempts = await ChallengeAttempt.find({
      gameId,
      gameDayId,
      status: { $in: ['COMPLETED', 'TIME_EXPIRED'] },
    });

    const scoreMap = new Map<string, { score: number; timeTaken: number }>();
    for (const a of attempts) {
      const uid = String(a.userId);
      const existing = scoreMap.get(uid);
      if (!existing || a.score > existing.score ||
        (a.score === existing.score && (a.timeTakenSeconds || 9999) < existing.timeTaken)) {
        scoreMap.set(uid, { score: a.score, timeTaken: a.timeTakenSeconds || 9999 });
      }
    }

    const ranked = activePlayers.map(pg => {
      const uid = String((pg.userId as { _id: unknown })._id || pg.userId);
      const s = scoreMap.get(uid);
      return { playerGame: pg, score: s?.score ?? 0, timeTaken: s?.timeTaken ?? 9999 };
    });

    ranked.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return b.timeTaken - a.timeTaken;
    });

    const toEliminate = ranked.slice(0, eliminationCount);
    const eliminated: string[] = [];

    for (let i = 0; i < toEliminate.length; i++) {
      const item = toEliminate[i];
      const uid = String((item.playerGame.userId as { _id: unknown })._id || item.playerGame.userId);

      await PlayerGame.findByIdAndUpdate(item.playerGame._id, {
        status: 'ELIMINATED',
        dayEliminated: dayNumber,
      });
      await User.findByIdAndUpdate(uid, { status: 'ELIMINATED' });

      const elim = new Elimination({
        gameId, gameDayId, dayNumber, userId: uid,
        score: item.score, rank: activePlayers.length - i,
        reason: 'LOWEST_SCORE', eliminatedAt: new Date(),
      });
      await elim.save();
      eliminated.push(uid);
    }

    await GameDay.findByIdAndUpdate(gameDayId, { eliminationsProcessed: true, status: 'COMPLETED' });

    const remaining = await PlayerGame.countDocuments({
      gameId,
      status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE'] },
    });

    const game = await Game.findById(gameId);
    if (game && remaining <= game.targetFinalists) {
      const finalistPGs = await PlayerGame.find({
        gameId,
        status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE'] },
      });
      await PlayerGame.updateMany(
        { gameId, status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE'] } },
        { status: 'FINALIST' }
      );
      await User.updateMany(
        { _id: { $in: finalistPGs.map(pg => pg.userId) } },
        { status: 'FINALIST' }
      );
    }

    res.json({ success: true, eliminated, remaining, message: `${eliminated.length} player(s) eliminated` });
  } catch (err) {
    console.error('Elimination error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/players/declare-winner  (admin only)
router.post('/declare-winner', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId, userId } = req.body as { gameId: string; userId: string };
    if (!gameId || !userId) {
      res.status(400).json({ success: false, message: 'gameId and userId required' });
      return;
    }
    await PlayerGame.findOneAndUpdate({ gameId, userId }, { status: 'WINNER' });
    await User.findByIdAndUpdate(userId, { status: 'WINNER' });
    await Game.findByIdAndUpdate(gameId, { status: 'COMPLETED' });
    res.json({ success: true, message: 'Winner declared' });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/players/eliminations/:gameId  (admin only)
router.get('/eliminations/:gameId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const eliminations = await Elimination.find({ gameId: req.params.gameId })
      .populate('userId', 'nickname playerNumber')
      .sort({ eliminatedAt: -1 });
    res.json({ success: true, eliminations });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
