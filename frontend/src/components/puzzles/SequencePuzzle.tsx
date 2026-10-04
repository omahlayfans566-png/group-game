import { useState } from 'react';
import { PuzzleProps, SequenceDisplayData } from '../../types/puzzle';

type Props = PuzzleProps<SequenceDisplayData>;

export default function SequencePuzzle({ displayData, onSubmit, submitting, lastResult, locked }: Props) {
  const { sequences, instructions } = displayData;

  // answers keyed by "seqId_gapIndex"
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const gapKeys: string[] = [];
  sequences.forEach(seq => {
    seq.visible.forEach((v, i) => { if (v === null) gapKeys.push(`${seq.id}_${i}`); });
  });

  const isComplete = gapKeys.every(k => answers[k]?.trim() !== '');

  const handleSubmit = async () => {
    if (locked || submitting || !isComplete) return;
    const numericAnswers: Record<string, number> = {};
    for (const k of gapKeys) numericAnswers[k] = Number(answers[k]);
    await onSubmit({ answers: numericAnswers });
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-300 text-sm leading-relaxed">{instructions}</p>

      <div className="space-y-6">
        {sequences.map(seq => (
          <div key={seq.id} className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-cyber-400 font-semibold">
              ◆ Sequence {seq.id}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {seq.visible.map((val, i) => {
                const key = `${seq.id}_${i}`;
                const isGap = val === null;
                return isGap ? (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <input
                      type="number"
                      value={answers[key] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [key]: e.target.value }))}
                      disabled={locked || submitting}
                      placeholder="?"
                      onPaste={e => e.preventDefault()}
                      className={`
                        w-16 h-14 text-center text-lg font-mono font-bold rounded-lg border-2
                        bg-arena-800 text-cyber-300 transition-all duration-150
                        focus:outline-none focus:border-cyber-400 focus:shadow-[0_0_10px_rgba(0,179,179,0.3)]
                        disabled:opacity-50
                        ${answers[key] ? 'border-cyber-600' : 'border-cyber-800 border-dashed'}
                      `}
                    />
                    <span className="text-[9px] text-cyber-600 uppercase tracking-wider">MISSING</span>
                  </div>
                ) : (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="w-14 h-14 bg-arena-900 border border-arena-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-mono font-bold text-lg">{val}</span>
                    </div>
                    <span className="text-[9px] text-gray-700 font-mono">{i + 1}</span>
                  </div>
                );
              })}
              <div className="flex flex-col items-center gap-1 opacity-40">
                <div className="w-10 h-14 flex items-center justify-center">
                  <span className="text-gray-500 text-2xl">…</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {lastResult && !lastResult.isComplete && (
        <div className={`rounded-lg px-4 py-3 border ${lastResult.isCorrect ? 'bg-emerald-900/30 border-emerald-700' : 'bg-danger-900/30 border-danger-700'}`}>
          <p className={`text-sm ${lastResult.isCorrect ? 'text-emerald-300' : 'text-danger-300'}`}>
            {lastResult.feedback}
          </p>
        </div>
      )}

      {!locked && (
        <button
          onClick={handleSubmit}
          disabled={submitting || !isComplete || locked}
          className="btn-primary w-full py-4 text-base tracking-widest"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Checking…
            </span>
          ) : 'SUBMIT ANSWERS'}
        </button>
      )}
    </div>
  );
}
