import mongoose, { Document, Schema, Types } from 'mongoose';

export type ChallengeType =
  | 'LOGIC_PUZZLE'
  | 'PATTERN_RECOGNITION'
  | 'SEQUENCE_PUZZLE'
  | 'CODE_BREAKING'
  | 'MEMORY_CHALLENGE'
  | 'VISUAL_PUZZLE'
  | 'ARRANGEMENT_PUZZLE'
  | 'MATH_REASONING'
  | 'COMBINATION_CODE'
  | 'MULTI_STAGE'
  | 'TIMED_REASONING'
  | 'TEST_CHALLENGE';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXTREME';

export type ScoringMethod = 'BINARY' | 'PARTIAL' | 'TIME_BONUS' | 'STAGE_BASED';

export type TieBreakerMethod = 'FASTEST_TIME' | 'SECONDARY_CHALLENGE' | 'ADMIN_OVERRIDE';

export interface IChallenge extends Document {
  gameId: Types.ObjectId;
  gameDayId: Types.ObjectId;
  dayNumber: number;
  title: string;
  description: string;
  instructions: string;
  difficulty: Difficulty;
  challengeType: ChallengeType;
  durationSeconds: number;
  maxAttempts: number;
  scoringMethod: ScoringMethod;
  tieBreakerMethod: TieBreakerMethod;
  isActive: boolean;
  isOpen: boolean;
  // Challenge puzzle data - stored server-side only
  // Contains the actual puzzle config including answers. NEVER sent to client as-is.
  puzzleConfig: Record<string, unknown>;
  // Safe data that can be sent to the client (no answers)
  puzzleDisplayData: Record<string, unknown>;
  totalStages: number;
  maxScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const ChallengeSchema = new Schema<IChallenge>(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    gameDayId: { type: Schema.Types.ObjectId, ref: 'GameDay', required: true },
    dayNumber: { type: Number, required: true, min: 1, max: 7 },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    instructions: { type: String, default: '' },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD', 'EXTREME'],
      default: 'MEDIUM',
    },
    challengeType: {
      type: String,
      enum: [
        'LOGIC_PUZZLE',
        'PATTERN_RECOGNITION',
        'SEQUENCE_PUZZLE',
        'CODE_BREAKING',
        'MEMORY_CHALLENGE',
        'VISUAL_PUZZLE',
        'ARRANGEMENT_PUZZLE',
        'MATH_REASONING',
        'COMBINATION_CODE',
        'MULTI_STAGE',
        'TIMED_REASONING',
        'TEST_CHALLENGE',
      ],
      default: 'TEST_CHALLENGE',
    },
    durationSeconds: { type: Number, required: true, min: 30 },
    maxAttempts: { type: Number, default: 1, min: 1 },
    scoringMethod: {
      type: String,
      enum: ['BINARY', 'PARTIAL', 'TIME_BONUS', 'STAGE_BASED'],
      default: 'BINARY',
    },
    tieBreakerMethod: {
      type: String,
      enum: ['FASTEST_TIME', 'SECONDARY_CHALLENGE', 'ADMIN_OVERRIDE'],
      default: 'FASTEST_TIME',
    },
    isActive: { type: Boolean, default: false },
    isOpen: { type: Boolean, default: false },
    // Server-side only puzzle data (answers included). Never expose directly.
    puzzleConfig: { type: Schema.Types.Mixed, default: {} },
    // Safe puzzle display data for client (no answers).
    puzzleDisplayData: { type: Schema.Types.Mixed, default: {} },
    totalStages: { type: Number, default: 1 },
    maxScore: { type: Number, default: 100 },
  },
  { timestamps: true }
);

ChallengeSchema.index({ gameId: 1, dayNumber: 1 });

export default mongoose.model<IChallenge>('Challenge', ChallengeSchema);
