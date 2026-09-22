import type { OHLCV } from './indicators';

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

interface BinancePriceTicker {
  symbol: string;
  price: string;
}

export interface Binance24hTicker {
  symbol: string;
  lastPrice: number;
  highPrice: number;
  lowPrice: number;
  quoteVolume: number;
  priceChangePct: number;
}

let spotBasesPromise: Promise<Set<string> | null> | null = null;

function normalizedPair(pair: string): string {
  return pair.replace('/', '').replaceAll('_', '').toLowerCase();
}

export function toBinanceSymbol(pair: string): string {
  const clean = normalizedPair(pair);
  const base = clean.endsWith('usdt') ? clean.slice(0, -4) : clean.endsWith('idr') ? clean.slice(0, -3) : clean;
  return `${base.toUpperCase()}USDT`;
}

function baseFromBinanceSymbol(symbol: string): string | null {
  return symbol.endsWith('USDT') ? symbol.slice(0, -4).toLowerCase() : null;
}

export function parseBinanceKlines(rows: unknown[], limit: number): OHLCV[] {
  return rows
    .map((raw): OHLCV | null => {
      if (!Array.isArray(raw) || raw.length < 6) return null;
      const row = raw as BinanceKline;
      const timestamp = Number(row[0]);
      const open = Number(row[1]);
      const high = Number(row[2]);
      const low = Number(row[3]);
      const close = Number(row[4]);
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
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Binance klines ${symbol} ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`);
  }
  const rows = await response.json() as unknown[];
  return parseBinanceKlines(rows, boundedLimit);
}

/** Latest Binance Spot prices keyed by base asset, for example `btc`. */
export async function fetchBinanceSpotPrices(): Promise<Record<string, number>> {
  const response = await fetch(`${BINANCE_MARKET_DATA_BASE}/api/v3/ticker/price`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Binance ticker prices ${response.status}`);
  const rows = await response.json() as BinancePriceTicker[];
  return Object.fromEntries(rows.flatMap((row) => {
    const base = baseFromBinanceSymbol(row.symbol);
    const price = Number(row.price);
    return base && Number.isFinite(price) ? [[base, price] as const] : [];
  }));
}

/** Binance 24-hour USDT stats keyed by base asset. */
export async function fetchBinance24hStats(): Promise<Map<string, Binance24hTicker>> {
  const response = await fetch(`${BINANCE_MARKET_DATA_BASE}/api/v3/ticker/24hr`, { next: { revalidate: 60 } });
  if (!response.ok) throw new Error(`Binance ticker 24hr ${response.status}`);
  const rows = await response.json() as Array<Record<string, string>>;
  const result = new Map<string, Binance24hTicker>();
  for (const row of rows) {
    const symbol = String(row.symbol ?? '');
    const base = baseFromBinanceSymbol(symbol);
    if (!base) continue;
    const ticker = {
      symbol,
      lastPrice: Number(row.lastPrice),
      highPrice: Number(row.highPrice),
      lowPrice: Number(row.lowPrice),
      quoteVolume: Number(row.quoteVolume),
      priceChangePct: Number(row.priceChangePercent),
    };
    if ([ticker.lastPrice, ticker.highPrice, ticker.lowPrice, ticker.quoteVolume, ticker.priceChangePct].every(Number.isFinite)) {
      result.set(base, ticker);
    }
  }
  return result;
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
