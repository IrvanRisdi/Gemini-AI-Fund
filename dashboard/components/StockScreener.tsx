'use client';

import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import type { StockScreenerRow } from '@/lib/stock-data';

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export function StockScreener({ rows }: { rows: StockScreenerRow[] }) {
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'intraday' | 'high_score'>('all');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const intradayCount = rows.filter((row) => row.is_intraday).length;
  const highScoreCount = rows.filter(
    (row) =>
      row.evaluation_status === 'ACTIONABLE' ||
      row.evaluation_status === 'WATCH' ||
      (row.evaluation_score ?? 0) >= 65
  ).length;

  const filtered = rows.filter((row) => {
    if (filterMode === 'intraday' && !row.is_intraday) return false;
    if (
      filterMode === 'high_score' &&
      row.evaluation_status !== 'ACTIONABLE' &&
      row.evaluation_status !== 'WATCH' &&
      (row.evaluation_score ?? 0) < 65
    ) {
      return false;
    }
    if (!deferredQuery) return true;
    return (
      row.symbol.toLowerCase().includes(deferredQuery) ||
      row.name.toLowerCase().includes(deferredQuery) ||
      (row.sector ?? '').toLowerCase().includes(deferredQuery)
    );
  });

  function statusBadge(status: string | null | undefined) {
    const s = (status ?? 'INCOMPLETE').toUpperCase();
    if (s === 'ACTIONABLE') {
      return (
        <span className="inline-flex items-center rounded-full border border-positive/30 bg-positive-bg px-2 py-0.5 font-mono text-[10px] font-medium text-positive">
          ACTIONABLE
        </span>
      );
    }
    if (s === 'WATCH') {
      return (
        <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 font-mono text-[10px] font-medium text-blue-300">
          WATCH
        </span>
      );
    }
    if (s === 'WAITING') {
      return (
        <span className="inline-flex items-center rounded-full border border-border bg-bg px-2 py-0.5 font-mono text-[10px] text-ink-muted">
          WAITING
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full border border-border/60 bg-bg/50 px-2 py-0.5 font-mono text-[10px] text-ink-faint">
        {s}
      </span>
    );
  }

  return (
    <section id="screener" className="scroll-mt-20 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-emerald-400">Direktori Emiten BEI</p>
          <h2 className="text-lg font-semibold text-ink">Screener &amp; Stock Directory</h2>
          <p className="font-mono text-[11px] text-ink-faint">
            Menampilkan {filtered.length} dari {rows.length} emiten · klik kode saham untuk membuka chart &amp; evaluasi 5 agen.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="stock-search">
            Cari saham
          </label>
          <input
            id="stock-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari ticker (BBCA), nama, sektor…"
            className="min-w-60 rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs text-ink outline-none focus:border-emerald-500"
          />
          <div className="flex items-center rounded-lg border border-border bg-bg p-1 font-mono text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                filterMode === 'all' ? 'bg-surface text-ink font-semibold' : 'text-ink-muted hover:text-ink'
              }`}
            >
              Semua ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('high_score')}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                filterMode === 'high_score'
                  ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Skor Tinggi ({highScoreCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('intraday')}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                filterMode === 'intraday'
                  ? 'bg-blue-500/15 text-blue-300 font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Intraday ({intradayCount})
            </button>
          </div>
        </div>
      </div>
      <div className="max-h-[680px] overflow-auto rounded-lg border border-border/60">
        <table className="w-full min-w-[820px] text-left font-mono text-xs">
          <thead className="sticky top-0 z-10 border-b border-border bg-surface text-[10px] uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="py-2.5 pl-3">Rank</th>
              <th>Ticker</th>
              <th>Perusahaan</th>
              <th>Sektor</th>
              <th className="text-right pr-4">Harga Terakhir</th>
              <th className="text-right pr-4" title="Persentase terhadap penutupan hari bursa sebelumnya">
                Perubahan
              </th>
              <th className="text-right pr-4">Skor</th>
              <th className="pr-3">Status Evaluasi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.symbol}
                className="border-b border-border/60 text-ink-muted last:border-0 hover:bg-surface-hover transition-colors"
              >
                <td className="py-3 pl-3 text-ink-faint">{row.intraday_rank ?? '—'}</td>
                <td>
                  <Link className="font-semibold text-accent hover:underline" href={`/saham/stocks/${row.symbol}`}>
                    {row.symbol}
                  </Link>
                </td>
                <td className="max-w-xs truncate font-sans text-xs text-ink">{row.name}</td>
                <td className="text-ink-faint">{row.sector || '—'}</td>
                <td className="text-right pr-4">
                  <span className="text-ink font-medium">{row.last_price == null ? '—' : idr.format(row.last_price)}</span>
                  {row.market_data_as_of ? (
                    <span className="block text-[10px] text-ink-faint">
                      {row.market_data_as_of.slice(0, 16).replace('T', ' ')} WIB
                    </span>
                  ) : null}
                </td>
                <td
                  className={`text-right pr-4 font-medium ${
                    (row.change_pct ?? 0) > 0
                      ? 'text-positive'
                      : (row.change_pct ?? 0) < 0
                        ? 'text-negative'
                        : 'text-ink-muted'
                  }`}
                >
                  {row.change_pct == null ? '—' : `${row.change_pct >= 0 ? '+' : ''}${number.format(row.change_pct)}%`}
                </td>
                <td className="text-right pr-4">
                  {row.evaluation_score != null ? (
                    <span
                      className={`font-semibold ${
                        row.evaluation_score >= 70
                          ? 'text-positive'
                          : row.evaluation_score >= 55
                            ? 'text-blue-300'
                            : 'text-ink-muted'
                      }`}
                    >
                      {row.evaluation_score}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="pr-3">
                  {statusBadge(row.evaluation_status)}
                  {row.yahoo_status === 'NOT_FOUND' ? (
                    <span
                      className="block mt-0.5 text-[10px] text-warning"
                      title={`Yahoo 404; pemeriksaan ulang ${row.yahoo_retry_after ?? 'terjadwal'}`}
                    >
                      Data feed tertunda
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
