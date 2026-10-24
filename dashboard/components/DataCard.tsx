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
  roleTag,
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
  roleTag?: string;
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
  const className =
    'group flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg hover:shadow-black/20';

  const content = (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            {roleTag && (
              <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-wide text-blue-400">
                {roleTag}
              </p>
            )}
            <h3 className="font-sans text-lg font-semibold text-ink group-hover:text-accent transition-colors">{title}</h3>
            {subtitle && <p className="mt-0.5 font-mono text-[11px] text-ink-muted">{subtitle}</p>}
          </div>
          {live && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-positive/25 bg-positive-bg/50 px-2 py-0.5 font-mono text-[10px] font-medium text-positive">
              <span className="relative flex h-1.5 w-1.5">
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
          <div className="rounded-lg border border-border/80 bg-bg/70 px-3 py-2.5">
            <StatBadge tone={statusTone}>{statusLabel}</StatBadge>
            {statusDescription && (
              <p className="mt-1.5 font-sans text-xs leading-relaxed text-ink-muted line-clamp-2">{statusDescription}</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-1 border-t border-border pt-3">
        <div className="flex items-end justify-between">
          <div>
            <span className="block font-mono text-[10px] uppercase tracking-wide text-ink-faint">Total Ekuitas</span>
            <span className="font-mono text-xl font-semibold tracking-tight text-ink">{value}</span>
          </div>
          {deltaPct != null && (
            <span className={`font-mono text-sm font-semibold ${deltaTone === 'positive' ? 'text-positive' : deltaTone === 'negative' ? 'text-negative' : 'text-ink-muted'}`}>
              {deltaSign}
              {deltaPct.toFixed(2)}%
            </span>
          )}
        </div>
        {href && (
          <p className="mt-2 font-mono text-[10px] text-ink-faint group-hover:text-accent transition-colors">
            Lihat detail agen &amp; jurnal →
          </p>
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
