import mongoose, { Document, Schema, Types } from 'mongoose';

export type AttemptStatus = 'IN_PROGRESS' | 'COMPLETED' | 'TIME_EXPIRED' | 'ABANDONED';

export interface StageSubmission {
  stage: number;
  submittedAt: Date;
  isCorrect: boolean;
  score: number;
  timeTakenSeconds: number;
  // Player's submitted answer — stored but never re-exposed to browser
  answerPayload: Record<string, unknown>;
}

export interface IChallengeAttempt extends Document {
  userId: Types.ObjectId;
  challengeId: Types.ObjectId;
  gameId: Types.ObjectId;
  gameDayId: Types.ObjectId;
  attemptNumber: number;
  status: AttemptStatus;
  // Server-recorded start time (not trusted from client)
  startedAt: Date;
  // Server-calculated hard deadline
  deadlineAt: Date;
  completedAt?: Date;
  timeTakenSeconds?: number;
  score: number;
  maxScore: number;
  // Multi-stage: which stage the player is currently on
  currentStage: number;
  totalStages: number;
  // Per-stage submission history (server-side only)
  stageHistory: StageSubmission[];
  // Reproducible seed for this attempt's puzzle instance
  puzzleSeed: string;
  // Full puzzle data stored server-side ONLY — displayData + secretData
  // Never returned directly to the client
  individualPuzzleData: {
    displayData: Record<string, unknown>;
    secretData: Record<string, unknown>;
  };
  // Suspicious activity log
  suspiciousActivity: string[];
  ipAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

const StageSubmissionSchema = new Schema<StageSubmission>(
  {
    stage: { type: Number, required: true },
    submittedAt: { type: Date, required: true },
    isCorrect: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    timeTakenSeconds: { type: Number, default: 0 },
    answerPayload: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const ChallengeAttemptSchema = new Schema<IChallengeAttempt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge', required: true },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    gameDayId: { type: Schema.Types.ObjectId, ref: 'GameDay', required: true },
    attemptNumber: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED', 'TIME_EXPIRED', 'ABANDONED'],
      default: 'IN_PROGRESS',
    },
    startedAt: { type: Date, required: true },
    deadlineAt: { type: Date, required: true },
    completedAt: { type: Date },
    timeTakenSeconds: { type: Number },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 100 },
    currentStage: { type: Number, default: 1 },
    totalStages: { type: Number, default: 1 },
    stageHistory: { type: [StageSubmissionSchema], default: [] },
    puzzleSeed: { type: String, required: true },
    individualPuzzleData: {
      type: Schema.Types.Mixed,
      default: { displayData: {}, secretData: {} },
    },
    suspiciousActivity: [{ type: String }],
    ipAddress: { type: String, default: '' },
  },
  { timestamps: true }
);

ChallengeAttemptSchema.index({ userId: 1, challengeId: 1 });
ChallengeAttemptSchema.index({ challengeId: 1, status: 1 });
ChallengeAttemptSchema.index({ gameId: 1, gameDayId: 1, score: -1 });

export default mongoose.model<IChallengeAttempt>('ChallengeAttempt', ChallengeAttemptSchema);
