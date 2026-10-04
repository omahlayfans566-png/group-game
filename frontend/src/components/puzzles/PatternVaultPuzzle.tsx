/**
 * DAY 2 — THE PATTERN VAULT
 * Player sees States 1–4 and must construct States 5 AND 6.
 * Four simultaneous rules — harder than the original 3-rule version.
 */
import { useState } from 'react';
import { PuzzleProps } from '../../types/puzzle';

interface GridState { step: number; grid: (string | null)[][]; symbol: string; count: number; position: string }
interface DisplayData {
  symbols: string[];
  examples: GridState[];
  targets: number[];
  instructions: string;
  timerSeconds: number;
  gridSize: number;
  symbolPool: string[];
}
type Props = PuzzleProps<DisplayData>;

export default function PatternVaultPuzzle({ displayData, onSubmit, submitting, lastResult, locked }: Props) {
  const { examples, instructions, symbolPool } = displayData;

  // Two grids to fill: State 5 and State 6
  const [grid5, setGrid5] = useState<(string | null)[][]>([[null, null], [null, null]]);
  const [grid6, setGrid6] = useState<(string | null)[][]>([[null, null], [null, null]]);
  const [selectedSym, setSelectedSym] = useState<string | null>(symbolPool[0] ?? null);
  const [activeTarget, setActiveTarget] = useState<5 | 6>(5);

  const handleCellClick = (row: number, col: number) => {
    if (locked || submitting) return;
    const setter = activeTarget === 5 ? setGrid5 : setGrid6;
    setter(prev => {
      const next = prev.map(r => [...r]);
      next[row][col] = next[row][col] === selectedSym ? null : selectedSym;
      return next;
    });
  };

  const clearGrid = (target: 5 | 6) => {
    (target === 5 ? setGrid5 : setGrid6)([[null, null], [null, null]]);
  };

  const handleSubmit = async () => {
    if (submitting || locked) return;
    await onSubmit({ grid5, grid6 });
  };

  const filled5 = grid5.flat().filter(Boolean).length;
  const filled6 = grid6.flat().filter(Boolean).length;

  const renderGrid = (grid: (string | null)[][], target: 5 | 6, isActive: boolean) => (
    <div className={`space-y-2 p-4 rounded-xl border-2 transition-all ${isActive ? 'border-cyber-500 bg-cyber-900/10' : 'border-arena-600 bg-arena-900/30'}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-bold uppercase tracking-widest ${isActive ? 'text-cyber-400' : 'text-gray-500'}`}>
          State {target} {isActive ? '← EDITING' : ''}
        </p>
        <button onClick={() => clearGrid(target)} disabled={locked} className="text-[10px] text-gray-600 hover:text-danger-400 transition-colors">CLEAR</button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mx-auto" style={{ width: 112 }}>
        {grid.flat().map((cell, i) => {
          const row = Math.floor(i / 2), col = i % 2;
          return (
            <button
              key={i}
              onClick={() => { setActiveTarget(target); handleCellClick(row, col); }}
              onFocus={() => setActiveTarget(target)}
              disabled={locked || submitting}
              className={`
                w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl
                transition-all touch-manipulation active:scale-95
                ${cell ? 'bg-cyber-900 border-cyber-500 shadow-[0_0_8px_rgba(0,179,179,0.3)]' : 'bg-arena-900 border-arena-600 border-dashed hover:border-cyber-700'}
              `}
            >
              {cell ?? <span className="text-gray-700 text-lg">+</span>}
            </button>
          );
        })}
      </div>
      <p className="text-center text-[10px] text-gray-600">{grid.flat().filter(Boolean).length} filled</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <p className="text-gray-300 text-sm leading-relaxed">{instructions}</p>

      {/* Symbol selector */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-cyber-400 font-semibold">◆ Select Symbol</p>
        <div className="flex items-center gap-2 flex-wrap">
          {symbolPool.map(sym => (
            <button key={sym} onClick={() => setSelectedSym(sym)} disabled={locked}
              className={`w-11 h-11 text-2xl rounded-lg border-2 transition-all touch-manipulation
                ${selectedSym === sym ? 'bg-cyber-800 border-cyber-400 scale-110 shadow-[0_0_10px_rgba(0,179,179,0.4)]' : 'bg-arena-800 border-arena-600 hover:border-cyber-700'}`}>
              {sym}
            </button>
          ))}
          <button onClick={() => setSelectedSym(null)} disabled={locked}
            className={`px-3 h-11 text-xs rounded-lg border-2 transition-all ${!selectedSym ? 'bg-danger-900 border-danger-500 text-danger-300' : 'bg-arena-800 border-arena-600 text-gray-500 hover:border-danger-700'}`}>
            ERASE
          </button>
        </div>
      </div>

      {/* Example states */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-cyber-400 font-semibold mb-3">◆ Observed States (study carefully)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {examples.map(ex => (
            <div key={ex.step} className="bg-arena-900 border border-arena-700 rounded-lg p-3 space-y-2">
              <p className="text-xs text-cyber-500 font-mono text-center font-bold">STATE {ex.step}</p>
              <div className="grid grid-cols-2 gap-1 mx-auto" style={{ maxWidth: 88 }}>
                {ex.grid.flat().map((cell, i) => (
                  <div key={i} className={`w-10 h-10 rounded border flex items-center justify-center text-lg
                    ${cell ? 'bg-arena-800 border-arena-600 text-white' : 'bg-arena-950 border-arena-800 text-gray-800'}`}>
                    {cell ?? '·'}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Build State 5 and 6 */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-amber-400 font-semibold mb-3">
          ◆ Reconstruct States 5 AND 6 — click a grid to edit it
        </p>
        <div className="grid grid-cols-2 gap-3">
          {renderGrid(grid5, 5, activeTarget === 5)}
          {renderGrid(grid6, 6, activeTarget === 6)}
        </div>
        <p className="text-center text-gray-600 text-xs mt-2">
          State 5: {filled5} filled · State 6: {filled6} filled
        </p>
      </div>

      {lastResult && (
        <div className={`rounded-lg px-4 py-3 border flex items-start gap-2
          ${lastResult.isCorrect ? 'bg-emerald-900/30 border-emerald-700' : 'bg-danger-900/30 border-danger-700'}`}>
          <span className="text-lg">{lastResult.isCorrect ? '🔓' : '✗'}</span>
          <p className={`text-sm ${lastResult.isCorrect ? 'text-emerald-300' : 'text-danger-300'}`}>{lastResult.feedback}</p>
        </div>
      )}

      {!locked && (
        <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full py-4 text-base">
          {submitting
            ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Validating…</span>
            : '🔓 SUBMIT STATES 5 & 6'}
        </button>
      )}
    </div>
  );
}
