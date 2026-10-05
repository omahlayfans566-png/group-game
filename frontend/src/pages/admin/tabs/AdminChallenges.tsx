import { useEffect, useState } from 'react';
import { challengesApi, gamesApi } from '../../../lib/api';
import { Challenge, Game, GameDay } from '../../../types';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

// ─── Config ───────────────────────────────────────────────────────────────────

const PUZZLE_TYPES: Array<{ value: string; label: string; description: string; stages: number }> = [
  { value: 'CODE_BREAK', label: 'Code Break', description: 'Decipher clues to find a hidden code', stages: 1 },
  { value: 'SEQUENCE', label: 'Sequence', description: 'Find missing numbers in sequences', stages: 1 },
  { value: 'MEMORY', label: 'Memory', description: 'Memorise a grid, then answer from recall', stages: 2 },
  { value: 'PATTERN', label: 'Pattern', description: 'Identify rules and complete patterns', stages: 1 },
  { value: 'ARRANGEMENT', label: 'Arrangement', description: 'Drag items into the correct order', stages: 1 },
  { value: 'HIDDEN_OBJECT', label: 'Hidden Object', description: 'Locate hidden words inside a letter grid', stages: 1 },
  { value: 'LOGIC', label: 'Logic', description: 'Use clues to deduce a correct mapping', stages: 1 },
  { value: 'MULTI_STAGE', label: 'Multi-Stage', description: '4-stage compound challenge (sequence → code → pattern → final)', stages: 4 },
  { value: 'BROKEN_MACHINE', label: 'Broken Machine', description: 'Rotate a circuit path from source to sink', stages: 1 },
  { value: 'PATTERN_VAULT', label: 'Pattern Vault', description: 'Decode simultaneous visual transformation rules', stages: 1 },
  { value: 'MEMORY_VAULT', label: 'Memory Vault', description: 'Recall, reorder, and reconstruct a changing room', stages: 3 },
  { value: 'CIPHER_ROOM', label: 'Cipher Room', description: 'Open four connected locks using discovered keys', stages: 4 },
  { value: 'RULE_TRAP', label: 'Rule Trap', description: 'Probe a hidden rule before committing the final set', stages: 1 },
  { value: 'BLACK_VAULT', label: 'Black Vault', description: 'Five connected stages of memory, pattern, and logic', stages: 5 },
  { value: 'FINAL_VAULT', label: 'Final Vault', description: 'Championship synthesis for eligible finalists', stages: 5 },
];

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'EXTREME'] as const;
const SCORING_METHODS = [
  { value: 'PARTIAL', label: 'Partial — score per correct item' },
  { value: 'BINARY', label: 'Binary — all or nothing' },
  { value: 'TIME_BONUS', label: 'Time Bonus — faster = more points' },
  { value: 'ATTEMPT_PENALTY', label: 'Attempt Penalty — penalise retries' },
  { value: 'STAGE_BASED', label: 'Stage Based — score per completed stage' },
];

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [days, setDays] = useState<GameDay[]>([]);
  const [selectedGameId, setSelectedGameId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState<Array<{ dayNumber: number; dayOfWeek: string; ready: boolean; challengeType: string | null; hasSchedule: boolean; hasChallenge: boolean; isActive: boolean; generatorGenerated: boolean }>>([]);
  const [auditing, setAuditing] = useState(false);

  const defaultForm = {
    title: '', description: '', instructions: '',
    difficulty: 'MEDIUM', challengeType: 'CODE_BREAK',
    durationSeconds: 600, maxAttempts: 1,
    scoringMethod: 'PARTIAL', maxScore: 100,
    dayNumber: 1, gameDayId: '',
    puzzleConfig: '{}',
    isActive: false, isOpen: false,
  };
  const [form, setForm] = useState(defaultForm);

  const f = (field: string, value: unknown) => setForm(prev => ({ ...prev, [field]: value }));

  const load = async () => {
    try {
      const [cRes, gRes] = await Promise.all([challengesApi.getAll(), gamesApi.getAll()]);
      setChallenges(cRes.data.challenges || []);
      setGames(gRes.data.games || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const loadDays = async (gameId: string) => {
    const res = await gamesApi.getDays(gameId);
    setDays(res.data.days || []);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedGameId) loadDays(selectedGameId); }, [selectedGameId]);

  const selectedPuzzleType = PUZZLE_TYPES.find(p => p.value === form.challengeType);

  const handleSave = async () => {
    if (!form.title || !selectedGameId || !form.gameDayId) {
      toast.error('Title, game and day are required'); return;
    }
    let parsedConfig: Record<string, unknown> = {};
    try { parsedConfig = JSON.parse(form.puzzleConfig); }
    catch { toast.error('Puzzle config must be valid JSON'); return; }

    setSaving(true);
    try {
      const payload = {
        gameId: selectedGameId,
        gameDayId: form.gameDayId,
        dayNumber: form.dayNumber,
        title: form.title,
        description: form.description,
        instructions: form.instructions,
        difficulty: form.difficulty,
        challengeType: form.challengeType,
        durationSeconds: Number(form.durationSeconds),
        maxAttempts: Number(form.maxAttempts),
        scoringMethod: form.scoringMethod,
        maxScore: Number(form.maxScore),
        puzzleConfig: parsedConfig,
        isActive: form.isActive,
        isOpen: form.isOpen,
        totalStages: selectedPuzzleType?.stages ?? 1,
      };

      if (editId) {
        await challengesApi.update(editId, payload);
        toast.success('Challenge updated');
      } else {
        await challengesApi.create(payload);
        toast.success('Challenge created');
      }
      setShowCreate(false); setEditId(null); setForm(defaultForm);
      load();
    } catch (err) {
      const e = err as AxiosError<{ message: string }>;
      toast.error(e.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleToggle = async (c: Challenge, field: 'isOpen' | 'isActive') => {
    try {
      await challengesApi.update(c._id, { [field]: !c[field] });
      toast.success(`Challenge ${field === 'isOpen' ? (!c.isOpen ? 'opened' : 'closed') : (!c.isActive ? 'activated' : 'deactivated')}`);
      load();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this challenge?')) return;
    try { await challengesApi.delete(id); toast.success('Deleted'); load(); }
    catch { toast.error('Deactivate first'); }
  };

  const runAudit = async () => {
    if (!selectedGameId) { toast.error('Select a game first'); return; }
    setAuditing(true);
    try {
      const res = await challengesApi.audit(selectedGameId);
      setAudit(res.data.audit || []);
      toast.success(res.data.ready ? 'All seven days are ready' : 'Audit found setup gaps');
    } catch { toast.error('Unable to run readiness audit'); }
    finally { setAuditing(false); }
  };

  const startEdit = (c: Challenge) => {
    setSelectedGameId(c.gameId);
    setForm({
      title: c.title, description: c.description, instructions: c.instructions,
      difficulty: c.difficulty, challengeType: c.challengeType,
      durationSeconds: c.durationSeconds, maxAttempts: c.maxAttempts,
      scoringMethod: c.scoringMethod, maxScore: c.maxScore,
      dayNumber: c.dayNumber, gameDayId: c.gameDayId,
      puzzleConfig: '{}', isActive: c.isActive, isOpen: c.isOpen,
    });
    setEditId(c._id);
    setShowCreate(true);
  };

  const filteredChallenges = selectedGameId
    ? challenges.filter(c => c.gameId === selectedGameId)
    : challenges;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-cyber-700 border-t-cyber-400 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">Challenges</h2>
        <div className="flex items-center gap-3">
          <select
            value={selectedGameId}
            onChange={e => setSelectedGameId(e.target.value)}
            className="bg-arena-800 border border-arena-600 text-white text-sm px-3 py-2 rounded"
          >
            <option value="">All Games</option>
            {games.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
          </select>
          <button
            onClick={() => { setShowCreate(!showCreate); setEditId(null); setForm(defaultForm); }}
            className="btn-primary text-sm py-2 px-3"
          >
            {showCreate && !editId ? 'Cancel' : '+ New Challenge'}
          </button>
          <button onClick={runAudit} disabled={auditing || !selectedGameId} className="btn-ghost text-sm py-2 px-3">
            {auditing ? 'Auditing…' : 'Audit 7 days'}
          </button>
        </div>
      </div>

      {audit.length > 0 && (
        <div className="arena-card p-5 space-y-3">
          <div className="flex items-center justify-between"><p className="section-title mb-0">Seven-day readiness</p><span className="text-xs text-gray-500">No answers are exposed</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {audit.map(day => <div key={day.dayNumber} className={`rounded-lg border px-3 py-3 ${day.ready ? 'border-emerald-800 bg-emerald-950/20' : 'border-danger-800 bg-danger-950/20'}`}><div className="flex justify-between text-xs"><span className="text-white">{day.dayNumber}. {day.dayOfWeek}</span><span className={day.ready ? 'text-emerald-300' : 'text-danger-300'}>{day.ready ? 'READY' : 'CHECK'}</span></div><p className="mt-1 text-[10px] text-gray-500">{day.challengeType || 'No challenge'}{day.generatorGenerated ? ' · generated' : ''}</p></div>)}
          </div>
        </div>
      )}

      {/* Create / Edit form */}
      {showCreate && (
        <div className="arena-card cyber-border p-6 space-y-6">
          <p className="section-title">{editId ? 'Edit Challenge' : 'New Challenge'}</p>

          {/* ── Puzzle Type Selector ── */}
          <div>
            <label className="block text-xs text-gray-400 mb-3 uppercase tracking-wider">Puzzle Type *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PUZZLE_TYPES.map(pt => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => f('challengeType', pt.value)}
                  className={`
                    text-left px-3 py-3 rounded-lg border transition-all text-sm
                    ${form.challengeType === pt.value
                      ? 'bg-cyber-900 border-cyber-500 text-cyber-300'
                      : 'bg-arena-800 border-arena-700 text-gray-400 hover:border-arena-500 hover:text-gray-300'}
                  `}
                >
                  <p className="font-semibold text-xs">{pt.label}</p>
                  {pt.stages > 1 && (
                    <span className="text-[10px] text-amber-500 mt-0.5 block">{pt.stages} stages</span>
                  )}
                </button>
              ))}
            </div>
            {selectedPuzzleType && (
              <p className="text-gray-500 text-xs mt-2 italic">{selectedPuzzleType.description}</p>
            )}
          </div>

          {/* ── Core Fields ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Title *</label>
              <input value={form.title} onChange={e => f('title', e.target.value)} className="arena-input" placeholder="Challenge title" />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Game *</label>
              <select
                value={selectedGameId}
                onChange={e => { setSelectedGameId(e.target.value); f('gameDayId', ''); }}
                className="arena-input text-sm"
              >
                <option value="">Select game…</option>
                {games.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Game Day *</label>
              <select
                value={form.gameDayId}
                onChange={e => {
                  const d = days.find(d => d._id === e.target.value);
                  f('gameDayId', e.target.value);
                  if (d) f('dayNumber', d.dayNumber);
                }}
                className="arena-input text-sm"
              >
                <option value="">Select day…</option>
                {days.map(d => <option key={d._id} value={d._id}>Day {d.dayNumber} — {d.dayOfWeek}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Difficulty</label>
              <div className="flex gap-2">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d} type="button"
                    onClick={() => f('difficulty', d)}
                    className={`flex-1 py-2 text-xs font-bold rounded border transition-all ${form.difficulty === d
                      ? d === 'EASY' ? 'bg-emerald-900 border-emerald-600 text-emerald-300'
                        : d === 'MEDIUM' ? 'bg-amber-900 border-amber-600 text-amber-300'
                          : d === 'HARD' ? 'bg-orange-900 border-orange-600 text-orange-300'
                            : 'bg-danger-900 border-danger-600 text-danger-300'
                      : 'bg-arena-800 border-arena-600 text-gray-500 hover:text-gray-300'
                      }`}
                  >{d}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Scoring Method</label>
              <select value={form.scoringMethod} onChange={e => f('scoringMethod', e.target.value)} className="arena-input text-sm">
                {SCORING_METHODS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Duration (seconds)</label>
              <input type="number" min={30} value={form.durationSeconds} onChange={e => f('durationSeconds', e.target.value)} className="arena-input" />
              <p className="text-gray-600 text-xs mt-1">{Math.floor(Number(form.durationSeconds) / 60)}m {Number(form.durationSeconds) % 60}s</p>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Max Attempts</label>
              <input type="number" min={1} max={10} value={form.maxAttempts} onChange={e => f('maxAttempts', e.target.value)} className="arena-input" />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Max Score</label>
              <input type="number" min={1} value={form.maxScore} onChange={e => f('maxScore', e.target.value)} className="arena-input" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Description (shown to players)</label>
              <textarea value={form.description} onChange={e => f('description', e.target.value)} className="arena-input h-20 resize-none" placeholder="Brief description shown before the challenge starts" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Instructions (shown to players)</label>
              <textarea value={form.instructions} onChange={e => f('instructions', e.target.value)} className="arena-input h-20 resize-none" placeholder="Step-by-step instructions for players" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">
                Puzzle Config (JSON — stored server-side, controls difficulty params)
              </label>
              <textarea
                value={form.puzzleConfig}
                onChange={e => f('puzzleConfig', e.target.value)}
                className="arena-input h-28 resize-none font-mono text-xs"
                placeholder='{"maxScore": 100}'
              />
              <p className="text-gray-600 text-xs mt-1">
                This config is passed to the puzzle generator. Leave as <code className="text-cyber-700">{'{}'}</code> to use defaults.
                Never stored in the browser.
              </p>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => f('isActive', e.target.checked)} className="accent-cyber-500" />
                <span className="text-sm text-gray-300">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isOpen} onChange={e => f('isOpen', e.target.checked)} className="accent-cyber-500" />
                <span className="text-sm text-gray-300">Open for players</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2 px-6">
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Challenge'}
            </button>
            <button onClick={() => { setShowCreate(false); setEditId(null); }} className="btn-ghost text-sm py-2 px-4">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Challenges list */}
      <div className="space-y-3">
        {filteredChallenges.length === 0 && (
          <p className="text-gray-500 text-center py-12">No challenges yet. Create one above.</p>
        )}
        {filteredChallenges.map(c => {
          const ptInfo = PUZZLE_TYPES.find(p => p.value === c.challengeType);
          return (
            <div key={c._id} className="arena-card p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-white font-bold">{c.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${c.difficulty === 'EASY' ? 'bg-emerald-900 text-emerald-400' :
                      c.difficulty === 'MEDIUM' ? 'bg-amber-900 text-amber-400' :
                        c.difficulty === 'HARD' ? 'bg-orange-900 text-orange-400' :
                          'bg-danger-900 text-danger-400'
                      }`}>{c.difficulty}</span>
                    <span className="text-xs bg-cyber-900 text-cyber-400 border border-cyber-800 px-2 py-0.5 rounded font-mono">
                      {ptInfo?.label ?? c.challengeType}
                    </span>
                    {(c.totalStages ?? 1) > 1 && (
                      <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded">
                        {c.totalStages} stages
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs">
                    Day {c.dayNumber} · {Math.round(c.durationSeconds / 60)}min · Max {c.maxScore}pts · {c.maxAttempts} attempt(s) · {c.scoringMethod}
                  </p>
                  {c.description && <p className="text-gray-400 text-sm mt-1">{c.description}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${c.isActive ? 'bg-emerald-900 text-emerald-400' : 'bg-arena-700 text-gray-500'}`}>
                    {c.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${c.isOpen ? 'bg-cyber-900 text-cyber-300' : 'bg-arena-700 text-gray-500'}`}>
                    {c.isOpen ? 'OPEN' : 'CLOSED'}
                  </span>
                  <button onClick={() => handleToggle(c, 'isActive')} className="text-xs bg-arena-700 hover:bg-arena-600 text-gray-300 px-2 py-1 rounded transition-colors">
                    {c.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => handleToggle(c, 'isOpen')} className={`text-xs px-2 py-1 rounded transition-colors ${c.isOpen ? 'bg-danger-900 text-danger-400 hover:bg-danger-800' : 'bg-emerald-900 text-emerald-400 hover:bg-emerald-800'}`}>
                    {c.isOpen ? 'Close' : 'Open'}
                  </button>
                  <button onClick={() => startEdit(c)} className="text-xs bg-arena-700 hover:bg-arena-600 text-gray-300 px-2 py-1 rounded transition-colors">Edit</button>
                  <button onClick={() => handleDelete(c._id)} className="text-xs bg-danger-900 hover:bg-danger-800 text-danger-400 px-2 py-1 rounded transition-colors">Del</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
