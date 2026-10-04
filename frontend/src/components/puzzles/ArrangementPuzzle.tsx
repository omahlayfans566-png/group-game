import { useState, useRef } from 'react';
import { PuzzleProps, ArrangementDisplayData } from '../../types/puzzle';

type Item = { id: number; label: string };
type Props = PuzzleProps<ArrangementDisplayData>;

export default function ArrangementPuzzle({ displayData, onSubmit, submitting, lastResult, locked }: Props) {
  const { items: initialItems, instructions } = displayData;

  const [orderedItems, setOrderedItems] = useState<Item[]>([...initialItems]);
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  // ─── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (idx: number) => {
    dragIndex.current = idx;
  };

  const handleDragEnter = (idx: number) => {
    dragOverIndex.current = idx;
    if (dragIndex.current === null || dragIndex.current === idx) return;

    const newItems = [...orderedItems];
    const dragged = newItems.splice(dragIndex.current, 1)[0];
    newItems.splice(idx, 0, dragged);
    dragIndex.current = idx;
    setOrderedItems(newItems);
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    dragOverIndex.current = null;
  };

  // ─── Touch handlers (mobile) ───────────────────────────────────────────────

  const touchStartY  = useRef<number>(0);
  const touchItemIdx = useRef<number | null>(null);

  const handleTouchStart = (idx: number, e: React.TouchEvent) => {
    touchItemIdx.current = idx;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (touchItemIdx.current === null) return;
    const el = document.elementFromPoint(
      e.touches[0].clientX, e.touches[0].clientY
    ) as HTMLElement;
    const idxAttr = el?.closest('[data-idx]')?.getAttribute('data-idx');
    if (idxAttr !== null && idxAttr !== undefined) {
      const targetIdx = Number(idxAttr);
      if (targetIdx !== touchItemIdx.current) {
        const newItems = [...orderedItems];
        const dragged = newItems.splice(touchItemIdx.current, 1)[0];
        newItems.splice(targetIdx, 0, dragged);
        touchItemIdx.current = targetIdx;
        setOrderedItems(newItems);
      }
    }
  };

  const handleTouchEnd = () => { touchItemIdx.current = null; };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (submitting || locked) return;
    await onSubmit({ order: orderedItems.map(i => i.label) });
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-300 text-sm leading-relaxed">{instructions}</p>

      <p className="text-xs uppercase tracking-[0.2em] text-cyber-400 font-semibold">
        ◆ Drag items into the correct order
      </p>

      <div className="space-y-2 select-none">
        {orderedItems.map((item, idx) => (
          <div
            key={item.id}
            data-idx={idx}
            draggable={!locked && !submitting}
            onDragStart={() => handleDragStart(idx)}
            onDragEnter={() => handleDragEnter(idx)}
            onDragEnd={handleDragEnd}
            onDragOver={e => e.preventDefault()}
            onTouchStart={e => handleTouchStart(idx, e)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`
              flex items-center gap-4 px-4 py-3 rounded-lg border transition-all duration-150 cursor-grab active:cursor-grabbing
              ${locked ? 'border-arena-700 opacity-50 cursor-not-allowed' : 'border-arena-600 hover:border-cyber-700 hover:bg-arena-700/50'}
              bg-arena-800
            `}
          >
            {/* Position badge */}
            <span className="text-gray-600 font-mono text-xs w-5 shrink-0 text-center">
              {idx + 1}
            </span>

            {/* Drag handle */}
            <span className="text-gray-600 shrink-0" title="Drag to reorder">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 6h2v2H8zm6 0h2v2h-2zM8 11h2v2H8zm6 0h2v2h-2zM8 16h2v2H8zm6 0h2v2h-2z"/>
              </svg>
            </span>

            <span className="text-white font-medium flex-1">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {lastResult && (
        <div className={`rounded-lg px-4 py-3 border ${lastResult.isCorrect ? 'bg-emerald-900/30 border-emerald-700' : 'bg-danger-900/30 border-danger-700'}`}>
          <p className={`text-sm ${lastResult.isCorrect ? 'text-emerald-300' : 'text-danger-300'}`}>
            {lastResult.feedback}
          </p>
        </div>
      )}

      {!locked && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-primary w-full py-4 text-base tracking-widest"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Checking order…
            </span>
          ) : 'CONFIRM ORDER'}
        </button>
      )}
    </div>
  );
}
