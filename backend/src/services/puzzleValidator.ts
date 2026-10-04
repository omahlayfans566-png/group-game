/**
 * puzzleValidator.ts
 * Server-side answer validation for ALL puzzle types (Phase 2 + Phase 3).
 * Score is ALWAYS calculated here — never accepted from client.
 */

import { PlayerAnswer, ValidationResult, ScoringMethod } from './puzzleTypes';
import {
  vBrokenMachine, vPatternVault, vMemoryVault,
  vCipherRoom, vRuleTrap, vBlackVault, vFinalVault,
} from './dailyPuzzleValidators';

function applyScoring(base: number, max: number, method: ScoringMethod,
  time: number, duration: number, attempts: number): number {
  let score = base;
  if (method === 'TIME_BONUS' && score > 0) {
    const ratio = Math.max(0, 1 - time / duration);
    score = Math.min(max, score + Math.round(score * 0.25 * ratio));
  }
  if (method === 'ATTEMPT_PENALTY' && attempts > 1) {
    score = Math.max(0, score - Math.round(score * 0.15 * (attempts - 1)));
  }
  return Math.round(score);
}

// ─── Phase 2 validators (preserved) ──────────────────────────────────────────

function vSequence(secret: Record<string, unknown>, answer: PlayerAnswer, t: number, d: number, m: ScoringMethod, att: number, max: number): ValidationResult {
  const correct = secret.answers as Record<string, number>;
  const player = (answer.payload.answers as Record<string, string | number>) || {};
  let ok = 0; const total = Object.keys(correct).length;
  for (const k of Object.keys(correct)) { if (Number(player[k]) === correct[k]) ok++; }
  const score = applyScoring(Math.round((ok / total) * max), max, m, t, d, att);
  return { isCorrect: ok === total, isPartial: ok > 0 && ok < total, score, maxScore: max, feedback: ok === total ? 'All sequences solved!' : `${ok}/${total} correct.`, internalDetails: { ok, total } };
}

function vCodeBreak(secret: Record<string, unknown>, answer: PlayerAnswer, t: number, d: number, m: ScoringMethod, att: number, max: number): ValidationResult {
  const correct = String(secret.code).trim();
  const player = String(answer.payload.code ?? '').trim();
  const isOk = player === correct;
  const score = applyScoring(isOk ? max : 0, max, m, t, d, att);
  return { isCorrect: isOk, isPartial: false, score, maxScore: max, feedback: isOk ? 'Code accepted.' : 'Incorrect code.', internalDetails: { correct, player } };
}

function vMemory(secret: Record<string, unknown>, answer: PlayerAnswer, t: number, d: number, m: ScoringMethod, att: number, max: number): ValidationResult {
  const correct = secret.answers as Record<string, string>;
  const player = (answer.payload.answers as Record<string, string>) || {};
  let ok = 0; const total = Object.keys(correct).length;
  for (const k of Object.keys(correct)) { if ((player[k] ?? '').trim() === correct[k]) ok++; }
  const score = applyScoring(Math.round((ok / total) * max), max, m, t, d, att);
  return { isCorrect: ok === total, isPartial: ok > 0 && ok < total, score, maxScore: max, feedback: `${ok}/${total} recalled.`, internalDetails: { ok, total } };
}

function vPattern(secret: Record<string, unknown>, answer: PlayerAnswer, t: number, d: number, m: ScoringMethod, att: number, max: number): ValidationResult {
  const correct = secret.answers as Record<string, string | number>;
  const player = (answer.payload.answers as Record<string, string | number>) || {};
  let ok = 0; const total = Object.keys(correct).length;
  for (const k of Object.keys(correct)) {
    if (String(player[k] ?? '').trim().toUpperCase() === String(correct[k]).trim().toUpperCase()) ok++;
  }
  const score = applyScoring(Math.round((ok / total) * max), max, m, t, d, att);
  return { isCorrect: ok === total, isPartial: ok > 0 && ok < total, score, maxScore: max, feedback: ok === total ? 'All patterns correct!' : `${ok}/${total} correct.`, internalDetails: { ok, total } };
}

function vArrangement(secret: Record<string, unknown>, answer: PlayerAnswer, t: number, d: number, m: ScoringMethod, att: number, max: number): ValidationResult {
  const correct = secret.correctOrder as string[];
  const player = (answer.payload.order as string[]) || [];
  let ok = 0; const total = correct.length;
  for (let i = 0; i < total; i++) { if (player[i] === correct[i]) ok++; }
  const isOk = ok === total;
  const score = applyScoring(Math.round((ok / total) * max), max, m, t, d, att);
  return { isCorrect: isOk, isPartial: ok > 0 && !isOk, score, maxScore: max, feedback: isOk ? 'Perfect arrangement!' : `${ok}/${total} in correct position.`, internalDetails: { ok, total } };
}

