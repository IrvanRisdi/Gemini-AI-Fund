import assert from 'node:assert/strict';
import test from 'node:test';
import { netRewardRisk, stopForRiskBand, targetForNetReward, validNetPlan } from './trading-math.ts';

test('stop risk is kept inside the configured 3-5 percent band', () => {
  assert.equal(stopForRiskBand(100, 99, 1), 97);
  assert.equal(stopForRiskBand(100, 96, 2), 96);
  assert.equal(stopForRiskBand(100, 90, 7), 95);
});

test('target produces the requested reward/risk after both fees', () => {
  const entry = 100;
  const stop = 97;
  const target = targetForNetReward(entry, stop, 1.5);
  const plan = netRewardRisk(entry, stop, target);

  assert.ok(Math.abs(plan.multiple - 1.5) < 1e-9);
  assert.equal(validNetPlan(entry, stop, target, 1.5), true);
  assert.ok((target - entry) / entry > 0.06);
});

test('longer breakout target produces 2.5R net', () => {
  const entry = 1_000_000;
  const stop = 950_000;
  const target = targetForNetReward(entry, stop, 2.5);

  assert.ok(Math.abs(netRewardRisk(entry, stop, target).multiple - 2.5) < 1e-9);
  assert.equal(validNetPlan(entry, stop, target, 2.5), true);
});
