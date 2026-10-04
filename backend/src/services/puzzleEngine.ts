/**
 * puzzleEngine.ts — Complete puzzle generator registry
 * Phase 2 types (8) + Phase 3 daily types (7) all live here.
 * Adding a type: implement generator → add to GENERATORS map → add frontend component.
 */

import { SeededRandom } from './seededRandom';
import { PuzzleType, PuzzleInstance, PuzzleGenerator, Difficulty } from './puzzleTypes';
import {
  BrokenMachineGenerator as BrokenMachineGen,
  PatternVaultGenerator as PatternVaultGen,
  MemoryVaultGenerator as MemoryVaultGen,
  CipherRoomGenerator as CipherRoomGen,
  RuleTrapGenerator as RuleTrapGen,
  BlackVaultGenerator as BlackVaultGen,
  FinalVaultGenerator as FinalVaultGen,
} from './dailyPuzzleGenerators';

function rng(seed: string): SeededRandom { return new SeededRandom(seed); }

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 GENERATORS (preserved exactly)
// ═══════════════════════════════════════════════════════════════════════════

const SequenceGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);
    const count = difficulty === 'EASY' ? 1 : difficulty === 'MEDIUM' ? 2 : 3;
    const sequences: Array<{ id: number; visible: (number | null)[]; gapIndices: number[] }> = [];
    const answers: Record<string, number> = {};
    for (let s = 0; s < count; s++) {
      const length = r.int(6, 8);
      const opType = r.int(0, 2);
      let series: number[];
      if (opType === 0) { const st = r.int(2, 20), step = r.int(2, difficulty === 'EASY' ? 5 : 15); series = Array.from({ length }, (_, i) => st + i * step); }
      else if (opType === 1) { const st = r.int(1, 5), fac = r.int(2, 3); series = [st]; for (let i = 1; i < length; i++) series.push(series[i - 1] * fac); }
      else { const a = r.int(1, 5), b = r.int(1, 5); series = [a, b]; for (let i = 2; i < length; i++) series.push(series[i - 2] + series[i - 1]); }
      const numGaps = difficulty === 'EASY' ? 1 : 2;
      const candidates = series.slice(1, -1).map((_, i) => i + 1);
      const gapIndices = r.sample(candidates, Math.min(numGaps, candidates.length));
      const visible: (number | null)[] = series.map((v, i) => gapIndices.includes(i) ? null : v);
      gapIndices.forEach(idx => { answers[`${s + 1}_${idx}`] = series[idx]; });
      sequences.push({ id: s + 1, visible, gapIndices });
    }
    return {
      seed, puzzleType: 'SEQUENCE', totalStages: 1, maxScore: (config.maxScore as number) || 100,
      displayData: { sequences: sequences.map(s => ({ id: s.id, visible: s.visible })), instructions: 'Find the missing number(s) in each sequence.', gapCount: sequences.reduce((a, s) => a + s.gapIndices.length, 0) },
      secretData: { answers, sequences }
    };
  }
};

const CodeBreakGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);
    const codeLength = difficulty === 'EASY' ? 3 : difficulty === 'MEDIUM' ? 4 : 5;
    const code = Array.from({ length: codeLength }, () => r.int(1, 9));
    const codeString = code.join('');
    const clues = [
      { id: 1, text: `The sum of all ${codeLength} digits is: ${code.reduce((a, b) => a + b, 0)}`, hint: 'Add all digits' },
      { id: 2, text: `The first digit × ${r.int(2, 5)} = ${code[0] * r.int(2, 5)}`, hint: 'Divide to find the digit' },
      { id: 3, text: `Last digit + ${r.int(3, 12)} = ${code[codeLength - 1] + r.int(3, 12)}`, hint: 'Subtract to find it' },
    ];
    if (codeLength >= 4) { const mid = code.slice(1, -1); clues.push({ id: 4, text: `Product of middle digits: ${mid.reduce((a, b) => a * b, 1)}`, hint: 'Find the factors' }); }
    return {
      seed, puzzleType: 'CODE_BREAK', totalStages: 1, maxScore: (config.maxScore as number) || 100,
      displayData: { clues: r.shuffle(clues), codeLength, instructions: `Find the ${codeLength}-digit code (each digit 1–9).`, inputLabel: `Enter the ${codeLength}-digit code` },
      secretData: { code: codeString, digits: code }
    };
  }
};

