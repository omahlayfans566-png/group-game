import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { challengeLimiter } from '../middleware/rateLimiter';
import Challenge from '../models/Challenge';
import ChallengeAttempt from '../models/ChallengeAttempt';
import Submission from '../models/Submission';
import PlayerGame from '../models/PlayerGame';
import GameDay from '../models/GameDay';
import { generatePuzzle } from '../services/puzzleEngine';
import { validatePuzzle } from '../services/puzzleValidator';
import { buildSeed } from '../services/seededRandom';
import { PlayerAnswer } from '../services/puzzleTypes';

const router = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const PUZZLE_TYPES = [
  'SEQUENCE', 'CODE_BREAK', 'MEMORY', 'PATTERN',
  'ARRANGEMENT', 'HIDDEN_OBJECT', 'LOGIC', 'MULTI_STAGE',
] as const;

const CreateChallengeSchema = z.object({
  gameId: z.string().min(1),
  gameDayId: z.string().min(1),
  dayNumber: z.number().int().min(1).max(7),
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional().default(''),
  instructions: z.string().max(2000).optional().default(''),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXTREME']).default('MEDIUM'),
  challengeType: z.enum(PUZZLE_TYPES).default('CODE_BREAK'),
  durationSeconds: z.number().int().min(30),
  maxAttempts: z.number().int().min(1).default(1),
  scoringMethod: z.enum(['BINARY', 'PARTIAL', 'TIME_BONUS', 'STAGE_BASED', 'ATTEMPT_PENALTY']).default('PARTIAL'),
  tieBreakerMethod: z.enum(['FASTEST_TIME', 'SECONDARY_CHALLENGE', 'ADMIN_OVERRIDE']).default('FASTEST_TIME'),
  puzzleConfig: z.record(z.unknown()).optional().default({}),
  totalStages: z.number().int().min(1).default(1),
  maxScore: z.number().int().min(1).default(100),
});

// ─── Admin: CRUD ──────────────────────────────────────────────────────────────

// GET /api/challenges?gameId=...&dayNumber=...
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.gameId) filter.gameId = req.query.gameId;
    if (req.query.dayNumber) filter.dayNumber = Number(req.query.dayNumber);
    if (req.user!.role !== 'admin') filter.isActive = true;

    const challenges = await Challenge.find(filter).sort({ dayNumber: 1 });

    const safe = challenges.map(c => {
      const obj = c.toObject() as unknown as Record<string, unknown>;
      if (req.user!.role !== 'admin') delete obj['puzzleConfig'];
      return obj;
    });

    res.json({ success: true, challenges: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/challenges  (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = CreateChallengeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid input', errors: parsed.error.flatten() });
      return;
    }

    // Determine totalStages from puzzle type for multi-stage
    let totalStages = parsed.data.totalStages;
    if (parsed.data.challengeType === 'MULTI_STAGE') totalStages = 4;
    if (parsed.data.challengeType === 'MEMORY') totalStages = 2;

    const challenge = new Challenge({ ...parsed.data, totalStages });
    await challenge.save();
    res.status(201).json({ success: true, challenge });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/challenges/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) { res.status(404).json({ success: false, message: 'Challenge not found' }); return; }
    if (req.user!.role !== 'admin' && !challenge.isActive) {
      res.status(404).json({ success: false, message: 'Challenge not found' }); return;
    }
    const obj = challenge.toObject() as unknown as Record<string, unknown>;
    if (req.user!.role !== 'admin') delete obj['puzzleConfig'];
    res.json({ success: true, challenge: obj });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/challenges/:id  (admin only)
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowed = [
      'title', 'description', 'instructions', 'difficulty', 'challengeType',
      'durationSeconds', 'maxAttempts', 'scoringMethod', 'tieBreakerMethod',
      'isActive', 'isOpen', 'puzzleConfig', 'maxScore', 'totalStages',
    ];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const challenge = await Challenge.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!challenge) { res.status(404).json({ success: false, message: 'Challenge not found' }); return; }
    res.json({ success: true, challenge });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/challenges/:id  (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) { res.status(404).json({ success: false, message: 'Challenge not found' }); return; }
    if (challenge.isActive) {
      res.status(400).json({ success: false, message: 'Deactivate before deleting' }); return;
    }
    await Challenge.deleteOne({ _id: challenge._id });
    res.json({ success: true, message: 'Challenge deleted' });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Player: Start challenge ──────────────────────────────────────────────────

