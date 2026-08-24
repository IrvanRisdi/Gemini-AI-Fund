import type { OHLCV } from '@ai-fund/lib/indicators';
import { atr } from '@ai-fund/lib/indicators';

export interface SwingPoint {
  price: number;
  index: number;
  timestamp: number;
}

export interface LiquiditySweep {
  type: 'buy-side' | 'sell-side';
  poolPrice: number;
  volRatio: number;
}

export interface OrderBlock {
  type: 'bullish' | 'bearish';
  low: number;
  high: number;
  timestamp: number;
  displacementRatio: number;
}

export type MarketStructure = 'uptrend' | 'downtrend' | 'mixed';
export type Zone = 'premium' | 'discount' | 'equilibrium';
export type ChochDirection = 'bullish' | 'bearish' | null;

export interface SmcSnapshot {
  structure: MarketStructure;
  swingHigh: SwingPoint;
  swingLow: SwingPoint;
  equilibrium: number;
  zone: Zone;
  sweep: LiquiditySweep | null;
  choch: ChochDirection;
  bullishOB: OrderBlock | null;
  bearishOB: OrderBlock | null;
  oteLow: number;
  oteHigh: number;
  inOte: boolean;
}

// Pivot high/low: a bar whose high (low) is the max (min) among `lookback`
// bars on either side — the same 2-bar-lookback definition used by the
// smc-trader agent's own scan.
function findPivots(candles: OHLCV[], lookback = 2) {
  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const windowHighs = candles.slice(i - lookback, i + lookback + 1).map((c) => c.high);
    const windowLows = candles.slice(i - lookback, i + lookback + 1).map((c) => c.low);

    if (candles[i].high === Math.max(...windowHighs)) {
      highs.push({ price: candles[i].high, index: i, timestamp: candles[i].timestamp });
    }
    if (candles[i].low === Math.min(...windowLows)) {
      lows.push({ price: candles[i].low, index: i, timestamp: candles[i].timestamp });
    }
  }

  return { highs, lows };
}

function classifyStructure(highs: SwingPoint[], lows: SwingPoint[]): MarketStructure {
  if (highs.length < 2 || lows.length < 2) return 'mixed';
  const higherHigh = highs[highs.length - 1].price > highs[highs.length - 2].price;
  const higherLow = lows[lows.length - 1].price > lows[lows.length - 2].price;
  const lowerHigh = highs[highs.length - 1].price < highs[highs.length - 2].price;
  const lowerLow = lows[lows.length - 1].price < lows[lows.length - 2].price;

  if (higherHigh && higherLow) return 'uptrend';
  if (lowerHigh && lowerLow) return 'downtrend';
  return 'mixed';
}

function detectSweep(candles: OHLCV[], swingHigh: SwingPoint, swingLow: SwingPoint): LiquiditySweep | null {
  const last = candles[candles.length - 1];
  const prior10 = candles.slice(-11, -1);
  const avgVol = prior10.reduce((a, c) => a + c.volume, 0) / (prior10.length || 1);
  const volRatio = avgVol > 0 ? last.volume / avgVol : 0;

  // Buy-side sweep: wicks above the mapped high, closes back below it.
  if (last.high > swingHigh.price && last.close < swingHigh.price) {
    return { type: 'buy-side', poolPrice: swingHigh.price, volRatio };
  }
  // Sell-side sweep: wicks below the mapped low, closes back above it.
  if (last.low < swingLow.price && last.close > swingLow.price) {
    return { type: 'sell-side', poolPrice: swingLow.price, volRatio };
  }
  return null;
}

function detectChoch(structure: MarketStructure, candles: OHLCV[], highs: SwingPoint[], lows: SwingPoint[]): ChochDirection {
  const last = candles[candles.length - 1];
  // CHoCH: price closes beyond the most recent swing point AGAINST the
  // prevailing trend — the framework's highest-value single signal.
  if (structure === 'uptrend' && lows.length > 0 && last.close < lows[lows.length - 1].price) {
    return 'bearish';
  }
  if (structure === 'downtrend' && highs.length > 0 && last.close > highs[highs.length - 1].price) {
    return 'bullish';
  }
  return null;
}

