/**
 * puzzleTypes.ts
 * ─────────────
 * Shared interfaces and contracts for the puzzle engine.
 *
 * SECURITY CONTRACT
 * ─────────────────
 * PuzzleInstance.displayData  → safe to send to browser (NO answers)
 * PuzzleInstance.secretData   → NEVER sent to browser, stored server-side only
 *
 * Adding a new puzzle type:
 *   1. Add the type string to PuzzleType
 *   2. Implement a PuzzleGenerator in puzzleEngine.ts
 *   3. Implement a PuzzleValidator in puzzleValidator.ts
 *   4. Create a frontend component in src/components/puzzles/
 *   5. Register it in ChallengeRenderer.tsx
 */

// ─── Puzzle type registry ─────────────────────────────────────────────────────

export type PuzzleType =
  | 'SEQUENCE'
  | 'CODE_BREAK'
  | 'MEMORY'
  | 'PATTERN'
  | 'ARRANGEMENT'
  | 'HIDDEN_OBJECT'
  | 'LOGIC'
  | 'MULTI_STAGE'
  // Phase 3 daily types
  | 'BROKEN_MACHINE'
  | 'PATTERN_VAULT'
  | 'MEMORY_VAULT'
  | 'CIPHER_ROOM'
  | 'RULE_TRAP'
  | 'BLACK_VAULT'
  | 'FINAL_VAULT';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXTREME';

export type ScoringMethod =
  | 'BINARY'        // full score or zero
  | 'PARTIAL'       // proportional to correct answers
  | 'TIME_BONUS'    // base score + speed bonus
  | 'STAGE_BASED'   // score per completed stage
  | 'ATTEMPT_PENALTY'; // reduced score per failed attempt

// ─── Core engine interfaces ───────────────────────────────────────────────────

/**
 * Data the server generates for one player's puzzle instance.
 * Only displayData leaves the server.
 */
export interface PuzzleInstance {
  seed: string;
  puzzleType: PuzzleType;
  /** Sent to the browser — contains everything needed to render and interact */
  displayData: Record<string, unknown>;
  /** Stored server-side only — contains answers, scoring keys, stage solutions */
  secretData: Record<string, unknown>;
  /** For multi-stage: total number of stages */
  totalStages: number;
  /** Max possible score for this instance */
  maxScore: number;
}

/**
 * Player submits this from the frontend.
 * Shape varies by puzzle type.
 */
export interface PlayerAnswer {
  /** Which stage this answer is for (1 for single-stage) */
  stage: number;
  /** The actual answer payload — shape is puzzle-type specific */
  payload: Record<string, unknown>;
  /** Client-reported interaction metadata (informational only, not trusted for scoring) */
  meta?: Record<string, unknown>;
}

/**
 * Result from the server-side validator.
 */
export interface ValidationResult {
  isCorrect: boolean;
  isPartial: boolean;
  score: number;
  maxScore: number;
  /** Stage-level breakdown for multi-stage */
  stageResults?: StageResult[];
  /** Safe feedback shown to player — no answer leakage */
  feedback: string;
  /** Internal validation details stored server-side only (never sent to browser) */
  internalDetails: Record<string, unknown>;
}

export interface StageResult {
  stage: number;
  isCorrect: boolean;
  score: number;
  maxScore: number;
  feedback: string;
}

/**
 * Submitted stage state — stored in ChallengeAttempt.stageHistory
 */
export interface StageSubmission {
  stage: number;
  submittedAt: Date;
  isCorrect: boolean;
  score: number;
  answer: Record<string, unknown>;
}

// ─── Generator / Validator contract ──────────────────────────────────────────

export interface PuzzleGenerator {
  generate(
    config: Record<string, unknown>,
    seed: string,
    difficulty: Difficulty
  ): PuzzleInstance;
}

export interface PuzzleValidatorI {
  validate(
    secretData: Record<string, unknown>,
    answer: PlayerAnswer,
    timeTakenSeconds: number,
    durationSeconds: number,
    scoringMethod: ScoringMethod,
    attemptsUsed: number,
    maxAttempts: number
  ): ValidationResult;
}
