/**
 * DashboardPage — Admin-controlled game architecture.
 * Always shows all 7 games. Locked = blurred. No countdown.
 * Admin OPEN/CLOSE is the sole authority.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { gamesApi, challengesApi } from '../lib/api';
import { getSocket, joinGameRoom } from '../lib/socket';
import CountdownTimer from '../components/shared/CountdownTimer';
import { Challenge, ChallengeAttempt, Announcement } from '../types';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const DAY_THEMES = [
  { name: 'THE BROKEN MACHINE', type: 'BROKEN_MACHINE', icon: '⚙', desc: 'Repair the circuit. Rotate nodes to restore the signal path.' },
  { name: 'THE PATTERN VAULT', type: 'PATTERN_VAULT', icon: '◆', desc: 'Discover hidden transformation rules. Reconstruct the vault states.' },
  { name: 'THE MEMORY VAULT', type: 'MEMORY_VAULT', icon: '🧠', desc: 'Memorise the room. Answer from memory.' },
  { name: 'THE CIPHER ROOM', type: 'CIPHER_ROOM', icon: '🔐', desc: 'Four connected locks. Each answer feeds the next.' },
  { name: 'THE RULE TRAP', type: 'RULE_TRAP', icon: '⚡', desc: 'Discover the hidden rule using limited probes.' },
  { name: 'THE BLACK VAULT', type: 'BLACK_VAULT', icon: '🕳', desc: 'Five connected stages. Earn every key.' },
  { name: 'THE FINAL VAULT', type: 'FINAL_VAULT', icon: '🏆', desc: 'Championship. Five stages. One winner.' },
];

interface DayData {
  _id: string;
  dayNumber: number;
  dayOfWeek: string;
  status: 'OPEN' | 'CLOSED' | 'UPCOMING' | 'COMPLETED';
  challenge: {
    _id: string; title: string; description: string;
    difficulty: string; challengeType: string;
    durationSeconds: number; maxAttempts: number;
    totalStages: number; maxScore: number;
    isOpen: boolean; isActive: boolean;
  } | null;
}

interface GameInfo {
  _id: string;
  name: string;
  groupLink: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [days, setDays] = useState<DayData[]>([]);
  const [attemptMap, setAttemptMap] = useState<Record<string, ChallengeAttempt>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const groupLink = gameInfo?.groupLink || import.meta.env.VITE_GROUP_LINK || '#';

  const load = useCallback(async () => {
    try {
      const res = await gamesApi.getAllDays();
      if (res.data.success) {
        setGameInfo(res.data.game);
        setDays(res.data.days || []);

        // If a game exists, fetch announcements + attempts
        if (res.data.game) {
          const annRes = await gamesApi.getAnnouncements(res.data.game._id).catch(() => ({ data: { announcements: [] } }));
          setAnnouncements((annRes.data.announcements || []).slice(0, 4));

          // Fetch my attempt for each day's challenge
          const newMap: Record<string, ChallengeAttempt> = {};
          for (const day of (res.data.days || []) as DayData[]) {
            if (day.challenge?.isActive) {
              try {
                const aRes = await challengesApi.getMyAttempt(day.challenge._id);
                if (aRes.data.attempt) newMap[day.challenge._id] = aRes.data.attempt as ChallengeAttempt;
              } catch { /* not enrolled or no attempt */ }
            }
          }
          setAttemptMap(newMap);
        }
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Socket — refresh when admin opens/closes a game
  useEffect(() => {
    if (!gameInfo) return;
    const socket = getSocket();
    if (!socket) return;
    joinGameRoom(gameInfo._id);
    socket.on('game:day:opened', () => { toast.success('A game has opened!'); load(); });
    socket.on('game:day:closed', () => { load(); });
    socket.on('announcement', (ann: Announcement) => {
      toast(ann.title, { icon: '📢' });
      setAnnouncements(prev => [ann, ...prev].slice(0, 4));
    });
    return () => {
      socket.off('game:day:opened');
      socket.off('game:day:closed');
      socket.off('announcement');
    };
  }, [gameInfo, load]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getAttempt = (challengeId: string) => attemptMap[challengeId];

  const isCompleted = (day: DayData) => {
    if (!day.challenge) return false;
    const att = getAttempt(day.challenge._id);
    return att?.status === 'COMPLETED' || att?.status === 'TIME_EXPIRED';
  };

  const completedCount = days.filter(isCompleted).length;
  const openDay = days.find(d => d.status === 'OPEN');

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
          <span className="text-cyber-400">⚔</span>
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

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Player identity */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-cyber-400 text-xs tracking-[0.3em] uppercase mb-0.5">Welcome back</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{user?.nickname || user?.playerTag}</h1>
            <p className="text-gray-600 text-sm font-mono">{user?.playerTag}</p>
          </div>
          {completedCount > 0 && (
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Challenges Done</p>
              <p className="text-2xl font-bold text-white">{completedCount}<span className="text-gray-600 text-sm">/7</span></p>
            </div>
          )}
        </div>

        {/* Active challenge card — shown prominently when a game is open */}
        {openDay?.challenge && (() => {
          const ch = openDay.challenge!;
          const attempt = getAttempt(ch._id);
          const done = isCompleted(openDay);
          const theme = DAY_THEMES[openDay.dayNumber - 1];

          return (
            <div className="arena-card cyber-border-active p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-cyber-400 text-xs tracking-[0.3em] uppercase mb-1">🟢 NOW OPEN</p>
                  <h2 className="text-xl font-bold text-white">
                    {theme?.icon} Day {openDay.dayNumber} — {theme?.name ?? ch.title}
                  </h2>
                  <p className="text-gray-400 text-sm mt-0.5">{ch.description || theme?.desc}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${ch.difficulty === 'HARD' ? 'bg-orange-900 text-orange-400' :
                    ch.difficulty === 'EXTREME' ? 'bg-danger-900 text-danger-400' :
                      'bg-amber-900 text-amber-400'}`}>
                  {ch.difficulty}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-arena-900 rounded px-3 py-2">
                  <p className="text-gray-500">Personal Timer</p>
                  <p className="text-white font-mono font-bold">{Math.round(ch.durationSeconds / 60)} min</p>
                </div>
                <div className="bg-arena-900 rounded px-3 py-2">
                  <p className="text-gray-500">Stages</p>
                  <p className="text-white font-mono font-bold">{ch.totalStages}</p>
                </div>
              </div>

              {/* Attempt-based UI */}
              {done ? (
                <div className="space-y-3">
                  <div className={`rounded-lg px-4 py-3 text-center ${attempt?.status === 'COMPLETED' ? 'bg-emerald-900/20 border border-emerald-800' : 'bg-arena-900 border border-arena-700'}`}>
                    <p className={`text-sm font-bold ${attempt?.status === 'COMPLETED' ? 'text-emerald-400' : 'text-gray-300'}`}>
                      {attempt?.status === 'COMPLETED' ? '✓ SUBMISSION RECEIVED' : '⏱ TIME EXPIRED'}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">Please return to the group for your official result.</p>
                  </div>
                  <a href={groupLink} target="_blank" rel="noopener noreferrer"
                    className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm">
                    <span>💬</span> GO TO THE GROUP
                  </a>
                </div>
              ) : attempt?.status === 'IN_PROGRESS' ? (
                <div className="space-y-3">
                  <div className="bg-amber-900/20 border border-amber-800 rounded-lg px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">Personal Timer</p>
                      <CountdownTimer deadlineAt={attempt.deadlineAt} onExpire={load} />
                    </div>
                    <p className="text-gray-600 text-xs text-right">Server-controlled<br />Refresh-safe</p>
                  </div>
                  <button onClick={() => navigate(`/challenge/${ch._id}`)}
                    className="btn-primary w-full py-4 text-base">
                    ⚡ RESUME CHALLENGE
                  </button>
                </div>
              ) : (
                <button onClick={() => navigate(`/challenge/${ch._id}`)}
                  className="btn-primary w-full py-4 text-base tracking-wide">
                  ⚡ START CHALLENGE
                </button>
              )}
            </div>
          );
        })()}

        {/* 7-day journey */}
        <div className="arena-card p-5 space-y-3">
          <p className="section-title">YOUR SEVEN DAY JOURNEY</p>

          {Array.from({ length: 7 }, (_, i) => {
            const dayNum = i + 1;
            const day = days.find(d => d.dayNumber === dayNum);
            const theme = DAY_THEMES[i];
            const ch = day?.challenge;
            const att = ch ? getAttempt(ch._id) : undefined;
            const done = day ? isCompleted(day) : false;
            const isOpen = day?.status === 'OPEN';
            const isDay7 = dayNum === 7;

            return (
              <div
                key={dayNum}
                className={`rounded-xl border transition-all overflow-hidden
                  ${done ? 'border-emerald-800 bg-emerald-900/10' :
                    isOpen ? 'border-cyber-700 bg-cyber-900/10' :
                      isDay7 ? 'border-gold-800/40 bg-arena-900/50' :
                        'border-arena-700 bg-arena-900/30'}`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Day number */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 border
                    ${done ? 'bg-emerald-900 border-emerald-600 text-emerald-300' :
                      isOpen ? 'bg-cyber-900 border-cyber-600 text-cyber-300' :
                        isDay7 ? 'bg-gold-700 border-gold-500 text-arena-950' :
                          'bg-arena-700 border-arena-600 text-gray-400'}`}>
                    {done ? '✓' : dayNum}
                  </div>

                  {/* Name + desc */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{theme.icon}</span>
                      <span className={`text-sm font-semibold truncate
                        ${done ? 'text-emerald-300' : isOpen ? 'text-cyber-200' : isDay7 ? 'text-gold-300' : 'text-gray-400'}`}>
                        Day {dayNum} — {theme.name}
                        {isDay7 && <span className="text-[10px] text-gold-500 ml-1.5 uppercase tracking-wider">Final</span>}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 mt-0.5 truncate">{theme.desc}</p>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    {done ? (
                      <span className="text-xs font-bold text-emerald-400">✓ DONE</span>
                    ) : isOpen ? (
                      att?.status === 'IN_PROGRESS' ? (
                        <span className="text-xs font-bold text-amber-400 animate-pulse">● LIVE</span>
                      ) : (
                        <button onClick={() => ch && navigate(`/challenge/${ch._id}`)}
                          className="text-xs font-bold bg-cyber-800 text-cyber-300 border border-cyber-600 px-2.5 py-1 rounded-lg hover:bg-cyber-700 transition-colors">
                          PLAY →
                        </button>
                      )
                    ) : (
                      <span className="text-lg">🔒</span>
                    )}
                  </div>
                </div>

                {/* Blurred locked overlay for non-open games */}
                {!isOpen && !done && (
                  <div className="px-4 pb-3">
                    <div className="rounded-lg bg-arena-800/60 h-8 flex items-center justify-center"
                      style={{ filter: 'blur(3px)', pointerEvents: 'none', userSelect: 'none' }}>
                      <div className="flex gap-2">
                        {Array.from({ length: 6 }, (_, j) => (
                          <div key={j} className="w-5 h-5 bg-arena-600 rounded" />
                        ))}
                      </div>
                    </div>
                    <p className="text-center text-gray-600 text-[10px] mt-1.5 uppercase tracking-wider">
                      🔒 Waiting for admin to open this game
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Announcements */}
        {announcements.length > 0 && (
          <div className="arena-card p-5 space-y-3">
            <p className="section-title">Announcements</p>
            {announcements.map(ann => (
              <div key={ann._id} className="flex gap-3 py-2 border-b border-arena-700 last:border-0">
                <span className="text-base shrink-0">
                  {ann.type === 'CHALLENGE_OPEN' ? '⚡' : ann.type === 'WARNING' ? '⚠️' : '📢'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold">{ann.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5 leading-relaxed line-clamp-2">{ann.message}</p>
                  {ann.publishedAt && (
                    <p className="text-gray-600 text-xs mt-1">
                      {formatDistanceToNow(new Date(ann.publishedAt), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Group footer */}
        <div className="arena-card p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-white text-sm font-semibold">Official Results Channel</p>
            <p className="text-gray-500 text-xs mt-0.5">All results are announced in the group by the admin.</p>
          </div>
          <a href={groupLink} target="_blank" rel="noopener noreferrer"
            className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shrink-0">
            <span>💬</span> GROUP
          </a>
        </div>
      </div>
    </div>
  );
}
