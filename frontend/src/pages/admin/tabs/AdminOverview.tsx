import { useEffect, useState } from 'react';
import { gamesApi } from '../../../lib/api';
import { Game } from '../../../types';

interface Props {
  onNavigate: (tab: 'overview' | 'games' | 'players' | 'challenges' | 'results' | 'announcements') => void;
}

export default function AdminOverview({ onNavigate }: Props) {
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; eliminated: number; finalists: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gamesApi.getAll().then((res) => {
      const g: Game[] = res.data.games || [];
      setGames(g);
      const active = g.find((gm) => gm.status === 'ACTIVE');
      if (active) {
        return gamesApi.getStats(active._id);
      }
      return null;
    }).then((statsRes) => {
      if (statsRes) setStats(statsRes.data.stats);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const activeGame = games.find((g) => g.status === 'ACTIVE');

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-cyber-700 border-t-cyber-400 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Admin Overview</h2>
        <p className="text-gray-500 text-sm mt-1">Game status and quick actions</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Games',   value: games.length,                 color: 'text-cyber-400' },
          { label: 'Total Players', value: stats?.total ?? activeGame?.totalPlayers ?? 0, color: 'text-amber-400' },
          { label: 'Still Active',  value: stats?.active ?? 0,           color: 'text-emerald-400' },
          { label: 'Eliminated',    value: stats?.eliminated ?? 0,       color: 'text-danger-400' },
        ].map((s) => (
          <div key={s.label} className="arena-card p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-3xl font-bold mt-2 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Active game card */}
      {activeGame ? (
        <div className="arena-card cyber-border p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0">Active Game</p>
            <span className="badge-active text-xs">LIVE</span>
          </div>
          <h3 className="text-white text-xl font-bold">{activeGame.name}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            {[
              { label: 'Status',    value: activeGame.status },
              { label: 'Day',       value: activeGame.currentDay > 0 ? `Day ${activeGame.currentDay}` : 'Not Started' },
              { label: 'Players',   value: activeGame.totalPlayers },
              { label: 'Finalists', value: `Top ${activeGame.targetFinalists}` },
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
          <p className="text-gray-400 mb-2">No active game</p>
          <button onClick={() => onNavigate('games')} className="btn-primary text-sm">
            Create a Game →
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p className="section-title">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Manage Games',         icon: '🎮', tab: 'games' as const },
            { label: 'Manage Players',        icon: '👥', tab: 'players' as const },
            { label: 'Manage Challenges',     icon: '⚡', tab: 'challenges' as const },
            { label: 'View Results',          icon: '📊', tab: 'results' as const },
            { label: 'Post Announcement',     icon: '📢', tab: 'announcements' as const },
            { label: 'Run Eliminations',      icon: '💀', tab: 'results' as const },
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

      {/* All games list */}
      {games.length > 0 && (
        <div className="arena-card p-5">
          <p className="section-title">All Games</p>
          <div className="space-y-2">
            {games.map((g) => (
              <div key={g._id} className="flex items-center justify-between py-3 border-b border-arena-700 last:border-0">
                <div>
                  <p className="text-white text-sm font-semibold">{g.name}</p>
                  <p className="text-gray-500 text-xs">{new Date(g.startDate).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{g.totalPlayers} players</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    g.status === 'ACTIVE' ? 'bg-emerald-900 text-emerald-400' :
                    g.status === 'DRAFT' ? 'bg-arena-700 text-gray-400' :
                    g.status === 'COMPLETED' ? 'bg-gold-600 text-gold-200' :
                    'bg-arena-700 text-gray-400'
                  }`}>
                    {g.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
