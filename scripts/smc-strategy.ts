/** SMC v5: a 15m liquidity sweep and reclaim inside an established trend.
 * A 10k-event study (2026-06 to 2026-10, 51 pairs) found the v4 filters
 * counterproductive: discount-zone, Fibonacci, deeper sweeps, RVOL >= 1.2 and
 * large CHoCH bodies all lowered results, as did the buy-stop entry. v5 keeps
 * the sweep + reclaim, requires 15m/4H trend alignment, and enters on a limit
 * at the middle of the reclaim candle. As with momentum, winners must run:
 * exits at 3R with no breakeven move (7-day time stop) beat 1.5R/2R and
 * breakeven variants monotonically. Backtest (120 days, 0.3% fee/side):
 * v4 -0.20R (223 trades) -> v5 +0.11R (632 trades, CI95 -0.01..+0.25),
 * positive in both halves (+0.07R / +0.16R). */
import { ema, type OHLCV } from '../lib/indicators.js';
import { stopForRiskBand, targetForNetReward, validNetPlan } from './trading-math.js';

export const SMC_STRATEGY_VERSION = 'smc-v5';
const SWEEP_LOOKBACK = 7;
const MAX_RECLAIM_BODY_ATR = 1.08;
export const SMC_REWARD_MULTIPLE = 3;
export const SMC_TIME_STOP_HOURS = 168;
export const SMC_ORDER_TTL_HOURS = 3;

export interface SmcContext {
  /** Closed 15m bars, oldest first; the last bar is the reclaim (CHoCH) candle. */
  closed: OHLCV[];
  ema9: number; ema21: number; atr: number;
  fourHourClose: number; fourHourEma21: number;
}
export interface SmcPlan { entryLow: number; entryHigh: number; stop: number; target: number; sweepLow: number }

export function smcPullbackPlan(context: SmcContext): SmcPlan | null {
  const { closed, atr } = context;
  if (closed.length < 60 || !(atr > 0)) return null;
  const reclaim = closed.at(-1)!; const sweep = closed.at(-2)!;
  const window = closed.slice(-(SWEEP_LOOKBACK + 2), -2);
  const swept = sweep.low < Math.min(...window.map((bar) => bar.low));
  const reclaimed = reclaim.close > sweep.high && reclaim.close > reclaim.open;
  if (!swept || !reclaimed) return null;
  const ema50 = ema(closed.map((bar) => bar.close), 50).at(-1)!;
  const trendAligned = context.ema9 > context.ema21 && reclaim.close > ema50 && context.fourHourClose > context.fourHourEma21;
  if (!trendAligned || Math.abs(reclaim.close - reclaim.open) / atr >= MAX_RECLAIM_BODY_ATR) return null;
  const entryHigh = (reclaim.high + reclaim.low) / 2;
  const entryLow = entryHigh - atr * 0.15;
  const stop = stopForRiskBand(entryHigh, Math.min(sweep.low - atr * 0.15, entryHigh - atr * 1.2), atr);
  const target = targetForNetReward(entryHigh, stop, SMC_REWARD_MULTIPLE);
  if (!validNetPlan(entryHigh, stop, target, SMC_REWARD_MULTIPLE)) return null;
  return { entryLow, entryHigh, stop, target, sweepLow: sweep.low };
}
