/**
 * DAY 6 — THE BLACK VAULT
 * 5 connected stages. Each produces a KEY shown on a "key ring" for later stages.
 * Stage 1: Sequence → KEY A
 * Stage 2: Pattern/symbol → KEY B  
 * Stage 3: Color memory → KEY C
 * Stage 4: Logic deduction → KEY D
 * Stage 5: Master code from all 4 keys
 */
import { useState, useEffect, useCallback } from 'react';
import { PuzzleProps } from '../../types/puzzle';

interface ColorNode { id: number; code: string; label: string }
interface StageInfo {
  stage: number; title: string; type: string; instructions: string; keyNote: string;
  // Stage 1
  items?: (string | number)[];
  // Stage 2
  examples?: Array<{ input: string; output: string }>; testSymbol?: string; symbolPool?: string[];
  // Stage 3
  colorGrid?: ColorNode[]; revealSec?: number; targetNodeId?: number; colorCodes?: string[];
  // Stage 4
  agents?: string[]; clues?: string[];
  // Stage 5
  symbolPool2?: string[]; colorList?: string[]; agentList?: string[];
}
interface DisplayData { totalStages: number; stages: StageInfo[]; instructions: string }
type Props = PuzzleProps<DisplayData>;

const KEY_COLORS = ['text-cyber-400', 'text-amber-400', 'text-purple-400', 'text-emerald-400'];

