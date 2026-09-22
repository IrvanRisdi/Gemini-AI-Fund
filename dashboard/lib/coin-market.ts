import type { OHLCV } from './indicators';
import { fetchBinanceOhlcv, fetchBinanceSpotPrices } from './binance';
import { fetchBulkIdrPrices } from './market-data';

export type CoinTimeframe = '1m' | '15m' | '1h' | '4h' | '1d';

function normalizedPair(pair: string): string {
  return pair.replace('/', '').toLowerCase();
}

function priceKey(pair: string): string {
  const clean = normalizedPair(pair);
  return clean.endsWith('idr') ? clean.replace(/idr$/, '_idr') : `${clean}_idr`;
}

function usdtPriceKey(pair: string): string {
  const clean = normalizedPair(pair).replaceAll('_', '');
  const base = clean.endsWith('usdt') ? clean.slice(0, -4) : clean.endsWith('idr') ? clean.slice(0, -3) : clean;
  return `${base}_usdt`;
}

/**
 * Binance Spot is the single OHLC source. Candle prices remain in their native
 * USDT quote; conversion to IDR only happens inside the accounting layer.
 */
export async function fetchCoinOhlcv(pair: string, timeframe: CoinTimeframe, limit: number): Promise<OHLCV[]> {
  return fetchBinanceOhlcv(normalizedPair(pair), timeframe, limit);
}

export async function fetchUsdtIdrRate(): Promise<number> {
  const prices = await fetchBulkIdrPrices();
  const rate = prices.usdt_idr;
  if (!rate || !Number.isFinite(rate)) throw new Error('USDT/IDR conversion rate unavailable');
  return rate;
}

/** Native Binance prices keyed like `btc_usdt`. */
export async function fetchBulkCoinPricesUsdt(): Promise<Record<string, number>> {
  const prices = await fetchBinanceSpotPrices();
  return Object.fromEntries(Object.entries(prices).map(([base, price]) => [`${base}_usdt`, price]));
}

/**
 * Accounting prices keyed like the legacy `btc_idr` map. The market source is
 * Binance USDT; multiplication by USDT/IDR exists only to value IDR books.
 */
export async function fetchBulkCoinPrices(): Promise<Record<string, number>> {
  const [pricesUsdt, fx] = await Promise.all([fetchBulkCoinPricesUsdt(), fetchUsdtIdrRate()]);
  return Object.fromEntries(Object.entries(pricesUsdt).map(([key, price]) => [priceKey(key.replace(/_usdt$/, '')), price * fx]));
}

export async function fetchCoinMarketSnapshot(): Promise<{
  pricesUsdt: Record<string, number>;
  pricesIdr: Record<string, number>;
  usdtIdr: number;
}> {
  const [pricesUsdt, usdtIdr] = await Promise.all([fetchBulkCoinPricesUsdt(), fetchUsdtIdrRate()]);
  const pricesIdr = Object.fromEntries(Object.entries(pricesUsdt).map(([key, price]) => [priceKey(key.replace(/_usdt$/, '')), price * usdtIdr]));
  return { pricesUsdt, pricesIdr, usdtIdr };
}

export { priceKey as idrPriceKey, usdtPriceKey };

export function marketVenue(_pair: string): 'binance' {
  return 'binance';
}
