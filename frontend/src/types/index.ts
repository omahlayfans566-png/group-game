// ─── Shared Types ─────────────────────────────────────────────────────────────

export type UserRole = 'player' | 'admin';

export type PlayerStatus =
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SAFE'
  | 'ELIMINATED'
  | 'FINALIST'
  | 'WINNER';

export type GameStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

export type DayStatus = 'UPCOMING' | 'OPEN' | 'CLOSED' | 'RESULTS' | 'COMPLETED';

export type DayOfWeek =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY'
  | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type ChallengeType =
  | 'LOGIC_PUZZLE' | 'PATTERN_RECOGNITION' | 'SEQUENCE_PUZZLE'
  | 'CODE_BREAKING' | 'MEMORY_CHALLENGE' | 'VISUAL_PUZZLE'
  | 'ARRANGEMENT_PUZZLE' | 'MATH_REASONING' | 'COMBINATION_CODE'
  | 'MULTI_STAGE' | 'TIMED_REASONING' | 'TEST_CHALLENGE'
  | 'SEQUENCE' | 'CODE_BREAK' | 'MEMORY' | 'PATTERN' | 'ARRANGEMENT'
  | 'HIDDEN_OBJECT' | 'LOGIC' | 'BROKEN_MACHINE' | 'PATTERN_VAULT'
  | 'MEMORY_VAULT' | 'CIPHER_ROOM' | 'RULE_TRAP' | 'BLACK_VAULT' | 'FINAL_VAULT';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXTREME';

export type AttemptStatus = 'IN_PROGRESS' | 'COMPLETED' | 'TIME_EXPIRED' | 'ABANDONED';

export type AnnouncementType =
  | 'GAME_START' | 'CHALLENGE_OPEN' | 'CHALLENGE_CLOSED'
  | 'RESULTS' | 'ELIMINATION' | 'FINALISTS' | 'WINNER'
  | 'GENERAL' | 'WARNING';

// ─── API Models ───────────────────────────────────────────────────────────────

export interface User {
  _id: string;
  playerNumber: number;
  playerTag: string;        // e.g. "PLAYER 007"
  nickname: string;
  email: string;
  role: UserRole;
  status: PlayerStatus;
  isActive: boolean;
  isSetupComplete: boolean;
  createdAt: string;
}

export interface Game {
  _id: string;
  name: string;
  description: string;
  status: GameStatus;
  startDate: string;
  endDate?: string;
  totalPlayers: number;
  currentDay: number;
  targetFinalists: number;
  groupLink: string;
  adminId: string;
  createdAt: string;
}

export interface GameDay {
  _id: string;
  gameId: string;
  dayNumber: number;
  dayOfWeek: DayOfWeek;
  status: DayStatus;
  challengeStartTime: string;
  challengeEndTime: string;
  resultsAnnouncementTime?: string;
  eliminationCount: number;
  eliminationsProcessed: boolean;
  notes: string;
}

export interface Challenge {
  _id: string;
  gameId: string;
  gameDayId: string;
  dayNumber: number;
  title: string;
  description: string;
  instructions: string;
  difficulty: Difficulty;
  challengeType: ChallengeType;
  durationSeconds: number;
  maxAttempts: number;
  scoringMethod: string;
  isActive: boolean;
  isOpen: boolean;
  puzzleDisplayData: Record<string, unknown>;
  totalStages: number;
  maxScore: number;
}

export interface PlayerGame {
  _id: string;
  userId: User | string;
  gameId: Game | string;
  status: PlayerStatus;
  dayEliminated?: number;
  totalScore: number;
  rank?: number;
  joinedAt: string;
}

export interface ChallengeAttempt {
  _id: string;
  status: AttemptStatus;
  startedAt: string;
  deadlineAt: string;
  completedAt?: string;
  timeTakenSeconds?: number;
  score: number;
  maxScore: number;
  currentStage: number;
  puzzleSeed?: string;
}

export interface Submission {
  _id: string;
  userId: User | string;
  challengeId: Challenge | string;
  score: number;
  maxScore: number;
  isCorrect: boolean;
  isPartial: boolean;
  timeTakenSeconds: number;
  submittedAt: string;
}

export interface Announcement {
  _id: string;
  gameId: string;
  type: AnnouncementType;
  title: string;
  message: string;
  dayNumber?: number;
  isPublished: boolean;
  publishedAt?: string;
  mentionedUsers: (User | string)[];
  createdAt: string;
}

export interface Elimination {
  _id: string;
  gameId: string;
  dayNumber: number;
  userId: User | string;
  score: number;
  rank: number;
  reason: string;
  eliminatedAt: string;
}

// ─── API Response types ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface PuzzleDisplayData {
  questions?: Array<{ id: number; question: string }>;
  sequences?: Array<{ id: number; visible: number[] }>;
  instructions?: string;
  totalQuestions?: number;
  totalSequences?: number;
  [key: string]: unknown;
}

export interface StartChallengeResponse {
  success: boolean;
  resumed: boolean;
  attempt: ChallengeAttempt & { puzzleSeed: string };
  puzzleDisplayData: PuzzleDisplayData;
  challenge: Partial<Challenge>;
}

export interface SubmitResult {
  score: number;
  maxScore: number;
  isCorrect: boolean;
  isPartial: boolean;
  timeTakenSeconds: number;
  status: AttemptStatus;
}
