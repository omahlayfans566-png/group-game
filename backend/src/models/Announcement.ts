import mongoose, { Document, Schema, Types } from 'mongoose';

export type AnnouncementType =
  | 'GAME_START'
  | 'CHALLENGE_OPEN'
  | 'CHALLENGE_CLOSED'
  | 'RESULTS'
  | 'ELIMINATION'
  | 'FINALISTS'
  | 'WINNER'
  | 'GENERAL'
  | 'WARNING';

export interface IAnnouncement extends Document {
  gameId: Types.ObjectId;
  type: AnnouncementType;
  title: string;
  message: string;
  dayNumber?: number;
  isPublished: boolean;
  publishedAt?: Date;
  // Optional list of userIds mentioned (e.g. eliminated players)
  mentionedUsers: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    type: {
      type: String,
      enum: [
        'GAME_START',
        'CHALLENGE_OPEN',
        'CHALLENGE_CLOSED',
        'RESULTS',
        'ELIMINATION',
        'FINALISTS',
        'WINNER',
        'GENERAL',
        'WARNING',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    dayNumber: { type: Number },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    mentionedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

AnnouncementSchema.index({ gameId: 1, isPublished: 1, createdAt: -1 });

export default mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
