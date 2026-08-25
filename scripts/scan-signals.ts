#!/usr/bin/env node
/** Spot-only, multi-timeframe setup scanner. It creates pending-order
 * candidates only; execution and risk checks happen in execute-paper-trades. */
import fs from 'node:fs';
import path from 'node:path';
import { adx, atr, bollingerBands, ema, rsi, type OHLCV } from '../lib/indicators.js';
import { fetchOhlcv } from '../dashboard/lib/indodax.js';
import { detectSweepChochConfluence } from '../dashboard/lib/smc.js';

const PAIRS = ['btcidr', 'ethidr', 'solidr', 'xrpidr', 'dogeidr', 'pepeidr', 'suiidr', 'bnbidr', 'trxidr', 'hypeidr', 'linkidr', 'adaidr', 'bchidr', 'tonidr', 'ltcidr', 'hbaridr', 'avaxidr', 'shibidr', 'uniidr'];
type Owner = 'breakout-specialist' | 'aggressive-breakout-trader' | 'mean-reversion-trader' | 'smc-trader' | 'wyckoff-trader';
export interface Candidate {
  id: string; pair: string; agent: Owner; side: 'long'; type: 'limit' | 'stop'; timeframe: '1h' | '4h';
  entryLow: number; entryHigh: number; stopPrice: number; targetPrice: number; expiresAt: string;
  confirmations: string[]; reason: string; score: number;
}

function metric(candles: OHLCV[]) {
  const closed = candles.slice(0, -1); if (closed.length < 55) return null;
  const closes = closed.map((c) => c.close); const last = closed.at(-1)!; const prior = closed.slice(-21, -1);
  const bands = bollingerBands(closes, 20, 2); const av = prior.reduce((s, c) => s + c.volume, 0) / prior.length;
  return { last, closes, adx: adx(closed, 14).at(-1)!, ema9: ema(closes, 9).at(-1)!, ema21: ema(closes, 21).at(-1)!, rsi: rsi(closes, 14).at(-1)!, previousRsi: rsi(closes.slice(0, -1), 14).at(-1)!, atr: atr(closed, 14).at(-1)!, upper: bands.upper.at(-1)!, lower: bands.lower.at(-1)!, mid: bands.middle.at(-1)!, resistance: Math.max(...prior.map((c) => c.high)), support: Math.min(...prior.map((c) => c.low)), vol: av > 0 ? last.volume / av : 0, closed };
}
// A 1.5R gross plan is too thin after a 0.6% round-trip paper fee. Keep a
// buffer while retaining the executor's absolute 1.5R safety floor.
function valid(entry: number, stop: number, target: number) {
  const risk = (entry - stop) / entry;
  const reward = (target - entry) / entry;
  return stop > 0 && entry > stop && reward >= Math.max(risk * 1.8, 0.012);
}
function expiry(hours: number) { return new Date(Date.now() + hours * 3_600_000).toISOString(); }
function limitBand(entry: number, atrValue: number, floor: number, ceiling: number) {
  // Avoid a wide wish-price below market: entries stay within half an hourly ATR.
  const high = Math.min(ceiling, entry);
  return { low: Math.max(floor, high - atrValue * 0.5), high };
}
function demandZone(candles: OHLCV[], current: number) {
  const recent = candles.slice(-32, -1); const low = Math.min(...recent.map((c) => c.low)); const high = Math.max(...recent.map((c) => c.high));
  const zoneHigh = low + (high - low) * 0.22; return current >= low * 0.995 && current <= zoneHigh * 1.02 ? { low, high: zoneHigh } : null;
}
function fibConfluence(candles: OHLCV[], price: number) {
  const recent = candles.slice(-50, -1); const low = Math.min(...recent.map((c) => c.low)); const high = Math.max(...recent.map((c) => c.high));
  return [0.382, 0.5, 0.618].some((ratio) => Math.abs(price - (high - (high - low) * ratio)) / price < 0.008);
}
function bullishCandle(candles: OHLCV[]) { const [prev, last] = candles.slice(-3, -1); return !!prev && !!last && last.close > last.open && last.close >= prev.open && last.open <= prev.close; }

