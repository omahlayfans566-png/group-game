import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'player' | 'admin';
export type PlayerStatus =
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SAFE'
  | 'ELIMINATED'
  | 'FINALIST'
  | 'WINNER';

export interface IUser extends Document {
  playerNumber: number;
  nickname: string;
  /** Lowercase + trimmed — used for uniqueness checking only, never shown to users */
  nicknameNormalized: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: PlayerStatus;
  isActive: boolean;
  isSetupComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
  readonly playerTag: string;
}

const UserSchema = new Schema<IUser>(
  {
    playerNumber: {
      type: Number,
      unique: true,
    },
    nickname: {
      type: String,
      default: '',
      trim: true,
      maxlength: 30,
    },
    // Normalized for duplicate-check: lowercase + single-space + trimmed
    nicknameNormalized: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['player', 'admin'],
      default: 'player',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE', 'ELIMINATED', 'FINALIST', 'WINNER'],
      default: 'ACTIVE',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSetupComplete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transform: (_doc: any, ret: any): any => {
        delete ret.passwordHash;
        delete ret.nicknameNormalized; // never expose to client
        return ret;
      },
    },
  }
);

// Sparse index: only active/complete players need unique nickname enforcement
UserSchema.index(
  { nicknameNormalized: 1 },
  { unique: true, sparse: true, partialFilterExpression: { isSetupComplete: true, nicknameNormalized: { $ne: '' } } }
);

// Virtual: "PLAYER 007"
UserSchema.virtual('playerTag').get(function (this: IUser) {
  if (!this.playerNumber) return '';
  return `PLAYER ${String(this.playerNumber).padStart(3, '0')}`;
});

// Auto-generate sequential playerNumber + hash password on first save
UserSchema.pre('save', async function (next) {
  if (this.isNew && !this.playerNumber) {
    const last = await mongoose
      .model('User')
      .findOne({ playerNumber: { $exists: true } })
      .sort({ playerNumber: -1 })
      .select('playerNumber')
      .lean();
    const lastNum = (last as { playerNumber?: number } | null)?.playerNumber ?? 0;
    this.playerNumber = lastNum + 1;
  }

  // Keep normalized nickname in sync
  if (this.isModified('nickname')) {
    this.nicknameNormalized = this.nickname
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' '); // collapse multiple spaces
  }

  if (this.isModified('passwordHash')) {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  }

  next();
});

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

export default mongoose.model<IUser>('User', UserSchema);
