import assert from 'node:assert/strict';
import test from 'node:test';
import { JOURNAL_AGENT, journalCandidates, staleJournalOrder, type JournalFeed } from './asymmetry-journal.ts';
import { validNetPlan } from './trading-math.ts';

const NOW = new Date('2026-10-01T04:00:00Z');
const OPTIONS = { now: NOW, strategyVersion: 'recovery-v4-usdt' };

// Levels mirror the hand-written journal report of 2026-10-01.
function feed(overrides: Partial<JournalFeed> = {}): JournalFeed {
  return {
    version: 1, source: 'asymmetry-screen', reportDate: '2026-10-01', generatedAt: '2026-10-01T01:27:00Z',
    btcFilter: { greenAbove: 76000, redBelow: 75000 },
    assets: [
      { ticker: 'AERO', score: 7, verdict: 'Kandidat utama', setups: [
        { name: 'A · Retest breakout', kind: 'pullback', primary: true, entry: [0.7, 0.74], stop: 0.61, targets: [0.93, 1.05] },
        { name: 'B · Breakout', kind: 'breakout', trigger: 0.74, entry: [0.74, 0.76], stop: 0.65, targets: [0.81, 1.0] },
      ] },
      { ticker: 'UNI', score: 6, verdict: 'Tunggu pullback', setups: [
        { name: 'A · Pullback', kind: 'pullback', primary: true, entry: [8.2, 8.7], stop: 7.3, targets: [10.9, 11.6] },
      ] },
      { ticker: 'CC', score: 6, verdict: 'Di zona retest', setups: [
        { name: 'A · Retest atap range', kind: 'pullback', primary: true, entry: [0.124, 0.128], stop: 0.112, targets: [0.15, 0.17] },
      ] },
      { ticker: 'HYPE', score: null, verdict: 'Crowded · bukan kandidat', setups: [
        { name: 'Trailing stop', kind: 'trail', entry: null, stop: 84, targets: [] },
      ] },
    ],
    ...overrides,
  };
}

const PRICES = { btc_usdt: 83_600, aero_usdt: 0.8179, uni_usdt: 8.888 };

test('creates limit candidates from primary setups of scored Binance-listed finalists', () => {
  const scan = journalCandidates(feed(), { ...OPTIONS, pricesUsdt: PRICES });
  assert.equal(scan.status, 'active');
  assert.equal(scan.btcFilter, 'green');
  assert.deepEqual(scan.candidates.map((item) => item.pair), ['aeroidr', 'uniidr']);
  const aero = scan.candidates[0]!;
  assert.equal(aero.agent, JOURNAL_AGENT);
  assert.equal(aero.type, 'limit');
  assert.deepEqual([aero.entryLow, aero.entryHigh, aero.stopPrice], [0.7, 0.74, 0.61]);
  assert.equal(aero.strategyVersion, 'recovery-v4-usdt');
  for (const candidate of scan.candidates) assert.ok(validNetPlan(candidate.entryHigh, candidate.stopPrice, candidate.targetPrice, candidate.rewardMultiple));
});

test('uses the first journal target that clears 1.5R net after fees', () => {
  const aero = journalCandidates(feed(), { ...OPTIONS, pricesUsdt: PRICES }).candidates.find((item) => item.pair === 'aeroidr')!;
  // 0.93 is only ~1.4R net from 0.74 with stop 0.61, so the plan uses 1.05.
  assert.equal(aero.targetPrice, 1.05);
});

test('explains skipped finalists instead of dropping them silently', () => {
  const decisions = journalCandidates(feed(), { ...OPTIONS, pricesUsdt: PRICES }).decisions;
  assert.match(decisions.find((item) => item.ticker === 'CC')!.reason, /Binance/);
  assert.match(decisions.find((item) => item.ticker === 'HYPE')!.reason, /skor kosong/);
});

test('blocks new entries unless the journal BTC filter is green', () => {
  const yellow = journalCandidates(feed(), { ...OPTIONS, pricesUsdt: { ...PRICES, btc_usdt: 75_500 } });
  const red = journalCandidates(feed(), { ...OPTIONS, pricesUsdt: { ...PRICES, btc_usdt: 74_000 } });
  assert.deepEqual([yellow.status, yellow.btcFilter, yellow.candidates.length], ['blocked', 'yellow', 0]);
  assert.deepEqual([red.status, red.btcFilter, red.candidates.length], ['blocked', 'red', 0]);
});

test('blocks a stale feed and reports a missing feed as unavailable', () => {
  const stale = journalCandidates(feed({ generatedAt: '2026-09-28T01:00:00Z' }), { ...OPTIONS, pricesUsdt: PRICES });
  assert.equal(stale.status, 'blocked');
  assert.match(stale.reason, /kedaluwarsa/);
  assert.equal(journalCandidates(null, { ...OPTIONS, pricesUsdt: PRICES }).status, 'unavailable');
});

test('does not chase a breakout that already triggered, but keeps its plan', () => {
  const breakoutFirst = feed({ assets: [{ ticker: 'PUMP', score: 5.5, verdict: 'Breakout', setups: [
    { name: 'B · Breakout 0,006', kind: 'breakout', primary: true, trigger: 0.00605, entry: [0.00605, 0.0062], stop: 0.0053, targets: [0.0075] },
  ] }] });
  const below = journalCandidates(breakoutFirst, { ...OPTIONS, pricesUsdt: { ...PRICES, pump_usdt: 0.00576 } });
  assert.deepEqual(below.candidates.map((item) => [item.type, item.entryHigh]), [['stop', 0.00605]]);
  const above = journalCandidates(breakoutFirst, { ...OPTIONS, pricesUsdt: { ...PRICES, pump_usdt: 0.0061 } });
  assert.equal(above.candidates.length, 0);
  assert.match(above.decisions[0]!.reason, /tidak mengejar/);
  // A pending stop order placed earlier must survive the trigger being crossed.
  assert.equal(staleJournalOrder(below.candidates[0]!, above), false);
});

test('withdraws pending orders when the report revises levels or the filter turns', () => {
  const scan = journalCandidates(feed(), { ...OPTIONS, pricesUsdt: PRICES });
  const order = scan.candidates.find((item) => item.pair === 'uniidr')!;
  assert.equal(staleJournalOrder(order, scan), false);
  assert.equal(staleJournalOrder({ ...order, entryHigh: 8.8 }, scan), true);
  const red = journalCandidates(feed(), { ...OPTIONS, pricesUsdt: { ...PRICES, btc_usdt: 74_000 } });
  assert.equal(staleJournalOrder(order, red), true);
  assert.equal(staleJournalOrder(order, journalCandidates(null, { ...OPTIONS, pricesUsdt: PRICES })), false);
  assert.equal(staleJournalOrder(order, journalCandidates(feed(), { ...OPTIONS, pricesUsdt: {} })), false);
});
