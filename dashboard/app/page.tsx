import Link from 'next/link';
import { DataCard, type DataCardBadge } from '@/components/DataCard';
import { AiConsole } from '@/components/AiConsole';
import { LiveTicker } from '@/components/LiveTicker';
import { CoinEquityHistory } from '@/components/CoinEquityHistory';
import { StatBadge } from '@/components/StatBadge';
import {
  getDeskSnapshot,
  getCoinEquityHistory,
  listBriefingSlugs,
  withCurrentEquityPoint,
  type AgentSummary,
} from '@/lib/desk-data';
import type { BadgeTone } from '@/components/StatBadge';
import { formatWibDateTime, formatWibTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

/**
 * Paper Trading Risk Configuration
 *
 * Keep these values synchronized with the
 * automated paper execution engine.
 */
const RISK_POLICY = [
  { label: 'Mode & Modal', value: 'Spot-only · Rp300 jt', detail: 'Enam buku paper trading aktif, masing-masing modal awal Rp50 juta. Tidak ada short atau leverage.' },
  { label: 'Risiko per Campaign', value: '1–3% Equity Adaptif', detail: 'Normal 3%; turun menjadi 2% pada drawdown 5% dan 1% pada drawdown 10%. Stop harga tetap struktural 3–5%.' },
  { label: 'Batas Notional', value: 'Min. Rp500 rb · Maks. 100% Equity', detail: 'Order atau fill di bawah Rp500.000 ditolak; nilai satu campaign tidak boleh melebihi batas alokasi strategi.' },
  { label: 'Stop & Target', value: 'Struktural · min. 1,75–3,0R', detail: 'Stop mengikuti invalidasi struktur/ATR (3–5%). Target bersih setelah fee 1,75R hingga 3,0R sesuai karakter strategi.' },
  { label: 'Biaya & Proteksi', value: 'Fee 0,30% per sisi', detail: 'Breakeven stop dinaikkan ke level net-positif (menutup biaya beli + jual) setelah harga mencapai +1,25R.' },
  { label: 'Pending Order', value: 'Limit / Buy-stop · 3–32 jam', detail: 'Order otomatis kedaluwarsa; sinyal menggunakan multi-timeframe 15m, 1H, 4H, dan Daily.' },
  { label: 'Konsentrasi Pair', value: '1 campaign / pair / agen', detail: 'Posisi atau pending order pada pair yang sama mengunci campaign baru dari agen tersebut.' },
  { label: 'Alokasi Breakout', value: '30% Tunggal · Tanpa Pyramid', detail: 'Inverted pyramiding dihapus agar harga rata-rata entry tidak pernah melampaui stop loss protektif.' },
  { label: 'Status Strategi', value: '6 validated agents (PF > 1)', detail: 'Seluruh 6 strategi kripto telah divalidasi melalui backtest multi-periode dengan Profit Factor > 1,21–2,42.' },
] as const;

const CRYPTO_AGENT_META: Record<
  string,
  {
    title: string;
    role: string;
    pf: string;
    winRate: string;
    timeframe: string;
    entryRule: string;
    exitRule: string;
  }
> = {
  'breakout-specialist': {
    title: 'Breakout Specialist',
    role: '4H RS Breakout · Trend Continuation',
    pf: '1,94',
    winRate: '51,9%',
    timeframe: '4H + Daily Macro',
    entryRule: 'Close > 20-bar High 4H + EMA20 > EMA50 + Volume ≥ 1,3x + Close Strength ≥ 0,68 + RS ≥ BTC',
    exitRule: 'Stop 3,5–5,0% struktural · Target net +2,5R · Alokasi tunggal 30% (tanpa inverted pyramid)',
  },
  'aggressive-breakout-trader': {
    title: 'Aggressive Momentum',
    role: '15m / 1H High-Velocity Impulse',
    pf: '1,46',
    winRate: '44,8%',
    timeframe: '15m Trigger + 1H/4H',
    entryRule: 'Breakout 20-bar High + RVOL ≥ 3,5x + Close Strength ≥ 0,75 + Outperform BTC ≥ +2,0% (24H)',
    exitRule: 'Stop struktural 3,0–5,0% · Target net +3,0R · Breakeven otomatis saat +1,25R',
  },
  'mean-reversion-trader': {
    title: 'Mean Reversion',
    role: '4H Capitulation Flush Reclaim',
    pf: '2,42',
    winRate: '65,4%',
    timeframe: '4H + Daily Guard',
    entryRule: 'RSI(14) < 30 + Low menembus Lower Bollinger Band + Bullish Reclaim Close Strength ≥ 0,55',
    exitRule: 'Stop di bawah swing low flush (3,0–5,0%) · Target kembali ke 4H EMA20 / BB Mid (min. +1,8R net)',
  },
  'wyckoff-trader': {
    title: 'Wyckoff Specialist',
    role: '4H Accumulation Spring & Reclaim',
    pf: '1,84',
    winRate: '52,4%',
    timeframe: '4H Struktur + 1H',
    entryRule: 'Undercut 20-bar support box dengan penutupan kembali di atas support + Close Strength ≥ 0,60',
    exitRule: 'Stop di bawah ekor spring · Target resistance atas accumulation range (+2,2R net)',
  },
  'smc-trader': {
    title: 'SMC Liquidity Sweep',
    role: '15m/1H 6-Hour Sweep & Displacement',
    pf: '1,21',
    winRate: '51,9%',
    timeframe: '15m Eksekusi + 1H/4H',
    entryRule: 'Sweep 24-bar (6 jam) liquidity low dalam uptrend 1H/4H + Bullish Displacement Close ≥ 0,65',
    exitRule: 'Stop di bawah sweep wick (min. 2,5%) · Target opposing liquidity pool (+2,0R net)',
  },
  'asymmetry-journal-trader': {
    title: 'Asymmetry Journal',
    role: '4H/1D On-Chain Revenue + Pullback',
    pf: '1,99',
    winRate: '54,5%',
    timeframe: 'Daily On-Chain + 4H',
    entryRule: 'Top DefiLlama Revenue/Fees + 30d Growth positif + 4H Trend Pullback Reclaim di atas EMA50',
    exitRule: 'Blokir downtrend Daily & MoM Revenue < -10% · Stop struktural · Target min. +1,75R net',
  },
};

function formatIdr(value: number): string {
  return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}

function formatCoinPrice(value: number): string {
  const maximumFractionDigits = Math.abs(value) >= 1000 ? 2 : Math.abs(value) >= 1 ? 4 : 8;
  return `${value.toLocaleString('en-US', { maximumFractionDigits })} USDT`;
}

function coinSymbol(pair: string): string {
  return pair.replace('/', '').replace('_', '').replace(/idr$/i, '').toLowerCase();
}

function displayPair(pair: string): string {
  return `${coinSymbol(pair).toUpperCase()}/USDT`;
}

function agentCard(agent: AgentSummary) {
  const hasPosition = agent.openPairs.length > 0;
  const meta = CRYPTO_AGENT_META[agent.slug];

  const badges: DataCardBadge[] = [
    {
      label: agent.status === 'active' ? 'ACTIVE' : 'FIRED',
      tone: agent.status === 'active' ? 'positive' : 'neutral',
    },
  ];

  if (meta) {
    badges.push({
      label: `Backtest PF ${meta.pf}`,
      tone: 'accent',
    });
    badges.push({
      label: meta.timeframe,
      tone: 'neutral',
    });
  }

  if (agent.unrealizedPnlIdr !== 0) {
    badges.push({
      label: `FL: ${agent.unrealizedPnlIdr >= 0 ? '+' : ''}${formatIdr(agent.unrealizedPnlIdr)}`,
      tone: agent.unrealizedPnlIdr >= 0 ? 'positive' : 'negative',
    });
  }

  let statusTone: BadgeTone = 'neutral';
  let statusLabel = 'FLAT · SIAGA SINYAL';
  let statusDescription = agent.lastAction;

  if (hasPosition) {
    const pos = agent.openPositions[0];
    statusTone = pos.side === 'long' ? 'positive' : 'negative';
    statusLabel = `${pos.side.toUpperCase()} ${displayPair(agent.openPairs[0])}`;
    statusDescription =
      pos.sizingNote ??
      `Entry ${formatCoinPrice(pos.entryPriceUsdt ?? pos.entryPrice)}, stop ${formatCoinPrice(pos.stopPriceUsdt ?? pos.stopPrice)}.`;
  } else if (
    agent.lastAction.startsWith('⚡ Signal:') ||
    agent.lastAction.startsWith('🔥 Signal:')
  ) {
    statusTone = 'accent';
    statusLabel = 'SIGNAL DETECTED';
    statusDescription = agent.lastAction;
  } else if (agent.latestTrade) {
    statusTone =
      agent.latestTrade.type === 'close'
        ? (agent.latestTrade.realizedPnlIdr ?? 0) >= 0
          ? 'positive'
          : 'negative'
        : 'accent';

    statusLabel =
      agent.latestTrade.type === 'close'
        ? 'LAST: CLOSED'
        : 'LAST: OPENED';

    statusDescription = agent.latestTrade.reason;
  }

  return (
    <DataCard
      key={agent.slug}
      title={meta?.title ?? agent.slug}
      roleTag={meta?.role ?? agent.slug}
      href={`/agent/${agent.slug}`}
      subtitle={`Modal ${formatIdr(agent.startingBalance)} · Kas ${formatIdr(agent.cash)}`}
      badges={badges}
      statusTone={statusTone}
      statusLabel={statusLabel}
      statusDescription={statusDescription}
      value={formatIdr(agent.equity)}
      deltaPct={agent.pnlPct}
      live={agent.status === 'active'}
    />
  );
}

export default async function DeskPage() {
  const [snapshot, allBriefingSlugs, storedEquityHistory] =
    await Promise.all([
      getDeskSnapshot(),
      listBriefingSlugs(),
      getCoinEquityHistory(),
    ]);
  const equityHistory = withCurrentEquityPoint(storedEquityHistory, snapshot);
  const startingByAgent = Object.fromEntries(snapshot.agents.map((agent) => [agent.slug, agent.startingBalance]));

  const deskPnl =
    snapshot.totalEquity -
    snapshot.startingTotal;

  const deskPnlPct =
    (deskPnl /
      (snapshot.startingTotal || 1)) *
    100;

  const openPositionRows = snapshot.agents.flatMap((agent) =>
    agent.openPositions.map((position, index) => {
      const instrument = position.instrument ?? agent.openPairs[index] ?? '';
      const currentPrice = position.currentPrice ?? position.entryPrice;
      const marketValue = position.marketValue ?? position.size * currentPrice;
      const pnl = position.unrealizedPnlIdr ?? 0;
      const entryNotional = position.entryValueIdr ?? position.entryPrice * position.size;
      return {
        agent,
        position,
        instrument,
        currentPrice,
        marketValue,
        pnl,
        pnlPct: entryNotional > 0 ? (pnl / entryNotional) * 100 : 0,
        weightPct: agent.equity > 0 ? (marketValue / agent.equity) * 100 : 0,
      };
    }),
  );

  const bookHoldingSlugs = new Set(
    snapshot.agents.map(
      (agent) => agent.slug
    )
  );

  const otherSlugs =
    allBriefingSlugs
      .filter(
        (slug) =>
          !bookHoldingSlugs.has(slug)
      )
      .sort();

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      {/* Header Overview */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-blue-400 uppercase flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            Gemini AI-Fund · Crypto Spot Desk (USDT)
          </p>

          <h1 className="mt-1 font-sans text-2xl sm:text-3xl font-semibold text-ink">
            Crypto Desk Overview
          </h1>

          <p className="mt-1 font-mono text-xs text-ink-faint">
            Siklus terakhir{' '}
            <span className="text-ink-muted font-medium">
              {formatWibDateTime(snapshot.lastCycle)}
            </span>{' '}
            · mode {snapshot.deskMode} · strategi <span className="text-blue-400">recovery-v6-usdt</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/explore"
            className="rounded-lg border border-border bg-surface px-3.5 py-2 font-mono text-xs text-ink hover:border-blue-500/50 transition-colors"
          >
            🔍 Market Scanner
          </Link>
          <a
            href="#strategy-playbook"
            className="rounded-lg border border-border bg-surface px-3.5 py-2 font-mono text-xs text-ink hover:border-blue-500/50 transition-colors"
          >
            📋 Playbook v6
          </a>
          <Link
            href="/saham"
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 font-mono text-xs text-emerald-300 hover:border-emerald-400/60 transition-colors"
          >
            📈 Buka Desk Saham IDX →
          </Link>
        </div>
      </header>

      {/* Executive KPI Summary Strip */}
      <section className="mb-6 sm:mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ringkasan KPI Desk Kripto">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Total Ekuitas (6 Agen)</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-ink">{formatIdr(snapshot.totalEquity)}</p>
          <p className={`mt-1 font-mono text-xs font-medium ${deskPnlPct >= 0 ? 'text-positive' : 'text-negative'}`}>
            {deskPnlPct >= 0 ? '+' : ''}
            {deskPnlPct.toFixed(2)}% ({deskPnl >= 0 ? '+' : ''}
            {formatIdr(deskPnl)})
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Kas Tersedia vs Eksposur</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-ink">{formatIdr(snapshot.totalCash)}</p>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {snapshot.totalEquity > 0 ? ((snapshot.totalCash / snapshot.totalEquity) * 100).toFixed(1) : '100.0'}% kas ·{' '}
            {openPositionRows.length} posisi aktif
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Validasi Strategi v6</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-positive">6 / 6 Validated</p>
          <p className="mt-1 font-mono text-xs text-ink-muted">Backtest PF 1,21 – 2,42 (Net Fee)</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Sinyal &amp; Proteksi Risiko</p>
          <p className="mt-1.5 font-mono text-xl font-semibold text-blue-300">
            {snapshot.latestScanCandidates?.length ?? 0} Kandidat
          </p>
          <p className="mt-1 font-mono text-xs text-ink-muted">Max 1–3% risiko/trade · BE +1,25R</p>
        </div>
      </section>

      {/* Sinyal Pasar Aktif */}
      {snapshot.latestScanCandidates &&
        snapshot.latestScanCandidates.length > 0 && (
          <section className="mb-6 sm:mb-8 rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 backdrop-blur">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="font-sans text-xs sm:text-sm font-semibold text-blue-300 flex items-center gap-2">
                <span>⚡ Sinyal Pasar Aktif</span>

                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 font-mono text-[10px] text-blue-400 border border-blue-500/30">
                  {snapshot.latestScanCandidates.length} Terdeteksi
                </span>
              </h2>

              <span className="font-mono text-[10px] sm:text-[11px] text-ink-faint">
                {formatWibTime(snapshot.lastCycle)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {snapshot.latestScanCandidates.map((candidate, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border/60 bg-surface/80 p-2.5 sm:p-3 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-accent">
                      {displayPair(candidate.pair)}
                    </span>

                    <span className="text-ink-muted text-[11px]">
                      {CRYPTO_AGENT_META[candidate.agent]?.title ?? candidate.agent}
                    </span>
                  </div>

                  <p className="mt-1 text-[11px] text-ink-muted leading-relaxed line-clamp-2">
                    {candidate.reason}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

      {/* Kartu Agen Trading Aktif */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-sans text-base sm:text-lg font-semibold text-ink">Armada Agen Kripto Spot (6 Buku Aktif)</h2>
          <p className="font-mono text-[11px] text-ink-faint">Klik kartu agen untuk membuka rincian trading plan, kurva ekuitas, dan jurnal transaksi.</p>
        </div>
      </div>
      <section className="grid grid-cols-1 gap-3.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {snapshot.agents.map(agentCard)}
      </section>

      {/* Playbook Strategi Kripto v6 */}
      <section
        id="strategy-playbook"
        className="mt-6 sm:mt-8 scroll-mt-20 rounded-xl border border-border bg-surface p-4 sm:p-5"
        aria-labelledby="crypto-playbook-heading"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-blue-400">Validated Trading Plan · v6.0</p>
            <h2 id="crypto-playbook-heading" className="font-sans text-base sm:text-lg font-semibold text-ink">
              Matriks Setup &amp; Hasil Backtest 6 Agen Kripto
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
              Seluruh setup dievaluasi dengan potongan biaya transaksi realistis (0,30% per sisi / 0,60% round-trip) dan breakeven otomatis saat +1,25R.
            </p>
          </div>
          <span className="rounded-full border border-positive/30 bg-positive-bg px-2.5 py-1 font-mono text-[10px] font-medium text-positive">
            Semua Agen PF &gt; 1,00
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left font-mono text-xs">
            <thead className="border-b border-border text-[10px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="py-2 pr-3">Agen</th>
                <th className="px-3">Timeframe</th>
                <th className="px-3">Kriteria Entry Utama</th>
                <th className="px-3">Manajemen Stop &amp; Target</th>
                <th className="px-3 text-right">Win Rate</th>
                <th className="py-2 pl-3 text-right">Profit Factor</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(CRYPTO_AGENT_META).map(([slug, meta]) => (
                <tr key={slug} className="border-b border-border/60 text-ink-muted last:border-0 hover:bg-surface-hover">
                  <td className="py-3 pr-3 align-top">
                    <Link href={`/agent/${slug}`} className="font-semibold text-ink hover:text-accent">
                      {meta.title}
                    </Link>
                    <span className="block text-[10px] text-ink-faint">{meta.role}</span>
                  </td>
                  <td className="px-3 py-3 align-top whitespace-nowrap text-ink">{meta.timeframe}</td>
                  <td className="px-3 py-3 align-top font-sans text-xs leading-relaxed text-ink-muted max-w-xs">{meta.entryRule}</td>
                  <td className="px-3 py-3 align-top font-sans text-xs leading-relaxed text-ink-muted max-w-xs">{meta.exitRule}</td>
                  <td className="px-3 py-3 align-top text-right text-ink">{meta.winRate}</td>
                  <td className="py-3 pl-3 align-top text-right font-semibold text-positive">{meta.pf}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <CoinEquityHistory
        points={equityHistory}
        agentSlugs={snapshot.agents.map((agent) => agent.slug)}
        startingTotal={snapshot.startingTotal}
        startingByAgent={startingByAgent}
      />

      <section className="mt-6 sm:mt-8 rounded-xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="coin-open-positions">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="coin-open-positions" className="font-sans text-base sm:text-lg font-semibold text-ink">Open Positions</h2>
            <p className="mt-0.5 font-mono text-[11px] text-ink-faint">Harga pasar, nilai posisi, bobot buku, dan floating P&amp;L net estimasi per agen.</p>
          </div>
          <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-ink-muted">{openPositionRows.length} posisi</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left font-mono text-xs">
            <thead className="border-b border-border text-[10px] uppercase tracking-wide text-ink-faint">
              <tr><th className="py-2 pr-3">Agen</th><th className="px-3">Pair</th><th className="px-3 text-right">Jumlah</th><th className="px-3 text-right">Entry</th><th className="px-3 text-right">Harga Saat Ini</th><th className="px-3 text-right">Nilai Posisi</th><th className="px-3 text-right">Bobot Buku</th><th className="py-2 pl-3 text-right">Floating P&amp;L</th></tr>
            </thead>
            <tbody>
              {openPositionRows.map(({ agent, position, instrument, currentPrice, marketValue, pnl, pnlPct, weightPct }) => (
                <tr key={`${agent.slug}-${instrument}-${position.opened}`} className="border-b border-border/60 text-ink-muted last:border-0 hover:bg-surface-hover">
                  <td className="py-3 pr-3"><Link href={`/agent/${agent.slug}`} className="font-medium text-ink hover:text-accent">{agent.slug}</Link></td>
                  <td className="px-3"><Link href={`/pair/${coinSymbol(instrument)}`} className="font-semibold text-accent hover:underline">{displayPair(instrument)}</Link></td>
                  <td className="px-3 text-right">{position.size.toLocaleString('id-ID', { maximumFractionDigits: 8 })}</td>
                  <td className="px-3 text-right">{formatCoinPrice(position.entryPriceUsdt ?? position.entryPrice)}</td>
                  <td className="px-3 text-right text-ink">{formatCoinPrice(position.currentPriceUsdt ?? currentPrice)}</td>
                  <td className="px-3 text-right font-semibold text-ink">{formatIdr(marketValue)}</td>
                  <td className="px-3 text-right">{weightPct.toFixed(1)}%</td>
                  <td className={`py-3 pl-3 text-right font-semibold ${pnl >= 0 ? 'text-positive' : 'text-negative'}`}>{pnl >= 0 ? '+' : '-'}{formatIdr(Math.abs(pnl))}<span className="ml-1 font-normal text-ink-faint">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</span></td>
                </tr>
              ))}
              {openPositionRows.length === 0 ? <tr><td colSpan={8} className="py-8 text-center font-sans text-sm text-ink-faint">Belum ada posisi coin terbuka.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* Agen Pengawas & Riset Khusus */}
      {otherSlugs.length > 0 && (
        <section className="mt-6 sm:mt-8 rounded-xl border border-border/80 bg-surface/60 p-4">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h2 className="font-sans text-xs sm:text-sm font-semibold text-ink">
                Agen Pengawas &amp; Riset Khusus
              </h2>

              <p className="text-[11px] text-ink-faint">
                Persona analis makro dan
                pengawas risiko (tanpa buku
                saldo langsung)
              </p>
            </div>

            <span className="rounded bg-surface-hover px-2 py-0.5 font-mono text-[10px] text-ink-muted border border-border">
              {otherSlugs.length} Agen
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
            {otherSlugs.map((slug) => (
              <Link
                key={slug}
                href={`/agent/${slug}`}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-bg/80 px-2.5 py-1.5 font-mono text-[11px] text-ink-muted transition-colors hover:border-accent hover:text-ink"
              >
                {slug}
                <StatBadge tone="neutral">
                  briefing
                </StatBadge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Risk Management + Gemini AI Console */}
      <section className="mt-6 sm:mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Risk Management */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
              <div>
                <h3 className="font-sans text-base sm:text-lg font-semibold text-ink flex items-center gap-2">
                  <span>🛡️</span>
                  Kebijakan &amp; Batasan Risiko
                </h3>

                <p className="text-[11px] sm:text-xs text-ink-faint mt-0.5">
                  Dikelola otomatis oleh
                  Paper Trading Risk Engine
                </p>
              </div>

              <span className="rounded-full bg-positive-bg px-2.5 py-0.5 font-mono text-[10px] font-medium text-positive border border-positive/20 uppercase">
                AKTIF
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
              {RISK_POLICY.map((policy) => (
                <div key={policy.label} className="rounded-lg border border-border/60 bg-bg/60 p-3">
                  <p className="font-mono text-[10px] text-ink-faint uppercase">
                    {policy.label}
                  </p>

                  <p className="mt-0.5 font-sans font-semibold text-ink text-sm">
                    {policy.value}
                  </p>

                  <p className="text-[10px] text-ink-muted mt-0.5">
                    {policy.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-ink-faint">
            <span>
              Protokol Keamanan:
              Terverifikasi
            </span>

            <span className="font-mono text-positive">
              Synthetic Paper Trading
            </span>
          </div>
        </div>

        {/* Gemini AI Console */}
        <AiConsole />
      </section>

      <LiveTicker />
    </main>
  );
}
