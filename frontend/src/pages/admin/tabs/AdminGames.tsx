/**
 * AdminGames — Seven Day Game Control Center
 * Admin opens/closes games directly. No schedule required.
 */
import { useEffect, useState, useCallback } from 'react';
import { gamesApi } from '../../../lib/api';
import toast from 'react-hot-toast';

interface DayData {
    _id: string;
    dayNumber: number;
    dayOfWeek: string;
    status: 'OPEN' | 'CLOSED' | 'UPCOMING' | 'COMPLETED';
    challenge: {
        _id: string; title: string; challengeType: string;
        difficulty: string; durationSeconds: number; isOpen: boolean;
    } | null;
}

interface LiveStats {
    totalPlayers: number;
    started: number;
    submitted: number;
    active: number;
    expired: number;
    pending: number;
}

const DAY_THEMES = [
    { icon: '⚙', name: 'THE BROKEN MACHINE' },
    { icon: '◆', name: 'THE PATTERN VAULT' },
    { icon: '🧠', name: 'THE MEMORY VAULT' },
    { icon: '🔐', name: 'THE CIPHER ROOM' },
    { icon: '⚡', name: 'THE RULE TRAP' },
    { icon: '🕳', name: 'THE BLACK VAULT' },
    { icon: '🏆', name: 'THE FINAL VAULT' },
];

