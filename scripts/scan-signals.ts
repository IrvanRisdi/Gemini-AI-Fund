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
const COIN_STRATEGY_VERSION = 'recovery-v6-usdt';
type MarketRegime = { riskOn: boolean; close: number | null; ema21: number | null; adx: number | null; btcReturn24h: number; reason: string };
export interface Candidate {
  id: string; pair: string; agent: Owner; side: 'long'; quoteCurrency: 'USDT'; type: 'limit' | 'stop'; timeframe: '5m' | '15m' | '1h' | '4h';
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
function metric(candles: OHLCV[], lookback = 24) {
  const closed = candles.slice(0, -1); if (closed.length < 55) return null;
  const closes = closed.map((c) => c.close); const last = closed.at(-1)!; const prior = closed.slice(-(lookback + 1), -1);
  const bands = bollingerBands(closes, 20, 2); const av = prior.reduce((s, c) => s + c.volume, 0) / prior.length;
  return { last, closes, chop: choppiness(closed), adx: adx(closed, 14).at(-1)!, ema9: ema(closes, 9).at(-1)!, ema21: ema(closes, 21).at(-1)!, rsi: rsi(closes, 14).at(-1)!, previousRsi: rsi(closes.slice(0, -1), 14).at(-1)!, atr: atr(closed, 14).at(-1)!, upper: bands.upper.at(-1)!, lower: bands.lower.at(-1)!, mid: bands.middle.at(-1)!, resistance: Math.max(...prior.map((c) => c.high)), support: Math.min(...prior.map((c) => c.low)), vol: av > 0 ? last.volume / av : 0, closed };
}
function expiry(hours: number) { return new Date(Date.now() + hours * 3_600_000).toISOString(); }

async function scanPair(universePair: UniversePair, market: MarketRegime): Promise<{ candidates: Candidate[]; diagnostic: PairDiagnostic }> {
  const pair = universePair.pair;
  const [fifteenMinute, oneHourRaw, fourHour] = await Promise.all([
    fetchCoinOhlcv(pair, '15m', 160),
    fetchCoinOhlcv(pair, '1h', 120),
    fetchCoinOhlcv(pair, '4h', 140),
  ]);
  const one = metric(fifteenMinute, 24);
  const oneHour = metric(oneHourRaw, 24);
  const four = metric(fourHour, 24);
  if (!one || !oneHour || !four) return { candidates: [], diagnostic: { pair, source: universePair.source, selectedBecause: universePair.selectedBecause, volumeIdr24h: universePair.volumeIdr, status: 'insufficient-data', close: null, ema9: null, ema21: null, adx: null, relativeVolume: null, candidates: 0 } };
  const candidates: Candidate[] = [];
  const liquid = one.closed.slice(-20).filter((bar) => bar.volume > 0).length >= 18 && one.atr / one.last.close <= 0.08;
  const id = (owner: Owner) => `${owner}-${pair}-${Date.now()}`;

  const fourRange = Math.max(four.last.high - four.last.low, Number.EPSILON);
  const fourCloseStrength = (four.last.close - four.last.low) / fourRange;
  const pairReturn24h = four.closed.length >= 7 ? four.last.close / four.closed.at(-7)!.close - 1 : 0;
  const relativeStrengthVsBtc = pairReturn24h - market.btcReturn24h;

  // 1. Breakout Specialist v6: 4H Relative-Strength Breakout vs BTC (Backtest: PF 1.94, H1 2.28, H2 1.65, WR 40.7%).
  // Enters on 4H 24-bar high breakout with RVOL >= 2.5, close strength >= 0.75, EMA9 > EMA21, and >= +2% 24h RS vs BTC.
  const fourExtension = (four.last.close - four.resistance) / four.atr;
  const breakoutScore = Number(four.vol >= 2.5) + Number(fourCloseStrength >= 0.75) + Number(four.ema9 > four.ema21) + Number(relativeStrengthVsBtc >= 0.02) + Number(fourExtension <= 1.2);
  if (liquid && four.last.close > four.resistance && breakoutScore >= 5) {
    const entry = four.last.high * 1.0003;
    const structuralStop = Math.min(four.last.low, four.resistance - four.atr * 0.25);
    const stop = stopForRiskBand(entry, structuralStop, four.atr, 0.04, 0.05);
    const target = targetForNetReward(entry, stop, 3.0);
    if (validNetPlan(entry, stop, target, 3.0)) {
      candidates.push({
        id: id('breakout-specialist'), pair, agent: 'breakout-specialist', side: 'long', quoteCurrency: 'USDT', type: 'stop', timeframe: '4h',
        entryLow: entry, entryHigh: entry, stopPrice: stop, targetPrice: target, expiresAt: expiry(12),
        confirmations: [
          `Relative strength 24j +${(relativeStrengthVsBtc * 100).toFixed(1)}% vs BTC`,
          `Close 4H menembus high 24 bar dengan RVOL ${four.vol.toFixed(1)}x`,
          `Close strength ${(fourCloseStrength * 100).toFixed(0)}% · EMA9 > EMA21`,
          'Alokasi tunggal 30% tanpa inverted pyramid · target 3R bersih',
        ],
        score: breakoutScore, volumeRatio: four.vol, allocationPct: 0.30, rewardMultiple: 3.0,
        validationStatus: 'validated', strategyVersion: COIN_STRATEGY_VERSION, timeStopHours: 384, breakevenAtR: null,
        reason: 'Breakout 4H dengan relative strength di atas BTC dan lonjakan volume >=2,5x.',
      });
    }
  }

  // 2. Aggressive Breakout v6: 1H High-Velocity Momentum Ignition with RS vs BTC (Backtest: PF 1.46, H1 1.81, H2 1.25, WR 41.2%).
  if (liquid && four.ema9 > four.ema21 && four.last.close >= four.ema21) {
    const plan = latestIgnition(oneHour.closed, {
      ema9: four.ema9,
      ema21: four.ema21,
      close: four.last.close,
      pairReturn24h,
      btcReturn24h: market.btcReturn24h,
    });
    if (plan && validNetPlan(plan.entry, plan.stop, plan.target, AGGRESSIVE_REWARD_MULTIPLE)) {
      const allocationPct = aggressiveAllocationPct(plan.relativeVolume);
      candidates.push({
        id: id('aggressive-breakout-trader'), pair, agent: 'aggressive-breakout-trader', side: 'long', quoteCurrency: 'USDT', type: 'stop', timeframe: '1h',
        entryLow: plan.entry, entryHigh: plan.entry, stopPrice: plan.stop, targetPrice: plan.target,
        expiresAt: new Date(Date.now() + AGGRESSIVE_ORDER_TTL_MINUTES * 60_000).toISOString(),
        confirmations: [
          `Relative strength 24j +${(relativeStrengthVsBtc * 100).toFixed(1)}% vs BTC`,
          'Trend 4H EMA9 > EMA21',
          `Close 1H menembus high 24 jam dengan volume ${plan.relativeVolume.toFixed(1)}x`,
          `Stop ${(((plan.entry - plan.stop) / plan.entry) * 100).toFixed(1)}% · target 3R bersih · time stop ${AGGRESSIVE_TIME_STOP_HOURS} jam`,
        ],
        score: 5, volumeRatio: plan.relativeVolume, allocationPct, rewardMultiple: AGGRESSIVE_REWARD_MULTIPLE,
        validationStatus: 'validated', strategyVersion: AGGRESSIVE_STRATEGY_VERSION, timeStopHours: AGGRESSIVE_TIME_STOP_HOURS, breakevenAtR: null,
        reason: 'Momentum ignition 1H: breakout 24 jam dengan RVOL >=3,5x dan relative strength terhadap BTC.',
      });
    }
  }

  // 3. Mean Reversion v6: 4H Deep Oversold Capitulation Rebound (Backtest: PF 2.42, H1 4.67, H2 1.31, WR 52.4%).
  // Decoupled from bull-only market.riskOn so oversold washouts can be captured in corrective/ranging markets.
  const prevFour = four.closed.at(-2)!;
  const washedOut4h = (four.rsi <= 30 || four.previousRsi <= 30) && (four.last.low <= four.lower || prevFour.low <= four.lower * 1.005);
  const bullishReclaim4h = four.last.close > four.last.open && fourCloseStrength >= 0.60 && four.last.close > prevFour.high;
  if (liquid && washedOut4h && bullishReclaim4h) {
    const entryHigh = four.last.close;
    const entryLow = entryHigh * 0.995;
    const stop = stopForRiskBand(entryHigh, Math.min(four.last.low, prevFour.low) - four.atr * 0.2, four.atr, 0.04, 0.05);
    const target = Math.max(four.mid, targetForNetReward(entryHigh, stop, 2.0));
    if (validNetPlan(entryHigh, stop, target, 2.0)) {
      candidates.push({
        id: id('mean-reversion-trader'), pair, agent: 'mean-reversion-trader', side: 'long', quoteCurrency: 'USDT', type: 'limit', timeframe: '4h',
        entryLow, entryHigh, stopPrice: stop, targetPrice: target, expiresAt: expiry(16),
        confirmations: [
          `Kapitulasi 4H RSI ${Math.min(four.rsi, four.previousRsi).toFixed(1)} ≤ 30`,
          'Pierce Bollinger Band bawah 4H lalu bullish engulfing di atas high candle sebelumnya',
          `Close strength ${(fourCloseStrength * 100).toFixed(0)}% ≥ 60%`,
          'Target 2R bersih / Bollinger tengah',
        ],
        score: 6, volumeRatio: four.vol, allocationPct: 0.25, rewardMultiple: 2.0,
        validationStatus: 'validated', strategyVersion: COIN_STRATEGY_VERSION, timeStopHours: 384, breakevenAtR: 1.25,
        reason: 'Rebound kapitulasi 4H: RSI ekstrem <=30 di bawah Bollinger bawah dengan konfirmasi candle pembalikan.',
      });
    }
  }

  // 4. Wyckoff v6: 4H Phase-D Sign of Strength (SoS) Retest (Backtest: PF 1.84, H1 3.00, H2 1.09, WR 42.4%).
  const wyckoffHistory = four.closed.slice(-46, -1);
  if (wyckoffHistory.length >= 40) {
    const rangeLow = Math.min(...wyckoffHistory.map((bar) => bar.low));
    const rangeHigh = Math.max(...wyckoffHistory.map((bar) => bar.high));
    const prior20Vol = four.closed.slice(-21, -1).reduce((s, b) => s + b.volume, 0) / 20;
    const wyckoffRvol = prior20Vol > 0 ? four.last.volume / prior20Vol : 0;
    const compactRange = (rangeHigh - rangeLow) / four.atr <= 6.5;
    const sosScore = Number(four.last.close > rangeHigh) + Number(wyckoffRvol >= 1.6) + Number(fourCloseStrength >= 0.70) + Number(compactRange) + Number(four.last.close > four.ema21);
    const band = orderedLimitBand(rangeHigh, four.atr, rangeHigh - four.atr * 0.3, four.last.close);
    const structuralStop = Math.min(rangeHigh - four.atr * 1.1, band.low - four.atr * 0.7);
    const stop = stopForRiskBand(band.high, structuralStop, four.atr, 0.03, 0.05);
    const target = targetForNetReward(band.high, stop, 2.5);
    if (liquid && four.last.close > rangeHigh && sosScore >= 5 && validNetPlan(band.high, stop, target, 2.5)) {
      candidates.push({
        id: id('wyckoff-trader'), pair, agent: 'wyckoff-trader', side: 'long', quoteCurrency: 'USDT', type: 'limit', timeframe: '4h',
        entryLow: band.low, entryHigh: band.high, stopPrice: stop, targetPrice: target, expiresAt: expiry(32),
        confirmations: [
          'Konsolidasi Wyckoff 45 bar 4H (lebar <= 6,5 ATR)',
          `Breakout Sign of Strength (SoS) dengan RVOL ${wyckoffRvol.toFixed(1)}x`,
          `Close strength ${(fourCloseStrength * 100).toFixed(0)}% di atas EMA21 4H`,
          'Entry limit pada retest atap range (LPS) · target 2,5R bersih',
        ],
        score: sosScore, volumeRatio: wyckoffRvol, allocationPct: 0.25, rewardMultiple: 2.5,
        validationStatus: 'validated', strategyVersion: COIN_STRATEGY_VERSION, timeStopHours: 480, breakevenAtR: 1.25,
        reason: 'Wyckoff 4H Phase-D SoS: breakout dari akumulasi padat, entry limit pada retest LPS dengan target 2,5R bersih.',
      });
    }
  }

  // 5. SMC v6: 15m 24-Bar Liquidity Sweep + Strong Reclaim Close inside 15m/4H Uptrend (Backtest: PF 1.21, H1 1.14, H2 1.32, WR 45.5%).
  const smc = liquid ? smcPullbackPlan({ closed: one.closed, ema9: one.ema9, ema21: one.ema21, atr: one.atr, fourHourClose: four.last.close, fourHourEma21: four.ema21 }) : null;
  if (smc) {
    candidates.push({
      id: id('smc-trader'), pair, agent: 'smc-trader', side: 'long', quoteCurrency: 'USDT', type: 'limit', timeframe: '15m',
      entryLow: smc.entryLow, entryHigh: smc.entryHigh, stopPrice: smc.stop, targetPrice: smc.target, expiresAt: expiry(SMC_ORDER_TTL_HOURS),
      confirmations: [
        'Sweep low 24 candle (6 jam) lalu reclaim kuat (close strength ≥ 65%)',
        'Tren 15m (EMA9 > EMA21, di atas EMA50) dan 4H di atas EMA21',
        'Entry limit di tengah candle reclaim · target 3R bersih · tanpa breakeven dini',
      ],
      score: 5, volumeRatio: one.vol, allocationPct: 0.25, rewardMultiple: SMC_REWARD_MULTIPLE,
      validationStatus: 'validated', strategyVersion: SMC_STRATEGY_VERSION, timeStopHours: SMC_TIME_STOP_HOURS, breakevenAtR: null,
      reason: 'SMC v6: sweep likuiditas 6 jam yang langsung direbut kembali dalam tren naik 15m/4H; entry limit pada retracement.',
    });
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
      relativeVolume: four.vol,
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
    if (!btc) return { riskOn: false, close: null, ema21: null, adx: null, btcReturn24h: 0, reason: 'Data BTC 4H belum cukup' };
    const riskOn = btc.ema9 >= btc.ema21 && btc.last.close >= btc.ema21 && btc.adx >= 18;
    const btcReturn24h = btc.closed.length >= 7 ? btc.last.close / btc.closed.at(-7)!.close - 1 : 0;
    return {
      riskOn,
      close: btc.last.close,
      ema21: btc.ema21,
      adx: btc.adx,
      btcReturn24h,
      reason: riskOn ? 'BTC 4H bullish dan ADX ≥ 18' : 'BTC 4H netral/korektif; strategi selektif tetap berjalan sesuai filter masing-masing',
    };
  } catch (error) {
    return { riskOn: false, close: null, ema21: null, adx: null, btcReturn24h: 0, reason: `Regime BTC gagal dibaca: ${String(error)}` };
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
  const output = { timestamp: new Date().toISOString(), mode: 'spot-only-v6-usdt', quoteCurrency: 'USDT', accountingCurrency: 'IDR', strategyVersion: COIN_STRATEGY_VERSION, marketRegime, pairsScanned: universe.length, universe, diagnostics, candidates: allCandidates, asymmetryJournal, errors };
  fs.writeFileSync(path.join(process.cwd(), '.desk', 'latest-scan.json'), JSON.stringify(output, null, 2) + '\n'); console.log(JSON.stringify(output, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
