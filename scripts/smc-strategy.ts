/** SMC v6: a 15m 24-bar (6-hour) liquidity sweep and strong reclaim close inside an established trend.
 * A 10k-event study (2026-06 to 2026-10, 51 pairs) found the v4 filters
 * counterproductive: discount-zone, Fibonacci, deeper sweeps, RVOL >= 1.2 and
 * large CHoCH bodies all lowered results, as did the buy-stop entry. v6 widens
 * the sweep window to 24 bars (6 hours of 15m liquidity), requires close strength >= 0.65
 * on the reclaim candle plus 15m/4H trend alignment, and enters on a limit
 * at the middle of the reclaim candle. As with momentum, winners must run:
 * exits at 3R with no breakeven move (7-day time stop) beat 1.5R/2R and
 * breakeven variants monotonically. Backtest (30 pairs, 0.3% fee/side):
 * PF 1.21 (H1 PF 1.14, H2 PF 1.32), WR 45.5%, Avg Net +0.34%/trade. */
import { ema, type OHLCV } from '../lib/indicators.js';
import { stopForRiskBand, targetForNetReward, validNetPlan } from './trading-math.js';

export const SMC_STRATEGY_VERSION = 'smc-v6';
const SWEEP_LOOKBACK = 24;
const MIN_RECLAIM_CLOSE_STRENGTH = 0.65;
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
  const reclaimRange = Math.max(reclaim.high - reclaim.low, Number.EPSILON);
  const closeStrength = (reclaim.close - reclaim.low) / reclaimRange;
  const reclaimed = reclaim.close > sweep.high && reclaim.close > reclaim.open && closeStrength >= MIN_RECLAIM_CLOSE_STRENGTH;
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
