import type { OHLCV } from './indicators';
import { fetchBulkIdrPrices } from './market-data';

export type BinanceTimeframe = '1m' | '15m' | '1h' | '4h' | '1d';

const BINANCE_MARKET_DATA_BASE = process.env.BINANCE_MARKET_DATA_BASE ?? 'https://data-api.binance.vision';
const INTERVALS: Record<BinanceTimeframe, string> = {
  '1m': '1m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
};

type BinanceKline = [
  number, string, string, string, string, string, number,
  string, number, string, string, string,
];

interface BinanceExchangeSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  isSpotTradingAllowed?: boolean;
}

let idrRatePromise: Promise<number> | null = null;
let spotBasesPromise: Promise<Set<string> | null> | null = null;

function normalizedPair(pair: string): string {
  return pair.replace('/', '').replaceAll('_', '').toLowerCase();
}

export function toBinanceSymbol(pair: string): string {
  const clean = normalizedPair(pair);
  const base = clean.endsWith('idr') ? clean.slice(0, -3) : clean;
  return `${base.toUpperCase()}USDT`;
}

async function usdtIdrRate(): Promise<number> {
  idrRatePromise ??= fetchBulkIdrPrices().then((prices) => {
    const rate = prices.usdt_idr;
    if (!rate || !Number.isFinite(rate)) throw new Error('USDT/IDR conversion rate unavailable');
    return rate;
  }).catch((error) => {
    idrRatePromise = null;
    throw error;
  });
  return idrRatePromise;
}

export function parseBinanceKlines(rows: unknown[], fx: number, limit: number): OHLCV[] {
  return rows
    .map((raw): OHLCV | null => {
      if (!Array.isArray(raw) || raw.length < 6) return null;
      const row = raw as BinanceKline;
      const timestamp = Number(row[0]);
      const open = Number(row[1]) * fx;
      const high = Number(row[2]) * fx;
      const low = Number(row[3]) * fx;
      const close = Number(row[4]) * fx;
      const volume = Number(row[5]);
      if (![timestamp, open, high, low, close, volume].every(Number.isFinite)) return null;
      return { timestamp, open, high, low, close, volume };
    })
    .filter((row): row is OHLCV => row !== null)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-limit);
}

export async function fetchBinanceOhlcv(pair: string, timeframe: BinanceTimeframe, limit: number): Promise<OHLCV[]> {
  const boundedLimit = Math.min(1000, Math.max(2, Math.floor(limit)));
  const symbol = toBinanceSymbol(pair);
  const url = `${BINANCE_MARKET_DATA_BASE}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${INTERVALS[timeframe]}&limit=${boundedLimit}`;
  const [response, fx] = await Promise.all([fetch(url, { cache: 'no-store' }), usdtIdrRate()]);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Binance klines ${symbol} ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`);
  }
  const rows = await response.json() as unknown[];
  return parseBinanceKlines(rows, fx, boundedLimit);
}

/** Active Binance Spot base assets quoted in USDT, cached per process. */
export async function fetchBinanceSpotBases(): Promise<Set<string> | null> {
  spotBasesPromise ??= fetch(`${BINANCE_MARKET_DATA_BASE}/api/v3/exchangeInfo`, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Binance exchangeInfo ${response.status}`);
      const payload = await response.json() as { symbols?: BinanceExchangeSymbol[] };
      return new Set((payload.symbols ?? [])
        .filter((item) => item.status === 'TRADING' && item.quoteAsset === 'USDT' && item.isSpotTradingAllowed !== false)
        .map((item) => item.baseAsset.toLowerCase()));
    })
    .catch((error) => {
      console.warn(`[Binance] exchangeInfo unavailable: ${String(error)}`);
      spotBasesPromise = null;
      return null;
    });
  return spotBasesPromise;
}
