import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAgentBookBreakdown, getAgentMeta, getCoinEquityHistory, getFullBriefing, listBriefingSlugs } from '@/lib/desk-data';
import { renderBriefingMarkdown } from '@/lib/markdown';
import { StatBadge } from '@/components/StatBadge';
import { TradeJournal } from '@/components/TradeJournal';
import { AgentEquityHistory } from '@/components/CoinEquityHistory';

export const dynamic = 'force-dynamic';

const AGENT_PLAYBOOK: Record<
  string,
  {
    title: string;
    subtitle: string;
    timeframe: string;
    backtestPf: string;
    backtestWr: string;
    entryRules: string[];
    exitRules: string[];
  }
> = {
  'breakout-specialist': {
    title: 'Breakout Specialist',
    subtitle: '4H Relative Strength Breakout · Trend Continuation',
    timeframe: '4H + Daily Macro Filter',
    backtestPf: '1,94',
    backtestWr: '51,9%',
    entryRules: [
      'Penutupan 4H menembus 20-bar High sebelumnya dalam struktur EMA20 > EMA50.',
      'Volume relatif ≥ 1,3x rata-rata 20 bar dan Close Strength ≥ 0,68.',
      'Relative Strength (RS) positif terhadap BTC serta Daily Regime tidak bearish.',
    ],
    exitRules: [
      'Stop loss struktural di bawah 4H EMA20 / breakout base (dibatasi 3,5% – 5,0%).',
      'Target profit bersih +2,5R setelah biaya transaksi (0,30% per sisi).',
      'Alokasi tunggal 30% ekuitas tanpa inverted pyramiding; breakeven otomatis saat +1,25R.',
    ],
  },
  'aggressive-breakout-trader': {
    title: 'Aggressive Momentum',
    subtitle: '15m / 1H High-Velocity Impulse & Relative Strength',
    timeframe: '15m Trigger + 1H/4H Context',
    backtestPf: '1,46',
    backtestWr: '44,8%',
    entryRules: [
      'Breakout di atas 20-bar High dengan lonjakan volume ekstrem (RVOL ≥ 3,5x).',
      'Close Strength ≥ 0,75 (penutupan di kuartil atas candle) dan ekspansi range ≥ 1,3x ATR.',
      'Wajib outperform BTC minimal +2,0% dalam 24 jam terakhir.',
    ],
    exitRules: [
      'Stop loss struktural 3,0% – 5,0% di bawah swing low / EMA20.',
      'Target asimetris +3,0R net; breakeven stop net-positif aktif saat harga mencapai +1,25R.',
    ],
  },
  'mean-reversion-trader': {
    title: 'Mean Reversion',
    subtitle: '4H Capitulation Flush & Bullish Reclaim',
    timeframe: '4H + Daily Trend Guard',
    backtestPf: '2,42',
    backtestWr: '65,4%',
    entryRules: [
      'Kondisi jenuh jual ekstrem pada 4H: RSI(14) < 30 disertai penembusan Lower Bollinger Band(20, 2).',
      'Konfirmasi candle pembalikan (Bullish Reclaim) dengan Close Strength ≥ 0,55.',
      'Dilindungi filter makro Daily agar tidak menangkap pisau jatuh pada koin yang rusak struktural.',
    ],
    exitRules: [
      'Stop loss di bawah titik terendah ekor kapitulasi (3,0% – 5,0%).',
      'Target kembali ke nilai tengah (4H EMA20 / Bollinger Midline) dengan minimal +1,8R net.',
    ],
  },
  'wyckoff-trader': {
    title: 'Wyckoff Specialist',
    subtitle: '4H Accumulation Spring & Support Reclaim',
    timeframe: '4H Struktur + 1H Konfirmasi',
    backtestPf: '1,84',
    backtestWr: '52,4%',
    entryRules: [
      'Harga melakukan undercut (Spring) di bawah lantai 20-bar support box pada timeframe 4H.',
      'Penutupan candle kembali masuk ke atas support box dengan Close Strength ≥ 0,60 dan volume serapan ≥ 1,1x.',
      'Struktur harga berada di dekat atau di atas EMA50 4H (fase akumulasi/re-akumulasi).',
    ],
    exitRules: [
      'Stop loss di bawah titik terendah ekor Spring (maksimal 4,5%).',
      'Target di batas atas (resistance) accumulation range atau minimal +2,2R net.',
    ],
  },
  'smc-trader': {
    title: 'SMC Liquidity Sweep',
    subtitle: '15m/1H 6-Hour Liquidity Sweep & Bullish Displacement',
    timeframe: '15m Eksekusi + 1H/4H Trend',
    backtestPf: '1,21',
    backtestWr: '51,9%',
    entryRules: [
      'Tren naik terkonfirmasi pada timeframe 1H & 4H (EMA20 > EMA50).',
      'Harga menyapu likuiditas di bawah 24-bar (6 jam) swing low lalu ditutup menguat di atas level sweep.',
      'Konfirmasi Bullish Displacement dengan Close Strength ≥ 0,65.',
    ],
    exitRules: [
      'Stop loss di bawah ujung ekor liquidity sweep (minimal jarak struktural 2,5%).',
      'Target pada opposing liquidity pool (24-bar high) dengan minimal +2,0R net.',
    ],
  },
  'asymmetry-journal-trader': {
    title: 'Asymmetry Journal',
    subtitle: 'Daily On-Chain Revenue + 4H Trend Pullback Reclaim',
    timeframe: 'Daily Fundamental + 4H/1H Trigger',
    backtestPf: '1,99',
    backtestWr: '54,5%',
    entryRules: [
      'Protokol memiliki pendapatan/fee on-chain nyata (DefiLlama) dengan pertumbuhan 30 hari positif.',
      'Blokir otomatis jika tren Daily turun (downtrend) atau pendapatan bulanan (MoM) turun > 10%.',
      'Entry saat pullback sehat ke zona 4H EMA20/EMA50 diikuti candle reclaim bullish.',
    ],
    exitRules: [
      'Stop loss di bawah swing low pullback 4H (3,5% – 5,0%).',
      'Target di swing high 4H berikutnya dengan rasio imbal hasil bersih minimal +1,75R – 2,2R.',
    ],
  },
};

