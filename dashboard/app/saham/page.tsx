import { getStockDashboard } from '@/lib/stock-data';
import Link from 'next/link';
import { StockScreener } from '@/components/StockScreener';
import { AiConsole } from '@/components/AiConsole';

export const dynamic = 'force-dynamic';

const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

const STOCK_AGENT_META: Record<
  string,
  {
    role: string;
    timeframe: string;
    pf: string;
    winRate: string;
    entrySummary: string;
    exitSummary: string;
  }
> = {
  swing: {
    role: '20-Day High Expansion + RVOL ≥ 1,2x',
    timeframe: 'Daily (Hold 3–15 Hari)',
    pf: '1,95',
    winRate: '49,2%',
    entrySummary: 'Close > High 20H + Close > SMA20 > SMA50 + RVOL ≥ 1,2x + Close Strength ≥ 0,65 + IHSG konstruktif',
    exitSummary: 'Eksekusi NEXT_OPEN · Stop min(Low 10H, Entry - 1,8 ATR) · Target +2,5R · BE saat +1,2R',
  },
  scalping: {
    role: 'Momentum Surge RVOL ≥ 1,8x + Likuiditas ≥ Rp15M',
    timeframe: 'Daily / 5m (Hold 1–5 Hari)',
    pf: '2,46',
    winRate: '56,3%',
    entrySummary: 'Nilai transaksi ≥ Rp15 Miliar + RVOL ≥ 1,8x + Return harian +2,5% s/d +9,0% + Close Strength ≥ 0,75',
    exitSummary: 'Stop ketat 1,2x ATR · Target cepat +2,0R · Breakeven otomatis saat +1,2R · Time-stop 5 hari',
  },
  'open-low': {
    role: 'Strict Opening Drive (Open ≈ Low ≤ 0,2%)',
    timeframe: 'Intraday / Daily (1–5 Hari)',
    pf: '1,26',
    winRate: '50,6%',
    entrySummary: 'Toleransi (Low ≥ Open × 0,998) + Return harian +2,0% s/d +8,0% + RVOL ≥ 1,5x + Close Strength ≥ 0,80 + Close > High 5H',
    exitSummary: 'Invalidasi ketat di bawah Low candle (min. 1,2x ATR) · Target +2,0R · Hindari chasing > +8%',
  },
  fundamental: {
    role: 'Quality Value (ROE ≥ 12%, PE ≤ 18x) + Breakout',
    timeframe: 'Daily / Mingguan (5–21 Hari)',
    pf: '2,93',
    winRate: '61,3%',
    entrySummary: 'ROE ≥ 12% + Net Margin ≥ 8% + PER ≤ 18x + DER ≤ 1,5x + Harga > SMA20 > SMA50 + Breakout High 10H',
    exitSummary: 'Stop struktural min(SMA20, Entry - 2,0 ATR) · Target +2,5R · Time-stop 21 hari bursa',
  },
  'breakout-retest': {
    role: '20-Day Box Retest & Support Bounce',
    timeframe: 'Daily (Hold 3–15 Hari)',
    pf: '4,42',
    winRate: '68,0%',
    entrySummary: 'Penembusan 20-Day High diikuti pullback sehat menyentuh area Neckline / EMA20 (-1,5% s/d +2,5%) + Bullish Reclaim ≥ 0,65',
    exitSummary: 'Stop loss ketat di bawah level retest (-1,5x ATR) · Target asimetris +2,8R · BE saat +1,2R',
  },
};

function tone(value: number | null | undefined): string {
  if ((value ?? 0) > 0) return 'text-positive';
  if ((value ?? 0) < 0) return 'text-negative';
  return 'text-ink-muted';
}

