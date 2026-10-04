import mongoose, { Document, Schema, Types } from 'mongoose';

export type GameStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

export interface IGame extends Document {
  name: string;
  description: string;
  status: GameStatus;
  startDate: Date;
  endDate?: Date;
  totalPlayers: number;
  currentDay: number;
  targetFinalists: number;
  groupLink: string;
  adminId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GameSchema = new Schema<IGame>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'],
      default: 'DRAFT',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    totalPlayers: { type: Number, default: 0 },
    currentDay: { type: Number, default: 0 },
    targetFinalists: { type: Number, default: 2 },
    groupLink: {
      type: String,
      default: () => process.env.GROUP_LINK || '',
    },
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IGame>('Game', GameSchema);
