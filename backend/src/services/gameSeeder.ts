/**
 * gameSeeder.ts
 * ─────────────
 * On server startup, if no ACTIVE game exists, auto-create the full 7-day
 * game structure so the admin can immediately open/close games without
 * manually creating anything.
 *
 * Creates:
 *   1 Game (ACTIVE)
 *   7 GameDays (all CLOSED, no time constraints — admin opens them manually)
 *   7 Challenges (one per day, all isOpen:false isActive:true)
 *
 * If an ACTIVE game already exists, does nothing.
 * Safe to call on every startup.
 */

import Game from '../models/Game';
import GameDay from '../models/GameDay';
import Challenge from '../models/Challenge';
import User from '../models/User';
import { autoEnrollAllActivePlayersInGame } from './enrollmentService';

const DAY_CONFIGS: Array<{
  dayNumber: number;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  title: string;
  challengeType: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXTREME';
  durationSeconds: number;
  totalStages: number;
  description: string;
  instructions: string;
}> = [
  {
    dayNumber: 1,
    dayOfWeek: 'MONDAY',
    title: 'Day 1 — The Broken Machine',
    challengeType: 'BROKEN_MACHINE',
    difficulty: 'HARD',
    durationSeconds: 660,
    totalStages: 1,
    description: 'Repair the broken circuit. Rotate nodes to connect SOURCE to SINK.',
    instructions: 'Click any node to rotate it 90° clockwise. Connect SOURCE ⚡ to SINK 🎯.',
  },
  {
    dayNumber: 2,
    dayOfWeek: 'TUESDAY',
    title: 'Day 2 — The Pattern Vault',
    challengeType: 'PATTERN_VAULT',
    difficulty: 'HARD',
    durationSeconds: 780,
    totalStages: 1,
    description: 'Discover the hidden transformation rules and reconstruct States 5 & 6.',
    instructions: 'Study the 4 example states. Four rules operate simultaneously. Build States 5 and 6.',
  },
  {
    dayNumber: 3,
    dayOfWeek: 'WEDNESDAY',
    title: 'Day 3 — The Memory Vault',
    challengeType: 'MEMORY_VAULT',
    difficulty: 'HARD',
    durationSeconds: 720,
    totalStages: 3,
    description: 'Memorise the room, then answer questions about what you saw.',
    instructions: 'Study the room carefully. Remember positions, colors and relationships.',
  },
  {
    dayNumber: 4,
    dayOfWeek: 'THURSDAY',
    title: 'Day 4 — The Cipher Room',
    challengeType: 'CIPHER_ROOM',
    difficulty: 'EXTREME',
    durationSeconds: 900,
    totalStages: 4,
    description: 'Break through 4 connected locks. Each answer feeds into the next.',
    instructions: 'Solve each lock in order. Wrong earlier answers corrupt later ones.',
  },
  {
    dayNumber: 5,
    dayOfWeek: 'FRIDAY',
    title: 'Day 5 — The Rule Trap',
    challengeType: 'RULE_TRAP',
    difficulty: 'EXTREME',
    durationSeconds: 960,
    totalStages: 1,
    description: 'Discover the hidden compound rule. Limited probes only.',
    instructions: 'Probe strategically. The rule involves TWO attributes simultaneously.',
  },
  {
    dayNumber: 6,
    dayOfWeek: 'SATURDAY',
    title: 'Day 6 — The Black Vault',
    challengeType: 'BLACK_VAULT',
    difficulty: 'EXTREME',
    durationSeconds: 1080,
    totalStages: 5,
    description: 'Five connected stages. Each key feeds the next. Earn them all.',
    instructions: 'Complete stages in order. Each produces a key needed for the next.',
  },
  {
    dayNumber: 7,
    dayOfWeek: 'SUNDAY',
    title: 'Day 7 — The Final Vault',
    challengeType: 'FINAL_VAULT',
    difficulty: 'EXTREME',
    durationSeconds: 1140,
    totalStages: 5,
    description: 'Championship. Five connected stages. One winner.',
    instructions: 'Visual memory → Pattern → Logic → Cipher → Final synthesis.',
  },
];

