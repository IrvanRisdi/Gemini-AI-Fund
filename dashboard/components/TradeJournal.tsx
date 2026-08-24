import type { PositionCycle } from '@/lib/desk-data';
import { StatBadge, type BadgeTone } from './StatBadge';

function fmtIdr(value: number): string {
  return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}

function fmtSignedIdr(value: number): string {
  return `${value >= 0 ? '+' : '-'}${fmtIdr(Math.abs(value))}`;
}

function fmtPrice(value: number): string {
  // Sub-Rp1 assets (e.g. PEPE/SHIB) need decimal precision — rounding to whole rupiah would show Rp0.
  if (Math.abs(value) >= 1) return fmtIdr(value);
  return `Rp${value.toLocaleString('id-ID', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`;
}

function fmtQty(value: number): string {
  const decimals = Math.abs(value) < 1 ? 6 : Math.abs(value) < 1000 ? 4 : 2;
  return value.toLocaleString('id-ID', { maximumFractionDigits: decimals });
}

function fmtDate(iso: string): string {
  // Compact on purpose (no year) so the journal fits without horizontal scroll — trade history
  // on this desk spans at most a few months, so day+month+time is unambiguous enough.
  const datePart = new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', timeZone: 'Asia/Jakarta' });
  const timePart = new Date(iso).toLocaleString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  });
  return `${datePart} ${timePart}`;
}

const SIDE_LABEL: Record<PositionCycle['side'], string> = { long: 'LONG', short: 'SHORT' };
const SIDE_TONE: Record<PositionCycle['side'], BadgeTone> = { long: 'accent', short: 'warning' };

export function TradeJournal({ cycles }: { cycles: PositionCycle[] }) {
  if (cycles.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <p className="font-sans text-sm text-ink-muted">Belum ada transaksi tercatat.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[720px] table-auto border-collapse font-mono text-xs">
        <thead>
          <tr className="border-b border-border bg-bg/60 text-left text-ink-muted">
            <th className="px-3 py-2.5 font-medium tracking-wide uppercase">Status</th>
            <th className="px-3 py-2.5 font-medium tracking-wide uppercase">Pair</th>
            <th className="px-3 py-2.5 font-medium tracking-wide uppercase">Sisi</th>
            <th className="px-3 py-2.5 text-right font-medium tracking-wide uppercase">Entry</th>
            <th className="px-3 py-2.5 text-right font-medium tracking-wide uppercase">Exit/Now</th>
            <th className="px-3 py-2.5 text-right font-medium tracking-wide uppercase">Qty</th>
            <th className="px-3 py-2.5 whitespace-nowrap font-medium tracking-wide uppercase">Dibuka</th>
            <th className="px-3 py-2.5 whitespace-nowrap font-medium tracking-wide uppercase">Ditutup</th>
            <th className="px-3 py-2.5 text-right font-medium tracking-wide uppercase">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {cycles.map((c, i) => {
            const isOpen = c.status === 'open';
            const pnl = isOpen ? c.unrealizedPnlIdr : c.realizedPnlIdr;
            const entryNotional = c.entryPrice * c.size;
            const pnlPct = pnl != null && entryNotional !== 0 ? (pnl / entryNotional) * 100 : null;
            const exitOrCurrent = isOpen ? c.currentPrice : c.exitPrice;

            return (
              <tr
                key={`${c.instrument}-${c.openedAt}-${i}`}
                className="border-b border-border/60 last:border-0 hover:bg-surface-hover"
              >
                <td className="px-3 py-2.5">
                  <StatBadge tone={isOpen ? 'positive' : 'neutral'}>{isOpen ? 'TERBUKA' : 'CLOSED'}</StatBadge>
                </td>
                <td className="px-3 py-2.5 font-semibold text-ink">{c.instrument}</td>
                <td className="px-3 py-2.5">
                  <StatBadge tone={SIDE_TONE[c.side]}>{SIDE_LABEL[c.side]}</StatBadge>
                </td>
                <td className="px-3 py-2.5 text-right text-ink">{fmtPrice(c.entryPrice)}</td>
                <td className="px-3 py-2.5 text-right text-ink">
                  {exitOrCurrent != null ? fmtPrice(exitOrCurrent) : <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-ink-muted">{fmtQty(c.size)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{fmtDate(c.openedAt)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {c.closedAt ? <span className="text-ink-muted">{fmtDate(c.closedAt)}</span> : <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {pnl != null ? (
                    <span className={`font-semibold ${pnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {fmtSignedIdr(pnl)}
                      {pnlPct != null && (
                        <span className="ml-1 font-normal text-ink-faint">
                          ({pnlPct >= 0 ? '+' : ''}
                          {pnlPct.toFixed(2)}%)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