export default function AdminGames() {
    const [gameInfo, setGameInfo] = useState<{ _id: string; name: string; status: string } | null>(null);
    const [days, setDays] = useState<DayData[]>([]);
    const [stats, setStats] = useState<Record<string, LiveStats>>({});
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState<string | null>(null); // dayId being acted on

    const load = useCallback(async () => {
        try {
            const res = await gamesApi.getAllDays();
            if (res.data.success) {
                setGameInfo(res.data.game);
                setDays(res.data.days || []);
                // Load live stats for each day that has a challenge
                if (res.data.game) {
                    for (const day of res.data.days || []) {
                        loadStats(res.data.game._id, day._id);
                    }
                }
            }
        } catch { toast.error('Failed to load game data'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const loadStats = async (gameId: string, dayId: string) => {
        try {
            const res = await gamesApi.getDayLiveStats(gameId, dayId);
            if (res.data.success) {
                setStats(prev => ({ ...prev, [dayId]: res.data.stats }));
            }
        } catch { /* stats not critical */ }
    };

    const handleOpen = async (day: DayData) => {
        if (!gameInfo) return;
        const openDay = days.find(d => d.status === 'OPEN' && d._id !== day._id);

        if (openDay) {
            const theme = DAY_THEMES[openDay.dayNumber - 1];
            const confirmed = window.confirm(
                `Day ${openDay.dayNumber} — ${theme?.name ?? openDay.dayOfWeek} is currently OPEN.\n\nOpening Day ${day.dayNumber} will close it. Continue?`
            );
            if (!confirmed) return;
        } else {
            const confirmed = window.confirm(`Open Day ${day.dayNumber} for players?`);
            if (!confirmed) return;
        }

        setActing(day._id);
        try {
            await gamesApi.openDay(gameInfo._id, day._id, true);
            toast.success(`Day ${day.dayNumber} is now OPEN. Players can play.`);
            await load();
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to open';
            toast.error(msg);
        } finally { setActing(null); }
    };

    const handleClose = async (day: DayData) => {
        if (!gameInfo) return;

        const dayStats = stats[day._id];
        const activePlayers = dayStats?.active ?? 0;

        let endActive = false;
        if (activePlayers > 0) {
            const choice = window.confirm(
                `${activePlayers} player(s) are still playing.\n\nOK = Close game only (active players finish on their personal timer)\nCancel = Cancel`
            );
            if (!choice) return;

            const forceEnd = window.confirm(
                `Also end all ${activePlayers} active attempt(s) immediately?\n\nOK = Yes, end them now\nCancel = No, let them finish`
            );
            endActive = forceEnd;
        } else {
            const confirmed = window.confirm(`Close Day ${day.dayNumber}? No players are currently active.`);
            if (!confirmed) return;
        }

        setActing(day._id);
        try {
            await gamesApi.closeDay(gameInfo._id, day._id, endActive);
            toast.success(`Day ${day.dayNumber} closed.${endActive ? ' Active attempts ended.' : ''}`);
            await load();
        } catch {
            toast.error('Failed to close');
        } finally { setActing(null); }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-cyber-700 border-t-cyber-400 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-5 max-w-3xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Seven Day Game Control</h2>
                    <p className="text-gray-500 text-sm mt-0.5">
                        {gameInfo ? `${gameInfo.name} · ${gameInfo.status}` : 'No active game'}
                    </p>
                </div>
                <button onClick={load} className="btn-ghost text-xs py-1.5 px-3">↻ Refresh</button>
            </div>

            {!gameInfo && (
                <div className="arena-card p-8 text-center space-y-3">
                    <p className="text-4xl">🕐</p>
                    <p className="text-gray-300 text-lg font-semibold">Setting up game structure…</p>
                    <p className="text-gray-500 text-sm">The server automatically creates the 7-day game on startup. Refresh in a moment.</p>
                    <button onClick={load} className="btn-primary text-sm px-5 py-2.5">Refresh</button>
                </div>
            )}

            {gameInfo && Array.from({ length: 7 }, (_, i) => {
                const dayNum = i + 1;
                const day = days.find(d => d.dayNumber === dayNum);
                const theme = DAY_THEMES[i];
                const isOpen = day?.status === 'OPEN';
                const isDone = day?.status === 'COMPLETED';
                const dayStats = day ? stats[day._id] : undefined;
                const isActing = day ? acting === day._id : false;

                return (
                    <div key={dayNum} className={`arena-card p-5 border-2 transition-all
            ${isOpen ? 'border-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.15)]' :
                            isDone ? 'border-cyber-800' : 'border-arena-600'}`}>

                        {/* Header row */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border
                  ${isOpen ? 'bg-emerald-900 border-emerald-600' : isDone ? 'bg-cyber-900 border-cyber-700' : dayNum === 7 ? 'bg-gold-700 border-gold-500' : 'bg-arena-700 border-arena-600'}`}>
                                    {theme.icon}
                                </div>
                                <div>
                                    <p className="text-white font-bold text-base">
                                        Day {dayNum} — {theme.name}
                                        {dayNum === 7 && <span className="text-[10px] text-gold-400 ml-2 uppercase tracking-wider">Final</span>}
                                    </p>
                                    <p className="text-gray-500 text-xs mt-0.5">
                                        {day?.challenge?.challengeType ?? 'Challenge pending'} ·{' '}
                                        {day?.challenge ? `${Math.round(day.challenge.durationSeconds / 60)} min · ${day.challenge.difficulty}` : '—'}
                                    </p>
                                </div>
                            </div>

                            {/* Status badge */}
                            <div className={`text-xs font-bold px-3 py-1.5 rounded-full border shrink-0
                ${isOpen ? 'bg-emerald-900 border-emerald-600 text-emerald-300' :
                                    isDone ? 'bg-cyber-900 border-cyber-700 text-cyber-400' :
                                        'bg-arena-800 border-arena-600 text-gray-500'}`}>
                                {isOpen ? '🟢 OPEN' : isDone ? '✓ DONE' : '🔒 CLOSED'}
                            </div>
                        </div>

                        {/* Live stats — shown when game has activity */}
                        {dayStats && (dayStats.started > 0 || isOpen) && (
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4 text-xs">
                                {[
                                    { label: 'Players', value: dayStats.totalPlayers, color: 'text-white' },
                                    { label: 'Started', value: dayStats.started, color: 'text-white' },
                                    { label: 'Playing', value: dayStats.active, color: 'text-amber-400' },
                                    { label: 'Submitted', value: dayStats.submitted, color: 'text-emerald-400' },
                                    { label: 'Expired', value: dayStats.expired, color: 'text-danger-400' },
                                    { label: 'Pending', value: dayStats.pending, color: 'text-gray-400' },
                                ].map(s => (
                                    <div key={s.label} className="bg-arena-900 rounded-lg px-2 py-2 text-center">
                                        <p className="text-gray-600 uppercase tracking-wider text-[9px] mb-0.5">{s.label}</p>
                                        <p className={`font-bold text-base ${s.color}`}>{s.value}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Action buttons */}
                        {day && !isDone && (
                            <div className="mt-4 flex gap-3">
                                {!isOpen ? (
                                    <button
                                        onClick={() => handleOpen(day)}
                                        disabled={isActing}
                                        className="btn-primary flex-1 py-3 text-sm font-bold tracking-wide"
                                    >
                                        {isActing ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Opening…
                                            </span>
                                        ) : `⚡ OPEN DAY ${dayNum} FOR PLAYERS`}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleClose(day)}
                                        disabled={isActing}
                                        className="btn-danger flex-1 py-3 text-sm font-bold tracking-wide"
                                    >
                                        {isActing ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Closing…
                                            </span>
                                        ) : `🔒 CLOSE DAY ${dayNum}`}
                                    </button>
                                )}
                                <button
                                    onClick={() => day && gameInfo && loadStats(gameInfo._id, day._id)}
                                    className="btn-ghost text-xs py-3 px-4"
                                    title="Refresh stats"
                                >↻</button>
                            </div>
                        )}

                        {!day && (
                            <p className="text-gray-600 text-xs mt-3 text-center">
                                Challenge not yet created. Server will seed it on next restart.
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
