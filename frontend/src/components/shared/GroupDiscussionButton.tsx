interface Props {
  label?: string;
  className?: string;
  groupLink?: string;
}

export default function GroupDiscussionButton({
  label = 'Discuss in Group',
  className = '',
  groupLink,
}: Props) {
  const link = groupLink || import.meta.env.VITE_GROUP_LINK || '#';

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 btn-ghost text-sm ${className}`}
    >
      <span className="text-lg">💬</span>
      <span>{label}</span>
      <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}
