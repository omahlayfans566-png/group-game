/**
 * DAY 7 — THE FINAL VAULT (Championship)
 * 5 stages: Visual Grid → Dual Pattern → Logic Grid → Cipher → Master Unlock
 * Gold championship UI theme. Cross-stage key ring visible throughout.
 */
import { useState, useEffect, useCallback } from 'react';
import { PuzzleProps } from '../../types/puzzle';

interface StageInfo {
  stage: number; title: string; type: string; instructions: string;
  grid?: string[][]; revealSec?: number; questions?: Array<{ id: number; label: string }>; symbolPool?: string[];
  examples?: Array<{ input: { sym: string; pos: number }; output: { sym: string; pos: number } }>;
  testInput?: { sym: string; pos: number }; patternPool?: string[]; posLabels?: string[];
  agents?: string[]; roles?: string[]; codes?: number[]; clues?: string[];
  encodedWord?: string; hints?: Array<{ plain: string; encoded: string }>; wordLength?: number;
  symbolPool2?: string[];
}
interface DisplayData { totalStages: number; stages: StageInfo[]; instructions: string; isFinal: boolean }
type Props = PuzzleProps<DisplayData>;

const STAGE_COLORS = [
  'border-cyber-600',
  'border-amber-600',
  'border-purple-600',
  'border-orange-600',
  'border-gold-500',
];

