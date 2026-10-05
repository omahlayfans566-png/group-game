/**
 * DashboardPage — upgraded with:
 *  • Weekly 7-day schedule showing actual start/end times from backend
 *  • Per-day completion status (green check = attempt locked, from DB)
 *  • Prominent current-day challenge card with correct timer behavior
 *  • Personal timer that survives refresh / tab-close (server deadline)
 *  • Global window enforcement on display
 *  • No scores, rankings, or elimination info shown to players
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { gamesApi, challengesApi } from '../lib/api';
import { getSocket, joinGameRoom } from '../lib/socket';
import CountdownTimer from '../components/shared/CountdownTimer';
import { Game, GameDay, Challenge, ChallengeAttempt } from '../types';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_NAMES_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function fmtTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      timeZone: 'Africa/Lagos', hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date(iso));
  }
  catch { return '—'; }
}

function formatCountdown(targetIso: string, nowMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil((new Date(targetIso).getTime() - nowMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

/** Map GameDay.status + attempt status → a player-visible day state */
type DayState =
  | 'LOCKED'        // future, not yet open
  | 'UPCOMING'      // open day, no challenge found or not started
  | 'IN_PROGRESS'   // player has an active attempt right now
  | 'COMPLETED'     // player's attempt was submitted and locked
  | 'TIME_EXPIRED'  // player's attempt expired and was locked
  | 'CLOSED'        // global window closed, player never started
  | 'OPEN';         // game window is open, player can enter

function dayStateColor(s: DayState): string {
  switch (s) {
    case 'COMPLETED': return 'bg-emerald-900 border-emerald-600 text-emerald-300';
    case 'TIME_EXPIRED': return 'bg-amber-900 border-amber-700 text-amber-300';
    case 'IN_PROGRESS': return 'bg-cyber-900 border-cyber-500 text-cyber-300 animate-pulse';
    case 'OPEN': return 'bg-cyber-900 border-cyber-600 text-cyber-300';
    case 'UPCOMING': return 'bg-arena-800 border-arena-600 text-gray-400';
    case 'CLOSED': return 'bg-arena-700 border-arena-600 text-gray-500';
    default: return 'bg-arena-900 border-arena-700 text-gray-600';
  }
}

function dayStateIcon(s: DayState): string {
  switch (s) {
    case 'COMPLETED': return '✓';
    case 'TIME_EXPIRED': return '⏰';
    case 'IN_PROGRESS': return '●';
    case 'OPEN': return '●';
    case 'UPCOMING': return '○';
    case 'CLOSED': return '○';
    default: return '🔒';
  }
}

