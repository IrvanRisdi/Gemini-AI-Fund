import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPair } from '@/lib/pairs';
import { findPairBySymbol } from '@/lib/all-pairs';
import { fetchCoinOhlcv } from '@/lib/coin-market';
import { fetchBinance24hStats } from '@/lib/binance';
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

export const dynamic = 'force-dynamic';

const TIMEFRAMES = {
  '1h': { label: '1H', candles: 160 },
  '4h': { label: '4H', candles: 150 },
  '1d': { label: 'Daily', candles: 120 },
} as const;

type Timeframe = keyof typeof TIMEFRAMES;

async function AsyncCoinInfo({ coingeckoId }: { coingeckoId: string }) {
  const coinInfo = coingeckoId ? await fetchCoinInfo(coingeckoId) : null;
  return <CoinInfoPanel info={coinInfo} />;
}

async function AsyncCoinNews({ name, symbol }: { name: string; symbol: string }) {
  const news = await fetchCoinNews(name, symbol);
  return <CoinNewsPanel news={news} />;
}

export default async function PairPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ tf?: string }>;
}) {
  const { symbol } = await params;
  const { tf } = await searchParams;
  const cleanSymbol = symbol.toLowerCase();
  const timeframe: Timeframe = tf === '1h' || tf === '4h' || tf === '1d' ? tf : '4h';
  const timeframeMeta = TIMEFRAMES[timeframe];

  // Fetch candles and 24h stats in parallel with metadata lookup so there is zero sequential waterfall!
  const [resolvedPair, candles, stats24h] = await Promise.all([
    Promise.resolve(getPair(cleanSymbol)).then((p) => p ?? findPairBySymbol(cleanSymbol)),
    fetchCoinOhlcv(cleanSymbol, timeframe, timeframeMeta.candles).catch(() => []),
    fetchBinance24hStats().catch(() => new Map()),
  ]);

  const pair =
    resolvedPair ??
    (candles.length > 0
      ? {
          symbol: cleanSymbol,
          name: cleanSymbol.toUpperCase(),
          indodaxId: `${cleanSymbol}_idr`,
          coingeckoId: '',
        }
      : undefined);

  if (!pair) notFound();

  if (candles.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-6">
          <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">{pair.symbol.toUpperCase()}/USDT · Binance Spot</p>
          <h1 className="mt-1 font-sans text-3xl font-semibold text-ink">{pair.name}</h1>
        </header>
        <div className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-muted">
          Data candle untuk pasangan ini sedang tidak tersedia dari Binance Spot. Silakan coba beberapa saat lagi atau pilih koin lain dari{' '}
          <Link href="/explore" className="text-accent hover:underline">
            Market Scanner
          </Link>
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
  const prev = candles.length >= 2 ? candles[candles.length - 2] : last;
  const ticker24h = stats24h.get(cleanSymbol);
  const changePct =
    ticker24h?.priceChangePct ??
    (prev && last && prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0);

  const hasFullAnalysis = snapshot && smc && fib && breakout;
  const composite = hasFullAnalysis
    ? computeComposite([scoreMovingAverage(snapshot), scoreRsi(snapshot), scoreBreakout(breakout), scoreSmc(smc), scoreFibonacci(fib)])
    : null;
  const plan = hasFullAnalysis && composite ? buildTradingPlan(composite, snapshot, smc, fib, breakout) : null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/explore" className="font-mono text-xs text-accent hover:underline">
          ← Kembali ke Market Scanner
        </Link>
        <Link href="/" className="font-mono text-xs text-ink-muted hover:text-ink">
          Crypto Desk Overview →
        </Link>
      </div>

      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-blue-400 uppercase">{pair.symbol.toUpperCase()}/USDT · Binance Spot</p>
          <h1 className="mt-1 font-sans text-3xl font-semibold text-ink">{pair.name}</h1>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-mono text-2xl font-semibold text-ink">
            {last.close.toLocaleString('en-US', { maximumFractionDigits: last.close >= 1000 ? 2 : last.close >= 1 ? 4 : 8 })} USDT
          </p>
          <StatBadge tone={changePct >= 0 ? 'positive' : 'negative'}>
            {changePct >= 0 ? '+' : ''}
            {changePct.toFixed(2)}% (24h)
          </StatBadge>
        </div>
      </header>

      <div className="mb-6 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 font-sans text-xs leading-relaxed text-ink-muted">
        Candle, indikator, dan trading plan memakai harga native Binance Spot USDT (di-cache 60 detik untuk pembukaan instan). Konversi USDT/IDR dilakukan otomatis pada pembukuan kas dan posisi.
      </div>

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
        <Suspense fallback={<div className="rounded-xl border border-border bg-surface p-5 font-mono text-xs text-ink-faint animate-pulse">Memuat profil fundamental CoinGecko…</div>}>
          <AsyncCoinInfo coingeckoId={pair.coingeckoId} />
        </Suspense>
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
        <Suspense fallback={<div className="rounded-xl border border-border bg-surface p-5 font-mono text-xs text-ink-faint animate-pulse">Memuat berita pasar terkini…</div>}>
          <AsyncCoinNews name={pair.name} symbol={pair.symbol} />
        </Suspense>
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
