import type { OHLCV } from './indicators';

export type BreakoutState =
  | 'breakout-up-confirmed'
  | 'retesting-up'
  | 'failed-breakout-up'
  | 'breakout-down-confirmed'
  | 'retesting-down'
  | 'failed-breakout-down'
  | 'no-breakout';

export interface BreakoutSnapshot {
  state: BreakoutState;
  level: number;
  breakoutIndex: number;
  breakoutVolRatio: number;
  barsSinceBreakout: number;
  retestDistancePct: number | null;
}

const RETEST_TOLERANCE_PCT = 0.5; // within 0.5% of the broken level counts as a retest
const LOOKBACK_BARS = 12; // how far back to look for the breakout candle itself

/**
 * Detects a structural break of the prior 20-bar high/low, then classifies
 * whether price has since pulled back to retest that level (and held, or
 * failed back through it) — the classic breakout-and-retest pattern.
 */
export function computeBreakout(candles: OHLCV[]): BreakoutSnapshot | null {
  const closed = candles.slice(0, -1);
  if (closed.length < 25) return null;

  const last = closed[closed.length - 1];

  // Scan backwards for the most recent bar whose close cleared the 20-bar
  // range that existed *before* it (so each candidate uses its own trailing window).
  for (let i = closed.length - 1; i >= Math.max(20, closed.length - LOOKBACK_BARS); i--) {
    const window = closed.slice(i - 20, i);
    if (window.length < 20) continue;
    const resistance = Math.max(...window.map((c) => c.high));
    const support = Math.min(...window.map((c) => c.low));
    const bar = closed[i];
    const avgVol = window.reduce((a, c) => a + c.volume, 0) / window.length;
    const volRatio = avgVol > 0 ? bar.volume / avgVol : 0;

    const brokeUp = bar.close > resistance;
    const brokeDown = bar.close < support;
    if (!brokeUp && !brokeDown) continue;

    const level = brokeUp ? resistance : support;
    const barsSinceBreakout = closed.length - 1 - i;
    const retestDistancePct = (Math.abs(last.close - level) / level) * 100;
    const withinRetest = retestDistancePct <= RETEST_TOLERANCE_PCT;

    if (brokeUp) {
      if (withinRetest) {
        // Failed if the current close is actually back under the level.
        return last.close < level
          ? { state: 'failed-breakout-up', level, breakoutIndex: i, breakoutVolRatio: volRatio, barsSinceBreakout, retestDistancePct }
          : { state: 'retesting-up', level, breakoutIndex: i, breakoutVolRatio: volRatio, barsSinceBreakout, retestDistancePct };
      }
      if (last.close < level) {
        return { state: 'failed-breakout-up', level, breakoutIndex: i, breakoutVolRatio: volRatio, barsSinceBreakout, retestDistancePct };
      }
      return { state: 'breakout-up-confirmed', level, breakoutIndex: i, breakoutVolRatio: volRatio, barsSinceBreakout, retestDistancePct };
    } else {
      if (withinRetest) {
        return last.close > level
          ? { state: 'failed-breakout-down', level, breakoutIndex: i, breakoutVolRatio: volRatio, barsSinceBreakout, retestDistancePct }
          : { state: 'retesting-down', level, breakoutIndex: i, breakoutVolRatio: volRatio, barsSinceBreakout, retestDistancePct };
      }
      if (last.close > level) {
        return { state: 'failed-breakout-down', level, breakoutIndex: i, breakoutVolRatio: volRatio, barsSinceBreakout, retestDistancePct };
      }
      return { state: 'breakout-down-confirmed', level, breakoutIndex: i, breakoutVolRatio: volRatio, barsSinceBreakout, retestDistancePct };
    }
  }

  return { state: 'no-breakout', level: last.close, breakoutIndex: -1, breakoutVolRatio: 0, barsSinceBreakout: 0, retestDistancePct: null };
}
