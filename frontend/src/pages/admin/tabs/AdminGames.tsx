import { useEffect, useState } from 'react';
import { gamesApi } from '../../../lib/api';
import { Game, GameDay } from '../../../types';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

const DAY_NAMES = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function scheduleDateValue(date: string, hour: number, minute: number): string {
  if (!date) return '';
  const value = new Date(date);
  value.setHours(hour, minute, 0, 0);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(hour)}:${pad(minute)}`;
}

export default function AdminGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [days, setDays] = useState<GameDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [showCreateDay, setShowCreateDay] = useState(false);

  // Create game form
  const [gameName, setGameName] = useState('');
  const [gameDesc, setGameDesc] = useState('');
  const [gameStart, setGameStart] = useState('');
  const [gameFinalists, setGameFinalists] = useState(2);
  const [saving, setSaving] = useState(false);

  // Create day form
  const [dayNumber, setDayNumber] = useState(1);
  const [dayElimCount, setDayElimCount] = useState(5);
  const [dayStart, setDayStart] = useState('');
  const [dayEnd, setDayEnd] = useState('');
  const [savingDay, setSavingDay] = useState(false);

  const loadGames = async () => {
    try {
      const res = await gamesApi.getAll();
      setGames(res.data.games || []);
    } catch { toast.error('Failed to load games'); }
    finally { setLoading(false); }
  };

  const loadDays = async (gameId: string) => {
    try {
      const res = await gamesApi.getDays(gameId);
      setDays(res.data.days || []);
    } catch { toast.error('Failed to load days'); }
  };

  useEffect(() => { loadGames(); }, []);
  useEffect(() => {
    if (selectedGame) loadDays(selectedGame._id);
  }, [selectedGame]);

  const handleCreateGame = async () => {
    if (!gameName || !gameStart) return;
    setSaving(true);
    try {
      await gamesApi.create({ name: gameName, description: gameDesc, startDate: new Date(gameStart).toISOString(), targetFinalists: gameFinalists });
      toast.success('Game created!');
      setShowCreateGame(false);
      setGameName(''); setGameDesc(''); setGameStart('');
      loadGames();
    } catch (err) {
      const e = err as AxiosError<{ message: string }>;
      toast.error(e.response?.data?.message || 'Failed to create game');
    } finally { setSaving(false); }
  };

  const handleUpdateStatus = async (gameId: string, status: string) => {
    try {
      await gamesApi.update(gameId, { status });
      toast.success('Game status updated');
      loadGames();
      if (selectedGame?._id === gameId) setSelectedGame((prev) => prev ? { ...prev, status: status as Game['status'] } : null);
    } catch { toast.error('Failed to update'); }
  };

  const handleUpdateDay = async (gameId: string, dayId: string, status: string) => {
    try {
      await gamesApi.updateDay(gameId, dayId, { status });
      toast.success('Day status updated');
      loadDays(gameId);
    } catch { toast.error('Failed to update day'); }
  };

  const handleCreateDay = async () => {
    if (!selectedGame || !dayStart || !dayEnd) return;
    setSavingDay(true);
    try {
      await gamesApi.createDay(selectedGame._id, {
        dayNumber,
        dayOfWeek: DAY_NAMES[dayNumber - 1],
        challengeStartTime: new Date(dayStart).toISOString(),
        challengeEndTime: new Date(dayEnd).toISOString(),
        eliminationCount: dayElimCount,
      });
      toast.success('Day created!');
      setShowCreateDay(false);
      loadDays(selectedGame._id);
    } catch (err) {
      const e = err as AxiosError<{ message: string }>;
      toast.error(e.response?.data?.message || 'Failed to create day');
    } finally { setSavingDay(false); }
  };

  const applyDefaultWindow = (value: string) => {
    setDayStart(scheduleDateValue(value, 21, 0));
    setDayEnd(scheduleDateValue(value, 21, 30));
  };

  const toggleCreateDay = () => {
    const opening = !showCreateDay;
    setShowCreateDay(opening);
    if (opening && selectedGame) {
      const dayDate = new Date(selectedGame.startDate);
      dayDate.setDate(dayDate.getDate() + dayNumber - 1);
      applyDefaultWindow(dayDate.toISOString());
    }
  };

  const handleUpdateCurrentDay = async (gameId: string, day: number) => {
    try {
      await gamesApi.update(gameId, { currentDay: day });
      toast.success('Current day updated');
      loadGames();
    } catch { toast.error('Failed to update'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-cyber-700 border-t-cyber-400 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Game Management</h2>
        <button onClick={() => setShowCreateGame(!showCreateGame)} className="btn-primary text-sm py-2 px-4">
          {showCreateGame ? 'Cancel' : '+ New Game'}
        </button>
      </div>

      {/* Create game form */}
      {showCreateGame && (
        <div className="arena-card cyber-border p-6 space-y-4">
          <p className="section-title">Create New Game</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Game Name *</label>
              <input value={gameName} onChange={(e) => setGameName(e.target.value)} className="arena-input" placeholder="Survival Game 2026" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Start Date *</label>
              <input type="datetime-local" value={gameStart} onChange={(e) => setGameStart(e.target.value)} className="arena-input" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Description</label>
              <input value={gameDesc} onChange={(e) => setGameDesc(e.target.value)} className="arena-input" placeholder="Optional description" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Target Finalists</label>
              <input type="number" min={2} value={gameFinalists} onChange={(e) => setGameFinalists(Number(e.target.value))} className="arena-input" />
            </div>
          </div>
          <button onClick={handleCreateGame} disabled={saving || !gameName || !gameStart} className="btn-primary text-sm py-2 px-6">
            {saving ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      )}

      {/* Games list */}
      <div className="grid grid-cols-1 gap-3">
        {games.length === 0 && <p className="text-gray-500 text-center py-12">No games yet. Create one above.</p>}
        {games.map((g) => (
          <div key={g._id} className={`arena-card p-5 cursor-pointer transition-all ${selectedGame?._id === g._id ? 'border-cyber-600 shadow-[0_0_20px_rgba(0,102,102,0.3)]' : 'hover:border-arena-500'}`}
            onClick={() => setSelectedGame(selectedGame?._id === g._id ? null : g)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-white font-bold">{g.name}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${g.status === 'ACTIVE' ? 'bg-emerald-900 text-emerald-400' :
                    g.status === 'DRAFT' ? 'bg-arena-700 text-gray-400' :
                      g.status === 'COMPLETED' ? 'bg-gold-600 text-gold-200' :
                        'bg-arena-700 text-gray-400'
                    }`}>{g.status}</span>
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {new Date(g.startDate).toLocaleDateString()} · {g.totalPlayers} players · Day {g.currentDay}/7 · Top {g.targetFinalists} finalists
                </p>
              </div>
              <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                {g.status === 'DRAFT' && <button onClick={() => handleUpdateStatus(g._id, 'ACTIVE')} className="btn-primary text-xs py-1.5 px-3">Activate</button>}
                {g.status === 'ACTIVE' && <button onClick={() => handleUpdateStatus(g._id, 'PAUSED')} className="btn-ghost text-xs py-1.5 px-3">Pause</button>}
                {g.status === 'PAUSED' && <button onClick={() => handleUpdateStatus(g._id, 'ACTIVE')} className="btn-primary text-xs py-1.5 px-3">Resume</button>}
                {(g.status === 'ACTIVE' || g.status === 'PAUSED') && (
                  <button onClick={() => handleUpdateStatus(g._id, 'COMPLETED')} className="btn-danger text-xs py-1.5 px-3">End Game</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Game day management */}
      {selectedGame && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-title mb-0">Days — {selectedGame.name}</p>
              <p className="text-gray-500 text-xs mt-1">Configure each day's challenge window and elimination count</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Current Day:</label>
                <select
                  value={selectedGame.currentDay}
                  onChange={(e) => handleUpdateCurrentDay(selectedGame._id, Number(e.target.value))}
                  className="bg-arena-800 border border-arena-600 text-white text-xs px-2 py-1 rounded"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n === 0 ? 'Not Started' : `Day ${n}`}</option>)}
                </select>
              </div>
              <button onClick={toggleCreateDay} className="btn-primary text-xs py-1.5 px-3">
                {showCreateDay ? 'Cancel' : '+ Add Day'}
              </button>
            </div>
          </div>

          {showCreateDay && (
            <div className="arena-card p-5 space-y-4">
              <p className="section-title">Add Game Day</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Day Number</label>
                  <select value={dayNumber} onChange={(e) => setDayNumber(Number(e.target.value))} className="arena-input text-sm">
                    {DAY_NAMES.map((d, i) => <option key={d} value={i + 1}>Day {i + 1} – {d.slice(0, 3)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Eliminations</label>
                  <input type="number" min={0} value={dayElimCount} onChange={(e) => setDayElimCount(Number(e.target.value))} className="arena-input text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Challenge Opens</label>
                  <input type="datetime-local" value={dayStart} onChange={(e) => { setDayStart(e.target.value); if (!dayEnd) setDayEnd(scheduleDateValue(e.target.value, 21, 30)); }} className="arena-input text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Challenge Closes</label>
                  <input type="datetime-local" value={dayEnd} onChange={(e) => setDayEnd(e.target.value)} className="arena-input text-sm" />
                </div>
              </div>
              <button onClick={handleCreateDay} disabled={savingDay || !dayStart || !dayEnd} className="btn-primary text-xs py-1.5 px-4">
                {savingDay ? 'Saving...' : 'Save Day'}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {days.length === 0 && <p className="text-gray-500 text-sm text-center py-6">No days configured yet.</p>}
            {days.map((day) => (
              <div key={day._id} className="arena-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-arena-700 rounded flex items-center justify-center text-white font-bold shrink-0">
                    {day.dayNumber}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{day.dayOfWeek} — {day.eliminationCount} eliminations</p>
                    <p className="text-gray-500 text-xs">
                      {new Date(day.challengeStartTime).toLocaleString()} → {new Date(day.challengeEndTime).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${day.status === 'OPEN' ? 'bg-emerald-900 text-emerald-400' :
                    day.status === 'COMPLETED' ? 'bg-cyber-900 text-cyber-400' :
                      day.status === 'CLOSED' ? 'bg-arena-700 text-gray-400' :
                        day.status === 'RESULTS' ? 'bg-gold-600 text-gold-200' :
                          'bg-arena-800 text-gray-500'
                    }`}>{day.status}</span>
                  {['UPCOMING', 'OPEN', 'CLOSED', 'RESULTS', 'COMPLETED'].map((s) => (
                    day.status !== s && (
                      <button key={s} onClick={() => handleUpdateDay(selectedGame._id, day._id, s)}
                        className="text-xs text-gray-500 hover:text-white bg-arena-800 hover:bg-arena-700 px-2 py-1 rounded transition-colors">
                        → {s}
                      </button>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
