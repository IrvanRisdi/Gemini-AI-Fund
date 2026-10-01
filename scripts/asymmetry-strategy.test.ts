import assert from 'node:assert/strict';
import test from 'node:test';
import { btcFilterLevels, buildFeed, draftPullback, scoreCoin, selectFinalists, technicals, type Candle, type MarketCoin, type ScreenRow } from './asymmetry-strategy.ts';
import { journalCandidates } from './asymmetry-journal.ts';

const coin = (overrides: Partial<MarketCoin> = {}): MarketCoin => ({
  id: 'aerodrome-finance', symbol: 'aero', name: 'Aerodrome', current_price: 0.82, market_cap: 700e6,
  fully_diluted_valuation: 1_000e6, price_change_percentage_30d_in_currency: 20, ath_change_percentage: -60, ...overrides,
});

test('scores valuation, growth, durability, dilution, and crowding like screen.py', () => {
  // MC/HR = 700M / (12.5M * 365/30) ~ 4.6x; growth +25%; run-rate 1.0; FDV/MC 1.43; +20% 30d.
  const row = scoreCoin(coin(), { hr30: 12.5e6, hrPrev30: 10e6, hr1y: 152.125e6, rev30: 12.5e6 })!;
  assert.equal(row.ticker, 'AERO');
  assert.ok(Math.abs(row.mcHr - 4.6) < 0.05);
  assert.deepEqual(row.parts, { val: 88, gro: 50, dur: 100, dil: 79, crw: 100 });
  assert.equal(row.score, 83); // same inputs through screen.py: 83.0
  assert.deepEqual(row.flags, []);
});

test('drops stablecoins, small caps, and tokens without meaningful holder revenue', () => {
  const totals = { hr30: 12.5e6, hrPrev30: 10e6, hr1y: 150e6, rev30: 12.5e6 };
  assert.equal(scoreCoin(coin({ current_price: 1, price_change_percentage_30d_in_currency: 0.1 }), totals), null);
  assert.equal(scoreCoin(coin({ market_cap: 50e6 }), totals), null);
  assert.equal(scoreCoin(coin(), { ...totals, hr30: 0.3e6 }), null);
});

function row(ticker: string, score: number, flags: string[] = [], mcHr = 10): ScreenRow {
  return { id: ticker, ticker, name: ticker, category: null, price: 1, mc: 1e9, fdv: 1e9, hrAnn: 1e8, mcHr, hrGrowth: 0, runRate: 1, chg30d: 0, score, parts: { val: 0, gro: 0, dur: 0, dil: 0, crw: 0 }, flags };
}

test('selects finalists by score with explicit exclusions and a quota', () => {
  const rows = [row('AERO', 84), row('BONK', 79, ['lonjakan']), row('CC', 70), row('L1', 90, [], 400), row('UNI', 54), ...['A', 'B', 'C', 'D', 'E', 'F'].map((t, i) => row(t, 60 - i, ['HR kecil']))];
  const { finalists, rejected } = selectFinalists(rows, new Set(['aero', 'bonk', 'uni', 'a', 'b', 'c', 'd', 'e', 'f']));
  assert.deepEqual(finalists.map((item) => item.ticker), ['AERO', 'A', 'B', 'C', 'D', 'E']);
  const reason = (ticker: string) => rejected.find((item) => item.ticker === ticker)?.reason;
  assert.match(reason('BONK')!, /lonjakan/);
  assert.match(reason('CC')!, /Binance/);
  assert.match(reason('UNI')!, /skor/);
  assert.match(reason('F')!, /kuota/);
  assert.equal(reason('L1'), undefined, 'MC/HR above 150x never reaches the shortlist');
});

function trendCandles(count = 260): Candle[] {
  // Steady uptrend with a 10-bar wave so pivots, EMAs, and fib levels exist.
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index * 0.5 + 6 * Math.sin(index / 1.6);
    return { timestamp: index * 86_400_000, open: close - 1, high: close + 2, low: close - 2, close, volume: 1_000 };
  });
}

test('drafts a pullback zone below price with stop below the zone and targets above', () => {
  const t = technicals(trendCandles());
  const draft = draftPullback(t);
  assert.ok(draft.entry[0] <= draft.entry[1] && draft.entry[1] < t.close);
  assert.ok(draft.stop < draft.entry[0]);
  assert.ok(draft.targets.every((target) => target > t.close));
});

test('BTC filter keeps red at or below green', () => {
  const levels = btcFilterLevels(trendCandles());
  assert.ok(levels.redBelow <= levels.greenAbove);
});

test('the generated feed is accepted by the asymmetry agent', () => {
  const now = new Date('2026-10-01T01:00:00Z');
  const candles = trendCandles();
  const feed = buildFeed({ now, reportDate: '2026-10-01', btcCandles: candles, finalists: [{ row: row('AERO', 84), candles }] });
  const scan = journalCandidates(feed, { now, pricesUsdt: { btc_usdt: 1e9, aero_usdt: candles.at(-1)!.close }, strategyVersion: 'v' });
  assert.equal(scan.status, 'active');
  assert.equal(feed.assets[0]!.score, 8.4);
  assert.equal(scan.decisions.length, 1);
});
