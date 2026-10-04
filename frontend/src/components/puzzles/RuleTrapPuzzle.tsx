/**
 * DAY 5 — THE RULE TRAP
 * Objects are shown in a grid (2×3). Each has a shape, color, size.
 * Player toggles objects selected, then either PROBES (limited) or SUBMITS FINAL.
 * Probes return partial feedback revealing info about the hidden rule.
 * Wrong final answers cost score but do not re-lock previous probes.
 */
import { useState } from 'react';
import { PuzzleProps } from '../../types/puzzle';

interface ObjectItem { id: number; shape: string; color: string; size: string; row: number; col: number }
interface ProbeResult { selectedIds: number[]; feedback: string; timestamp: number }
interface DisplayData {
  objects: ObjectItem[];
  rows: number; cols: number;
  maxProbes: number;
  instructions: string;
  probeInstructions: string;
  finalInstructions: string;
}
type Props = PuzzleProps<DisplayData>;

const COLOR_RING: Record<string, string> = {
  red: 'ring-2 ring-red-500',
  blue: 'ring-2 ring-blue-500',
  gold: 'ring-2 ring-yellow-400',
  purple: 'ring-2 ring-purple-500',
  teal: 'ring-2 ring-teal-400',
  orange: 'ring-2 ring-orange-400',
};

const SIZE_CLASS: Record<string, string> = {
  small: 'text-xl',
  medium: 'text-3xl',
  large: 'text-4xl',
};

export default function RuleTrapPuzzle({ displayData, onSubmit, submitting, lastResult, locked }: Props) {
  const { objects, rows, cols, maxProbes, instructions, probeInstructions, finalInstructions } = displayData;

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [probeLog, setProbeLog] = useState<ProbeResult[]>([]);
  const [probesUsed, setProbesUsed] = useState(0);
  const [finalMode, setFinalMode] = useState(false);

  const toggle = (id: number) => {
    if (locked || submitting) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleProbe = async () => {
    if (submitting || locked || probesUsed >= maxProbes) return;
    const result = await new Promise<string>(resolve => {
      onSubmit({ type: 'probe', selectedIds: [...selected] }).then(() => {
        resolve(lastResult?.feedback ?? '');
      });
    });
    setProbeLog(prev => [...prev, { selectedIds: [...selected], feedback: result, timestamp: Date.now() }]);
    setProbesUsed(p => p + 1);
  };

  const handleFinalSubmit = async () => {
    if (submitting || locked) return;
    await onSubmit({ type: 'final', selectedIds: [...selected] });
  };

  const probesLeft = maxProbes - probesUsed;

  // Organize objects into grid
  const grid: ObjectItem[][] = Array.from({ length: rows }, (_, r) =>
    objects.filter(o => o.row === r)
  );

  return (
    <div className="space-y-5">
      <p className="text-gray-300 text-sm leading-relaxed">{instructions}</p>

      {/* Probe budget */}
      <div className="flex items-center justify-between bg-arena-900 border border-arena-700 rounded-lg px-4 py-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Probes Remaining</p>
          <div className="flex gap-1 mt-1">
            {Array.from({ length: maxProbes }, (_, i) => (
              <div key={i} className={`w-3 h-3 rounded-full ${i < probesLeft ? 'bg-cyber-500' : 'bg-arena-700'}`} />
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className="text-cyber-400 font-mono font-bold text-xl">{probesLeft}</p>
          <p className="text-gray-600 text-xs">left</p>
        </div>
      </div>

      {/* Object grid */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500 font-semibold">
          ◆ Objects — {selected.size} selected
        </p>
        <div
          className="grid gap-2 mx-auto"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: cols * 80 }}
        >
          {objects.map(obj => (
            <button
              key={obj.id}
              onClick={() => toggle(obj.id)}
              disabled={locked || submitting}
              className={`
                aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1
                transition-all touch-manipulation active:scale-95
                ${selected.has(obj.id)
                  ? `bg-cyber-900 border-cyber-400 ${COLOR_RING[obj.color]} shadow-[0_0_12px_rgba(0,179,179,0.3)]`
                  : 'bg-arena-800 border-arena-700 hover:border-arena-500'}
                disabled:cursor-default
              `}
            >
              <span className={`${SIZE_CLASS[obj.size] ?? 'text-2xl'}`}>{obj.shape}</span>
              <span className={`text-[9px] font-bold uppercase tracking-wider
                ${obj.color === 'red' ? 'text-red-400' :
                  obj.color === 'blue' ? 'text-blue-400' :
                    obj.color === 'gold' ? 'text-yellow-400' :
                      obj.color === 'purple' ? 'text-purple-400' :
                        obj.color === 'teal' ? 'text-teal-400' : 'text-orange-400'}`}>
                {obj.color}
              </span>
              {selected.has(obj.id) && (
                <span className="text-cyber-400 text-[10px] font-bold">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Probe log */}
      {probeLog.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500 font-semibold">◆ Probe Log</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {probeLog.map((entry, i) => (
              <div key={i} className="bg-arena-900 border border-arena-700 rounded-lg px-3 py-2 flex items-start gap-2">
                <span className="text-gray-600 font-mono text-xs shrink-0 mt-0.5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-amber-300 text-xs leading-relaxed">{entry.feedback || 'No feedback returned.'}</p>
                  <p className="text-gray-600 text-[10px] mt-0.5">Selected IDs: [{entry.selectedIds.join(', ')}]</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback from last result */}
      {lastResult && lastResult.isCorrect && (
        <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg px-4 py-3 flex gap-2">
          <span className="text-emerald-400 text-lg">⚡</span>
          <p className="text-emerald-300 text-sm font-semibold">{lastResult.feedback}</p>
        </div>
      )}

      {/* Actions */}
      {!locked && !finalMode && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleProbe}
            disabled={submitting || probesLeft === 0 || selected.size === 0}
            className="btn-ghost flex-1 py-3 text-sm"
          >
            {submitting ? '…' : `🔍 PROBE (${probesLeft} left)`}
          </button>
          <button
            onClick={() => setFinalMode(true)}
            disabled={selected.size === 0}
            className="btn-primary flex-1 py-3 text-sm"
          >
            LOCK IN FINAL ANSWER →
          </button>
        </div>
      )}

      {!locked && finalMode && (
        <div className="space-y-3">
          <div className="bg-danger-900/30 border border-danger-700 rounded-lg px-4 py-3">
            <p className="text-danger-300 text-sm font-semibold">⚠ Final Answer Mode</p>
            <p className="text-gray-400 text-xs mt-1">{finalInstructions} Your selection: [{[...selected].join(', ')}]</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setFinalMode(false)} className="btn-ghost flex-1 py-3 text-sm">← Back</button>
            <button onClick={handleFinalSubmit} disabled={submitting || selected.size === 0} className="btn-danger flex-1 py-3 text-sm">
              {submitting ? '…' : '⚡ CONFIRM FINAL ANSWER'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
