/** Aggressive Breakout v5: 5-minute momentum ignition.
 * Backtested 2026-08 to 2026-10 (51 pairs, 0.3% fee/side): +0.41R/trade over
 * 292 trades with 16% signal overlap with the 15m Breakout Specialist. A
 * random-entry control under the same gates earned +0.12..0.31R, so the
 * signal edge is not yet proven; tight 5m stops (~1.2%) lost to fees. */
import { atr, ema, type OHLCV } from '../lib/indicators.js';
import { targetForNetReward } from './trading-math.js';

export const AGGRESSIVE_STRATEGY_VERSION = 'aggressive-5m-v5';
const LOOKBACK_BARS = 24; // 2 hours of 5m bars
const MIN_RELATIVE_VOLUME = 4;
const MIN_CLOSE_STRENGTH = 0.75;
const MAX_EXTENSION_ATR = 1;
const MIN_RISK_PCT = 0.03; // keeps the 0.6% round-trip fee near 0.2R
const MAX_RISK_PCT = 0.05;
const STOP_ATR = 1.5;
export const AGGRESSIVE_REWARD_MULTIPLE = 3;
export const AGGRESSIVE_TIME_STOP_HOURS = 48;
export const AGGRESSIVE_ORDER_TTL_MINUTES = 30;
/** The scan runs every 15 minutes, so the last three closed 5m bars are fresh. */
export const AGGRESSIVE_SIGNAL_BARS = 3;

export interface FifteenMinuteTrend { ema9: number; ema21: number; close: number }
export interface AggressivePlan {
  entry: number; stop: number; target: number; relativeVolume: number; signalBarAt: number;
}

/** Evaluates one closed 5m bar (`index`) against the 2-hour breakout rules. */
export function ignitionAt(closed: OHLCV[], index: number, trend: FifteenMinuteTrend): AggressivePlan | null {
  if (index < 60 || index >= closed.length) return null;
  if (!(trend.ema9 > trend.ema21 && trend.close >= trend.ema21)) return null;
  const window = closed.slice(0, index + 1);
  const last = window.at(-1)!;
  const prior = window.slice(-(LOOKBACK_BARS + 1), -1);
  const closes = window.map((bar) => bar.close);
  const averageTrueRange = atr(window, 14).at(-1)!;
  if (!(ema(closes, 9).at(-1)! > ema(closes, 21).at(-1)!)) return null;
  const range = Math.max(last.high - last.low, Number.EPSILON);
  if ((last.close - last.low) / range < MIN_CLOSE_STRENGTH) return null;
  const averageVolume = prior.reduce((sum, bar) => sum + bar.volume, 0) / prior.length;
  const relativeVolume = averageVolume > 0 ? last.volume / averageVolume : 0;
  if (relativeVolume < MIN_RELATIVE_VOLUME) return null;
  const resistance = Math.max(...prior.map((bar) => bar.high));
  if (!(last.close > resistance) || (last.close - resistance) / averageTrueRange > MAX_EXTENSION_ATR) return null;
  const entry = last.high * 1.0003;
  const riskPct = Math.min(MAX_RISK_PCT, Math.max(MIN_RISK_PCT, (STOP_ATR * averageTrueRange) / entry, (entry - Math.min(last.low, resistance)) / entry));
  const stop = entry * (1 - riskPct);
  return { entry, stop, target: targetForNetReward(entry, stop, AGGRESSIVE_REWARD_MULTIPLE), relativeVolume, signalBarAt: last.timestamp };
}

/** Newest qualifying signal among the last few closed 5m bars. */
export function latestIgnition(closed: OHLCV[], trend: FifteenMinuteTrend): AggressivePlan | null {
  for (let offset = 1; offset <= AGGRESSIVE_SIGNAL_BARS; offset += 1) {
    const plan = ignitionAt(closed, closed.length - offset, trend);
    if (plan) return plan;
  }
  return null;
}

/** Full book only on an extreme volume burst; otherwise 75%. Risk caps still apply. */
export function aggressiveAllocationPct(relativeVolume: number) {
  return relativeVolume >= 6 ? 1 : 0.75;
}
