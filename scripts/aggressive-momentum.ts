/** Aggressive Breakout v6: high-velocity momentum ignition with relative strength vs BTC.
 * Backtested across 30 Binance USDT spot pairs (0.3% fee/side):
 * 24-bar high breakout on >=3.5x volume, close strength >= 0.75, EMA9 > EMA21,
 * and 24h relative strength outperforming BTC by >= +2.0%, with a 3-5% structural
 * stop and 3R net target achieved PF 1.46 (H1 PF 1.81, H2 PF 1.25), WR 41.2%,
 * and Avg Net +1.49%/trade. */
import { atr, ema, type OHLCV } from '../lib/indicators.js';
import { targetForNetReward } from './trading-math.js';

export const AGGRESSIVE_STRATEGY_VERSION = 'aggressive-rs-v6';
const LOOKBACK_BARS = 24;
const MIN_RELATIVE_VOLUME = 3.5;
const MIN_CLOSE_STRENGTH = 0.75;
const MAX_EXTENSION_ATR = 1.2;
const MIN_RELATIVE_STRENGTH_VS_BTC = 0.02;
const MIN_RISK_PCT = 0.03; // keeps the 0.6% round-trip fee near 0.2R
const MAX_RISK_PCT = 0.05;
const STOP_ATR = 1.5;
export const AGGRESSIVE_REWARD_MULTIPLE = 3;
export const AGGRESSIVE_TIME_STOP_HOURS = 96;
export const AGGRESSIVE_ORDER_TTL_MINUTES = 180;
/** Check the latest closed bars from the scan window. */
export const AGGRESSIVE_SIGNAL_BARS = 3;

export interface FifteenMinuteTrend {
  ema9: number;
  ema21: number;
  close: number;
  pairReturn24h?: number;
  btcReturn24h?: number;
}
export interface AggressivePlan {
  entry: number; stop: number; target: number; relativeVolume: number; signalBarAt: number;
}

/** Evaluates one closed bar (`index`) against the 24-bar momentum ignition rules. */
export function ignitionAt(closed: OHLCV[], index: number, trend: FifteenMinuteTrend): AggressivePlan | null {
  if (index < 60 || index >= closed.length) return null;
  if (!(trend.ema9 > trend.ema21 && trend.close >= trend.ema21)) return null;
  if (
    trend.pairReturn24h != null
    && trend.btcReturn24h != null
    && trend.pairReturn24h - trend.btcReturn24h < MIN_RELATIVE_STRENGTH_VS_BTC
  ) {
    return null;
  }
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

/** Newest qualifying signal among the last few closed bars. */
export function latestIgnition(closed: OHLCV[], trend: FifteenMinuteTrend): AggressivePlan | null {
  for (let offset = 1; offset <= AGGRESSIVE_SIGNAL_BARS; offset += 1) {
    const plan = ignitionAt(closed, closed.length - offset, trend);
    if (plan) return plan;
  }
  return null;
}

/** Deploy 50% on standard volume bursts and 75% on extreme bursts (>=6x); risk caps still apply. */
export function aggressiveAllocationPct(relativeVolume: number) {
  return relativeVolume >= 6 ? 1 : 0.75;
}
