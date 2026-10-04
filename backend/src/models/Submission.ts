import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISubmission extends Document {
  userId: Types.ObjectId;
  challengeId: Types.ObjectId;
  attemptId: Types.ObjectId;
  gameId: Types.ObjectId;
  gameDayId: Types.ObjectId;
  // Raw answer data submitted by player (varies by puzzle type)
  answerData: Record<string, unknown>;
  score: number;
  maxScore: number;
  isCorrect: boolean;
  isPartial: boolean;
  timeTakenSeconds: number;
  // Server-verified timestamps
  submittedAt: Date;
  isLate: boolean;
  validationDetails: Record<string, unknown>;
  createdAt: Date;
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge', required: true },
    attemptId: { type: Schema.Types.ObjectId, ref: 'ChallengeAttempt', required: true },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    gameDayId: { type: Schema.Types.ObjectId, ref: 'GameDay', required: true },
    // Do NOT store correct answers here — only what the player submitted
    answerData: { type: Schema.Types.Mixed, default: {} },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 100 },
    isCorrect: { type: Boolean, default: false },
    isPartial: { type: Boolean, default: false },
    timeTakenSeconds: { type: Number, required: true },
    submittedAt: { type: Date, required: true },
    isLate: { type: Boolean, default: false },
    validationDetails: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

SubmissionSchema.index({ userId: 1, challengeId: 1 });
SubmissionSchema.index({ gameId: 1, gameDayId: 1, score: -1 });

export default mongoose.model<ISubmission>('Submission', SubmissionSchema);