export async function seedGameIfNeeded(): Promise<void> {
  try {
    // Check if an active game already exists
    const existing = await Game.findOne({ status: 'ACTIVE' });
    if (existing) {
      // Make sure all 7 challenges exist for this game
      await ensureChallengesExist(existing._id.toString(), existing);
      return;
    }

    // Find or create the first admin user to own the game
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      // No admin yet — seed will run again once admin registers
      console.log('ℹ️  No admin user yet — game will be seeded after first admin registers.');
      return;
    }

    console.log('🌱 Seeding 7-day game structure…');

    // Create the game
    const game = new Game({
      name: 'Survival — Seven Days',
      description: '7-Day survival puzzle competition. Admin opens each game manually.',
      status: 'ACTIVE',
      startDate: new Date(),
      targetFinalists: 2,
      groupLink: process.env.GROUP_LINK || '',
      adminId: adminUser._id,
    });
    await game.save();

    // Create 7 days — all CLOSED, start/end times set far in the future
    // (times are irrelevant now — admin OPEN/CLOSE is authoritative)
    const far = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    for (const cfg of DAY_CONFIGS) {
      const day = new GameDay({
        gameId: game._id,
        dayNumber: cfg.dayNumber,
        dayOfWeek: cfg.dayOfWeek,
        status: 'CLOSED',
        challengeStartTime: far,
        challengeEndTime: new Date(far.getTime() + 30 * 60 * 1000),
        eliminationCount: 0,
        eliminationsProcessed: false,
        notes: '',
      });
      await day.save();

      // Create the challenge for this day
      const challenge = new Challenge({
        gameId: game._id,
        gameDayId: day._id,
        dayNumber: cfg.dayNumber,
        title: cfg.title,
        description: cfg.description,
        instructions: cfg.instructions,
        difficulty: cfg.difficulty,
        challengeType: cfg.challengeType,
        durationSeconds: cfg.durationSeconds,
        maxAttempts: 1,
        scoringMethod: 'TIME_BONUS',
        tieBreakerMethod: 'FASTEST_TIME',
        isActive: true,
        isOpen: false,   // admin opens this
        puzzleConfig: {},
        totalStages: cfg.totalStages,
        maxScore: cfg.totalStages > 1 ? cfg.totalStages * 50 : 100,
      });
      await challenge.save();
    }

    // Auto-enroll any existing active players in the newly seeded game
    await autoEnrollAllActivePlayersInGame(game._id);

    console.log(`✅ Game seeded: "${game.name}" with 7 days and 7 challenges`);
    console.log('   All games are CLOSED. Admin must open them from the admin panel.');
  } catch (err) {
    console.error('⚠️  Game seeder error:', (err as Error).message);
  }
}

/** Ensure all 7 challenges exist for an existing game */
async function ensureChallengesExist(gameId: string, game: InstanceType<typeof Game>): Promise<void> {
  const days = await GameDay.find({ gameId }).sort({ dayNumber: 1 });
  const challenges = await Challenge.find({ gameId });

  for (const cfg of DAY_CONFIGS) {
    // Find or create the day
    let day = days.find(d => d.dayNumber === cfg.dayNumber);
    if (!day) {
      const far = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      day = new GameDay({
        gameId,
        dayNumber: cfg.dayNumber,
        dayOfWeek: cfg.dayOfWeek,
        status: 'CLOSED',
        challengeStartTime: far,
        challengeEndTime: new Date(far.getTime() + 30 * 60 * 1000),
        eliminationCount: 0,
        eliminationsProcessed: false,
        notes: '',
      });
      await day.save();
    }

    // Find or create the challenge
    const existingCh = challenges.find(c => c.dayNumber === cfg.dayNumber);
    if (!existingCh) {
      const challenge = new Challenge({
        gameId,
        gameDayId: day._id,
        dayNumber: cfg.dayNumber,
        title: cfg.title,
        description: cfg.description,
        instructions: cfg.instructions,
        difficulty: cfg.difficulty,
        challengeType: cfg.challengeType,
        durationSeconds: cfg.durationSeconds,
        maxAttempts: 1,
        scoringMethod: 'TIME_BONUS',
        tieBreakerMethod: 'FASTEST_TIME',
        isActive: true,
        isOpen: false,
        puzzleConfig: {},
        totalStages: cfg.totalStages,
        maxScore: cfg.totalStages > 1 ? cfg.totalStages * 50 : 100,
      });
      await challenge.save();
      console.log(`  ✅ Created missing challenge: ${cfg.title}`);
    }
  }
}
