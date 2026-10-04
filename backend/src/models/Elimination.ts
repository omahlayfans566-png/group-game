import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IElimination extends Document {
  gameId: Types.ObjectId;
  gameDayId: Types.ObjectId;
  dayNumber: number;
  userId: Types.ObjectId;
  score: number;
  rank: number;
  reason: string;
  eliminatedAt: Date;
  announcedAt?: Date;
  createdAt: Date;
}

const EliminationSchema = new Schema<IElimination>(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    gameDayId: { type: Schema.Types.ObjectId, ref: 'GameDay', required: true },
    dayNumber: { type: Number, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, default: 0 },
    rank: { type: Number },
    reason: { type: String, default: 'LOWEST_SCORE' },
    eliminatedAt: { type: Date, default: Date.now },
    announcedAt: { type: Date },
  },
  { timestamps: true }
);

EliminationSchema.index({ gameId: 1, dayNumber: 1 });

export default mongoose.model<IElimination>('Elimination', EliminationSchema);