function vHiddenObject(secret: Record<string, unknown>, answer: PlayerAnswer, t: number, d: number, m: ScoringMethod, att: number, max: number): ValidationResult {
  const correct = secret.answers as Record<string, { row: number; col: number }>;
  const player = (answer.payload.found as Record<string, { row: number; col: number }>) || {};
  let found = 0; const total = Object.keys(correct).length;
  for (const w of Object.keys(correct)) { const g = player[w]; if (g && g.row === correct[w].row && g.col === correct[w].col) found++; }
  const score = applyScoring(Math.round((found / total) * max), max, m, t, d, att);
  return { isCorrect: found === total, isPartial: found > 0 && found < total, score, maxScore: max, feedback: `${found}/${total} located.`, internalDetails: { found, total } };
}

function vLogic(secret: Record<string, unknown>, answer: PlayerAnswer, t: number, d: number, m: ScoringMethod, att: number, max: number): ValidationResult {
  const correct = secret.mapping as Record<string, { role: string; number: number }>;
  const player = (answer.payload.mapping as Record<string, { role: string; number: number }>) || {};
  let ok = 0; const total = Object.keys(correct).length;
  for (const name of Object.keys(correct)) {
    const g = player[name];
    if (g && g.role === correct[name].role && Number(g.number) === correct[name].number) ok++;
  }
  const score = applyScoring(Math.round((ok / total) * max), max, m, t, d, att);
  return { isCorrect: ok === total, isPartial: ok > 0 && ok < total, score, maxScore: max, feedback: ok === total ? 'Logic puzzle solved!' : `${ok}/${total} correct.`, internalDetails: { ok, total } };
}

function vMultiStage(secret: Record<string, unknown>, answer: PlayerAnswer, t: number, d: number, m: ScoringMethod, att: number, max: number): ValidationResult {
  const stages = secret.stages as Record<string, { answer: string }>;
  const stageNum = answer.stage;
  const stageSecret = stages[stageNum];
  if (!stageSecret) return { isCorrect: false, isPartial: false, score: 0, maxScore: max, feedback: 'Invalid stage.', internalDetails: {} };
  const player = String(answer.payload.answer ?? '').trim();
  const isOk = player === stageSecret.answer.trim();
  const stageMax = Math.round(max / Object.keys(stages).length);
  const score = applyScoring(isOk ? stageMax : 0, stageMax, m, t, d, att);
  return { isCorrect: isOk, isPartial: false, score, maxScore: stageMax, feedback: isOk ? `Stage ${stageNum} complete!` : `Stage ${stageNum} incorrect.`, internalDetails: { stageNum, isOk } };
}

// ─── Phase 3 daily validators — imported from dailyPuzzleValidators.ts ───────

// ─── Public router ────────────────────────────────────────────────────────────

export function validatePuzzle(
  puzzleType: string,
  secretData: Record<string, unknown>,
  answer: PlayerAnswer,
  timeTaken: number,
  duration: number,
  scoringMethod: string,
  attemptsUsed: number,
  _maxAttempts: number,
  maxScore: number
): ValidationResult {
  const m = scoringMethod as ScoringMethod;
  const args: [Record<string, unknown>, PlayerAnswer, number, number, ScoringMethod, number, number] =
    [secretData, answer, timeTaken, duration, m, attemptsUsed, maxScore];

  switch (puzzleType) {
    case 'SEQUENCE': return vSequence(...args);
    case 'CODE_BREAK': return vCodeBreak(...args);
    case 'MEMORY': return vMemory(...args);
    case 'PATTERN': return vPattern(...args);
    case 'ARRANGEMENT': return vArrangement(...args);
    case 'HIDDEN_OBJECT': return vHiddenObject(...args);
    case 'LOGIC': return vLogic(...args);
    case 'MULTI_STAGE': return vMultiStage(...args);
    case 'BROKEN_MACHINE': return vBrokenMachine(...args);
    case 'PATTERN_VAULT': return vPatternVault(...args);
    case 'MEMORY_VAULT': return vMemoryVault(...args);
    case 'CIPHER_ROOM': return vCipherRoom(...args);
    case 'RULE_TRAP': return vRuleTrap(...args);
    case 'BLACK_VAULT': return vBlackVault(...args);
    case 'FINAL_VAULT': return vFinalVault(...args);
    default: return vCodeBreak(...args);
  }
}
