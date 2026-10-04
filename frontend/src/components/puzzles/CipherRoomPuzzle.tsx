/**
 * DAY 4 — THE CIPHER ROOM
 * Lock 1: Rotating dial — tap +/- to set each digit
 * Lock 2: Cipher — text input with partial key reference
 * Lock 3: Logic grid — dropdown deductions
 * Lock 4: Final code — text input
 */
import { useState } from 'react';
import { PuzzleProps } from '../../types/puzzle';

interface StageData {
  stage: number; title: string; type: string; instructions: string;
  // Dial
  dialCount?: number; clues?: string[];
  // Cipher
  encodedWord?: string; partialKey?: Array<{ encoded: string; plain: string }>; wordLength?: number;
  // Logic
  agents?: string[]; roles?: string[]; floors?: number[];
  // Final
  hint?: string;
  // Generic
  codeLength?: number;
}
interface DisplayData { totalStages: number; stages: StageData[]; instructions: string }
type Props = PuzzleProps<DisplayData>;

export default function CipherRoomPuzzle({ displayData, attempt, onSubmit, submitting, lastResult, locked }: Props) {
  const { stages } = displayData;
  const currentStage = attempt.currentStage;
  const stageData = stages.find(s => s.stage === currentStage);

  // State per lock type
  const [dialValues, setDialValues] = useState<number[]>(Array(stageData?.dialCount ?? 4).fill(0));
  const [textAnswer, setTextAnswer] = useState('');
  const [logicMap, setLogicMap] = useState<Record<string, { role: string; floor: string }>>({});

  const adjustDial = (idx: number, delta: number) => {
    setDialValues(prev => {
      const next = [...prev];
      next[idx] = ((next[idx] + delta + 10) % 10);
      return next;
    });
  };

  const handleSubmitDial = async () => {
    await onSubmit({ dialValues: dialValues.map(Number) });
  };

  const handleSubmitLogic = async () => {
    const mapped: Record<string, { role: string; floor: number }> = {};
    for (const [agent, val] of Object.entries(logicMap)) {
      mapped[agent] = { role: val.role, floor: Number(val.floor) };
    }
    await onSubmit({ logicMap: mapped });
  };

  const handleSubmitText = async () => {
    if (!textAnswer.trim()) return;
    await onSubmit({ answer: textAnswer.trim().toUpperCase() });
    setTextAnswer('');
  };

  if (!stageData) return null;

  return (
    <div className="space-y-5">
      <p className="text-gray-300 text-sm leading-relaxed">{displayData.instructions}</p>

      {/* Lock progress */}
      <div className="flex items-center gap-1.5">
        {stages.map(s => (
          <div key={s.stage} className="flex-1 flex flex-col items-center gap-1">
            <div className={`
              w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all
              ${s.stage < currentStage ? 'bg-emerald-900 border-emerald-500 text-emerald-300' :
                s.stage === currentStage ? 'bg-danger-900 border-danger-500 text-danger-300 animate-pulse' :
                  'bg-arena-800 border-arena-700 text-gray-600'}
            `}>
              {s.stage < currentStage ? '🔓' : '🔒'}
            </div>
            <span className="text-[9px] text-gray-600 uppercase tracking-wider">L{s.stage}</span>
          </div>
        ))}
      </div>

      {/* Completed locks */}
      {attempt.stageHistory.map(sh => (
        <div key={sh.stage} className="bg-emerald-900/20 border border-emerald-800 rounded-lg px-4 py-2 flex items-center gap-2">
          <span className="text-emerald-400 text-lg">🔓</span>
          <p className="text-emerald-400 text-sm font-semibold font-mono">{stages.find(s => s.stage === sh.stage)?.title ?? `LOCK ${sh.stage}`} — OPENED</p>
        </div>
      ))}

      {/* Active lock */}
      {!locked && (
        <div className="arena-card cyber-border-active p-6 space-y-5">
          <div>
            <p className="text-danger-400 text-xs font-mono uppercase tracking-widest mb-1">ACTIVE</p>
            <h3 className="text-white text-xl font-bold">{stageData.title}</h3>
            <p className="text-gray-400 text-sm mt-1 leading-relaxed">{stageData.instructions}</p>
          </div>

          {/* ── DIAL LOCK ── */}
          {stageData.type === 'DIAL' && stageData.dialCount && (
            <div className="space-y-4">
              {stageData.clues && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Clues</p>
                  {stageData.clues.map((clue, i) => (
                    <div key={i} className="bg-arena-900 border border-arena-700 rounded px-4 py-2 flex gap-2">
                      <span className="text-amber-500 font-mono text-xs shrink-0">[{i + 1}]</span>
                      <p className="text-white text-sm font-mono">{clue}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Dials — tap +/- to adjust</p>
                <div className="flex gap-3 justify-center flex-wrap">
                  {dialValues.map((val, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <button onClick={() => adjustDial(i, 1)} disabled={submitting} className="w-10 h-8 bg-arena-700 hover:bg-arena-600 rounded text-white font-bold text-lg touch-manipulation active:scale-95">+</button>
                      <div className="w-14 h-14 bg-arena-900 border-2 border-cyber-600 rounded-xl flex items-center justify-center text-3xl font-mono font-bold text-cyber-300 shadow-[0_0_10px_rgba(0,102,102,0.4)]">
                        {val}
                      </div>
                      <button onClick={() => adjustDial(i, -1)} disabled={submitting} className="w-10 h-8 bg-arena-700 hover:bg-arena-600 rounded text-white font-bold text-lg touch-manipulation active:scale-95">−</button>
                      <span className="text-[10px] text-gray-600 font-mono">D{i + 1}</span>
                    </div>
                  ))}
                </div>
                <p className="text-center text-cyber-500 font-mono text-sm tracking-widest">{dialValues.join(' ')}</p>
              </div>
              {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded-lg px-4 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
              <button onClick={handleSubmitDial} disabled={submitting} className="btn-primary w-full py-4">
                {submitting ? '…' : '🔐 SUBMIT COMBINATION'}
              </button>
            </div>
          )}

          {/* ── CIPHER LOCK ── */}
          {stageData.type === 'CIPHER' && (
            <div className="space-y-4">
              <div className="bg-arena-900 border border-arena-700 rounded-lg p-4 space-y-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Encoded Word</p>
                <p className="text-cyber-300 font-mono text-3xl tracking-widest text-center">{stageData.encodedWord}</p>
              </div>
              {stageData.partialKey && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Partial Cipher Key</p>
                  <div className="flex flex-wrap gap-2">
                    {stageData.partialKey.map(({ encoded, plain }) => (
                      <div key={encoded} className="bg-arena-900 border border-amber-800 rounded-lg px-3 py-2 text-center">
                        <p className="text-cyber-400 font-mono text-sm">{encoded}</p>
                        <p className="text-amber-400 font-mono text-xs">↓ {plain}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <input type="text" value={textAnswer} onChange={e => setTextAnswer(e.target.value)}
                disabled={submitting} maxLength={stageData.wordLength ?? 10}
                onPaste={e => e.preventDefault()} onKeyDown={e => { if (e.key === 'Enter') handleSubmitText(); }}
                className="arena-input text-center text-2xl font-mono uppercase tracking-widest"
                placeholder={'?'.repeat(stageData.wordLength ?? 5)} />
              {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded-lg px-4 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
              <button onClick={handleSubmitText} disabled={submitting || !textAnswer.trim()} className="btn-primary w-full py-4">
                {submitting ? '…' : '🔐 SUBMIT DECODED WORD'}
              </button>
            </div>
          )}

          {/* ── LOGIC GRID LOCK ── */}
          {stageData.type === 'LOGIC_GRID' && stageData.agents && (
            <div className="space-y-4">
              {stageData.clues && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Intel Clues</p>
                  {stageData.clues.map((clue, i) => (
                    <div key={i} className="bg-arena-900 border border-arena-700 rounded px-4 py-2 flex gap-2">
                      <span className="text-cyber-500 font-mono text-xs shrink-0 mt-0.5">[{i + 1}]</span>
                      <p className="text-white text-sm">{clue}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-arena-700">
                    <th className="text-left text-xs text-gray-500 uppercase px-3 py-2">Agent</th>
                    <th className="text-left text-xs text-gray-500 uppercase px-3 py-2">Role</th>
                    <th className="text-left text-xs text-gray-500 uppercase px-3 py-2">Floor</th>
                  </tr></thead>
                  <tbody>
                    {stageData.agents.map(agent => (
                      <tr key={agent} className="border-b border-arena-800">
                        <td className="px-3 py-2 text-cyber-400 font-mono font-bold">{agent}</td>
                        <td className="px-3 py-2">
                          <select value={logicMap[agent]?.role ?? ''} onChange={e => setLogicMap(p => ({ ...p, [agent]: { ...p[agent], role: e.target.value } }))}
                            className="bg-arena-800 border border-arena-600 text-white text-sm px-2 py-1 rounded">
                            <option value="">Select…</option>
                            {stageData.roles?.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select value={logicMap[agent]?.floor ?? ''} onChange={e => setLogicMap(p => ({ ...p, [agent]: { ...p[agent], floor: e.target.value } }))}
                            className="bg-arena-800 border border-arena-600 text-white text-sm px-2 py-1 rounded">
                            <option value="">Select…</option>
                            {stageData.floors?.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded-lg px-4 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
              <button onClick={handleSubmitLogic}
                disabled={submitting || !stageData.agents?.every(a => logicMap[a]?.role && logicMap[a]?.floor)}
                className="btn-primary w-full py-4">
                {submitting ? '…' : '🔐 SUBMIT DEDUCTIONS'}
              </button>
            </div>
          )}

          {/* ── FINAL LOCK ── */}
          {stageData.type === 'FINAL' && (
            <div className="space-y-4">
              {stageData.hint && (
                <div className="bg-amber-900/20 border border-amber-800 rounded-lg px-4 py-3">
                  <p className="text-amber-300 text-sm"><span className="font-bold">Hint: </span>{stageData.hint}</p>
                </div>
              )}
              <input type="text" value={textAnswer} onChange={e => setTextAnswer(e.target.value)}
                disabled={submitting} maxLength={stageData.codeLength ?? 6}
                onPaste={e => e.preventDefault()} onKeyDown={e => { if (e.key === 'Enter') handleSubmitText(); }}
                className="arena-input text-center text-3xl font-mono uppercase tracking-widest"
                placeholder={stageData.codeLength ? '·'.repeat(stageData.codeLength) : '···'} />
              {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded-lg px-4 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
              <button onClick={handleSubmitText} disabled={submitting || !textAnswer.trim()} className="btn-primary w-full py-4 text-base">
                {submitting ? '…' : '🔐 ENTER MASTER CODE'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
