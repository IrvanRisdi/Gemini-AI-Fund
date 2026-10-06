#!/usr/bin/env node
/** Spot-only, multi-timeframe setup scanner. It creates pending-order
 * candidates only; execution and risk checks happen in execute-paper-trades. */
import fs from 'node:fs';
import path from 'node:path';
import { adx, atr, bollingerBands, ema, rsi, type OHLCV } from '../lib/indicators.js';
import { fetchBulkCoinPricesUsdt, fetchCoinOhlcv } from '../dashboard/lib/coin-market.js';
import { AGGRESSIVE_ORDER_TTL_MINUTES, AGGRESSIVE_REWARD_MULTIPLE, AGGRESSIVE_STRATEGY_VERSION, AGGRESSIVE_TIME_STOP_HOURS, aggressiveAllocationPct, latestIgnition } from './aggressive-momentum.js';
import { SMC_ORDER_TTL_HOURS, SMC_REWARD_MULTIPLE, SMC_STRATEGY_VERSION, SMC_TIME_STOP_HOURS, smcPullbackPlan } from './smc-strategy.js';
import { JOURNAL_FEED_PATH, journalCandidates, type JournalCandidate, type JournalFeed } from './asymmetry-journal.js';
import { discoverTradingUniverse, type UniversePair } from './coin-universe.js';
import { orderedLimitBand, stopForRiskBand, targetForNetReward, validNetPlan } from './trading-math.js';

type Owner = 'breakout-specialist' | 'aggressive-breakout-trader' | 'mean-reversion-trader' | 'smc-trader' | 'wyckoff-trader';
const COIN_STRATEGY_VERSION = 'recovery-v4-usdt';
type MarketRegime = { riskOn: boolean; close: number | null; ema21: number | null; adx: number | null; reason: string };
export interface Candidate {
  id: string; pair: string; agent: Owner; side: 'long'; quoteCurrency: 'USDT'; type: 'limit' | 'stop'; timeframe: '5m' | '15m' | '4h';
  entryLow: number; entryHigh: number; stopPrice: number; targetPrice: number; expiresAt: string;
  confirmations: string[]; reason: string; score: number; volumeRatio: number; allocationPct: number;
  rewardMultiple: number; validationStatus: 'validated' | 'research';
  strategyVersion: typeof COIN_STRATEGY_VERSION | typeof AGGRESSIVE_STRATEGY_VERSION | typeof SMC_STRATEGY_VERSION;
  /** Optional exit management carried to the position (default: no time stop, breakeven at +1.25R). */
  timeStopHours?: number; breakevenAtR?: number | null;
}
export interface PairDiagnostic {
  pair: string;
  source: UniversePair['source'];
  selectedBecause: UniversePair['selectedBecause'];
  volumeIdr24h: number;
  status: 'uptrend' | 'downtrend' | 'sideways' | 'insufficient-data';
  close: number | null;
  ema9: number | null;
  ema21: number | null;
  adx: number | null;
  relativeVolume: number | null;
  candidates: number;
}

function choppiness(candles: OHLCV[], period = 14) {
  const bars = candles.slice(-(period + 1)); if (bars.length < period + 1) return 0;
  let trueRangeSum = 0;
  for (let index = 1; index < bars.length; index += 1) {
    const bar = bars[index]!; const previousClose = bars[index - 1]!.close;
    trueRangeSum += Math.max(bar.high - bar.low, Math.abs(bar.high - previousClose), Math.abs(bar.low - previousClose));
  }
  const span = Math.max(...bars.slice(1).map((bar) => bar.high)) - Math.min(...bars.slice(1).map((bar) => bar.low));
  return span > 0 ? 100 * Math.log10(trueRangeSum / span) / Math.log10(period) : 100;
}
function metric(candles: OHLCV[]) {
  const closed = candles.slice(0, -1); if (closed.length < 55) return null;
  const closes = closed.map((c) => c.close); const last = closed.at(-1)!; const prior = closed.slice(-21, -1);
  const bands = bollingerBands(closes, 20, 2); const av = prior.reduce((s, c) => s + c.volume, 0) / prior.length;
  return { last, closes, chop: choppiness(closed), adx: adx(closed, 14).at(-1)!, ema9: ema(closes, 9).at(-1)!, ema21: ema(closes, 21).at(-1)!, rsi: rsi(closes, 14).at(-1)!, previousRsi: rsi(closes.slice(0, -1), 14).at(-1)!, atr: atr(closed, 14).at(-1)!, upper: bands.upper.at(-1)!, lower: bands.lower.at(-1)!, mid: bands.middle.at(-1)!, resistance: Math.max(...prior.map((c) => c.high)), support: Math.min(...prior.map((c) => c.low)), vol: av > 0 ? last.volume / av : 0, closed };
}
function expiry(hours: number) { return new Date(Date.now() + hours * 3_600_000).toISOString(); }

