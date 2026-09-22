import type { OHLCV } from './indicators';
import { fetchBinanceOhlcv } from './binance';
import { fetchBulkIdrPrices } from './market-data';

export type CoinTimeframe = '1m' | '15m' | '1h' | '4h' | '1d';

function normalizedPair(pair: string): string {
  return pair.replace('/', '').toLowerCase();
}

function priceKey(pair: string): string {
  const clean = normalizedPair(pair);
  return clean.endsWith('idr') ? clean.replace(/idr$/, '_idr') : `${clean}_idr`;
}

/**
 * Binance Spot is the single OHLC source for the paper desk. USDT candles are
 * converted to synthetic IDR so risk sizing and the existing ledger stay IDR.
 */
export async function fetchCoinOhlcv(pair: string, timeframe: CoinTimeframe, limit: number): Promise<OHLCV[]> {
  return fetchBinanceOhlcv(normalizedPair(pair), timeframe, limit);
}

/** Execution remains anchored to tradable Indodax IDR last prices. */
export async function fetchBulkCoinPrices(): Promise<Record<string, number>> {
  const prices = await fetchBulkIdrPrices();
  if (!prices.zec_idr) {
    const candles = await fetchCoinOhlcv('zecidr', '1m', 2);
    const price = candles.at(-1)?.close;
    if (price) prices[priceKey('zecidr')] = price;
  }
  return prices;
}

export function marketVenue(_pair: string): 'binance' {
  return 'binance';
}
