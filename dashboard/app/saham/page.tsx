import { getStockDashboard } from '@/lib/stock-data';

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
  const watchlist = snapshot.screener
    .filter((row) => row.is_intraday)
    .sort((left, right) => (left.intraday_rank ?? 999) - (right.intraday_rank ?? 999));

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

      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Equity setiap agen saham">
        {snapshot.agents.map((agent) => (
          <article key={agent.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">{agent.name}</p>
            <p className="mt-2 font-mono text-sm font-semibold text-ink">{idr.format(agent.equity)}</p>
            <div className="mt-1 flex items-center justify-between font-mono text-[11px]">
              <span className={tone(agent.pnl_pct)}>{agent.pnl_pct >= 0 ? '+' : ''}{number.format(agent.pnl_pct)}%</span>
              <span className="text-ink-muted">WR {agent.display_win_rate == null ? '—' : `${number.format(agent.display_win_rate)}%`}</span>
            </div>
          </article>
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
                  <td className="py-3 text-ink">{position.agent_name}</td><td className="font-semibold text-accent">{position.symbol}</td><td>{number.format(position.lots)}</td><td>{idr.format(position.entry_price)}</td><td>{idr.format(position.last_price)}</td><td>{idr.format(position.market_value)}</td><td className={tone(position.pnl_pct)}>{position.pnl_pct >= 0 ? '+' : ''}{number.format(position.pnl_pct)}% · {idr.format(position.unrealized_pnl)}</td>
                </tr>
              ))}
              {snapshot.positions.length === 0 ? <tr><td colSpan={7} className="py-8 text-center text-ink-faint">Belum ada posisi terbuka.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">Intraday Universe</h2>
            <p className="font-mono text-[11px] text-ink-faint">50 ticker yang dipindai Yahoo 5-menit oleh GitHub Actions.</p>
          </div>
          <p className="font-mono text-[10px] text-ink-faint">Run: {snapshot.latest_run?.status ?? 'NOT_READY'} · OK {snapshot.latest_run?.symbols_ok ?? 0} · gagal {snapshot.latest_run?.symbols_failed ?? 0}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left font-mono text-xs">
            <thead className="border-b border-border text-[10px] uppercase tracking-wide text-ink-faint">
              <tr><th className="py-2">Rank</th><th>Ticker</th><th>Perusahaan</th><th>Harga</th><th>Change</th><th>Score</th><th>Status</th></tr>
            </thead>
            <tbody>
              {watchlist.map((row) => (
                <tr key={row.symbol} className="border-b border-border/60 text-ink-muted last:border-0">
                  <td className="py-3">{row.intraday_rank}</td><td className="font-semibold text-accent">{row.symbol}</td><td className="max-w-xs truncate text-ink">{row.name}</td><td>{row.last_price == null ? '—' : idr.format(row.last_price)}</td><td className={tone(row.change_pct)}>{row.change_pct == null ? '—' : `${row.change_pct >= 0 ? '+' : ''}${number.format(row.change_pct)}%`}</td><td>{row.evaluation_score ?? '—'}</td><td>{row.evaluation_status ?? 'INCOMPLETE'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
