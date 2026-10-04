import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import AdminOverview from './tabs/AdminOverview';
import AdminPlayers from './tabs/AdminPlayers';
import AdminGames from './tabs/AdminGames';
import AdminChallenges from './tabs/AdminChallenges';
import AdminResults from './tabs/AdminResults';
import AdminAnnouncements from './tabs/AdminAnnouncements';
import AdminSeason from './tabs/AdminSeason';

type Tab = 'overview' | 'games' | 'players' | 'challenges' | 'results' | 'announcements' | 'season';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'season', label: 'Season', icon: '🗓' },
  { id: 'games', label: 'Games', icon: '🎮' },
  { id: 'players', label: 'Players', icon: '👥' },
  { id: 'challenges', label: 'Challenges', icon: '⚡' },
  { id: 'results', label: 'Results', icon: '🏆' },
  { id: 'announcements', label: 'Announcements', icon: '📢' },
];

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    navigate('/');
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <AdminOverview onNavigate={setActiveTab} />;
      case 'season': return <AdminSeason />;
      case 'games': return <AdminGames />;
      case 'players': return <AdminPlayers />;
      case 'challenges': return <AdminChallenges />;
      case 'results': return <AdminResults />;
      case 'announcements': return <AdminAnnouncements />;
    }
  };

  return (
    <div className="min-h-screen bg-arena-950 flex">
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none" />

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-56 bg-arena-900 border-r border-arena-700 flex flex-col
        transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-arena-700">
          <span className="text-danger-400">🛡</span>
          <div>
            <p className="text-white font-bold text-sm tracking-wider">ADMIN</p>
            <p className="text-gray-500 text-xs">{import.meta.env.VITE_APP_NAME || 'SURVIVAL'}</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150
                ${activeTab === tab.id
                  ? 'bg-cyber-800 text-cyber-300 border border-cyber-700'
                  : 'text-gray-400 hover:text-white hover:bg-arena-800'
                }`}
            >
              <span>{tab.icon}</span>
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* User info */}
        <div className="border-t border-arena-700 px-4 py-4">
          <p className="text-white text-sm font-semibold truncate">{user?.nickname || user?.playerTag}</p>
          <p className="text-danger-400 text-xs tracking-widest">ADMIN</p>
          <button onClick={handleLogout} className="mt-3 text-gray-500 hover:text-gray-300 text-xs tracking-widest uppercase transition-colors">
            Logout →
          </button>
        </div>
      </aside>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        {/* Top bar */}
        <header className="relative z-10 flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-arena-700 bg-arena-900/50 backdrop-blur">
          <button
            className="lg:hidden text-gray-400 hover:text-white p-1"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <div className="flex-1">
            <h1 className="text-white font-bold text-lg">
              {TABS.find((t) => t.id === activeTab)?.icon}{' '}
              {TABS.find((t) => t.id === activeTab)?.label}
            </h1>
          </div>
          <p className="text-gray-500 text-xs hidden sm:block">Admin Panel</p>
        </header>

        {/* Page content */}
        <main className="relative z-10 flex-1 overflow-auto p-4 sm:p-6">
          {renderTab()}
        </main>
      </div>
    </div>
  );
}
