import { StatBadge } from './StatBadge';
import type { CoinInfo } from '@/lib/coingecko';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function CoinInfoPanel({ info }: { info: CoinInfo | null }) {
  if (!info) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5">
        <h3 className="font-sans text-lg font-semibold text-ink">Fundamental Koin</h3>
        <StatBadge tone="warning">unavailable</StatBadge>
        <p className="font-sans text-xs text-ink-muted italic">
          CoinGecko's public API couldn't be reached from this server right now. This panel degrades gracefully — everything
          else on the page is unaffected.
        </p>
      </div>
    );
  }

  const description = stripHtml(info.descriptionEn).split('. ').slice(0, 2).join('. ');

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-lg font-semibold text-ink">
          {info.name} <span className="text-ink-muted">({info.symbol})</span>
        </h3>
        {info.rank && <StatBadge tone="accent">Rank #{info.rank}</StatBadge>}
      </div>

      {description && <p className="font-sans text-xs leading-relaxed text-ink-muted italic">{description}.</p>}

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-border bg-bg/60 px-3 py-2.5">
          <span className="block font-mono text-[10px] tracking-wide text-ink-muted uppercase">Market Cap</span>
          <span className="font-mono text-sm font-semibold text-ink">{info.marketCapUsd ? formatUsd(info.marketCapUsd) : '—'}</span>
          </div>
          <div className="rounded-lg border border-border bg-bg/60 px-3 py-2.5">
            <span className="block font-mono text-[10px] tracking-wide text-ink-muted uppercase">FDV</span>
            <span className="font-mono text-sm font-semibold text-ink">{info.fullyDilutedValuationUsd ? formatUsd(info.fullyDilutedValuationUsd) : '—'}</span>
          </div>
          <div className="rounded-lg border border-border bg-bg/60 px-3 py-2.5">
          <span className="block font-mono text-[10px] tracking-wide text-ink-muted uppercase">24h Volume</span>
          <span className="font-mono text-sm font-semibold text-ink">{info.volume24hUsd ? formatUsd(info.volume24hUsd) : '—'}</span>
          </div>
          <div className="rounded-lg border border-border bg-bg/60 px-3 py-2.5">
            <span className="block font-mono text-[10px] tracking-wide text-ink-muted uppercase">Max Supply</span>
            <span className="font-mono text-sm font-semibold text-ink">
              {info.maxSupply ? Math.round(info.maxSupply).toLocaleString('en-US') : info.totalSupply ? Math.round(info.totalSupply).toLocaleString('en-US') : '—'}
            </span>
          </div>
        <div className="rounded-lg border border-border bg-bg/60 px-3 py-2.5">
          <span className="block font-mono text-[10px] tracking-wide text-ink-muted uppercase">Circulating Supply</span>
          <span className="font-mono text-sm font-semibold text-ink">
            {info.circulatingSupply ? Math.round(info.circulatingSupply).toLocaleString('en-US') : '—'}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-bg/60 px-3 py-2.5">
          <span className="block font-mono text-[10px] tracking-wide text-ink-muted uppercase">All-Time High</span>
          <span className="font-mono text-sm font-semibold text-ink">{info.athUsd ? formatUsd(info.athUsd) : '—'}</span>
        </div>
      </div>

      {info.homepage && (
        <a href={info.homepage} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent hover:underline">
          {info.homepage}
        </a>
      )}
    </div>
  );
}
