import { PlayerStatus } from '../../types';

interface Props {
  status: PlayerStatus | string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  ACTIVE:     { label: 'ACTIVE',     cls: 'badge-active' },
  IN_PROGRESS:{ label: 'IN PROGRESS',cls: 'badge-progress' },
  COMPLETED:  { label: 'COMPLETED',  cls: 'badge-completed' },
  SAFE:       { label: 'SAFE',       cls: 'badge-safe' },
  ELIMINATED: { label: 'ELIMINATED', cls: 'badge-eliminated' },
  FINALIST:   { label: 'FINALIST',   cls: 'badge-finalist' },
  WINNER:     { label: '🏆 WINNER',  cls: 'badge-winner' },
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const cfg = statusConfig[status] ?? { label: status, cls: 'badge-active' };
  return (
    <span className={`${cfg.cls} ${size === 'sm' ? 'text-xs px-2 py-0.5' : ''}`}>
      {cfg.label}
    </span>
  );
}
