/**
 * DAY 3 — THE MEMORY VAULT
 * Stage 1: Observe room of positioned objects (timed).
 * Stage 2: Answer position recall questions (click from pool).
 * Stage 3: Answer relational questions (click from pool).
 * Stage 4: (via auto in stage3 completion) Identify changed object.
 */
import { useState, useEffect, useCallback } from 'react';
import { PuzzleProps } from '../../types/puzzle';

interface RoomObject { id: number; symbol: string; color: string; position: string; posLabel: string }
interface S1Question { id: number; question: string; position: string }
interface S2Question { id: number; question: string }
interface DisplayData {
  roomObjects: RoomObject[];
  revealSec: number;
  instructions: string;
  stage1: { instructions: string; questions: S1Question[]; symbolPool: string[] };
  stage2: { instructions: string; questions: S2Question[]; symbolPool: string[] };
  stage3: { instructions: string; alteredRoom: RoomObject[]; symbolPool: string[] };
  gridPositions: string[];
}

type Props = PuzzleProps<DisplayData>;

const COLOR_CLASSES: Record<string, string> = {
  red: 'border-red-500 text-red-300 bg-red-900/30',
  blue: 'border-blue-500 text-blue-300 bg-blue-900/30',
  gold: 'border-yellow-500 text-yellow-300 bg-yellow-900/30',
  purple: 'border-purple-500 text-purple-300 bg-purple-900/30',
  teal: 'border-teal-500 text-teal-300 bg-teal-900/30',
  orange: 'border-orange-500 text-orange-300 bg-orange-900/30',
};

