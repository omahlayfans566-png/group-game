/**
 * dailyPuzzleValidators.ts
 * Server-side validators for all 7 upgraded daily puzzles.
 * Score ALWAYS calculated server-side — never accepted from client.
 */

import { PlayerAnswer, ValidationResult, ScoringMethod } from './puzzleTypes';

function applyScore(base: number, max: number, m: ScoringMethod, t: number, d: number, att: number): number {
  let s = base;
  if (m === 'TIME_BONUS' && s > 0) {
    s = Math.min(max, s + Math.round(s * 0.2 * Math.max(0, 1 - t / d)));
  }
  if (m === 'ATTEMPT_PENALTY' && att > 1) {
    s = Math.max(0, s - Math.round(s * 0.15 * (att - 1)));
  }
  return Math.round(s);
}

function ok(got: unknown, want: unknown): boolean {
  return String(got ?? '').trim().toUpperCase() === String(want ?? '').trim().toUpperCase();
}

// ─── Day 1: BROKEN_MACHINE ────────────────────────────────────────────────────
export function vBrokenMachine(
  sec: Record<string, unknown>, ans: PlayerAnswer,
  t: number, d: number, m: ScoringMethod, att: number, max: number
): ValidationResult {
  const correctRots = sec.correctRots as number[][];
  const reqConn = sec.reqConn as number[][];
  const size = sec.size as number;
  const playerRots = ans.payload.rotations as number[][];

  if (!playerRots || playerRots.length !== size) {
    return { isCorrect: false, isPartial: false, score: 0, maxScore: max, feedback: 'Invalid submission.', internalDetails: {} };
  }

  let correctPath = 0, totalPath = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (reqConn[row][col] !== 0) {
        totalPath++;
        if ((playerRots[row]?.[col] ?? -1) === correctRots[row][col]) correctPath++;
      }
    }
  }

  const isCorrect = correctPath === totalPath;
  const s = applyScore(Math.round((correctPath / Math.max(totalPath, 1)) * max), max, m, t, d, att);
  return {
    isCorrect,
    isPartial: correctPath > 0 && !isCorrect,
    score: s, maxScore: max,
    feedback: isCorrect ? '⚡ Circuit complete! Signal flows SOURCE → SINK.' : `${correctPath}/${totalPath} path nodes correctly aligned.`,
    internalDetails: { correctPath, totalPath },
  };
}

// ─── Day 2: PATTERN_VAULT ─────────────────────────────────────────────────────
// Player now submits BOTH state5 AND state6 grids
export function vPatternVault(
  sec: Record<string, unknown>, ans: PlayerAnswer,
  t: number, d: number, m: ScoringMethod, att: number, max: number
): ValidationResult {
  const flat5 = sec.state5Flat as string[];
  const flat6 = sec.state6Flat as string[];

  const pFlat5 = ((ans.payload.grid5 as (string | null)[][]) || []).flat().map(c => c ?? '');
  const pFlat6 = ((ans.payload.grid6 as (string | null)[][]) || []).flat().map(c => c ?? '');

  let ok5 = 0, ok6 = 0;
  const total = flat5.length; // 4 cells per grid
  for (let i = 0; i < total; i++) {
    if ((pFlat5[i] ?? '') === flat5[i]) ok5++;
    if ((pFlat6[i] ?? '') === flat6[i]) ok6++;
  }

  const totalCorrect = ok5 + ok6;
  const totalCells = total * 2;
  const isCorrect = totalCorrect === totalCells;
  const s = applyScore(Math.round((totalCorrect / totalCells) * max), max, m, t, d, att);

  return {
    isCorrect,
    isPartial: totalCorrect > 0 && !isCorrect,
    score: s, maxScore: max,
    feedback: isCorrect
      ? '🔓 Both patterns correct. Vault unlocked.'
      : `State 5: ${ok5}/${total} · State 6: ${ok6}/${total}`,
    internalDetails: { ok5, ok6, total },
  };
}

