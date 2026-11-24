import {
  getFuturesDashboard,
  getFuturesLessons,
  getFuturesWeeklyReport,
  getUpcomingMacroEvents,
} from '@/lib/futures-data';
import { AiConsole } from '@/components/AiConsole';
import { formatWibDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

function fmtUsd(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPrice(value: number): string {
  const maxFrac = value >= 1000 ? 2 : value >= 1 ? 4 : 6;
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: maxFrac })}`;
}

function tone(value: number): string {
  if (value > 0) return 'text-positive';
  if (value < 0) return 'text-negative';
  return 'text-ink-muted';
}

const AGENT_META: Record<
  string,
  { title: string; badge: string; timeframe: string; desc: string; backtest: string }
> = {
  'wyckoff-4h': {
    title: 'Wyckoff-4H (Core)',
    badge: '70% Modal · All-Weather',
    timeframe: '4H · Long & Short',
    desc: 'Breakout/Breakdown konsolidasi padat 45 bar 4H + limit retest. SL adaptif Struktur/1,5×ATR, Partial TP1 50% @ +1,2R, runner Chandelier 3,0×ATR.',
    backtest: 'Uji 3 Thn: PF 1,47 · WR 56,0% · DD 13,9%',
  },
  'smc-1h-bear': {
    title: 'SMC-1H-Bear (Booster)',
    badge: '30% Modal · Bear Specialist',
    timeframe: '1H (Bias 4H) · Aktif saat BTC < EMA200',
    desc: 'Sapuan likuiditas 24 jam + reclaim kuat pada rezim bear makro. SL adaptif 1,2%–6,0%, Partial TP1 50% @ +1,2R + Chandelier 3,0×ATR.',
    backtest: 'Uji 3 Thn (Bear): PF 1,22 · WR 53,2%',
  },
};

export default async function FuturesDeskPage() {
  const [summary, weekly, lessons, macroEvents] = await Promise.all([
    getFuturesDashboard(),
    getFuturesWeeklyReport(),
    getFuturesLessons(),
    getUpcomingMacroEvents(4),
  ]);

  const nearestMacro = macroEvents[0] ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              ⚡ Kripto Futures Engine v1 · Isolated 1x–3x
            </span>
            <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 font-mono text-[10px] text-ink-muted">
              Entry Gate: Gemini 4 Neon · Weekly Audit: Gemini 4 Carbon
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Futures Desk (Long &amp; Short)
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Terpisah sepenuhnya dari Kripto Spot IDR. Menggunakan replay candle 5m, validasi minNotional/stepSize otomatis, dan Shadow A/B calibration.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-right font-mono text-[11px] text-ink-muted">
          <div>Siklus Terakhir (WIB)</div>
          <div className="font-semibold text-ink">
            {summary.generatedAt ? formatWibDateTime(summary.generatedAt) : 'Menunggu Workflow Pertama'}
          </div>
          <div className="text-[10px] text-ink-faint">Branch: futures-data</div>
        </div>
      </header>

      {summary.isInitialPlaceholder ? (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs sm:text-sm text-amber-200">
          <strong>Status Awal:</strong> Workflow <code>Futures Engine 24/7 Paper Loop</code> belum menghasilkan snapshot di branch <code>futures-data</code>. Jalankan manual sekali di tab <strong>GitHub Actions</strong> (atau tunggu jadwal cron menit :02 / :32) untuk mengisi data live paper trading.
        </div>
      ) : null}

      {/* Top KPI Cards */}
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            Total Ekuitas Futures (Paper)
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-ink">
            {fmtUsd(summary.totalEquityUsd)}
          </div>
          <div className={`mt-1 font-mono text-xs font-semibold ${tone(summary.totalPnlPct)}`}>
            {summary.totalPnlPct >= 0 ? '+' : ''}
            {summary.totalPnlPct.toFixed(2)}% dari {fmtUsd(summary.startingCapitalUsd)}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            Kompas Rezim BTC (4H EMA200)
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-ink">
            {summary.btcRegime ? fmtPrice(summary.btcRegime.close) : '—'}
          </div>
          <div className="mt-1 font-mono text-xs text-ink-muted">
            {summary.btcRegime ? (
              <span className={summary.btcRegime.macroBull ? 'text-positive' : 'text-amber-300'}>
                {summary.btcRegime.macroBull
                  ? 'BULL MACRO (Wyckoff Core)'
                  : 'BEAR MACRO (Core + SMC-1H Aktif)'}
              </span>
            ) : (
              'Menunggu data siklus pertama'
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            Eksposur &amp; Universe Dinamis
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-ink">
            {summary.openPositions.length} Posisi · {summary.pendingOrders.length} Pending
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink-muted truncate">
            {summary.universe.length} pair (Vol ≥ $150M · ATR 1,5–4,5%)
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            Kalender Makro AS (Guard 2026–2027)
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-ink">
            {nearestMacro ? `${nearestMacro.type} · ${nearestMacro.hoursUntil} jam lagi` : 'Aman'}
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink-muted truncate">
            {nearestMacro ? nearestMacro.title : 'Tidak ada rilis FOMC/CPI/NFP dekat'}
          </div>
        </div>
      </section>

      {/* 2 Agents Section + Shadow A/B */}
      <section id="agents" className="mb-8 scroll-mt-24">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">2 Agen Futures &amp; Kalibrasi Shadow A/B</h2>
          <span className="font-mono text-[11px] text-ink-faint">
            Hard Cap 3x · Max 3 Searah · Kill-Switch -2% Harian / -8% MaxDD
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {summary.agents.map((ag) => {
            const meta = AGENT_META[ag.agent];
            const deltaUsd =
              ag.shadowAbComparison.geminiAdjustedNetPnlUsd -
              ag.shadowAbComparison.quantOnlyNetPnlUsd;
            return (
              <div key={ag.agent} className="rounded-xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-ink">{meta?.title ?? ag.agent}</h3>
                    <p className="font-mono text-[11px] text-amber-300">{meta?.badge}</p>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-lg font-bold text-ink">{fmtUsd(ag.equityUsd)}</div>
                    <div className={`text-xs font-semibold ${tone(ag.pnlPct)}`}>
                      {ag.pnlPct >= 0 ? '+' : ''}
                      {ag.pnlPct.toFixed(2)}%
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{meta?.desc}</p>
                <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg border border-border/70 bg-bg/50 p-2.5 text-center font-mono text-xs">
                  <div>
                    <div className="text-[10px] text-ink-faint">Trades</div>
                    <div className="font-semibold text-ink">{ag.closedTrades}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-ink-faint">Win Rate</div>
                    <div className="font-semibold text-ink">{ag.winRatePct}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-ink-faint">PF</div>
                    <div className="font-semibold text-ink">{ag.profitFactor}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-ink-faint">Max DD</div>
                    <div className="font-semibold text-ink">{ag.maxDrawdownPct}%</div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-border/60 bg-bg/30 p-3 font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">Shadow A/B (Gemini vs Quant):</span>
                    <span className={tone(deltaUsd)}>
                      {deltaUsd >= 0 ? '+' : ''}
                      {fmtUsd(deltaUsd)}
                    </span>
                  </div>
                  <div className="mt-1 text-ink-muted">
                    {ag.shadowAbComparison.vetoCalibration.summary}
                  </div>
                </div>
                {ag.killSwitchActive ? (
                  <div className="mt-2 rounded bg-red-500/15 px-2.5 py-1.5 font-mono text-[11px] text-red-300">
                    🛑 {ag.killSwitchReason}
                  </div>
                ) : null}
                <div className="mt-2 font-mono text-[10px] text-ink-faint">
                  {meta?.timeframe} · {meta?.backtest}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Open Positions & Pending Orders */}
      <section id="positions" className="mb-8 scroll-mt-24 space-y-6">
        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Posisi Terbuka (Long &amp; Short)</h2>
            <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] text-ink-muted">
              {summary.openPositions.length} posisi
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left font-mono text-xs">
              <thead className="border-b border-border text-[10px] uppercase text-ink-faint">
                <tr>
                  <th className="py-2">Agen</th>
                  <th>Pair</th>
                  <th>Arah</th>
                  <th>Lev</th>
                  <th>Entry</th>
                  <th>Stop / Trail</th>
                  <th>TP1</th>
                  <th>MFE / MAE</th>
                  <th>Mode Exit</th>
                </tr>
              </thead>
              <tbody>
                {summary.openPositions.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 text-ink-muted last:border-0">
                    <td className="py-2.5 text-ink">{p.agent}</td>
                    <td className="font-semibold text-ink">{p.symbol}</td>
                    <td>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          p.side === 'long'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {p.side}
                      </span>
                    </td>
                    <td>{p.leverage}x</td>
                    <td>{fmtPrice(p.entryPrice)}</td>
                    <td>{fmtPrice(p.stopPrice)}</td>
                    <td>
                      {fmtPrice(p.tp1Price)} {p.tp1Hit ? '✓' : ''}
                    </td>
                    <td>
                      +{p.mfeR}R / -{p.maeR}R
                    </td>
                    <td className="text-[11px]">
                      {p.partialTpEnabled ? '50% TP1 + Trail' : '100% TP1 (minNotional)'}
                    </td>
                  </tr>
                ))}
                {summary.openPositions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6 text-center font-sans text-sm text-ink-faint">
                      Belum ada posisi futures terbuka pada siklus ini.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Pending Limit Orders (Dievaluasi Gemini 4 Neon)</h2>
            <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] text-ink-muted">
              {summary.pendingOrders.length} pending
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left font-mono text-xs">
              <thead className="border-b border-border text-[10px] uppercase text-ink-faint">
                <tr>
                  <th className="py-2">Agen</th>
                  <th>Pair</th>
                  <th>Arah</th>
                  <th>Zona Entry</th>
                  <th>Stop</th>
                  <th>Conv / Lev</th>
                  <th>Keputusan Gemini 4 Neon</th>
                </tr>
              </thead>
              <tbody>
                {summary.pendingOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border/50 text-ink-muted last:border-0">
                    <td className="py-2.5 text-ink">{o.agent}</td>
                    <td className="font-semibold text-ink">{o.symbol}</td>
                    <td className="uppercase">{o.side}</td>
                    <td>
                      {fmtPrice(o.entryLow)} – {fmtPrice(o.entryHigh)}
                    </td>
                    <td>{fmtPrice(o.stopPrice)}</td>
                    <td>
                      {o.convictionScore}/5 · {o.finalLeverage}x
                    </td>
                    <td className="max-w-xs font-sans text-xs">
                      <span className="font-mono font-semibold text-amber-300">
                        {o.geminiEvaluation.action}
                      </span>{' '}
                      ({o.geminiEvaluation.modelUsed}): {o.geminiEvaluation.reasoning}
                    </td>
                  </tr>
                ))}
                {summary.pendingOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center font-sans text-sm text-ink-faint">
                      Belum ada pending limit order aktif.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Weekly Forensic Report & 3-Layer Distilled Memory */}
      <section id="weekly" className="mb-8 scroll-mt-24 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">Weekly Forensic Report</h2>
            <span className="rounded bg-indigo-500/15 px-2 py-0.5 font-mono text-[10px] text-indigo-300">
              {weekly?.modelUsed ?? 'gemini-4-carbon'}
            </span>
          </div>
          {weekly ? (
            <div className="space-y-3 text-xs sm:text-sm text-ink-muted">
              <div className="font-mono text-[11px] text-ink-faint">
                Tanggal: {weekly.dateWib} WIB · Telegram:{' '}
                {weekly.telegramDelivery?.delivered ? '✅ Terkirim' : weekly.telegramDelivery?.diagnostic ?? '—'}
              </div>
              <p className="font-semibold text-ink">{weekly.headline}</p>
              <ul className="list-disc space-y-1 pl-5">
                {weekly.keyFindings.map((f, idx) => (
                  <li key={idx}>{f}</li>
                ))}
              </ul>
              <div className="rounded-lg border border-border/60 bg-bg/40 p-3 text-xs">
                <strong className="text-ink">Evaluasi Veto:</strong> {weekly.vetoAssessment}
              </div>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-ink-faint">
              Laporan mingguan otomatis dibuat setiap hari Minggu pukul 21:00 WIB oleh <strong>Gemini 4 Carbon</strong> dan langsung dikirim ke Telegram.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">3-Layer Memory (lessons.json)</h2>
            <span className="font-mono text-[10px] text-ink-faint">
              {lessons.length} aturan aktif
            </span>
          </div>
          <div className="space-y-2.5">
            {lessons.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/60 bg-bg/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-amber-300">{item.confidence}</span>
                  <span className="font-mono text-[10px] text-ink-faint">{item.id}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-ink">{item.lesson}</p>
                <p className="mt-1 text-[11px] text-ink-muted">{item.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Closed Trades */}
      <section className="mb-8 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Riwayat Trade Tertutup (MFE / MAE &amp; A/B)</h2>
          <span className="font-mono text-[10px] text-ink-faint">
            30 transaksi terbaru
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left font-mono text-xs">
            <thead className="border-b border-border text-[10px] uppercase text-ink-faint">
              <tr>
                <th className="py-2">Agen</th>
                <th>Pair</th>
                <th>Arah</th>
                <th>Durasi</th>
                <th>PnL (R)</th>
                <th>MFE / MAE</th>
                <th>Gemini</th>
                <th>Alasan Tutup</th>
              </tr>
            </thead>
            <tbody>
              {summary.recentTrades.map((t) => (
                <tr key={t.id} className="border-b border-border/50 text-ink-muted last:border-0">
                  <td className="py-2.5 text-ink">{t.agent}</td>
                  <td className="font-semibold text-ink">{t.symbol}</td>
                  <td className="uppercase">{t.side}</td>
                  <td>{t.holdHours}j</td>
                  <td className={`font-semibold ${tone(t.pnlUsd)}`}>
                    {fmtUsd(t.pnlUsd)} ({t.rMultiple >= 0 ? '+' : ''}
                    {t.rMultiple}R)
                  </td>
                  <td>
                    +{t.mfeR}R / -{t.maeR}R
                  </td>
                  <td>{t.geminiAction}</td>
                  <td className="font-sans text-xs">{t.closeReason}</td>
                </tr>
              ))}
              {summary.recentTrades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center font-sans text-sm text-ink-faint">
                    Belum ada transaksi tertutup. Riwayat trade, MFE/MAE, dan Shadow A/B akan muncul di sini setelah siklus berjalan.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gemini Console for Futures */}
      <section id="gemini-console" className="mb-8 scroll-mt-24" aria-label="Gemini console untuk desk futures">
        <AiConsole scope="futures" />
      </section>
    </main>
  );
}
