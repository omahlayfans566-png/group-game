import { useEffect, useState, useCallback } from 'react';
import { gamesApi, challengesApi } from '../../../lib/api';
import { eliminationApi } from '../../../lib/api';
import { Game, GameDay, Challenge, PlayerGame, User } from '../../../types';
import StatusBadge from '../../../components/shared/StatusBadge';
import toast from 'react-hot-toast';

interface AttemptRecord {
  _id: string;
  userId: User | null;
  status: string;
  score: number;
  maxScore: number;
  timeTakenSeconds?: number;
  attemptNumber: number;
  startedAt: string;
  completedAt?: string;
  currentStage: number;
  totalStages: number;
  stageHistory: Array<{ stage: number; isCorrect: boolean; score: number; timeTakenSeconds?: number; answerPayload?: Record<string, unknown> }>;
}

interface ScheduleDay {
  _id: string; dayNumber: number; dayOfWeek: string;
  eliminationCount: number; eliminationsProcessed: boolean; status: string;
}
interface ScheduleStats {
  activePlayers: number; targetFinalists: number;
  requiredEliminations: number; scheduledTotal: number;
  isValid: boolean; difference: number;
}

type SortField = 'score' | 'time' | 'playerNumber' | 'nickname' | 'status';
type SortDir = 'asc' | 'desc';

