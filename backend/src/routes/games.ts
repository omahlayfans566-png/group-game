import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import Game from '../models/Game';
import GameDay from '../models/GameDay';
import PlayerGame from '../models/PlayerGame';
import User from '../models/User';
import Announcement from '../models/Announcement';
import Challenge from '../models/Challenge';
import ChallengeAttempt from '../models/ChallengeAttempt';
import Submission from '../models/Submission';
import Elimination from '../models/Elimination';

const router = Router();

function plainScheduleDay(day: unknown): Record<string, unknown> {
  const value = day as { toObject?: () => Record<string, unknown> };
  return typeof value.toObject === 'function' ? value.toObject() : day as Record<string, unknown>;
}

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

// GET /api/games/server-time
// The player dashboard uses this anchor for display-only countdowns.
router.get('/server-time', authenticate, (_req: AuthRequest, res: Response): void => {
  res.json({ success: true, serverNow: new Date().toISOString() });
});

// GET /api/games/schedule (player-safe schedule and server clock)
// This remains available when there is no ACTIVE game so the player can still
// see the seven-day arena. It never includes challenges or puzzle data.
router.get('/schedule', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const game = await Game.findOne({ status: { $in: ['ACTIVE', 'PAUSED', 'DRAFT'] } })
      .select('_id name status startDate currentDay groupLink')
      .sort({ status: 1, createdAt: -1 });
    const serverNow = new Date();
    const days = game
      ? await GameDay.find({ gameId: game._id }).select('-__v').sort({ dayNumber: 1 })
      : buildFallbackSchedule(serverNow);

    res.json({
      success: true,
      serverNow: serverNow.toISOString(),
      timezone: 'Africa/Lagos',
      game,
      days,
    });
  } catch (_err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/games/admin-overview (admin-only control center data)
router.get('/admin-overview', authenticate, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serverNow = new Date();
    const game = await Game.findOne({ status: { $in: ['ACTIVE', 'PAUSED', 'DRAFT'] } }).sort({ createdAt: -1 });
    const days = game
      ? await GameDay.find({ gameId: game._id }).sort({ dayNumber: 1 })
      : buildFallbackSchedule(serverNow);
    const players = await User.countDocuments({ role: 'player' });
    const activePlayers = await User.countDocuments({ role: 'player', isActive: true, status: { $nin: ['ELIMINATED'] } });
    const finalists = await User.countDocuments({ role: 'player', status: 'FINALIST' });
    const eliminated = await Elimination.countDocuments(game ? { gameId: game._id } : { _id: { $exists: false } });
    const dayRecords = days.map(plainScheduleDay);
    const completedDays = dayRecords.filter(day => new Date(String(day.challengeEndTime)).getTime() <= serverNow.getTime()).length;
    const today = dayRecords.find(day => serverNow >= new Date(String(day.challengeStartTime)) && serverNow < new Date(String(day.challengeEndTime)));
    const todayChallenge = game && today
      ? await Challenge.findOne({ gameId: game._id, dayNumber: today.dayNumber, isActive: true }).select('title challengeType difficulty durationSeconds totalStages')
      : null;
    const todayFilter = today && game ? { gameDayId: today._id } : { _id: { $exists: false } };
    const submittedToday = await ChallengeAttempt.countDocuments({ ...todayFilter, status: 'COMPLETED' });
    const expiredToday = await ChallengeAttempt.countDocuments({ ...todayFilter, status: 'TIME_EXPIRED' });
    const inProgressToday = await ChallengeAttempt.countDocuments({ ...todayFilter, status: 'IN_PROGRESS' });

    res.json({
      success: true,
      serverNow: serverNow.toISOString(),
      timezone: 'Africa/Lagos',
      game: game ? { _id: game._id, name: game.name, status: game.status, currentDay: game.currentDay, targetFinalists: game.targetFinalists } : null,
      days: dayRecords,
      stats: {
        totalPlayers: players,
        activePlayers,
        finalists,
        eliminated,
        totalGames: 7,
        completedGames: completedDays,
        submittedToday,
        expiredToday,
        inProgressToday,
        pendingToday: Math.max(0, activePlayers - submittedToday - expiredToday - inProgressToday),
      },
      today: today ? { ...today, challenge: todayChallenge } : null,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ success: false, message: 'Unable to load admin overview' });
  }
});

