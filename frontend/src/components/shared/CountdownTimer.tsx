import { useEffect, useState, useCallback } from 'react';

interface Props {
  deadlineAt: string;           // ISO string from server
  onExpire?: () => void;
  className?: string;
}

function formatTime(totalSeconds: number): { h: string; m: string; s: string } {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return {
    h: String(h).padStart(2, '0'),
    m: String(m).padStart(2, '0'),
    s: String(s).padStart(2, '0'),
  };
}

export default function CountdownTimer({ deadlineAt, onExpire, className = '' }: Props) {
  const getRemaining = useCallback((): number => {
    // Calculate remaining time from server deadline — never trusts client clock for accuracy,
    // but uses it for display. The server will reject late submissions regardless.
    const diff = new Date(deadlineAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  }, [deadlineAt]);

  const [remaining, setRemaining] = useState<number>(getRemaining);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (expired) return;

    const tick = () => {
      const r = getRemaining();
      setRemaining(r);
      if (r <= 0 && !expired) {
        setExpired(true);
        onExpire?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineAt, expired, getRemaining, onExpire]);

  if (expired) {
    return (
      <div className={`${className}`}>
        <span className="text-danger-400 font-mono font-bold tracking-widest animate-pulse-fast">
          TIME EXPIRED
        </span>
      </div>
    );
  }

  const { h, m, s } = formatTime(remaining);
  const isUrgent = remaining <= 60;
  const isWarning = remaining <= 300;

  const colorClass = isUrgent
    ? 'text-danger-400 animate-pulse-fast'
    : isWarning
    ? 'text-amber-400'
    : 'text-cyber-300';

  return (
    <div className={`${className}`}>
      <span className={`font-mono font-bold tracking-widest text-2xl ${colorClass}`}>
        {h !== '00' && <>{h}:</>}{m}:{s}
      </span>
    </div>
  );
}
