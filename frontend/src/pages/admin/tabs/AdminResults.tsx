import { useEffect, useState } from 'react';
import { challengesApi, gamesApi } from '../../../lib/api';
import toast from 'react-hot-toast';

interface AdminResult {
    _id: string; user: { playerTag: string; nickname: string } | null; challenge: { title: string; dayNumber: number; totalStages: number } | null;
    status: string; score: number; maxScore: number; timeTakenSeconds?: number; startedAt: string; completedAt?: string;
    correctCount: number; wrongCount: number; totalQuestions: number; percentageCorrect: number; percentageWrong: number;
    stageHistory: Array<{ stage: number; isCorrect: boolean; playerAnswer: unknown; correctAnswer: unknown; timeTakenSeconds?: number }>;
}

function formatSeconds(seconds?: number): string { if (seconds == null) return '—'; return `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }

export default function AdminResults() {
    const [overview, setOverview] = useState<any>(null);
    const [results, setResults] = useState<AdminResult[]>([]);
    const [dayNumber, setDayNumber] = useState<number | ''>('');
    const [status, setStatus] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const overviewRes = await gamesApi.getAdminOverview();
            setOverview(overviewRes.data);
            const gameId = overviewRes.data.game?._id;
            if (gameId) {
                const resultRes = await challengesApi.getAdminResults({ gameId, dayNumber, status });
                setResults(resultRes.data.results || []);
            } else setResults([]);
        } catch { toast.error('Unable to load results'); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [dayNumber, status]);
    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-cyber-700 border-t-cyber-400 rounded-full animate-spin" /></div>;

    return <div className="space-y-5 max-w-7xl">
        <div><h2 className="text-2xl font-bold text-white">Player Results</h2><p className="text-gray-500 text-sm mt-1">Server-validated attempts and admin-only answer details</p></div>
        <div className="flex flex-wrap gap-3">
            <select value={dayNumber} onChange={e => setDayNumber(e.target.value ? Number(e.target.value) : '')} className="bg-arena-800 border border-arena-600 text-white text-sm px-3 py-2 rounded"><option value="">All days</option>{[1, 2, 3, 4, 5, 6, 7].map(day => <option key={day} value={day}>Day {day}</option>)}</select>
            <select value={status} onChange={e => setStatus(e.target.value)} className="bg-arena-800 border border-arena-600 text-white text-sm px-3 py-2 rounded"><option value="">All statuses</option><option value="COMPLETED">Submitted</option><option value="TIME_EXPIRED">Time expired</option><option value="IN_PROGRESS">In progress</option></select>
            <span className="text-xs text-gray-500 self-center">{results.length} recorded attempt(s)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><div className="arena-card p-4"><p className="text-xs text-gray-500 uppercase">Today submitted</p><p className="text-2xl text-emerald-400 font-bold mt-2">{overview?.stats.submittedToday ?? 0}</p></div><div className="arena-card p-4"><p className="text-xs text-gray-500 uppercase">Pending</p><p className="text-2xl text-amber-400 font-bold mt-2">{overview?.stats.pendingToday ?? 0}</p></div><div className="arena-card p-4"><p className="text-xs text-gray-500 uppercase">Expired</p><p className="text-2xl text-danger-400 font-bold mt-2">{overview?.stats.expiredToday ?? 0}</p></div><div className="arena-card p-4"><p className="text-xs text-gray-500 uppercase">Finalists</p><p className="text-2xl text-gold-300 font-bold mt-2">{overview?.stats.finalists ?? 0}</p></div></div>
        <div className="arena-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-arena-700"><th className="text-left text-xs text-gray-500 uppercase px-4 py-3">Player</th><th className="text-left text-xs text-gray-500 uppercase px-4 py-3">Day / Challenge</th><th className="text-right text-xs text-gray-500 uppercase px-4 py-3">Score</th><th className="text-right text-xs text-gray-500 uppercase px-4 py-3">Correct / Wrong</th><th className="text-right text-xs text-gray-500 uppercase px-4 py-3">%</th><th className="text-right text-xs text-gray-500 uppercase px-4 py-3">Time</th><th className="text-right text-xs text-gray-500 uppercase px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead><tbody>{results.map(result => <>
            <tr key={result._id} className="border-b border-arena-800"><td className="px-4 py-3"><p className="text-cyber-300 font-mono font-bold">{result.user?.playerTag || '—'}</p><p className="text-white">{result.user?.nickname || '—'}</p></td><td className="px-4 py-3 text-gray-300">Day {result.challenge?.dayNumber} — {result.challenge?.title || 'Challenge'}</td><td className="px-4 py-3 text-right text-amber-300 font-mono">{result.score}/{result.maxScore}</td><td className="px-4 py-3 text-right"><span className="text-emerald-400">{result.correctCount}</span> / <span className="text-danger-400">{result.wrongCount}</span></td><td className="px-4 py-3 text-right text-white">{result.percentageCorrect}%</td><td className="px-4 py-3 text-right text-gray-400 font-mono">{formatSeconds(result.timeTakenSeconds)}</td><td className="px-4 py-3 text-right"><span className={result.status === 'COMPLETED' ? 'text-emerald-400' : result.status === 'TIME_EXPIRED' ? 'text-danger-400' : 'text-amber-400'}>{result.status}</span></td><td className="px-4 py-3 text-right"><button onClick={() => setExpanded(expanded === result._id ? null : result._id)} className="text-xs text-gray-400 hover:text-white">{expanded === result._id ? 'Hide' : 'Inspect'}</button></td></tr>
            {expanded === result._id && <tr key={`${result._id}-detail`} className="bg-arena-900/70"><td colSpan={8} className="px-5 py-5"><div className="space-y-3"><div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs"><span>Correct: <b className="text-emerald-400">{result.correctCount}</b></span><span>Wrong: <b className="text-danger-400">{result.wrongCount}</b></span><span>Total: <b className="text-white">{result.totalQuestions}</b></span><span>Right: <b className="text-white">{result.percentageCorrect}%</b></span><span>Wrong: <b className="text-white">{result.percentageWrong}%</b></span></div>{result.stageHistory.map(stage => <div key={stage.stage} className={`rounded border p-3 ${stage.isCorrect ? 'border-emerald-800' : 'border-danger-800'}`}><div className="flex justify-between"><span className="text-gray-300 font-semibold">Stage {stage.stage}</span><span className={stage.isCorrect ? 'text-emerald-400' : 'text-danger-400'}>{stage.isCorrect ? 'CORRECT' : 'WRONG'}</span></div><p className="text-xs text-gray-400 mt-2">Player answer: <span className="text-white break-all">{JSON.stringify(stage.playerAnswer ?? '—')}</span></p><p className="text-xs text-gray-400 mt-1">Correct answer: <span className="text-amber-200 break-all">{JSON.stringify(stage.correctAnswer ?? '—')}</span></p></div>)}</div></td></tr>}
        </>)}</tbody></table></div>{results.length === 0 && <p className="text-gray-500 text-center py-10">No attempts match the selected filters.</p>}</div>
    </div>;
}