export default async function StockDeskPage() {
  const snapshot = await getStockDashboard();
  const totalEquity = snapshot.agents.reduce((sum, agent) => sum + Number(agent.equity || 0), 0);
  const startingEquity = snapshot.agents.reduce((sum, agent) => sum + Number(agent.starting_equity || 0), 0);
  const totalPnl = totalEquity - startingEquity;
  const totalPnlPct = startingEquity ? (totalPnl / startingEquity) * 100 : 0;
  const allStocks = [...snapshot.screener].sort((left, right) => (right.evaluation_score ?? -1) - (left.evaluation_score ?? -1));
  const actionableCount = allStocks.filter(
    (s) => s.evaluation_status === 'ACTIONABLE' || s.evaluation_status === 'WATCH' || (s.evaluation_score ?? 0) >= 65
  ).length;
  const intradayCount = allStocks.filter((s) => s.is_intraday).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> NusaQuant · IDX Delayed-Paper Desk (v3)
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-ink">Saham IDX Desk Overview</h1>
          <p className="mt-1 font-mono text-xs text-ink-faint">
            Snapshot {new Date(snapshot.generated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB · fase{' '}
            <span className="text-ink-muted font-medium">{snapshot.market_phase}</span> · ruleset{' '}
            <span className="text-emerald-400">2026-10-25.1</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/saham/reports"
            className="rounded-lg border border-border bg-surface px-3.5 py-2 font-mono text-xs text-ink hover:border-emerald-500/50 transition-colors"
          >
            📑 Daily Report
          </Link>
          <a
            href="#idx-playbook"
            className="rounded-lg border border-border bg-surface px-3.5 py-2 font-mono text-xs text-ink hover:border-emerald-500/50 transition-colors"
          >
            📋 Playbook v3
          </a>
          <a
            href="#screener"
            className="rounded-lg border border-border bg-surface px-3.5 py-2 font-mono text-xs text-ink hover:border-emerald-500/50 transition-colors"
          >
            🔍 Screener ({allStocks.length})
          </a>
          <a
            href="#gemini-console"
            className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3.5 py-2 font-mono text-xs text-blue-300 hover:border-blue-400/60 transition-colors"
          >
            ✨ Tanya Gemini
          </a>
        </div>
      </header>

      {/* Executive KPI Strip */}
      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ringkasan KPI Desk Saham">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Total Ekuitas (5 Agen IDX)</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-ink">{idr.format(totalEquity)}</p>
          <p className={`mt-1 font-mono text-xs font-medium ${tone(totalPnlPct)}`}>
            {totalPnlPct >= 0 ? '+' : ''}
            {number.format(totalPnlPct)}% ({totalPnl >= 0 ? '+' : ''}
            {idr.format(totalPnl)})
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Validasi Strategi v3</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-positive">5 / 5 Validated</p>
          <p className="mt-1 font-mono text-xs text-ink-muted">Backtest PF 1,26 – 4,42 (Net Fee IDX)</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Cakupan Emiten BEI</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-ink">{allStocks.length} Saham</p>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {intradayCount} pantauan intraday · {actionableCount} skor tinggi
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Posisi Aktif &amp; Kuota Data</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-emerald-300">{snapshot.positions.length} Posisi</p>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            Arjum API: {snapshot.provider_usage.requests_used}/{snapshot.provider_usage.request_limit} req hari ini
          </p>
        </div>
      </section>

      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-sans text-base sm:text-lg font-semibold text-ink">Armada Agen Saham IDX (5 Buku Independen)</h2>
          <p className="font-mono text-[11px] text-ink-faint">Modal awal Rp100.000.000 per agen · Lot 100 lembar · Fee beli 0,15% &amp; jual 0,25%.</p>
        </div>
      </div>

      <section id="agents" className="mb-8 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5" aria-label="Equity setiap agen saham">
        {snapshot.agents.map((agent) => {
          const meta = STOCK_AGENT_META[agent.id];
          return (
            <Link
              href={`/saham/agents/${agent.id}`}
              key={agent.id}
              className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-black/20"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-300 border border-emerald-500/30">
                    PF {meta?.pf ?? '1,5+'}
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint">
                    WR {agent.display_win_rate == null ? `BT ${meta?.winRate ?? '—'}` : `${number.format(agent.display_win_rate)}%`}
                  </span>
                </div>
                <h3 className="mt-2.5 font-sans text-base font-semibold text-ink group-hover:text-emerald-300 transition-colors">
                  {agent.name}
                </h3>
                {meta && <p className="mt-1 font-sans text-[11px] leading-snug text-ink-muted line-clamp-2">{meta.role}</p>}
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Ekuitas Buku</p>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <p className="font-mono text-sm font-semibold text-ink">{idr.format(agent.equity)}</p>
                  <span className={`font-mono text-xs font-semibold ${tone(agent.pnl_pct)}`}>
                    {agent.pnl_pct >= 0 ? '+' : ''}
                    {number.format(agent.pnl_pct)}%
                  </span>
                </div>
                <p className="mt-2 font-mono text-[10px] text-ink-faint group-hover:text-emerald-300 transition-colors">
                  Buka desk agen →
                </p>
              </div>
            </Link>
          );
        })}
      </section>

      {/* Playbook Strategi Saham IDX v3 */}
      <section
        id="idx-playbook"
        className="mb-8 scroll-mt-20 rounded-xl border border-border bg-surface p-4 sm:p-5"
        aria-labelledby="idx-playbook-heading"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-emerald-400">Validated Trading Plan · Ruleset 2026-10-25.1</p>
            <h2 id="idx-playbook-heading" className="font-sans text-base sm:text-lg font-semibold text-ink">
              Matriks Setup &amp; Hasil Backtest 5 Agen Saham IDX
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
              Diuji pada saham likuid BEI dengan biaya broker + pajak jual (0,40% round-trip), eksekusi NEXT_OPEN, dan breakeven stop saat +1,2R.
            </p>
          </div>
          <span className="rounded-full border border-positive/30 bg-positive-bg px-2.5 py-1 font-mono text-[10px] font-medium text-positive">
            Semua Agen PF &gt; 1,25
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left font-mono text-xs">
            <thead className="border-b border-border text-[10px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="py-2 pr-3">Agen Saham</th>
                <th className="px-3">Horizon</th>
                <th className="px-3">Kriteria Setup &amp; Trigger</th>
                <th className="px-3">Aturan Stop, Target &amp; Eksekusi</th>
                <th className="px-3 text-right">Win Rate</th>
                <th className="py-2 pl-3 text-right">Profit Factor</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.agents.map((agent) => {
                const meta = STOCK_AGENT_META[agent.id];
                if (!meta) return null;
                return (
                  <tr key={agent.id} className="border-b border-border/60 text-ink-muted last:border-0 hover:bg-surface-hover">
                    <td className="py-3 pr-3 align-top">
                      <Link href={`/saham/agents/${agent.id}`} className="font-semibold text-ink hover:text-emerald-300">
                        {agent.name}
                      </Link>
                      <span className="block text-[10px] text-ink-faint">{meta.role}</span>
                    </td>
                    <td className="px-3 py-3 align-top whitespace-nowrap text-ink">{meta.timeframe}</td>
                    <td className="px-3 py-3 align-top font-sans text-xs leading-relaxed text-ink-muted max-w-xs">{meta.entrySummary}</td>
                    <td className="px-3 py-3 align-top font-sans text-xs leading-relaxed text-ink-muted max-w-xs">{meta.exitSummary}</td>
                    <td className="px-3 py-3 align-top text-right text-ink">{meta.winRate}</td>
                    <td className="py-3 pl-3 align-top text-right font-semibold text-positive">{meta.pf}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">Open Positions</h2>
            <p className="font-mono text-[11px] text-ink-faint">Nilai posisi dan P/L berjalan per agen dari ledger paper trading IDX.</p>
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
                <tr key={position.id} className="border-b border-border/60 text-ink-muted last:border-0 hover:bg-surface-hover">
                  <td className="py-3"><Link className="text-ink hover:underline" href={`/saham/agents/${position.agent_id}`}>{position.agent_name}</Link></td><td><Link className="font-semibold text-accent hover:underline" href={`/saham/stocks/${position.symbol}`}>{position.symbol}</Link></td><td>{number.format(position.lots)}</td><td>{idr.format(position.entry_price)}</td><td>{idr.format(position.last_price)}</td><td>{idr.format(position.market_value)}</td><td className={tone(position.pnl_pct)}>{position.pnl_pct >= 0 ? '+' : ''}{number.format(position.pnl_pct)}% · {idr.format(position.unrealized_pnl)}</td>
                </tr>
              ))}
              {snapshot.positions.length === 0 ? <tr><td colSpan={7} className="py-8 text-center font-sans text-sm text-ink-faint">Belum ada posisi saham terbuka pada siklus ini.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section id="gemini-console" className="mb-8 scroll-mt-24" aria-label="Gemini console untuk desk saham">
        <AiConsole scope="stock" />
      </section>

      <StockScreener rows={allStocks} />
    </main>
  );
}
