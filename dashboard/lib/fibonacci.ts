import type { OHLCV } from './indicators';

export interface FibLevel {
  ratio: number;
  price: number;
  label: string;
}

export interface FibonacciSnapshot {
  swingHighPrice: number;
  swingLowPrice: number;
  direction: 'retracing-down' | 'retracing-up';
  levels: FibLevel[];
  nearestLevel: FibLevel;
  distanceToNearestPct: number;
  inGoldenPocket: boolean; // 61.8%-65% — the tightest, highest-probability reaction zone
}

const RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/**
 * Retracement levels off the most recent significant swing (a simple
 * lookback-window high/low, independent of the pivot logic in smc.ts so
 * this reads correctly even when SMC's 2-bar pivot filter doesn't fire).
 */
export function computeFibonacci(candles: OHLCV[], lookback = 40): FibonacciSnapshot | null {
  const closed = candles.slice(0, -1);
  if (closed.length < lookback) return null;

  const window = closed.slice(-lookback);
  const highBar = window.reduce((a, b) => (b.high > a.high ? b : a));
  const lowBar = window.reduce((a, b) => (b.low < a.low ? b : a));

  const swingHighPrice = highBar.high;
  const swingLowPrice = lowBar.low;
  const range = swingHighPrice - swingLowPrice;
  if (range <= 0) return null;

  // If the high printed after the low, price ran up and is now retracing
  // down from it (levels measured from the high); otherwise the reverse.
  const direction: FibonacciSnapshot['direction'] = highBar.timestamp > lowBar.timestamp ? 'retracing-down' : 'retracing-up';

  const levels: FibLevel[] = RATIOS.map((ratio) => ({
    ratio,
    price: direction === 'retracing-down' ? swingHighPrice - range * ratio : swingLowPrice + range * ratio,
    label: `${(ratio * 100).toFixed(1)}%`,
  }));

  const close = closed[closed.length - 1].close;
  const nearestLevel = levels.reduce((a, b) => (Math.abs(b.price - close) < Math.abs(a.price - close) ? b : a));
  const distanceToNearestPct = (Math.abs(close - nearestLevel.price) / close) * 100;

  const goldenLow = direction === 'retracing-down' ? swingHighPrice - range * 0.65 : swingLowPrice + range * 0.618;
  const goldenHigh = direction === 'retracing-down' ? swingHighPrice - range * 0.618 : swingLowPrice + range * 0.65;
  const inGoldenPocket = close >= Math.min(goldenLow, goldenHigh) && close <= Math.max(goldenLow, goldenHigh);

  return { swingHighPrice, swingLowPrice, direction, levels, nearestLevel, distanceToNearestPct, inGoldenPocket };
}
