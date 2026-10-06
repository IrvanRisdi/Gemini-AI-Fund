import assert from 'node:assert/strict';
import test from 'node:test';
import type { OHLCV } from '../lib/indicators.ts';
import { aggressiveAllocationPct, ignitionAt, latestIgnition } from './aggressive-momentum.ts';
import { netRewardRisk } from './trading-math.ts';

const UP = { ema9: 101, ema21: 100, close: 102 };

/** 80 gently rising 5m bars, then an optional ignition bar. */
function bars(ignition?: Partial<OHLCV>): OHLCV[] {
  const out: OHLCV[] = Array.from({ length: 80 }, (_, index) => {
    const close = 100 + index * 0.01;
    return { timestamp: index * 300_000, open: close - 0.05, high: close + 0.1, low: close - 0.1, close, volume: 1_000 };
  });
  if (ignition) {
    const base = out.at(-1)!;
    out.push({ timestamp: base.timestamp + 300_000, open: base.close, high: base.close + 0.22, low: base.close - 0.02, close: base.close + 0.2, volume: 5_000, ...ignition });
  }
  return out;
}

test('fires on a 2-hour high broken by a strong close on 4x volume', () => {
  const series = bars({});
  const plan = ignitionAt(series, series.length - 1, UP)!;
  assert.ok(plan);
  assert.ok(Math.abs(plan.entry - series.at(-1)!.high * 1.0003) < 1e-9);
  assert.equal(plan.relativeVolume, 5);
  // Stop is at least 3% away so the round-trip fee stays a small fraction of R.
  assert.ok((plan.entry - plan.stop) / plan.entry >= 0.03 - 1e-12);
  assert.ok(Math.abs(netRewardRisk(plan.entry, plan.stop, plan.target).multiple - 3) < 1e-9);
});

test('rejects weak volume, a weak close, and a misaligned 15m trend', () => {
  const weakVolume = bars({ volume: 3_000 });
  assert.equal(ignitionAt(weakVolume, weakVolume.length - 1, UP), null);
  // Closes above the 2-hour high but in the lower third of a long-wicked bar.
  const weakClose = bars({ high: 101.4 });
  assert.equal(ignitionAt(weakClose, weakClose.length - 1, UP), null);
  const series = bars({});
  assert.equal(ignitionAt(series, series.length - 1, { ema9: 99, ema21: 100, close: 102 }), null);
});

test('does not chase a bar that closes far beyond the breakout level', () => {
  const extended = bars({ high: 103, close: 102.95 });
  assert.equal(ignitionAt(extended, extended.length - 1, UP), null);
});

test('only signals from the last three closed bars of a 15-minute scan', () => {
  const series = bars({});
  const quiet = (offset: number): OHLCV => ({ ...series.at(-1)!, timestamp: series.at(-1)!.timestamp + offset * 300_000, open: 100.8, high: 100.85, low: 100.75, close: 100.8, volume: 900 });
  assert.ok(latestIgnition([...series, quiet(1), quiet(2)], UP));
  assert.equal(latestIgnition([...series, quiet(1), quiet(2), quiet(3)], UP), null);
});

test('deploys the full book only on an extreme volume burst', () => {
  assert.equal(aggressiveAllocationPct(4.5), 0.75);
  assert.equal(aggressiveAllocationPct(6), 1);
});