// GET /api/games/admin-schedule (admin-only seven-day schedule)
router.get('/admin-schedule', authenticate, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const game = await Game.findOne({ status: { $in: ['ACTIVE', 'PAUSED', 'DRAFT'] } }).sort({ createdAt: -1 });
    const serverNow = new Date();
    const days = game ? await GameDay.find({ gameId: game._id }).sort({ dayNumber: 1 }) : buildFallbackSchedule(serverNow);
    const challenges = game ? await Challenge.find({ gameId: game._id }).select('dayNumber title challengeType difficulty durationSeconds totalStages isActive') : [];
    const rows = await Promise.all(days.map(async day => {
      const attempts = game ? await ChallengeAttempt.find({ gameDayId: day._id }).select('status') : [];
      return {
        ...plainScheduleDay(day),
        challenge: challenges.find(challenge => challenge.dayNumber === day.dayNumber) || null,
        submitted: attempts.filter(attempt => attempt.status === 'COMPLETED').length,
        expired: attempts.filter(attempt => attempt.status === 'TIME_EXPIRED').length,
        pending: attempts.filter(attempt => attempt.status === 'IN_PROGRESS').length,
      };
    }));
    res.json({ success: true, serverNow: serverNow.toISOString(), timezone: 'Africa/Lagos', game, days: rows });
  } catch (err) {
    console.error('Admin schedule error:', err);
    res.status(500).json({ success: false, message: 'Unable to load admin schedule' });
  }
});

