import { useState } from 'react';
import { PuzzleProps, HiddenObjectDisplayData } from '../../types/puzzle';

type Props = PuzzleProps<HiddenObjectDisplayData>;

export default function HiddenObjectPuzzle({ displayData, onSubmit, submitting, lastResult, locked }: Props) {
  const { grid, gridSize, targetWords, instructions } = displayData;
  const [found, setFound] = useState<Record<string, { row: number; col: number }>>({});
  const [selected, setSelected] = useState<string | null>(null); // word being placed

  const handleCellClick = (row: number, col: number) => {
    if (!selected || locked || submitting) return;
    setFound(prev => ({ ...prev, [selected]: { row, col } }));
    // Auto-advance to next unplaced word
    const next = targetWords.find(w => w.word !== selected && !found[w.word]);
    setSelected(next?.word ?? null);
  };

  const isComplete = targetWords.every(w => found[w.word]);

  const handleSubmit = async () => {
    if (!isComplete || submitting || locked) return;
    await onSubmit({ found });
  };

  return (
    <div className="space-y-5">
      <p className="text-gray-300 text-sm leading-relaxed">{instructions}</p>

      {/* Word targets */}
      <div className="flex flex-wrap gap-2">
        {targetWords.map(({ word }) => (
          <button
            key={word}
            onClick={() => setSelected(word)}
            disabled={locked || submitting}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-mono font-bold border transition-all
              ${found[word] ? 'bg-emerald-900/50 border-emerald-700 text-emerald-400 line-through' :
                selected === word ? 'bg-cyber-800 border-cyber-500 text-cyber-300' :
                'bg-arena-800 border-arena-600 text-gray-400 hover:border-cyber-700'}
            `}
          >
            {word} {found[word] ? '✓' : ''}
          </button>
        ))}
      </div>

      {selected && !found[selected] && (
        <p className="text-amber-400 text-xs font-mono animate-pulse">
          → Click the first letter of: <strong>{selected}</strong>
        </p>
      )}

      {/* Grid */}
      <div
        className="grid gap-0.5 overflow-x-auto"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`, maxWidth: gridSize * 34 }}
      >
        {grid.map((row, r) =>
          row.map((cell, c) => {
            const isFoundStart = Object.values(found).some(pos => pos.row === r && pos.col === c);
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                disabled={locked || submitting || !selected}
                className={`
                  w-8 h-8 text-xs font-mono font-bold rounded transition-colors
                  ${isFoundStart ? 'bg-cyber-700 text-white border border-cyber-500' :
                    'bg-arena-900 border border-arena-700 text-gray-400 hover:bg-arena-700 hover:text-white'}
                  disabled:cursor-default
                `}
              >
                {cell}
              </button>
            );
          })
        )}
      </div>

      {lastResult && (
        <div className={`rounded-lg px-4 py-3 border ${lastResult.isCorrect ? 'bg-emerald-900/30 border-emerald-700' : 'bg-danger-900/30 border-danger-700'}`}>
          <p className={`text-sm ${lastResult.isCorrect ? 'text-emerald-300' : 'text-danger-300'}`}>{lastResult.feedback}</p>
        </div>
      )}

      {!locked && (
        <button onClick={handleSubmit} disabled={submitting || !isComplete} className="btn-primary w-full py-4">
          {submitting ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Checking…</span> : 'SUBMIT FINDINGS'}
        </button>
      )}
    </div>
  );
}
