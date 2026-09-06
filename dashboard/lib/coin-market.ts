import type { OHLCV } from './indicators';
import { fetchOhlcv as fetchIndodaxOhlcv } from './indodax';
import { fetchBulkIdrPrices } from './market-data';

export type CoinTimeframe = '1m' | '15m' | '1h' | '4h' | '1d';

const EXTERNAL_MARKETS: Record<string, { venue: 'kraken'; symbol: string }> = {
  zecidr: { venue: 'kraken', symbol: 'ZECUSD' },
};

const KRAKEN_INTERVAL: Record<CoinTimeframe, number> = {
  '1m': 1,
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};

function normalizedPair(pair: string): string {
  return pair.replace('/', '').toLowerCase();
}

function priceKey(pair: string): string {
  const clean = normalizedPair(pair);
  return clean.endsWith('idr') ? clean.replace(/idr$/, '_idr') : `${clean}_idr`;
}

async function idrPerUsd(prices?: Record<string, number>): Promise<number> {
  const available = prices ?? await fetchBulkIdrPrices();
  const rate = available.usdt_idr;
  if (!rate || !Number.isFinite(rate)) throw new Error('USDT/IDR conversion rate unavailable');
  return rate;
}

async function fetchKrakenOhlcv(symbol: string, timeframe: CoinTimeframe, limit: number, prices?: Record<string, number>): Promise<OHLCV[]> {
  const url = `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(symbol)}&interval=${KRAKEN_INTERVAL[timeframe]}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`kraken history ${symbol} ${response.status}`);
  const payload = await response.json() as {
    error?: string[];
    result?: Record<string, unknown>;
  };
  if (payload.error?.length) throw new Error(`kraken history ${symbol}: ${payload.error.join(', ')}`);
  const result = payload.result ?? {};
  const resultKey = Object.keys(result).find((key) => key !== 'last');
  const rows = resultKey ? result[resultKey] : null;
  if (!Array.isArray(rows)) return [];
  const fx = await idrPerUsd(prices);

  return rows
    .map((row): OHLCV | null => {
      if (!Array.isArray(row) || row.length < 7) return null;
      const timestamp = Number(row[0]) * 1000;
      const open = Number(row[1]) * fx;
      const high = Number(row[2]) * fx;
      const low = Number(row[3]) * fx;
      const close = Number(row[4]) * fx;
      const volume = Number(row[6]);
      if (![timestamp, open, high, low, close, volume].every(Number.isFinite)) return null;
      return { timestamp, open, high, low, close, volume };
    })
    .filter((row): row is OHLCV => row !== null)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-limit);
}

/**
 * Unified candle reader for the paper desk. Most pairs use Indodax IDR;
 * explicitly configured external pairs are converted to synthetic IDR.
 */
export async function fetchCoinOhlcv(pair: string, timeframe: CoinTimeframe, limit: number): Promise<OHLCV[]> {
  const clean = normalizedPair(pair);
  const external = EXTERNAL_MARKETS[clean];
  if (!external) return fetchIndodaxOhlcv(clean, timeframe, limit);
  return fetchKrakenOhlcv(external.symbol, timeframe, limit);
}

/** Includes external synthetic-IDR quotes under the same `symbol_idr` keys. */
export async function fetchBulkCoinPrices(): Promise<Record<string, number>> {
  const prices = await fetchBulkIdrPrices();
  const externalEntries = await Promise.allSettled(
    Object.entries(EXTERNAL_MARKETS).map(async ([pair, market]) => {
      const candles = await fetchKrakenOhlcv(market.symbol, '1m', 2, prices);
      const price = candles.at(-1)?.close;
      if (!price) throw new Error(`external price unavailable: ${pair}`);
      return [priceKey(pair), price] as const;
    }),
  );
  for (const result of externalEntries) {
    if (result.status === 'fulfilled') prices[result.value[0]] = result.value[1];
  }
  return prices;
}

export function marketVenue(pair: string): 'indodax' | 'kraken' {
  return EXTERNAL_MARKETS[normalizedPair(pair)]?.venue ?? 'indodax';
}
