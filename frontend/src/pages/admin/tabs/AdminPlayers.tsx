import { useEffect, useState } from 'react';
import { playersApi, gamesApi } from '../../../lib/api';
import { User, Game, PlayerGame } from '../../../types';
import StatusBadge from '../../../components/shared/StatusBadge';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

export default function AdminPlayers() {
  const [players, setPlayers] = useState<User[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>('');
  const [enrolledPlayers, setEnrolledPlayers] = useState<PlayerGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [selectedForEnroll, setSelectedForEnroll] = useState<string[]>([]);

  // Create form — email + password + optional nickname
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [creating, setCreating] = useState(false);

  // Reset password modal
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPass, setResetPass] = useState('');

  const load = async () => {
    try {
      const [pRes, gRes] = await Promise.all([playersApi.getAll(), gamesApi.getAll()]);
      setPlayers(pRes.data.players || []);
      setGames(gRes.data.games || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const loadEnrolled = async (gameId: string) => {
    if (!gameId) return;
    try {
      const res = await gamesApi.getPlayers(gameId);
      setEnrolledPlayers(res.data.players || []);
    } catch { toast.error('Failed to load players for game'); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedGame) loadEnrolled(selectedGame); }, [selectedGame]);

  const handleCreate = async () => {
    if (!newEmail || !newPass) return;
    setCreating(true);
    try {
      await playersApi.create({ email: newEmail.toLowerCase(), password: newPass, nickname: newNickname });
      toast.success('Player created!');
      setShowCreate(false);
      setNewEmail(''); setNewPass(''); setNewNickname('');
      load();
    } catch (err) {
      const e = err as AxiosError<{ message: string }>;
      toast.error(e.response?.data?.message || 'Failed to create player');
    } finally { setCreating(false); }
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !resetPass) return;
    try {
      await playersApi.resetPassword(resetUserId, resetPass);
      toast.success('Password reset!');
      setResetUserId(null); setResetPass('');
    } catch { toast.error('Failed to reset password'); }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm('Deactivate this player?')) return;
    try {
      await playersApi.deactivate(userId);
      toast.success('Player deactivated');
      load();
    } catch { toast.error('Failed to deactivate'); }
  };

  const handleEnrollSelected = async () => {
    if (!selectedGame || selectedForEnroll.length === 0) return;
    try {
      await gamesApi.enrollBulk(selectedGame, selectedForEnroll);
      toast.success(`${selectedForEnroll.length} player(s) enrolled`);
      setSelectedForEnroll([]);
      loadEnrolled(selectedGame);
      load();
    } catch { toast.error('Failed to enroll players'); }
  };

  const toggleEnrollSelect = (id: string) => {
    setSelectedForEnroll((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const enrolledIds = new Set(enrolledPlayers.map((ep) => {
    const u = ep.userId;
    return typeof u === 'object' ? (u as User)._id : u;
  }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-cyber-700 border-t-cyber-400 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Players ({players.length})</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowEnroll(!showEnroll)} className="btn-ghost text-sm py-2 px-3">
            {showEnroll ? 'Hide Enroll' : '+ Enroll in Game'}
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm py-2 px-3">
            {showCreate ? 'Cancel' : '+ Add Player'}
          </button>
        </div>
      </div>

      {/* Create player form */}
      {showCreate && (
        <div className="arena-card cyber-border p-6 space-y-4">
          <p className="section-title">Add New Player</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email *</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="arena-input"
                placeholder="player@email.com"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password * (min 6)</label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="arena-input"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nickname (optional)</label>
              <input
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                className="arena-input"
                placeholder="e.g. Shadow"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newEmail || newPass.length < 6}
            className="btn-primary text-sm py-2 px-6"
          >
            {creating ? 'Creating…' : 'Create Player'}
          </button>
          <p className="text-gray-600 text-xs">
            Player Number is auto-generated. If no nickname is set, the player will be prompted on first login.
          </p>
        </div>
      )}

      {/* Enroll in game panel */}
      {showEnroll && (
        <div className="arena-card p-5 space-y-4">
          <p className="section-title">Enroll Players in Game</p>
          <div className="flex items-center gap-3">
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              className="arena-input text-sm flex-1 max-w-xs"
            >
              <option value="">Select game…</option>
              {games.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
            {selectedForEnroll.length > 0 && (
              <button onClick={handleEnrollSelected} className="btn-primary text-sm py-2 px-4">
                Enroll {selectedForEnroll.length} Player(s)
              </button>
            )}
          </div>
          {selectedGame && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {players.filter((p) => p.isActive).map((p) => {
                const isEnrolled = enrolledIds.has(p._id);
                return (
                  <label
                    key={p._id}
                    className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors
                      ${isEnrolled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-arena-700'}`}
                  >
                    <input
                      type="checkbox"
                      disabled={isEnrolled}
                      checked={selectedForEnroll.includes(p._id) || isEnrolled}
                      onChange={() => !isEnrolled && toggleEnrollSelect(p._id)}
                      className="accent-cyber-500"
                    />
                    <span className="text-sm text-white font-mono">{p.playerTag}</span>
                    <span className="text-xs text-gray-400">{p.nickname || '(no nickname)'}</span>
                    {isEnrolled && <span className="text-xs text-emerald-500 ml-auto">Enrolled</span>}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reset password modal */}
      {resetUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="arena-card cyber-border p-6 w-full max-w-sm space-y-4">
            <p className="text-white font-bold">Reset Password</p>
            <input
              type="password"
              value={resetPass}
              onChange={(e) => setResetPass(e.target.value)}
              className="arena-input"
              placeholder="New password (min 6 chars)"
            />
            <div className="flex gap-3">
              <button
                onClick={handleResetPassword}
                disabled={resetPass.length < 6}
                className="btn-primary text-sm flex-1"
              >
                Reset
              </button>
              <button
                onClick={() => { setResetUserId(null); setResetPass(''); }}
                className="btn-ghost text-sm flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Players table */}
      <div className="arena-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-arena-700">
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider px-4 py-3">Player ID</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider px-4 py-3">Nickname</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider px-4 py-3">Email</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider px-4 py-3">Setup</th>
                <th className="text-right text-xs text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-10">No players yet.</td>
                </tr>
              )}
              {players.map((p) => (
                <tr key={p._id} className="border-b border-arena-800 hover:bg-arena-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-cyber-400 font-bold text-sm">{p.playerTag}</span>
                  </td>
                  <td className="px-4 py-3 text-white text-sm">
                    {p.nickname || <span className="text-gray-600 italic">not set</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${p.isSetupComplete ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {p.isSetupComplete ? '✓ Done' : '⏳ Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setResetUserId(p._id)}
                        className="text-xs text-gray-400 hover:text-white bg-arena-700 hover:bg-arena-600 px-2 py-1 rounded transition-colors"
                      >
                        Reset PW
                      </button>
                      {p.isActive && (
                        <button
                          onClick={() => handleDeactivate(p._id)}
                          className="text-xs text-danger-400 hover:text-danger-300 bg-danger-900/30 hover:bg-danger-900/50 px-2 py-1 rounded transition-colors"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
