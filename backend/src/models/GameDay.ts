import mongoose, { Document, Schema, Types } from 'mongoose';

export type DayStatus = 'UPCOMING' | 'OPEN' | 'CLOSED' | 'RESULTS' | 'COMPLETED';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface IGameDay extends Document {
  gameId: Types.ObjectId;
  dayNumber: number;
  dayOfWeek: DayOfWeek;
  status: DayStatus;
  challengeStartTime: Date;
  challengeEndTime: Date;
  resultsAnnouncementTime?: Date;
  eliminationCount: number;
  eliminationsProcessed: boolean;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const GameDaySchema = new Schema<IGameDay>(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    dayNumber: { type: Number, required: true, min: 1, max: 7 },
    dayOfWeek: {
      type: String,
      enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      required: true,
    },
    status: {
      type: String,
      enum: ['UPCOMING', 'OPEN', 'CLOSED', 'RESULTS', 'COMPLETED'],
      default: 'UPCOMING',
    },
    challengeStartTime: { type: Date, required: true },
    challengeEndTime: { type: Date, required: true },
    resultsAnnouncementTime: { type: Date },
    eliminationCount: { type: Number, default: 0, min: 0 },
    eliminationsProcessed: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

GameDaySchema.index({ gameId: 1, dayNumber: 1 }, { unique: true });

export default mongoose.model<IGameDay>('GameDay', GameDaySchema);
