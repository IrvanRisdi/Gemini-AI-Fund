import Link from 'next/link';
import { StatBadge, type BadgeTone } from './StatBadge';

export interface DataCardBadge {
  label: string;
  tone: BadgeTone;
}

export function DataCard({
  title,
  href,
  subtitle,
  badges = [],
  statusTone = 'neutral',
  statusLabel,
  statusDescription,
  value,
  deltaPct,
  live = false,
}: {
  title: string;
  href?: string;
  subtitle?: string;
  badges?: DataCardBadge[];
  statusTone?: BadgeTone;
  statusLabel?: string;
  statusDescription?: string;
  value: string;
  deltaPct?: number;
  live?: boolean;
}) {
  const deltaTone: BadgeTone = deltaPct == null ? 'neutral' : deltaPct > 0 ? 'positive' : deltaPct < 0 ? 'negative' : 'neutral';
  const deltaSign = deltaPct != null && deltaPct > 0 ? '+' : '';
  const className = 'flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong';

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-sans text-lg font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {live && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-positive">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-live-pulse rounded-full bg-positive" />
            </span>
            LIVE
          </span>
        )}
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {badges.map((b) => (
            <StatBadge key={b.label} tone={b.tone}>
              {b.label}
            </StatBadge>
          ))}
        </div>
      )}

      {statusLabel && (
        <div className="rounded-lg border border-border bg-bg/60 px-3 py-2.5">
          <StatBadge tone={statusTone}>{statusLabel}</StatBadge>
          {statusDescription && (
            <p className="mt-1.5 font-sans text-xs leading-relaxed text-ink-muted italic">{statusDescription}</p>
          )}
        </div>
      )}

      <div className="mt-1 flex items-end justify-between border-t border-border pt-3">
        <span className="font-mono text-xl font-semibold tracking-tight text-ink">{value}</span>
        {deltaPct != null && (
          <span className={`font-mono text-sm font-medium ${deltaTone === 'positive' ? 'text-positive' : deltaTone === 'negative' ? 'text-negative' : 'text-ink-muted'}`}>
            {deltaSign}
            {deltaPct.toFixed(2)}%
          </span>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
