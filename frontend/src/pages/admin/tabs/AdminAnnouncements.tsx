import { useEffect, useState } from 'react';
import { gamesApi } from '../../../lib/api';
import { Game, Announcement } from '../../../types';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const ANN_TYPES = [
  'GENERAL', 'GAME_START', 'CHALLENGE_OPEN', 'CHALLENGE_CLOSED',
  'RESULTS', 'ELIMINATION', 'FINALISTS', 'WINNER', 'WARNING',
] as const;

const TYPE_ICONS: Record<string, string> = {
  GAME_START: '🚀', CHALLENGE_OPEN: '⚡', CHALLENGE_CLOSED: '🔒',
  RESULTS: '📊', ELIMINATION: '💀', FINALISTS: '⭐',
  WINNER: '🏆', GENERAL: '📢', WARNING: '⚠️',
};

export default function AdminAnnouncements() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<string>('GENERAL');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [dayNumber, setDayNumber] = useState<number | ''>('');

  useEffect(() => {
    gamesApi.getAll().then((r) => setGames(r.data.games || [])).catch(() => { });
  }, []);

  const loadAnnouncements = async (gameId: string) => {
    setLoading(true);
    try {
      const res = await gamesApi.getAnnouncements(gameId);
      setAnnouncements(res.data.announcements || []);
    } catch { toast.error('Failed to load announcements'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (selectedGameId) loadAnnouncements(selectedGameId);
  }, [selectedGameId]);

  const handleCreate = async () => {
    if (!selectedGameId || !title || !message) return;
    setSaving(true);
    try {
      await gamesApi.createAnnouncement(selectedGameId, {
        type, title, message,
        ...(dayNumber !== '' ? { dayNumber } : {}),
      });
      toast.success('Announcement created!');
      setShowCreate(false); setTitle(''); setMessage(''); setDayNumber(''); setType('GENERAL');
      loadAnnouncements(selectedGameId);
    } catch { toast.error('Failed to create announcement'); }
    finally { setSaving(false); }
  };

  const handlePublish = async (annId: string) => {
    if (!selectedGameId) return;
    try {
      await gamesApi.publishAnnouncement(selectedGameId, annId);
      toast.success('Announcement published! 📢');
      loadAnnouncements(selectedGameId);
    } catch { toast.error('Failed to publish'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-cyber-700 border-t-cyber-400 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">Announcements</h2>
        <div className="flex items-center gap-3">
          <select value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}
            className="bg-arena-800 border border-arena-600 text-white text-sm px-3 py-2 rounded max-w-xs">
            <option value="">Select game…</option>
            {games.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
          </select>
          {selectedGameId && (
            <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm py-2 px-3">
              {showCreate ? 'Cancel' : '+ New Announcement'}
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showCreate && selectedGameId && (
        <div className="arena-card cyber-border p-6 space-y-4">
          <p className="section-title">New Announcement</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="arena-input text-sm">
                {ANN_TYPES.map((t) => <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Day (optional)</label>
              <input type="number" min={1} max={7} value={dayNumber}
                onChange={(e) => setDayNumber(e.target.value === '' ? '' : Number(e.target.value))}
                className="arena-input" placeholder="1–7" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="arena-input" placeholder="Announcement title" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Message *</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)}
                className="arena-input h-28 resize-none" placeholder="Full announcement message shown to players…" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !title || !message} className="btn-primary text-sm py-2 px-6">
              {saving ? 'Saving...' : 'Create (Draft)'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-ghost text-sm py-2 px-4">Cancel</button>
          </div>
          <p className="text-gray-600 text-xs">Announcements are saved as drafts first. Click "Publish" to make them visible to players.</p>
        </div>
      )}

      {!selectedGameId && (
        <p className="text-gray-500 text-center py-12">Select a game to manage announcements</p>
      )}

      {/* Announcements list */}
      {selectedGameId && (
        <div className="space-y-3">
          {announcements.length === 0 && (
            <p className="text-gray-500 text-center py-12">No announcements yet.</p>
          )}
          {announcements.map((ann) => (
            <div key={ann._id} className={`arena-card p-5 ${ann.isPublished ? 'border-emerald-800' : 'border-arena-600'}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex gap-3 flex-1">
                  <span className="text-2xl shrink-0">{TYPE_ICONS[ann.type] || '📢'}</span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-white font-bold">{ann.title}</p>
                      <span className="text-xs text-gray-500 bg-arena-700 px-2 py-0.5 rounded">{ann.type}</span>
                      {ann.dayNumber && <span className="text-xs text-cyber-400">Day {ann.dayNumber}</span>}
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">{ann.message}</p>
                    <p className="text-gray-600 text-xs mt-2">
                      Created {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}
                      {ann.isPublished && ann.publishedAt && ` · Published ${formatDistanceToNow(new Date(ann.publishedAt), { addSuffix: true })}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ann.isPublished ? (
                    <span className="badge-active text-xs">PUBLISHED</span>
                  ) : (
                    <>
                      <span className="text-xs text-gray-500 bg-arena-700 px-2 py-0.5 rounded">DRAFT</span>
                      <button onClick={() => handlePublish(ann._id)} className="btn-primary text-xs py-1.5 px-3">
                        Publish 📢
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
