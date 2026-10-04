import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { gamesApi } from '../lib/api';
import { Game } from '../types';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [activeGame, setActiveGame] = useState<Game | null>(null);

  useEffect(() => {
    gamesApi
      .getAll()
      .then((res) => {
        const games: Game[] = res.data.games || [];
        const active = games.find((g) => g.status === 'ACTIVE') || games[0] || null;
        setActiveGame(active);
      })
      .catch(() => { });
  }, []);

  const handleEnter = () => {
    if (isAuthenticated) {
      navigate(user?.role === 'admin' ? '/admin' : '/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-arena-950 flex flex-col overflow-hidden">
      {/* Background grid overlay */}
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none" />

      {/* Ambient glow spots */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-cyber-900 rounded-full blur-[120px] opacity-20 pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-danger-900 rounded-full blur-[120px] opacity-20 pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-arena-700">
        <div className="flex items-center gap-3">
          <span className="text-cyber-400 text-xl">⚔</span>
          <span className="text-white font-bold tracking-[0.15em] text-sm uppercase">
            {import.meta.env.VITE_APP_NAME || 'SURVIVAL'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <button
              onClick={handleEnter}
              className="btn-primary text-sm py-2 px-4"
            >
              {user?.role === 'admin' ? 'Admin Panel' : 'My Dashboard'}
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="btn-ghost text-sm py-2 px-4"
              >
                Player Login
              </button>
              <button
                onClick={() => navigate('/admin/login')}
                className="text-gray-500 hover:text-gray-400 text-xs tracking-widest uppercase transition-colors"
              >
                Admin
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        {/* Day counter strip */}
        <div className="flex items-center gap-2 mb-8">
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, i) => (
            <div key={day} className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold
                  ${i === 6
                    ? 'bg-gold-500 text-arena-950'
                    : i < 3
                      ? 'bg-arena-700 text-gray-400 border border-arena-600'
                      : 'bg-arena-800 text-gray-600 border border-arena-700'}`}
              >
                {i + 1}
              </div>
              <span className="text-[9px] text-gray-600 tracking-wider">{day}</span>
            </div>
          ))}
        </div>

        {/* Main title */}
        <div className="mb-4">
          <p className="text-cyber-400 text-xs tracking-[0.4em] uppercase mb-3">
            ◆ Online Puzzle Competition ◆
          </p>
          <h1 className="text-6xl sm:text-8xl font-bold tracking-tight text-white mb-1"
            style={{ textShadow: '0 0 40px rgba(0,179,179,0.3)' }}>
            {import.meta.env.VITE_APP_NAME || 'SURVIVAL'}
          </h1>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-danger-600" />
            <p className="text-danger-400 font-bold tracking-[0.3em] text-sm uppercase">
              7 Days. One Winner.
            </p>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-danger-600" />
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-400 max-w-xl text-base leading-relaxed mt-6 mb-10">
          Every day brings a new challenge. Every round eliminates players.
          Puzzles designed to outsmart — not just answer.
          Can you survive all seven days?
        </p>

        {/* Game status card */}
        {activeGame && (
          <div className="arena-card cyber-border px-6 py-4 mb-8 max-w-sm w-full text-left">
            <p className="section-title mb-2">Current Game</p>
            <p className="text-white font-semibold text-lg truncate">{activeGame.name}</p>
            <div className="flex items-center justify-between mt-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                <p className={`text-sm font-bold mt-0.5 ${activeGame.status === 'ACTIVE' ? 'text-emerald-400' :
                    activeGame.status === 'COMPLETED' ? 'text-gold-400' : 'text-gray-400'
                  }`}>
                  {activeGame.status}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Day</p>
                <p className="text-sm font-bold text-cyber-300 mt-0.5">
                  {activeGame.currentDay > 0 ? `Day ${activeGame.currentDay} / 7` : 'Starting Soon'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Players</p>
                <p className="text-sm font-bold text-amber-400 mt-0.5">{activeGame.totalPlayers}</p>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={handleEnter}
            className="btn-primary text-base px-8 py-4 w-full sm:w-auto"
          >
            {isAuthenticated ? 'Enter Arena →' : 'Login to Play →'}
          </button>
          {activeGame?.groupLink && (
            <a
              href={activeGame.groupLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-sm px-6 py-4 w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <span>💬</span> Join Group
            </a>
          )}
        </div>

        {/* Feature strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-20 max-w-3xl w-full">
          {[
            { icon: '🧠', label: 'Logic Puzzles', desc: 'No simple trivia' },
            { icon: '⏱', label: 'Server Timer', desc: "Can't be cheated" },
            { icon: '🎯', label: 'Individualized', desc: 'Your puzzle, your variant' },
            { icon: '🏆', label: 'One Winner', desc: 'Last one standing' },
          ].map((f) => (
            <div key={f.label} className="arena-card p-4 text-center">
              <div className="text-2xl mb-2">{f.icon}</div>
              <p className="text-white text-xs font-semibold tracking-wider uppercase">{f.label}</p>
              <p className="text-gray-500 text-xs mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-arena-800 px-6 py-4 text-center">
        <p className="text-gray-600 text-xs tracking-widest">
          SURVIVAL · Private Puzzle Competition · All rights reserved
        </p>
      </footer>
    </div>
  );
}
