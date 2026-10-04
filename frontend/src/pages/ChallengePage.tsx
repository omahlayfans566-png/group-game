import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { challengesApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import CountdownTimer from '../components/shared/CountdownTimer';
import GroupDiscussionButton from '../components/shared/GroupDiscussionButton';
import ChallengeRenderer from '../components/puzzles/ChallengeRenderer';
import { PuzzleType, AttemptState, StageResult } from '../types/puzzle';
import { Challenge } from '../types';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

// ─── Difficulty colour helper ─────────────────────────────────────────────────

function difficultyColor(d: string) {
  return d === 'EASY' ? 'text-emerald-400 border-emerald-700 bg-emerald-900/30'
    : d === 'MEDIUM' ? 'text-amber-400 border-amber-700 bg-amber-900/30'
      : d === 'HARD' ? 'text-orange-400 border-orange-700 bg-orange-900/30'
        : 'text-danger-400 border-danger-700 bg-danger-900/30';
}

function puzzleTypeLabel(t: string) {
  const map: Record<string, string> = {
    CODE_BREAK: 'CODE BREAK', SEQUENCE: 'SEQUENCE', MEMORY: 'MEMORY',
    PATTERN: 'PATTERN', ARRANGEMENT: 'ARRANGEMENT', HIDDEN_OBJECT: 'HIDDEN OBJECT',
    LOGIC: 'LOGIC', MULTI_STAGE: 'MULTI-STAGE',
  };
  return map[t] ?? t;
}

// ─── Page phases ──────────────────────────────────────────────────────────────
type Phase = 'loading' | 'briefing' | 'in_progress' | 'completed' | 'expired' | 'closed' | 'error';

export default function ChallengePage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [phase, setPhase] = useState<Phase>('loading');
  const [challenge, setChallenge] = useState<Partial<Challenge> | null>(null);
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [displayData, setDisplayData] = useState<Record<string, unknown> | null>(null);
  const [lastResult, setLastResult] = useState<StageResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const autoSubmitFired = useRef(false);

  // ─── Load challenge & check existing attempt ────────────────────────────────

  useEffect(() => {
    if (!challengeId) return;
    (async () => {
      try {
        const cRes = await challengesApi.getOne(challengeId);
        setChallenge(cRes.data.challenge);

        const aRes = await challengesApi.getMyAttempt(challengeId);
        const att = aRes.data.attempt as AttemptState | null;

        if (!att) { setPhase('briefing'); return; }

        if (att.status === 'COMPLETED') {
          setAttempt(att);
          setPhase('completed');
        } else if (att.status === 'TIME_EXPIRED') {
          setAttempt(att);
          setPhase('expired');
        } else if (att.status === 'IN_PROGRESS') {
          await resumeChallenge();
        } else {
          setPhase('briefing');
        }
      } catch {
        setPhase('error');
        setErrorMessage('Failed to load challenge. Please go back and try again.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  // ─── Reconnect to in-progress attempt ──────────────────────────────────────

  const resumeChallenge = useCallback(async () => {
    if (!challengeId) return;
    try {
      const res = await challengesApi.startChallenge(challengeId);
      const data = res.data as {
        success: boolean; resumed: boolean;
        attempt: AttemptState;
        puzzleDisplayData: Record<string, unknown>;
        challenge: Partial<Challenge>;
      };
      if (!data.success) throw new Error('Could not resume');
      setChallenge(prev => ({ ...prev, ...data.challenge }));
      setAttempt(data.attempt);
      setDisplayData(data.puzzleDisplayData);
      setAttemptsUsed(data.attempt.stageHistory?.length ?? 0);
      setPhase('in_progress');
    } catch (err) {
      const axErr = err as AxiosError<{ message: string; status?: string }>;
      if (axErr.response?.data?.status === 'TIME_EXPIRED') { setPhase('expired'); return; }
      if (axErr.response?.data?.message?.includes('CLOSED')) { setPhase('closed'); return; }
      setPhase('error');
      setErrorMessage(axErr.response?.data?.message || 'Failed to load challenge.');
    }
  }, [challengeId]);

  // ─── Start fresh ────────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!challengeId || starting) return;
    setStarting(true);
    try {
      const res = await challengesApi.startChallenge(challengeId);
      const data = res.data as {
        success: boolean; resumed: boolean;
        attempt: AttemptState;
        puzzleDisplayData: Record<string, unknown>;
        challenge: Partial<Challenge>;
      };
      if (!data.success) throw new Error('Could not start');
      setChallenge(prev => ({ ...prev, ...data.challenge }));
      setAttempt(data.attempt);
      setDisplayData(data.puzzleDisplayData);
      setPhase('in_progress');
    } catch (err) {
      const axErr = err as AxiosError<{ message: string }>;
      const msg = axErr.response?.data?.message || 'Could not start challenge';
      toast.error(msg);
      setPhase('error');
      setErrorMessage(msg);
    } finally {
      setStarting(false);
    }
  };

  // ─── Submit answer (single-stage or per-stage) ──────────────────────────────

  const handleSubmit = useCallback(async (
    payload: Record<string, unknown>,
    isAutoSubmit = false
  ) => {
    if (!challengeId || !attempt || submitting) return;
    if (isAutoSubmit && autoSubmitFired.current) return;
    if (isAutoSubmit) autoSubmitFired.current = true;

    setSubmitting(true);
    try {
      const isMultiStage = (challenge?.totalStages ?? 1) > 1;
      let res;

      if (isMultiStage) {
        res = await challengesApi.submitStage(challengeId, {
          attemptId: attempt._id,
          stage: attempt.currentStage,
          payload,
        });
      } else {
        // Single-stage shorthand
        res = await challengesApi.submitChallenge(challengeId, {
          attemptId: attempt._id,
          answers: payload,
        });
      }

      const result = (res.data.result ?? res.data) as StageResult;
      setLastResult(result);
      setAttemptsUsed(prev => prev + 1);

      if (result.isComplete || result.status === 'COMPLETED') {
        // Update attempt state locally
        setAttempt(prev => prev ? {
          ...prev,
          status: 'COMPLETED',
          score: result.totalScore ?? result.score,
          currentStage: prev.totalStages,
          stageHistory: [
            ...(prev.stageHistory ?? []),
            { stage: prev.currentStage, isCorrect: result.isCorrect, score: result.score },
          ],
        } : prev);
        setPhase('completed');
        if (isAutoSubmit) toast('⏱ Time expired — your answers were auto-submitted.', { icon: '⚠️' });
      } else if (result.nextStage) {
        // Advance to next stage
        setAttempt(prev => prev ? {
          ...prev,
          currentStage: result.nextStage!,
          stageHistory: [
            ...(prev.stageHistory ?? []),
            { stage: prev.currentStage, isCorrect: result.isCorrect, score: result.score },
          ],
        } : prev);
        toast.success(`Stage complete! Moving to next stage.`);
      }
    } catch (err) {
      const axErr = err as AxiosError<{ message: string; status?: string }>;
      const st = axErr.response?.data?.status;
      if (st === 'TIME_EXPIRED') { setPhase('expired'); return; }
      toast.error(axErr.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }, [challengeId, attempt, submitting, challenge?.totalStages]);

  // ─── Auto-submit on timer expiry ────────────────────────────────────────────

  const handleTimerExpire = useCallback(() => {
    handleSubmit({ autoExpired: true }, true);
  }, [handleSubmit]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const maxAttempts = challenge?.maxAttempts ?? 1;
  const attemptsLeft = Math.max(0, maxAttempts - attemptsUsed);
  const isLocked = phase === 'completed' || phase === 'expired';
  const groupLink = import.meta.env.VITE_GROUP_LINK as string | undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER PHASES
  // ═══════════════════════════════════════════════════════════════════════════

  if (phase === 'loading') return (
    <div className="min-h-screen bg-arena-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-cyber-700 border-t-cyber-400 rounded-full animate-spin" />
        <p className="text-gray-500 text-xs tracking-widest uppercase animate-pulse">Loading Challenge…</p>
      </div>
    </div>
  );

  if (phase === 'error') return (
    <div className="min-h-screen bg-arena-950 flex items-center justify-center px-4">
      <div className="arena-card danger-border p-8 max-w-md w-full text-center space-y-4">
        <p className="text-5xl">⚠️</p>
        <p className="text-danger-400 font-bold text-xl tracking-wide">Error</p>
        <p className="text-gray-400 text-sm leading-relaxed">{errorMessage}</p>
        <button onClick={() => navigate('/dashboard')} className="btn-ghost w-full">← Back to Dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-arena-950 flex flex-col">
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none" />

      {/* ── TOP BAR ── */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-arena-700 bg-arena-900/80 backdrop-blur">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-gray-500 hover:text-gray-300 text-xs tracking-widest uppercase transition-colors flex items-center gap-1"
        >
          ← Dashboard
        </button>

        {/* Live timer — only during active challenge */}
        {phase === 'in_progress' && attempt && (
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-xs uppercase tracking-wider hidden sm:block">Time</span>
            <CountdownTimer deadlineAt={attempt.deadlineAt} onExpire={handleTimerExpire} />
          </div>
        )}

        {/* Attempts */}
        {phase === 'in_progress' && challenge && (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: maxAttempts }, (_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${i < attemptsUsed ? 'bg-danger-600' : 'bg-cyber-600'}`}
                title={i < attemptsUsed ? 'Used' : 'Remaining'}
              />
            ))}
            <span className="text-gray-500 text-xs ml-1">
              {attemptsLeft} left
            </span>
          </div>
        )}
      </header>

      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">

        {/* ── BRIEFING ── */}
        {phase === 'briefing' && challenge && (
          <div className="space-y-6">

            {/* Title block */}
            <div className="text-center space-y-3">
              <p className="text-cyber-400 text-xs tracking-[0.4em] uppercase">
                {puzzleTypeLabel(challenge.challengeType ?? '')}
              </p>
              <h1
                className="text-4xl sm:text-5xl font-bold text-white tracking-tight"
                style={{ textShadow: '0 0 30px rgba(0,179,179,0.25)' }}
              >
                {challenge.title}
              </h1>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-widest ${difficultyColor(challenge.difficulty ?? '')}`}>
                {challenge.difficulty}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Time Limit', value: `${Math.floor((challenge.durationSeconds ?? 0) / 60)}m ${(challenge.durationSeconds ?? 0) % 60 > 0 ? `${(challenge.durationSeconds ?? 0) % 60}s` : ''}`.trim() },
                { label: 'Max Score', value: `${challenge.maxScore ?? 100} pts` },
                { label: 'Attempts', value: challenge.maxAttempts ?? 1 },
              ].map(s => (
                <div key={s.label} className="arena-card p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
                  <p className="text-white font-bold text-xl mt-1">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            {challenge.description && (
              <div className="arena-card p-5">
                <p className="text-gray-300 text-sm leading-relaxed">{challenge.description}</p>
              </div>
            )}

            {/* Rules */}
            <div className="bg-arena-900 border border-arena-700 rounded-lg p-5 space-y-2">
              <p className="text-cyber-400 text-xs uppercase tracking-[0.2em] font-semibold mb-3">
                ◆ Rules
              </p>
              {[
                '⏱  The timer starts the moment you click START. It cannot be paused or reset.',
                '🔒  Once started, this challenge is locked to you — you cannot restart it.',
                '⚡  If time expires, your current state is automatically submitted.',
                '🚫  Paste is disabled in answer fields. Each player receives a unique puzzle variant.',
                '✅  All answers are validated on the server. The client clock does not affect the result.',
                `🔁  You have ${challenge.maxAttempts ?? 1} attempt${(challenge.maxAttempts ?? 1) > 1 ? 's' : ''}.`,
                challenge.totalStages && challenge.totalStages > 1
                  ? `📋  This is a ${challenge.totalStages}-stage challenge. Complete stages in order.`
                  : null,
              ].filter(Boolean).map((rule, i) => (
                <p key={i} className="text-gray-400 text-xs leading-relaxed">{rule}</p>
              ))}
            </div>

            {/* Instructions */}
            {challenge.instructions && (
              <div className="arena-card p-5">
                <p className="text-cyber-400 text-xs uppercase tracking-[0.2em] font-semibold mb-3">◆ Instructions</p>
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{challenge.instructions}</p>
              </div>
            )}

            {/* Warning */}
            <div className="bg-danger-900/30 border border-danger-800 rounded-lg px-4 py-3 flex items-start gap-3">
              <span className="text-danger-400 text-xl shrink-0">⚠️</span>
              <p className="text-danger-300 text-sm">
                The timer begins immediately when you press START. Only proceed when you are fully ready.
              </p>
            </div>

            <button
              onClick={handleStart}
              disabled={starting}
              className="btn-primary w-full text-xl py-5 tracking-widest"
            >
              {starting ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Initialising…
                </span>
              ) : '⚡  START CHALLENGE'}
            </button>
          </div>
        )}

        {/* ── IN PROGRESS ── */}
        {phase === 'in_progress' && challenge && attempt && displayData && (
          <div className="space-y-6">

            {/* Challenge header */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-1">
                <div>
                  <p className="text-cyber-400 text-xs tracking-[0.3em] uppercase font-semibold">
                    {puzzleTypeLabel(challenge.challengeType ?? '')}
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">{challenge.title}</h1>
                </div>
                <div className={`text-xs font-bold px-2.5 py-1 rounded-full border uppercase tracking-widest shrink-0 ${difficultyColor(challenge.difficulty ?? '')}`}>
                  {challenge.difficulty}
                </div>
              </div>

              {/* Multi-stage indicator */}
              {(challenge.totalStages ?? 1) > 1 && (
                <div className="flex items-center gap-1.5 mt-3">
                  {Array.from({ length: challenge.totalStages ?? 1 }, (_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${i + 1 < attempt.currentStage ? 'bg-emerald-600'
                        : i + 1 === attempt.currentStage ? 'bg-cyber-500 animate-pulse'
                          : 'bg-arena-700'
                        }`}
                    />
                  ))}
                  <span className="text-xs text-gray-500 ml-1 shrink-0">
                    Stage {attempt.currentStage}/{challenge.totalStages}
                  </span>
                </div>
              )}
            </div>

            {/* Puzzle area */}
            <div className="arena-card cyber-border-active p-6">
              <ChallengeRenderer
                puzzleType={(challenge.challengeType ?? 'CODE_BREAK') as PuzzleType}
                displayData={displayData}
                attempt={attempt}
                onSubmit={async (payload) => handleSubmit(payload, false)}
                submitting={submitting}
                lastResult={lastResult}
                locked={isLocked}
              />
            </div>

            {/* Player identity strip */}
            <div className="flex items-center justify-between text-xs text-gray-700 font-mono px-1">
              <span>{user?.playerTag} · {user?.nickname}</span>
              <span className="text-cyber-800">LIVE</span>
            </div>
          </div>
        )}

        {/* ── COMPLETED ── */}
        {phase === 'completed' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-cyber-400 text-xs tracking-[0.4em] uppercase mb-2">Challenge Complete</p>
              <h1 className="text-4xl font-bold text-white">{challenge?.title}</h1>
            </div>

            {/* Confirmation card — NO score shown to player */}
            <div className="arena-card cyber-border p-8 text-center space-y-5">
              <div className="text-6xl">✅</div>
              <div>
                <p className="text-emerald-400 text-xl font-bold tracking-widest uppercase">SUBMISSION RECEIVED</p>
                <p className="text-gray-400 text-sm mt-2">Thank you for participating. Your challenge has been locked.</p>
              </div>

              <div className="arena-divider" />

              {/* Player identity */}
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Player</p>
                <p className="text-cyber-300 font-mono font-bold text-xl">{user?.playerTag}</p>
                <p className="text-white font-semibold">{user?.nickname}</p>
              </div>

              <div className="arena-divider" />

              <div className="bg-arena-900 border border-arena-700 rounded-lg px-5 py-4 space-y-2">
                <p className="text-white font-semibold text-sm">Your official result will be announced in the group.</p>
                <p className="text-gray-500 text-xs leading-relaxed">
                  The admin will review all submissions and announce results in the WhatsApp group.
                  Do not share your answers — the competition is still ongoing.
                </p>
              </div>
            </div>

            <a
              href={import.meta.env.VITE_GROUP_LINK || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full py-4 text-center flex items-center justify-center gap-2 text-base"
            >
              <span className="text-xl">💬</span> GO TO THE GROUP
            </a>
            <button onClick={() => navigate('/dashboard')} className="btn-ghost w-full py-3 text-sm">← Dashboard</button>
          </div>
        )}

        {/* ── EXPIRED ── */}
        {phase === 'expired' && (
          <div className="space-y-6">
            <div className="arena-card danger-border p-10 text-center space-y-5">
              <p className="text-6xl">⏱</p>
              <div>
                <p className="text-danger-400 text-4xl font-bold tracking-widest">TIME IS UP</p>
                <p className="text-gray-400 text-sm mt-3 leading-relaxed max-w-sm mx-auto">
                  Thank you for participating. Your challenge has been locked.
                </p>
              </div>

              <div className="bg-arena-900 border border-arena-700 rounded-lg px-5 py-4 space-y-2">
                <p className="text-white font-semibold text-sm">Please return to the group for your official result.</p>
                <p className="text-gray-500 text-xs leading-relaxed">
                  The admin will review all submissions and announce results in the WhatsApp group.
                </p>
              </div>

              {/* Player identity */}
              <div>
                <p className="text-gray-600 text-xs font-mono">{user?.playerTag} · {user?.nickname}</p>
              </div>
            </div>

            <a
              href={import.meta.env.VITE_GROUP_LINK || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-base"
            >
              <span className="text-xl">💬</span> GO TO THE GROUP
            </a>
            <button onClick={() => navigate('/dashboard')} className="btn-ghost w-full py-3 text-sm">← Dashboard</button>
          </div>
        )}

        {/* ── CLOSED ── */}
        {phase === 'closed' && (
          <div className="space-y-6">
            <div className="arena-card p-10 text-center space-y-5 border-arena-600">
              <p className="text-5xl">🔒</p>
              <div>
                <p className="text-white text-3xl font-bold tracking-widest">THIS CHALLENGE IS CLOSED</p>
                <p className="text-gray-400 text-sm mt-3 leading-relaxed max-w-sm mx-auto">
                  The challenge window has ended. No more submissions are being accepted.
                </p>
              </div>
              <div className="bg-arena-900 border border-arena-700 rounded-lg px-5 py-4">
                <p className="text-white font-semibold text-sm">Please return to the group for the official result.</p>
              </div>
            </div>
            <a href={import.meta.env.VITE_GROUP_LINK || '#'} target="_blank" rel="noopener noreferrer"
              className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-base">
              <span className="text-xl">💬</span> GO TO THE GROUP
            </a>
            <button onClick={() => navigate('/dashboard')} className="btn-ghost w-full py-3 text-sm">← Dashboard</button>
          </div>
        )}
      </main>
    </div>
  );
}