async function scanPair(universePair: UniversePair, market: MarketRegime): Promise<{ candidates: Candidate[]; diagnostic: PairDiagnostic }> {
  const pair = universePair.pair;
  const [fifteenMinute, fourHour] = await Promise.all([fetchCoinOhlcv(pair, '15m', 160), fetchCoinOhlcv(pair, '4h', 140)]);
  const one = metric(fifteenMinute); const four = metric(fourHour);
  if (!one || !four) return { candidates: [], diagnostic: { pair, source: universePair.source, selectedBecause: universePair.selectedBecause, volumeIdr24h: universePair.volumeIdr, status: 'insufficient-data', close: null, ema9: null, ema21: null, adx: null, relativeVolume: null, candidates: 0 } };
  const candidates: Candidate[] = [];
  const trendUp = four.ema9 > four.ema21 && four.last.close >= four.ema9 && four.adx >= 22;
  const liquid = one.closed.slice(-20).filter((bar) => bar.volume > 0).length >= 18 && one.atr / one.last.close <= 0.08;
  const id = (owner: Owner) => `${owner}-${pair}-${Date.now()}`;

  // Breakout: accept only a shallow retest; never park a wish-price far below market.
  const candleRange = Math.max(one.last.high - one.last.low, Number.EPSILON); const closeStrength = (one.last.close - one.last.low) / candleRange; const body = Math.abs(one.last.close - one.last.open);
  const breakoutExtension = (one.last.close - one.resistance) / one.atr;
  const aggressiveScore = Number(one.vol >= 1.5) + Number(closeStrength >= .7) + Number(body / one.atr >= .5 && body / one.atr <= 1.8) + Number(one.ema9 > one.ema21) + Number(breakoutExtension <= .75);
  // Prepare just below resistance, but retain buy-stop confirmation.
  if (market.riskOn && liquid && trendUp && one.vol >= 1.5 && one.last.close > one.resistance && aggressiveScore >= 4) {
    const entry = one.last.high * 1.0005; const structuralStop = Math.max(one.resistance - one.atr * .25, entry - 1.2 * one.atr); const stop = stopForRiskBand(entry, structuralStop, one.atr); const target = targetForNetReward(entry, stop, 2.5);
    if (validNetPlan(entry, stop, target, 2.5)) candidates.push({ id: id('breakout-specialist'), pair, agent: 'breakout-specialist', side: 'long', quoteCurrency: 'USDT', type: 'stop', timeframe: '15m', entryLow: entry, entryHigh: entry, stopPrice: stop, targetPrice: target, expiresAt: expiry(24), confirmations: ['Regime BTC 4H mendukung', 'Trend pair 4H ADX ≥ 22', `Skor breakout ${aggressiveScore}/5`, 'Entry awal 20%; tambah posisi hanya ketika harga bergerak sesuai rencana', 'Target kampanye 2,5R bersih setelah fee'], score: aggressiveScore, volumeRatio: one.vol, allocationPct: .20, rewardMultiple: 2.5, validationStatus: 'validated', strategyVersion: COIN_STRATEGY_VERSION, reason: 'Breakout 15m terkonfirmasi close di atas resistance dalam regime pasar positif.' });
  }
  // Aggressive v5 trades its own 5m momentum ignition instead of sharing the
  // 15m breakout trigger: a 2-hour high broken on >=4x volume while the 15m
  // trend agrees. Wide 3-5% stops keep fees near 0.2R; exits are 3R or 48h.
  if (market.riskOn && liquid && one.ema9 > one.ema21 && one.last.close >= one.ema21) {
    const fiveMinute = (await fetchCoinOhlcv(pair, '5m', 120)).slice(0, -1);
    const plan = latestIgnition(fiveMinute, { ema9: one.ema9, ema21: one.ema21, close: one.last.close });
    if (plan && validNetPlan(plan.entry, plan.stop, plan.target, AGGRESSIVE_REWARD_MULTIPLE)) {
      const allocationPct = aggressiveAllocationPct(plan.relativeVolume);
      candidates.push({ id: id('aggressive-breakout-trader'), pair, agent: 'aggressive-breakout-trader', side: 'long', quoteCurrency: 'USDT', type: 'stop', timeframe: '5m', entryLow: plan.entry, entryHigh: plan.entry, stopPrice: plan.stop, targetPrice: plan.target, expiresAt: new Date(Date.now() + AGGRESSIVE_ORDER_TTL_MINUTES * 60_000).toISOString(), confirmations: ['Regime BTC 4H mendukung', 'Trend 15m EMA9 > EMA21', `Close 5m menembus high 2 jam dengan volume ${plan.relativeVolume.toFixed(1)}x`, `Stop ${(((plan.entry - plan.stop) / plan.entry) * 100).toFixed(1)}% · target 3R bersih · time stop 48 jam`, `Alokasi ${(allocationPct * 100).toFixed(0)}%`], score: 5, volumeRatio: plan.relativeVolume, allocationPct, rewardMultiple: AGGRESSIVE_REWARD_MULTIPLE, validationStatus: 'research', strategyVersion: AGGRESSIVE_STRATEGY_VERSION, timeStopHours: AGGRESSIVE_TIME_STOP_HOURS, breakevenAtR: null, reason: 'Momentum ignition 5m: breakout high 2 jam dengan lonjakan volume dalam tren 15m.' });
    }
  }
  // Mean reversion is deliberately a ranging-market strategy, not a
  // trend-pullback strategy. ADX/EMA compression identifies the regime;
  // Choppiness, Bollinger and RSI locate a controlled lower-range reversal.
  const emaSpread4h = Math.abs(four.ema9 - four.ema21) / four.ema21;
  const range4h = four.adx <= 24 && emaSpread4h <= .018 && four.chop >= 52;
  const range15m = one.chop >= 50 && (one.resistance - one.support) / one.last.close <= .12;
  const nearLowerBand = one.last.low <= one.lower * 1.006 && one.last.close <= one.mid;
  const rsiReclaim = one.rsi <= 48 && (one.previousRsi <= 42 || one.rsi >= one.previousRsi);
  const containedVolume = one.vol >= .4 && one.vol <= 2.2;
  const meanScore = Number(range4h) + Number(range15m) + Number(nearLowerBand) + Number(rsiReclaim) + Number(one.last.close > one.last.open) + Number(containedVolume);
  const pairNotBearish = four.ema9 >= four.ema21 * .995 && four.last.close >= four.ema21 * .985;
  if (market.riskOn && liquid && pairNotBearish && range4h && range15m && nearLowerBand && rsiReclaim && containedVolume && meanScore >= 6) {
    const entry = Math.min(one.last.close, one.lower + one.atr * .15);
    const band = orderedLimitBand(entry, one.atr, one.lower - one.atr * .20, entry);
    const structuralStop = Math.min(one.support - one.atr * .25, band.low - one.atr * .35);
    const stop = stopForRiskBand(band.high, structuralStop, one.atr);
    // The mean/middle Bollinger band is the natural first exit in a range.
    const target = Math.max(one.mid, targetForNetReward(band.high, stop, 2));
    if (validNetPlan(band.high, stop, target, 2)) candidates.push({ id: id('mean-reversion-trader'), pair, agent: 'mean-reversion-trader', side: 'long', quoteCurrency: 'USDT', type: 'limit', timeframe: '15m', entryLow: band.low, entryHigh: band.high, stopPrice: stop, targetPrice: target, expiresAt: expiry(8), confirmations: ['Regime BTC tidak bearish', 'Regime pair ranging lengkap', 'Reversal di Bollinger bawah', 'RSI reclaim + candle bullish + volume terkendali', `Skor range-reversion ${meanScore}/6`], score: meanScore, volumeRatio: one.vol, allocationPct: .25, rewardMultiple: 2, validationStatus: 'research', strategyVersion: COIN_STRATEGY_VERSION, reason: 'Range mean reversion selektif: seluruh enam konfirmasi wajib lolos, target 2R bersih.' });
  }
  // SMC and Wyckoff remain separate research strategies.

  // Phase-D Sign of Strength / Last Point of Support is used instead of trying
  // to catch every Phase-C spring in a spot-only market.
  const wyckoffHistory = one.closed.slice(-41, -1);
  if (wyckoffHistory.length >= 24) {
    const rangeLow = Math.min(...wyckoffHistory.map((bar) => bar.low));
    const rangeHigh = Math.max(...wyckoffHistory.map((bar) => bar.high));
    const ranging4h = four.adx >= 18 && four.adx < 30 && four.ema9 >= four.ema21 && Math.abs(four.ema9 - four.ema21) / four.ema21 < .03;
    const sosScore = Number(one.last.close > rangeHigh) + Number(one.vol >= 1.5) + Number(closeStrength >= .7) + Number(body >= one.atr * .5) + Number((rangeHigh - rangeLow) / one.atr <= 7);
    // A real retest band avoids the previous zero-width limit at rangeHigh.
    const entry = rangeHigh; const band = orderedLimitBand(entry, one.atr, rangeHigh - one.atr * .3, one.last.close); const structuralStop = Math.min(rangeHigh - one.atr * 1.1, band.low - one.atr * .7); const stop = stopForRiskBand(band.high, structuralStop, one.atr); const target = targetForNetReward(band.high, stop, 2);
    if (market.riskOn && liquid && one.last.close > rangeHigh && ranging4h && sosScore >= 5 && validNetPlan(band.high, stop, target, 2)) {
      candidates.push({ id: id('wyckoff-trader'), pair, agent: 'wyckoff-trader', side: 'long', quoteCurrency: 'USDT', type: 'limit', timeframe: '15m', entryLow: band.low, entryHigh: band.high, stopPrice: stop, targetPrice: target, expiresAt: expiry(8), confirmations: ['Regime BTC 4H mendukung', 'Wyckoff phase D / SoS lengkap', `Skor ${sosScore}/5`, 'Retest range high dalam zona 0,3 ATR'], score: sosScore, volumeRatio: one.vol, allocationPct: .25, rewardMultiple: 2, validationStatus: 'research', strategyVersion: COIN_STRATEGY_VERSION, reason: 'Wyckoff SoS selektif: lima konfirmasi wajib, entry hanya pada retest breakout valid.' });
    }
  }
  // SMC v5: sweep of the 7-bar low reclaimed on the next close, traded only
  // with the 15m and 4H trend; limit entry mid-reclaim, 3R target, no breakeven.
  const smc = market.riskOn && liquid ? smcPullbackPlan({ closed: one.closed, ema9: one.ema9, ema21: one.ema21, atr: one.atr, fourHourClose: four.last.close, fourHourEma21: four.ema21 }) : null;
  if (smc) {
    candidates.push({ id: id('smc-trader'), pair, agent: 'smc-trader', side: 'long', quoteCurrency: 'USDT', type: 'limit', timeframe: '15m', entryLow: smc.entryLow, entryHigh: smc.entryHigh, stopPrice: smc.stop, targetPrice: smc.target, expiresAt: expiry(SMC_ORDER_TTL_HOURS), confirmations: ['Regime BTC 4H mendukung', 'Sweep low 7 candle lalu reclaim di close berikutnya', 'Tren 15m (EMA9 > EMA21, di atas EMA50) dan 4H di atas EMA21', 'Entry limit di tengah candle reclaim · target 3R bersih · tanpa breakeven'], score: 4, volumeRatio: one.vol, allocationPct: .25, rewardMultiple: SMC_REWARD_MULTIPLE, validationStatus: 'research', strategyVersion: SMC_STRATEGY_VERSION, timeStopHours: SMC_TIME_STOP_HOURS, breakevenAtR: null, reason: 'SMC v5: sweep likuiditas kecil yang langsung direbut kembali dalam tren naik; entry pada retracement, bukan mengejar candle reclaim.' });
  }
  const status: PairDiagnostic['status'] = four.ema9 > four.ema21 && four.last.close >= four.ema9
    ? 'uptrend'
    : four.ema9 < four.ema21 && four.last.close <= four.ema9
      ? 'downtrend'
      : 'sideways';
  return {
    candidates,
    diagnostic: {
      pair,
      source: universePair.source,
      selectedBecause: universePair.selectedBecause,
      volumeIdr24h: universePair.volumeIdr,
      status,
      close: four.last.close,
      ema9: four.ema9,
      ema21: four.ema21,
      adx: four.adx,
      relativeVolume: one.vol,
      candidates: candidates.length,
    },
  };
}

