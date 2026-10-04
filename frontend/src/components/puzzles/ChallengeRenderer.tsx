/**
 * ChallengeRenderer — routes puzzle rendering by type.
 * Phase 2 types + Phase 3 daily types.
 * Adding a new type: create component → import → add case. That's it.
 */

import { PuzzleType, PuzzleProps } from '../../types/puzzle';
// Phase 2
import CodeBreakPuzzle from './CodeBreakPuzzle';
import SequencePuzzle from './SequencePuzzle';
import MemoryPuzzle from './MemoryPuzzle';
import PatternPuzzle from './PatternPuzzle';
import ArrangementPuzzle from './ArrangementPuzzle';
import HiddenObjectPuzzle from './HiddenObjectPuzzle';
import LogicPuzzle from './LogicPuzzle';
import MultiStagePuzzle from './MultiStagePuzzle';
// Phase 3 daily
import BrokenMachinePuzzle from './BrokenMachinePuzzle';
import PatternVaultPuzzle from './PatternVaultPuzzle';
import MemoryVaultPuzzle from './MemoryVaultPuzzle';
import CipherRoomPuzzle from './CipherRoomPuzzle';
import RuleTrapPuzzle from './RuleTrapPuzzle';
import BlackVaultPuzzle from './BlackVaultPuzzle';
import FinalVaultPuzzle from './FinalVaultPuzzle';

interface Props extends PuzzleProps<Record<string, unknown>> {
  puzzleType: PuzzleType | string;
}

export default function ChallengeRenderer(props: Props) {
  const { puzzleType, ...rest } = props;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  switch (puzzleType) {
    // Phase 2
    case 'CODE_BREAK': return <CodeBreakPuzzle    {...rest} displayData={rest.displayData as any} />;
    case 'SEQUENCE': return <SequencePuzzle      {...rest} displayData={rest.displayData as any} />;
    case 'MEMORY': return <MemoryPuzzle         {...rest} displayData={rest.displayData as any} />;
    case 'PATTERN': return <PatternPuzzle        {...rest} displayData={rest.displayData as any} />;
    case 'ARRANGEMENT': return <ArrangementPuzzle   {...rest} displayData={rest.displayData as any} />;
    case 'HIDDEN_OBJECT': return <HiddenObjectPuzzle  {...rest} displayData={rest.displayData as any} />;
    case 'LOGIC': return <LogicPuzzle          {...rest} displayData={rest.displayData as any} />;
    case 'MULTI_STAGE': return <MultiStagePuzzle    {...rest} displayData={rest.displayData as any} />;
    // Phase 3 daily
    case 'BROKEN_MACHINE': return <BrokenMachinePuzzle {...rest} displayData={rest.displayData as any} />;
    case 'PATTERN_VAULT': return <PatternVaultPuzzle  {...rest} displayData={rest.displayData as any} />;
    case 'MEMORY_VAULT': return <MemoryVaultPuzzle   {...rest} displayData={rest.displayData as any} />;
    case 'CIPHER_ROOM': return <CipherRoomPuzzle    {...rest} displayData={rest.displayData as any} />;
    case 'RULE_TRAP': return <RuleTrapPuzzle      {...rest} displayData={rest.displayData as any} />;
    case 'BLACK_VAULT': return <BlackVaultPuzzle    {...rest} displayData={rest.displayData as any} />;
    case 'FINAL_VAULT': return <FinalVaultPuzzle    {...rest} displayData={rest.displayData as any} />;
    default:
      return (
        <div className="arena-card p-8 text-center">
          <p className="text-amber-400 font-mono text-sm">PUZZLE TYPE: {puzzleType}</p>
          <p className="text-gray-500 text-sm mt-2">This puzzle type is not yet available.</p>
        </div>
      );
  }
}
