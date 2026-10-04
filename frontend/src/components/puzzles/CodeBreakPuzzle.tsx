import { useState, useRef, useEffect } from 'react';
import { PuzzleProps, CodeBreakDisplayData } from '../../types/puzzle';

type Props = PuzzleProps<CodeBreakDisplayData>;

export default function CodeBreakPuzzle({ displayData, onSubmit, submitting, lastResult, locked }: Props) {
  const { clues, codeLength, instructions, inputLabel } = displayData;

  // Each digit is a separate controlled input for a tactile feel
  const [digits, setDigits] = useState<string[]>(Array(codeLength).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [shake, setShake] = useState(false);

  // Focus first empty input on mount
  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  const handleDigit = (idx: number, value: string) => {
    if (locked || submitting) return;
    const clean = value.replace(/\D/g, '').slice(-1); // only last digit
    const next = [...digits];
    next[idx] = clean;
    setDigits(next);
    // Auto-advance to next input
    if (clean && idx < codeLength - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'Enter') handleSubmit();
  };

  const handleSubmit = async () => {
    if (locked || submitting) return;
    const code = digits.join('');
    if (code.length < codeLength) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    await onSubmit({ code });
  };

  const isIncomplete = digits.some(d => d === '');
  const codeEntered  = digits.join('');

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <p className="text-gray-300 text-sm leading-relaxed">{instructions}</p>

      {/* Clue cards */}
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-cyber-400 font-semibold">
          ◆ Clues
        </p>
        {clues.map((clue) => (
          <div
            key={clue.id}
            className="bg-arena-900 border border-arena-600 rounded-lg px-5 py-4 flex gap-4 items-start"
          >
            <span className="text-cyber-500 font-mono text-xs font-bold shrink-0 mt-0.5">
              [{String(clue.id).padStart(2, '0')}]
            </span>
            <div className="flex-1">
              <p className="text-white font-mono text-sm">{clue.text}</p>
              <p className="text-gray-600 text-xs mt-1 italic">{clue.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Code entry */}
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-cyber-400 font-semibold">
          ◆ {inputLabel}
        </p>

        <div className={`flex justify-center gap-3 ${shake ? 'animate-[wiggle_0.4s_ease]' : ''}`}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]"
              maxLength={1}
              value={d}
              disabled={locked || submitting}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={e => e.preventDefault()}
              onCopy={e => e.preventDefault()}
              className={`
                w-14 h-16 text-center text-2xl font-mono font-bold rounded-lg border-2
                bg-arena-900 text-white caret-cyber-400 transition-all duration-150
                focus:outline-none focus:border-cyber-400 focus:shadow-[0_0_12px_rgba(0,179,179,0.4)]
                disabled:opacity-50 disabled:cursor-not-allowed
                ${d ? 'border-cyber-600 text-cyber-300' : 'border-arena-600'}
                ${locked ? 'border-arena-700 text-gray-600' : ''}
              `}
            />
          ))}
        </div>

        {/* Visual fill indicator */}
        <div className="flex justify-center gap-1 mt-1">
          {digits.map((d, i) => (
            <div
              key={i}
              className={`h-1 w-10 rounded-full transition-colors duration-200 ${d ? 'bg-cyber-500' : 'bg-arena-700'}`}
            />
          ))}
        </div>
      </div>

      {/* Last result feedback */}
      {lastResult && !lastResult.isCorrect && (
        <div className="bg-danger-900/40 border border-danger-700 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-danger-400 text-lg">✗</span>
          <p className="text-danger-300 text-sm">{lastResult.feedback}</p>
        </div>
      )}

      {/* Submit button */}
      {!locked && (
        <button
          onClick={handleSubmit}
          disabled={submitting || isIncomplete || locked}
          className="btn-primary w-full py-4 text-base tracking-widest"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Validating…
            </span>
          ) : (
            `SUBMIT CODE — ${codeEntered.padEnd(codeLength, '·')}`
          )}
        </button>
      )}

      {locked && (
        <div className="arena-card p-4 text-center">
          <p className="text-gray-500 text-sm font-mono tracking-wider">CHALLENGE LOCKED</p>
        </div>
      )}

      <style>{`
        @keyframes wiggle {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          60%      { transform: translateX(8px); }
          80%      { transform: translateX(-4px); }
        }
      `}</style>
    </div>
  );
}
