import type { OHLCV } from './indicators';

export type BinanceTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

const BINANCE_MARKET_DATA_BASE = process.env.BINANCE_MARKET_DATA_BASE ?? 'https://data-api.binance.vision';
const INTERVALS: Record<BinanceTimeframe, string> = {
  '1m': '1m',
  '5m': '5m',
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
const ohlcvCache = new Map<string, { expiresAt: number; data: OHLCV[] }>();
let spotPricesCache: { expiresAt: number; data: Record<string, number> } | null = null;
let stats24hCache: { expiresAt: number; data: Map<string, Binance24hTicker> } | null = null;

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
  const cacheKey = `${symbol}:${timeframe}:${boundedLimit}`;
  const now = Date.now();
  const cached = ohlcvCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const url = `${BINANCE_MARKET_DATA_BASE}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${INTERVALS[timeframe]}&limit=${boundedLimit}`;
  const response = await fetch(url, {
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) {
    if (cached) return cached.data;
    const detail = await response.text().catch(() => '');
    throw new Error(`Binance klines ${symbol} ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`);
  }
  const rows = (await response.json()) as unknown[];
  const parsed = parseBinanceKlines(rows, boundedLimit);
  ohlcvCache.set(cacheKey, { expiresAt: now + 60_000, data: parsed });
  return parsed;
}

/** Latest Binance Spot prices keyed by base asset, for example `btc`. */
export async function fetchBinanceSpotPrices(): Promise<Record<string, number>> {
  const now = Date.now();
  if (spotPricesCache && spotPricesCache.expiresAt > now) {
    return spotPricesCache.data;
  }
  if (stats24hCache && stats24hCache.expiresAt > now) {
    return Object.fromEntries([...stats24hCache.data.entries()].map(([base, t]) => [base, t.lastPrice]));
  }
  const response = await fetch(`${BINANCE_MARKET_DATA_BASE}/api/v3/ticker/price`, {
    next: { revalidate: 30 },
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) {
    if (spotPricesCache) return spotPricesCache.data;
    throw new Error(`Binance ticker prices ${response.status}`);
  }
  const rows = (await response.json()) as BinancePriceTicker[];
  const data = Object.fromEntries(
    rows.flatMap((row) => {
      const base = baseFromBinanceSymbol(row.symbol);
      const price = Number(row.price);
      return base && Number.isFinite(price) ? [[base, price] as const] : [];
    }),
  );
  spotPricesCache = { expiresAt: now + 30_000, data };
  return data;
}

/** Binance 24-hour USDT stats keyed by base asset. */
export async function fetchBinance24hStats(): Promise<Map<string, Binance24hTicker>> {
  const now = Date.now();
  if (stats24hCache && stats24hCache.expiresAt > now) {
    return stats24hCache.data;
  }
  const response = await fetch(`${BINANCE_MARKET_DATA_BASE}/api/v3/ticker/24hr`, {
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) {
    if (stats24hCache) return stats24hCache.data;
    throw new Error(`Binance ticker 24hr ${response.status}`);
  }
  const rows = (await response.json()) as Array<Record<string, string>>;
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
    if (
      [ticker.lastPrice, ticker.highPrice, ticker.lowPrice, ticker.quoteVolume, ticker.priceChangePct].every(
        Number.isFinite,
      ) &&
      ticker.lastPrice > 0
    ) {
      result.set(base, ticker);
    }
  }
  stats24hCache = { expiresAt: now + 60_000, data: result };
  return result;
}

/** Active Binance Spot base assets quoted in USDT, derived from cached 24h stats without downloading 20MB exchangeInfo. */
export async function fetchBinanceSpotBases(): Promise<Set<string> | null> {
  try {
    const stats = await fetchBinance24hStats();
    if (stats.size > 0) {
      return new Set(stats.keys());
    }
  } catch {
    // Fallback below if 24hr stats failed
  }
  spotBasesPromise ??= fetch(`${BINANCE_MARKET_DATA_BASE}/api/v3/ticker/price`, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(3500),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Binance ticker price ${response.status}`);
      const rows = (await response.json()) as BinancePriceTicker[];
      return new Set(
        rows
          .filter((item) => Number(item.price) > 0)
          .map((item) => baseFromBinanceSymbol(item.symbol))
          .filter((base): base is string => base !== null),
      );
    })
    .catch((error) => {
      console.warn(`[Binance] spot bases unavailable: ${String(error)}`);
      spotBasesPromise = null;
      return null;
    });
  return spotBasesPromise;
}
