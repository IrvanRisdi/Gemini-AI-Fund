import assert from 'node:assert/strict';
import test from 'node:test';
import { CORE_PAIR_IDS, selectUniverse } from './coin-universe.ts';

test('keeps core, ZEC, and active campaign pairs before adding liquid markets', () => {
  const result = selectUniverse(
    [
      { pair: 'foo_idr', volumeIdr: 2_000_000_000 },
      { pair: 'bar_idr', volumeIdr: 1_000_000_000 },
    ],
    ['rareidr'],
    CORE_PAIR_IDS.length + 3,
  );
  assert.equal(result.some((item) => item.pair === 'zecidr' && item.source === 'kraken'), true);
  assert.equal(result.some((item) => item.pair === 'rareidr' && item.selectedBecause === 'open-or-pending'), true);
  assert.equal(result.some((item) => item.pair === 'fooidr' && item.selectedBecause === 'liquidity'), true);
});

test('excludes stablecoin bases from dynamic liquidity additions', () => {
  const result = selectUniverse([{ pair: 'usdt_idr', volumeIdr: 99_000_000_000 }], [], 50);
  assert.equal(result.some((item) => item.pair === 'usdtidr'), false);
});
