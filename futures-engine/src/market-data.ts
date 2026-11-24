import type { MarketPrecision, OHLCV, PrecisionPlan, Timeframe } from './types.js';

const SPOT_DATA_BASE = process.env.BINANCE_MARKET_DATA_BASE ?? 'https://data-api.binance.vision';
const FUTURES_API_BASE = process.env.BINANCE_FUTURES_API_BASE ?? 'https://fapi.binance.com';

// Safe curated fallback precisions matching standard Binance USDT-M Futures contracts
// Used automatically if fapi.binance.com is geo-blocked (e.g. GitHub Actions US runners).
export const FALLBACK_PRECISION: Record<string, Omit<MarketPrecision, 'symbol' | 'source'>> = {
  BTCUSDT: { stepSize: 0.001, tickSize: 0.1, minQty: 0.001, minNotional: 100 },
  ETHUSDT: { stepSize: 0.001, tickSize: 0.01, minQty: 0.001, minNotional: 20 },
  SOLUSDT: { stepSize: 0.01, tickSize: 0.01, minQty: 0.01, minNotional: 5 },
  BNBUSDT: { stepSize: 0.01, tickSize: 0.01, minQty: 0.01, minNotional: 5 },
  XRPUSDT: { stepSize: 0.1, tickSize: 0.0001, minQty: 0.1, minNotional: 5 },
  DOGEUSDT: { stepSize: 1, tickSize: 0.00001, minQty: 1, minNotional: 5 },
  ADAUSDT: { stepSize: 1, tickSize: 0.0001, minQty: 1, minNotional: 5 },
  LINKUSDT: { stepSize: 0.01, tickSize: 0.001, minQty: 0.01, minNotional: 5 },
  AVAXUSDT: { stepSize: 0.01, tickSize: 0.001, minQty: 0.01, minNotional: 5 },
  SUIUSDT: { stepSize: 0.1, tickSize: 0.0001, minQty: 0.1, minNotional: 5 },
  DEFAULT: { stepSize: 0.1, tickSize: 0.0001, minQty: 0.1, minNotional: 5 },
};

let cachedPrecisionMap: Map<string, MarketPrecision> | null = null;

async function fetchWithRetry(url: string, timeoutMs = 10_000, maxAttempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (response.ok || response.status === 400 || response.status === 404) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, attempt * 600));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function parseKlines(rows: unknown[]): OHLCV[] {
  const out: OHLCV[] = [];
  for (const raw of rows) {
    if (!Array.isArray(raw) || raw.length < 6) continue;
    const timestamp = Number(raw[0]);
    const open = Number(raw[1]);
    const high = Number(raw[2]);
    const low = Number(raw[3]);
    const close = Number(raw[4]);
    const volume = Number(raw[5]);
    if ([timestamp, open, high, low, close, volume].every(Number.isFinite)) {
      out.push({ timestamp, open, high, low, close, volume });
    }
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

export async function fetchKlines(
  symbol: string,
  interval: Timeframe,
  limit = 260,
  startTime?: number,
): Promise<OHLCV[]> {
  const bounded = Math.min(1000, Math.max(2, Math.floor(limit)));
  const params = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval,
    limit: String(bounded),
  });
  if (startTime != null && Number.isFinite(startTime)) {
    params.set('startTime', String(Math.floor(startTime)));
  }
  const url = `${SPOT_DATA_BASE}/api/v3/klines?${params.toString()}`;
  const response = await fetchWithRetry(url, 10_000, 3);
  if (!response.ok) {
    throw new Error(`Binance klines ${symbol} ${interval} HTTP ${response.status}`);
  }
  const rows = (await response.json()) as unknown[];
  return parseKlines(rows);
}