export default function BlackVaultPuzzle({ displayData, attempt, onSubmit, submitting, lastResult, locked }: Props) {
  const { stages } = displayData;
  const currentStage = attempt.currentStage;
  const stageInfo = stages.find(s => s.stage === currentStage);

  // Collected keys from completed stages
  const collectedKeys = attempt.stageHistory.map((sh, i) => ({
    key: `KEY ${String.fromCharCode(65 + i)}`,
    stage: sh.stage,
    color: KEY_COLORS[i] ?? 'text-white',
  }));

  const [answer, setAnswer] = useState('');
  const [patternAnswer, setPatternAnswer] = useState('');
  const [memCountdown, setMemCountdown] = useState(stageInfo?.revealSec ?? 10);
  const [memHidden, setMemHidden] = useState(false);
  const [agentWinner, setAgentWinner] = useState('');

  const hideMemory = useCallback(() => setMemHidden(true), []);

  useEffect(() => {
    if (currentStage !== 3 || memHidden || locked) return;
    if (memCountdown <= 0) { hideMemory(); return; }
    const id = setTimeout(() => setMemCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [memCountdown, currentStage, memHidden, locked, hideMemory]);

  const handleSubmitAnswer = async () => {
    if (!answer.trim() || submitting || locked) return;
    await onSubmit({ answer: answer.trim().toUpperCase() });
    setAnswer('');
  };

  const handleSubmitPattern = async () => {
    if (!patternAnswer || submitting || locked) return;
    await onSubmit({ answer: patternAnswer });
    setPatternAnswer('');
  };

  const handleSubmitAgent = async () => {
    if (!agentWinner || submitting || locked) return;
    await onSubmit({ answer: agentWinner });
  };

  if (!stageInfo) return null;

  return (
    <div className="space-y-5">
      <p className="text-gray-300 text-sm leading-relaxed">{displayData.instructions}</p>

      {/* Stage progress + Key ring */}
      <div className="space-y-3">
        <div className="flex gap-1">
          {stages.map(s => (
            <div key={s.stage} className={`flex-1 h-2 rounded-full transition-colors
              ${s.stage < currentStage ? 'bg-emerald-600' : s.stage === currentStage ? 'bg-danger-500 animate-pulse' : 'bg-arena-700'}`} />
          ))}
        </div>
        {collectedKeys.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {collectedKeys.map(k => (
              <div key={k.key} className={`bg-arena-900 border border-arena-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5`}>
                <span className="text-xs text-gray-500">🔑</span>
                <span className={`text-xs font-mono font-bold ${k.color}`}>{k.key} acquired</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active stage */}
      {!locked && (
        <div className="rounded-xl border p-6 space-y-5" style={{ borderColor: '#7a0000', background: 'rgba(74,0,0,0.15)' }}>
          <div>
            <p className="text-danger-400 text-xs font-mono uppercase tracking-widest mb-1">STAGE {currentStage} / {displayData.totalStages}</p>
            <h3 className="text-white text-xl font-bold">{stageInfo.title}</h3>
            <p className="text-gray-400 text-sm mt-1 leading-relaxed">{stageInfo.instructions}</p>
          </div>

          {/* Stage 1: Sequence */}
          {stageInfo.type === 'SEQUENCE' && stageInfo.items && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {stageInfo.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`px-3 py-2 rounded-lg border font-mono font-bold text-lg
                      ${item === '?' ? 'bg-arena-700 border-cyber-700 text-cyber-300 border-dashed' : 'bg-arena-900 border-arena-600 text-white'}`}>
                      {item}
                    </div>
                    {i < stageInfo.items!.length - 1 && <span className="text-gray-600 font-bold">→</span>}
                  </div>
                ))}
              </div>
              <p className="text-amber-400 text-xs font-mono">{stageInfo.keyNote}</p>
              <input type="text" value={answer} onChange={e => setAnswer(e.target.value)} disabled={submitting}
                onPaste={e => e.preventDefault()} onKeyDown={e => { if (e.key === 'Enter') handleSubmitAnswer(); }}
                className="arena-input text-center text-2xl font-mono" placeholder="?" />
              {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded px-3 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
              <button onClick={handleSubmitAnswer} disabled={submitting || !answer.trim()} className="btn-primary w-full py-4">
                {submitting ? '…' : 'EXTRACT KEY A'}
              </button>
            </div>
          )}

          {/* Stage 2: Symbol pattern */}
          {stageInfo.type === 'PATTERN' && stageInfo.examples && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {stageInfo.examples.map((ex, i) => (
                  <div key={i} className="bg-arena-900 border border-arena-700 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-2xl">{ex.input}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-2xl">{ex.output}</span>
                  </div>
                ))}
              </div>
              <div className="bg-arena-900 border border-amber-800 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">Test symbol</p>
                <p className="text-4xl text-center">{stageInfo.testSymbol}</p>
                <p className="text-center text-gray-500 text-sm mt-1">→ ?</p>
              </div>
              <p className="text-amber-400 text-xs font-mono">{stageInfo.keyNote}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {stageInfo.symbolPool?.map(sym => (
                  <button key={sym} onClick={() => setPatternAnswer(sym)} disabled={submitting}
                    className={`w-12 h-12 text-2xl rounded-lg border-2 transition-all touch-manipulation
                      ${patternAnswer === sym ? 'bg-cyber-800 border-cyber-400 scale-110' : 'bg-arena-800 border-arena-600 hover:border-cyber-700'}`}>
                    {sym}
                  </button>
                ))}
              </div>
              {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded px-3 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
              <button onClick={handleSubmitPattern} disabled={submitting || !patternAnswer} className="btn-primary w-full py-4">
                {submitting ? '…' : 'EXTRACT KEY B'}
              </button>
            </div>
          )}

          {/* Stage 3: Color memory */}
          {stageInfo.type === 'MEMORY' && stageInfo.colorGrid && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Node color codes</p>
                {!memHidden && (
                  <span className={`font-mono font-bold text-xl ${memCountdown <= 3 ? 'text-danger-400 animate-pulse' : 'text-cyber-300'}`}>{memCountdown}s</span>
                )}
              </div>
              {!memHidden ? (
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {stageInfo.colorGrid.map(node => (
                    <div key={node.id} className="bg-arena-900 border border-arena-600 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">{node.label}</p>
                      <p className="text-white font-mono font-bold text-sm">{node.code}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-arena-900 border border-arena-700 rounded-xl p-8 text-center">
                  <p className="text-gray-600 font-mono text-sm">NODES CONCEALED</p>
                  <p className="text-gray-500 text-xs mt-1">Answer from memory</p>
                </div>
              )}
              {!memHidden && <button onClick={hideMemory} className="btn-ghost w-full text-sm py-2">Hide nodes</button>}
              {memHidden && (
                <div className="space-y-3">
                  <p className="text-amber-300 text-sm">What was Node {(stageInfo.targetNodeId ?? 0) + 1}'s color code?</p>
                  <div className="flex flex-wrap gap-2">
                    {stageInfo.colorCodes?.map(code => (
                      <button key={code} onClick={() => setAnswer(code)} disabled={submitting}
                        className={`px-4 py-2 rounded-lg border-2 font-mono text-sm transition-all touch-manipulation
                          ${answer === code ? 'bg-cyber-800 border-cyber-400 text-cyber-300' : 'bg-arena-800 border-arena-600 text-gray-400 hover:border-cyber-700'}`}>
                        {code}
                      </button>
                    ))}
                  </div>
                  <p className="text-amber-400 text-xs font-mono">{stageInfo.keyNote}</p>
                  {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded px-3 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
                  <button onClick={handleSubmitAnswer} disabled={submitting || !answer} className="btn-primary w-full py-4">
                    {submitting ? '…' : 'EXTRACT KEY C'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stage 4: Logic */}
          {stageInfo.type === 'LOGIC' && stageInfo.agents && (
            <div className="space-y-4">
              {stageInfo.clues?.map((clue, i) => (
                <div key={i} className="bg-arena-900 border border-arena-700 rounded px-4 py-2 flex gap-2">
                  <span className="text-cyber-500 font-mono text-xs shrink-0">[{i + 1}]</span>
                  <p className="text-white text-sm">{clue}</p>
                </div>
              ))}
              <p className="text-amber-400 text-xs font-mono">{stageInfo.keyNote}</p>
              <div className="flex flex-wrap gap-2">
                {stageInfo.agents.map(a => (
                  <button key={a} onClick={() => setAgentWinner(a)} disabled={submitting}
                    className={`px-4 py-2 rounded-lg border-2 font-mono text-sm transition-all touch-manipulation
                      ${agentWinner === a ? 'bg-cyber-800 border-cyber-400 text-cyber-300' : 'bg-arena-800 border-arena-600 text-gray-400 hover:border-cyber-700'}`}>
                    {a}
                  </button>
                ))}
              </div>
              {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded px-3 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
              <button onClick={handleSubmitAgent} disabled={submitting || !agentWinner} className="btn-primary w-full py-4">
                {submitting ? '…' : 'EXTRACT KEY D'}
              </button>
            </div>
          )}

          {/* Stage 5: Master unlock */}
          {stageInfo.type === 'FINAL' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {collectedKeys.map(k => (
                  <div key={k.key} className="bg-arena-900 border border-arena-700 rounded-lg p-3 text-center">
                    <p className={`font-mono font-bold text-sm ${k.color}`}>{k.key}</p>
                    <p className="text-gray-600 text-xs">obtained</p>
                  </div>
                ))}
              </div>
              <p className="text-amber-400 text-xs font-mono whitespace-pre-wrap">{stageInfo.keyNote}</p>
              <input type="text" value={answer} onChange={e => setAnswer(e.target.value)} disabled={submitting}
                onPaste={e => e.preventDefault()} onKeyDown={e => { if (e.key === 'Enter') handleSubmitAnswer(); }}
                className="arena-input text-center text-2xl font-mono tracking-widest"
                placeholder="Master code…" />
              {lastResult && !lastResult.isCorrect && <div className="bg-danger-900/30 border border-danger-700 rounded px-3 py-2"><p className="text-danger-300 text-sm">{lastResult.feedback}</p></div>}
              <button onClick={handleSubmitAnswer} disabled={submitting || !answer.trim()} className="btn-danger w-full py-4 text-base">
                {submitting ? '…' : '💀 OPEN THE BLACK VAULT'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
