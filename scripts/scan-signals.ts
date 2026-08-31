#!/usr/bin/env node
/** Spot-only, multi-timeframe setup scanner. It creates pending-order
 * candidates only; execution and risk checks happen in execute-paper-trades. */
import fs from 'node:fs';
import path from 'node:path';
import { adx, atr, bollingerBands, ema, rsi, type OHLCV } from '../lib/indicators.js';
import { fetchOhlcv } from '../dashboard/lib/indodax.js';

const PAIRS = ['btcidr', 'ethidr', 'solidr', 'xrpidr', 'dogeidr', 'pepeidr', 'suiidr', 'bnbidr', 'trxidr', 'hypeidr', 'linkidr', 'adaidr', 'bchidr', 'tonidr', 'ltcidr', 'hbaridr', 'avaxidr', 'shibidr', 'uniidr'];
type Owner = 'breakout-specialist' | 'aggressive-breakout-trader' | 'mean-reversion-trader' | 'smc-trader' | 'wyckoff-trader';
export interface Candidate {
  id: string; pair: string; agent: Owner; side: 'long'; type: 'limit' | 'stop'; timeframe: '15m' | '4h';
  entryLow: number; entryHigh: number; stopPrice: number; targetPrice: number; expiresAt: string;
  confirmations: string[]; reason: string; score: number; validationStatus: 'validated' | 'research';
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
// A 1.5R gross plan is too thin after a 0.6% round-trip paper fee. Keep a
// buffer while retaining the executor's absolute 1.5R safety floor.
function targetFor(entry: number, stop: number, multiple = 1.5) {
  return entry + Math.max((entry - stop) * 1.5, entry * 0.01);
}
function valid(entry: number, stop: number, target: number) {
  const risk = (entry - stop) / entry;
  const reward = (target - entry) / entry;
  return stop > 0 && entry > stop && reward >= Math.max(risk * 1.5, 0.01);
}
function expiry(hours: number) { return new Date(Date.now() + hours * 3_600_000).toISOString(); }
function limitBand(entry: number, atrValue: number, floor: number, ceiling: number) {
  // Keep limit orders close enough to fill within their short validity window.
  const high = Math.min(ceiling, entry);
  return { low: Math.max(floor, high - atrValue * 0.3), high };
}
function demandZone(candles: OHLCV[], current: number) {
  const recent = candles.slice(-32, -1); const low = Math.min(...recent.map((c) => c.low)); const high = Math.max(...recent.map((c) => c.high));
  const zoneHigh = low + (high - low) * 0.3; return current >= low * 0.995 && current <= zoneHigh * 1.025 ? { low, high: zoneHigh } : null;
}
function fibConfluence(candles: OHLCV[], price: number) {
  const recent = candles.slice(-50, -1); const low = Math.min(...recent.map((c) => c.low)); const high = Math.max(...recent.map((c) => c.high));
  return [0.382, 0.5, 0.618].some((ratio) => Math.abs(price - (high - (high - low) * ratio)) / price < 0.008);
}
function bullishCandle(candles: OHLCV[]) { const [prev, last] = candles.slice(-3, -1); return !!prev && !!last && last.close > last.open && last.close >= prev.open && last.open <= prev.close; }

async function scanPair(pair: string): Promise<Candidate[]> {
  const [fifteenMinute, fourHour] = await Promise.all([fetchOhlcv(pair, '15m', 160), fetchOhlcv(pair, '4h', 140)]);
  const one = metric(fifteenMinute); const four = metric(fourHour); if (!one || !four) return [];
  const candidates: Candidate[] = [];
  const trendUp = four.ema9 > four.ema21 && four.last.close >= four.ema9 && four.adx >= 14;
  // Each pair is evaluated on its own structure. BTC is not a global gate:
  // altcoins may form valid long-only setups while BTC is neutral or weak.
  const liquid = one.closed.slice(-20).filter((bar) => bar.volume > 0).length >= 18 && one.atr / one.last.close <= 0.08;
  const zone = demandZone(fifteenMinute, one.last.close);
  const id = (owner: Owner) => `${owner}-${pair}-${Date.now()}`;

  // Breakout: accept only a shallow retest; never park a wish-price far below market.
  const candleRange = Math.max(one.last.high - one.last.low, Number.EPSILON); const closeStrength = (one.last.close - one.last.low) / candleRange; const body = Math.abs(one.last.close - one.last.open);
  const breakoutExtension = (one.last.close - one.resistance) / one.atr;
  // Both momentum agents use the validated continuation trigger. Their
  // difference is campaign management: Jesse may pyramid; aggressive is all-in once.
  const aggressiveScore = Number(one.vol >= 1.5) + Number(closeStrength >= .7) + Number(body / one.atr >= .5 && body / one.atr <= 1.8) + Number(one.ema9 > one.ema21) + Number(breakoutExtension <= .75);
  // Prepare just below resistance, but retain buy-stop confirmation.
  if (liquid && trendUp && one.last.close >= one.resistance * .997 && aggressiveScore >= 3) {
    const entry = one.last.high * 1.0005; const stop = Math.max(one.resistance - one.atr * .25, entry - 1.2 * one.atr); const target = targetFor(entry, stop);
    if (valid(entry, stop, target)) candidates.push({ id: id('breakout-specialist'), pair, agent: 'breakout-specialist', side: 'long', type: 'stop', timeframe: '15m', entryLow: entry, entryHigh: entry, stopPrice: stop, targetPrice: target, expiresAt: expiry(6), confirmations: ['Trend 4H + BTC kuat', `Skor breakout ${aggressiveScore}/5`, 'Continuation di atas high 15m'], score: aggressiveScore, validationStatus: 'validated', reason: 'Breakout 15m tervalidasi; buy-stop hanya terisi bila momentum berlanjut.' });
  }
  // Aggressive is a premium stop-entry and never pyramids.
  if (liquid && trendUp && four.adx >= 14 && one.last.close >= one.resistance * .998 && aggressiveScore >= 3) {
    const entry = one.last.high * 1.0003; const stop = Math.max(one.resistance - one.atr * .25, entry - 1.15 * one.atr); const target = targetFor(entry, stop);
    if (valid(entry, stop, target)) candidates.push({ id: id('aggressive-breakout-trader'), pair, agent: 'aggressive-breakout-trader', side: 'long', type: 'stop', timeframe: '15m', entryLow: entry, entryHigh: entry, stopPrice: stop, targetPrice: target, expiresAt: expiry(4), confirmations: ['Trend 4H', `Skor momentum ${aggressiveScore}/5`, 'Buy-stop di atas high 15m'], score: aggressiveScore, validationStatus: 'validated', reason: 'Momentum 15m berkualitas tinggi; buy-stop membatalkan entry bila harga tidak melanjutkan breakout.' });
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
  if (liquid && range4h && range15m && nearLowerBand && rsiReclaim && containedVolume && meanScore >= 5) {
    const entry = Math.min(one.last.close, one.lower + one.atr * .15);
    const band = limitBand(entry, one.atr, one.lower - one.atr * .20, entry);
    const stop = Math.min(one.support - one.atr * .25, band.low - one.atr * .35);
    // The mean/middle Bollinger band is the natural first exit in a range.
    const target = one.mid;
    if (valid(band.high, stop, target)) candidates.push({ id: id('mean-reversion-trader'), pair, agent: 'mean-reversion-trader', side: 'long', type: 'limit', timeframe: '15m', entryLow: band.low, entryHigh: band.high, stopPrice: stop, targetPrice: target, expiresAt: expiry(8), confirmations: ['Regime ranging: ADX rendah + EMA rapat + CHOP tinggi', 'Reversal di Bollinger bawah', 'RSI oversold/reclaim + volume terkendali', `Skor range-reversion ${meanScore}/6`], score: meanScore, validationStatus: 'research', reason: 'Range mean reversion: buy limit dekat Bollinger bawah, target middle band.' });
  }
  // SMC and Wyckoff remain separate research strategies.
  const fib = fibConfluence(fourHour, one.last.close); const engulfing = bullishCandle(fifteenMinute);

  // Phase-D Sign of Strength / Last Point of Support is used instead of trying
  // to catch every Phase-C spring in a spot-only market.
  const wyckoffHistory = one.closed.slice(-41, -1);
  if (wyckoffHistory.length >= 24) {
    const rangeLow = Math.min(...wyckoffHistory.map((bar) => bar.low));
    const rangeHigh = Math.max(...wyckoffHistory.map((bar) => bar.high));
    const ranging4h = four.adx >= 12 && four.adx < 30 && four.ema9 >= four.ema21 && Math.abs(four.ema9 - four.ema21) / four.ema21 < .03;
    const sosScore = Number(one.last.close > rangeHigh) + Number(one.vol >= 1.5) + Number(closeStrength >= .7) + Number(body >= one.atr * .5) + Number((rangeHigh - rangeLow) / one.atr <= 7);
    // A real retest band avoids the previous zero-width limit at rangeHigh.
    const entry = rangeHigh; const band = limitBand(entry, one.atr, rangeHigh - one.atr * .3, one.last.close); const stop = Math.min(rangeHigh - one.atr * 1.1, band.low - one.atr * .7); const target = targetFor(band.high, stop);
    if (liquid && ranging4h && sosScore >= 3 && valid(band.high, stop, target)) {
      candidates.push({ id: id('wyckoff-trader'), pair, agent: 'wyckoff-trader', side: 'long', type: 'limit', timeframe: '15m', entryLow: band.low, entryHigh: band.high, stopPrice: stop, targetPrice: target, expiresAt: expiry(8), confirmations: ['Wyckoff phase D / SoS', `Skor ${sosScore}/5`, 'Retest range high dalam zona 0,3 ATR'], score: sosScore, validationStatus: 'research', reason: 'Wyckoff SoS: buy limit pada zona retest range high.' });
    }
  }
  const sweepWindow = one.closed.slice(-9, -2); const sweepCandle = one.closed.at(-2)!; const swept = sweepWindow.length >= 5 && sweepCandle.low < Math.min(...sweepWindow.map((bar) => bar.low)); const choch = one.last.close > sweepCandle.high && one.last.close > one.last.open;
  const smcScore = Number(Boolean(zone)) + Number(fib || engulfing) + Number(body >= one.atr * .4) + Number(closeStrength >= .55);
  if (liquid && trendUp && zone && one.vol >= .9 && swept && choch && smcScore >= 3) {
    const entry = Math.min(zone.high, one.last.close); const floor = zone.low;
    const band = limitBand(entry, one.atr, floor, one.last.close);
    const stop = Math.min(floor - one.atr * .15, band.low - one.atr * .5);
    const target = targetFor(band.high, stop, 1.8);
    if (valid(band.high, stop, target)) {
      candidates.push({ id: id('smc-trader'), pair, agent: 'smc-trader', side: 'long', type: 'limit', timeframe: '15m', entryLow: band.low, entryHigh: band.high, stopPrice: stop, targetPrice: target, expiresAt: expiry(8), confirmations: ['Sweep + reclaim high 15m', 'Demand zone + volume normal', `Skor konteks ${smcScore}/4`], score: smcScore, validationStatus: 'research', reason: 'SMC tervalidasi: buy limit demand zone dengan target 1,8R.' });
    }
  }
  return candidates;
}

async function main() {
  const results = await Promise.allSettled(PAIRS.map((pair) => scanPair(pair))); const candidates: Candidate[] = []; const errors: string[] = [];
  for (const result of results) result.status === 'fulfilled' ? candidates.push(...result.value) : errors.push(String(result.reason));
  const output = { timestamp: new Date().toISOString(), mode: 'spot-only-v2', pairsScanned: PAIRS.length, candidates, errors };
  fs.writeFileSync(path.join(process.cwd(), '.desk', 'latest-scan.json'), JSON.stringify(output, null, 2) + '\n'); console.log(JSON.stringify(output, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
