import { getStockDashboard } from '@/lib/stock-data';
import Link from 'next/link';
import { StockScreener } from '@/components/StockScreener';

export const dynamic = 'force-dynamic';

const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

function tone(value: number | null | undefined): string {
  if ((value ?? 0) > 0) return 'text-positive';
  if ((value ?? 0) < 0) return 'text-negative';
  return 'text-ink-muted';
}

export default async function StockDeskPage() {
  const snapshot = await getStockDashboard();
  const totalEquity = snapshot.agents.reduce((sum, agent) => sum + Number(agent.equity || 0), 0);
  const startingEquity = snapshot.agents.reduce((sum, agent) => sum + Number(agent.starting_equity || 0), 0);
  const totalPnlPct = startingEquity ? ((totalEquity - startingEquity) / startingEquity) * 100 : 0;
  const allStocks = [...snapshot.screener].sort((left, right) => (right.evaluation_score ?? -1) - (left.evaluation_score ?? -1));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> NusaQuant · IDX delayed-paper
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">Stock Desk</h1>
          <p className="mt-1 font-mono text-xs text-ink-faint">
            Snapshot {new Date(snapshot.generated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} · fase {snapshot.market_phase}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-5 py-3 sm:text-right">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">Total equity 5 agen</p>
          <p className="font-mono text-2xl font-semibold text-ink">{idr.format(totalEquity)}</p>
          <p className={`font-mono text-xs ${tone(totalPnlPct)}`}>{totalPnlPct >= 0 ? '+' : ''}{number.format(totalPnlPct)}%</p>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-2"><Link href="/saham/reports" className="rounded-lg border border-border bg-surface px-4 py-2 font-mono text-xs text-ink hover:border-emerald-500/50">Buka Daily Report</Link><a href="#screener" className="rounded-lg border border-border bg-surface px-4 py-2 font-mono text-xs text-ink hover:border-emerald-500/50">Cari saham</a><span className="rounded-lg border border-border px-4 py-2 font-mono text-xs text-ink-muted">Arjum {snapshot.provider_usage.requests_used}/{snapshot.provider_usage.request_limit} request hari ini</span></div>

      <section id="agents" className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Equity setiap agen saham">
        {snapshot.agents.map((agent) => (
          <Link href={`/saham/agents/${agent.id}`} key={agent.id} className="rounded-xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-emerald-500/50">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">{agent.name}</p>
            <p className="mt-2 font-mono text-sm font-semibold text-ink">{idr.format(agent.equity)}</p>
            <div className="mt-1 flex items-center justify-between font-mono text-[11px]">
              <span className={tone(agent.pnl_pct)}>{agent.pnl_pct >= 0 ? '+' : ''}{number.format(agent.pnl_pct)}%</span>
              <span className="text-ink-muted">WR {agent.display_win_rate == null ? '—' : `${number.format(agent.display_win_rate)}%`}</span>
            </div>
            <p className="mt-3 font-mono text-[10px] text-accent">Buka desk agen →</p>
          </Link>
        ))}
      </section>

      <section className="mb-8 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">Open Positions</h2>
            <p className="font-mono text-[11px] text-ink-faint">Nilai posisi dan P/L per agen dari ledger paper trading.</p>
          </div>
          <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-ink-muted">{snapshot.positions.length} posisi</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left font-mono text-xs">
            <thead className="border-b border-border text-[10px] uppercase tracking-wide text-ink-faint">
              <tr><th className="py-2">Agen</th><th>Ticker</th><th>Lot</th><th>Entry</th><th>Last</th><th>Nilai posisi</th><th>Result</th></tr>
            </thead>
            <tbody>
              {snapshot.positions.map((position) => (
                <tr key={position.id} className="border-b border-border/60 text-ink-muted last:border-0">
                  <td className="py-3"><Link className="text-ink hover:underline" href={`/saham/agents/${position.agent_id}`}>{position.agent_name}</Link></td><td><Link className="font-semibold text-accent hover:underline" href={`/saham/stocks/${position.symbol}`}>{position.symbol}</Link></td><td>{number.format(position.lots)}</td><td>{idr.format(position.entry_price)}</td><td>{idr.format(position.last_price)}</td><td>{idr.format(position.market_value)}</td><td className={tone(position.pnl_pct)}>{position.pnl_pct >= 0 ? '+' : ''}{number.format(position.pnl_pct)}% · {idr.format(position.unrealized_pnl)}</td>
                </tr>
              ))}
              {snapshot.positions.length === 0 ? <tr><td colSpan={7} className="py-8 text-center text-ink-faint">Belum ada posisi terbuka.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <StockScreener rows={allStocks} />
    </main>
  );
}