const SYMBOLS = ['★', '◆', '▲', '●', '■', '♦', '✦', '⬟', '⬡', '⬢', '⬣', '◈'];
const MemoryGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);
    const gridSize = difficulty === 'EASY' ? 3 : difficulty === 'MEDIUM' ? 4 : 5;
    const revealSeconds = difficulty === 'EASY' ? 8 : difficulty === 'MEDIUM' ? 6 : 4;
    const symbols = r.sample(SYMBOLS, 6);
    const grid: string[][] = [];
    for (let row = 0; row < gridSize; row++) { const rowArr: string[] = []; for (let col = 0; col < gridSize; col++) rowArr.push(r.pick(symbols)); grid.push(rowArr); }
    const numQ = difficulty === 'EASY' ? 2 : 3;
    const questions: Array<{ id: number; row: number; col: number; label: string }> = [];
    const answers: Record<string, string> = {};
    const positions: Array<[number, number]> = [];
    for (let i = 0; i < gridSize; i++) for (let j = 0; j < gridSize; j++) positions.push([i, j]);
    r.sample(positions, numQ).forEach(([row, col], idx) => {
      questions.push({ id: idx + 1, row, col, label: `What symbol was at Row ${row + 1}, Column ${col + 1}?` });
      answers[`q${idx + 1}`] = grid[row][col];
    });
    return {
      seed, puzzleType: 'MEMORY', totalStages: 2, maxScore: (config.maxScore as number) || 100,
      displayData: { grid, gridSize, symbols, revealSeconds, questions: questions.map(q => ({ id: q.id, label: q.label })), instructions: `Memorise the grid. You have ${revealSeconds} seconds.` },
      secretData: { answers, grid, questions }
    };
  }
};

const PatternGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);
    const numP = difficulty === 'EASY' ? 1 : 2;
    const patterns: Array<{ id: number; items: (string | number)[]; question: string }> = [];
    const answers: Record<string, string | number> = {};
    for (let p = 0; p < numP; p++) {
      const t = r.int(0, 3);
      if (t === 0) { const s = r.sample(['A', 'B', 'C', 'X', 'Y'], 2); const seq = Array.from({ length: 6 }, (_, i) => s[i % 2]); patterns.push({ id: p + 1, items: [...seq, '?'], question: 'What comes next?' }); answers[`p${p + 1}`] = s[6 % 2]; }
      else if (t === 1) { const b = r.int(1, 4); const seq = [b, b * 2, b * 4, b * 8, b * 16]; patterns.push({ id: p + 1, items: [...seq, '?'], question: 'Next number?' }); answers[`p${p + 1}`] = b * 32; }
      else if (t === 2) { const st = r.int(1, 20), step = r.int(3, 8); const seq = Array.from({ length: 5 }, (_, i) => st + i * step); patterns.push({ id: p + 1, items: [...seq, '?'], question: 'Next number?' }); answers[`p${p + 1}`] = st + 5 * step; }
      else { const sc = r.int(65, 75), skip = r.int(1, 3); const seq = Array.from({ length: 5 }, (_, i) => String.fromCharCode(sc + i * skip)); patterns.push({ id: p + 1, items: [...seq, '?'], question: 'Next letter?' }); answers[`p${p + 1}`] = String.fromCharCode(sc + 5 * skip); }
    }
    return {
      seed, puzzleType: 'PATTERN', totalStages: 1, maxScore: (config.maxScore as number) || 100,
      displayData: { patterns: patterns.map(p => ({ id: p.id, items: p.items, question: p.question })), instructions: 'Identify the rule and provide the missing item.' },
      secretData: { answers, patterns }
    };
  }
};

const ArrangementGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);
    const pools: Record<string, string[][]> = {
      EASY: [['January', 'April', 'July', 'October', 'December'], ['Monday', 'Wednesday', 'Friday', 'Sunday']],
      MEDIUM: [['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn'], ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta']],
      HARD: [['Hydrogen', 'Helium', 'Lithium', 'Beryllium', 'Boron', 'Carbon', 'Nitrogen']],
      EXTREME: [['01', '03', '07', '15', '31', '63', '127', '255']],
    };
    const pool = pools[difficulty] ?? pools['MEDIUM'];
    const correctOrder = r.pick(pool);
    const shuffledOrder = r.shuffle(correctOrder);
    return {
      seed, puzzleType: 'ARRANGEMENT', totalStages: 1, maxScore: (config.maxScore as number) || 100,
      displayData: { items: shuffledOrder.map((label, i) => ({ id: i, label })), instructions: 'Arrange in the correct order.', itemCount: shuffledOrder.length },
      secretData: { correctOrder, shuffledOrder }
    };
  }
};

const HiddenObjectGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);
    const size = difficulty === 'EASY' ? 6 : difficulty === 'MEDIUM' ? 8 : 10;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const grid: string[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => letters[r.int(0, 25)]));
    const wordPool = ['CODE', 'KEY', 'GATE', 'LOCK', 'ZERO', 'DATA', 'NODE'];
    const numW = difficulty === 'EASY' ? 2 : difficulty === 'MEDIUM' ? 3 : 4;
    const targetWords = r.sample(wordPool, numW);
    const planted: Array<{ word: string; row: number; col: number; direction: string }> = [];
    for (const word of targetWords) {
      let placed = false;
      for (let at = 0; at < 50 && !placed; at++) {
        const dir = r.pick(['horizontal', 'vertical']);
        if (dir === 'horizontal' && size - word.length >= 0) { const row = r.int(0, size - 1), col = r.int(0, size - word.length); for (let i = 0; i < word.length; i++)grid[row][col + i] = word[i]; planted.push({ word, row, col, direction: dir }); placed = true; }
        else if (dir === 'vertical' && size - word.length >= 0) { const row = r.int(0, size - word.length), col = r.int(0, size - 1); for (let i = 0; i < word.length; i++)grid[row + i][col] = word[i]; planted.push({ word, row, col, direction: dir }); placed = true; }
      }
    }
    const answers: Record<string, { row: number; col: number }> = {};
    planted.forEach(pw => { answers[pw.word] = { row: pw.row, col: pw.col }; });
    return {
      seed, puzzleType: 'HIDDEN_OBJECT', totalStages: 1, maxScore: (config.maxScore as number) || 100,
      displayData: { grid, gridSize: size, targetWords: targetWords.map(w => ({ word: w })), instructions: 'Find all hidden words. Click the first letter of each word.' },
      secretData: { answers, planted }
    };
  }
};

const LogicGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);
    const names = r.shuffle(['ALPHA', 'BETA', 'GAMMA', 'DELTA']).slice(0, 3);
    const roles = r.shuffle(['Engineer', 'Scout', 'Commander']);
    const numbers = r.shuffle([1, 2, 3]);
    const mapping: Record<string, { role: string; number: number }> = {};
    names.forEach((name, i) => { mapping[name] = { role: roles[i], number: numbers[i] }; });
    const clues = [
      `${names[0]}'s number is ${mapping[names[0]].number}.`,
      `${names[1]}'s role is ${mapping[names[1]].role}.`,
      `The ${mapping[names[2]].role} is NOT number ${numbers[(numbers.indexOf(mapping[names[2]].number) + 1) % 3]}.`,
      `${names[0]}'s role is NOT ${roles[(roles.indexOf(mapping[names[0]].role) + 1) % 3]}.`,
    ];
    return {
      seed, puzzleType: 'LOGIC', totalStages: 1, maxScore: (config.maxScore as number) || 100,
      displayData: { names, roles, numbers, clues: r.shuffle(clues), instructions: "Use the clues to determine each agent's role and number." },
      secretData: { mapping }
    };
  }
};

const MultiStageGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);
    const seqStart = r.int(2, 10), seqStep = r.int(3, 8);
    const seqTerms = Array.from({ length: 5 }, (_, i) => seqStart + i * seqStep);
    const seqAnswer = seqStart + 5 * seqStep;
    const extra = [r.int(1, 9), r.int(1, 9)];
    const stage2Code = [seqAnswer % 10, ...extra].join('');
    const symbols2 = r.shuffle(['◆', '●', '■', '▲']).slice(0, 2);
    const patternSeq = Array.from({ length: 6 }, (_, i) => symbols2[i % 2]);
    const patternAnswer = symbols2[6 % 2];
    const finalCode = `${seqAnswer % 10}${extra[0]}${extra[1]}`;
    return {
      seed, puzzleType: 'MULTI_STAGE', totalStages: 4, maxScore: (config.maxScore as number) || 200,
      displayData: {
        totalStages: 4, stages: [
          { stage: 1, type: 'SEQUENCE', title: 'Stage 1 — The Sequence', items: [...seqTerms, '?'], instructions: 'Find the next number. This is your Stage Key.' },
          { stage: 2, type: 'CODE_BREAK', title: 'Stage 2 — The Vault', instructions: 'First digit = (Stage Key) mod 10. Find remaining digits from clues.', clues: [`Second digit: ${extra[0] * 3} ÷ 3`, `Third digit: √${extra[1] * extra[1]}`], codeLength: 3 },
          { stage: 3, type: 'PATTERN', title: 'Stage 3 — The Signal', items: [...patternSeq, '?'], instructions: 'What symbol continues this pattern?' },
          { stage: 4, type: 'FINAL', title: 'Stage 4 — Final Transmission', instructions: 'Combine: [Stage1 mod 10][Stage2 digit2][Stage2 digit3] → 3-digit code.' },
        ], instructions: 'Complete each stage in order. Answers from earlier stages feed later ones.'
      },
      secretData: { stages: { 1: { answer: String(seqAnswer) }, 2: { answer: stage2Code }, 3: { answer: patternAnswer }, 4: { answer: finalCode } }, finalCode }
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3 DAILY PUZZLE GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

// ─── DAY 1: THE BROKEN MACHINE ───────────────────────────────────────────────
// Players see a 5×5 grid of circuit tiles, each with directional connectors.
// They must arrange tiles so energy flows from START (top-left) to END (bottom-right).
// Each player gets a different randomly shuffled board + a different correct solution.

const BrokenMachineGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);
    // Tile types: connectors pointing in specific directions
    // Encoded as bitmask: N=1, E=2, S=4, W=8
    const size = difficulty === 'EXTREME' ? 6 : 5;

    // Generate a random valid path from (0,0) to (size-1,size-1)
    type Cell = [number, number];
    const path: Cell[] = [[0, 0]];
    const visited = new Set<string>();
    visited.add('0,0');

    let curr: Cell = [0, 0];
    while (curr[0] !== size - 1 || curr[1] !== size - 1) {
      const [row, col] = curr;
      const dirs: Cell[] = [];
      if (row < size - 1) dirs.push([row + 1, col]);
      if (col < size - 1) dirs.push([row, col + 1]);
      if (row > 0 && r.next() < 0.2) dirs.push([row - 1, col]);
      const valid = dirs.filter(([nr, nc]) => !visited.has(`${nr},${nc}`));
      if (valid.length === 0) break;
      const next = r.pick(valid);
      visited.add(`${next[0]},${next[1]}`);
      path.push(next);
      curr = next;
    }

    // Build connection map from path
    const connMap: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
    for (let i = 0; i < path.length - 1; i++) {
      const [r1, c1] = path[i];
      const [r2, c2] = path[i + 1];
      if (r2 === r1 + 1) { connMap[r1][c1] |= 4; connMap[r2][c2] |= 1; }  // S / N
      else if (r2 === r1 - 1) { connMap[r1][c1] |= 1; connMap[r2][c2] |= 4; }  // N / S
      else if (c2 === c1 + 1) { connMap[r1][c1] |= 2; connMap[r2][c2] |= 8; }  // E / W
      else if (c2 === c1 - 1) { connMap[r1][c1] |= 8; connMap[r2][c2] |= 2; }  // W / E
    }

    // Fill non-path cells with random decorative tiles
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (connMap[row][col] === 0) {
          connMap[row][col] = r.pick([1, 2, 3, 4, 5, 6, 8, 9, 10, 12]);
        }
      }
    }

    // Flatten grid and shuffle for player
    const correctGrid = connMap.map(row => [...row]);
    const flatTiles = connMap.flat();
    const shuffledTiles = r.shuffle(flatTiles);

    // Build tile display labels
    const TILE_LABELS: Record<number, string> = {
      1: '╵', 2: '╶', 3: '└', 4: '╷', 5: '│', 6: '┌', 8: '╴', 9: '┘', 10: '─', 12: '┐', 15: '┼',
    };

    const tilesForDisplay = shuffledTiles.map((conn, idx) => ({
      id: idx,
      conn,
      label: TILE_LABELS[conn] ?? '·',
      rotation: 0,
    }));

    const correctFlat = correctGrid.flat();

    return {
      seed,
      puzzleType: 'BROKEN_MACHINE',
      totalStages: 1,
      maxScore: (config.maxScore as number) || 100,
      displayData: {
        size,
        tiles: tilesForDisplay,
        instructions: `Arrange the circuit tiles so energy flows from START (top-left ⚡) to END (bottom-right 🎯). Drag tiles into position to complete the circuit.`,
        startCell: [0, 0],
        endCell: [size - 1, size - 1],
        pathLength: path.length,
      },
      secretData: {
        correctGrid,
        correctFlat,
        path,
        size,
      },
    };
  },
};

// ─── DAY 2: THE PATTERN VAULT ─────────────────────────────────────────────────
// Players see 3 input→output symbol transformations. They must discover the rule
// and apply it to unlock the vault by answering 3 test cases correctly.

const PatternVaultGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);

    // Generate a hidden transformation rule
    // Rule types: rotate, mirror, add-offset, swap-pair
    const ruleType = r.int(0, 3);
    const SHAPE_SETS = [
      ['◆', '●', '■', '▲', '✦', '⬡'],
      ['A', 'B', 'C', 'D', 'E', 'F'],
      ['①', '②', '③', '④', '⑤', '⑥'],
      ['↑', '→', '↓', '←', '↗', '↘'],
    ];
    const shapeSet = r.pick(SHAPE_SETS);
    const offset = r.int(1, 3);

    // Function to apply the hidden rule
    const applyRule = (idx: number): number => {
      if (ruleType === 0) return (idx + offset) % shapeSet.length;          // shift right
      if (ruleType === 1) return (shapeSet.length - 1 - idx);               // mirror
      if (ruleType === 2) return (idx * 2) % shapeSet.length;               // double
      return (idx + shapeSet.length - offset) % shapeSet.length;            // shift left
    };

    // Generate examples (input → output pairs)
    const exampleIndices = r.sample([0, 1, 2, 3, 4, 5].slice(0, shapeSet.length), 3);
    const examples = exampleIndices.map(idx => ({
      input: shapeSet[idx],
      output: shapeSet[applyRule(idx)],
    }));

    // Generate test cases (player must supply output)
    const testIndices = r.sample(
      [0, 1, 2, 3, 4, 5].slice(0, shapeSet.length).filter(i => !exampleIndices.includes(i)),
      difficulty === 'EASY' ? 2 : 3
    );
    const tests = testIndices.map((idx, i) => ({ id: i + 1, input: shapeSet[idx] }));
    const answers: Record<string, string> = {};
    testIndices.forEach((idx, i) => { answers[`t${i + 1}`] = shapeSet[applyRule(idx)]; });

    return {
      seed,
      puzzleType: 'PATTERN_VAULT',
      totalStages: 1,
      maxScore: (config.maxScore as number) || 100,
      displayData: {
        shapeSet,
        examples,
        tests,
        instructions: `Study the transformation examples below. Discover the hidden rule. Apply it to the test inputs and enter the correct outputs.`,
        exampleCount: examples.length,
        testCount: tests.length,
      },
      secretData: { answers, ruleType, offset, shapeSet },
    };
  },
};

// ─── DAY 3: THE MEMORY VAULT ──────────────────────────────────────────────────
// 3-stage challenge: Stage 1 memorise a 4×4 symbol grid (8s).
// Stage 2: reconstruct the row order from shuffled rows.
// Stage 3: recall 3 specific positions.

const MemoryVaultGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);
    const gridSize = difficulty === 'EXTREME' ? 5 : 4;
    const revealSec = difficulty === 'HARD' || difficulty === 'EXTREME' ? 10 : 15;
    const symPool = r.sample(SYMBOLS, Math.min(SYMBOLS.length, 6));

    // Build grid
    const grid: string[][] = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => r.pick(symPool))
    );

    // Stage 2: row arrangement — shuffle rows, player must put them back
    const rowOrder = Array.from({ length: gridSize }, (_, i) => i);
    const shuffledRows = r.shuffle([...rowOrder]);
    const rowAnswers = { correctOrder: rowOrder, shuffledOrder: shuffledRows };

    // Stage 3: position recall — 3 questions
    const positions: Array<[number, number]> = [];
    for (let i = 0; i < gridSize; i++) for (let j = 0; j < gridSize; j++) positions.push([i, j]);
    const questioned = r.sample(positions, 3);
    const positionAnswers: Record<string, string> = {};
    questioned.forEach(([row, col], i) => { positionAnswers[`p${i + 1}`] = grid[row][col]; });
    const positionQuestions = questioned.map(([row, col], i) => ({
      id: i + 1,
      label: `What was at Row ${row + 1}, Column ${col + 1}?`,
    }));

    return {
      seed,
      puzzleType: 'MEMORY_VAULT',
      totalStages: 3,
      maxScore: (config.maxScore as number) || 150,
      displayData: {
        grid,
        gridSize,
        revealSec,
        symPool,
        instructions: `Stage 1: Memorise the grid (${revealSec}s). Stage 2: Reconstruct the row order. Stage 3: Answer position questions.`,
        stage2: {
          shuffledRows: shuffledRows.map(ri => ({ rowIndex: ri, label: `Row ${ri + 1}` })),
          instructions: 'Drag the rows back into the correct original order.',
        },
        stage3: { questions: positionQuestions },
      },
      secretData: { grid, rowAnswers, positionAnswers, positionQuestions, gridSize },
    };
  },
};

// ─── DAY 4: THE CIPHER ROOM ───────────────────────────────────────────────────
// 4-stage escape room. Each stage unlocks information for the next.
// Fully randomised per player so sharing answers is useless.

const CipherRoomGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);

    // Stage 1: Caesar cipher — decode a word
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const shift = r.int(3, 13);
    const words = ['EAGLE', 'STORM', 'VAULT', 'GHOST', 'PRISM', 'COBRA', 'NEXUS'];
    const word = r.pick(words);
    const encoded = word.split('').map(c => alphabet[(alphabet.indexOf(c) + shift) % 26]).join('');

    // Stage 2: Math lock — solve 3 equations to find 3 digits
    const digits = [r.int(2, 9), r.int(2, 9), r.int(2, 9)];
    const equations = [
      { text: `x + ${digits[0] + 5} = ${digits[0] * 2 + 5}`, answer: digits[0] },
      { text: `${digits[1] * 3} ÷ y = 3`, answer: digits[1] },
      { text: `z² = ${digits[2] * digits[2]}`, answer: digits[2] },
    ];
    const lock2Code = digits.join('');

    // Stage 3: Symbol cipher — map symbols to letters using a key
    const symLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const syms = r.sample(['★', '◆', '▲', '●', '■', '✦'], 6);
    const symMap: Record<string, string> = {};
    syms.forEach((s, i) => { symMap[s] = symLetters[i]; });
    const secretWord = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, 3).join('');
    const encodedSymbols = secretWord.split('').map(l => syms[symLetters.indexOf(l)]);

    // Stage 4: Final combination — use words from stages 1+3 and code from stage 2
    const finalCode = `${word[0]}${digits[0]}${digits[1]}${digits[2]}`;

    return {
      seed,
      puzzleType: 'CIPHER_ROOM',
      totalStages: 4,
      maxScore: (config.maxScore as number) || 200,
      displayData: {
        totalStages: 4,
        stages: [
          {
            stage: 1, title: 'LOCK 1 — Caesar Cipher',
            instructions: `Decrypt this message using a Caesar cipher. The shift value is hidden — you must figure it out. Encoded: ${encoded}`,
            encoded, hint: 'Try different shift values. Each letter shifts by the same amount.',
          },
          {
            stage: 2, title: 'LOCK 2 — The Equation Safe',
            instructions: 'Solve the equations to find each digit, then enter the 3-digit combination.',
            equations: equations.map(e => e.text),
            codeLength: 3,
          },
          {
            stage: 3, title: 'LOCK 3 — Symbol Decoder',
            instructions: `Use the symbol key to decode the hidden message. Enter the 3-letter word.`,
            symbolKey: Object.entries(symMap).map(([sym, letter]) => ({ sym, letter })),
            encodedMessage: encodedSymbols,
          },
          {
            stage: 4, title: 'LOCK 4 — The Final Vault',
            instructions: `Combine your answers: [First letter of Lock 1 word] + [Lock 2 code] = your 4-character final key.`,
          },
        ],
        instructions: 'This is a 4-lock cipher room. Crack each lock in sequence.',
      },
      secretData: {
        stages: {
          1: { answer: word, encoded, shift },
          2: { answer: lock2Code, equations },
          3: { answer: secretWord },
          4: { answer: finalCode },
        },
      },
    };
  },
};

// ─── DAY 5: THE RULE TRAP ─────────────────────────────────────────────────────
// Players see a grid of switches. There is a hidden rule governing which
// combination unlocks the vault. Wrong guesses cost attempts.

const RuleTrapGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);
    const numSwitches = difficulty === 'EASY' ? 4 : difficulty === 'MEDIUM' ? 5 : 6;

    // Generate the hidden rule: a specific combination of ON/OFF states
    const correctState = Array.from({ length: numSwitches }, () => r.int(0, 1) === 1);
    const correctKey = correctState.map(b => b ? '1' : '0').join('');

    // Generate clues that reveal partial information about the rule
    const onCount = correctState.filter(Boolean).length;
    const offCount = numSwitches - onCount;
    const clues = [
      `Exactly ${onCount} switch${onCount !== 1 ? 'es' : ''} must be ON.`,
      `Switch ${correctState.findIndex(b => b) + 1} must be ON.`,
      `The last switch must be ${correctState[numSwitches - 1] ? 'ON' : 'OFF'}.`,
    ];

    const switchLabels = Array.from({ length: numSwitches }, (_, i) =>
      `SW-${String(i + 1).padStart(2, '0')}`
    );

    return {
      seed,
      puzzleType: 'RULE_TRAP',
      totalStages: 1,
      maxScore: (config.maxScore as number) || 100,
      displayData: {
        numSwitches,
        switchLabels,
        clues: r.shuffle(clues),
        instructions: `Set the switches to discover the correct combination. You have limited attempts. Wrong answers may cost you points. Use the clues wisely.`,
        maxAttempts: difficulty === 'EASY' ? 5 : difficulty === 'MEDIUM' ? 4 : 3,
      },
      secretData: { correctState, correctKey, onCount, offCount },
    };
  },
};

// ─── DAY 6: THE BLACK VAULT ───────────────────────────────────────────────────
// 5-stage extreme challenge. Each stage produces a key used in the next.

const BlackVaultGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);

    // Stage 1: Observation — memorise 6 symbols in order (5 seconds)
    const obsSymbols = r.sample(SYMBOLS, 6);
    const obsOrder = [...obsSymbols];

    // Stage 2: Pattern — find next in a complex mixed sequence
    const pStart = r.int(1, 8), pStep = r.int(2, 5);
    const pSeq = Array.from({ length: 6 }, (_, i) => pStart + i * pStep);
    const pAnswer = pStart + 6 * pStep;

    // Stage 3: Logic — 3-agent deduction
    const agents = r.shuffle(['ALPHA', 'BETA', 'GAMMA']);
    const values = r.shuffle([r.int(10, 30), r.int(31, 60), r.int(61, 99)]);
    const agentMap: Record<string, number> = {};
    agents.forEach((a, i) => { agentMap[a] = values[i]; });
    const logicClues = [
      `${agents[0]}'s value is ${agentMap[agents[0]]}.`,
      `${agents[1]}'s value is greater than ${Math.floor(agentMap[agents[1]] / 2)}.`,
      `Sum of all three values is ${values.reduce((a, b) => a + b, 0)}.`,
    ];

    // Stage 4: Code — combine keys from stages 1,2,3
    const codeDigit1 = obsSymbols.indexOf(obsOrder[0]) + 1;
    const codeDigit2 = pAnswer % 10;
    const codeDigit3 = agentMap[agents[0]] % 10;
    const stage4Code = `${codeDigit1}${codeDigit2}${codeDigit3}`;

    // Stage 5: Final — apply all keys to unlock
    const finalKey = `${obsOrder[0]}${pAnswer}${stage4Code}`;

    return {
      seed,
      puzzleType: 'BLACK_VAULT',
      totalStages: 5,
      maxScore: (config.maxScore as number) || 250,
      displayData: {
        totalStages: 5,
        stages: [
          {
            stage: 1, title: 'Stage 1 — Observation', type: 'MEMORY',
            symbols: obsSymbols, revealSec: 5,
            instructions: 'Memorise the 6 symbols in exact order. You have 5 seconds.'
          },
          {
            stage: 2, title: 'Stage 2 — Pattern', type: 'SEQUENCE',
            items: [...pSeq, '?'],
            instructions: 'Find the next number in this sequence.'
          },
          {
            stage: 3, title: 'Stage 3 — Logic', type: 'LOGIC',
            agents, clues: logicClues,
            instructions: `What is ${agents[2]}'s value? Use the clues.`
          },
          {
            stage: 4, title: 'Stage 4 — The Code', type: 'CODE',
            instructions: `Build the 3-digit code: [Position of Stage1 first symbol (1-indexed)][Stage2 answer mod 10][${agents[0]}'s value mod 10].`,
            codeLength: 3
          },
          {
            stage: 5, title: 'Stage 5 — Final Unlock', type: 'FINAL',
            instructions: `Enter the master key: [Stage1 first symbol][Stage2 answer][Stage4 code].`
          },
        ],
        instructions: 'THE BLACK VAULT — 5 connected stages. Each answer feeds the next stage.',
      },
      secretData: {
        stages: {
          1: { answer: obsOrder.join(','), order: obsOrder },
          2: { answer: String(pAnswer) },
          3: { answer: String(agentMap[agents[2]]), agentMap },
          4: { answer: stage4Code },
          5: { answer: finalKey },
        },
      },
    };
  },
};

// ─── DAY 7: THE FINAL VAULT ───────────────────────────────────────────────────
// Championship challenge for EXACTLY 2 finalists.
// 5 stages of increasing complexity. Individualized per player.
// Winner determined by server: completion → score → time.

