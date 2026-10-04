/**
 * Admin Season / Test Mode panel.
 * Configure game schedule, group link, test mode.
 * All times come from server; admin enters them here and saves via game/day APIs.
 */
import { useEffect, useState } from 'react';
import { gamesApi } from '../../../lib/api';
import { Game, GameDay } from '../../../types';
import toast from 'react-hot-toast';

const DAY_NAMES = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];
const DAY_LABELS = ['Day 1 — Monday','Day 2 — Tuesday','Day 3 — Wednesday','Day 4 — Thursday','Day 5 — Friday','Day 6 — Saturday','Day 7 — Sunday (FINAL)'];

function toLocalInput(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminSeason() {
  const [games, setGames]                 = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState('');
  const [game, setGame]                   = useState<Game | null>(null);
  const [days, setDays]                   = useState<GameDay[]>([]);
  const [loading, setLoading]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [groupLink, setGroupLink]         = useState('');
  const [dayEdits, setDayEdits]           = useState<Record<string, { start: string; end: string }>>({});

  useEffect(() => {
    gamesApi.getAll().then(r => setGames(r.data.games || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedGameId) return;
    setLoading(true);
    Promise.all([
      gamesApi.getOne(selectedGameId),
      gamesApi.getDays(selectedGameId),
    ]).then(([gRes, dRes]) => {
      const g = gRes.data.game as Game;
      const d = dRes.data.days as GameDay[];
      setGame(g);
      setGroupLink(g.groupLink || '');
      setDays(d);
      const edits: Record<string, { start: string; end: string }> = {};
      d.forEach(day => {
        edits[day._id] = {
          start: toLocalInput(day.challengeStartTime),
          end: toLocalInput(day.challengeEndTime),
        };
      });
      setDayEdits(edits);
    }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [selectedGameId]);

  const handleSaveGroupLink = async () => {
    if (!selectedGameId) return;
    setSaving(true);
    try {
      await gamesApi.update(selectedGameId, { groupLink });
      toast.success('Group link saved');
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const handleSaveDay = async (dayId: string, dayNumber: number) => {
    const edit = dayEdits[dayId];
    if (!edit?.start || !edit?.end) { toast.error('Both start and end times required'); return; }
    try {
      await gamesApi.updateDay(selectedGameId, dayId, {
        challengeStartTime: new Date(edit.start).toISOString(),
        challengeEndTime: new Date(edit.end).toISOString(),
      });
      toast.success(`Day ${dayNumber} schedule saved`);
    } catch { toast.error('Failed to save day'); }
  };

  const handleSaveAllDays = async () => {
    setSaving(true);
    let ok = 0;
    for (const day of days) {
      const edit = dayEdits[day._id];
      if (edit?.start && edit?.end) {
        try {
          await gamesApi.updateDay(selectedGameId, day._id, {
            challengeStartTime: new Date(edit.start).toISOString(),
            challengeEndTime: new Date(edit.end).toISOString(),
          });
          ok++;
        } catch { /* continue */ }
      }
    }
    setSaving(false);
    toast.success(`${ok} day(s) schedule saved`);
  };

  const editDay = (dayId: string, field: 'start' | 'end', value: string) => {
    setDayEdits(prev => ({ ...prev, [dayId]: { ...prev[dayId], [field]: value } }));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-cyber-700 border-t-cyber-400 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Season Configuration</h2>
        <select value={selectedGameId} onChange={e => setSelectedGameId(e.target.value)}
          className="bg-arena-800 border border-arena-600 text-white text-sm px-3 py-2 rounded max-w-xs">
          <option value="">Select game…</option>
          {games.map(g => <option key={g._id} value={g._id}>{g.name} — {g.status}</option>)}
        </select>
      </div>

      {!selectedGameId && <p className="text-gray-500 text-center py-12">Select a game to configure its schedule</p>}

      {selectedGameId && game && (
        <>
          {/* Group link */}
          <div className="arena-card p-5 space-y-3">
            <p className="section-title">Group Link</p>
            <p className="text-gray-400 text-xs leading-relaxed">
              This link appears on the player dashboard and challenge completion screens.
              Players click it to go to the WhatsApp/group discussion.
            </p>
            <div className="flex gap-3">
              <input value={groupLink} onChange={e => setGroupLink(e.target.value)}
                className="arena-input flex-1" placeholder="https://chat.whatsapp.com/…" />
              <button onClick={handleSaveGroupLink} disabled={saving} className="btn-primary text-sm py-2 px-4">Save</button>
            </div>
          </div>

          {/* Day schedule */}
          <div className="arena-card p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-title mb-0">Challenge Schedule</p>
                <p className="text-gray-500 text-xs mt-1">
                  All times are server-controlled. Players cannot bypass them.
                  Late players get only the remaining window — not a fresh timer.
                </p>
              </div>
              <button onClick={handleSaveAllDays} disabled={saving || days.length === 0} className="btn-primary text-xs py-1.5 px-4">
                {saving ? 'Saving…' : 'Save All'}
              </button>
            </div>

            <div className="space-y-4">
              {days.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">
                  No days configured yet. Go to the Games tab and add days 1–7 first.
                </p>
              )}
              {days.sort((a,b) => a.dayNumber - b.dayNumber).map(day => {
                const edit = dayEdits[day._id] ?? { start: '', end: '' };
                const isDone = day.status === 'COMPLETED';
                return (
                  <div key={day._id} className={`rounded-lg border p-4 space-y-3 ${isDone ? 'border-arena-700 opacity-60' : 'border-arena-600'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                          ${day.dayNumber === 7 ? 'bg-gold-600 text-arena-950' : 'bg-arena-700 text-white'}`}>
                          {day.dayNumber}
                        </div>
                        <div>
                          <p className="text-white text-sm font-semibold">{DAY_LABELS[day.dayNumber - 1] ?? day.dayOfWeek}</p>
                          <span className={`text-xs font-bold ${
                            day.status === 'OPEN' ? 'text-emerald-400' :
                            day.status === 'COMPLETED' ? 'text-cyber-400' :
                            day.status === 'CLOSED' ? 'text-gray-500' : 'text-gray-600'
                          }`}>{day.status}</span>
                        </div>
                      </div>
                      {!isDone && (
                        <button onClick={() => handleSaveDay(day._id, day.dayNumber)} className="text-xs bg-cyber-900 hover:bg-cyber-800 text-cyber-300 px-3 py-1 rounded transition-colors border border-cyber-800">
                          Save Day {day.dayNumber}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Opens at</label>
                        <input type="datetime-local" value={edit.start}
                          onChange={e => editDay(day._id, 'start', e.target.value)}
                          disabled={isDone}
                          className="arena-input text-sm disabled:opacity-50" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Closes at</label>
                        <input type="datetime-local" value={edit.end}
                          onChange={e => editDay(day._id, 'end', e.target.value)}
                          disabled={isDone}
                          className="arena-input text-sm disabled:opacity-50" />
                      </div>
                    </div>

                    {edit.start && edit.end && (
                      <p className="text-gray-600 text-xs">
                        Duration: {Math.round((new Date(edit.end).getTime() - new Date(edit.start).getTime()) / 60000)} minutes
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test mode notice */}
          <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-5 space-y-2">
            <p className="text-amber-400 font-bold text-sm uppercase tracking-wider">⚠ Test Mode Notice</p>
            <p className="text-amber-200/70 text-xs leading-relaxed">
              To test the full game flow without affecting real season data, create a separate game in the Games tab
              and set its name to include "TEST". Use short durations (e.g. 2 minutes) for quick testing.
              Real player accounts can register and test the full registration → challenge → submission → result flow.
              When done testing, set the test game to ARCHIVED status.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
