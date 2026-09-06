import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPair } from '@/lib/pairs';
import { findPairBySymbol } from '@/lib/all-pairs';
import { fetchCoinOhlcv } from '@/lib/coin-market';
import { fetchCoinInfo } from '@/lib/coingecko';
import { fetchCoinNews } from '@/lib/news';
import { computeTechnicalSnapshot } from '@/lib/technical';
import { computeSmcSnapshot } from '@/lib/smc';
import { computeFibonacci } from '@/lib/fibonacci';
import { computeBreakout } from '@/lib/breakout';
import { scoreMovingAverage, scoreRsi, scoreBreakout, scoreSmc, scoreFibonacci, computeComposite, buildTradingPlan } from '@/lib/analysis-score';
import { PriceChart } from '@/components/PriceChart';
import { TechnicalPanel } from '@/components/TechnicalPanel';
import { CoinInfoPanel } from '@/components/CoinInfoPanel';
import { CoinNewsPanel } from '@/components/CoinNewsPanel';
import { HistoricalTable } from '@/components/HistoricalTable';
import { AiAnalysisPanel } from '@/components/AiAnalysisPanel';
import { AnalysisGrid } from '@/components/AnalysisGrid';
import { TradingPlanCard } from '@/components/TradingPlanCard';
import { StatBadge } from '@/components/StatBadge';

// No generateStaticParams here on purpose — this page must always fetch
// live prices/candles per request, not bake in build-time snapshots.
export const dynamic = 'force-dynamic';

const TIMEFRAMES = {
  '1h': { label: '1H', candles: 160 },
  '4h': { label: '4H', candles: 150 },
  '1d': { label: 'Daily', candles: 120 },
} as const;

type Timeframe = keyof typeof TIMEFRAMES;

