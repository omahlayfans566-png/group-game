import { useState } from 'react';
import { PuzzleProps, MultiStageDisplayData } from '../../types/puzzle';

type Props = PuzzleProps<MultiStageDisplayData>;

export default function MultiStagePuzzle({ displayData, attempt, onSubmit, submitting, lastResult, locked }: Props) {
  const { stages, instructions } = displayData;
  const currentStage = attempt.currentStage;
  const stage = stages.find(s => s.stage === currentStage);

  const [answer, setAnswer] = useState('');

  const handleSubmit = async () => {
    if (!answer.trim() || submitting || locked) return;
    await onSubmit({ answer: answer.trim() });
    setAnswer('');
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-300 text-sm leading-relaxed">{instructions}</p>

      {/* Stage progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-500 uppercase tracking-wider">
          <span>Stage Progress</span>
          <span>{currentStage - 1} / {attempt.totalStages} complete</span>
        </div>
        <div className="flex gap-1.5">
          {stages.map(s => (
            <div
              key={s.stage}
              className={`flex-1 h-2 rounded-full transition-colors ${
                s.stage < currentStage ? 'bg-emerald-600' :
                s.stage === currentStage ? 'bg-cyber-500 animate-pulse' :
                'bg-arena-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Completed stages */}
      {attempt.stageHistory.map(sh => {
        const stageInfo = stages.find(s => s.stage === sh.stage);
        return (
          <div key={sh.stage} className="bg-emerald-900/20 border border-emerald-800 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-emerald-400 text-lg">✓</span>
            <div>
              <p className="text-emerald-400 text-sm font-semibold">
                {stageInfo?.title ?? `Stage ${sh.stage}`} — Complete
              </p>
              <p className="text-gray-500 text-xs">Score: {sh.score}</p>
            </div>
          </div>
        );
      })}

      {/* Active stage */}
      {stage && !locked && (
        <div className="arena-card cyber-border-active p-6 space-y-5">
          <div>
            <p className="text-xs text-cyber-400 uppercase tracking-[0.2em] font-semibold mb-1">
              Stage {stage.stage} of {attempt.totalStages}
            </p>
            <h3 className="text-white text-xl font-bold">{stage.title}</h3>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">{stage.instructions}</p>
          </div>

          {/* Sequence items */}
          {stage.items && (
            <div className="flex flex-wrap items-center gap-2">
              {stage.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-14 h-12 bg-arena-900 border border-arena-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-mono font-bold">{item}</span>
                  </div>
                  {i < stage.items!.length - 1 && <span className="text-gray-600 font-bold">→</span>}
                </div>
              ))}
            </div>
          )}

          {/* Clues */}
          {stage.clues && (
            <div className="space-y-2">
              {stage.clues.map((clue, i) => (
                <div key={i} className="bg-arena-900 border border-arena-700 rounded px-4 py-2">
                  <p className="text-white font-mono text-sm">{clue}</p>
                </div>
              ))}
            </div>
          )}

          {/* Answer input */}
          <div className="space-y-3">
            <label className="block text-xs uppercase tracking-widest text-gray-400">
              Your Answer for Stage {stage.stage}
            </label>
            <input
              type={stage.type === 'SEQUENCE' || stage.type === 'CODE_BREAK' || stage.type === 'FINAL' ? 'text' : 'text'}
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              disabled={submitting || locked}
              placeholder="Enter your answer…"
              onPaste={e => e.preventDefault()}
              className="arena-input text-center text-xl font-mono w-full"
              maxLength={10}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>

          {lastResult && !lastResult.isCorrect && (
            <div className="bg-danger-900/30 border border-danger-700 rounded-lg px-4 py-3">
              <p className="text-danger-300 text-sm">{lastResult.feedback}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !answer.trim()}
            className="btn-primary w-full py-4"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying stage {stage.stage}…
              </span>
            ) : `SUBMIT STAGE ${stage.stage}`}
          </button>
        </div>
      )}

      {locked && (
        <div className="arena-card p-6 text-center">
          <p className="text-gray-500 font-mono text-sm tracking-wider">
            {attempt.status === 'COMPLETED' ? 'ALL STAGES COMPLETE' : 'CHALLENGE LOCKED'}
          </p>
        </div>
      )}
    </div>
  );
}
