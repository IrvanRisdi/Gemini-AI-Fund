'use client';

import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import type { StockScreenerRow } from '@/lib/stock-data';

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export function StockScreener({ rows }: { rows: StockScreenerRow[] }) {
  const [query, setQuery] = useState('');
  const [onlyIntraday, setOnlyIntraday] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filtered = rows.filter((row) => (!onlyIntraday || row.is_intraday) && (!deferredQuery || row.symbol.toLowerCase().includes(deferredQuery) || row.name.toLowerCase().includes(deferredQuery) || (row.sector ?? '').toLowerCase().includes(deferredQuery)));

  return (
    <section id="screener" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div><p className="font-mono text-[10px] uppercase tracking-wide text-emerald-400">All active IDX</p><h2 className="text-lg font-semibold text-ink">Screener & stock directory</h2><p className="font-mono text-[11px] text-ink-faint">{filtered.length} dari {rows.length} emiten · klik ticker untuk detail tersimpan.</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="stock-search">Cari saham</label>
          <input id="stock-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari ticker, nama, sektor…" className="min-w-64 rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs text-ink outline-none focus:border-emerald-500" />
          <button type="button" aria-pressed={onlyIntraday} onClick={() => setOnlyIntraday((value) => !value)} className={`rounded-lg border px-3 py-2 font-mono text-xs ${onlyIntraday ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-border text-ink-muted'}`}>50 intraday</button>
        </div>
      </div>
      <div className="max-h-[720px] overflow-auto">
        <table className="w-full min-w-[820px] text-left font-mono text-xs">
          <thead className="sticky top-0 z-10 border-b border-border bg-surface text-[10px] uppercase tracking-wide text-ink-faint"><tr><th className="py-2">Rank</th><th>Ticker</th><th>Perusahaan</th><th>Sektor</th><th>Harga</th><th>Change</th><th>Score</th><th>Status</th></tr></thead>
          <tbody>{filtered.map((row) => <tr key={row.symbol} className="border-b border-border/60 text-ink-muted last:border-0 hover:bg-surface-hover"><td className="py-3">{row.intraday_rank ?? '—'}</td><td><Link className="font-semibold text-accent hover:underline" href={`/saham/stocks/${row.symbol}`}>{row.symbol}</Link></td><td className="max-w-xs truncate text-ink">{row.name}</td><td>{row.sector || '—'}</td><td>{row.last_price == null ? '—' : idr.format(row.last_price)}</td><td className={(row.change_pct ?? 0) > 0 ? 'text-positive' : (row.change_pct ?? 0) < 0 ? 'text-negative' : ''}>{row.change_pct == null ? '—' : `${row.change_pct >= 0 ? '+' : ''}${number.format(row.change_pct)}%`}</td><td>{row.evaluation_score ?? '—'}</td><td>{row.evaluation_status ?? 'INCOMPLETE'}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