export default function AdminResults() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState('');
  const [days, setDays] = useState<GameDay[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [players, setPlayers] = useState<PlayerGame[]>([]);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState('');
  const [selectedDayNum, setSelectedDayNum] = useState<number | ''>('');
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [scheduleStats, setScheduleStats] = useState<ScheduleStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'standings' | 'attempts' | 'schedule'>('attempts');
  const [runningElim, setRunningElim] = useState<string | null>(null);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [winnerUserId, setWinnerUserId] = useState('');
  const [declaringWinner, setDeclaringWinner] = useState(false);
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    gamesApi.getAll().then(r => setGames(r.data.games || [])).catch(() => { });
  }, []);

  const loadGameData = useCallback(async (gameId: string) => {
    if (!gameId) return;
    setLoading(true);
    try {
      const [dRes, cRes, pRes, sRes] = await Promise.all([
        gamesApi.getDays(gameId),
        challengesApi.getAll({ gameId }),
        gamesApi.getPlayers(gameId),
        eliminationApi.getSchedule(gameId),
      ]);
      setDays(dRes.data.days || []);
      setChallenges(cRes.data.challenges || []);
      setPlayers(pRes.data.players || []);
      setSchedule(sRes.data.schedule || []);
      setScheduleStats(sRes.data.stats);
    } catch { toast.error('Failed to load game data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (selectedGameId) loadGameData(selectedGameId); }, [selectedGameId, loadGameData]);

  useEffect(() => {
    if (!selectedChallengeId) return;
    challengesApi.getAttempts(selectedChallengeId).then(r => setAttempts(r.data.attempts || [])).catch(() => { });
  }, [selectedChallengeId]);

  // Filter challenges by day
  const filteredChallenges = selectedDayNum !== ''
    ? challenges.filter(c => c.dayNumber === selectedDayNum)
    : challenges;

  // Sort and filter attempts
  const sortedAttempts = [...attempts]
    .filter(a => !filterStatus || a.status === filterStatus)
    .sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortField === 'score') { av = a.score; bv = b.score; }
      else if (sortField === 'time') { av = a.timeTakenSeconds ?? 9999; bv = b.timeTakenSeconds ?? 9999; }
      else if (sortField === 'playerNumber') { av = a.userId?.playerNumber ?? 9999; bv = b.userId?.playerNumber ?? 9999; }
      else if (sortField === 'nickname') { av = a.userId?.nickname ?? ''; bv = b.userId?.nickname ?? ''; }
      else if (sortField === 'status') { av = a.status; bv = b.status; }
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return sortDir === 'desc' ? -cmp : cmp;
    });

  const setSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortIcon = (f: SortField) => sortField === f ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  const getP = (pg: PlayerGame) => {
    const u = pg.userId;
    if (typeof u === 'object' && u !== null) {
      return {
        tag: (u as User).playerTag ?? '???',
        nick: (u as User).nickname ?? '—',
        id: (u as User)._id,
        num: (u as User).playerNumber,
      };
    }
    return { tag: String(u), nick: '—', id: String(u), num: 0 };
  };

  const getAP = (a: AttemptRecord) => ({
    tag: a.userId?.playerTag ?? '???',
    nick: a.userId?.nickname ?? '—',
    num: a.userId?.playerNumber ?? 0,
  });

  const handleAutoGenerate = async () => {
    if (!selectedGameId) return;
    setGeneratingSchedule(true);
    try {
      const res = await eliminationApi.autoGenerate(selectedGameId);
      toast.success(res.data.message);
      loadGameData(selectedGameId);
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed');
    } finally { setGeneratingSchedule(false); }
  };

  const handleRunElim = async (dayId: string, dayNum: number, count: number) => {
    if (!confirm(`Eliminate bottom ${count} players from Day ${dayNum}?`)) return;
    setRunningElim(dayId);
    try {
      const res = await eliminationApi.runElimination(selectedGameId, dayId);
      toast.success(res.data.message);
      if (res.data.finalistsReached) toast('🎉 Finalists reached!', { icon: '⭐' });
      loadGameData(selectedGameId);
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed');
    } finally { setRunningElim(null); }
  };

  const handleDeclareWinner = async () => {
    if (!winnerUserId || !selectedGameId || !confirm('Declare this player the WINNER?')) return;
    setDeclaringWinner(true);
    try {
      const { playersApi } = await import('../../../lib/api');
      await playersApi.declareWinner(selectedGameId, winnerUserId);
      toast.success('🏆 Winner declared!');
      loadGameData(selectedGameId);
    } catch { toast.error('Failed'); }
    finally { setDeclaringWinner(false); }
  };

  const activePlayers = players.filter(p => ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'SAFE', 'FINALIST'].includes(p.status));
  const finalists = players.filter(p => p.status === 'FINALIST');
  const selectedChall = challenges.find(c => c._id === selectedChallengeId);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-cyber-700 border-t-cyber-400 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">Results & Elimination</h2>
        <select value={selectedGameId} onChange={e => setSelectedGameId(e.target.value)}
          className="bg-arena-800 border border-arena-600 text-white text-sm px-3 py-2 rounded max-w-xs">
          <option value="">Select game…</option>
          {games.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
        </select>
      </div>

      {!selectedGameId && <p className="text-gray-500 text-center py-12">Select a game to view results</p>}

      {selectedGameId && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 bg-arena-900 rounded-lg p-1">
            {(['attempts', 'standings', 'schedule'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all
                  ${activeTab === tab ? 'bg-cyber-800 text-cyber-300' : 'text-gray-500 hover:text-gray-300'}`}>
                {tab === 'attempts' ? '📊 Attempt Details' : tab === 'standings' ? '👥 Standings' : '💀 Elimination'}
              </button>
            ))}
          </div>

          {/* ── ATTEMPTS TAB ── */}
          {activeTab === 'attempts' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Day</label>
                  <select value={selectedDayNum}
                    onChange={e => { setSelectedDayNum(e.target.value === '' ? '' : Number(e.target.value)); setSelectedChallengeId(''); }}
                    className="bg-arena-800 border border-arena-600 text-white text-sm px-3 py-2 rounded">
                    <option value="">All Days</option>
                    {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>Day {d}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Challenge</label>
                  <select value={selectedChallengeId} onChange={e => setSelectedChallengeId(e.target.value)}
                    className="bg-arena-800 border border-arena-600 text-white text-sm px-3 py-2 rounded">
                    <option value="">Select challenge…</option>
                    {filteredChallenges.map(c => <option key={c._id} value={c._id}>Day {c.dayNumber} — {c.title}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Status</label>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="bg-arena-800 border border-arena-600 text-white text-sm px-3 py-2 rounded">
                    <option value="">All</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="TIME_EXPIRED">TIME_EXPIRED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                  </select>
                </div>
                {sortedAttempts.length > 0 && (
                  <div className="text-xs text-gray-500 self-end pb-2 ml-auto">
                    {sortedAttempts.length} attempt(s)
                  </div>
                )}
              </div>

              {/* Challenge summary */}
              {selectedChall && (
                <div className="arena-card p-4 flex flex-wrap gap-4 text-sm">
                  <div><p className="text-xs text-gray-500">Challenge</p><p className="text-white font-bold">{selectedChall.title}</p></div>
                  <div><p className="text-xs text-gray-500">Day</p><p className="text-cyber-400 font-bold">{selectedChall.dayNumber}</p></div>
                  <div><p className="text-xs text-gray-500">Type</p><p className="text-amber-400 font-mono text-xs">{selectedChall.challengeType}</p></div>
                  <div><p className="text-xs text-gray-500">Timer</p><p className="text-white">{Math.round(selectedChall.durationSeconds / 60)}min</p></div>
                  <div><p className="text-xs text-gray-500">Max Score</p><p className="text-white">{selectedChall.maxScore}</p></div>
                  <div><p className="text-xs text-gray-500">Submitted</p><p className="text-emerald-400 font-bold">{sortedAttempts.filter(a => a.status === 'COMPLETED').length}</p></div>
                  <div><p className="text-xs text-gray-500">Expired</p><p className="text-danger-400 font-bold">{sortedAttempts.filter(a => a.status === 'TIME_EXPIRED').length}</p></div>
                </div>
              )}

              {/* Attempts table */}
              {sortedAttempts.length > 0 && (
                <div className="arena-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-arena-700">
                          <th onClick={() => setSort('playerNumber')} className="text-left text-xs text-gray-500 uppercase px-3 py-2 cursor-pointer hover:text-white">
                            Player{sortIcon('playerNumber')}
                          </th>
                          <th onClick={() => setSort('nickname')} className="text-left text-xs text-gray-500 uppercase px-3 py-2 cursor-pointer hover:text-white">
                            Nickname{sortIcon('nickname')}
                          </th>
                          <th onClick={() => setSort('score')} className="text-right text-xs text-gray-500 uppercase px-3 py-2 cursor-pointer hover:text-white">
                            Score{sortIcon('score')}
                          </th>
                          <th onClick={() => setSort('time')} className="text-right text-xs text-gray-500 uppercase px-3 py-2 cursor-pointer hover:text-white">
                            Time{sortIcon('time')}
                          </th>
                          <th className="text-right text-xs text-gray-500 uppercase px-3 py-2">Attempt</th>
                          <th onClick={() => setSort('status')} className="text-right text-xs text-gray-500 uppercase px-3 py-2 cursor-pointer hover:text-white">
                            Status{sortIcon('status')}
                          </th>
                          <th className="text-right text-xs text-gray-500 uppercase px-3 py-2">Stages</th>
                          <th className="text-right text-xs text-gray-500 uppercase px-3 py-2">Started</th>
                          <th className="text-right text-xs text-gray-500 uppercase px-3 py-2">Submitted</th>
                          <th className="px-3 py-2 text-xs text-gray-500 uppercase">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedAttempts.map(att => {
                          const p = getAP(att);
                          const timeRemaining = att.completedAt
                            ? Math.max(0, selectedChall?.durationSeconds ?? 0 - (att.timeTakenSeconds ?? 0))
                            : 0;
                          const stagesDone = att.stageHistory?.filter(s => s.isCorrect).length ?? 0;
                          const stagesFailed = att.stageHistory?.filter(s => !s.isCorrect).length ?? 0;
                          return (
                            <>
                              <tr key={att._id} className="border-b border-arena-800 hover:bg-arena-800/30 transition-colors">
                                <td className="px-3 py-2 font-mono text-cyber-400 font-bold text-xs">{p.tag}</td>
                                <td className="px-3 py-2 text-white text-sm">{p.nick}</td>
                                <td className="px-3 py-2 text-right font-mono text-amber-400 font-bold">{att.score}/{att.maxScore}</td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-gray-400">
                                  {att.timeTakenSeconds != null ? `${att.timeTakenSeconds}s` : '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-500 text-xs">#{att.attemptNumber}</td>
                                <td className="px-3 py-2 text-right">
                                  <span className={`text-xs font-bold ${att.status === 'COMPLETED' ? 'text-emerald-400' :
                                      att.status === 'TIME_EXPIRED' ? 'text-danger-400' :
                                        att.status === 'IN_PROGRESS' ? 'text-amber-400 animate-pulse' : 'text-gray-500'
                                    }`}>{att.status}</span>
                                </td>
                                <td className="px-3 py-2 text-right text-xs">
                                  <span className="text-emerald-400">{stagesDone}✓</span>
                                  {stagesFailed > 0 && <span className="text-danger-400 ml-1">{stagesFailed}✗</span>}
                                  <span className="text-gray-600">/{att.totalStages}</span>
                                </td>
                                <td className="px-3 py-2 text-right text-xs text-gray-600">
                                  {att.startedAt ? new Date(att.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-xs text-gray-600">
                                  {att.completedAt ? new Date(att.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                                </td>
                                <td className="px-3 py-2">
                                  <button onClick={() => setExpandedAttempt(expandedAttempt === att._id ? null : att._id)}
                                    className="text-xs text-gray-500 hover:text-cyber-400 transition-colors">
                                    {expandedAttempt === att._id ? '▲' : '▼'}
                                  </button>
                                </td>
                              </tr>

                              {/* ── Expanded detail row ── */}
                              {expandedAttempt === att._id && (
                                <tr key={`${att._id}-detail`} className="bg-arena-900/60">
                                  <td colSpan={10} className="px-4 py-4">
                                    <div className="space-y-3">
                                      {/* Summary cards */}
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                        <div className="bg-arena-800 rounded-lg p-3">
                                          <p className="text-gray-500 uppercase tracking-wider mb-1">Score</p>
                                          <p className="text-amber-400 font-bold text-base">{att.score} / {att.maxScore}</p>
                                          <p className="text-gray-600">{Math.round((att.score / Math.max(att.maxScore, 1)) * 100)}%</p>
                                        </div>
                                        <div className="bg-arena-800 rounded-lg p-3">
                                          <p className="text-gray-500 uppercase tracking-wider mb-1">Time</p>
                                          <p className="text-white font-bold text-base">{att.timeTakenSeconds ?? '—'}s</p>
                                          <p className="text-gray-600">of {selectedChall?.durationSeconds}s</p>
                                        </div>
                                        <div className="bg-arena-800 rounded-lg p-3">
                                          <p className="text-gray-500 uppercase tracking-wider mb-1">Stages</p>
                                          <p className="text-emerald-400 font-bold text-base">{stagesDone} correct</p>
                                          <p className="text-danger-400">{stagesFailed} incorrect</p>
                                        </div>
                                        <div className="bg-arena-800 rounded-lg p-3">
                                          <p className="text-gray-500 uppercase tracking-wider mb-1">Attempt</p>
                                          <p className="text-white font-bold text-base">#{att.attemptNumber}</p>
                                          <p className={`${att.status === 'COMPLETED' ? 'text-emerald-400' : 'text-danger-400'}`}>{att.status}</p>
                                        </div>
                                      </div>

                                      {/* Per-stage breakdown */}
                                      {att.stageHistory?.length > 0 && (
                                        <div>
                                          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Stage Breakdown</p>
                                          <div className="space-y-1.5">
                                            {att.stageHistory.map(sh => (
                                              <div key={sh.stage} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs
                                                ${sh.isCorrect ? 'bg-emerald-900/20 border border-emerald-800' : 'bg-danger-900/20 border border-danger-800'}`}>
                                                <span className="text-gray-500 font-mono w-6">S{sh.stage}</span>
                                                <span className={`font-bold ${sh.isCorrect ? 'text-emerald-400' : 'text-danger-400'}`}>
                                                  {sh.isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}
                                                </span>
                                                <span className="text-gray-400 font-mono">{sh.score} pts</span>
                                                {sh.timeTakenSeconds && (
                                                  <span className="text-gray-600">{sh.timeTakenSeconds}s</span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedChallengeId && sortedAttempts.length === 0 && (
                <p className="text-gray-500 text-center py-8">No attempts yet for this challenge.</p>
              )}
            </div>
          )}

          {/* ── STANDINGS TAB ── */}
          {activeTab === 'standings' && (
            <div className="space-y-4">
              <div className="arena-card overflow-hidden">
                <div className="px-5 py-3 border-b border-arena-700 flex items-center justify-between">
                  <p className="section-title mb-0">Player Standings</p>
                  <p className="text-gray-500 text-xs">{activePlayers.length} active · {players.filter(p => p.status === 'ELIMINATED').length} eliminated</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-arena-700">
                      <th className="text-left text-xs text-gray-500 uppercase px-4 py-2">#</th>
                      <th className="text-left text-xs text-gray-500 uppercase px-4 py-2">Player ID</th>
                      <th className="text-left text-xs text-gray-500 uppercase px-4 py-2">Nickname</th>
                      <th className="text-left text-xs text-gray-500 uppercase px-4 py-2">Status</th>
                      <th className="text-right text-xs text-gray-500 uppercase px-4 py-2">Total Score</th>
                      <th className="text-right text-xs text-gray-500 uppercase px-4 py-2">Elim. Day</th>
                    </tr></thead>
                    <tbody>
                      {players.length === 0 && <tr><td colSpan={6} className="text-center text-gray-500 py-8">No players enrolled</td></tr>}
                      {[...players].sort((a, b) => b.totalScore - a.totalScore).map((pg, idx) => {
                        const p = getP(pg);
                        return (
                          <tr key={pg._id} className="border-b border-arena-800 hover:bg-arena-800/40">
                            <td className="px-4 py-2 text-gray-600 text-xs">{idx + 1}.</td>
                            <td className="px-4 py-2 font-mono text-cyber-400 font-bold text-xs">{p.tag}</td>
                            <td className="px-4 py-2 text-white text-sm">{p.nick}</td>
                            <td className="px-4 py-2"><StatusBadge status={pg.status} size="sm" /></td>
                            <td className="px-4 py-2 text-right font-mono text-amber-400 font-bold">{pg.totalScore}</td>
                            <td className="px-4 py-2 text-right text-gray-500 text-xs">{pg.dayEliminated ? `Day ${pg.dayEliminated}` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Declare winner */}
              {finalists.length >= 2 && (
                <div className="arena-card p-5 space-y-3" style={{ borderColor: '#c9920a' }}>
                  <p className="section-title text-gold-400">🏆 Declare Winner</p>
                  <div className="flex items-center gap-3">
                    <select value={winnerUserId} onChange={e => setWinnerUserId(e.target.value)} className="arena-input text-sm flex-1 max-w-xs">
                      <option value="">Select finalist…</option>
                      {finalists.map(pg => { const p = getP(pg); return <option key={pg._id} value={p.id}>{p.tag} — {p.nick}</option>; })}
                    </select>
                    <button onClick={handleDeclareWinner} disabled={!winnerUserId || declaringWinner} className="btn-gold text-sm py-2 px-4">
                      {declaringWinner ? 'Declaring…' : '🏆 Declare Winner'}
                    </button>
                  </div>
                  <p className="text-amber-600 text-xs">Winner will NOT be shown publicly. Announce in the group.</p>
                </div>
              )}
            </div>
          )}

          {/* ── SCHEDULE TAB ── */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              {scheduleStats && (
                <div className={`rounded-lg px-5 py-4 border ${scheduleStats.isValid ? 'bg-emerald-900/20 border-emerald-800' : 'bg-amber-900/20 border-amber-700'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-sm font-bold ${scheduleStats.isValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {scheduleStats.isValid ? '✓ Schedule valid' : '⚠ Schedule needs adjustment'}
                    </p>
                    <button onClick={handleAutoGenerate} disabled={generatingSchedule} className="btn-primary text-xs py-1.5 px-3">
                      {generatingSchedule ? 'Generating…' : '⚡ Auto-Generate'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div><p className="text-gray-500">Active Players</p><p className="text-white font-bold text-base">{scheduleStats.activePlayers}</p></div>
                    <div><p className="text-gray-500">Required Eliminations</p><p className="text-white font-bold text-base">{scheduleStats.requiredEliminations}</p></div>
                    <div><p className="text-gray-500">Scheduled</p><p className={`font-bold text-base ${scheduleStats.isValid ? 'text-emerald-400' : 'text-amber-400'}`}>{scheduleStats.scheduledTotal}</p></div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {schedule.filter(d => d.dayNumber <= 6).map(day => (
                  <div key={day._id} className="arena-card p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-arena-700 rounded-lg flex items-center justify-center text-white font-bold text-sm">{day.dayNumber}</div>
                      <div>
                        <p className="text-white text-sm font-semibold">{day.dayOfWeek}</p>
                        <p className="text-gray-500 text-xs">{day.eliminationCount} eliminations {day.eliminationsProcessed ? '✓ done' : '— pending'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${day.status === 'OPEN' ? 'bg-emerald-900 text-emerald-400' :
                          day.status === 'COMPLETED' ? 'bg-cyber-900 text-cyber-400' : 'bg-arena-700 text-gray-500'
                        }`}>{day.status}</span>
                      {!day.eliminationsProcessed && ['CLOSED', 'RESULTS', 'COMPLETED'].includes(day.status) && day.eliminationCount > 0 && (
                        <button onClick={() => handleRunElim(day._id, day.dayNumber, day.eliminationCount)}
                          disabled={runningElim === day._id} className="btn-danger text-xs py-1.5 px-3">
                          {runningElim === day._id ? 'Running…' : `Eliminate ${day.eliminationCount}`}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
