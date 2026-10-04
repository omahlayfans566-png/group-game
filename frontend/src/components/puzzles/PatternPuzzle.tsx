import { useState } from 'react';
import { PuzzleProps, PatternDisplayData } from '../../types/puzzle';

type Props = PuzzleProps<PatternDisplayData>;

export default function PatternPuzzle({ displayData, onSubmit, submitting, lastResult, locked }: Props) {
  const { patterns, instructions } = displayData;
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const isComplete = patterns.every(p => answers[`p${p.id}`]?.trim() !== '');

  const handleSubmit = async () => {
    if (!isComplete || submitting || locked) return;
    await onSubmit({ answers });
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-300 text-sm leading-relaxed">{instructions}</p>

      <div className="space-y-6">
        {patterns.map(pattern => (
          <div key={pattern.id} className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-cyber-400 font-semibold">
              ◆ Pattern {pattern.id}
            </p>

            {/* Pattern items */}
            <div className="flex flex-wrap items-center gap-2">
              {pattern.items.map((item, i) => {
                const isQuestion = item === '?';
                return isQuestion ? (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={answers[`p${pattern.id}`] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [`p${pattern.id}`]: e.target.value }))}
                      disabled={locked || submitting}
                      placeholder="?"
                      maxLength={6}
                      onPaste={e => e.preventDefault()}
                      className={`
                        w-16 h-14 text-center font-mono font-bold text-lg rounded-lg border-2
                        bg-arena-800 text-cyber-300 transition-all
                        focus:outline-none focus:border-cyber-400
                        disabled:opacity-50
                        ${answers[`p${pattern.id}`] ? 'border-cyber-600' : 'border-cyber-800 border-dashed'}
                      `}
                    />
                    <span className="text-[9px] text-cyber-600 uppercase tracking-wider">NEXT</span>
                  </div>
                ) : (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-14 h-14 bg-arena-900 border border-arena-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-mono font-bold text-lg">{item}</span>
                    </div>
                    {i < pattern.items.length - 2 && (
                      <span className="text-gray-600 text-xl font-bold">→</span>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-gray-400 text-xs italic">{pattern.question}</p>
          </div>
        ))}
      </div>

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
              Checking…
            </span>
          ) : 'SUBMIT PATTERNS'}
        </button>
      )}
    </div>
  );
}