function dayStateLabel(s: DayState): string {
  switch (s) {
    case 'COMPLETED': return 'COMPLETED';
    case 'TIME_EXPIRED': return 'TIME EXPIRED';
    case 'IN_PROGRESS': return 'IN PROGRESS';
    case 'OPEN': return 'AVAILABLE';
    case 'UPCOMING': return 'LOCKED';
    case 'CLOSED': return 'CLOSED';
    default: return 'LOCKED';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  const [game, setGame] = useState<Game | null>(null);
  const [scheduleGame, setScheduleGame] = useState<Game | null>(null);
  const [days, setDays] = useState<GameDay[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  // Map challengeId → my attempt for that challenge
  const [attemptMap, setAttemptMap] = useState<Record<string, ChallengeAttempt>>({});
  const [loading, setLoading] = useState(true);
  const [serverTimeMs, setServerTimeMs] = useState<number | null>(null);
  const [, setClockTick] = useState(0);
  const clockAnchor = useRef<number | null>(null);

  // The server response is the anchor; performance.now() keeps the display ticking
  // without consulting the player's wall clock after the anchor is established.
  useEffect(() => {
    const id = setInterval(() => setClockTick(tick => tick + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const nowMs = serverTimeMs === null || clockAnchor.current === null
    ? null
    : serverTimeMs + (performance.now() - clockAnchor.current);

  const loadDashboard = useCallback(async () => {
    try {
      const [gamesRes, scheduleRes] = await Promise.all([gamesApi.getAll(), gamesApi.getSchedule()]);
      const serverNow = new Date(scheduleRes.data.serverNow).getTime();
      if (!Number.isNaN(serverNow)) {
        clockAnchor.current = performance.now();
        setServerTimeMs(serverNow);
      }
      setScheduleGame((scheduleRes.data.game || null) as Game | null);
      setDays((scheduleRes.data.days || []) as GameDay[]);
      const games: Game[] = gamesRes.data.games || [];
      const activeGame = games.find(g => g.status === 'ACTIVE');
      if (!activeGame) {
        setGame(null);
        setChallenges([]);
        setAttemptMap({});
        return;
      }
      setGame(activeGame);

      const daysRes = await gamesApi.getDays(activeGame._id);
      const gameDays: GameDay[] = (daysRes.data.days || []).sort((a: GameDay, b: GameDay) => a.dayNumber - b.dayNumber);
      setDays(gameDays.length > 0 ? gameDays : (scheduleRes.data.days || []));

      // Load challenges for all days + attempts for each
      const challRes = await challengesApi.getAll({ gameId: activeGame._id }).catch(() => ({ data: { challenges: [] } }));
      const allChallenges: Challenge[] = challRes.data.challenges || [];
      setChallenges(allChallenges);

      // Fetch my attempt for each active challenge (sequentially to avoid flooding)
      const newMap: Record<string, ChallengeAttempt> = {};
      for (const ch of allChallenges.filter(c => c.isActive)) {
        try {
          const aRes = await challengesApi.getMyAttempt(ch._id);
          if (aRes.data.attempt) newMap[ch._id] = aRes.data.attempt as ChallengeAttempt;
        } catch { /* no attempt for this challenge */ }
      }
      setAttemptMap(newMap);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Reconcile displayed attempt states with the backend while this screen is open.
  useEffect(() => {
    const id = setInterval(loadDashboard, 10_000);
    return () => clearInterval(id);
  }, [loadDashboard]);

  // Socket
  useEffect(() => {
    if (!game) return;
    const socket = getSocket();
    if (!socket) return;
    joinGameRoom(game._id);
    socket.on('challenge:opened', () => { toast.success('A challenge is now open!'); loadDashboard(); });
    socket.on('game:status', loadDashboard);
    return () => {
      socket.off('challenge:opened');
      socket.off('game:status');
    };
  }, [game, loadDashboard]);

  // ─── Derived state ─────────────────────────────────────────────────────────

  /** Get the best challenge for a given day */
  const challengeForDay = (dayNumber: number): Challenge | undefined =>
    challenges.find(c => c.dayNumber === dayNumber && c.isActive);

  /** Get my attempt for a challenge */
  const attemptForChallenge = (challengeId: string): ChallengeAttempt | undefined =>
    attemptMap[challengeId];

  /** Compute player-visible state from the stored attempt and schedule. */
  const computeDayState = (day: GameDay): DayState => {
    const start = new Date(day.challengeStartTime).getTime();
    const end = new Date(day.challengeEndTime).getTime();
    const current = nowMs ?? 0;
    const ch = challengeForDay(day.dayNumber);
    if (ch) {
      const att = attemptForChallenge(ch._id);
      if (att?.status === 'COMPLETED') return 'COMPLETED';
      if (att?.status === 'TIME_EXPIRED') return 'TIME_EXPIRED';
      if (att?.status === 'IN_PROGRESS') {
        if (current < end && new Date(att.deadlineAt).getTime() > current) return 'IN_PROGRESS';
        return 'TIME_EXPIRED';
      }
    }
    // Timestamps are the player-facing reflection of the server-enforced window.
    if (current < start) return 'UPCOMING';
    if (current >= end || ['CLOSED', 'RESULTS', 'COMPLETED'].includes(day.status)) return 'CLOSED';
    return ch?.isActive ? 'OPEN' : 'UPCOMING';
  };

  const todayDay = days.find(day => {
    if (nowMs === null) return false;
    return nowMs >= new Date(day.challengeStartTime).getTime()
      && nowMs < new Date(day.challengeEndTime).getTime();
  })
    ?? days.find(day => nowMs !== null && new Date(day.challengeStartTime).getTime() > nowMs)
    ?? days[days.length - 1];
  const todayChallenge = todayDay ? challengeForDay(todayDay.dayNumber) : undefined;
  const todayAttempt = todayChallenge ? attemptForChallenge(todayChallenge._id) : undefined;
  const todayState = todayDay ? computeDayState(todayDay) : null;

  const displayGame = game || scheduleGame;
  const groupLink = displayGame?.groupLink || import.meta.env.VITE_GROUP_LINK || '#';

  if (loading) return (
    <div className="min-h-screen bg-arena-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyber-700 border-t-cyber-400 rounded-full animate-spin" />
        <p className="text-gray-600 text-xs tracking-widest uppercase animate-pulse">Loading…</p>
      </div>
    </div>
  );

  return (
    <main className="survival-shell min-h-screen overflow-hidden text-stone-100">
      <div className="survival-ambient survival-ambient-one" />
      <div className="survival-ambient survival-ambient-two" />
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="survival-mark">S</span>
          <span className="text-xs font-semibold uppercase tracking-[0.32em] text-stone-300">{import.meta.env.VITE_APP_NAME || 'Survival'}</span>
        </div>
        <div className="flex items-center gap-4">
          <a href={groupLink} target="_blank" rel="noopener noreferrer" className="text-xs uppercase tracking-[0.2em] text-stone-400 transition hover:text-rose-200">Group</a>
          <button onClick={() => { clearAuth(); navigate('/'); }} className="text-xs uppercase tracking-[0.2em] text-stone-500 transition hover:text-stone-100">Exit</button>
        </div>
      </nav>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-14 sm:px-8">
        <section className="survival-intro mb-8 flex flex-col justify-between gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.4em] text-rose-300/80">Welcome back</p>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-stone-50 sm:text-6xl">{user?.nickname || user?.playerTag}</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-stone-400">Seven days. One final victory. Your next challenge is waiting.</p>
          </div>
          <div className="survival-identity"><span>{user?.playerTag || 'PLAYER'}</span><span className="h-1 w-1 rounded-full bg-rose-300" /><span>Season arena</span></div>
        </section>

        {(game || days.length > 0) && <>
          <TodayChallengeCard
            day={todayDay ?? null}
            challenge={todayChallenge ?? null}
            attempt={todayAttempt ?? null}
            state={todayState}
            groupLink={groupLink}
            nowMs={nowMs}
            onEnter={() => todayChallenge && navigate(`/challenge/${todayChallenge._id}`)}
            onTimerExpire={loadDashboard}
          />

          <section className="mt-12">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div><p className="text-[11px] uppercase tracking-[0.35em] text-rose-300/80">The journey</p><h2 className="font-display mt-2 text-3xl text-stone-100 sm:text-4xl">Your seven-day journey</h2></div>
              <p className="hidden text-right text-xs uppercase tracking-[0.2em] text-stone-500 sm:block">{displayGame?.name || 'The arena'}<br />Nigeria time</p>
            </div>
            <div className="survival-journey">
              {Array.from({ length: 7 }, (_, i) => {
                const dayNum = i + 1;
                const day = days.find(d => d.dayNumber === dayNum);
                return <WeekDayRow key={dayNum} dayNumber={dayNum} shortName={DAY_NAMES_SHORT[i]} longName={DAY_NAMES_LONG[i]} day={day} state={day ? computeDayState(day) : 'LOCKED'} isSunday={dayNum === 7} nowMs={nowMs} isCurrentDay={Boolean(todayDay && day && todayDay._id === day._id)} />;
              })}
            </div>
          </section>

          <div className="mt-12 flex flex-col items-start justify-between gap-5 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
            <div><p className="font-display text-xl text-stone-200">Official results live in the group.</p><p className="mt-1 text-sm text-stone-500">Keep your eyes on the arena.</p></div>
            <a href={groupLink} target="_blank" rel="noopener noreferrer" className="survival-link">Enter the group <span>↗</span></a>
          </div>
        </>}
      </div>
    </main>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface TodayCardProps {
  day: GameDay | null;
  challenge: Challenge | null;
  attempt: ChallengeAttempt | null;
  state: DayState | null;
  groupLink: string;
  nowMs: number | null;
  onEnter: () => void;
  onTimerExpire: () => void;
}

function TodayChallengeCard({ day, challenge, attempt, state, groupLink, nowMs, onEnter, onTimerExpire }: TodayCardProps) {
  if (!day && !challenge) {
    return (
      <div className="arena-card border border-arena-600 p-6 text-center space-y-2">
        <p className="text-gray-500 text-xs uppercase tracking-widest">Today's Challenge</p>
        <p className="text-2xl font-bold text-gray-400">No game scheduled today</p>
        <p className="text-gray-600 text-sm">Watch the group for the next game announcement.</p>
      </div>
    );
  }

  const dayIndex = (day?.dayNumber ?? 1) - 1;
  const longName = DAY_NAMES_LONG[dayIndex] ?? 'Today';
  const startTime = day ? fmtTime(day.challengeStartTime) : '—';
  const endTime = day ? fmtTime(day.challengeEndTime) : '—';

  const borderClass =
    state === 'COMPLETED' ? 'border-emerald-200/25' :
      state === 'TIME_EXPIRED' ? 'border-amber-200/25' :
        state === 'IN_PROGRESS' ? 'border-rose-200/40' :
          state === 'OPEN' ? 'border-rose-200/35' :
            'border-white/10';

  return (
    <div className={`survival-hero relative overflow-hidden rounded-[2rem] border p-6 sm:p-10 ${borderClass} space-y-7`}>
      <div className="survival-hero-art" aria-hidden="true"><span /><span /><span /></div>
      {/* Header */}
      <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-rose-200/80">Today's challenge</p>
          <h2 className="font-display mt-3 text-5xl tracking-wide text-stone-50 sm:text-7xl">{longName}</h2>
        </div>
        <p className="survival-status">{state === 'COMPLETED' ? 'Completed' : state === 'TIME_EXPIRED' ? 'Time is up' : state === 'IN_PROGRESS' ? 'Live now' : state === 'OPEN' ? 'Available' : state === 'CLOSED' ? 'Closed' : 'Locked'}</p>
      </div>

      {day && <div className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs uppercase tracking-[0.18em] text-stone-400"><span>{startTime} – {endTime}</span><span className="text-rose-200/60">Africa / Lagos</span></div>}

      {/* ── State-specific content ── */}

      {/* LOCKED / UPCOMING — not yet open */}
      {(state === 'LOCKED' || state === 'UPCOMING') && day && (
        <div className="relative z-10 space-y-4 rounded-2xl border border-white/10 bg-black/25 px-5 py-6 text-center sm:px-8">
          <p className="text-sm uppercase tracking-[0.25em] text-stone-300">The vault is sealed</p>
          {nowMs !== null && (
            <>
              <p className="text-[10px] uppercase tracking-[0.35em] text-rose-200/70">Opens in</p>
              <p className="survival-countdown">
                {formatCountdown(day.challengeStartTime, nowMs)}
              </p>
            </>
          )}
        </div>
      )}

      {/* OPEN — player hasn't started yet */}
      {state === 'OPEN' && challenge && !attempt && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-rose-300/30 bg-rose-950/30 px-5 py-4">
            <p className="text-sm font-semibold text-rose-100">The vault is open.</p>
            <p className="mt-1 text-xs text-stone-400">Your personal timer begins when you enter. The arena closes at {endTime}.</p>
          </div>
          <button onClick={onEnter} className="survival-cta w-full py-4 text-base">
            Start challenge <span>→</span>
          </button>
        </div>
      )}

      {/* IN_PROGRESS — player has active attempt */}
      {state === 'IN_PROGRESS' && attempt && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200/20 bg-amber-950/20 px-5 py-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-100/70">Your personal timer</p>
              <CountdownTimer
                deadlineAt={attempt.deadlineAt}
                onExpire={onTimerExpire}
                className="text-left"
              />
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>Global close</p>
              <p className="font-mono text-white">{endTime}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onEnter} className="survival-cta flex-1 py-3 text-sm">
              Continue challenge <span>→</span>
            </button>
          </div>
          <p className="text-gray-600 text-xs text-center">
            Refreshing will NOT reset your timer — it continues on the server.
          </p>
        </div>
      )}

      {/* Locked attempt: submitted or expired */}
      {(state === 'COMPLETED' || state === 'TIME_EXPIRED') && (
        <div className="space-y-3">
          <div className={`rounded-2xl px-5 py-5 text-center space-y-2 ${state === 'COMPLETED'
            ? 'bg-emerald-950/20 border border-emerald-200/20'
            : 'bg-black/20 border border-white/10'
            }`}>
            <p className={`font-display text-2xl tracking-wide ${state === 'COMPLETED' ? 'text-emerald-200' : 'text-amber-100'}`}>
              {state === 'COMPLETED' ? 'Submission received' : 'Time is up'}
            </p>
            <p className="text-gray-400 text-sm">
              Thank you for participating. Your challenge has been locked.
            </p>
            <p className="text-gray-500 text-xs">
              Please return to the group for your official result.
            </p>
          </div>
          <a href={groupLink} target="_blank" rel="noopener noreferrer" className="survival-link w-full justify-center">
            Official results <span>↗</span>
          </a>
        </div>
      )}

      {/* CLOSED — global window ended, player never started */}
      {state === 'CLOSED' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-5 text-center">
            <p className="font-display text-2xl tracking-wide text-stone-200">The vault is sealed.</p>
            <p className="mt-1 text-xs text-stone-500">The next scheduled challenge will appear in the journey.</p>
          </div>
          <a href={groupLink} target="_blank" rel="noopener noreferrer" className="survival-link w-full justify-center">
            Return to the group <span>↗</span>
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Week-row component ────────────────────────────────────────────────────────

interface WeekDayRowProps {
  dayNumber: number;
  shortName: string;
  longName: string;
  day: GameDay | undefined;
  state: DayState;
  isSunday: boolean;
  nowMs: number | null;
  isCurrentDay: boolean;
}

function WeekDayRow({ dayNumber, shortName, longName, day, state, isSunday, nowMs, isCurrentDay }: WeekDayRowProps) {
  const isExpired = state === 'TIME_EXPIRED';
  const isLive = state === 'IN_PROGRESS' || state === 'OPEN';

  return (
    <div className={`survival-stage relative flex min-h-[152px] flex-col items-start justify-between gap-4 px-4 py-5 transition-all
      ${isCurrentDay ? 'survival-stage-current' : ''}
      ${state === 'COMPLETED' ? 'survival-stage-complete' : isExpired ? 'survival-stage-expired' : isLive ? 'survival-stage-live' : ''}`}>

      <div className="flex w-full items-start justify-between gap-2">
        {/* Day number badge */}
        <div className={`survival-stage-number ${isSunday ? 'survival-stage-final' : ''}`}>
          {dayNumber}
        </div>

        {isCurrentDay && <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-rose-200">Today</span>}
      </div>

      {/* Day name + times */}
      <div className="w-full min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-wide text-stone-100">
            {shortName}
          </span>
        </div>
        {day ? (
          <>
            <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500 mt-1">
              {fmtTime(day.challengeStartTime)} – {fmtTime(day.challengeEndTime)}
            </p>
            {isCurrentDay && state === 'UPCOMING' && nowMs !== null && (
              <p className="text-[10px] text-rose-200/80 font-mono uppercase tracking-wider mt-2">
                {formatCountdown(day.challengeStartTime, nowMs)}
              </p>
            )}
          </>
        ) : (
          <p className="text-[11px] text-stone-600 mt-0.5">Schedule pending</p>
        )}
      </div>

      {(state === 'LOCKED' || state === 'UPCOMING') && (
        <div className="w-full space-y-2" aria-label="Game hidden until it opens">
          <p className="text-[9px] uppercase tracking-[0.2em] text-stone-600">Locked</p>
          <div className="survival-blur-preview" aria-hidden="true">
            <span /><span /><span />
          </div>
        </div>
      )}

      {/* Status indicator */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${isLive ? 'text-rose-200' : state === 'COMPLETED' ? 'text-emerald-200' : 'text-stone-500'}`}>
          {state === 'COMPLETED' ? 'Complete' : isExpired ? 'Closed' : isLive ? 'Open' : 'Locked'}
        </span>
      </div>
    </div>
  );
}