const FinalVaultGenerator: PuzzleGenerator = {
  generate(config, seed, difficulty) {
    const r = rng(seed);

    // Stage 1: Complex sequence (longer, harder)
    const s1Start = r.int(1, 5), s1Step = r.int(7, 15);
    const s1Seq = Array.from({ length: 8 }, (_, i) => s1Start + i * s1Step);
    const s1Answer = s1Start + 8 * s1Step;

    // Stage 2: Symbol transformation (discover the rule + apply to 4 cases)
    const shapeSet = r.sample(['◆', '●', '■', '▲', '✦', '⬡', '★', '⬟'], 6);
    const ruleShift = r.int(2, 4);
    const exIdx = r.sample([0, 1, 2, 3, 4, 5], 3);
    const examples = exIdx.map(i => ({ input: shapeSet[i], output: shapeSet[(i + ruleShift) % 6] }));
    const testIdx = [0, 1, 2, 3, 4, 5].filter(i => !exIdx.includes(i)).slice(0, 2);
    const s2Answers: Record<string, string> = {};
    testIdx.forEach((i, k) => { s2Answers[`t${k + 1}`] = shapeSet[(i + ruleShift) % 6]; });
    const s2Tests = testIdx.map((i, k) => ({ id: k + 1, input: shapeSet[i] }));

    // Stage 3: Logic deduction (4 agents)
    const agents4 = r.shuffle(['ALPHA', 'BETA', 'GAMMA', 'DELTA']);
    const ranks = r.shuffle([1, 2, 3, 4]);
    const rankMap: Record<string, number> = {};
    agents4.forEach((a, i) => { rankMap[a] = ranks[i]; });
    const clues3 = [
      `${agents4[0]}'s rank is ${rankMap[agents4[0]]}.`,
      `${agents4[1]}'s rank is NOT 1.`,
      `${agents4[2]}'s rank is higher than ${agents4[3]}'s.`,
      `The sum of all ranks is ${ranks.reduce((a, b) => a + b, 0)}.`,
    ];

    // Stage 4: Multi-cipher code
    const c4Digits = [r.int(2, 9), r.int(2, 9), r.int(2, 9), r.int(2, 9)];
    const c4Code = c4Digits.join('');
    const c4Clues = [
      `Digit 1: ${c4Digits[0] + 7} − 7`,
      `Digit 2: √${c4Digits[1] * c4Digits[1]}`,
      `Digit 3: ${c4Digits[2] * 4} ÷ 4`,
      `Digit 4: The number of vowels in "${['ALPHA', 'ECHO', 'INDIA', 'OSCAR', 'ULTRA'][r.int(0, 4)]}"`,
    ];
    // Recalculate digit 4 from the word
    const vowelWord = ['ALPHA', 'ECHO', 'INDIA', 'OSCAR', 'ULTRA'][r.int(0, 4)];
    const vowelCount = vowelWord.split('').filter(c => 'AEIOU'.includes(c)).length;
    c4Digits[3] = vowelCount;
    const c4CodeFinal = c4Digits.join('');

    // Stage 5: Master unlock
    const masterKey = `${s1Answer % 100}${c4CodeFinal}`;

    return {
      seed,
      puzzleType: 'FINAL_VAULT',
      totalStages: 5,
      maxScore: (config.maxScore as number) || 500,
      displayData: {
        totalStages: 5,
        isFinal: true,
        stages: [
          {
            stage: 1, title: 'Stage 1 — The Sequence Key', type: 'SEQUENCE',
            items: [...s1Seq, '?'], instructions: 'Find the next number in this sequence. This is your Primary Key.'
          },
          {
            stage: 2, title: 'Stage 2 — Symbol Transformation', type: 'PATTERN',
            examples, tests: s2Tests, shapeSet,
            instructions: 'Discover the transformation rule. Apply it to the test symbols.'
          },
          {
            stage: 3, title: 'Stage 3 — Agent Deduction', type: 'LOGIC',
            agents: agents4, clues: r.shuffle(clues3),
            instructions: `Determine every agent's rank (1–4). No two agents share a rank.`
          },
          {
            stage: 4, title: 'Stage 4 — The Cipher Lock', type: 'CODE',
            clues: c4Clues, codeLength: 4,
            instructions: 'Solve each clue to find a digit. Enter the 4-digit cipher code.'
          },
          {
            stage: 5, title: 'Stage 5 — THE FINAL UNLOCK', type: 'FINAL',
            instructions: `Enter the master key: [Stage1 answer, last 2 digits][Stage4 code]. No second chances.`
          },
        ],
        instructions: '⚔ THE FINAL VAULT — This is the championship challenge. 5 stages. One winner. Good luck.',
      },
      secretData: {
        stages: {
          1: { answer: String(s1Answer) },
          2: { answers: s2Answers },
          3: { rankMap },
          4: { answer: c4CodeFinal },
          5: { answer: masterKey },
        },
      },
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// GENERATOR REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

const GENERATORS: Record<string, PuzzleGenerator> = {
  // Phase 2 types (unchanged)
  SEQUENCE: SequenceGenerator,
  CODE_BREAK: CodeBreakGenerator,
  MEMORY: MemoryGenerator,
  PATTERN: PatternGenerator,
  ARRANGEMENT: ArrangementGenerator,
  HIDDEN_OBJECT: HiddenObjectGenerator,
  LOGIC: LogicGenerator,
  MULTI_STAGE: MultiStageGenerator,
  // Phase 3 daily types — upgraded
  BROKEN_MACHINE: BrokenMachineGen,
  PATTERN_VAULT: PatternVaultGen,
  MEMORY_VAULT: MemoryVaultGen,
  CIPHER_ROOM: CipherRoomGen,
  RULE_TRAP: RuleTrapGen,
  BLACK_VAULT: BlackVaultGen,
  FINAL_VAULT: FinalVaultGen,
};

export function generatePuzzle(
  puzzleType: string,
  config: Record<string, unknown>,
  seed: string,
  difficulty: string
): ReturnType<PuzzleGenerator['generate']> {
  const generator = GENERATORS[puzzleType] ?? CodeBreakGenerator;
  return generator.generate(config, seed, difficulty as Difficulty);
}

export { GENERATORS };
