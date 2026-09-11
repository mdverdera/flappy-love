'use client';

interface Props {
  connected: boolean;
  className?: string;
}

export default function ConnectionBadge({ connected, className = '' }: Props) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-medium select-none ${className}`}
      aria-live="polite"
    >
      <span
        className="w-2 h-2 rounded-full inline-block"
        style={{ background: connected ? '#22c55e' : '#ef4444' }}
      />
      <span style={{ color: connected ? '#86efac' : '#fca5a5' }}>
        {connected ? 'Connected' : 'Reconnecting…'}
      </span>
    </div>
  );
}
