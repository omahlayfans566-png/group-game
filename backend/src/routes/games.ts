import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import Game from '../models/Game';
import GameDay from '../models/GameDay';
import PlayerGame from '../models/PlayerGame';
import User from '../models/User';
import Announcement from '../models/Announcement';

const router = Router();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const DAY_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;

const CreateGameSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional().default(''),
  startDate: z.string().datetime(),
  targetFinalists: z.number().int().min(2).default(2),
});

const UpdateGameSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  startDate: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
  targetFinalists: z.number().int().min(2).optional(),
  currentDay: z.number().int().min(0).max(7).optional(),
  groupLink: z.string().url().optional(),
});

const GameDaySchema = z.object({
  dayNumber: z.number().int().min(1).max(7),
  dayOfWeek: z.enum(DAY_OF_WEEK),
  challengeStartTime: z.string().datetime(),
  challengeEndTime: z.string().datetime(),
  resultsAnnouncementTime: z.string().datetime().optional(),
  eliminationCount: z.number().int().min(0),
  notes: z.string().max(500).optional().default(''),
}).refine(data => new Date(data.challengeEndTime) > new Date(data.challengeStartTime), {
  message: 'Challenge close time must be after the 9:00 PM opening time',
  path: ['challengeEndTime'],
});

const AnnouncementSchema = z.object({
  type: z.enum(['GAME_START', 'CHALLENGE_OPEN', 'CHALLENGE_CLOSED', 'RESULTS', 'ELIMINATION', 'FINALISTS', 'WINNER', 'GENERAL', 'WARNING']),
  title: z.string().min(2).max(200),
  message: z.string().min(2).max(2000),
  dayNumber: z.number().int().min(1).max(7).optional(),
  mentionedUsers: z.array(z.string()).optional().default([]),
});

// ─── Game CRUD ────────────────────────────────────────────────────────────────

// GET /api/games  (admin: all games; player: active game info)
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user!.role === 'admin') {
      const games = await Game.find().sort({ createdAt: -1 });
      res.json({ success: true, games });
    } else {
      const games = await Game.find({ status: 'ACTIVE' }).select('-adminId').sort({ createdAt: -1 });
      res.json({ success: true, games });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/games  (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = CreateGameSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.flatten() });
      return;
    }

    const game = new Game({
      ...parsed.data,
      adminId: req.user!._id,
      groupLink: process.env.GROUP_LINK || '',
    });

    await game.save();
    res.status(201).json({ success: true, game });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/games/:gameId
