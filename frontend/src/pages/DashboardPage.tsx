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
    <div className="min-h-screen bg-arena-950">
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-arena-700 bg-arena-900/60 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-cyber-400 text-base">⚔</span>
          <span className="text-white font-bold tracking-[0.15em] text-sm uppercase">
            {import.meta.env.VITE_APP_NAME || 'SURVIVAL'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a href={groupLink} target="_blank" rel="noopener noreferrer"
            className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1">
            <span>💬</span><span className="hidden sm:inline">Group</span>
          </a>
          <button onClick={() => { clearAuth(); navigate('/'); }}
            className="text-gray-500 hover:text-gray-300 text-xs tracking-widest uppercase transition-colors">
            Logout
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Player identity ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-cyber-400 text-xs tracking-[0.3em] uppercase mb-0.5">Welcome back</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {user?.nickname || user?.playerTag}
            </h1>
            <p className="text-gray-600 text-sm font-mono mt-0.5">{user?.playerTag}</p>
          </div>
        </div>

        {(game || days.length > 0) && (
          <>
            {/* ── TODAY'S CHALLENGE CARD ── */}
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

            {/* ── WEEKLY SCHEDULE ── */}
            <div className="arena-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="section-title mb-0">SEVEN DAYS / SURVIVAL SCHEDULE</p>
                <p className="text-xs text-gray-600 font-mono hidden sm:block">{displayGame?.name || 'SEVEN DAYS ARENA'}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 7 }, (_, i) => {
                  const dayNum = i + 1;
                  const day = days.find(d => d.dayNumber === dayNum);
                  const state = day ? computeDayState(day) : 'LOCKED';

                  return (
                    <WeekDayRow
                      key={dayNum}
                      dayNumber={dayNum}
                      shortName={DAY_NAMES_SHORT[i]}
                      longName={DAY_NAMES_LONG[i]}
                      day={day}
                      state={state}
                      isSunday={dayNum === 7}
                      nowMs={nowMs}
                      isCurrentDay={Boolean(todayDay && day && todayDay._id === day._id)}
                    />
                  );
                })}
              </div>

            </div>

            {/* ── Group footer ── */}
            <div className="arena-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-white font-semibold text-sm">Official Results Channel</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  All results and announcements are made in the group by the admin.
                </p>
              </div>
              <a href={groupLink} target="_blank" rel="noopener noreferrer"
                className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 shrink-0">
                <span>💬</span> GO TO THE GROUP
              </a>
            </div>
          </>
        )}
      </div>
    </div>
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
  const maxMin = challenge ? Math.round(challenge.durationSeconds / 60) : 0;

  const borderClass =
    state === 'COMPLETED' ? 'border-emerald-700 shadow-[0_0_20px_rgba(16,185,129,0.1)]' :
      state === 'TIME_EXPIRED' ? 'border-amber-700 shadow-[0_0_20px_rgba(245,158,11,0.1)]' :
        state === 'IN_PROGRESS' ? 'border-cyber-600 shadow-[0_0_20px_rgba(0,102,102,0.2)]' :
          state === 'OPEN' ? 'border-cyber-700' :
            'border-arena-600';

  return (
    <div className={`arena-card p-5 sm:p-6 border ${borderClass} space-y-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-[0.25em]">Today's Challenge</p>
          <h2 className="text-xl sm:text-2xl font-bold text-white mt-0.5">{longName}</h2>
          {challenge && (
            <p className="text-gray-400 text-sm mt-0.5">{challenge.title}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border
            ${state === 'COMPLETED' ? 'bg-emerald-900/50 border-emerald-700 text-emerald-300' :
              state === 'TIME_EXPIRED' ? 'bg-amber-900/50 border-amber-700 text-amber-300' :
                state === 'IN_PROGRESS' ? 'bg-cyber-900/50 border-cyber-600 text-cyber-300' :
                  state === 'OPEN' ? 'bg-cyber-900/30 border-cyber-700 text-cyber-400' :
                    state === 'CLOSED' ? 'bg-arena-700 border-arena-600 text-gray-400' :
                      'bg-arena-800 border-arena-700 text-gray-500'}`}>
            {state === 'COMPLETED' ? '✓ COMPLETED' :
              state === 'TIME_EXPIRED' ? '⏰ TIME EXPIRED' :
                state === 'IN_PROGRESS' ? '● LIVE' :
                  state === 'OPEN' ? '● AVAILABLE' :
                    state === 'CLOSED' ? 'CLOSED' :
                      state === 'UPCOMING' ? 'UPCOMING' : 'LOCKED'}
          </p>
        </div>
      </div>

      {/* Schedule info */}
      {day && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-arena-900 rounded-lg px-3 py-2.5">
            <p className="text-gray-600 uppercase tracking-wider mb-0.5">Opens</p>
            <p className="text-white font-mono font-bold text-sm">{startTime}</p>
          </div>
          <div className="bg-arena-900 rounded-lg px-3 py-2.5">
            <p className="text-gray-600 uppercase tracking-wider mb-0.5">Global Close</p>
            <p className="text-white font-mono font-bold text-sm">{endTime}</p>
          </div>
          {maxMin > 0 && (
            <div className="bg-arena-900 rounded-lg px-3 py-2.5">
              <p className="text-gray-600 uppercase tracking-wider mb-0.5">Max Personal Time</p>
              <p className="text-white font-mono font-bold text-sm">{maxMin} min</p>
            </div>
          )}
          {challenge && (
            <div className="bg-arena-900 rounded-lg px-3 py-2.5">
              <p className="text-gray-600 uppercase tracking-wider mb-0.5">Difficulty</p>
              <p className={`font-bold text-sm ${challenge.difficulty === 'HARD' ? 'text-orange-400' :
                challenge.difficulty === 'EXTREME' ? 'text-danger-400' :
                  'text-amber-400'}`}>
                {challenge.difficulty}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── State-specific content ── */}

      {/* LOCKED / UPCOMING — not yet open */}
      {(state === 'LOCKED' || state === 'UPCOMING') && day && (
        <div className="bg-arena-900 border border-arena-700 rounded-lg px-4 py-3 text-center space-y-1">
          <p className="text-gray-500 text-sm">🔒 LOCKED</p>
          {nowMs !== null && (
            <>
              <p className="text-[10px] text-gray-600 uppercase tracking-[0.25em] pt-2">Game starts in</p>
              <p className="font-mono text-3xl sm:text-4xl font-bold tracking-widest text-cyber-300">
                {formatCountdown(day.challengeStartTime, nowMs)}
              </p>
            </>
          )}
          <p className="text-gray-600 text-xs">{startTime} – {endTime}</p>
        </div>
      )}

      {/* OPEN — player hasn't started yet */}
      {state === 'OPEN' && challenge && !attempt && (
        <div className="space-y-3">
          <div className="bg-cyber-900/20 border border-cyber-800 rounded-lg px-4 py-3">
            <p className="text-cyber-300 text-sm font-semibold">⚡ Challenge window is open</p>
            <p className="text-gray-500 text-xs mt-0.5">
              Once you start, your personal timer begins. The game closes globally at {endTime} regardless.
            </p>
          </div>
          <button onClick={onEnter} className="btn-primary w-full py-4 text-base tracking-wide">
            ⚡ START GAME
          </button>
        </div>
      )}

      {/* IN_PROGRESS — player has active attempt */}
      {state === 'IN_PROGRESS' && attempt && (
        <div className="space-y-3">
          <div className="bg-amber-900/20 border border-amber-800 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-amber-300 text-xs font-bold uppercase tracking-widest mb-1">Your personal timer</p>
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
            <button onClick={onEnter} className="btn-primary flex-1 py-3 text-sm">
              ⚡ CONTINUE GAME
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
          <div className={`rounded-lg px-4 py-4 text-center space-y-2 ${state === 'COMPLETED'
            ? 'bg-emerald-900/20 border border-emerald-800'
            : 'bg-arena-900 border border-arena-700'
            }`}>
            <p className={`text-base font-bold ${state === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-300'}`}>
              {state === 'COMPLETED' ? '✓ SUBMISSION RECEIVED' : '⏱ TIME IS UP'}
            </p>
            <p className="text-gray-400 text-sm">
              Thank you for participating. Your challenge has been locked.
            </p>
            <p className="text-gray-500 text-xs">
              Please return to the group for your official result.
            </p>
          </div>
          <a href={groupLink} target="_blank" rel="noopener noreferrer"
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
            <span>💬</span> GO TO THE GROUP
          </a>
        </div>
      )}

      {/* CLOSED — global window ended, player never started */}
      {state === 'CLOSED' && (
        <div className="space-y-3">
          <div className="bg-arena-900 border border-arena-700 rounded-lg px-4 py-3 text-center">
            <p className="text-gray-400 text-sm">This challenge has closed.</p>
            <p className="text-gray-600 text-xs mt-1">Please return to the group for the official result.</p>
          </div>
          <a href={groupLink} target="_blank" rel="noopener noreferrer"
            className="btn-ghost w-full py-3 text-sm flex items-center justify-center gap-2">
            <span>💬</span> GO TO THE GROUP
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
    <div className={`flex min-h-[132px] flex-col items-start justify-between gap-3 px-4 py-4 rounded-lg border transition-colors
      ${isCurrentDay ? 'ring-1 ring-cyber-400/70 shadow-[0_0_24px_rgba(0,180,180,0.12)]' : ''}
      ${state === 'COMPLETED' ? 'bg-emerald-900/10 border-emerald-900' :
        isExpired ? 'bg-amber-900/10 border-amber-900' :
          isLive ? 'bg-cyber-900/15 border-cyber-800' :
            isSunday ? 'bg-gold-900/10 border-gold-900/30' :
              'bg-arena-900/50 border-arena-800'}`}>

      <div className="flex w-full items-start justify-between gap-2">
        {/* Day number badge */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0
        ${state === 'COMPLETED' ? 'bg-emerald-900 text-emerald-300 border border-emerald-700' :
            isExpired ? 'bg-amber-900 text-amber-300 border border-amber-700' :
              isLive ? 'bg-cyber-900 text-cyber-300 border border-cyber-700' :
                isSunday ? 'bg-gold-700 text-arena-950 border border-gold-500' :
                  'bg-arena-700 text-gray-400 border border-arena-600'}`}>
          {dayNumber}
        </div>

        {isCurrentDay && <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyber-300">Current day</span>}
      </div>

      {/* Day name + times */}
      <div className="w-full min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`text-sm font-semibold ${state === 'COMPLETED' ? 'text-emerald-300' : isExpired ? 'text-amber-300' : isLive ? 'text-cyber-300' : isSunday ? 'text-gold-300' : 'text-gray-300'}`}>
            {longName}
          </span>
        </div>
        {day ? (
          <>
            <p className="text-[11px] text-gray-600 font-mono mt-1">
              {fmtTime(day.challengeStartTime)} – {fmtTime(day.challengeEndTime)}
            </p>
            {isCurrentDay && state === 'UPCOMING' && nowMs !== null && (
              <p className="text-[10px] text-cyber-400 font-mono uppercase tracking-wider mt-2">
                Starts in {formatCountdown(day.challengeStartTime, nowMs)}
              </p>
            )}
          </>
        ) : (
          <p className="text-[11px] text-gray-700 mt-0.5">Schedule TBC</p>
        )}
      </div>

      {(state === 'LOCKED' || state === 'UPCOMING') && (
        <div className="w-full rounded border border-arena-700/80 bg-arena-950/70 px-3 py-2 space-y-1.5" aria-label="Game hidden until it opens">
          <p className="text-[9px] uppercase tracking-[0.2em] text-gray-600">Game hidden</p>
          <div className="space-y-1 opacity-60 blur-[2px]" aria-hidden="true">
            <div className="h-1.5 w-4/5 rounded bg-cyber-900" />
            <div className="h-1.5 w-3/5 rounded bg-danger-900" />
          </div>
        </div>
      )}

      {/* Status indicator */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`text-base ${state === 'COMPLETED' ? 'text-emerald-400' : isExpired ? 'text-amber-400' : isLive ? 'text-cyber-400' : 'text-gray-600'}`}>
          {dayStateIcon(state)}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-widest hidden sm:block
          ${state === 'COMPLETED' ? 'text-emerald-400' : isExpired ? 'text-amber-400' : isLive ? 'text-cyber-400' : 'text-gray-600'}`}>
          {dayStateLabel(state)}
        </span>
      </div>
    </div>
  );
}
