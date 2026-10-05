import { useEffect, useState } from 'react';
import { gamesApi } from '../../../lib/api';

interface Props {
  onNavigate: (tab: 'overview' | 'games' | 'players' | 'challenges' | 'results' | 'announcements') => void;
}

export default function AdminOverview({ onNavigate }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gamesApi.getAdminOverview().then(res => setData(res.data)).catch(() => { }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-cyber-700 border-t-cyber-400 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Admin Overview</h2>
        <p className="text-gray-500 text-sm mt-1">Game status and quick actions</p>
      </div>

      {/* Authoritative MongoDB-backed stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Seven Games', value: data?.stats.totalGames ?? 7, color: 'text-cyber-400' },
          { label: 'Registered Players', value: data?.stats.totalPlayers ?? 0, color: 'text-amber-400' },
          { label: 'Active Players', value: data?.stats.activePlayers ?? 0, color: 'text-emerald-400' },
          { label: 'Eliminated', value: data?.stats.eliminated ?? 0, color: 'text-danger-400' },
        ].map((s) => (
          <div key={s.label} className="arena-card p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-3xl font-bold mt-2 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Current schedule window */}
      {data?.today ? (
        <div className="arena-card cyber-border p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0">Active Game</p>
            <span className="badge-active text-xs">LIVE</span>
          </div>
          <h3 className="text-white text-xl font-bold">Day {data.today.dayNumber} — {data.today.challenge?.title || 'Scheduled challenge'}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            {[
              { label: 'Status', value: 'OPEN' },
              { label: 'Submitted', value: data.stats.submittedToday },
              { label: 'Waiting', value: data.stats.pendingToday },
              { label: 'Expired', value: data.stats.expiredToday },
            ].map((m) => (
              <div key={m.label}>
                <p className="text-xs text-gray-500 uppercase tracking-wider">{m.label}</p>
                <p className="text-white font-semibold mt-1">{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="arena-card p-8 text-center">
          <p className="text-gray-300 mb-2">No game is live right now.</p>
          <button onClick={() => onNavigate('games')} className="btn-primary text-sm">
            View seven-day schedule →
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p className="section-title">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Manage Games', icon: '🎮', tab: 'games' as const },
            { label: 'Manage Players', icon: '👥', tab: 'players' as const },
            { label: 'Manage Challenges', icon: '⚡', tab: 'challenges' as const },
            { label: 'View Results', icon: '📊', tab: 'results' as const },
            { label: 'Post Announcement', icon: '📢', tab: 'announcements' as const },
            { label: 'Run Eliminations', icon: '💀', tab: 'results' as const },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.tab)}
              className="arena-card p-4 text-left hover:border-cyber-700 hover:bg-arena-700 transition-all group"
            >
              <span className="text-2xl block mb-2">{action.icon}</span>
              <p className="text-gray-300 group-hover:text-white text-sm font-medium transition-colors">{action.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          ['Completed today', data?.stats.completedGames ?? 0],
          ['Today submitted', data?.stats.submittedToday ?? 0],
          ['Waiting to play', data?.stats.pendingToday ?? 0],
          ['Time expired', data?.stats.expiredToday ?? 0],
          ['Finalists', data?.stats.finalists ?? 0],
        ].map(([label, value]) => <div key={String(label)} className="arena-card p-4"><p className="text-xs text-gray-500 uppercase">{label}</p><p className="text-2xl text-white font-bold mt-2">{value}</p></div>)}
      </div>
    </div>
  );
}
