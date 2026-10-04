/**
 * elimination.ts
 * Admin-only routes for elimination schedule management.
 * Core rule: total eliminations across Mon–Sat must equal (enrolledPlayers - 2).
 */

import { Router, Response } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import Game from '../models/Game';
import GameDay from '../models/GameDay';
import PlayerGame from '../models/PlayerGame';
import User from '../models/User';
import Elimination from '../models/Elimination';
import ChallengeAttempt from '../models/ChallengeAttempt';

const router = Router();

// ─── GET /api/elimination/:gameId/schedule ────────────────────────────────────
// Returns current elimination schedule + validation status

router.get('/:gameId/schedule', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;

    const game = await Game.findById(gameId);
    if (!game) { res.status(404).json({ success: false, message: 'Game not found' }); return; }

    const days = await GameDay.find({ gameId }).sort({ dayNumber: 1 });
    const activePlayers = await PlayerGame.countDocuments({
      gameId,
      status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE', 'FINALIST'] },
    });

    const requiredEliminations = Math.max(0, activePlayers - game.targetFinalists);
    const scheduledTotal = days
      .filter(d => d.dayNumber < 7)                // Mon–Sat only
      .reduce((sum, d) => sum + d.eliminationCount, 0);

    const isValid = scheduledTotal === requiredEliminations;

    res.json({
      success: true,
      schedule: days.map(d => ({
        _id: d._id,
        dayNumber: d.dayNumber,
        dayOfWeek: d.dayOfWeek,
        eliminationCount: d.eliminationCount,
        eliminationsProcessed: d.eliminationsProcessed,
        status: d.status,
      })),
      stats: {
        activePlayers,
        targetFinalists: game.targetFinalists,
        requiredEliminations,
        scheduledTotal,
        isValid,
        difference: scheduledTotal - requiredEliminations,
      },
    });
  } catch (err) {
    console.error('Schedule fetch error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/elimination/:gameId/auto-generate ──────────────────────────────
// Automatically distributes N-2 eliminations evenly across Mon–Sat days.
// Admin can override afterwards.

router.post('/:gameId/auto-generate', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;

    const game = await Game.findById(gameId);
    if (!game) { res.status(404).json({ success: false, message: 'Game not found' }); return; }

    const activePlayers = await PlayerGame.countDocuments({
      gameId,
      status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE', 'FINALIST', 'ACTIVE'] },
    });

    // Also count players who are just enrolled but haven't played yet
    const totalEnrolled = await PlayerGame.countDocuments({ gameId });

    const totalPlayers = Math.max(activePlayers, totalEnrolled);
    const requiredEliminations = Math.max(0, totalPlayers - game.targetFinalists);

    // Get Mon–Sat days (dayNumber 1–6)
    const weekdays = await GameDay.find({ gameId, dayNumber: { $lte: 6 } }).sort({ dayNumber: 1 });

    if (weekdays.length === 0) {
      res.status(400).json({ success: false, message: 'No weekday game days configured. Create days 1–6 first.' });
      return;
    }

    if (requiredEliminations <= 0) {
      res.status(400).json({
        success: false,
        message: `Only ${totalPlayers} player(s) enrolled. Need more than ${game.targetFinalists} to run eliminations.`,
      });
      return;
    }

    // Distribute eliminations as evenly as possible across the days
    const numDays = weekdays.length;
    const basePerDay = Math.floor(requiredEliminations / numDays);
    const remainder  = requiredEliminations % numDays;

    // Spread the remainder across later days (harder days get slightly more)
    const distribution: number[] = weekdays.map((_, i) => basePerDay + (i >= numDays - remainder ? 1 : 0));

    // Update each day
    const updates: Array<{ dayNumber: number; eliminationCount: number }> = [];
    for (let i = 0; i < weekdays.length; i++) {
      await GameDay.findByIdAndUpdate(weekdays[i]._id, { eliminationCount: distribution[i] });
      updates.push({ dayNumber: weekdays[i].dayNumber, eliminationCount: distribution[i] });
    }

    res.json({
      success: true,
      message: `Elimination schedule generated: ${requiredEliminations} eliminations distributed across ${numDays} days.`,
      distribution: updates,
      stats: {
        totalPlayers,
        requiredEliminations,
        targetFinalists: game.targetFinalists,
        daysUsed: numDays,
      },
    });
  } catch (err) {
    console.error('Auto-generate error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PATCH /api/elimination/:gameId/day/:dayId ────────────────────────────────
// Override elimination count for a specific day.
// Backend validates total stays equal to N-2 after override.

router.patch('/:gameId/day/:dayId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId, dayId } = req.params;
    const { eliminationCount } = req.body as { eliminationCount: number };

    if (typeof eliminationCount !== 'number' || eliminationCount < 0) {
      res.status(400).json({ success: false, message: 'eliminationCount must be a non-negative number' }); return;
    }

    const day = await GameDay.findOne({ _id: dayId, gameId });
    if (!day) { res.status(404).json({ success: false, message: 'Day not found' }); return; }

    if (day.dayNumber === 7) {
      res.status(400).json({ success: false, message: 'Sunday (Day 7) is the final — eliminations are not configured here' }); return;
    }

    if (day.eliminationsProcessed) {
      res.status(400).json({ success: false, message: 'Eliminations already processed for this day' }); return;
    }

    await GameDay.findByIdAndUpdate(dayId, { eliminationCount });

    // Validate total schedule after update
    const game = await Game.findById(gameId);
    const totalEnrolled = await PlayerGame.countDocuments({ gameId });
    const required = Math.max(0, totalEnrolled - (game?.targetFinalists ?? 2));
    const allDays = await GameDay.find({ gameId, dayNumber: { $lte: 6 } });
    const total = allDays.reduce((s, d) => s + d.eliminationCount, 0);
    const isValid = total === required;

    res.json({
      success: true,
      message: `Day ${day.dayNumber} updated to ${eliminationCount} eliminations.`,
      validation: {
        scheduledTotal: total,
        requiredTotal: required,
        isValid,
        warning: !isValid ? `Warning: Total scheduled (${total}) ≠ required (${required}). Adjust other days.` : null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/elimination/:gameId/run/:dayId ─────────────────────────────────
// Run eliminations for a specific day. Returns eliminated players.

router.post('/:gameId/run/:dayId', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gameId, dayId } = req.params;

    const gameDay = await GameDay.findOne({ _id: dayId, gameId });
    if (!gameDay) { res.status(404).json({ success: false, message: 'Day not found' }); return; }
    if (gameDay.eliminationsProcessed) {
      res.status(400).json({ success: false, message: 'Already processed' }); return;
    }

    const eliminationCount = gameDay.eliminationCount;
    if (eliminationCount <= 0) {
      res.status(400).json({ success: false, message: 'No eliminations configured for this day' }); return;
    }

    // Get active players with their best attempt score for this day
    const activePlayers = await PlayerGame.find({
      gameId, status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE'] },
    }).lean();

    const attempts = await ChallengeAttempt.find({
      gameId, gameDayId: dayId,
      status: { $in: ['COMPLETED', 'TIME_EXPIRED'] },
    }).lean();

    // Build score map: highest score per player
    const scoreMap = new Map<string, { score: number; timeTaken: number }>();
    for (const a of attempts) {
      const uid = String(a.userId);
      const existing = scoreMap.get(uid);
      if (!existing || a.score > existing.score ||
        (a.score === existing.score && (a.timeTakenSeconds ?? 9999) < existing.timeTaken)) {
        scoreMap.set(uid, { score: a.score, timeTaken: a.timeTakenSeconds ?? 9999 });
      }
    }

    // Rank players: lowest score first; ties broken by slowest time
    const ranked = activePlayers.map(pg => {
      const uid = String(pg.userId);
      const s = scoreMap.get(uid);
      return { pg, score: s?.score ?? 0, timeTaken: s?.timeTaken ?? 9999 };
    }).sort((a, b) => a.score !== b.score ? a.score - b.score : b.timeTaken - a.timeTaken);

    const toEliminate = ranked.slice(0, eliminationCount);
    const eliminated: Array<{ userId: string; score: number; rank: number }> = [];

    for (let i = 0; i < toEliminate.length; i++) {
      const { pg, score } = toEliminate[i];
      const uid = String(pg.userId);

      await PlayerGame.findByIdAndUpdate(pg._id, { status: 'ELIMINATED', dayEliminated: gameDay.dayNumber });
      await User.findByIdAndUpdate(uid, { status: 'ELIMINATED' });

      const elim = new Elimination({
        gameId, gameDayId: dayId,
        dayNumber: gameDay.dayNumber,
        userId: uid, score,
        rank: activePlayers.length - i,
        reason: 'LOWEST_SCORE', eliminatedAt: new Date(),
      });
      await elim.save();

      eliminated.push({ userId: uid, score, rank: activePlayers.length - i });
    }

    // Mark day as processed
    await GameDay.findByIdAndUpdate(dayId, { eliminationsProcessed: true, status: 'COMPLETED' });

    // Check if we've reached finalists
    const remaining = await PlayerGame.countDocuments({
      gameId, status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE'] },
    });

    const game = await Game.findById(gameId);
    if (game && remaining <= game.targetFinalists) {
      await PlayerGame.updateMany(
        { gameId, status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE'] } },
        { status: 'FINALIST' }
      );
      await User.updateMany(
        { _id: { $in: (await PlayerGame.find({ gameId, status: 'FINALIST' })).map(p => p.userId) } },
        { status: 'FINALIST' }
      );
    }

    res.json({
      success: true,
      eliminated,
      remaining,
      finalistsReached: game !== null && remaining <= game.targetFinalists,
      message: `${eliminated.length} player(s) eliminated from Day ${gameDay.dayNumber}.`,
    });
  } catch (err) {
    console.error('Run elimination error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/elimination/:gameId/history ─────────────────────────────────────

router.get('/:gameId/history', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const eliminations = await Elimination.find({ gameId: req.params.gameId })
      .populate('userId', 'playerNumber nickname playerTag')
      .sort({ eliminatedAt: -1 });
    res.json({ success: true, eliminations });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
