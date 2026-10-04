import { useState } from 'react';
import { PuzzleProps, LogicDisplayData } from '../../types/puzzle';

type Props = PuzzleProps<LogicDisplayData>;

export default function LogicPuzzle({ displayData, onSubmit, submitting, lastResult, locked }: Props) {
  const { names, roles, numbers, clues, instructions } = displayData;

  // mapping[name] = { role, number }
  const [mapping, setMapping] = useState<Record<string, { role: string; number: string }>>(
    Object.fromEntries(names.map(n => [n, { role: '', number: '' }]))
  );

  const isComplete = names.every(n => mapping[n].role && mapping[n].number);

  const set = (name: string, field: 'role' | 'number', value: string) => {
    setMapping(prev => ({ ...prev, [name]: { ...prev[name], [field]: value } }));
  };

  const handleSubmit = async () => {
    if (!isComplete || submitting || locked) return;
    const finalMapping: Record<string, { role: string; number: number }> = {};
    for (const name of names) {
      finalMapping[name] = { role: mapping[name].role, number: Number(mapping[name].number) };
    }
    await onSubmit({ mapping: finalMapping });
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-300 text-sm leading-relaxed">{instructions}</p>

      {/* Clues */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-cyber-400 font-semibold">◆ Clues</p>
        {clues.map((clue, i) => (
          <div key={i} className="bg-arena-900 border border-arena-600 rounded-lg px-4 py-3 flex gap-3">
            <span className="text-cyber-600 font-mono text-xs shrink-0 mt-0.5">[{i + 1}]</span>
            <p className="text-white text-sm">{clue}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-arena-700">
              <th className="text-left text-xs text-gray-500 px-3 py-2 uppercase tracking-wider">Agent</th>
              <th className="text-left text-xs text-gray-500 px-3 py-2 uppercase tracking-wider">Role</th>
              <th className="text-left text-xs text-gray-500 px-3 py-2 uppercase tracking-wider">Number</th>
            </tr>
          </thead>
          <tbody>
            {names.map(name => (
              <tr key={name} className="border-b border-arena-800">
                <td className="px-3 py-3">
                  <span className="text-cyber-300 font-mono font-bold">{name}</span>
                </td>
                <td className="px-3 py-3">
                  <select
                    value={mapping[name].role}
                    onChange={e => set(name, 'role', e.target.value)}
                    disabled={locked || submitting}
                    className="bg-arena-800 border border-arena-600 text-white text-sm px-2 py-1.5 rounded focus:outline-none focus:border-cyber-500 disabled:opacity-50"
                  >
                    <option value="">Select…</option>
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3">
                  <select
                    value={mapping[name].number}
                    onChange={e => set(name, 'number', e.target.value)}
                    disabled={locked || submitting}
                    className="bg-arena-800 border border-arena-600 text-white text-sm px-2 py-1.5 rounded focus:outline-none focus:border-cyber-500 disabled:opacity-50"
                  >
                    <option value="">Select…</option>
                    {numbers.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lastResult && (
        <div className={`rounded-lg px-4 py-3 border ${lastResult.isCorrect ? 'bg-emerald-900/30 border-emerald-700' : 'bg-danger-900/30 border-danger-700'}`}>
          <p className={`text-sm ${lastResult.isCorrect ? 'text-emerald-300' : 'text-danger-300'}`}>{lastResult.feedback}</p>
        </div>
      )}

      {!locked && (
        <button onClick={handleSubmit} disabled={submitting || !isComplete} className="btn-primary w-full py-4">
          {submitting ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Checking…</span> : 'SUBMIT DEDUCTIONS'}
        </button>
      )}
    </div>
  );
}