function findOrderBlock(candles: OHLCV[], atrArr: number[], direction: 'bullish' | 'bearish'): OrderBlock | null {
  // Bullish OB: last down-close candle before an impulsive up-move.
  // Bearish OB: last up-close candle before an impulsive down-move.
  // "Impulsive" = body >= 1.5x ATR(14), matching the SMC skill's displacement filter.
  for (let i = candles.length - 2; i >= Math.max(1, candles.length - 20); i--) {
    const move = candles[i];
    const prior = candles[i - 1];
    const localAtr = atrArr[Math.max(0, i - (candles.length - atrArr.length))] ?? atrArr[atrArr.length - 1];
    const body = Math.abs(move.close - move.open);
    const displacementRatio = localAtr > 0 ? body / localAtr : 0;

    if (displacementRatio < 1.5) continue;

    if (direction === 'bullish' && move.close > move.open && prior.close < prior.open) {
      return { type: 'bullish', low: prior.low, high: prior.high, timestamp: prior.timestamp, displacementRatio };
    }
    if (direction === 'bearish' && move.close < move.open && prior.close > prior.open) {
      return { type: 'bearish', low: prior.low, high: prior.high, timestamp: prior.timestamp, displacementRatio };
    }
  }
  return null;
}

/**
 * Sweep + CHoCH confluence checked across a short window, not a single bar.
 *
 * `computeSmcSnapshot`'s `sweep` and `choch` fields are both computed off the
 * single most recent closed candle — fine for the dashboard's live-state
 * display, but requiring BOTH on the exact same bar as a trade trigger is a
 * near-impossible candle shape (wick beyond one swing extreme AND close
 * beyond the opposite one, in one 15m bar). Verified empirically: across
 * ~1,600 historical bar-checks on 10 pairs, that same-bar combination never
 * occurred once. Real SMC methodology (and this desk's own smc-trader
 * SKILL.md, step 3: "CONFIRM CHoCH — on a lower timeframe, immediately
 * after the sweep") expects the sweep to happen first and CHoCH to confirm
 * a few bars later on the same leg, not simultaneously.
 *
 * This walks backward up to `lookback` bars from the current CHoCH to find
 * the sweep that set it up, matching sweep/CHoCH direction (a sell-side
 * sweep grabs liquidity below, which should be followed by a bullish CHoCH;
 * a buy-side sweep by a bearish one). Re-testing with a 5-bar window found
 * 31 confluence hits across the same ~1,600 bar-checks — a real, tradeable
 * frequency instead of zero.
 */
export function detectSweepChochConfluence(
  candles: OHLCV[],
  lookback = 5
): { sweep: LiquiditySweep; choch: ChochDirection } | null {
  const current = computeSmcSnapshot(candles);
  if (!current || !current.choch) return null;

  for (let trim = 1; trim <= lookback; trim++) {
    const window = candles.slice(0, candles.length - trim);
    if (window.length < 30) break;
    const past = computeSmcSnapshot(window);
    if (!past?.sweep) continue;
    const matches =
      (current.choch === 'bullish' && past.sweep.type === 'sell-side') ||
      (current.choch === 'bearish' && past.sweep.type === 'buy-side');
    if (matches) return { sweep: past.sweep, choch: current.choch };
  }
  return null;
}

export function computeSmcSnapshot(candles: OHLCV[]): SmcSnapshot | null {
  const closed = candles.slice(0, -1);
  if (closed.length < 30) return null;

  const { highs, lows } = findPivots(closed, 2);
  if (highs.length === 0 || lows.length === 0) return null;

  const swingHigh = highs[highs.length - 1];
  const swingLow = lows[lows.length - 1];
  const structure = classifyStructure(highs, lows);
  const equilibrium = (swingHigh.price + swingLow.price) / 2;
  const last = closed[closed.length - 1];

  const range = swingHigh.price - swingLow.price;
  const zone: Zone = Math.abs(last.close - equilibrium) < range * 0.02 ? 'equilibrium' : last.close > equilibrium ? 'premium' : 'discount';

  const sweep = detectSweep(closed, swingHigh, swingLow);
  const choch = detectChoch(structure, closed, highs, lows);
  const atrArr = atr(closed, 14);
  const bullishOB = findOrderBlock(closed, atrArr, 'bullish');
  const bearishOB = findOrderBlock(closed, atrArr, 'bearish');

  // OTE = 61.8%-79% retracement of the active swing leg.
  const oteLow = swingLow.price + range * 0.618;
  const oteHigh = swingLow.price + range * 0.79;
  const inOte = last.close >= Math.min(oteLow, oteHigh) && last.close <= Math.max(oteLow, oteHigh);

  return { structure, swingHigh, swingLow, equilibrium, zone, sweep, choch, bullishOB, bearishOB, oteLow, oteHigh, inOte };
}
