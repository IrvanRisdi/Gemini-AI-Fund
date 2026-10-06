import assert from 'node:assert/strict';
import test from 'node:test';
import type { OHLCV } from '../lib/indicators.ts';
import { smcPullbackPlan, type SmcContext } from './smc-strategy.ts';
import { netRewardRisk } from './trading-math.ts';

/** Rising 15m trend, a sweep below the prior 7 lows, then a reclaim candle. */
function context(overrides: { sweepLow?: number; reclaim?: Partial<OHLCV>; ema9?: number; fourHourClose?: number } = {}): SmcContext {
  const closed: OHLCV[] = Array.from({ length: 70 }, (_, index) => {
    const close = 100 + index * 0.05;
    return { timestamp: index * 900_000, open: close - 0.1, high: close + 0.2, low: close - 0.2, close, volume: 1_000 };
  });
  const last = closed.at(-1)!;
  closed.push({ timestamp: last.timestamp + 900_000, open: last.close, high: last.close + 0.05, low: overrides.sweepLow ?? last.close - 1, close: last.close - 0.3, volume: 1_500 });
  const sweep = closed.at(-1)!;
  closed.push({ timestamp: sweep.timestamp + 900_000, open: sweep.close, high: sweep.high + 0.3, low: sweep.close - 0.05, close: sweep.high + 0.2, volume: 1_200, ...overrides.reclaim });
  return { closed, ema9: overrides.ema9 ?? 103.2, ema21: 103, atr: 0.6, fourHourClose: overrides.fourHourClose ?? 103.5, fourHourEma21: 101 };
}

test('plans a mid-reclaim limit entry with a 3R target after a sweep and reclaim in trend', () => {
  const ctx = context();
  const plan = smcPullbackPlan(ctx)!;
  assert.ok(plan);
  const reclaim = ctx.closed.at(-1)!;
  assert.equal(plan.entryHigh, (reclaim.high + reclaim.low) / 2);
  assert.ok(plan.entryLow < plan.entryHigh);
  assert.ok(plan.stop < plan.sweepLow);
  assert.ok(Math.abs(netRewardRisk(plan.entryHigh, plan.stop, plan.target).multiple - 3) < 1e-9);
});

test('needs a real sweep of the prior seven lows and a bullish reclaim close', () => {
  const ctx = context();
  assert.equal(smcPullbackPlan(context({ sweepLow: ctx.closed.at(-3)!.low + 0.05 })), null);
  const sweepHigh = ctx.closed.at(-2)!.high;
  assert.equal(smcPullbackPlan(context({ reclaim: { close: sweepHigh - 0.01 } })), null);
});

test('drops the trade when the 15m or 4H trend disagrees', () => {
  assert.equal(smcPullbackPlan(context({ ema9: 102.9 })), null);
  assert.equal(smcPullbackPlan(context({ fourHourClose: 100.5 })), null);
});

test('refuses to trade an oversized reclaim body (chasing)', () => {
  const ctx = context();
  const sweep = ctx.closed.at(-2)!;
  assert.equal(smcPullbackPlan(context({ reclaim: { open: sweep.close, close: sweep.close + 0.7, high: sweep.close + 0.75 } })), null);
});
