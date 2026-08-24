import { notFound } from 'next/navigation';
import { getPair } from '@/lib/pairs';
import { findPairBySymbol } from '@/lib/all-pairs';
import { fetchOhlcv } from '@/lib/indodax';
import { fetchCoinInfo } from '@/lib/coingecko';
import { computeTechnicalSnapshot } from '@/lib/technical';
import { computeSmcSnapshot } from '@/lib/smc';
import { computeFibonacci } from '@/lib/fibonacci';
import { computeBreakout } from '@/lib/breakout';
import { scoreMovingAverage, scoreRsi, scoreBreakout, scoreSmc, scoreFibonacci, computeComposite, buildTradingPlan } from '@/lib/analysis-score';
import { PriceChart } from '@/components/PriceChart';
import { TechnicalPanel } from '@/components/TechnicalPanel';
import { CoinInfoPanel } from '@/components/CoinInfoPanel';
import { HistoricalTable } from '@/components/HistoricalTable';
import { AiAnalysisPanel } from '@/components/AiAnalysisPanel';
import { AnalysisGrid } from '@/components/AnalysisGrid';
import { TradingPlanCard } from '@/components/TradingPlanCard';
import { StatBadge } from '@/components/StatBadge';

// No generateStaticParams here on purpose — this page must always fetch
// live prices/candles per request, not bake in build-time snapshots.
export const dynamic = 'force-dynamic';

export default async function PairPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  // Fast path: the 8 pairs the paper-trading desk actually holds books in.
  // Fallback: the other ~470 active Indodax IDR pairs (research/browsing only).
  const pair = getPair(symbol) ?? (await findPairBySymbol(symbol));
  if (!pair) notFound();

  // .catch(() => []) covers both "no data for this pair" and transient
  // Indodax failures (e.g. a 429 rate-limit) — either way, degrade to the
  // same empty-state message below instead of throwing an unhandled 500.
  const [dailyCandles, technicalCandles, coinInfo] = await Promise.all([
    fetchOhlcv(pair.indodaxId, '1d', 60).catch(() => []),
    fetchOhlcv(pair.indodaxId, '15m', 60).catch(() => []),
    fetchCoinInfo(pair.coingeckoId),
  ]);

  if (dailyCandles.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-6">
          <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">{pair.indodaxId.toUpperCase()}</p>
          <h1 className="mt-1 font-sans text-3xl font-semibold text-ink">{pair.name}</h1>
        </header>
        <div className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-muted">
          Couldn&apos;t load candle data for this pair right now — either Indodax has nothing for it (a handful of thin
          pairs are listed as tradeable but have no chart feed), or the request was rate-limited. Try again shortly, or
          try another pair from{' '}
          <a href="/explore" className="text-accent hover:underline">
            Explore
          </a>
          .
        </div>
      </main>
    );
  }

  const snapshot = computeTechnicalSnapshot(technicalCandles);
  const smc = computeSmcSnapshot(technicalCandles);
  const fib = computeFibonacci(technicalCandles);
  const breakout = computeBreakout(technicalCandles);

  const last = dailyCandles[dailyCandles.length - 1];
  const prev = dailyCandles[dailyCandles.length - 2];
  const changePct = prev ? ((last.close - prev.close) / prev.close) * 100 : 0;

  const hasFullAnalysis = snapshot && smc && fib && breakout;
  const composite = hasFullAnalysis
    ? computeComposite([scoreMovingAverage(snapshot), scoreRsi(snapshot), scoreBreakout(breakout), scoreSmc(smc), scoreFibonacci(fib)])
    : null;
  const plan = hasFullAnalysis && composite ? buildTradingPlan(composite, snapshot, smc, fib, breakout) : null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">{pair.indodaxId.toUpperCase()}</p>
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

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 font-sans text-sm font-medium text-ink-muted">Price Chart · Daily</h2>
        <PriceChart candles={dailyCandles} />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {snapshot ? <TechnicalPanel snapshot={snapshot} /> : <div className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-muted">Not enough candle history yet for technical analysis.</div>}
        <CoinInfoPanel info={coinInfo} />
      </section>

      {hasFullAnalysis && composite && plan && (
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AnalysisGrid composite={composite} />
          <TradingPlanCard plan={plan} />
        </section>
      )}

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HistoricalTable candles={dailyCandles} />
        {hasFullAnalysis && composite && plan && (
          <AiAnalysisPanel symbol={pair.symbol} name={pair.name} snapshot={snapshot} smc={smc} fib={fib} breakout={breakout} composite={composite} plan={plan} />
        )}
      </section>
    </main>
  );
}