function buildFallbackSchedule(serverNow: Date): Array<Record<string, unknown>> {
  // Lagos is UTC+01:00 year-round. Build the current Monday in Lagos and
  // serialize each 21:00-21:30 window as an absolute UTC timestamp.
  const lagosNow = new Date(serverNow.getTime() + 60 * 60 * 1000);
  const lagosDay = lagosNow.getUTCDay() || 7;
  const mondayDate = new Date(Date.UTC(
    lagosNow.getUTCFullYear(),
    lagosNow.getUTCMonth(),
    lagosNow.getUTCDate() - lagosDay + 1,
    20,
    0,
  ));
  const dayNames = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  return dayNames.map((dayOfWeek, index) => {
    const start = new Date(mondayDate.getTime() + index * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    return {
      _id: `schedule-${index + 1}`,
      gameId: null,
      dayNumber: index + 1,
      dayOfWeek,
      status: 'UPCOMING',
      challengeStartTime: start.toISOString(),
      challengeEndTime: end.toISOString(),
      eliminationCount: 0,
      eliminationsProcessed: false,
      notes: '',
    };
  });
}

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

// ─── ADMIN GAME CONTROL — Open / Close a day ─────────────────────────────────

// POST /api/games/:gameId/days/:dayId/open  (admin only)
// Opens a game day for players. Optionally closes any other open day first.
router.post('/:gameId/days/:dayId/open', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId, dayId } = req.params;
    const { forceCloseOthers } = req.body as { forceCloseOthers?: boolean };

    const day = await GameDay.findOne({ _id: dayId, gameId });
    if (!day) { res.status(404).json({ success: false, message: 'Day not found' }); return; }

    // Check if another day is already open
    const alreadyOpen = await GameDay.findOne({ gameId, status: 'OPEN', _id: { $ne: dayId } });
    if (alreadyOpen && !forceCloseOthers) {
      res.status(409).json({
        success: false,
        message: `Day ${alreadyOpen.dayNumber} is currently open. Set forceCloseOthers:true to close it and open this one.`,
        openDay: { _id: alreadyOpen._id, dayNumber: alreadyOpen.dayNumber, dayOfWeek: alreadyOpen.dayOfWeek },
      });
      return;
    }

    // Close any other open day + its challenge
    if (alreadyOpen) {
      await GameDay.findByIdAndUpdate(alreadyOpen._id, { status: 'CLOSED' });
      await Challenge.updateMany({ gameDayId: alreadyOpen._id }, { isOpen: false });
    }

    // Set this day to OPEN + set challenge window from now to far future (admin closes manually)
    const startNow = new Date();
    const farEnd = new Date(startNow.getTime() + 24 * 60 * 60 * 1000); // 24h — admin closes manually

    await GameDay.findByIdAndUpdate(dayId, {
      status: 'OPEN',
      challengeStartTime: startNow,
      challengeEndTime: farEnd,
    });

    // Open + activate the challenge(s) for this day
    await Challenge.updateMany({ gameDayId: dayId }, { isOpen: true, isActive: true });

    // Update game currentDay
    await Game.findByIdAndUpdate(gameId, { currentDay: day.dayNumber, status: 'ACTIVE' });

    // Broadcast via socket
    const { emitToGame } = await import('../services/socketService');
    emitToGame(gameId, 'game:day:opened', { dayNumber: day.dayNumber });

    res.json({ success: true, message: `Day ${day.dayNumber} is now OPEN for players.`, dayNumber: day.dayNumber });
  } catch (err) {
    console.error('Open day error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/games/:gameId/days/:dayId/close  (admin only)
// Closes a game day. active attempts continue; only new starts are blocked.
router.post('/:gameId/days/:dayId/close', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId, dayId } = req.params;
    const { endActiveAttempts } = req.body as { endActiveAttempts?: boolean };

    const day = await GameDay.findOne({ _id: dayId, gameId });
    if (!day) { res.status(404).json({ success: false, message: 'Day not found' }); return; }

    // Close the day and its challenges (no new starts)
    await GameDay.findByIdAndUpdate(dayId, { status: 'CLOSED', challengeEndTime: new Date() });
    await Challenge.updateMany({ gameDayId: dayId }, { isOpen: false });

    // Optionally expire all active attempts immediately
    if (endActiveAttempts) {
      await ChallengeAttempt.updateMany(
        { gameDayId: dayId, status: 'IN_PROGRESS' },
        { status: 'TIME_EXPIRED', completedAt: new Date() }
      );
    }

    const { emitToGame } = await import('../services/socketService');
    emitToGame(gameId, 'game:day:closed', { dayNumber: day.dayNumber });

    res.json({
      success: true,
      message: `Day ${day.dayNumber} is now CLOSED.${endActiveAttempts ? ' Active attempts ended.' : ' Active attempts may continue until their personal timer expires.'}`,
    });
  } catch (err) {
    console.error('Close day error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/games/:gameId/days/:dayId/live-stats  (admin only)
// Returns live player counts for a game day
router.get('/:gameId/days/:dayId/live-stats', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId, dayId } = req.params;

    const challenges = await Challenge.find({ gameDayId: dayId });
    const challengeIds = challenges.map(c => c._id);

    const [submitted, active, expired, totalPlayers] = await Promise.all([
      ChallengeAttempt.countDocuments({ gameDayId: dayId, status: 'COMPLETED' }),
      ChallengeAttempt.countDocuments({ gameDayId: dayId, status: 'IN_PROGRESS' }),
      ChallengeAttempt.countDocuments({ gameDayId: dayId, status: 'TIME_EXPIRED' }),
      PlayerGame.countDocuments({ gameId, status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE', 'FINALIST', 'WINNER'] } }),
    ]);

    const started = submitted + active + expired;
    const pending = Math.max(0, totalPlayers - started);

    res.json({ success: true, stats: { totalPlayers, started, submitted, active, expired, pending } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/games/active-day  (player + admin) — returns the currently open day+challenge
router.get('/active-day', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const game = await Game.findOne({ status: 'ACTIVE' });
    if (!game) { res.json({ success: true, activeDay: null }); return; }

    const openDay = await GameDay.findOne({ gameId: game._id, status: 'OPEN' });
    if (!openDay) { res.json({ success: true, game: { _id: game._id, name: game.name }, activeDay: null }); return; }

    const challenges = await Challenge.find({ gameDayId: openDay._id, isActive: true })
      .select('-puzzleConfig');

    res.json({
      success: true,
      game: { _id: game._id, name: game.name, groupLink: game.groupLink },
      activeDay: openDay,
      challenges,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/games/all-days  (player) — returns all 7 days with their status + challenge meta
router.get('/all-days', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const game = await Game.findOne({ status: 'ACTIVE' });
    if (!game) { res.json({ success: true, game: null, days: [] }); return; }

    const days = await GameDay.find({ gameId: game._id }).sort({ dayNumber: 1 });

    // Get challenges — strip puzzle config for players
    const challenges = await Challenge.find({ gameId: game._id, isActive: true })
      .select('-puzzleConfig')
      .sort({ dayNumber: 1 });

    // Build day map with challenge info
    const dayData = days.map(d => {
      const ch = challenges.find(c => c.gameDayId.toString() === d._id.toString());
      return {
        _id: d._id,
        dayNumber: d.dayNumber,
        dayOfWeek: d.dayOfWeek,
        status: d.status,     // OPEN | CLOSED | UPCOMING | COMPLETED
        challenge: ch ? {
          _id: ch._id,
          title: ch.title,
          description: ch.description,
          difficulty: ch.difficulty,
          challengeType: ch.challengeType,
          durationSeconds: ch.durationSeconds,
          maxAttempts: ch.maxAttempts,
          totalStages: ch.totalStages,
          maxScore: ch.maxScore,
          isOpen: ch.isOpen,
          isActive: ch.isActive,
        } : null,
      };
    });

    res.json({
      success: true,
      game: { _id: game._id, name: game.name, groupLink: game.groupLink },
      days: dayData,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
