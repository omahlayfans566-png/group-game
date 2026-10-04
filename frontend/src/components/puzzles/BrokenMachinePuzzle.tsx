/**
 * DAY 1 — THE BROKEN MACHINE
 * Click nodes to rotate them 90° CW until the signal path is correct.
 * Visual: each node shows its connector character and glows when on the path.
 * Mobile-friendly: tap to rotate.
 */
import { useState } from 'react';
import { PuzzleProps } from '../../types/puzzle';

interface NodeData {
  row: number; col: number; type: string;
  rotation: number; symbol: string;
  isPath: boolean; isSource: boolean; isSink: boolean;
}
interface DisplayData {
  size: number;
  nodes: NodeData[][];
  nodeSymbols: Record<string, string[]>;
  instructions: string;
  pathLength: number;
  totalNodes: number;
}
type Props = PuzzleProps<DisplayData>;

const ROTATION_SYMBOLS: Record<string, string[]> = {
  STRAIGHT_H: ['─', '│', '─', '│'],
  STRAIGHT_V: ['│', '─', '│', '─'],
  BEND_NE: ['└', '┌', '┐', '┘'],
  BEND_SE: ['┌', '┐', '┘', '└'],
  BEND_SW: ['┐', '┘', '└', '┌'],
  BEND_NW: ['┘', '└', '┌', '┐'],
  TEE_N: ['┴', '├', '┬', '┤'],
  TEE_E: ['├', '┬', '┤', '┴'],
  TEE_S: ['┬', '┤', '┴', '├'],
  TEE_W: ['┤', '┴', '├', '┬'],
  CROSS: ['┼', '┼', '┼', '┼'],
  DEAD: ['·', '·', '·', '·'],
};

export default function BrokenMachinePuzzle({ displayData, onSubmit, submitting, lastResult, locked }: Props) {
  const { size, nodes: initNodes, instructions } = displayData;

  // Local rotation state — starts from what server sent
  const [rotations, setRotations] = useState<number[][]>(
    initNodes.map(row => row.map(n => n.rotation))
  );

  const getSymbol = (n: NodeData, rot: number) =>
    ROTATION_SYMBOLS[n.type]?.[rot % 4] ?? '·';

  const handleNodeClick = (row: number, col: number) => {
    if (locked || submitting) return;
    setRotations(prev => {
      const next = prev.map(r => [...r]);
      next[row][col] = (next[row][col] + 1) % 4;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (submitting || locked) return;
    await onSubmit({ rotations });
  };

  return (
    <div className="space-y-5">
      <p className="text-gray-300 text-sm leading-relaxed">{instructions}</p>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-emerald-900 border border-emerald-600 rounded inline-block" /> SOURCE ⚡</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-amber-900 border border-amber-600 rounded inline-block" /> SINK 🎯</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-cyber-900 border border-cyber-700 rounded inline-block" /> Path node</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 bg-arena-800 border border-arena-600 rounded inline-block" /> Decoy</span>
        <span className="text-amber-400 font-semibold ml-2">Tap/Click to rotate 90°</span>
      </div>

      {/* Circuit grid */}
      <div
        className="grid gap-1 mx-auto select-none"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, maxWidth: Math.min(size * 56, 360) }}
      >
        {initNodes.flat().map((node) => {
          const rot = rotations[node.row][node.col];
          const sym = getSymbol(node, rot);
          return (
            <button
              key={`${node.row}-${node.col}`}
              onClick={() => handleNodeClick(node.row, node.col)}
              disabled={locked || submitting}
              title={`Row ${node.row + 1}, Col ${node.col + 1} — Click to rotate`}
              className={`
                w-12 h-12 sm:w-14 sm:h-14 rounded-lg border-2 flex items-center justify-center
                text-xl font-mono font-bold transition-all duration-150 touch-manipulation
                ${node.isSource
                  ? 'bg-emerald-900 border-emerald-500 text-emerald-300'
                  : node.isSink
                    ? 'bg-amber-900 border-amber-500 text-amber-300'
                    : node.isPath
                      ? 'bg-cyber-900 border-cyber-700 hover:border-cyber-400 active:scale-95 text-cyber-300 cursor-pointer'
                      : 'bg-arena-800 border-arena-600 hover:border-arena-500 active:scale-95 text-gray-500 cursor-pointer'}
                ${!locked && 'hover:shadow-[0_0_8px_rgba(0,179,179,0.3)]'}
                disabled:cursor-default
              `}
            >
              {node.isSource && rot === node.rotation && sym === '·' ? '⚡' :
                node.isSink && rot === node.rotation && sym === '·' ? '🎯' :
                  sym}
            </button>
          );
        })}
      </div>

      {/* Rotation count indicator */}
      <div className="text-center">
        <p className="text-gray-600 text-xs font-mono">
          {rotations.flat().reduce((sum, r, i) => sum + (r !== initNodes.flat()[i]?.rotation ? 1 : 0), 0)} node(s) rotated
        </p>
      </div>

      {/* Feedback */}
      {lastResult && (
        <div className={`rounded-lg px-4 py-3 border flex items-start gap-2 ${lastResult.isCorrect ? 'bg-emerald-900/30 border-emerald-700' : 'bg-danger-900/30 border-danger-700'}`}>
          <span className="text-lg shrink-0">{lastResult.isCorrect ? '⚡' : '✗'}</span>
          <p className={`text-sm ${lastResult.isCorrect ? 'text-emerald-300' : 'text-danger-300'}`}>{lastResult.feedback}</p>
        </div>
      )}

      {!locked && (
        <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full py-4 text-base tracking-wider">
          {submitting
            ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Testing circuit…</span>
            : '⚡ ACTIVATE THE MACHINE'}
        </button>
      )}
    </div>
  );
}