export async function fetchKlinesRange(
  symbol: string,
  interval: Timeframe,
  startTimeMs: number,
  endTimeMs = Date.now(),
): Promise<OHLCV[]> {
  const collected: OHLCV[] = [];
  let cursor = startTimeMs;
  while (cursor < endTimeMs) {
    const batch = await fetchKlines(symbol, interval, 1000, cursor);
    if (batch.length === 0) break;
    for (const bar of batch) {
      if (bar.timestamp <= endTimeMs) collected.push(bar);
    }
    const lastTs = batch[batch.length - 1]!.timestamp;
    if (lastTs <= cursor || batch.length < 1000) break;
    cursor = lastTs + 1;
  }
  const dedup = new Map<number, OHLCV>();
  for (const bar of collected) dedup.set(bar.timestamp, bar);
  return [...dedup.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export interface Ticker24h {
  symbol: string;
  lastPrice: number;
  quoteVolumeUsd: number;
  priceChangePct: number;
}

export async function fetchAllUsdtTickers24h(): Promise<Ticker24h[]> {
  const url = `${SPOT_DATA_BASE}/api/v3/ticker/24hr`;
  const response = await fetchWithRetry(url, 12_000, 3);
  if (!response.ok) throw new Error(`Binance 24hr ticker HTTP ${response.status}`);
  const rows = (await response.json()) as Array<{
    symbol?: string;
    lastPrice?: string;
    quoteVolume?: string;
    priceChangePercent?: string;
  }>;
  return rows
    .filter((r) => typeof r.symbol === 'string' && r.symbol.endsWith('USDT'))
    .map((r) => ({
      symbol: r.symbol!,
      lastPrice: Number(r.lastPrice ?? 0),
      quoteVolumeUsd: Number(r.quoteVolume ?? 0),
      priceChangePct: Number(r.priceChangePercent ?? 0),
    }))
    .filter((r) => Number.isFinite(r.lastPrice) && r.lastPrice > 0 && Number.isFinite(r.quoteVolumeUsd));
}

interface ExchangeFilter {
  filterType?: string;
  stepSize?: string;
  minQty?: string;
  tickSize?: string;
  notional?: string;
  minNotional?: string;
}

interface ExchangeSymbolInfo {
  symbol?: string;
  filters?: ExchangeFilter[];
}

function parseExchangeInfo(
  symbols: ExchangeSymbolInfo[],
  source: 'futures-api' | 'spot-api',
): Map<string, MarketPrecision> {
  const map = new Map<string, MarketPrecision>();
  for (const item of symbols) {
    if (!item.symbol || !item.symbol.endsWith('USDT')) continue;
    const filters = item.filters ?? [];
    const lot = filters.find((f) => f.filterType === 'LOT_SIZE');
    const price = filters.find((f) => f.filterType === 'PRICE_FILTER');
    const notionalFilter = filters.find(
      (f) => f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL',
    );
    const stepSize = Number(lot?.stepSize ?? 0);
    const minQty = Number(lot?.minQty ?? stepSize);
    const tickSize = Number(price?.tickSize ?? 0.0001);
    const minNotional = Number(notionalFilter?.notional ?? notionalFilter?.minNotional ?? 5);
    if (stepSize > 0 && Number.isFinite(minNotional)) {
      map.set(item.symbol, {
        symbol: item.symbol,
        stepSize,
        tickSize: tickSize > 0 ? tickSize : 0.0001,
        minQty: minQty > 0 ? minQty : stepSize,
        minNotional: Math.max(5, minNotional),
        source,
      });
    }
  }
  return map;
}

export async function loadPrecisionMap(): Promise<Map<string, MarketPrecision>> {
  if (cachedPrecisionMap) return cachedPrecisionMap;

  // 1. Prefer live Binance USDT-M Futures exchangeInfo
  try {
    const res = await fetch(`${FUTURES_API_BASE}/fapi/v1/exchangeInfo`, {
      signal: AbortSignal.timeout(6_000),
    });
    if (res.ok) {
      const payload = (await res.json()) as { symbols?: ExchangeSymbolInfo[] };
      const parsed = parseExchangeInfo(payload.symbols ?? [], 'futures-api');
      if (parsed.size > 0) {
        cachedPrecisionMap = parsed;
        return parsed;
      }
    }
  } catch {
    // Fallback below if fapi is geo-blocked (e.g. GitHub Actions US runners)
  }

  // 2. Fallback to data-api.binance.vision spot exchangeInfo
  try {
    const res = await fetch(`${SPOT_DATA_BASE}/api/v3/exchangeInfo`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const payload = (await res.json()) as { symbols?: ExchangeSymbolInfo[] };
      const parsed = parseExchangeInfo(payload.symbols ?? [], 'spot-api');
      if (parsed.size > 0) {
        cachedPrecisionMap = parsed;
        return parsed;
      }
    }
  } catch {
    // Fallback to curated map below
  }

  // 3. Offline curated fallback
  const fallback = new Map<string, MarketPrecision>();
  for (const [symbol, cfg] of Object.entries(FALLBACK_PRECISION)) {
    if (symbol === 'DEFAULT') continue;
    fallback.set(symbol, { symbol, ...cfg, source: 'fallback' });
  }
  cachedPrecisionMap = fallback;
  return fallback;
}

export function getPrecisionForSymbol(
  symbol: string,
  map?: Map<string, MarketPrecision>,
): MarketPrecision {
  const sym = symbol.toUpperCase();
  const fromMap = map?.get(sym);
  if (fromMap) return fromMap;
  const curated = FALLBACK_PRECISION[sym] ?? FALLBACK_PRECISION.DEFAULT!;
  return { symbol: sym, ...curated, source: 'fallback' };
}

function decimalsFromStep(step: number): number {
  const str = step.toExponential();
  if (step >= 1) return 0;
  const fixed = step.toFixed(10).replace(/0+$/, '');
  const dot = fixed.indexOf('.');
  if (dot >= 0) return fixed.length - dot - 1;
  const match = str.match(/e-(\d+)/);
  return match ? Number(match[1]) : 4;
}

export function floorToStep(value: number, step: number): number {
  if (!(step > 0) || !Number.isFinite(value) || value <= 0) return 0;
  const decimals = decimalsFromStep(step);
  const steps = Math.floor((value + step * 1e-9) / step);
  return Number((steps * step).toFixed(decimals));
}

export function roundToTick(price: number, tickSize: number): number {
  if (!(tickSize > 0) || !Number.isFinite(price) || price <= 0) return price;
  const decimals = decimalsFromStep(tickSize);
  const ticks = Math.round(price / tickSize);
  return Number((ticks * tickSize).toFixed(decimals));
}

/**
 * Solusi Nomer 4: Validasi minNotional & stepSize sebelum entry dan untuk split Partial TP1 (50%).
 * - Jika total posisi di bawah minQty/minNotional -> tolak order dengan aman (tidak error di bursa).
 * - Jika 50% posisi untuk Partial TP1 (atau sisa 50% runner) di bawah minQty/minNotional
 *   -> otomatis turunkan ke exit 100% di TP1 (partialTpEnabled = false) agar order tetap valid.
 */
export function planOrderExecution(
  targetNotionalUsd: number,
  entryPrice: number,
  tp1Price: number,
  precision: MarketPrecision,
  partialRatio = 0.5,
): PrecisionPlan {
  if (!(entryPrice > 0) || !(targetNotionalUsd > 0)) {
    return {
      accepted: false,
      rejectReason: 'INVALID_NOTIONAL_OR_PRICE',
      totalQty: 0,
      totalNotionalUsd: 0,
      tp1Qty: 0,
      runnerQty: 0,
      partialTpEnabled: false,
      precisionNote: 'Notional atau harga entry tidak valid.',
    };
  }

  const rawQty = targetNotionalUsd / entryPrice;
  const totalQty = floorToStep(rawQty, precision.stepSize);
  const totalNotionalUsd = totalQty * entryPrice;

  if (totalQty < precision.minQty || totalNotionalUsd < precision.minNotional) {
    return {
      accepted: false,
      rejectReason: `ORDER_BELOW_MIN_NOTIONAL (qty=${totalQty} < minQty=${precision.minQty} atau notional=$${totalNotionalUsd.toFixed(2)} < minNotional=$${precision.minNotional})`,
      totalQty: 0,
      totalNotionalUsd: 0,
      tp1Qty: 0,
      runnerQty: 0,
      partialTpEnabled: false,
      precisionNote: `Ditolak: notional $${totalNotionalUsd.toFixed(2)} di bawah batas minimum bursa $${precision.minNotional} (${precision.symbol}).`,
    };
  }

  const tp1Qty = floorToStep(totalQty * partialRatio, precision.stepSize);
  const runnerQty = floorToStep(totalQty - tp1Qty, precision.stepSize);
  const tp1Notional = tp1Qty * tp1Price;
  const runnerNotional = runnerQty * tp1Price;

  const canSplit =
    tp1Qty >= precision.minQty &&
    runnerQty >= precision.minQty &&
    tp1Notional >= precision.minNotional &&
    runnerNotional >= precision.minNotional;

  if (!canSplit) {
    return {
      accepted: true,
      totalQty,
      totalNotionalUsd,
      tp1Qty: totalQty,
      runnerQty: 0,
      partialTpEnabled: false,
      precisionNote: `Auto-fallback 100% exit di TP1: pecahan 50% ($${tp1Notional.toFixed(2)}) di bawah minNotional $${precision.minNotional} / minQty ${precision.minQty}.`,
    };
  }

  return {
    accepted: true,
    totalQty,
    totalNotionalUsd,
    tp1Qty,
    runnerQty,
    partialTpEnabled: true,
    precisionNote: `Partial TP1 aktif: TP1=${tp1Qty} ($${tp1Notional.toFixed(2)}), Runner=${runnerQty} ($${runnerNotional.toFixed(2)}) [step=${precision.stepSize}, minNotional=$${precision.minNotional}].`,
  };
}