export default function MemoryVaultPuzzle({ displayData, attempt, onSubmit, submitting, lastResult, locked }: Props) {
  const { roomObjects, revealSec, instructions, stage1, stage2, stage3 } = displayData;
  const currentStage = attempt.currentStage;

  // Stage 1: countdown
  const [countdown, setCountdown] = useState(revealSec);
  const [roomHidden, setRoomHidden] = useState(false);
  const [stageAnswers, setStageAnswers] = useState<Record<string, string>>({});

  const hideRoom = useCallback(() => {
    setRoomHidden(true);
    if (currentStage === 1) onSubmit({ memorised: true });
  }, [currentStage, onSubmit]);

  useEffect(() => {
    if (currentStage !== 1 || locked || roomHidden) return;
    if (countdown <= 0) { hideRoom(); return; }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, currentStage, locked, roomHidden, hideRoom]);

  const selectAnswer = (key: string, sym: string) => {
    if (locked || submitting) return;
    setStageAnswers(prev => ({ ...prev, [key]: sym }));
  };

  const handleSubmitStage = async () => {
    if (submitting || locked) return;
    if (currentStage === 2) {
      await onSubmit({ answers: stageAnswers });
    } else if (currentStage === 3) {
      await onSubmit({ answers: stageAnswers });
    }
    setStageAnswers({});
  };

  const currentQuestions = currentStage === 2 ? stage1.questions : stage2.questions;
  const currentInstr = currentStage === 2 ? stage1.instructions : stage2.instructions;
  const symbolPool = currentStage === 2 ? stage1.symbolPool : stage2.symbolPool;
  const allAnswered = currentQuestions.every(q => stageAnswers[`s${currentStage - 1}_${q.id}`]);

  // Render the room grid (3×3)
  const renderRoom = (objects: RoomObject[], showColors = true) => (
    <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
      {objects.map(obj => (
        <div
          key={obj.id}
          className={`
            aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1
            ${showColors ? (COLOR_CLASSES[obj.color] ?? 'border-arena-600 bg-arena-800') : 'border-arena-600 bg-arena-800'}
          `}
        >
          <span className="text-3xl">{obj.symbol}</span>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider text-center leading-tight px-1">
            {obj.posLabel}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <p className="text-gray-300 text-sm leading-relaxed">{instructions}</p>

      {/* Stage progress */}
      <div className="flex gap-1.5">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors
            ${s < currentStage ? 'bg-emerald-600' : s === currentStage ? 'bg-cyber-500 animate-pulse' : 'bg-arena-700'}`} />
        ))}
      </div>

      {/* ── Stage 1: Memorise ── */}
      {currentStage === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-cyber-400 text-xs uppercase tracking-widest font-semibold">Stage 1 — Observe the Room</p>
            <span className={`font-mono font-bold text-2xl transition-colors ${countdown <= 5 ? 'text-danger-400 animate-pulse' : 'text-cyber-300'}`}>
              {countdown}s
            </span>
          </div>
          {!roomHidden ? renderRoom(roomObjects) : (
            <div className="max-w-xs mx-auto aspect-video bg-arena-900 border border-arena-700 rounded-xl flex items-center justify-center">
              <p className="text-gray-600 font-mono text-sm">ROOM CONCEALED</p>
            </div>
          )}
          {!roomHidden && (
            <button onClick={hideRoom} className="btn-ghost w-full text-sm py-2">
              I've memorised it — hide the room
            </button>
          )}
        </div>
      )}

      {/* ── Stage 2: Position recall ── */}
      {currentStage === 2 && (
        <div className="space-y-5">
          <p className="text-amber-400 text-xs uppercase tracking-widest font-semibold">Stage 2 — Position Recall</p>
          <p className="text-gray-400 text-sm">{currentInstr}</p>
          <div className="space-y-4">
            {currentQuestions.map(q => {
              const key = `s1_${q.id}`;
              return (
                <div key={q.id} className="arena-card p-4 space-y-3">
                  <p className="text-white text-sm font-semibold">{(q as S1Question).question}</p>
                  <div className="flex flex-wrap gap-2">
                    {symbolPool.map(sym => (
                      <button
                        key={sym}
                        onClick={() => selectAnswer(key, sym)}
                        disabled={locked || submitting}
                        className={`w-12 h-12 text-2xl rounded-lg border-2 transition-all touch-manipulation
                          ${stageAnswers[key] === sym ? 'bg-cyber-800 border-cyber-400 scale-110 shadow-[0_0_8px_rgba(0,179,179,0.4)]' : 'bg-arena-800 border-arena-600 hover:border-cyber-700'}`}
                      >{sym}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {lastResult && !lastResult.isCorrect && (
            <div className="bg-danger-900/30 border border-danger-700 rounded-lg px-4 py-2">
              <p className="text-danger-300 text-sm">{lastResult.feedback}</p>
            </div>
          )}
          {!locked && (
            <button onClick={handleSubmitStage} disabled={submitting || !allAnswered} className="btn-primary w-full py-4">
              {submitting ? 'Checking…' : 'SUBMIT RECALL'}
            </button>
          )}
        </div>
      )}

      {/* ── Stage 3: Relational + changed object ── */}
      {currentStage === 3 && (
        <div className="space-y-5">
          <p className="text-amber-400 text-xs uppercase tracking-widest font-semibold">Stage 3 — Identify the Change</p>
          <p className="text-gray-400 text-sm">{stage3.instructions}</p>

          {/* Show the altered room */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Current Room State (one object changed)</p>
            {renderRoom(stage3.alteredRoom)}
          </div>

          <div className="arena-card p-4 space-y-3">
            <p className="text-white text-sm font-semibold">Which object changed color?</p>
            <div className="flex flex-wrap gap-2">
              {stage3.symbolPool.map(sym => (
                <button
                  key={sym}
                  onClick={() => selectAnswer('s3_1', sym)}
                  disabled={locked || submitting}
                  className={`w-12 h-12 text-2xl rounded-lg border-2 transition-all touch-manipulation
                    ${stageAnswers['s3_1'] === sym ? 'bg-cyber-800 border-cyber-400 scale-110 shadow-[0_0_8px_rgba(0,179,179,0.4)]' : 'bg-arena-800 border-arena-600 hover:border-cyber-700'}`}
                >{sym}</button>
              ))}
            </div>
          </div>

          {lastResult && !lastResult.isCorrect && (
            <div className="bg-danger-900/30 border border-danger-700 rounded-lg px-4 py-2">
              <p className="text-danger-300 text-sm">{lastResult.feedback}</p>
            </div>
          )}
          {!locked && (
            <button onClick={async () => {
              if (submitting || locked || !stageAnswers['s3_1']) return;
              await onSubmit({ answer: stageAnswers['s3_1'] });
            }} disabled={submitting || !stageAnswers['s3_1']} className="btn-primary w-full py-4">
              {submitting ? 'Checking…' : 'SUBMIT IDENTIFICATION'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