// ─── Day 3: MEMORY_VAULT ──────────────────────────────────────────────────────
export function vMemoryVault(
  sec: Record<string, unknown>, ans: PlayerAnswer,
  t: number, d: number, m: ScoringMethod, att: number, max: number
): ValidationResult {
  const stageMax = Math.round(max / 3);
  const stage = ans.stage;

  if (stage === 1) {
    const correct = sec.s1Answers as Record<string, string>;
    const player = (ans.payload.answers as Record<string, string>) || {};
    let cnt = 0; const tot = Object.keys(correct).length;
    for (const k of Object.keys(correct)) if (ok(player[k], correct[k])) cnt++;
    const s = applyScore(Math.round((cnt / tot) * stageMax), stageMax, m, t, d, att);
    return { isCorrect: cnt === tot, isPartial: cnt > 0 && cnt < tot, score: s, maxScore: stageMax, feedback: `${cnt}/${tot} positions correct.`, internalDetails: { cnt, tot } };
  }
  if (stage === 2) {
    const correct = sec.s2Answers as Record<string, string>;
    const player = (ans.payload.answers as Record<string, string>) || {};
    let cnt = 0; const tot = Object.keys(correct).length;
    for (const k of Object.keys(correct)) if (ok(player[k], correct[k])) cnt++;
    const s = applyScore(Math.round((cnt / tot) * stageMax), stageMax, m, t, d, att);
    return { isCorrect: cnt === tot, isPartial: cnt > 0 && cnt < tot, score: s, maxScore: stageMax, feedback: `${cnt}/${tot} relationships correct.`, internalDetails: { cnt, tot } };
  }
  if (stage === 3) {
    const isOk = ok(ans.payload.answer, sec.s3Answer);
    const s = applyScore(isOk ? stageMax : 0, stageMax, m, t, d, att);
    return { isCorrect: isOk, isPartial: false, score: s, maxScore: stageMax, feedback: isOk ? '✓ Correct change identified.' : 'Incorrect.', internalDetails: {} };
  }
  return { isCorrect: false, isPartial: false, score: 0, maxScore: stageMax, feedback: 'Invalid stage.', internalDetails: {} };
}

// ─── Day 4: CIPHER_ROOM ───────────────────────────────────────────────────────
export function vCipherRoom(
  sec: Record<string, unknown>, ans: PlayerAnswer,
  t: number, d: number, m: ScoringMethod, att: number, max: number
): ValidationResult {
  const stages = sec.stages as Record<string, { answer: string; dialValues?: number[]; logicMap?: Record<string, unknown> }>;
  const stageNum = ans.stage;
  const st = stages[stageNum];
  if (!st) return { isCorrect: false, isPartial: false, score: 0, maxScore: max, feedback: 'Invalid stage.', internalDetails: {} };

  const stMax = Math.round(max / 4);

  if (stageNum === 1 && st.dialValues) {
    const dials = (ans.payload.dialValues as number[]) || [];
    let cnt = 0;
    for (let i = 0; i < st.dialValues.length; i++) if (Number(dials[i]) === st.dialValues[i]) cnt++;
    const isOk = cnt === st.dialValues.length;
    const s = applyScore(isOk ? stMax : Math.round((cnt / st.dialValues.length) * stMax), stMax, m, t, d, att);
    return { isCorrect: isOk, isPartial: cnt > 0 && !isOk, score: s, maxScore: stMax, feedback: isOk ? '🔓 Lock 1 opened!' : `${cnt}/${st.dialValues.length} dials correct.`, internalDetails: { cnt } };
  }

  if (stageNum === 3 && st.logicMap) {
    const lMap = st.logicMap as Record<string, { role: string; floor: number }>;
    const player = (ans.payload.logicMap as Record<string, { role: string; floor: number }>) || {};
    const agents = Object.keys(lMap);
    let cnt = 0;
    for (const a of agents) {
      const p = player[a];
      if (p && ok(p.role, lMap[a].role) && Number(p.floor) === lMap[a].floor) cnt++;
    }
    const isOk = cnt === agents.length;
    const s = applyScore(Math.round((cnt / agents.length) * stMax), stMax, m, t, d, att);
    return { isCorrect: isOk, isPartial: cnt > 0 && !isOk, score: s, maxScore: stMax, feedback: isOk ? '🔓 Lock 3 opened!' : `${cnt}/${agents.length} agents correct.`, internalDetails: { cnt } };
  }

  // Stages 2 & 4: string answer
  const isOk = ok(ans.payload.answer, st.answer);
  const s = applyScore(isOk ? stMax : 0, stMax, m, t, d, att);
  return { isCorrect: isOk, isPartial: false, score: s, maxScore: stMax, feedback: isOk ? `🔓 Lock ${stageNum} opened!` : `Lock ${stageNum} — incorrect.`, internalDetails: { stageNum } };
}