async function mapLimit<T, R>(items: T[], concurrency: number, callback: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = { status: 'fulfilled', value: await callback(items[index]!) }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function readMarketRegime(): Promise<MarketRegime> {
  try {
    const candles = await fetchCoinOhlcv('btcidr', '4h', 140);
    const btc = metric(candles);
    if (!btc) return { riskOn: false, close: null, ema21: null, adx: null, reason: 'Data BTC 4H belum cukup' };
    const riskOn = btc.ema9 >= btc.ema21 && btc.last.close >= btc.ema21 && btc.adx >= 18;
    return {
      riskOn,
      close: btc.last.close,
      ema21: btc.ema21,
      adx: btc.adx,
      reason: riskOn ? 'BTC 4H bullish dan ADX ≥ 18' : 'BTC 4H belum memenuhi EMA9/21, harga, dan ADX',
    };
  } catch (error) {
    return { riskOn: false, close: null, ema21: null, adx: null, reason: `Regime BTC gagal dibaca: ${String(error)}` };
  }
}

function activeLedgerPairs(): string[] {
  const ledgerPath = path.join(process.cwd(), '.desk', 'paper-ledger.json');
  try {
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as { agents?: Record<string, { positions?: Record<string, unknown>; pendingOrders?: Array<{ pair?: string; status?: string }> }> };
    return [...new Set(Object.values(ledger.agents ?? {}).flatMap((book) => [
      ...Object.keys(book.positions ?? {}),
      ...(book.pendingOrders ?? []).filter((order) => order.status === 'pending').map((order) => order.pair ?? ''),
    ]).filter(Boolean))];
  } catch {
    return [];
  }
}

function readJournalFeed(): JournalFeed | null {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), JOURNAL_FEED_PATH), 'utf8')) as JournalFeed; }
  catch { return null; }
}

