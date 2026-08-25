'use client';

import { useState } from 'react';
import type { PendingOrder, PositionCycle } from '@/lib/desk-data';
import { StatBadge, type BadgeTone } from './StatBadge';
import { formatWibTime } from '@/lib/time';

const PAGE_SIZE = 10;

function fmtIdr(value: number): string {
  return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}

function fmtSignedIdr(value: number): string {
  return `${value >= 0 ? '+' : '-'}${fmtIdr(Math.abs(value))}`;
}

function fmtPrice(value: number): string {
  if (Math.abs(value) >= 1) return fmtIdr(value);
  return `Rp${value.toLocaleString('id-ID', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`;
}

function fmtDate(iso: string): string {
  const datePart = new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', timeZone: 'Asia/Jakarta' });
  return `${datePart} ${formatWibTime(iso)}`;
}

const SIDE_LABEL: Record<PositionCycle['side'], string> = { long: 'LONG', short: 'SHORT' };
const SIDE_TONE: Record<PositionCycle['side'], BadgeTone> = { long: 'accent', short: 'warning' };

function PositionTable({ cycles }: { cycles: PositionCycle[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[600px] table-auto border-collapse font-mono text-xs">
        <thead>
          <tr className="border-b border-border bg-bg/60 text-left text-ink-muted">
            <th className="px-3 py-2.5 font-medium tracking-wide uppercase">Status</th>
            <th className="px-3 py-2.5 font-medium tracking-wide uppercase">Pair</th>
            <th className="px-3 py-2.5 font-medium tracking-wide uppercase">Sisi</th>
            <th className="px-3 py-2.5 text-right font-medium tracking-wide uppercase">Entry</th>
            <th className="px-3 py-2.5 text-right font-medium tracking-wide uppercase">Sekarang / Exit</th>
            <th className="px-3 py-2.5 whitespace-nowrap font-medium tracking-wide uppercase">Aktivitas</th>
            <th className="px-3 py-2.5 text-right font-medium tracking-wide uppercase">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {cycles.map((cycle, index) => {
            const isOpen = cycle.status === 'open';
            const pnl = isOpen ? cycle.unrealizedPnlIdr : cycle.realizedPnlIdr;
            const entryNotional = cycle.entryPrice * cycle.size;
            const pnlPct = pnl != null && entryNotional !== 0 ? (pnl / entryNotional) * 100 : null;
            const exitOrCurrent = isOpen ? cycle.currentPrice : cycle.exitPrice;

            return (
              <tr key={`${cycle.instrument}-${cycle.openedAt}-${index}`} className="border-b border-border/60 last:border-0 hover:bg-surface-hover">
                <td className="px-3 py-2.5"><StatBadge tone={isOpen ? 'positive' : 'neutral'}>{isOpen ? 'TERBUKA' : 'SELESAI'}</StatBadge></td>
                <td className="px-3 py-2.5 font-semibold text-ink">{cycle.instrument}</td>
                <td className="px-3 py-2.5"><StatBadge tone={SIDE_TONE[cycle.side]}>{SIDE_LABEL[cycle.side]}</StatBadge></td>
                <td className="px-3 py-2.5 text-right text-ink">{fmtPrice(cycle.entryPrice)}</td>
                <td className="px-3 py-2.5 text-right text-ink">{exitOrCurrent != null ? fmtPrice(exitOrCurrent) : <span className="text-ink-faint">—</span>}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{fmtDate(cycle.closedAt ?? cycle.openedAt)}</td>
                <td className="px-3 py-2.5 text-right">
                  {pnl != null ? (
                    <span className={`font-semibold ${pnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {fmtSignedIdr(pnl)}
                      {pnlPct != null && <span className="ml-1 font-normal text-ink-faint">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</span>}
                    </span>
                  ) : <span className="text-ink-faint">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PendingTable({ orders }: { orders: PendingOrder[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[900px] border-collapse font-mono text-xs">
        <thead><tr className="border-b border-border bg-bg/60 text-left text-ink-muted">
          <th className="px-3 py-2.5 font-medium uppercase">Pair</th><th className="px-3 py-2.5 font-medium uppercase">Tipe</th><th className="px-3 py-2.5 text-right font-medium uppercase">Zona Entry</th><th className="px-3 py-2.5 text-right font-medium uppercase">Stop</th><th className="px-3 py-2.5 text-right font-medium uppercase">Target</th><th className="px-3 py-2.5 font-medium uppercase">Konfirmasi</th><th className="px-3 py-2.5 font-medium uppercase">Berakhir</th>
        </tr></thead>
        <tbody>{orders.map((order) => <tr key={order.id} className="border-b border-border/60 last:border-0 hover:bg-surface-hover">
          <td className="px-3 py-2.5 font-semibold text-ink">{order.pair}</td><td className="px-3 py-2.5"><StatBadge tone="warning">{order.type === 'limit' ? 'PULLBACK' : 'BREAKOUT'}</StatBadge></td><td className="px-3 py-2.5 text-right text-ink">{fmtPrice(order.entryLow)}–{fmtPrice(order.entryHigh)}</td><td className="px-3 py-2.5 text-right text-negative">{fmtPrice(order.stopPrice)}</td><td className="px-3 py-2.5 text-right text-positive">{fmtPrice(order.targetPrice)}</td><td className="max-w-64 px-3 py-2.5 text-ink-muted">{order.confirmations.join(' · ') || '—'}</td><td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{fmtDate(order.expiresAt)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

export function TradeJournal({ cycles, pendingOrders }: { cycles: PositionCycle[]; pendingOrders: PendingOrder[] }) {
  const [page, setPage] = useState(1);
  const openCycles = cycles.filter((cycle) => cycle.status === 'open').sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const closedCycles = cycles.filter((cycle) => cycle.status === 'closed').sort((a, b) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt));
  const totalPages = Math.max(1, Math.ceil(closedCycles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageCycles = closedCycles.slice(pageStart, pageStart + PAGE_SIZE);

  if (cycles.length === 0 && pendingOrders.length === 0) {
    return <div className="rounded-xl border border-border bg-surface p-6 text-center"><p className="font-sans text-sm text-ink-muted">Belum ada transaksi tercatat.</p></div>;
  }

  return (
    <div className="space-y-6">
      {pendingOrders.length > 0 && <section><div className="mb-2 flex items-baseline justify-between"><h3 className="font-sans text-sm font-medium text-ink">Order Pending</h3><span className="font-mono text-[10px] text-ink-faint">{pendingOrders.length} setup menunggu</span></div><PendingTable orders={pendingOrders} /></section>}
      {openCycles.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between"><h3 className="font-sans text-sm font-medium text-ink">Posisi Terbuka</h3><span className="font-mono text-[10px] text-ink-faint">{openCycles.length} posisi aktif</span></div>
          <PositionTable cycles={openCycles} />
        </section>
      )}

      {closedCycles.length > 0 && (
        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-sans text-sm font-medium text-ink">Riwayat Transaksi</h3><span className="font-mono text-[10px] text-ink-faint">Menampilkan {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, closedCycles.length)} dari {closedCycles.length} transaksi</span></div>
          <PositionTable cycles={pageCycles} />

          {totalPages > 1 && (
            <nav className="mt-3 flex items-center justify-end gap-1.5 font-mono text-[11px]" aria-label="Pagination riwayat transaksi">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} className="rounded border border-border px-2 py-1 text-ink-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40">← Sebelumnya</button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} aria-current={currentPage === pageNumber ? 'page' : undefined} className={`rounded border px-2 py-1 ${currentPage === pageNumber ? 'border-accent bg-accent/10 text-accent' : 'border-border text-ink-muted hover:border-accent hover:text-accent'}`}>{pageNumber}</button>
              ))}
              <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages} className="rounded border border-border px-2 py-1 text-ink-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40">Berikutnya →</button>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