async function scanPair(pair: string, btc: ReturnType<typeof metric>): Promise<Candidate[]> {
  const [oneHour, fourHour] = await Promise.all([fetchOhlcv(pair, '1h', 140), fetchOhlcv(pair, '4h', 140)]);
  const one = metric(oneHour); const four = metric(fourHour); if (!one || !four) return [];
  const candidates: Candidate[] = []; const trendUp = four.ema9 > four.ema21 && four.adx >= 22; const btcBullish = !!btc && btc.ema9 >= btc.ema21 && btc.last.close >= btc.ema21; const btcNeutral = !!btc && btc.last.close >= btc.ema21 * .985; const liquid = one.closed.slice(-20).every((bar) => bar.volume > 0) && one.atr / one.last.close <= 0.08; const zone = demandZone(oneHour, one.last.close);
  const id = (owner: Owner) => `${owner}-${pair}-${Date.now()}`;

  // Breakout: accept only a shallow retest; never park a wish-price far below market.
  const candleRange = Math.max(one.last.high - one.last.low, Number.EPSILON); const closeStrength = (one.last.close - one.last.low) / candleRange; const body = Math.abs(one.last.close - one.last.open);
  if (btcBullish && liquid && trendUp && one.last.close > one.resistance && one.vol >= 1.5 && closeStrength >= .65 && body / one.atr <= 2.2) {
    const entry = Math.max(one.resistance, one.last.close - one.atr * 0.45);
    const stop = Math.max(one.support - one.atr * .15, entry - 1.5 * one.atr); const target = entry + (entry - stop) * 2;
    const band = limitBand(entry, one.atr, one.resistance, one.last.close); const extension = (one.last.close - one.resistance) / one.atr;
    if (extension <= 1.25 && valid(band.high, stop, target)) candidates.push({ id: id('breakout-specialist'), pair, agent: 'breakout-specialist', side: 'long', type: 'limit', timeframe: '1h', entryLow: band.low, entryHigh: band.high, stopPrice: stop, targetPrice: target, expiresAt: expiry(4), confirmations: ['Trend 4H', 'Close breakout 1H', 'Volume ≥1.5x', 'Extension <=1.25 ATR'], score: 4, reason: 'Breakout sehat; retest dangkal dekat harga, bukan pullback jauh.' });
  }
  // Aggressive is a premium stop-entry and never pyramids.
  const previous = one.closed.at(-2); const priorToPrevious = one.closed.slice(-22, -2); const previousResistance = priorToPrevious.length ? Math.max(...priorToPrevious.map((bar) => bar.high)) : 0;
  const followThrough = !!previous && previous.close > previousResistance && one.last.close > previous.high && closeStrength >= .6;
  if (btcBullish && liquid && trendUp && followThrough && one.vol >= 1.2 && four.adx >= 25) {
    const entry = one.last.close * 1.001; const stop = Math.max(previousResistance - one.atr * .15, entry - 1.4 * one.atr); const target = entry + (entry - stop) * 2.2;
    const extension = (one.last.close - one.resistance) / one.atr;
    if (extension <= 0.9 && valid(entry, stop, target)) candidates.push({ id: id('aggressive-breakout-trader'), pair, agent: 'aggressive-breakout-trader', side: 'long', type: 'stop', timeframe: '1h', entryLow: entry, entryHigh: entry, stopPrice: stop, targetPrice: target, expiresAt: expiry(3), confirmations: ['Trend 4H kuat', 'Volume ≥2x', 'Breakout close 1H', 'Extension <=0.9 ATR'], score: 5, reason: 'Momentum premium dekat harga; batal bila kelanjutan tidak terjadi cepat.' });
  }
  // Mean reversion is allowed only in a verified ranging 4H regime.
  const reversal = one.previousRsi < 32 && one.rsi > one.previousRsi && one.last.close > one.last.open && one.last.low <= one.lower;
  if (btcNeutral && liquid && four.adx < 22 && four.ema9 >= four.ema21 * .99 && reversal) {
    const entry = one.last.close; const stop = entry - 1.8 * one.atr; const target = one.mid;
    const band = limitBand(entry, one.atr, entry - one.atr * 0.45, entry);
    if (valid(band.high, stop, target)) candidates.push({ id: id('mean-reversion-trader'), pair, agent: 'mean-reversion-trader', side: 'long', type: 'limit', timeframe: '1h', entryLow: band.low, entryHigh: band.high, stopPrice: stop, targetPrice: target, expiresAt: expiry(6), confirmations: ['Range 4H', 'RSI oversold', 'Bollinger lower band', 'Entry <=0.45 ATR'], score: 4, reason: 'Reversion di ekstrem; limit dekat harga dan cepat kedaluwarsa.' });
  }
  // SMC / Wyckoff own their campaign, while S&D is mandatory and Fib OR candle is the trigger.
  const trigger = fibConfluence(fourHour, one.last.close) ? 'Fibonacci overlap' : bullishCandle(oneHour) ? 'Bullish engulfing 1H' : null;

  // Wyckoff is evaluated independently from SMC.  The old condition compared
  // the spring with a support window that already contained that spring, which
  // made a genuine lower-low mathematically impossible to detect.
  const wyckoffHistory = one.closed.slice(-34, -3);
  const [spring, reclaim, test] = one.closed.slice(-3);
  if (wyckoffHistory.length >= 18 && spring && reclaim && test) {
    const rangeLow = Math.min(...wyckoffHistory.map((bar) => bar.low));
    const rangeHigh = Math.max(...wyckoffHistory.map((bar) => bar.high));
    const averageVolume = wyckoffHistory.reduce((sum, bar) => sum + bar.volume, 0) / wyckoffHistory.length;
    const ranging4h = four.adx < 28 && Math.abs(four.ema9 - four.ema21) / four.ema21 < 0.022;
    const validSpring = spring.low < rangeLow && spring.close > rangeLow && spring.volume >= averageVolume * 1.3;
    const validReclaim = reclaim.close > rangeLow && reclaim.close > reclaim.open && reclaim.close >= (reclaim.high + reclaim.low) / 2;
    const validTest = test.low >= spring.low && test.close >= reclaim.close && test.close > test.open && test.volume <= reclaim.volume * 1.1;
    const entry = test.close; const band = limitBand(entry, one.atr, Math.max(rangeLow, entry - one.atr * 0.5), entry);
    const stop = spring.low - one.atr * 0.4; const target = Math.max((rangeLow + rangeHigh) / 2, band.high + (band.high - stop) * 2);
    if (btcNeutral && liquid && ranging4h && validSpring && validReclaim && validTest && valid(band.high, stop, target)) {
      candidates.push({ id: id('wyckoff-trader'), pair, agent: 'wyckoff-trader', side: 'long', type: 'limit', timeframe: '1h', entryLow: band.low, entryHigh: band.high, stopPrice: stop, targetPrice: target, expiresAt: expiry(8), confirmations: ['Spring volume', 'Reclaim support', 'Bullish retest', 'Range 4H'], score: 5, reason: 'Wyckoff spring, reclaim, lalu retest bullish; entry proximal dekat support.' });
    }
  }
  if (btcBullish && liquid && four.ema9 >= four.ema21 * .995 && zone && trigger && body >= one.atr * .75) {
    const entry = Math.min(zone.high, one.last.close); const band = limitBand(entry, one.atr, zone.low, entry);
    const stop = zone.low - one.atr * 0.5; const target = Math.max(one.resistance, band.high + (band.high - stop) * 1.8);
    if (valid(band.high, stop, target)) {
      const smc = detectSweepChochConfluence(oneHour, 5);
      if (smc?.choch === 'bullish') candidates.push({ id: id('smc-trader'), pair, agent: 'smc-trader', side: 'long', type: 'limit', timeframe: '1h', entryLow: band.low, entryHigh: band.high, stopPrice: stop, targetPrice: target, expiresAt: expiry(8), confirmations: ['Bias 4H bullish', 'Sweep + CHoCH', 'Displacement >=1.2 ATR', trigger, 'Entry <=0.5 ATR'], score: 5 + (trigger === 'Fibonacci overlap' ? 1 : 0), reason: 'SMC bullish dengan bias 4H dan displacement; entry proximal dekat demand.' });
    }
  }
  return candidates;
}

async function main() {
  const btcFour = metric(await fetchOhlcv('btcidr', '4h', 140)); const results = await Promise.allSettled(PAIRS.map((pair) => scanPair(pair, btcFour))); const candidates: Candidate[] = []; const errors: string[] = [];
  for (const result of results) result.status === 'fulfilled' ? candidates.push(...result.value) : errors.push(String(result.reason));
  const output = { timestamp: new Date().toISOString(), mode: 'spot-only-v2', pairsScanned: PAIRS.length, candidates, errors };
  fs.writeFileSync(path.join(process.cwd(), '.desk', 'latest-scan.json'), JSON.stringify(output, null, 2) + '\n'); console.log(JSON.stringify(output, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

