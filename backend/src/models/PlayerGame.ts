import mongoose, { Document, Schema, Types } from 'mongoose';
import { PlayerStatus } from './User';

export interface IPlayerGame extends Document {
  userId: Types.ObjectId;
  gameId: Types.ObjectId;
  status: PlayerStatus;
  dayEliminated?: number;
  totalScore: number;
  rank?: number;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PlayerGameSchema = new Schema<IPlayerGame>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE', 'ELIMINATED', 'FINALIST', 'WINNER'],
      default: 'ACTIVE',
    },
    dayEliminated: { type: Number },
    totalScore: { type: Number, default: 0 },
    rank: { type: Number },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PlayerGameSchema.index({ userId: 1, gameId: 1 }, { unique: true });

export default mongoose.model<IPlayerGame>('PlayerGame', PlayerGameSchema);
