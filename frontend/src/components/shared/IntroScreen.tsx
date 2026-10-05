/**
 * IntroScreen — state-controlled cinematic opening sequence.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  onComplete: () => void;
}

type Phase = 'welcome' | 'many' | 'winner' | 'opening' | 'done';

const REDUCED = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function IntroScreen({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('welcome');
  const [splitDone, setSplitDone] = useState(false);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addTimer = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timerRefs.current.push(id);
  };

  const clearAllTimers = () => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  };

  const finishIntro = useCallback(() => {
    clearAllTimers();
    setPhase('opening');
    addTimer(() => {
      setSplitDone(true);
      addTimer(onComplete, 50);
    }, REDUCED ? 350 : 1900);
  }, [onComplete]);

  useEffect(() => {
    addTimer(() => setPhase('many'), REDUCED ? 1800 : 3000);
    addTimer(() => setPhase('winner'), REDUCED ? 3600 : 5000);
    addTimer(finishIntro, REDUCED ? 5400 : 7500);

    return clearAllTimers;
  }, [finishIntro]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const blockUnderlyingKeyboard = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', blockUnderlyingKeyboard, true);
    return () => window.removeEventListener('keydown', blockUnderlyingKeyboard, true);
  }, []);

  if (splitDone) return null;

  const message = phase === 'welcome'
    ? 'WELCOME PLAYERS'
    : phase === 'many'
      ? 'TO THE SEVEN DAYS SURVIVAL GAME OF MANY'
      : 'BUT ONLY ONE WINNER.';
  const messageClass = phase === 'winner' ? 'intro-winner' : phase === 'many' ? 'intro-many' : 'intro-welcome';

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{ background: '#030304' }}
      aria-live="polite"
      aria-atomic="true"
    >
      {/* ── Premium dark cinematic background ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 45%, rgba(104, 24, 70, 0.24), transparent 48%), radial-gradient(circle at 18% 80%, rgba(77, 18, 48, 0.2), transparent 38%), #050507',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(115deg, transparent 0 35%, rgba(255, 255, 255, 0.025) 50%, transparent 65%), linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.48))',
          }}
        />
      </div>

      {/* The message is always rendered above the doors; only one message exists. */}
      {phase !== 'opening' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-5 text-center" aria-live="polite">
          <p key={phase} className={`intro-message ${messageClass}`}>
            {message}
          </p>
        </div>
      )}

      {/* ── Center-split panels ── */}
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: '50%',
          background: 'linear-gradient(135deg, #030304 0%, #0f0f1a 100%)',
          transform: phase === 'opening' ? 'translateX(-100%)' : 'translateX(0)',
          transition: phase === 'opening' ? `transform ${REDUCED ? 0 : 1.8}s cubic-bezier(0.76,0,0.24,1)` : 'none',
          zIndex: 10,
          borderRight: '1px solid rgba(0,179,179,0.08)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-y-0 right-0"
        style={{
          width: '50%',
          background: 'linear-gradient(225deg, #030304 0%, #0f0f1a 100%)',
          transform: phase === 'opening' ? 'translateX(100%)' : 'translateX(0)',
          transition: phase === 'opening' ? `transform ${REDUCED ? 0 : 1.8}s cubic-bezier(0.76,0,0.24,1)` : 'none',
          zIndex: 10,
          borderLeft: '1px solid rgba(0,179,179,0.08)',
        }}
        aria-hidden="true"
      />

      <style>{`
        @keyframes introMessageIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .intro-message {
          max-width: 100%;
          margin: 0;
          font-weight: 800;
          letter-spacing: 0.12em;
          line-height: 1.08;
          text-transform: uppercase;
          user-select: none;
          animation: introMessageIn 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .intro-welcome {
          font-size: clamp(2.35rem, 8vw, 7rem);
          color: #fff;
          text-shadow: 0 0 18px rgba(255,255,255,0.38), 0 0 48px rgba(224, 47, 126, 0.5);
        }
        .intro-many {
          max-width: 1100px;
          font-size: clamp(1.15rem, 4.5vw, 4rem);
          color: #fff;
          text-shadow: 0 0 16px rgba(255,255,255,0.3), 0 0 40px rgba(168, 53, 133, 0.48);
        }
        .intro-winner {
          font-size: clamp(2.25rem, 9vw, 8rem);
          color: #fff;
          text-shadow: 0 0 18px rgba(255,255,255,0.5), 0 0 42px rgba(235, 37, 91, 0.78), 0 0 88px rgba(157, 20, 63, 0.42);
        }
        @media (prefers-reduced-motion: reduce) {
          .intro-message { animation: none; }
        }
      `}</style>
    </div>
  );
}