export default async function PairPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ tf?: string }>;
}) {
  const { symbol } = await params;
  const { tf } = await searchParams;
  const timeframe: Timeframe = tf === '1h' || tf === '4h' || tf === '1d' ? tf : '4h';
  const timeframeMeta = TIMEFRAMES[timeframe];
  // Fast path: featured desk pairs. Fallback: active Indodax IDR pairs.
  const pair = getPair(symbol) ?? (await findPairBySymbol(symbol));
  if (!pair) notFound();

  // .catch(() => []) covers both "no data for this pair" and transient
  // Indodax failures (e.g. a 429 rate-limit) — either way, degrade to the
  // same empty-state message below instead of throwing an unhandled 500.
  const [candles, dailyCandles, coinInfo, news] = await Promise.all([
    fetchCoinOhlcv(pair.indodaxId, timeframe, timeframeMeta.candles).catch(() => []),
    fetchCoinOhlcv(pair.indodaxId, '1d', 2).catch(() => []),
    pair.coingeckoId ? fetchCoinInfo(pair.coingeckoId) : Promise.resolve(null),
    fetchCoinNews(pair.name, pair.symbol),
  ]);

  if (candles.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-6">
          <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">{pair.indodaxId.toUpperCase()} · {pair.venue === 'kraken' ? 'Kraken USD → IDR sintetis' : 'Indodax IDR'}</p>
          <h1 className="mt-1 font-sans text-3xl font-semibold text-ink">{pair.name}</h1>
        </header>
        <div className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-muted">
          Couldn&apos;t load candle data for this pair right now — either its market source has no usable chart history, or
          the request was rate-limited. Try again shortly, or
          try another pair from{' '}
          <a href="/explore" className="text-accent hover:underline">
            Explore
          </a>
          .
        </div>
      </main>
    );
  }

  const snapshot = computeTechnicalSnapshot(candles);
  const smc = computeSmcSnapshot(candles);
  const fib = computeFibonacci(candles);
  const breakout = computeBreakout(candles);

  const last = candles[candles.length - 1];
  const prev = dailyCandles[dailyCandles.length - 2];
  const dailyLast = dailyCandles[dailyCandles.length - 1];
  const changePct = prev && dailyLast ? ((dailyLast.close - prev.close) / prev.close) * 100 : 0;

  const hasFullAnalysis = snapshot && smc && fib && breakout;
  const composite = hasFullAnalysis
    ? computeComposite([scoreMovingAverage(snapshot), scoreRsi(snapshot), scoreBreakout(breakout), scoreSmc(smc), scoreFibonacci(fib)])
    : null;
  const plan = hasFullAnalysis && composite ? buildTradingPlan(composite, snapshot, smc, fib, breakout) : null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">{pair.indodaxId.toUpperCase()} · {pair.venue === 'kraken' ? 'Kraken USD → IDR sintetis' : 'Indodax IDR'}</p>
          <h1 className="mt-1 font-sans text-3xl font-semibold text-ink">{pair.name}</h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold text-ink">
            Rp{last.close >= 1000 ? Math.round(last.close).toLocaleString('id-ID') : last.close.toLocaleString('id-ID', { maximumFractionDigits: 6 })}
          </p>
          <StatBadge tone={changePct >= 0 ? 'positive' : 'negative'}>
            {changePct >= 0 ? '+' : ''}
            {changePct.toFixed(2)}% (24h)
          </StatBadge>
        </div>
      </header>

      {pair.venue === 'kraken' && (
        <div className="mb-6 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 font-sans text-xs leading-relaxed text-ink-muted">
          ZEC tidak tersedia pada feed pair aktif Indodax. Candle berasal dari Kraken ZEC/USD lalu dikonversi dengan kurs USDT/IDR Indodax. Harga ini hanya dipakai untuk simulasi paper trading, bukan acuan eksekusi live.
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-sans text-sm font-medium text-ink-muted">Price Chart · {timeframeMeta.label}</h2>
          <nav className="flex rounded-lg border border-border p-1" aria-label="Pilih timeframe">
            {(Object.entries(TIMEFRAMES) as [Timeframe, (typeof TIMEFRAMES)[Timeframe]][]).map(([value, meta]) => (
              <Link key={value} href={`/pair/${pair.symbol}?tf=${value}`} scroll={false} className={`rounded-md px-3 py-1 font-mono text-xs ${timeframe === value ? 'bg-accent-bg text-accent' : 'text-ink-muted hover:text-ink'}`}>
                {meta.label}
              </Link>
            ))}
          </nav>
        </div>
        <PriceChart candles={candles} timeframe={timeframeMeta.label} />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {snapshot ? <TechnicalPanel snapshot={snapshot} timeframe={timeframeMeta.label} /> : <div className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-muted">Data candle belum cukup untuk analisis teknikal.</div>}
        <CoinInfoPanel info={coinInfo} />
      </section>

      {hasFullAnalysis && composite && plan && (
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AnalysisGrid composite={composite} />
          <TradingPlanCard plan={plan} />
        </section>
      )}

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HistoricalTable candles={candles} timeframe={timeframeMeta.label} />
        {hasFullAnalysis && composite && plan && (
          <AiAnalysisPanel symbol={pair.symbol} name={pair.name} snapshot={snapshot} smc={smc} fib={fib} breakout={breakout} composite={composite} plan={plan} />
        )}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CoinNewsPanel news={news} />
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="font-sans text-lg font-semibold text-ink">Cara Membaca Halaman Ini</h3>
          <div className="mt-3 space-y-2 font-sans text-sm leading-relaxed text-ink-muted">
            <p><span className="font-medium text-ink">Daily</span> untuk bias dan level besar, <span className="font-medium text-ink">4H</span> untuk rencana utama, dan <span className="font-medium text-ink">1H</span> untuk timing setelah setup ada.</p>
            <p>Berita dan fundamental adalah konteks. Rencana trading hanya berbasis data harga pada timeframe aktif dan bukan rekomendasi keuangan.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