// POST /api/challenges/:id/start
router.post('/:id/start', authenticate, challengeLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = String(req.user!._id);
    const challengeId = req.params.id;
    const ipAddress = (req.ip || '').replace('::ffff:', '');

    const challenge = await Challenge.findById(challengeId);
    if (!challenge || !challenge.isActive) {
      res.status(404).json({ success: false, message: 'Challenge not found or not active' }); return;
    }
    // Must be enrolled in this game and not eliminated
    const pg = await PlayerGame.findOne({ userId, gameId: challenge.gameId });
    if (!pg) { res.status(403).json({ success: false, message: 'Not enrolled in this game' }); return; }
    if (pg.status === 'ELIMINATED') {
      res.status(403).json({ success: false, message: 'Eliminated players cannot participate' }); return;
    }

    // Check existing attempts
    const existingAttempts = await ChallengeAttempt.find({ userId, challengeId }).sort({ createdAt: 1 });
    const completedCount = existingAttempts.filter(a => ['COMPLETED', 'TIME_EXPIRED'].includes(a.status)).length;

    if (completedCount >= challenge.maxAttempts) {
      res.status(403).json({ success: false, message: 'Maximum attempts reached' }); return;
    }

    // Reconnect to in-progress attempt
    const inProgress = existingAttempts.find(a => a.status === 'IN_PROGRESS');
    if (inProgress) {
      const now = new Date();
      const reconnectDay = await GameDay.findById(inProgress.gameDayId);
      if (now >= inProgress.deadlineAt || (reconnectDay && now >= reconnectDay.challengeEndTime)) {
        inProgress.status = 'TIME_EXPIRED';
        await inProgress.save();
        res.status(403).json({
          success: false,
          message: 'Time expired',
          attempt: { status: 'TIME_EXPIRED', deadlineAt: inProgress.deadlineAt },
        });
        return;
      }

      // Return the existing puzzle display data (reconstructed from stored data)
      res.json({
        success: true,
        resumed: true,
        attempt: {
          _id: inProgress._id,
          startedAt: inProgress.startedAt,
          deadlineAt: inProgress.deadlineAt,
          currentStage: inProgress.currentStage,
          totalStages: inProgress.totalStages,
          status: inProgress.status,
          puzzleSeed: inProgress.puzzleSeed,
          stageHistory: inProgress.stageHistory.map(s => ({
            stage: s.stage,
            isCorrect: s.isCorrect,
            score: s.score,
          })),
        },
        puzzleDisplayData: inProgress.individualPuzzleData.displayData,
        challenge: safeChallenge(challenge),
      });
      return;
    }

    // Verify game day window — GLOBAL window enforced, late players get remaining time
    const gameDay = await GameDay.findById(challenge.gameDayId);
    if (!gameDay) {
      res.status(403).json({ success: false, message: 'Challenge day is not open' }); return;
    }

    const now = new Date();

    if (['CLOSED', 'RESULTS', 'COMPLETED'].includes(gameDay.status)) {
      res.status(403).json({ success: false, message: 'Challenge day is closed' }); return;
    }

    // Global open check — server time only, never trusts client
    if (now < gameDay.challengeStartTime) {
      const secondsUntilOpen = Math.ceil(
        (gameDay.challengeStartTime.getTime() - now.getTime()) / 1000
      );
      res.status(403).json({
        success: false,
        message: 'Challenge has not started yet',
        opensAt: gameDay.challengeStartTime,
        secondsUntilOpen,
      });
      return;
    }

    // Global close check — challenge window is over
    if (now >= gameDay.challengeEndTime) {
      res.status(403).json({
        success: false,
        message: 'THIS CHALLENGE IS CLOSED. Please return to the group for the official result.',
        closedAt: gameDay.challengeEndTime,
      });
      return;
    }

    // IMPORTANT: deadline is min(player's full duration, global close time)
    // Late players get only remaining window time — never a fresh full timer
    const fullDeadline = new Date(now.getTime() + challenge.durationSeconds * 1000);
    const globalClose = gameDay.challengeEndTime;
    const deadlineAt = fullDeadline < globalClose ? fullDeadline : globalClose;

    // Generate player-specific puzzle instance
    const attemptNumber = existingAttempts.length + 1;
    const seed = buildSeed(userId, challengeId, attemptNumber);
    const puzzle = generatePuzzle(
      challenge.challengeType,
      challenge.puzzleConfig || {},
      seed,
      challenge.difficulty
    );

    const startedAt = new Date();
    // deadlineAt already computed above: min(full duration, global window close)

    const attempt = new ChallengeAttempt({
      userId,
      challengeId,
      gameId: challenge.gameId,
      gameDayId: challenge.gameDayId,
      attemptNumber,
      status: 'IN_PROGRESS',
      startedAt,
      deadlineAt,
      maxScore: puzzle.maxScore,
      totalStages: puzzle.totalStages,
      currentStage: 1,
      puzzleSeed: seed,
      // secretData stored here — NEVER returned to client
      individualPuzzleData: {
        displayData: puzzle.displayData,
        secretData: puzzle.secretData,
      },
      ipAddress,
    });

    await attempt.save();

    await PlayerGame.findOneAndUpdate(
      { userId, gameId: challenge.gameId },
      { status: 'IN_PROGRESS' }
    );

    res.status(201).json({
      success: true,
      resumed: false,
      attempt: {
        _id: attempt._id,
        startedAt: attempt.startedAt,
        deadlineAt: attempt.deadlineAt,
        currentStage: attempt.currentStage,
        totalStages: attempt.totalStages,
        status: attempt.status,
        puzzleSeed: attempt.puzzleSeed,
        stageHistory: [],
      },
      // Only displayData — secretData never leaves the server
      puzzleDisplayData: puzzle.displayData,
      challenge: safeChallenge(challenge),
    });
  } catch (err) {
    console.error('Start challenge error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Player: Submit stage answer (single-stage or per-stage for multi-stage) ──

// POST /api/challenges/:id/submit-stage
router.post('/:id/submit-stage', authenticate, challengeLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = String(req.user!._id);
    const challengeId = req.params.id;
    const { attemptId, stage, payload } = req.body as {
      attemptId: string;
      stage: number;
      payload: Record<string, unknown>;
    };

    if (!attemptId || !payload) {
      res.status(400).json({ success: false, message: 'attemptId and payload required' }); return;
    }

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) { res.status(404).json({ success: false, message: 'Challenge not found' }); return; }

    const attempt = await ChallengeAttempt.findOne({ _id: attemptId, userId, challengeId });
    if (!attempt) { res.status(403).json({ success: false, message: 'Attempt not found' }); return; }
    if (attempt.status !== 'IN_PROGRESS') {
      res.status(400).json({ success: false, message: `Attempt is already ${attempt.status}` }); return;
    }

    // Server-side time check — uses server clock, never client
    const now = new Date();
    if (now >= attempt.deadlineAt) {
      attempt.status = 'TIME_EXPIRED';
      await attempt.save();
      res.status(400).json({ success: false, message: 'Time expired', status: 'TIME_EXPIRED' }); return;
    }

    // Also enforce global game window close
    const gameDay2 = await GameDay.findById(attempt.gameDayId);
    if (gameDay2 && now >= gameDay2.challengeEndTime) {
      attempt.status = 'TIME_EXPIRED';
      await attempt.save();
      res.status(400).json({
        success: false,
        message: 'THIS CHALLENGE IS CLOSED. Please return to the group for the official result.',
        status: 'TIME_EXPIRED',
      });
      return;
    }

    // Stage order enforcement — cannot skip stages
    const stageNum = Number(stage) || attempt.currentStage;
    if (stageNum !== attempt.currentStage) {
      res.status(400).json({ success: false, message: `Must complete stage ${attempt.currentStage} first` }); return;
    }

    // Check stage not already submitted
    const alreadyDone = attempt.stageHistory.find(s => s.stage === stageNum);
    if (alreadyDone) {
      res.status(400).json({ success: false, message: `Stage ${stageNum} already submitted` }); return;
    }

    const timeTaken = Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000);

    // Server-side validation — uses stored secretData
    const answer: PlayerAnswer = { stage: stageNum, payload };
    const result = validatePuzzle(
      challenge.challengeType,
      attempt.individualPuzzleData.secretData,
      answer,
      timeTaken,
      challenge.durationSeconds,
      challenge.scoringMethod,
      attempt.attemptNumber,
      challenge.maxAttempts,
      attempt.maxScore
    );

    // Record stage submission
    attempt.stageHistory.push({
      stage: stageNum,
      submittedAt: now,
      isCorrect: result.isCorrect,
      score: result.score,
      timeTakenSeconds: timeTaken,
      answerPayload: payload,
    });

    const isLastStage = stageNum >= attempt.totalStages;

    if (isLastStage || attempt.totalStages === 1) {
      // All stages done — finalise
      const totalScore = attempt.stageHistory.reduce((acc, s) => acc + s.score, 0) + result.score;
      attempt.status = 'COMPLETED';
      attempt.completedAt = now;
      attempt.timeTakenSeconds = timeTaken;
      attempt.score = Math.min(attempt.maxScore, totalScore);
      attempt.currentStage = stageNum;
    } else {
      // Advance stage
      attempt.currentStage = stageNum + 1;
      attempt.score += result.score;
    }

    await attempt.save();

    // Save submission record
    if (isLastStage || attempt.totalStages === 1) {
      const submission = new Submission({
        userId,
        challengeId,
        attemptId: attempt._id,
        gameId: challenge.gameId,
        gameDayId: challenge.gameDayId,
        answerData: { stage: stageNum, payload },
        score: attempt.score,
        maxScore: attempt.maxScore,
        isCorrect: result.isCorrect,
        isPartial: result.isPartial,
        timeTakenSeconds: timeTaken,
        submittedAt: now,
        isLate: false,
        validationDetails: { feedback: result.feedback },
      });
      await submission.save();

      await PlayerGame.findOneAndUpdate(
        { userId, gameId: challenge.gameId },
        { $inc: { totalScore: attempt.score }, status: 'COMPLETED' }
      );
    }

    res.json({
      success: true,
      result: {
        stage: stageNum,
        isCorrect: result.isCorrect,
        isPartial: result.isPartial,
        score: result.score,
        feedback: result.feedback,  // safe — no answer leakage
        totalScore: attempt.score,
        maxScore: attempt.maxScore,
        nextStage: isLastStage ? null : attempt.currentStage,
        isComplete: isLastStage || attempt.totalStages === 1,
        status: attempt.status,
        timeTakenSeconds: timeTaken,
      },
    });
  } catch (err) {
    console.error('Submit stage error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Player: Final submit (single-stage shorthand) ────────────────────────────

// POST /api/challenges/:id/submit
router.post('/:id/submit', authenticate, challengeLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { attemptId, answers } = req.body as { attemptId: string; answers: Record<string, unknown> };
    if (!attemptId || !answers) {
      res.status(400).json({ success: false, message: 'attemptId and answers required' }); return;
    }
    // Delegate to submit-stage with stage=1
    req.body = { attemptId, stage: 1, payload: { answers, ...answers } };
    // Re-use the stage handler logic inline
    const userId = String(req.user!._id);
    const challengeId = req.params.id;
    const now = new Date();

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) { res.status(404).json({ success: false, message: 'Challenge not found' }); return; }

    const attempt = await ChallengeAttempt.findOne({ _id: attemptId, userId, challengeId });
    if (!attempt) { res.status(403).json({ success: false, message: 'Attempt not found' }); return; }
    if (attempt.status !== 'IN_PROGRESS') {
      res.status(400).json({ success: false, message: `Attempt is already ${attempt.status}` }); return;
    }
    const gameDay = await GameDay.findById(attempt.gameDayId);
    if (gameDay && now >= gameDay.challengeEndTime) {
      attempt.status = 'TIME_EXPIRED';
      await attempt.save();
      res.status(400).json({ success: false, message: 'THIS CHALLENGE IS CLOSED.', status: 'TIME_EXPIRED' }); return;
    }
    if (now >= attempt.deadlineAt) {
      attempt.status = 'TIME_EXPIRED';
      await attempt.save();
      res.status(400).json({ success: false, message: 'Time expired', status: 'TIME_EXPIRED' }); return;
    }

    const timeTaken = Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000);
    const playerAnswer: PlayerAnswer = { stage: 1, payload: { answers, ...answers } };

    const result = validatePuzzle(
      challenge.challengeType,
      attempt.individualPuzzleData.secretData,
      playerAnswer,
      timeTaken,
      challenge.durationSeconds,
      challenge.scoringMethod,
      attempt.attemptNumber,
      challenge.maxAttempts,
      attempt.maxScore
    );

    attempt.status = 'COMPLETED';
    attempt.completedAt = now;
    attempt.timeTakenSeconds = timeTaken;
    attempt.score = result.score;
    await attempt.save();

    const submission = new Submission({
      userId, challengeId, attemptId: attempt._id,
      gameId: challenge.gameId, gameDayId: challenge.gameDayId,
      answerData: { answers },
      score: result.score, maxScore: result.maxScore,
      isCorrect: result.isCorrect, isPartial: result.isPartial,
      timeTakenSeconds: timeTaken, submittedAt: now, isLate: false,
      validationDetails: { feedback: result.feedback },
    });
    await submission.save();

    await PlayerGame.findOneAndUpdate(
      { userId, gameId: challenge.gameId },
      { $inc: { totalScore: result.score }, status: 'COMPLETED' }
    );

    res.json({
      success: true,
      result: {
        score: result.score, maxScore: result.maxScore,
        isCorrect: result.isCorrect, isPartial: result.isPartial,
        timeTakenSeconds: timeTaken, status: 'COMPLETED',
        feedback: result.feedback,
      },
    });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Player: Get attempt status ───────────────────────────────────────────────

// GET /api/challenges/:id/my-attempt
router.get('/:id/my-attempt', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = String(req.user!._id);
    const attempt = await ChallengeAttempt.findOne({
      userId, challengeId: req.params.id,
    }).sort({ createdAt: -1 });

    if (!attempt) { res.json({ success: true, attempt: null }); return; }

    const now = new Date();
    const gameDay = await GameDay.findById(attempt.gameDayId).select('challengeEndTime');
    if (
      attempt.status === 'IN_PROGRESS' &&
      (now >= attempt.deadlineAt || (gameDay && now >= gameDay.challengeEndTime))
    ) {
      attempt.status = 'TIME_EXPIRED';
      await attempt.save();
    }

    res.json({
      success: true,
      attempt: {
        _id: attempt._id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        deadlineAt: attempt.deadlineAt,
        completedAt: attempt.completedAt,
        timeTakenSeconds: attempt.timeTakenSeconds,
        score: attempt.score,
        maxScore: attempt.maxScore,
        currentStage: attempt.currentStage,
        totalStages: attempt.totalStages,
        stageHistory: attempt.stageHistory.map(s => ({
          stage: s.stage,
          isCorrect: s.isCorrect,
          score: s.score,
        })),
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Admin: View results ──────────────────────────────────────────────────────

// GET /api/challenges/:id/attempts  (admin only)
router.get('/:id/attempts', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attempts = await ChallengeAttempt.find({ challengeId: req.params.id })
      .populate('userId', 'playerNumber nickname playerTag')
      .select('-individualPuzzleData')   // never expose puzzle secrets to admin API either
      .sort({ score: -1, timeTakenSeconds: 1 });
    res.json({ success: true, attempts });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/challenges/:id/submissions  (admin only)
router.get('/:id/submissions', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const submissions = await Submission.find({ challengeId: req.params.id })
      .populate('userId', 'playerNumber nickname playerTag')
      .sort({ score: -1, timeTakenSeconds: 1 });
    res.json({ success: true, submissions });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function safeChallenge(c: InstanceType<typeof Challenge>) {
  return {
    _id: c._id,
    title: c.title,
    description: c.description,
    instructions: c.instructions,
    difficulty: c.difficulty,
    challengeType: c.challengeType,
    durationSeconds: c.durationSeconds,
    maxAttempts: c.maxAttempts,
    totalStages: c.totalStages,
    maxScore: c.maxScore,
    scoringMethod: c.scoringMethod,
  };
}

export default router;
