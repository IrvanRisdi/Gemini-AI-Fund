import type { PairMeta } from './pairs';

export interface ExplorePairRow extends PairMeta {
  rank: number | null;
  marketCapUsd: number | null;
  priceIdr: number | null;
  /** Global CoinGecko move, explicitly kept separate from Indodax-local data. */
  globalChangePct24h: number | null;
  volumeIdr: number | null;
  highIdr: number | null;
  lowIdr: number | null;
}

interface CoinGeckoMarketEntry {
  id: string;
  name: string;
  market_cap_rank: number | null;
  market_cap: number | null;
  price_change_percentage_24h: number | null;
  current_price: number | null;
  total_volume: number | null;
}

interface IndodaxTicker {
  last?: string;
  high?: string;
  low?: string;
  vol_idr?: string;
}

interface IndodaxTickerStats {
  priceIdr: number | null;
  volumeIdr: number | null;
  highIdr: number | null;
  lowIdr: number | null;
}

function asNumber(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** All Indodax IDR last-trade prices in a single request, keyed by ticker_id (e.g. "btc_idr"). */
export async function fetchBulkIdrPrices(): Promise<Record<string, number>> {
  try {
    const res = await fetch('https://indodax.com/api/ticker_all', { next: { revalidate: 60 } });
    if (!res.ok) return {};
    const data = (await res.json()) as { tickers: Record<string, { last: string }> };
    const out: Record<string, number> = {};
    for (const [key, t] of Object.entries(data.tickers ?? {})) {
      const price = parseFloat(t.last);
      if (!Number.isNaN(price)) out[key] = price;
    }
    return out;
  } catch {
    return {};
  }
}

async function fetchExploreTickerStats(): Promise<Record<string, IndodaxTickerStats>> {
  try {
    const res = await fetch('https://indodax.com/api/ticker_all', { next: { revalidate: 60 } });
    if (!res.ok) return {};
    const data = (await res.json()) as { tickers: Record<string, IndodaxTicker> };
    return Object.fromEntries(
      Object.entries(data.tickers ?? {}).map(([key, ticker]) => [
        key,
        {
          priceIdr: asNumber(ticker.last),
          volumeIdr: asNumber(ticker.vol_idr),
          highIdr: asNumber(ticker.high),
          lowIdr: asNumber(ticker.low),
        },
      ]),
    );
  } catch {
    return {};
  }
}

/** Market cap rank + USD market cap for a batch of CoinGecko ids, chunked to stay under URL length limits. */
async function fetchMarketData(coingeckoIds: string[]): Promise<Map<string, CoinGeckoMarketEntry>> {
  const map = new Map<string, CoinGeckoMarketEntry>();
  const batches = chunk([...new Set(coingeckoIds.filter(Boolean))], 200);

  const results = await Promise.allSettled(
    batches.map(async (ids) => {
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}&order=market_cap_desc&per_page=250&sparkline=false`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) return [];
      return (await res.json()) as CoinGeckoMarketEntry[];
    })
  );

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const entry of r.value) map.set(entry.id, entry);
  }
  return map;
}

/**
 * Enriches the base pair list with rank, USD market cap, and IDR price —
 * sorted by CoinGecko market cap rank ascending. Pairs CoinGecko has no
 * rank for (thin/unlisted) sort to the bottom, alphabetically by symbol.
 * Degrades gracefully: if CoinGecko is unreachable, rank/marketCap come
 * back null for everything but the page still renders with symbol/name/price.
 */
export async function fetchExplorePairs(pairs: PairMeta[]): Promise<ExplorePairRow[]> {
  const [tickerStats, marketMap] = await Promise.all([fetchExploreTickerStats(), fetchMarketData(pairs.map((p) => p.coingeckoId))]);

  const rows: ExplorePairRow[] = pairs.map((p) => {
    const market = marketMap.get(p.coingeckoId);
    const ticker = tickerStats[`${p.symbol}_idr`];
    const usdToIdr = tickerStats.usdt_idr?.priceIdr ?? null;
    const externalPriceIdr = market?.current_price != null && usdToIdr != null ? market.current_price * usdToIdr : null;
    const externalVolumeIdr = market?.total_volume != null && usdToIdr != null ? market.total_volume * usdToIdr : null;
    return {
      ...p,
      name: market?.name ?? p.name,
      rank: market?.market_cap_rank ?? null,
      marketCapUsd: market?.market_cap ?? null,
      priceIdr: ticker?.priceIdr ?? (p.venue === 'kraken' ? externalPriceIdr : null),
      volumeIdr: ticker?.volumeIdr ?? (p.venue === 'kraken' ? externalVolumeIdr : null),
      highIdr: ticker?.highIdr ?? null,
      lowIdr: ticker?.lowIdr ?? null,
      globalChangePct24h: market?.price_change_percentage_24h ?? null,
    };
  });

  rows.sort((a, b) => {
    if (a.rank != null && b.rank != null) return a.rank - b.rank;
    if (a.rank != null) return -1;
    if (b.rank != null) return 1;
    return a.symbol.localeCompare(b.symbol);
  });

  return rows;
}