// The journal agent ignores the BTC 4H regime above: its research applies its
// own BTC filter, so it is evaluated independently of the technical agents.
async function scanAsymmetryJournal(errors: string[]) {
  try {
    return journalCandidates(readJournalFeed(), { now: new Date(), pricesUsdt: await fetchBulkCoinPricesUsdt(), strategyVersion: COIN_STRATEGY_VERSION });
  } catch (error) {
    errors.push(`asymmetry-journal: ${String(error)}`);
    return journalCandidates(null, { now: new Date(), pricesUsdt: {}, strategyVersion: COIN_STRATEGY_VERSION });
  }
}

async function main() {
  const [universe, marketRegime] = await Promise.all([discoverTradingUniverse(activeLedgerPairs()), readMarketRegime()]);
  const results = await mapLimit(universe, 6, (pair) => scanPair(pair, marketRegime)); const candidates: Candidate[] = []; const diagnostics: PairDiagnostic[] = []; const errors: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') { candidates.push(...result.value.candidates); diagnostics.push(result.value.diagnostic); }
    else errors.push(`${universe[index]?.pair ?? 'unknown'}: ${String(result.reason)}`);
  });
  const asymmetryJournal = await scanAsymmetryJournal(errors);
  const allCandidates: Array<Candidate | JournalCandidate> = [...candidates, ...asymmetryJournal.candidates];
  const output = { timestamp: new Date().toISOString(), mode: 'spot-only-v4-usdt', quoteCurrency: 'USDT', accountingCurrency: 'IDR', strategyVersion: COIN_STRATEGY_VERSION, marketRegime, pairsScanned: universe.length, universe, diagnostics, candidates: allCandidates, asymmetryJournal, errors };
  fs.writeFileSync(path.join(process.cwd(), '.desk', 'latest-scan.json'), JSON.stringify(output, null, 2) + '\n'); console.log(JSON.stringify(output, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
