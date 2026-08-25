'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PAIRS } from '@/lib/pairs';
import { formatWibDateTime } from '@/lib/time';
import type { ExplorePairRow } from '@/lib/market-data';

type SortKey = 'rank' | 'symbol' | 'marketCap' | 'price' | 'change' | 'volume';
type SortDir = 'asc' | 'desc';
type Filter = 'all' | 'watchlist' | 'desk' | 'gainers' | 'losers' | 'volume';
const PAGE_SIZE = 50;
const DESK_SYMBOLS = new Set(PAIRS.map((pair) => pair.symbol));
const WATCHLIST_STORAGE_KEY = 'gemini-ai-fund:explore-watchlist';

function formatMarketCap(value: number | null): string {
  if (value == null) return '—';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${value.toLocaleString('en-US')}`;
}

function formatIdr(value: number | null): string {
  if (value == null) return '—';
  if (value >= 1000) return `Rp${Math.round(value).toLocaleString('id-ID')}`;
  return `Rp${value.toLocaleString('id-ID', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`;
}

function formatCompactIdr(value: number | null): string {
  if (value == null) return '—';
  if (value >= 1_000_000_000_000) return `Rp${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}Jt`;
  return formatIdr(value);
}

function sortValue(row: ExplorePairRow, key: SortKey): number | string | null {
  if (key === 'rank') return row.rank;
  if (key === 'symbol') return row.symbol;
  if (key === 'marketCap') return row.marketCapUsd;
  if (key === 'price') return row.priceIdr;
  if (key === 'volume') return row.volumeIdr;
  return row.globalChangePct24h;
}

function SortHeader({ label, sortKey, active, dir, align = 'left', onClick }: { label: string; sortKey: SortKey; active: SortKey; dir: SortDir; align?: 'left' | 'right'; onClick: (key: SortKey) => void }) {
  const isActive = active === sortKey;
  return <th className={`cursor-pointer px-4 py-2.5 font-mono text-[10px] font-medium tracking-wide uppercase select-none ${align === 'right' ? 'text-right' : 'text-left'} ${isActive ? 'text-accent' : 'text-ink-muted hover:text-ink'}`} onClick={() => onClick(sortKey)}>{label}{isActive && <span className="ml-1">{dir === 'desc' ? '▼' : '▲'}</span>}</th>;
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-border bg-surface px-3.5 py-3"><p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">{label}</p><p className="mt-1 font-mono text-base font-semibold text-ink">{value}</p><p className="mt-0.5 truncate font-sans text-[11px] text-ink-muted">{detail}</p></div>;
}

export function PairExplorer({ pairs, updatedAt }: { pairs: ExplorePairRow[]; updatedAt: string }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(WATCHLIST_STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) setWatchlist(saved.filter((symbol): symbol is string => typeof symbol === 'string'));
    } catch {}
  }, []);

  function toggleWatchlist(symbol: string) {
    setWatchlist((current) => {
      const next = current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol];
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const market = useMemo(() => {
    const movers = pairs.filter((pair) => pair.globalChangePct24h != null);
    const gainers = movers.filter((pair) => pair.globalChangePct24h! > 0).length;
    const losers = movers.filter((pair) => pair.globalChangePct24h! < 0).length;
    const topGainer = [...movers].sort((a, b) => b.globalChangePct24h! - a.globalChangePct24h!)[0];
    const topVolume = [...pairs].sort((a, b) => (b.volumeIdr ?? -1) - (a.volumeIdr ?? -1))[0];
    return { gainers, losers, topGainer, topVolume };
  }, [pairs]);

  function handleSort(key: SortKey) {
    setPage(1);
    if (key === sortKey) setSortDir((direction) => direction === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir(key === 'rank' || key === 'symbol' ? 'asc' : 'desc'); }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pairs.filter((pair) => {
      const matchesSearch = !q || pair.symbol.includes(q) || pair.name.toLowerCase().includes(q) || pair.indodaxId.includes(q);
      const matchesFilter = filter === 'all' || (filter === 'watchlist' && watchlist.includes(pair.symbol)) || (filter === 'desk' && DESK_SYMBOLS.has(pair.symbol)) || (filter === 'gainers' && (pair.globalChangePct24h ?? 0) > 0) || (filter === 'losers' && (pair.globalChangePct24h ?? 0) < 0) || (filter === 'volume' && pair.volumeIdr != null);
      return matchesSearch && matchesFilter;
    });
  }, [pairs, query, filter, watchlist]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const left = sortValue(a, sortKey); const right = sortValue(b, sortKey);
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    const compared = typeof left === 'string' && typeof right === 'string' ? left.localeCompare(right) : (left as number) - (right as number);
    return sortDir === 'asc' ? compared : -compared;
  }), [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(pageStart, pageStart + PAGE_SIZE);

  return <div className="flex flex-col gap-4">
    <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <SummaryCard label="Universe Indodax" value={`${pairs.length} pair`} detail={`Diperbarui ${formatWibDateTime(updatedAt)}`} />
      <SummaryCard label="Market Breadth" value={`${market.gainers} naik / ${market.losers} turun`} detail="Berdasarkan perubahan global 24j" />
      <SummaryCard label="Top Gainer Global" value={market.topGainer ? `${market.topGainer.symbol.toUpperCase()} +${market.topGainer.globalChangePct24h?.toFixed(2)}%` : '—'} detail="Data CoinGecko · bukan sinyal trade" />
      <SummaryCard label="Volume IDR Tertinggi" value={market.topVolume?.symbol.toUpperCase() ?? '—'} detail={market.topVolume ? formatCompactIdr(market.topVolume.volumeIdr) : 'Data belum tersedia'} />
    </section>

    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center">
      <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={`Cari ${pairs.length} pair…`} className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none" />
      <div className="flex flex-wrap gap-1.5">
        {([['all', 'Semua'], ['watchlist', `Watchlist (${watchlist.length})`], ['desk', 'Universe Desk'], ['gainers', 'Naik'], ['losers', 'Turun'], ['volume', 'Ber-volume']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => { setFilter(key); setPage(1); }} className={`rounded-full border px-2.5 py-1 font-mono text-[10px] ${filter === key ? 'border-accent bg-accent/10 text-accent' : 'border-border text-ink-muted hover:border-accent/50 hover:text-ink'}`}>{label}</button>)}
      </div>
    </div>

    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[980px] border-collapse"><thead><tr className="border-b border-border"><SortHeader label="#" sortKey="rank" active={sortKey} dir={sortDir} onClick={handleSort} /><SortHeader label="Pair" sortKey="symbol" active={sortKey} dir={sortDir} onClick={handleSort} /><SortHeader label="Market Cap" sortKey="marketCap" active={sortKey} dir={sortDir} onClick={handleSort} /><SortHeader label="Harga IDR" sortKey="price" active={sortKey} dir={sortDir} align="right" onClick={handleSort} /><SortHeader label="Global 24j" sortKey="change" active={sortKey} dir={sortDir} align="right" onClick={handleSort} /><SortHeader label="Volume IDR" sortKey="volume" active={sortKey} dir={sortDir} align="right" onClick={handleSort} /><th className="px-4 py-2.5 text-right font-mono text-[10px] font-medium tracking-wide text-ink-muted uppercase">High / Low</th></tr></thead>
        <tbody>{pageRows.map((pair, index) => <tr key={pair.symbol} className={`border-b border-border last:border-0 hover:bg-surface-hover ${index % 2 === 1 ? 'bg-bg/40' : ''}`}><td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{pair.rank ?? '—'}</td><td className="px-4 py-2.5"><div className="flex items-center gap-2"><button type="button" onClick={() => toggleWatchlist(pair.symbol)} aria-label={`${watchlist.includes(pair.symbol) ? 'Hapus' : 'Tambah'} ${pair.symbol.toUpperCase()} ${watchlist.includes(pair.symbol) ? 'dari' : 'ke'} watchlist`} className={`shrink-0 text-base leading-none transition-colors ${watchlist.includes(pair.symbol) ? 'text-warning' : 'text-ink-faint hover:text-warning'}`}>{watchlist.includes(pair.symbol) ? '★' : '☆'}</button><Link href={`/pair/${pair.symbol}`} className="block min-w-0"><span className="font-mono text-sm font-semibold text-ink hover:text-accent">{pair.symbol.toUpperCase()}{DESK_SYMBOLS.has(pair.symbol) && <span className="ml-1.5 rounded border border-accent/30 bg-accent/10 px-1 py-0.5 text-[9px] text-accent">DESK</span>}</span><span className="block truncate font-sans text-xs text-ink-muted">{pair.name}</span></Link></div></td><td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{formatMarketCap(pair.marketCapUsd)}</td><td className="px-4 py-2.5 text-right font-mono text-xs text-ink">{formatIdr(pair.priceIdr)}</td><td className={`px-4 py-2.5 text-right font-mono text-xs ${pair.globalChangePct24h == null ? 'text-ink-muted' : pair.globalChangePct24h >= 0 ? 'text-positive' : 'text-negative'}`}>{pair.globalChangePct24h == null ? '—' : `${pair.globalChangePct24h >= 0 ? '+' : ''}${pair.globalChangePct24h.toFixed(2)}%`}</td><td className="px-4 py-2.5 text-right font-mono text-xs text-ink-muted">{formatCompactIdr(pair.volumeIdr)}</td><td className="px-4 py-2.5 text-right font-mono text-xs text-ink-muted">{formatIdr(pair.highIdr)} / {formatIdr(pair.lowIdr)}</td></tr>)}</tbody>
      </table>
    </div>

    {sorted.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-ink-muted"><span>Menampilkan {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, sorted.length)} dari {sorted.length} pair</span>{totalPages > 1 && <nav className="flex items-center gap-1.5" aria-label="Pagination pair"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} className="rounded border border-border px-2 py-1 disabled:opacity-40">←</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <button key={number} type="button" onClick={() => setPage(number)} className={`rounded border px-2 py-1 ${currentPage === number ? 'border-accent bg-accent/10 text-accent' : 'border-border'}`}>{number}</button>)}<button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages} className="rounded border border-border px-2 py-1 disabled:opacity-40">→</button></nav>}</div>}
    {sorted.length === 0 && <p className="py-8 text-center font-sans text-sm text-ink-muted">{filter === 'watchlist' ? 'Watchlist masih kosong. Klik bintang pada pair untuk menambahkannya.' : 'Tidak ada pair yang sesuai.'}</p>}
  </div>;
}