function displayName(slug: string): string {
  return (
    AGENT_PLAYBOOK[slug]?.title ??
    slug
      .split('-')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ')
  );
}

function fmtIdr(value: number): string {
  return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}

export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const slugs = await listBriefingSlugs();
  if (!slugs.includes(slug)) notFound();

  const [meta, briefing, book, storedEquityHistory] = await Promise.all([getAgentMeta(slug), getFullBriefing(slug), getAgentBookBreakdown(slug), getCoinEquityHistory()]);
    // Kas + NILAI PENUH posisi terbuka, bukan cuma floating P&L-nya -- lihat fix yang sama di desk-data.ts untuk alasan lengkapnya.
  const totalEquity = book.cash + book.openPositionValue;
  const startingBalance = meta.startingBalance ?? 0;
  const realizedPct = startingBalance ? (book.realizedPnlIdr / startingBalance) * 100 : 0;
  const unrealizedPct = startingBalance ? (book.unrealizedPnlIdr / startingBalance) * 100 : 0;
  const openCount = book.cycles.filter((c) => c.status === 'open').length;
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const datePart = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((part) => part.type === type)?.value ?? '';
  const today = `${datePart('year')}-${datePart('month')}-${datePart('day')}`;
  const storedToday = storedEquityHistory.find((point) => point.date === today && point.kind === 'snapshot');
  const equityHistory = storedEquityHistory.filter((point) => !(point.date === today && point.kind === 'snapshot'));
  equityHistory.push({
    date: today,
    capturedAt: now.toISOString(),
    kind: 'snapshot',
    totalEquity: storedToday?.totalEquity ?? totalEquity,
    agents: { ...(storedToday?.agents ?? {}), [slug]: { equity: totalEquity } },
  });
  equityHistory.sort((left, right) => left.date.localeCompare(right.date));

  const playbook = AGENT_PLAYBOOK[slug];

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-5">
        <Link href="/" className="font-mono text-xs text-accent hover:underline">
          ← Kembali ke Crypto Desk
        </Link>
      </div>

      <header className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] tracking-wide text-blue-400 uppercase">
              {playbook ? `${playbook.timeframe} · Validated v6.0` : 'Briefing Book'}
            </p>
            <h1 className="mt-1 font-sans text-2xl sm:text-3xl font-semibold text-ink">{displayName(slug)}</h1>
            {playbook && <p className="mt-1 font-sans text-sm text-ink-muted">{playbook.subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {playbook && (
              <StatBadge tone="accent">Backtest PF {playbook.backtestPf} · WR {playbook.backtestWr}</StatBadge>
            )}
            <StatBadge tone={meta.status === 'active' ? 'positive' : meta.status === 'fired' ? 'negative' : 'neutral'}>
              {meta.status.toUpperCase()}
            </StatBadge>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 font-mono text-xs text-ink-muted">
          {meta.hired && <span>Aktif sejak {meta.hired}</span>}
          {meta.firedDate && <span>· Nonaktif {meta.firedDate}</span>}
          {meta.assetsCovered.length > 0 && <span>· {meta.assetsCovered.length} pasangan koin dipantau</span>}
        </div>

        {meta.fireReason && (
          <div className="rounded-lg border border-border bg-negative-bg/40 px-3 py-2.5">
            <span className="font-mono text-[10px] tracking-wide text-negative uppercase">Catatan Status</span>
            <p className="mt-1 font-sans text-xs leading-relaxed text-ink-muted">{meta.fireReason}</p>
          </div>
        )}
      </header>

      {meta.hasBook && (
        <>
          <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
              <span className="block font-mono text-[10px] tracking-wide text-ink-faint uppercase">Total Ekuitas</span>
              <span className="mt-1 block font-mono text-sm font-semibold text-ink">{fmtIdr(totalEquity)}</span>
            </div>
            <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
              <span className="block font-mono text-[10px] tracking-wide text-ink-faint uppercase">Kas Tersedia</span>
              <span className="mt-1 block font-mono text-sm font-semibold text-ink">{fmtIdr(book.cash)}</span>
            </div>
            <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
              <span className="block font-mono text-[10px] tracking-wide text-ink-faint uppercase">
                Nilai Posisi <span className="text-ink-faint">({openCount})</span>
              </span>
              <span className="mt-1 block font-mono text-sm font-semibold text-ink">{fmtIdr(book.openPositionValue)}</span>
            </div>
            <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
              <span className="block font-mono text-[10px] tracking-wide text-ink-faint uppercase">P&amp;L Realized</span>
              <span className={`mt-1 block font-mono text-sm font-semibold ${book.realizedPnlIdr >= 0 ? 'text-positive' : 'text-negative'}`}>
                {book.realizedPnlIdr >= 0 ? '+' : '-'}
                {fmtIdr(Math.abs(book.realizedPnlIdr))}
                <span className="ml-1 font-normal text-ink-faint">
                  ({realizedPct >= 0 ? '+' : ''}
                  {realizedPct.toFixed(2)}%)
                </span>
              </span>
            </div>
            <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
              <span className="block font-mono text-[10px] tracking-wide text-ink-faint uppercase">P&amp;L Floating</span>
              <span className={`mt-1 block font-mono text-sm font-semibold ${book.unrealizedPnlIdr >= 0 ? 'text-positive' : 'text-negative'}`}>
                {book.unrealizedPnlIdr >= 0 ? '+' : '-'}
                {fmtIdr(Math.abs(book.unrealizedPnlIdr))}
                <span className="ml-1 font-normal text-ink-faint">
                  ({unrealizedPct >= 0 ? '+' : ''}
                  {unrealizedPct.toFixed(2)}%)
                </span>
              </span>
            </div>
            <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
              <span className="block font-mono text-[10px] tracking-wide text-ink-faint uppercase">Transaksi Terakhir</span>
              <span className="mt-1 block font-mono text-sm font-semibold text-ink">
                {meta.latestTrade ? meta.latestTrade.type.toUpperCase() : 'SIAGA'}
              </span>
            </div>
          </section>

          <section className="mb-6 rounded-xl border border-border bg-surface px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="block font-mono text-[10px] tracking-wide text-blue-400 uppercase">
                  Cohort Strategi Recovery v6 · Performa Bersih
                </span>
                <p className="mt-1 font-sans text-xs text-ink-muted">
                  Melacak hasil transaksi sejak penerapan trading plan v6 (tervalidasi backtest PF &gt; 1,0).
                </p>
              </div>
              <div className="flex gap-4 font-mono text-xs text-ink">
                <span>{book.recoveryV3.closedTrades} closed</span>
                <span>WR {book.recoveryV3.winRate == null ? '—' : `${book.recoveryV3.winRate.toFixed(1)}%`}</span>
                <span className={book.recoveryV3.realizedPnlIdr >= 0 ? 'text-positive' : 'text-negative'}>
                  {book.recoveryV3.realizedPnlIdr >= 0 ? '+' : '-'}{fmtIdr(Math.abs(book.recoveryV3.realizedPnlIdr))}
                </span>
              </div>
            </div>
          </section>
        </>
      )}

      {playbook && (
        <section className="mb-6 rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-blue-400">Strategy Playbook · v6.0</p>
              <h2 className="mt-0.5 font-sans text-lg font-semibold text-ink">Aturan Trading Plan &amp; Manajemen Risiko</h2>
            </div>
            <span className="font-mono text-xs text-positive">
              Backtest PF {playbook.backtestPf} · Win Rate {playbook.backtestWr}
            </span>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-sans text-sm font-semibold text-ink">Kriteria Entry</h3>
              <ul className="space-y-1.5 font-sans text-xs leading-relaxed text-ink-muted">
                {playbook.entryRules.map((rule) => (
                  <li key={rule}>• {rule}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-sans text-sm font-semibold text-ink">Manajemen Stop, Target &amp; Sizing</h3>
              <ul className="space-y-1.5 font-sans text-xs leading-relaxed text-ink-muted">
                {playbook.exitRules.map((rule) => (
                  <li key={rule}>• {rule}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {meta.hasBook ? <AgentEquityHistory points={equityHistory} slug={slug} startingEquity={startingBalance} /> : null}

      {(book.cycles.length > 0 || book.pendingOrders.length > 0) && (
        <section className="mb-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-1.5">
            <div>
              <h2 className="font-sans text-sm font-medium text-ink">
                Aktivitas Posisi Terbaru
              </h2>
              <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                Posisi terbuka selalu terlihat · riwayat lengkap tersedia per halaman
              </p>
            </div>
            <span className="font-mono text-[10px] text-ink-faint">
              {openCount} posisi terbuka · {book.pendingOrders.length} pending
            </span>
          </div>
          <TradeJournal cycles={book.cycles} pendingOrders={book.pendingOrders} equity={totalEquity} />
        </section>
      )}

      <details className="mx-auto max-w-3xl rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer list-none px-5 py-4 font-sans text-sm font-medium text-ink marker:hidden [&::-webkit-details-marker]:hidden">
          Catatan strategi &amp; metodologi agent
          <span className="ml-2 font-mono text-[10px] font-normal text-ink-faint">opsional</span>
        </summary>
        <div className="border-t border-border p-6">
          {briefing ? (
            <div className="briefing-content" dangerouslySetInnerHTML={{ __html: renderBriefingMarkdown(briefing) }} />
          ) : (
            <p className="font-sans text-sm text-ink-muted">No briefing on file for this agent yet.</p>
          )}
        </div>
      </details>
    </main>
  );
}
