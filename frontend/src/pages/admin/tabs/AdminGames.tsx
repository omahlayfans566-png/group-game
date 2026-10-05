import { useEffect, useState } from 'react';
import { gamesApi } from '../../../lib/api';
import toast from 'react-hot-toast';

const GAME_NAMES = ['BROKEN MACHINE', 'PATTERN VAULT', 'MEMORY VAULT', 'CIPHER ROOM', 'RULE TRAP', 'BLACK VAULT', 'FINAL VAULT'];

function timeInLagos(value: string): string {
    return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(value));
}

export default function AdminGames() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    useEffect(() => {
        gamesApi.getAdminSchedule().then(res => setData(res.data))
            .catch(() => toast.error('Unable to load the seven-day schedule'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-cyber-700 border-t-cyber-400 rounded-full animate-spin" /></div>;
    const days = data?.days || [];

    return (
        <div className="space-y-6 max-w-6xl">
            <div><h2 className="text-2xl font-bold text-white">Seven Day Game Schedule</h2><p className="text-gray-500 text-sm mt-1">Existing arena schedule · Africa/Lagos time · no manual game creation required</p></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 7 }, (_, index) => {
                    const day = days.find((item: any) => item.dayNumber === index + 1);
                    const challenge = day?.challenge;
                    const open = day && data?.serverNow && new Date(data.serverNow) >= new Date(day.challengeStartTime) && new Date(data.serverNow) < new Date(day.challengeEndTime);
                    return <button key={index} onClick={() => setSelectedDay(selectedDay === index + 1 ? null : index + 1)} className={`arena-card p-4 text-left transition-all ${selectedDay === index + 1 ? 'border-cyber-500' : 'hover:border-arena-500'}`}>
                        <div className="flex justify-between"><span className="text-xs text-gray-500 uppercase">Day {index + 1}</span><span className={`text-[10px] font-bold uppercase ${open ? 'text-emerald-400' : 'text-gray-500'}`}>{open ? 'Open' : day?.status || 'Upcoming'}</span></div>
                        <h3 className="text-white font-bold mt-3">{challenge?.title?.toUpperCase() || GAME_NAMES[index]}</h3>
                        <p className="text-gray-500 text-xs mt-2">{day ? `${timeInLagos(day.challengeStartTime)} – ${timeInLagos(day.challengeEndTime)}` : '9:00 PM – 9:30 PM'}</p>
                        <div className="grid grid-cols-3 gap-2 mt-4 text-[10px]"><span className="text-emerald-400">{day?.submitted ?? 0} submitted</span><span className="text-amber-400">{day?.pending ?? 0} pending</span><span className="text-danger-400">{day?.expired ?? 0} expired</span></div>
                    </button>;
                })}
            </div>
            {selectedDay && (() => { const day = days.find((item: any) => item.dayNumber === selectedDay); return <div className="arena-card p-6 space-y-3"><p className="section-title">Day {selectedDay}</p><p className="text-white text-lg font-semibold">{day?.challenge?.title || GAME_NAMES[selectedDay - 1]}</p><p className="text-gray-400 text-sm">Difficulty: {day?.challenge?.difficulty || 'Configured by the daily engine'}</p><p className="text-gray-500 text-sm">The challenge, generator, renderer, validator, and attempt records are managed through the existing game engine.</p></div>; })()}
        </div>
    );
}
