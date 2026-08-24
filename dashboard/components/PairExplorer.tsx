'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ExplorePairRow } from '@/lib/market-data';

type SortKey = 'rank' | 'symbol' | 'marketCap' | 'price' | 'change';
type SortDir = 'asc' | 'desc';

function formatMarketCap(value: number | null): string {
  if (value == null) return '—';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${value.toLocaleString('en-US')}`;
}

function formatPriceIdr(value: number | null): string {
  if (value == null) return '—';
  if (value >= 1000) return `Rp${Math.round(value).toLocaleString('id-ID')}`;
  return `Rp${value.toLocaleString('id-ID', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`;
}

function sortValue(row: ExplorePairRow, key: SortKey): number | string | null {
  switch (key) {
    case 'rank':
      return row.rank;
    case 'symbol':
      return row.symbol;
    case 'marketCap':
      return row.marketCapUsd;
    case 'price':
      return row.priceIdr;
    case 'change':
      return row.changePct24h;
  }
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  align = 'left',
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  align?: 'left' | 'right';
  onClick: (key: SortKey) => void;
}) {
  const isActive = active === sortKey;
  return (
    <th
      className={`cursor-pointer px-4 py-2.5 font-mono text-[10px] font-medium tracking-wide uppercase select-none ${align === 'right' ? 'text-right' : 'text-left'} ${isActive ? 'text-accent' : 'text-ink-muted hover:text-ink'}`}
      onClick={() => onClick(sortKey)}
    >
      {label}
      {isActive && <span className="ml-1">{dir === 'desc' ? '▼' : '▲'}</span>}
    </th>
  );
}

export function PairExplorer({ pairs }: { pairs: ExplorePairRow[] }) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      // First click on a new column leads with its most "interesting" end —
      // e.g. clicking Moving shows top gainers first, click again for top losers.
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pairs;
    return pairs.filter((p) => p.symbol.includes(q) || p.name.toLowerCase().includes(q) || p.indodaxId.includes(q));
  }, [pairs, query]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      // Missing data always sorts to the bottom, in either direction —
      // "top loser" should surface real losers, not just unknowns.
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb) : (va as number) - (vb as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${pairs.length} pairs by symbol or name…`}
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <span className="shrink-0 font-mono text-xs text-ink-muted">{sorted.length} results</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <SortHeader label="#" sortKey="rank" active={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="Pair" sortKey="symbol" active={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="Market Cap" sortKey="marketCap" active={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="Price" sortKey="price" active={sortKey} dir={sortDir} align="right" onClick={handleSort} />
              <SortHeader label="Moving (24h)" sortKey="change" active={sortKey} dir={sortDir} align="right" onClick={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.symbol} className={`border-b border-border last:border-0 hover:bg-surface-hover ${i % 2 === 1 ? 'bg-bg/40' : ''}`}>
                <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{p.rank ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/pair/${p.symbol}`} className="block">
                    <span className="font-mono text-sm font-semibold text-ink hover:text-accent">{p.symbol.toUpperCase()}</span>
                    <span className="block truncate font-sans text-xs text-ink-muted">{p.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{formatMarketCap(p.marketCapUsd)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-ink">{formatPriceIdr(p.priceIdr)}</td>
                <td className={`px-4 py-2.5 text-right font-mono text-xs ${p.changePct24h == null ? 'text-ink-muted' : p.changePct24h >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {p.changePct24h == null ? '—' : `${p.changePct24h >= 0 ? '+' : ''}${p.changePct24h.toFixed(2)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && <p className="py-8 text-center font-sans text-sm text-ink-muted">No pairs match &ldquo;{query}&rdquo;.</p>}
    </div>
  );
}
