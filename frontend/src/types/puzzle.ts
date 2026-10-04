/**
 * Frontend puzzle types
 * These mirror the backend contracts but contain ONLY what the server sends
 * to the browser (displayData). No answer keys ever appear here.
 */

export type PuzzleType =
  | 'SEQUENCE'
  | 'CODE_BREAK'
  | 'MEMORY'
  | 'PATTERN'
  | 'ARRANGEMENT'
  | 'HIDDEN_OBJECT'
  | 'LOGIC'
  | 'MULTI_STAGE';

// ─── Display data shapes (one per puzzle type) ────────────────────────────────

export interface SequenceDisplayData {
  sequences: Array<{ id: number; visible: (number | null)[] }>;
  instructions: string;
  gapCount: number;
}

export interface CodeBreakDisplayData {
  clues: Array<{ id: number; text: string; hint: string }>;
  codeLength: number;
  instructions: string;
  inputLabel: string;
}

export interface MemoryDisplayData {
  grid: string[][];
  gridSize: number;
  symbols: string[];
  revealSeconds: number;
  questions: Array<{ id: number; label: string }>;
  instructions: string;
}

export interface PatternDisplayData {
  patterns: Array<{ id: number; items: (string | number)[]; question: string }>;
  instructions: string;
}

export interface ArrangementDisplayData {
  items: Array<{ id: number; label: string }>;
  instructions: string;
  itemCount: number;
}

export interface HiddenObjectDisplayData {
  grid: string[][];
  gridSize: number;
  targetWords: Array<{ word: string }>;
  instructions: string;
}

export interface LogicDisplayData {
  names: string[];
  roles: string[];
  numbers: number[];
  clues: string[];
  instructions: string;
}

export interface MultiStageDisplayData {
  totalStages: number;
  stages: Array<{
    stage: number;
    type: string;
    title: string;
    instructions: string;
    items?: (string | number)[];
    clues?: string[];
    codeLength?: number;
  }>;
  instructions: string;
}

// ─── Attempt state (from server) ─────────────────────────────────────────────

export interface AttemptState {
  _id: string;
  startedAt: string;
  deadlineAt: string;
  completedAt?: string;
  currentStage: number;
  totalStages: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'TIME_EXPIRED' | 'ABANDONED';
  puzzleSeed: string;
  stageHistory: Array<{ stage: number; isCorrect: boolean; score: number }>;
}

// ─── Submit result (from server after validation) ─────────────────────────────

export interface StageResult {
  stage: number;
  isCorrect: boolean;
  isPartial: boolean;
  score: number;
  feedback: string;
  totalScore: number;
  maxScore: number;
  nextStage: number | null;
  isComplete: boolean;
  status: string;
  timeTakenSeconds: number;
}

// ─── Props interface every puzzle component receives ─────────────────────────

export interface PuzzleProps<T = Record<string, unknown>> {
  displayData: T;
  attempt: AttemptState;
  /** Called when the player is ready to submit an answer */
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  /** True while waiting for backend response */
  submitting: boolean;
  /** Last result from server (null until first submission) */
  lastResult: StageResult | null;
  locked: boolean;
}