export default function FinalVaultPuzzle({ displayData, attempt, onSubmit, submitting, lastResult, locked }: Props) {
  const { stages } = displayData;
  const currentStage = attempt.currentStage;
  const stageInfo = stages.find(s => s.stage === currentStage);

  const [gridAnswers, setGridAnswers] = useState<Record<string, string>>({});
  const [patSym, setPatSym] = useState('');
  const [patPos, setPatPos] = useState('');
  const [logicMap, setLogicMap] = useState<Record<string, { role: string; code: string }>>({});
  const [cipherAnswer, setCipherAnswer] = useState('');
  const [masterCode, setMasterCode] = useState('');
  const [revealCount, setRevealCount] = useState(stageInfo?.revealSec ?? 12);
  const [gridHidden, setGridHidden] = useState(false);

  const hideGrid = useCallback(() => setGridHidden(true), []);

  useEffect(() => {
    if (currentStage !== 1 || gridHidden || locked) return;
    if (revealCount <= 0) { hideGrid(); return; }
    const id = setTimeout(() => setRevealCount(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [revealCount, currentStage, gridHidden, locked, hideGrid]);

  const stageHistory = attempt.stageHistory;
  const STAGE_KEY_NAMES = ['VISUAL KEY', 'PATTERN KEY', 'LOGIC KEY', 'CIPHER KEY'];

  if (!stageInfo) return null;

  return (
    <div className="space-y-5">
      {/* Championship banner */}
      <div className="text-center py-3 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(201,146,10,0.15) 0%, rgba(0,0,0,0) 50%, rgba(201,146,10,0.15) 100%)', borderColor: '#c9920a', border: '1px solid' }}>
        <p className="text-gold-400 font-bold tracking-[0.3em] text-sm uppercase">⚔ CHAMPIONSHIP FINAL ⚔</p>
      </div>

      <p className="text-gray-300 text-sm leading-relaxed">{displayData.instructions}</p>

      {/* 5-stage progress */}
      <div className="space-y-2">
        <div className="flex gap-1">
          {stages.map(s => (
            <div key={s.stage} className={`flex-1 h-2 rounded-full transition-colors
              ${s.stage < currentStage ? 'bg-gold-500' : s.stage === currentStage ? 'bg-cyber-400 animate-pulse' : 'bg-arena-700'}`} />
          ))}
        </div>
        <p className="text-center text-xs text-gray-600 font-mono">Stage {currentStage} of {displayData.totalStages}</p>
      </div>

      {/* Key ring */}
      {stageHistory.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stageHistory.map((sh, i) => (
            <div key={sh.stage} className="bg-arena-900 border border-gold-700/50 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <span className="text-gold-400 text-xs">🔑</span>
              <span className="text-gold-400 text-xs font-mono font-bold">{STAGE_KEY_NAMES[i] ?? `STAGE ${sh.stage}`}</span>
            </div>
          ))}
        </div>
      )}

      {/* Completed stages */}
      {stageHistory.map((sh) => (
        <div key={sh.stage} className="bg-gold-600/10 border border-gold-700/40 rounded-lg px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gold-400">✓</span>
            <p className="text-gold-400 text-sm">{stages.find(s => s.stage === sh.stage)?.title}</p>
          </div>
          <span className="text-gold-600 text-xs font-mono">{sh.score}pts</span>
        </div>
      ))}

      {/* Active stage */}
      {!locked && (
        <div className={`rounded-xl border-2 p-6 space-y-5 ${STAGE_COLORS[(currentStage - 1) % STAGE_COLORS.length]}`}
          style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div>
            <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-1">Stage {currentStage}</p>
            <h3 className="text-white text-xl font-bold">{stageInfo.title}</h3>
            <p className="text-gray-300 text-sm mt-1 leading-relaxed">{stageInfo.instructions}</p>
          </div>

          {/* ── Stage 1: Visual Grid ── */}
          {stageInfo.type === 'VISUAL_GRID' && stageInfo.grid && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Memorise the {stageInfo.grid.length}×{stageInfo.grid[0]?.length} grid</p>
                {!gridHidden && <span className={`font-mono font-bold text-xl ${revealCount <= 3 ? 'text-danger-400 animate-pulse' : 'text-cyber-300'}`}>{revealCount}s</span>}
              </div>
              {!gridHidden ? (
                <div className="grid gap-1 mx-auto"
                  style={{ gridTemplateColumns: `repeat(${stageInfo.grid[0]?.length ?? 4}, minmax(0,1fr))`, maxWidth: (stageInfo.grid[0]?.length ?? 4) * 44 }}>
                  {stageInfo.grid.flat().map((cell, i) => (
                    <div key={i} className="w-10 h-10 bg-arena-800 border border-arena-600 rounded flex items-center justify-center text-xl select-none">{cell}</div>
                  ))}
                </div>
              ) : (
                <div className="bg-arena-900 border border-arena-700 rounded-xl p-8 text-center">
                  <p className="text-gray-600 font-mono text-sm">GRID CONCEALED — Answer from memory</p>
                </div>
              )}
              {!gridHidden && <button onClick={hideGrid} className="btn-ghost w-full text-sm py-2">Hide grid</button>}
              {gridHidden && (
                <div className="space-y-4">
                  {stageInfo.questions?.map(q => (
                    <div key={q.id} className="arena-card p-4 space-y-2">
                      <p className="text-white text-sm font-semibold">Position {q.id}: {q.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {stageInfo.symbolPool?.map(sym => (
                          <button key={sym} onClick={() => setGridAnswers(p => ({ ...p, [`q${q.id}`]: sym }))} disabled={submitting}
                            className={`w-10 h-10 text-xl rounded-lg border-2 transition-all touch-manipulation
                              ${gridAnswers[`q${q.id}`] === sym ? 'bg-cyber-800 border-cyber-400 scale-110' : 'bg-arena-800 border-arena-600 hover:border-cyber-700'}`}>
                            {sym}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded px-3 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
                  <button onClick={async () => {
                    if (!stageInfo.questions?.every(q => gridAnswers[`q${q.id}`])) return;
                    const answers: Record<string, string> = {};
                    stageInfo.questions?.forEach(q => { answers[`q${q.id}`] = gridAnswers[`q${q.id}`]; });
                    await onSubmit({ answers });
                  }} disabled={submitting || !stageInfo.questions?.every(q => gridAnswers[`q${q.id}`])} className="btn-primary w-full py-4">
                    {submitting ? '…' : 'SUBMIT — OBTAIN VISUAL KEY'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Stage 2: Dual Pattern ── */}
          {stageInfo.type === 'DUAL_PATTERN' && stageInfo.examples && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Transformation examples (2 rules)</p>
                {stageInfo.examples.map((ex, i) => (
                  <div key={i} className="bg-arena-900 border border-arena-700 rounded-lg p-3 flex items-center justify-between">
                    <div className="text-center">
                      <p className="text-2xl">{ex.input.sym}</p>
                      <p className="text-[10px] text-gray-500">{stageInfo.posLabels?.[ex.input.pos] ?? ex.input.pos}</p>
                    </div>
                    <span className="text-gray-500">→</span>
                    <div className="text-center">
                      <p className="text-2xl">{ex.output.sym}</p>
                      <p className="text-[10px] text-gray-500">{stageInfo.posLabels?.[ex.output.pos] ?? ex.output.pos}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-arena-900 border border-amber-800 rounded-lg p-4 text-center space-y-2">
                <p className="text-xs text-gray-500">Test Input</p>
                <p className="text-4xl">{stageInfo.testInput?.sym}</p>
                <p className="text-amber-400 text-sm">{stageInfo.posLabels?.[stageInfo.testInput?.pos ?? 0]}</p>
                <p className="text-gray-500">→ ?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Output Symbol</p>
                  <div className="flex flex-wrap gap-2">
                    {stageInfo.patternPool?.map(sym => (
                      <button key={sym} onClick={() => setPatSym(sym)} disabled={submitting}
                        className={`w-11 h-11 text-2xl rounded-lg border-2 transition-all touch-manipulation
                          ${patSym === sym ? 'bg-cyber-800 border-cyber-400 scale-110' : 'bg-arena-800 border-arena-600 hover:border-cyber-700'}`}>{sym}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Output Position</p>
                  <div className="flex flex-col gap-2">
                    {stageInfo.posLabels?.map((pos, i) => (
                      <button key={i} onClick={() => setPatPos(String(i))} disabled={submitting}
                        className={`px-3 py-2 rounded-lg border-2 text-sm font-mono transition-all touch-manipulation
                          ${patPos === String(i) ? 'bg-cyber-800 border-cyber-400 text-cyber-300' : 'bg-arena-800 border-arena-600 text-gray-400 hover:border-cyber-700'}`}>
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded px-3 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
              <button onClick={async () => {
                if (!patSym || !patPos) return;
                await onSubmit({ symbol: patSym, position: patPos });
              }} disabled={submitting || !patSym || !patPos} className="btn-primary w-full py-4">
                {submitting ? '…' : 'SUBMIT — OBTAIN PATTERN KEY'}
              </button>
            </div>
          )}

          {/* ── Stage 3: Logic Grid ── */}
          {stageInfo.type === 'LOGIC_GRID_4' && stageInfo.agents && (
            <div className="space-y-4">
              {stageInfo.clues?.map((clue, i) => (
                <div key={i} className="bg-arena-900 border border-arena-700 rounded px-4 py-2 flex gap-2">
                  <span className="text-cyber-500 font-mono text-xs shrink-0">[{i + 1}]</span>
                  <p className="text-white text-sm">{clue}</p>
                </div>
              ))}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-arena-700">
                    <th className="text-left text-xs text-gray-500 uppercase px-3 py-2">Agent</th>
                    <th className="text-left text-xs text-gray-500 uppercase px-3 py-2">Role</th>
                    <th className="text-left text-xs text-gray-500 uppercase px-3 py-2">Code</th>
                  </tr></thead>
                  <tbody>
                    {stageInfo.agents.map(a => (
                      <tr key={a} className="border-b border-arena-800">
                        <td className="px-3 py-2 text-cyber-400 font-mono font-bold text-xs">{a}</td>
                        <td className="px-3 py-2">
                          <select value={logicMap[a]?.role ?? ''} onChange={e => setLogicMap(p => ({ ...p, [a]: { ...p[a], role: e.target.value } }))}
                            className="bg-arena-800 border border-arena-600 text-white text-sm px-2 py-1 rounded w-full">
                            <option value="">Select…</option>
                            {stageInfo.roles?.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select value={logicMap[a]?.code ?? ''} onChange={e => setLogicMap(p => ({ ...p, [a]: { ...p[a], code: e.target.value } }))}
                            className="bg-arena-800 border border-arena-600 text-white text-sm px-2 py-1 rounded w-full">
                            <option value="">Select…</option>
                            {stageInfo.codes?.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded px-3 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
              <button onClick={async () => {
                const map: Record<string, { role: string; code: number }> = {};
                for (const [a, v] of Object.entries(logicMap)) map[a] = { role: v.role, code: Number(v.code) };
                await onSubmit({ logicMap: map });
              }}
                disabled={submitting || !stageInfo.agents?.every(a => logicMap[a]?.role && logicMap[a]?.code)}
                className="btn-primary w-full py-4">
                {submitting ? '…' : 'SUBMIT — OBTAIN LOGIC KEY'}
              </button>
            </div>
          )}

          {/* ── Stage 4: Cipher ── */}
          {stageInfo.type === 'CIPHER' && (
            <div className="space-y-4">
              <div className="bg-arena-900 border border-arena-700 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Encoded Word</p>
                <p className="text-cyber-300 font-mono text-3xl tracking-widest text-center">{stageInfo.encodedWord}</p>
              </div>
              {stageInfo.hints && (
                <div className="flex flex-wrap gap-2">
                  {stageInfo.hints.map(h => (
                    <div key={h.plain} className="bg-arena-900 border border-amber-800 rounded-lg px-3 py-2 text-center">
                      <p className="text-cyber-400 font-mono text-sm">{h.encoded}</p>
                      <p className="text-amber-400 font-mono text-xs">↓ {h.plain}</p>
                    </div>
                  ))}
                </div>
              )}
              <input type="text" value={cipherAnswer} onChange={e => setCipherAnswer(e.target.value)} disabled={submitting}
                onPaste={e => e.preventDefault()} onKeyDown={e => { if (e.key === 'Enter') { onSubmit({ answer: cipherAnswer.trim().toUpperCase() }); } }}
                className="arena-input text-center text-2xl font-mono uppercase tracking-widest"
                placeholder={'?'.repeat(stageInfo.wordLength ?? 6)} maxLength={stageInfo.wordLength ?? 10} />
              {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded px-3 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
              <button onClick={async () => { await onSubmit({ answer: cipherAnswer.trim().toUpperCase() }); }}
                disabled={submitting || !cipherAnswer.trim()} className="btn-primary w-full py-4">
                {submitting ? '…' : 'SUBMIT — OBTAIN CIPHER KEY'}
              </button>
            </div>
          )}

          {/* ── Stage 5: Master Unlock ── */}
          {stageInfo.type === 'MASTER_UNLOCK' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {stageHistory.map((sh, i) => (
                  <div key={sh.stage} className="bg-arena-900 border border-gold-700/50 rounded-lg p-3 text-center">
                    <p className="text-gold-400 font-mono font-bold text-xs">{STAGE_KEY_NAMES[i]}</p>
                    <p className="text-gray-500 text-xs">obtained</p>
                  </div>
                ))}
              </div>
              <div className="bg-danger-900/20 border border-danger-700 rounded-xl px-5 py-4">
                <p className="text-danger-300 font-bold text-sm">🏆 FINAL UNLOCK</p>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed whitespace-pre-wrap">{stageInfo.instructions}</p>
              </div>
              <input type="text" value={masterCode} onChange={e => setMasterCode(e.target.value)} disabled={submitting}
                onPaste={e => e.preventDefault()}
                className="arena-input text-center text-2xl font-mono uppercase tracking-widest"
                placeholder="MASTER CODE" />
              {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded px-3 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
              <button onClick={async () => { await onSubmit({ answer: masterCode.trim().toUpperCase() }); }}
                disabled={submitting || !masterCode.trim()}
                className="w-full py-5 rounded-xl font-bold text-base tracking-widest transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #7a2e00, #c9920a)', color: 'white', border: '1px solid #c9920a' }}>
                {submitting ? '…' : '⚔ CLAIM VICTORY'}
              </button>
            </div>
          )}
        </div>
      )}

      {locked && (
        <div className="rounded-xl p-10 text-center space-y-3" style={{ border: '1px solid rgba(201,146,10,0.3)', background: 'rgba(201,146,10,0.05)' }}>
          <p className="text-gold-400 font-bold text-xl tracking-widest">
            {attempt.status === 'COMPLETED' ? '⚔ FINAL VAULT COMPLETE' : 'CHALLENGE LOCKED'}
          </p>
          <p className="text-gray-500 text-sm">Return to the group for the official result.</p>
        </div>
      )}
    </div>
  );
}
