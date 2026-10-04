/**
 * dailyPuzzleGenerators.ts
 * ─────────────────────────
 * All 7 daily puzzle generators.
 *
 * TIMING RULES (strictly enforced):
 *   Day 1:  8–12 min  (HARD)
 *   Day 2: 10–15 min  (VERY HARD)
 *   Day 3: 10–15 min  (VERY HARD)
 *   Day 4: 12–17 min  (EXTREME)
 *   Day 5: 15–18 min  (EXTREME)
 *   Day 6: 15–20 min  (BRUTAL)
 *   Day 7: 18–20 min  (FINAL BOSS)
 *   MAX = 20 minutes = 1200 seconds. NO exceptions.
 *
 * SECURITY:
 *   displayData → safe to send to browser (NO answers)
 *   secretData  → stored DB-side only, used by validators
 */

import { SeededRandom } from './seededRandom';
import { PuzzleGenerator } from './puzzleTypes';

function rng(seed: string): SeededRandom { return new SeededRandom(seed); }

// ════════════════════════════════════════════════════════════════════════════
// DAY 1 — THE BROKEN MACHINE
// Timer: 660s (11 min). Difficulty: HARD.
//
// 5×5 node-rotation circuit puzzle. Player rotates nodes to align a signal
// path SOURCE → SINK. Decoy nodes, dead-ends, and misleading routes included.
// KEY_A = hash of correct rotation state (server-computed after validation).
// ════════════════════════════════════════════════════════════════════════════