router.get('/:gameId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const game = await Game.findById(req.params.gameId);
    if (!game) { res.status(404).json({ success: false, message: 'Game not found' }); return; }

    // Players only see active games
    if (req.user!.role !== 'admin' && game.status !== 'ACTIVE') {
      res.status(404).json({ success: false, message: 'Game not found' }); return;
    }

    res.json({ success: true, game });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/games/:gameId  (admin only)
router.patch('/:gameId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = UpdateGameSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.flatten() });
      return;
    }

    const game = await Game.findByIdAndUpdate(req.params.gameId, parsed.data, { new: true });
    if (!game) { res.status(404).json({ success: false, message: 'Game not found' }); return; }

    res.json({ success: true, game });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/games/:gameId  (admin only — only DRAFT games)
router.delete('/:gameId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const game = await Game.findById(req.params.gameId);
    if (!game) { res.status(404).json({ success: false, message: 'Game not found' }); return; }

    if (game.status !== 'DRAFT') {
      res.status(400).json({ success: false, message: 'Only DRAFT games can be deleted' });
      return;
    }

    await Game.deleteOne({ _id: game._id });
    await GameDay.deleteMany({ gameId: game._id });
    res.json({ success: true, message: 'Game deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Game Days ────────────────────────────────────────────────────────────────

// GET /api/games/:gameId/days
router.get('/:gameId/days', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const days = await GameDay.find({ gameId: req.params.gameId }).sort({ dayNumber: 1 });
    res.json({ success: true, days });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/games/:gameId/days  (admin only)
router.post('/:gameId/days', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = GameDaySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.flatten() });
      return;
    }

    const exists = await GameDay.findOne({ gameId: req.params.gameId, dayNumber: parsed.data.dayNumber });
    if (exists) {
      res.status(409).json({ success: false, message: `Day ${parsed.data.dayNumber} already exists for this game` });
      return;
    }

    const day = new GameDay({ ...parsed.data, gameId: req.params.gameId });
    await day.save();
    res.status(201).json({ success: true, day });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/games/:gameId/days/:dayId  (admin only)
router.patch('/:gameId/days/:dayId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedFields = ['status', 'challengeStartTime', 'challengeEndTime', 'resultsAnnouncementTime', 'eliminationCount', 'notes'];
    const update: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const currentDay = await GameDay.findOne({ _id: req.params.dayId, gameId: req.params.gameId });
    if (!currentDay) { res.status(404).json({ success: false, message: 'Day not found' }); return; }
    const start = update.challengeStartTime ? new Date(String(update.challengeStartTime)) : currentDay.challengeStartTime;
    const end = update.challengeEndTime ? new Date(String(update.challengeEndTime)) : currentDay.challengeEndTime;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      res.status(400).json({ success: false, message: 'Challenge close time must be after the opening time' }); return;
    }

    const day = await GameDay.findOneAndUpdate(
      { _id: req.params.dayId, gameId: req.params.gameId },
      update,
      { new: true }
    );

    if (!day) { res.status(404).json({ success: false, message: 'Day not found' }); return; }
    res.json({ success: true, day });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Player enrollment ────────────────────────────────────────────────────────

// POST /api/games/:gameId/enroll/:userId  (admin only)
router.post('/:gameId/enroll/:userId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId, userId } = req.params;

    const user = await User.findById(userId);
    if (!user || user.role !== 'player') {
      res.status(404).json({ success: false, message: 'Player not found' }); return;
    }

    const game = await Game.findById(gameId);
    if (!game) { res.status(404).json({ success: false, message: 'Game not found' }); return; }

    const existing = await PlayerGame.findOne({ userId, gameId });
    if (existing) {
      res.status(409).json({ success: false, message: 'Player already enrolled' }); return;
    }

    const pg = new PlayerGame({ userId, gameId });
    await pg.save();

    await Game.findByIdAndUpdate(gameId, { $inc: { totalPlayers: 1 } });

    res.status(201).json({ success: true, playerGame: pg });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/games/:gameId/enroll-bulk  (admin only) — enroll multiple players at once
router.post('/:gameId/enroll-bulk', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userIds } = req.body as { userIds: string[] };
    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ success: false, message: 'userIds array required' }); return;
    }

    const game = await Game.findById(req.params.gameId);
    if (!game) { res.status(404).json({ success: false, message: 'Game not found' }); return; }

    let enrolled = 0;
    for (const uid of userIds) {
      const exists = await PlayerGame.findOne({ userId: uid, gameId: game._id });
      if (!exists) {
        await new PlayerGame({ userId: uid, gameId: game._id }).save();
        enrolled++;
      }
    }

    await Game.findByIdAndUpdate(game._id, { $inc: { totalPlayers: enrolled } });
    res.json({ success: true, enrolled });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/games/:gameId/players  (admin: all fields; player: limited)
router.get('/:gameId/players', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user!.role === 'admin';
    const filter = isAdmin
      ? { gameId: req.params.gameId }
      : { gameId: req.params.gameId, userId: req.user!._id };
    const query = PlayerGame.find(filter)
      .populate('userId', 'playerNumber nickname email');
    if (!isAdmin) query.select('-totalScore -rank -dayEliminated -status');
    const playerGames = await query
      .sort({ totalScore: -1 });

    res.json({ success: true, players: playerGames });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/games/:gameId/stats  (admin only)
router.get('/:gameId/stats', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const total = await PlayerGame.countDocuments({ gameId: req.params.gameId });
    const active = await PlayerGame.countDocuments({ gameId: req.params.gameId, status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE'] } });
    const eliminated = await PlayerGame.countDocuments({ gameId: req.params.gameId, status: 'ELIMINATED' });
    const finalists = await PlayerGame.countDocuments({ gameId: req.params.gameId, status: 'FINALIST' });

    res.json({ success: true, stats: { total, active, eliminated, finalists } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Announcements ────────────────────────────────────────────────────────────

// GET /api/games/:gameId/announcements
router.get('/:gameId/announcements', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = { gameId: req.params.gameId };
    // Players only see published announcements
    if (req.user!.role !== 'admin') filter.isPublished = true;

    const announcements = await Announcement.find(filter)
      .populate('mentionedUsers', 'displayName username')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, announcements });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/games/:gameId/announcements  (admin only)
router.post('/:gameId/announcements', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = AnnouncementSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.flatten() });
      return;
    }

    const ann = new Announcement({
      ...parsed.data,
      gameId: req.params.gameId,
    });
    await ann.save();
    res.status(201).json({ success: true, announcement: ann });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/games/:gameId/announcements/:annId/publish  (admin only)
router.patch('/:gameId/announcements/:annId/publish', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ann = await Announcement.findOneAndUpdate(
      { _id: req.params.annId, gameId: req.params.gameId },
      { isPublished: true, publishedAt: new Date() },
      { new: true }
    );
    if (!ann) { res.status(404).json({ success: false, message: 'Announcement not found' }); return; }
    res.json({ success: true, announcement: ann });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