// ─── Day 5: RULE_TRAP ─────────────────────────────────────────────────────────
export function vRuleTrap(
  sec: Record<string, unknown>, ans: PlayerAnswer,
  t: number, d: number, m: ScoringMethod, att: number, max: number
): ValidationResult {
  const activeIds = new Set(sec.activeIds as number[]);
  const type = (ans.payload.type as string) || 'final';
  const selected = new Set((ans.payload.selectedIds as number[]) || []);

  const correctSel = [...activeIds].filter(id => selected.has(id)).length;
  const incorrectSel = [...selected].filter(id => !activeIds.has(id)).length;
  const missed = [...activeIds].filter(id => !selected.has(id)).length;

  if (type === 'probe') {
    let fb: string;
    if (incorrectSel === 0 && missed === 0) fb = '✓ EXACT MATCH — all active objects, no incorrect.';
    else if (incorrectSel === 0 && missed > 0) fb = `CLOSE — only active objects selected, but ${missed} missing.`;
    else if (correctSel === 0) fb = 'NONE ACTIVE — none selected are active.';
    else if (correctSel > 0 && incorrectSel > 0) fb = `PARTIAL — ${correctSel} correct, ${incorrectSel} wrong, ${missed} missing.`;
    else fb = `MIXED — ${correctSel} correct, ${missed} missing.`;
    return { isCorrect: false, isPartial: true, score: 0, maxScore: max, feedback: fb, internalDetails: { isProbeFeedback: true, correctSel, incorrectSel, missed } };
  }

  // Final answer
  const isCorrect = incorrectSel === 0 && missed === 0;
  const base = isCorrect ? max : Math.max(0, Math.round((correctSel / Math.max(activeIds.size, 1)) * max) - incorrectSel * 15);
  const s = applyScore(base, max, m, t, d, att);
  return {
    isCorrect,
    isPartial: correctSel > 0 && !isCorrect,
    score: s, maxScore: max,
    feedback: isCorrect ? '⚡ Rule identified. Vault unlocked.' : `${correctSel}/${activeIds.size} active, ${incorrectSel} wrong.`,
    internalDetails: { correctSel, incorrectSel, missed, activeIds: [...activeIds] },
  };
}

// ─── Day 6: BLACK_VAULT ───────────────────────────────────────────────────────
export function vBlackVault(
  sec: Record<string, unknown>, ans: PlayerAnswer,
  t: number, d: number, m: ScoringMethod, att: number, max: number
): ValidationResult {
  const stages = sec.stages as Record<string, { answer: string; shiftA?: number; shiftB?: number; agentMap?: Record<string, number>; colorGrid?: Array<{ id: number; code: string }> }>;
  const stageNum = ans.stage;
  const st = stages[stageNum];
  if (!st) return { isCorrect: false, isPartial: false, score: 0, maxScore: max, feedback: 'Invalid stage.', internalDetails: {} };

  const stMax = Math.round(max / 5);

  // Stage 4: agent deduction — player submits losing agent name
  if (stageNum === 4) {
    const isOk = ok(ans.payload.answer, st.answer);
    const s = applyScore(isOk ? stMax : 0, stMax, m, t, d, att);
    return { isCorrect: isOk, isPartial: false, score: s, maxScore: stMax, feedback: isOk ? 'Stage 4 complete. KEY D obtained.' : 'Incorrect agent.', internalDetails: {} };
  }

  const isOk = ok(ans.payload.answer, st.answer);
  const s = applyScore(isOk ? stMax : 0, stMax, m, t, d, att);
  const labels = ['', 'KEY A extracted.', 'KEY B found.', 'KEY C acquired.', 'KEY D confirmed.', 'VAULT OPENED!'];
  return { isCorrect: isOk, isPartial: false, score: s, maxScore: stMax, feedback: isOk ? `Stage ${stageNum} — ${labels[stageNum]}` : `Stage ${stageNum} incorrect.`, internalDetails: { stageNum } };
}

