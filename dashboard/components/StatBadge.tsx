export type BadgeTone = 'positive' | 'negative' | 'accent' | 'warning' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  positive: 'bg-positive-bg text-positive',
  negative: 'bg-negative-bg text-negative',
  accent: 'bg-accent-bg text-accent',
  warning: 'bg-warning-bg text-warning',
  neutral: 'bg-neutral-bg text-neutral',
};

export function StatBadge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide uppercase ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
