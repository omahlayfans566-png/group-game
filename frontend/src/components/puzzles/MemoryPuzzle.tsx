import { useState, useEffect, useCallback } from 'react';
import { PuzzleProps, MemoryDisplayData } from '../../types/puzzle';

type Phase = 'memorise' | 'recall';
type Props  = PuzzleProps<MemoryDisplayData>;

export default function MemoryPuzzle({ displayData, onSubmit, submitting, lastResult, locked }: Props) {
  const { grid, gridSize, revealSeconds, questions, instructions } = displayData;

  const [phase, setPhase]       = useState<Phase>('memorise');
  const [countdown, setCountdown] = useState(revealSeconds);
  const [answers, setAnswers]   = useState<Record<string, string>>({});

  const startRecall = useCallback(() => setPhase('recall'), []);

  // Countdown during memorise phase
  useEffect(() => {
    if (phase !== 'memorise' || locked) return;
    if (countdown <= 0) { startRecall(); return; }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, countdown, locked, startRecall]);

  const isComplete = questions.every(q => answers[`q${q.id}`]?.trim() !== '');

  const handleSubmit = async () => {
    if (!isComplete || submitting || locked) return;
    await onSubmit({ answers });
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-300 text-sm leading-relaxed">{instructions}</p>

      {/* Phase indicator */}
      <div className="flex items-center gap-4">
        <div className={`flex-1 h-1 rounded-full ${phase === 'memorise' ? 'bg-cyber-500' : 'bg-arena-700'}`} />
        <span className={`text-xs font-bold uppercase tracking-widest ${phase === 'memorise' ? 'text-cyber-400' : 'text-gray-600'}`}>
          Memorise
        </span>
        <div className={`flex-1 h-1 rounded-full ${phase === 'recall' ? 'bg-amber-500' : 'bg-arena-700'}`} />
        <span className={`text-xs font-bold uppercase tracking-widest ${phase === 'recall' ? 'text-amber-400' : 'text-gray-600'}`}>
          Recall
        </span>
        <div className="flex-1 h-1 rounded-full bg-arena-700" />
      </div>

      {phase === 'memorise' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-cyber-400 text-xs uppercase tracking-widest font-semibold">
              Memorise the grid
            </p>
            <div className={`font-mono font-bold text-2xl ${countdown <= 3 ? 'text-danger-400 animate-pulse' : 'text-cyber-300'}`}>
              {countdown}s
            </div>
          </div>

          <div
            className="grid gap-1 mx-auto"
            style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`, maxWidth: gridSize * 44 }}
          >
            {grid.map((row, r) =>
              row.map((cell, c) => (
                <div
                  key={`${r}-${c}`}
                  className="w-10 h-10 bg-arena-800 border border-arena-600 rounded flex items-center justify-center text-lg select-none"
                >
                  {cell}
                </div>
              ))
            )}
          </div>

          <button onClick={startRecall} className="btn-ghost w-full text-sm py-2">
            I'm ready — hide the grid
          </button>
        </div>
      )}

      {phase === 'recall' && (
        <div className="space-y-5">
          <p className="text-amber-400 text-xs uppercase tracking-widest font-semibold">
            The grid is now hidden. Answer from memory.
          </p>

          {questions.map(q => (
            <div key={q.id} className="arena-card p-4 space-y-2">
              <p className="text-white text-sm">{q.label}</p>
              <input
                type="text"
                maxLength={2}
                value={answers[`q${q.id}`] ?? ''}
                onChange={e => setAnswers(prev => ({ ...prev, [`q${q.id}`]: e.target.value }))}
                disabled={locked || submitting}
                placeholder="Enter symbol…"
                onPaste={e => e.preventDefault()}
                className="arena-input text-center text-xl font-mono w-24"
              />
            </div>
          ))}

          {lastResult && (
            <div className={`rounded-lg px-4 py-3 border ${lastResult.isCorrect ? 'bg-emerald-900/30 border-emerald-700' : 'bg-danger-900/30 border-danger-700'}`}>
              <p className={`text-sm ${lastResult.isCorrect ? 'text-emerald-300' : 'text-danger-300'}`}>
                {lastResult.feedback}
              </p>
            </div>
          )}

          {!locked && (
            <button
              onClick={handleSubmit}
              disabled={submitting || !isComplete}
              className="btn-primary w-full py-4 text-base tracking-widest"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Checking memory…
                </span>
              ) : 'SUBMIT RECALL'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