// ─── Day 7: FINAL_VAULT ───────────────────────────────────────────────────────
export function vFinalVault(
  sec: Record<string, unknown>, ans: PlayerAnswer,
  t: number, d: number, m: ScoringMethod, att: number, max: number
): ValidationResult {
  const stages = sec.stages as Record<string, { answer?: string; answers?: Record<string, string>; logicMap?: Record<string, unknown>; cipherShift?: number; VISUAL_KEY?: number; PATTERN_KEY?: number; LOGIC_KEY?: number; CIPHER_KEY?: number }>;
  const stageNum = ans.stage;
  const st = stages[stageNum];
  if (!st) return { isCorrect: false, isPartial: false, score: 0, maxScore: max, feedback: 'Invalid stage.', internalDetails: {} };

  const stMax = Math.round(max / 5);

  // Stage 1: visual grid — 3 answers
  if (stageNum === 1 && st.answers) {
    const correct = st.answers;
    const player = (ans.payload.answers as Record<string, string>) || {};
    let cnt = 0; const tot = Object.keys(correct).length;
    for (const k of Object.keys(correct)) if (ok(player[k], correct[k])) cnt++;
    const s = applyScore(Math.round((cnt / tot) * stMax), stMax, m, t, d, att);
    return { isCorrect: cnt === tot, isPartial: cnt > 0 && cnt < tot, score: s, maxScore: stMax, feedback: cnt === tot ? 'Stage 1 — VISUAL KEY obtained.' : `${cnt}/${tot} positions correct.`, internalDetails: { cnt, tot } };
  }

  // Stage 2: triple pattern — single symbol answer
  if (stageNum === 2) {
    const isOk = ok(ans.payload.symbol, st.answer);
    const s = applyScore(isOk ? stMax : 0, stMax, m, t, d, att);
    return { isCorrect: isOk, isPartial: false, score: s, maxScore: stMax, feedback: isOk ? 'Stage 2 — PATTERN KEY obtained.' : 'Incorrect symbol.', internalDetails: {} };
  }

  // Stage 3: logic grid — {role, code} per agent
  if (stageNum === 3 && st.logicMap) {
    const lMap = st.logicMap as Record<string, { role: string; code: number }>;
    const player = (ans.payload.logicMap as Record<string, { role: string; code: number }>) || {};
    const agents = Object.keys(lMap);
    let cnt = 0;
    for (const a of agents) {
      const p = player[a];
      if (p && ok(p.role, lMap[a].role) && Number(p.code) === lMap[a].code) cnt++;
    }
    const isOk = cnt === agents.length;
    const s = applyScore(Math.round((cnt / agents.length) * stMax), stMax, m, t, d, att);
    return { isCorrect: isOk, isPartial: cnt > 0 && !isOk, score: s, maxScore: stMax, feedback: isOk ? 'Stage 3 — LOGIC KEY obtained.' : `${cnt}/${agents.length} agents correct.`, internalDetails: { cnt } };
  }

  // Stages 4 & 5: string answer
  const isOk = ok(ans.payload.answer, st.answer);
  const s = applyScore(isOk ? stMax : 0, stMax, m, t, d, att);
  const finalMsg = stageNum === 5 ? '🏆 FINAL VAULT CONQUERED.' : `Stage ${stageNum} complete.`;
  return { isCorrect: isOk, isPartial: false, score: s, maxScore: stMax, feedback: isOk ? finalMsg : `Stage ${stageNum} — incorrect.`, internalDetails: { stageNum } };
}