export const BrokenMachineGenerator: PuzzleGenerator = {
  generate(config, seed, _difficulty) {
    const r = rng(seed);
    const SIZE = 5;

    type NodeType =
      | 'STRAIGHT_H' | 'STRAIGHT_V'
      | 'BEND_NE' | 'BEND_SE' | 'BEND_SW' | 'BEND_NW'
      | 'TEE_N' | 'TEE_E' | 'TEE_S' | 'TEE_W'
      | 'CROSS' | 'DEAD';

    // Bitmasks: N=1 E=2 S=4 W=8
    const NODE_CONNECTIONS: Record<NodeType, number> = {
      STRAIGHT_H: 2 | 8, STRAIGHT_V: 1 | 4,
      BEND_NE: 1 | 2, BEND_SE: 2 | 4,
      BEND_SW: 4 | 8, BEND_NW: 8 | 1,
      TEE_N: 1 | 2 | 8, TEE_E: 1 | 2 | 4,
      TEE_S: 2 | 4 | 8, TEE_W: 1 | 4 | 8,
      CROSS: 15, DEAD: 0,
    };

    const rotateCW = (b: number): number =>
      ((b & 8) ? 1 : 0) | ((b & 1) ? 2 : 0) | ((b & 2) ? 4 : 0) | ((b & 4) ? 8 : 0);

    const rotateN = (b: number, n: number): number => {
      let x = b;
      for (let i = 0; i < (n % 4); i++) x = rotateCW(x);
      return x;
    };

    // Generate a winding path (not the shortest route)
    type Cell = [number, number];
    const path: Cell[] = [[0, 0]];
    const visited = new Set<string>(['0,0']);
    let curr: Cell = [0, 0];

    while (!(curr[0] === SIZE - 1 && curr[1] === SIZE - 1)) {
      const [r1, c1] = curr;
      const dirs: Cell[] = [];
      // Bias toward goal but allow backtracking for difficulty
      if (r1 < SIZE - 1) dirs.push([r1 + 1, c1]);
      if (c1 < SIZE - 1) dirs.push([r1, c1 + 1]);
      if (r1 > 0 && r.next() < 0.25) dirs.push([r1 - 1, c1]);
      if (c1 > 0 && r.next() < 0.25) dirs.push([r1, c1 - 1]);
      const valid = dirs.filter(([nr, nc]) => !visited.has(`${nr},${nc}`));
      if (valid.length === 0) break;
      const next = r.pick(valid);
      visited.add(`${next[0]},${next[1]}`);
      path.push(next);
      curr = next;
    }

    // Build required connection bitmasks for path cells
    const reqConn: number[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    for (let i = 0; i < path.length - 1; i++) {
      const [r1, c1] = path[i];
      const [r2, c2] = path[i + 1];
      if (r2 === r1 + 1) { reqConn[r1][c1] |= 4; reqConn[r2][c2] |= 1; }
      else if (r2 === r1 - 1) { reqConn[r1][c1] |= 1; reqConn[r2][c2] |= 4; }
      else if (c2 === c1 + 1) { reqConn[r1][c1] |= 2; reqConn[r2][c2] |= 8; }
      else if (c2 === c1 - 1) { reqConn[r1][c1] |= 8; reqConn[r2][c2] |= 2; }
    }

    const correctRots: number[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    const nodeTypes: string[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill('DEAD'));
    const initRots: number[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    const NODE_TYPES = Object.keys(NODE_CONNECTIONS) as NodeType[];

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const req = reqConn[row][col];
        if (req === 0) {
          // Plausible decoy — nearby connectivity types look tempting
          const decoyType = r.pick([
            'STRAIGHT_H', 'STRAIGHT_V', 'BEND_NE', 'BEND_SE', 'BEND_SW', 'BEND_NW', 'TEE_S', 'TEE_E',
          ] as NodeType[]);
          nodeTypes[row][col] = decoyType;
          initRots[row][col] = r.int(0, 3);
        } else {
          const candidates: Array<{ type: NodeType; rot: number }> = [];
          for (const nt of NODE_TYPES) {
            for (let rot = 0; rot < 4; rot++) {
              if (rotateN(NODE_CONNECTIONS[nt], rot) === req) candidates.push({ type: nt, rot });
            }
          }
          if (candidates.length > 0) {
            const chosen = r.pick(candidates);
            nodeTypes[row][col] = chosen.type;
            correctRots[row][col] = chosen.rot;
            // Ensure initial rotation is WRONG (never already solved)
            initRots[row][col] = (chosen.rot + r.int(1, 3)) % 4;
          }
        }
      }
    }

    const NODE_SYMBOLS: Record<string, string[]> = {
      STRAIGHT_H: ['─', '│', '─', '│'], STRAIGHT_V: ['│', '─', '│', '─'],
      BEND_NE: ['└', '┌', '┐', '┘'], BEND_SE: ['┌', '┐', '┘', '└'],
      BEND_SW: ['┐', '┘', '└', '┌'], BEND_NW: ['┘', '└', '┌', '┐'],
      TEE_N: ['┴', '├', '┬', '┤'], TEE_E: ['├', '┬', '┤', '┴'],
      TEE_S: ['┬', '┤', '┴', '├'], TEE_W: ['┤', '┴', '├', '┬'],
      CROSS: ['┼', '┼', '┼', '┼'], DEAD: ['·', '·', '·', '·'],
    };

    const displayNodes = Array.from({ length: SIZE }, (_, row) =>
      Array.from({ length: SIZE }, (_, col) => ({
        row, col,
        type: nodeTypes[row][col],
        rotation: initRots[row][col],
        symbol: NODE_SYMBOLS[nodeTypes[row][col]]?.[initRots[row][col]] ?? '·',
        isPath: reqConn[row][col] !== 0,
        isSource: row === 0 && col === 0,
        isSink: row === SIZE - 1 && col === SIZE - 1,
      }))
    );

    return {
      seed,
      puzzleType: 'BROKEN_MACHINE',
      totalStages: 1,
      maxScore: (config.maxScore as number) || 100,
      displayData: {
        size: SIZE,
        nodes: displayNodes,
        nodeSymbols: NODE_SYMBOLS,
        instructions: 'Rotate the circuit nodes so energy flows from SOURCE ⚡ (top-left) to SINK 🎯 (bottom-right). Click any node to rotate 90° clockwise. Decoy nodes are present — not every node needs rotating.',
        timerSeconds: 660,
        pathLength: path.length,
        totalNodes: SIZE * SIZE,
        keyNote: 'KEY A is produced when the server validates a correct circuit.',
      },
      secretData: { correctRots, reqConn, path, nodeTypes, size: SIZE },
    };
  },
};

// ════════════════════════════════════════════════════════════════════════════
// DAY 2 — THE PATTERN VAULT
// Timer: 780s (13 min). Difficulty: VERY HARD.
//
// FOUR simultaneous cyclic rules govern a 2×2 panel across 6 states.
// Rule A: symbol cycles through pool
// Rule B: fill count cycles 1→2→3→1
// Rule C: fill position cycles through 4 quadrants
// Rule D: a secondary symbol "bleeds" into one extra cell every 2 steps
//
// Player sees States 1–4 and must construct States 5 AND 6 (harder).
// Two answers required increases reasoning demand significantly.
// ════════════════════════════════════════════════════════════════════════════

export const PatternVaultGenerator: PuzzleGenerator = {
  generate(config, seed, _difficulty) {
    const r = rng(seed);

    const SYMBOL_POOLS = [
      ['◆', '●', '■', '▲'],
      ['★', '✦', '⬡', '⬟'],
      ['Ω', 'Σ', 'Δ', 'Λ'],
    ];
    const symbols = r.pick(SYMBOL_POOLS);
    const bleedSym = r.pick(symbols.filter((_, i) => i !== 0));

    // Four cyclic rules
    const symStart = r.int(0, symbols.length - 1);
    const countStart = r.int(1, 3);  // 1,2,3 cycle
    const posStart = r.int(0, 3);  // 0,1,2,3 quadrant cycle
    const bleedStep = r.int(1, 3);  // adds bleed symbol every bleedStep steps

    const POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const ALLCELLS = [[0, 0], [0, 1], [1, 0], [1, 1]] as [number, number][];

    const buildGrid = (step: number) => {
      const sym = symbols[(symStart + step) % symbols.length];
      const count = ((countStart + step - 1) % 3) + 1;
      const pos = POSITIONS[(posStart + step) % 4];
      const grid: (string | null)[][] = [[null, null], [null, null]];
      const startIdx = ALLCELLS.findIndex(c =>
        pos === 'top-left' ? (c[0] === 0 && c[1] === 0) :
          pos === 'top-right' ? (c[0] === 0 && c[1] === 1) :
            pos === 'bottom-left' ? (c[0] === 1 && c[1] === 0) :
              (c[0] === 1 && c[1] === 1)
      );
      for (let i = 0; i < Math.min(count, 4); i++) {
        const [rr, cc] = ALLCELLS[(startIdx + i) % 4];
        grid[rr][cc] = sym;
      }
      // Rule D: bleed — one extra cell gets bleedSym every bleedStep states
      if ((step + 1) % bleedStep === 0) {
        const bleedPos = ALLCELLS[(posStart + step + 2) % 4];
        if (grid[bleedPos[0]][bleedPos[1]] === null) {
          grid[bleedPos[0]][bleedPos[1]] = bleedSym;
        }
      }
      return { grid, sym, count, pos, step: step + 1 };
    };

    const allStates = Array.from({ length: 6 }, (_, i) => buildGrid(i));

    return {
      seed,
      puzzleType: 'PATTERN_VAULT',
      totalStages: 1,
      maxScore: (config.maxScore as number) || 100,
      displayData: {
        symbols,
        examples: allStates.slice(0, 4).map(s => ({
          step: s.step, grid: s.grid,
          symbol: s.sym, count: s.count, position: s.pos,
        })),
        // Player must submit State 5 AND State 6
        targets: [5, 6],
        instructions: 'FOUR rules operate simultaneously on this panel. Study States 1–4 carefully. Reconstruct both State 5 AND State 6 by clicking cells. You must get both correct.',
        timerSeconds: 780,
        symbolPool: symbols,
        gridSize: 2,
      },
      secretData: {
        state5Grid: allStates[4].grid,
        state6Grid: allStates[5].grid,
        state5Flat: allStates[4].grid.flat().map(c => c ?? ''),
        state6Flat: allStates[5].grid.flat().map(c => c ?? ''),
        rules: { symStart, countStart, posStart, bleedStep, bleedSym },
      },
    };
  },
};

// ════════════════════════════════════════════════════════════════════════════
// DAY 3 — THE MEMORY VAULT
// Timer: 720s (12 min). Difficulty: VERY HARD.
//
// 9 positioned objects with colors. Shown for 15s then hidden.
// 3 stages requiring memory AND spatial reasoning:
//   Stage 1: 4 position→symbol questions
//   Stage 2: 3 relational questions (adjacent, diagonal)
//   Stage 3: identify which object changed color (shown altered room)
// Short reveal time + relational questions = cannot brute-force.
// ════════════════════════════════════════════════════════════════════════════

export const MemoryVaultGenerator: PuzzleGenerator = {
  generate(config, seed, _difficulty) {
    const r = rng(seed);

    const OBJECTS = ['🗝', '🔮', '📦', '⚗', '🕯', '🗡', '🧿', '📜', '💎'];
    const COLORS = ['red', 'blue', 'gold', 'purple', 'teal'];
    const POSITIONS = ['TOP-LEFT', 'TOP-CENTER', 'TOP-RIGHT', 'MID-LEFT', 'CENTER', 'MID-RIGHT', 'BOT-LEFT', 'BOT-CENTER', 'BOT-RIGHT'];

    // 15 seconds — tight but achievable with focus
    const REVEAL_SEC = 15;

    const selectedObjs = r.shuffle(OBJECTS).slice(0, 9);
    const selectedColors = r.shuffle(COLORS);

    const roomObjects = POSITIONS.map((pos, i) => ({
      id: i,
      symbol: selectedObjs[i],
      color: selectedColors[i % selectedColors.length],
      position: pos,
      posLabel: pos.replace(/-/g, ' ').toLowerCase(),
    }));

    // Stage 1: 4 position recall questions
    const s1Qs = r.sample(roomObjects, 4).map((obj, i) => ({
      id: i + 1,
      question: `What was at ${obj.posLabel}?`,
      position: obj.position,
    }));
    const s1Ans: Record<string, string> = {};
    s1Qs.forEach(q => { s1Ans[`s1_${q.id}`] = roomObjects.find(o => o.position === q.position)!.symbol; });

    // Stage 2: relational questions
    const posIdx: Record<string, number> = {};
    POSITIONS.forEach((p, i) => { posIdx[p] = i; });

    const relPairs: Array<{ anchor: typeof roomObjects[0]; rel: string; answer: typeof roomObjects[0] }> = [];
    const adjacencies = [
      { rel: 'right of', offset: 1 },
      { rel: 'below', offset: 3 },
      { rel: 'diagonally below-right of', offset: 4 },
    ];
    for (const obj of roomObjects) {
      const idx = posIdx[obj.position] ?? -1;
      for (const { rel, offset } of adjacencies) {
        const tgt = roomObjects.find(o => posIdx[o.position] === idx + offset);
        if (tgt) relPairs.push({ anchor: obj, rel, answer: tgt });
      }
    }
    const s2Qs = r.sample(relPairs, Math.min(3, relPairs.length)).map((p, i) => ({
      id: i + 1,
      question: `What was to the ${p.rel} ${p.anchor.symbol}?`,
      answerSymbol: p.answer.symbol,
    }));
    const s2Ans: Record<string, string> = {};
    s2Qs.forEach(q => { s2Ans[`s2_${q.id}`] = q.answerSymbol; });

    // Stage 3: one changed color
    const changedObj = r.pick(roomObjects);
    const newColor = r.pick(COLORS.filter(c => c !== changedObj.color));

    return {
      seed,
      puzzleType: 'MEMORY_VAULT',
      totalStages: 3,
      maxScore: (config.maxScore as number) || 150,
      displayData: {
        roomObjects,
        revealSec: REVEAL_SEC,
        timerSeconds: 720,
        instructions: `You have ${REVEAL_SEC} seconds to study the room. Then it disappears. Answer ALL questions from memory — you cannot re-view the room.`,
        stage1: {
          instructions: 'What object was at each position?',
          questions: s1Qs,
          symbolPool: selectedObjs,
        },
        stage2: {
          instructions: 'Answer spatial relationship questions.',
          questions: s2Qs.map(q => ({ id: q.id, question: q.question })),
          symbolPool: selectedObjs,
        },
        stage3: {
          instructions: 'One object CHANGED COLOR. The altered room is shown. Which object changed?',
          alteredRoom: roomObjects.map(o => o.id === changedObj.id ? { ...o, color: newColor } : o),
          symbolPool: selectedObjs,
        },
      },
      secretData: { roomObjects, s1Answers: s1Ans, s2Answers: s2Ans, s3Answer: changedObj.symbol, changedObjId: changedObj.id },
    };
  },
};

// ════════════════════════════════════════════════════════════════════════════
// DAY 4 — THE CIPHER ROOM
// Timer: 900s (15 min). Difficulty: EXTREME.
//
// 4 tightly chained locks. Each lock's answer feeds into the next.
// Lock 1 → dial code → its SUM becomes the cipher shift for Lock 2
// Lock 2 → decoded word → first letter used in Lock 3 logic
// Lock 3 → logic grid → winning agent's floor number used in Lock 4
// Lock 4 → final code = sum of derived values from all 3 locks
//
// Chain dependency: wrong Lock 1 → wrong cipher shift → wrong word → wrong final code.
// ════════════════════════════════════════════════════════════════════════════

export const CipherRoomGenerator: PuzzleGenerator = {
  generate(config, seed, _difficulty) {
    const r = rng(seed);

    // ── Lock 1: 4-dial safe ───────────────────────────────────────────────
    const dialValues = Array.from({ length: 4 }, () => r.int(1, 9));
    const dialSum = dialValues.reduce((a, b) => a + b, 0);
    // Clues require reasoning — not trivially readable
    const dClues = [
      `The sum of all 4 dials is ${dialSum}.`,
      `Dial 2 × Dial 3 = ${dialValues[1] * dialValues[2]}.`,
      `Dial 4 = Dial 1 + ${dialValues[3] - dialValues[0]}.`,
      `Dial 1 is ${dialValues[0] % 2 === 0 ? 'even' : 'odd'} and less than ${dialValues[0] + 3}.`,
    ];

    // ── Lock 2: cipher shift derived from Lock 1 dial SUM mod alphabet ───
    // Player must first correctly solve Lock 1 to get the shift
    const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const cShift = (dialSum % 10) + 2; // 2–11, derived from Lock 1
    const WORDS = ['NEXUS', 'PRISM', 'VAULT', 'SIGMA', 'OMEGA'];
    const plainWord = r.pick(WORDS);
    const coded = plainWord.split('').map(c => {
      const i = ALPHA.indexOf(c);
      return i === -1 ? c : ALPHA[(i + cShift) % 26];
    }).join('');
    // Partial key shows only 2 mappings — player must work out the shift
    const sample2 = r.sample(plainWord.split(''), 2);
    const partialKey = sample2.map(l => ({
      plain: l,
      encoded: ALPHA[(ALPHA.indexOf(l) + cShift) % 26],
    }));

    // ── Lock 3: logic grid — agent × role × floor ─────────────────────────
    const agents = r.shuffle(['VIPER', 'HAWK', 'RAVEN']);
    const roles = r.shuffle(['Analyst', 'Infiltrator', 'Handler']);
    const floors = r.shuffle([1, 2, 3]);
    const lMap: Record<string, { role: string; floor: number }> = {};
    agents.forEach((a, i) => { lMap[a] = { role: roles[i], floor: floors[i] }; });
    // Clues — one direct, one elimination, one deduction
    const lClues = [
      `${agents[0]}'s floor is ${lMap[agents[0]].floor}.`,
      `The ${lMap[agents[1]].role} is NOT on floor ${lMap[agents[1]].floor === 1 ? 2 : 1}.`,
      `${agents[2]} is NOT the ${roles[(roles.indexOf(lMap[agents[2]].role) + 1) % 3]}.`,
      `Floor ${lMap[agents[0]].floor} does not belong to the ${roles[(roles.indexOf(lMap[agents[0]].role) + 1) % 3]}.`,
    ];

    // ── Lock 4: final code = derived from previous answers ────────────────
    // Code = [dial1][cipherShift mod 10][agent0 floor]
    // Player must have correctly solved all 3 prior locks
    const finalCode = `${dialValues[0]}${cShift % 10}${lMap[agents[0]].floor}`;

    return {
      seed,
      puzzleType: 'CIPHER_ROOM',
      totalStages: 4,
      maxScore: (config.maxScore as number) || 200,
      displayData: {
        totalStages: 4,
        timerSeconds: 900,
        instructions: 'A 4-lock cipher room. Each lock\'s answer feeds the next. Wrong earlier answers will corrupt later locks.',
        stages: [
          {
            stage: 1,
            title: 'LOCK 1 — THE DIAL SAFE',
            type: 'DIAL',
            instructions: 'Set the 4 dials correctly. The sum of your dial values determines the cipher shift for Lock 2.',
            dialCount: 4,
            clues: r.shuffle(dClues),
            keyNote: 'Your dial SUM feeds directly into Lock 2.',
          },
          {
            stage: 2,
            title: 'LOCK 2 — THE CIPHER WHEEL',
            type: 'CIPHER',
            instructions: `Decode the word using the cipher. HINT: your cipher shift = (Lock 1 dial sum) mod 10, plus 2.`,
            encodedWord: coded,
            partialKey,
            wordLength: plainWord.length,
            keyNote: 'The first letter of your decoded word is needed for Lock 4.',
          },
          {
            stage: 3,
            title: 'LOCK 3 — THE LOGIC GRID',
            type: 'LOGIC_GRID',
            instructions: `Assign each agent their role and floor. ${agents[0]}'s floor feeds into Lock 4.`,
            agents,
            roles,
            floors: [1, 2, 3],
            clues: r.shuffle(lClues),
            keyNote: `${agents[0]}'s floor is part of the final code.`,
          },
          {
            stage: 4,
            title: 'LOCK 4 — THE FINAL COMBINATION',
            type: 'FINAL',
            instructions: `Final code = [Lock 1 Dial 1 value][Lock 2 cipher shift mod 10][Lock 3 ${agents[0]}'s floor]. Enter 3 digits.`,
            hint: `Combine: (first dial value) + (dial sum mod 10 + 2, then mod 10) + (${agents[0]}'s floor number)`,
            codeLength: 3,
          },
        ],
      },
      secretData: {
        stages: {
          1: { answer: dialValues.join(''), dialValues },
          2: { answer: plainWord, encodedWord: coded, cipherShift: cShift },
          3: { answer: JSON.stringify(lMap), logicMap: lMap },
          4: { answer: finalCode },
        },
      },
    };
  },
};

// ════════════════════════════════════════════════════════════════════════════
// DAY 5 — THE RULE TRAP
// Timer: 960s (16 min). Difficulty: EXTREME.
//
// 8 objects in a 2×4 grid. Each has shape, color, size, row, col.
// A compound rule determines which objects are ACTIVE.
// Compound rules (2 attributes must BOTH be true), making deduction harder.
// 7 probes maximum. Each probe shows: NONE / PARTIAL / CLOSE / CORRECT.
// Player must make meaningful strategic probes, not random ones.
// ════════════════════════════════════════════════════════════════════════════

export const RuleTrapGenerator: PuzzleGenerator = {
  generate(config, seed, _difficulty) {
    const r = rng(seed);

    const SHAPES = ['◆', '▲', '●', '■', '⬡', '★', '⬟', '✦'];
    const COLORS = ['red', 'blue', 'gold', 'purple', 'teal', 'orange'];
    const SIZES = ['small', 'medium', 'large'];

    const rows = 2, cols = 4, n = rows * cols;

    const objects = Array.from({ length: n }, (_, i) => ({
      id: i,
      shape: SHAPES[i % SHAPES.length],
      color: COLORS[i % COLORS.length],
      size: r.pick(SIZES),
      row: Math.floor(i / cols),
      col: i % cols,
    }));

    // Compound rules — TWO attributes must be true simultaneously
    type RuleType = 'COLOR+SIZE' | 'SHAPE+ROW' | 'COLOR+COL' | 'SIZE+COL' | 'SHAPE+SIZE';
    const ruleType = r.pick<RuleType>(['COLOR+SIZE', 'SHAPE+ROW', 'COLOR+COL', 'SIZE+COL', 'SHAPE+SIZE']);

    const paramA = r.pick(ruleType.startsWith('COLOR') ? COLORS : ruleType.startsWith('SHAPE') ? SHAPES : SIZES);
    const paramB = ruleType === 'SHAPE+ROW' ? r.int(0, rows - 1) :
      ruleType === 'COLOR+COL' ? r.int(0, cols - 1) :
        ruleType === 'SIZE+COL' ? r.int(0, cols - 1) :
          ruleType === 'COLOR+SIZE' ? r.pick(SIZES) :
            r.pick(SIZES); // SHAPE+SIZE

    const isActive = (obj: typeof objects[0]): boolean => {
      switch (ruleType) {
        case 'COLOR+SIZE': return obj.color === paramA && obj.size === (paramB as string);
        case 'SHAPE+ROW': return obj.shape === paramA && obj.row === (paramB as number);
        case 'COLOR+COL': return obj.color === paramA && obj.col === (paramB as number);
        case 'SIZE+COL': return obj.size === paramA && obj.col === (paramB as number);
        case 'SHAPE+SIZE': return obj.shape === paramA && obj.size === (paramB as string);
        default: return false;
      }
    };

    const activeIds = new Set(objects.filter(isActive).map(o => o.id));
    const MAX_PROBES = 7;

    return {
      seed,
      puzzleType: 'RULE_TRAP',
      totalStages: 1,
      maxScore: (config.maxScore as number) || 100,
      displayData: {
        objects, rows, cols,
        maxProbes: MAX_PROBES,
        timerSeconds: 960,
        instructions: `A COMPOUND HIDDEN RULE governs which objects are ACTIVE (two attributes must both match). You have ${MAX_PROBES} probes. Use them strategically. Probe feedback: NONE / PARTIAL / CLOSE / CORRECT.`,
        probeInstructions: 'Select objects and click PROBE. The feedback reveals how close your selection is to the active set — but never reveals the rule directly.',
        finalInstructions: 'Once you understand the rule, select all active objects and submit your final answer.',
      },
      secretData: {
        activeIds: [...activeIds],
        rule: ruleType,
        paramA,
        paramB,
      },
    };
  },
};

// ════════════════════════════════════════════════════════════════════════════
// DAY 6 — THE BLACK VAULT
// Timer: 1080s (18 min). Difficulty: BRUTAL.
//
// 5 connected stages. Each derives a KEY that feeds later stages.
// The synthesis stage requires mathematical combination of all 4 keys.
// Each individual stage is genuinely difficult (not trivial).
//
// Stage 1: Geometric sequence (harder — large numbers, must find ratio)
// Stage 2: Dual-symbol transformation (TWO rules simultaneously)
// Stage 3: Spatial memory (8 nodes, 8s reveal, must recall target)
// Stage 4: 4-agent logic (more clues, harder deduction)
// Stage 5: Master code = transform all 4 keys using a given formula
// ════════════════════════════════════════════════════════════════════════════

export const BlackVaultGenerator: PuzzleGenerator = {
  generate(config, seed, _difficulty) {
    const r = rng(seed);

    // ── Stage 1: Hard geometric sequence ─────────────────────────────────
    const base = r.int(2, 6);
    const ratio = r.int(3, 5);
    const len = 6;
    const seq = Array.from({ length: len }, (_, i) => base * Math.pow(ratio, i));
    const next = base * Math.pow(ratio, len);
    const KEY_A = next % 97; // mod by prime for non-obvious key

    // ── Stage 2: Dual symbol transformation ──────────────────────────────
    const SYM = ['◆', '●', '■', '▲', '★', '⬡'];
    const shA = r.int(1, 2);  // first rule shift
    const shB = r.int(1, 2);  // second rule shift (different)
    // Examples: pairs where BOTH symbol AND its "partner" shift
    const exPairs = r.sample(SYM, 4);
    const exOut = exPairs.map(s => SYM[(SYM.indexOf(s) + shA) % SYM.length]);
    const ex2Out = exPairs.map(s => SYM[(SYM.indexOf(s) + shB + shA) % SYM.length]);
    // Test: player must apply BOTH shifts
    const testSym = r.pick(SYM.filter(s => !exPairs.includes(s)));
    const KEY_B_idx = (SYM.indexOf(testSym) + shA + shB) % SYM.length;
    const KEY_B = SYM[KEY_B_idx];

    // ── Stage 3: 8-node spatial memory (8s) ──────────────────────────────
    const CODES = ['RED', 'BLU', 'GLD', 'PRP', 'TEL', 'ORG', 'WHT', 'CYN'];
    const nodes8 = Array.from({ length: 8 }, (_, i) => ({
      id: i, code: r.pick(CODES), label: `Node ${i + 1}`,
    }));
    const targetNode = r.pick(nodes8);
    const KEY_C = CODES.indexOf(targetNode.code); // numeric index

    // ── Stage 4: 4-agent deduction ────────────────────────────────────────
    const AGENTS = r.shuffle(['ECHO', 'FOXTROT', 'KILO', 'LIMA']);
    const agScores = r.shuffle([r.int(55, 70), r.int(71, 82), r.int(83, 91), r.int(92, 99)]);
    const agMap: Record<string, number> = {};
    AGENTS.forEach((a, i) => { agMap[a] = agScores[i]; });
    const loser = AGENTS.reduce((w, a) => agMap[a] < agMap[w] ? a : w, AGENTS[0]);
    const KEY_D = AGENTS.indexOf(loser); // index of lowest-scoring agent

    const agClues = r.shuffle([
      `${AGENTS[0]}'s score is ${agMap[AGENTS[0]]}.`,
      `${AGENTS[1]}'s score is greater than ${agMap[AGENTS[1]] - 4}.`,
      `${AGENTS[2]} did NOT achieve the highest score.`,
      `The sum of all scores is ${agScores.reduce((a, b) => a + b, 0)}.`,
      `${AGENTS[3]}'s score is less than ${agMap[AGENTS[3]] + 3}.`,
    ]);

    // ── Stage 5: Master synthesis ─────────────────────────────────────────
    // Formula: ((KEY_A + KEY_B_idx) * KEY_C + KEY_D) mod 97
    const masterCode = String(((KEY_A + KEY_B_idx) * Math.max(KEY_C, 1) + KEY_D) % 97).padStart(2, '0');

    return {
      seed,
      puzzleType: 'BLACK_VAULT',
      totalStages: 5,
      maxScore: (config.maxScore as number) || 250,
      displayData: {
        totalStages: 5,
        timerSeconds: 1080,
        instructions: 'THE BLACK VAULT — 5 connected stages. Each produces a key. The final stage requires ALL four keys combined by a formula.',
        stages: [
          {
            stage: 1, title: 'STAGE 1 — SEQUENCE EXTRACTION', type: 'SEQUENCE',
            instructions: 'Find the next value in this geometric sequence. KEY A = (your answer) mod 97.',
            items: [...seq.map(String), '?'],
            keyNote: 'KEY A = answer mod 97',
          },
          {
            stage: 2, title: 'STAGE 2 — DUAL SYMBOL SHIFT', type: 'DUAL_PATTERN',
            instructions: 'TWO independent shift rules apply. The examples show: column 1 → first shift, column 2 → both shifts applied. Apply BOTH shifts to the test symbol.',
            examples: exPairs.map((s, i) => ({ input: s, mid: exOut[i], output: ex2Out[i] })),
            testSymbol: testSym,
            symbolPool: SYM,
            keyNote: 'KEY B = the symbol after BOTH shifts',
          },
          {
            stage: 3, title: 'STAGE 3 — NODE MEMORY', type: 'MEMORY',
            instructions: `Memorise all 8 node codes. You have 8 seconds. Then: what was Node ${targetNode.id + 1}'s code? KEY C = the INDEX of that code in the list.`,
            colorGrid: nodes8,
            revealSec: 8,
            targetNodeId: targetNode.id,
            colorCodes: CODES,
            keyNote: `KEY C = position of the color code in list [${CODES.join(',')}]`,
          },
          {
            stage: 4, title: 'STAGE 4 — AGENT DEDUCTION', type: 'LOGIC',
            instructions: 'Find the LOWEST-scoring agent. KEY D = their position in the agent list (0-indexed).',
            agents: AGENTS,
            clues: agClues,
            keyNote: 'KEY D = index of lowest-scoring agent (0,1,2,3)',
          },
          {
            stage: 5, title: 'STAGE 5 — THE MASTER SYNTHESIS', type: 'FINAL',
            instructions: `Apply the formula: ((KEY_A + KEY_B_index) × KEY_C + KEY_D) mod 97. Enter the 2-digit result (pad with leading zero if needed).`,
            symbolPool: SYM,
            colorList: CODES,
            agentList: AGENTS,
            keyNote: 'Master code = formula result, 2 digits',
          },
        ],
      },
      secretData: {
        KEY_A, KEY_B, KEY_B_idx, KEY_C, KEY_D,
        masterCode,
        stages: {
          1: { answer: String(next), keyA: KEY_A },
          2: { answer: KEY_B, shiftA: shA, shiftB: shB },
          3: { answer: targetNode.code, keyC: KEY_C, targetNodeId: targetNode.id, colorGrid: nodes8 },
          4: { answer: loser, keyD: KEY_D, agentMap: agMap },
          5: { answer: masterCode },
        },
      },
    };
  },
};

// ════════════════════════════════════════════════════════════════════════════
// DAY 7 — THE FINAL VAULT (Championship)
// Timer: 1140s (19 min). Difficulty: FINAL BOSS.
//
// 5 stages. Each key feeds the next AND into the final synthesis.
// Stage 1: 4×4 visual grid memory (10s reveal) → VISUAL_KEY
// Stage 2: Triple-rule pattern (3 simultaneous rules) → PATTERN_KEY
// Stage 3: 4-agent logic grid → LOGIC_KEY
// Stage 4: Caesar cipher (shift derived from LOGIC_KEY) → CIPHER_KEY
// Stage 5: Final code = transform all 4 keys by a formula
//          (no copying shortcuts — formula uses all prior answers)
// ════════════════════════════════════════════════════════════════════════════

export const FinalVaultGenerator: PuzzleGenerator = {
  generate(config, seed, _difficulty) {
    const r = rng(seed);

    // ── Stage 1: Visual grid ──────────────────────────────────────────────
    const VIS = ['◆', '●', '■', '▲', '★', '⬡', '⬟', '✦'];
    const grid = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => r.pick(VIS))
    );
    const REVEAL_SEC = 10;
    const allPos: Array<[number, number]> = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) allPos.push([i, j]);
    const visQs = r.sample(allPos, 3).map(([row, col], i) => ({
      id: i + 1, label: `Row ${row + 1}, Col ${col + 1}`, answer: grid[row][col],
    }));
    // VISUAL_KEY = XOR of symbol indices
    const VISUAL_KEY = visQs.reduce((acc, q) => acc ^ VIS.indexOf(q.answer), 0);

    // ── Stage 2: Triple-rule pattern ──────────────────────────────────────
    const SYMS2 = ['A', 'B', 'C', 'D', 'E', 'F'];
    const shX = r.int(1, 2), shY = r.int(1, 2), shZ = r.int(1, 2); // 3 independent shifts
    // Examples: 4 input→output pairs showing the combined effect
    const exInputs = r.sample(SYMS2, 4);
    const exOutputs = exInputs.map(s =>
      SYMS2[(SYMS2.indexOf(s) + shX + shY + shZ) % SYMS2.length]
    );
    const testIn = r.pick(SYMS2.filter(s => !exInputs.includes(s)));
    const testOut = SYMS2[(SYMS2.indexOf(testIn) + shX + shY + shZ) % SYMS2.length];
    const PATTERN_KEY = SYMS2.indexOf(testOut); // 0–5

    // ── Stage 3: 4-agent logic ────────────────────────────────────────────
    const FA = r.shuffle(['ECHO', 'FOXTROT', 'KILO', 'LIMA']);
    const FR = r.shuffle(['Commander', 'Engineer', 'Specialist', 'Observer']);
    const FC = r.shuffle([11, 22, 33, 44]);
    const fMap: Record<string, { role: string; code: number }> = {};
    FA.forEach((a, i) => { fMap[a] = { role: FR[i], code: FC[i] }; });
    const LOGIC_KEY = fMap[FA[0]].code; // FA[0]'s code

    const fClues = r.shuffle([
      `${FA[0]}'s code is ${fMap[FA[0]].code}.`,
      `The ${fMap[FA[1]].role}'s code is NOT ${FC[(FC.indexOf(fMap[FA[1]].code) + 1) % 4]}.`,
      `${FA[2]} is the ${fMap[FA[2]].role}.`,
      `${FA[3]}'s code is greater than ${fMap[FA[3]].code - 1}.`,
      `Sum of all codes is ${FC.reduce((a, b) => a + b, 0)}.`,
    ]);

    // ── Stage 4: Cipher — shift = LOGIC_KEY mod 7 + 1 ────────────────────
    const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const cShift = (LOGIC_KEY % 7) + 1;  // 1–7, derived from LOGIC_KEY
    const WORDS2 = ['VICTORY', 'CHAMPION', 'SUPREME', 'ULTIMATE', 'ABSOLUTE'];
    const plainWord = r.pick(WORDS2);
    const codedWord = plainWord.split('').map(c => {
      const i = ALPHA.indexOf(c);
      return i === -1 ? c : ALPHA[(i + cShift) % 26];
    }).join('');
    const hint3 = r.sample(plainWord.split(''), 3).map(l => ({
      plain: l,
      encoded: ALPHA[(ALPHA.indexOf(l) + cShift) % 26],
    }));
    const CIPHER_KEY = ALPHA.indexOf(plainWord[0]); // index of first letter of decoded word

    // ── Stage 5: Final synthesis ───────────────────────────────────────────
    // Formula: (VISUAL_KEY × PATTERN_KEY + LOGIC_KEY - CIPHER_KEY) mod 100
    // Requires all 4 correct keys; any error cascades
    const rawFinal = (VISUAL_KEY * Math.max(PATTERN_KEY, 1) + LOGIC_KEY - CIPHER_KEY + 100) % 100;
    const finalCode = String(rawFinal).padStart(2, '0');

    return {
      seed,
      puzzleType: 'FINAL_VAULT',
      totalStages: 5,
      maxScore: (config.maxScore as number) || 500,
      displayData: {
        totalStages: 5,
        isFinal: true,
        timerSeconds: 1140,
        instructions: '⚔ THE FINAL VAULT — 5 connected stages. Each key feeds the next. The final formula requires all four correctly derived keys. One mistake changes everything.',
        stages: [
          {
            stage: 1, title: 'STAGE 1 — VISUAL OBSERVATION', type: 'VISUAL_GRID',
            grid, revealSec: REVEAL_SEC,
            questions: visQs.map(q => ({ id: q.id, label: q.label })),
            symbolPool: VIS,
            instructions: `${REVEAL_SEC}s to memorise the ${4}×${4} grid. Answer 3 position questions. VISUAL KEY = XOR of your 3 answer indices.`,
          },
          {
            stage: 2, title: 'STAGE 2 — TRIPLE TRANSFORMATION', type: 'DUAL_PATTERN',
            examples: exInputs.map((s, i) => ({ input: s, output: exOutputs[i] })),
            testInput: { sym: testIn, pos: 0 },
            patternPool: SYMS2,
            posLabels: ['POSITION 0', 'POSITION 1', 'POSITION 2'],
            instructions: 'THREE independent shift rules apply to every symbol. Determine the combined shift from the examples. Apply it to the test symbol. PATTERN KEY = the output symbol\'s index.',
          },
          {
            stage: 3, title: 'STAGE 3 — AGENT DEDUCTION', type: 'LOGIC_GRID_4',
            agents: FA, roles: FR, codes: FC, clues: fClues,
            instructions: `Determine each agent's role and code. LOGIC KEY = ${FA[0]}'s code number.`,
          },
          {
            stage: 4, title: 'STAGE 4 — CIPHER DECODE', type: 'CIPHER',
            encodedWord: codedWord,
            hints: hint3,
            wordLength: plainWord.length,
            instructions: `The cipher shift = (LOGIC KEY mod 7) + 1. Use the letter hints. Decode the word. CIPHER KEY = the alphabet index (A=0) of the decoded word's first letter.`,
          },
          {
            stage: 5, title: 'STAGE 5 — THE FINAL SYNTHESIS', type: 'MASTER_UNLOCK',
            instructions: `Formula: (VISUAL_KEY × PATTERN_KEY + LOGIC_KEY − CIPHER_KEY) mod 100. Enter the 2-digit result (leading zero if needed).`,
            symbolPool2: VIS,
            patternPool: SYMS2,
          },
        ],
      },
      secretData: {
        VISUAL_KEY, PATTERN_KEY, LOGIC_KEY, CIPHER_KEY,
        finalCode,
        stages: {
          1: { answers: Object.fromEntries(visQs.map(q => [`q${q.id}`, q.answer])), VISUAL_KEY },
          2: { answerSym: testOut, PATTERN_KEY },
          3: { logicMap: fMap, LOGIC_KEY },
          4: { answer: plainWord, cipherShift: cShift, CIPHER_KEY },
          5: { answer: finalCode },
        },
      },
    };
  },
};
