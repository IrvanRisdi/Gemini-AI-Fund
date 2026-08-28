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
  id: string; pair: string; agent: Owner; side: 'long'; type: 'limit' | 'stop'; timeframe: '1h' | '4h';
  entryLow: number; entryHigh: number; stopPrice: number; targetPrice: number; expiresAt: string;
  confirmations: string[]; reason: string; score: number; validationStatus: 'validated' | 'research';
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

async function scanPair(pair: string, btc: ReturnType<typeof metric>): Promise<Candidate[]> {
  const [oneHour, fourHour] = await Promise.all([fetchOhlcv(pair, '1h', 160), fetchOhlcv(pair, '4h', 140)]);
  const one = metric(oneHour); const four = metric(fourHour); if (!one || !four) return [];
  // A 4H ADX of 20 still filters sideways noise, while allowing early trends
  // that were previously excluded by the 22 threshold. BTC remains unchanged
  // as the market-regime gate for this long-only desk.
  const candidates: Candidate[] = []; const trendUp = four.ema9 > four.ema21 && four.last.close >= four.ema9 && four.adx >= 14; const btcBullish = !!btc && btc.ema9 >= btc.ema21 && btc.last.close >= btc.ema21; const btcStrong = btcBullish && !!btc && btc.adx >= 12; const liquid = one.closed.slice(-20).filter((bar) => bar.volume > 0).length >= 18 && one.atr / one.last.close <= 0.08; const zone = demandZone(oneHour, one.last.close);
  const id = (owner: Owner) => `${owner}-${pair}-${Date.now()}`;

  // Breakout: accept only a shallow retest; never park a wish-price far below market.
  const candleRange = Math.max(one.last.high - one.last.low, Number.EPSILON); const closeStrength = (one.last.close - one.last.low) / candleRange; const body = Math.abs(one.last.close - one.last.open);
  const breakoutExtension = (one.last.close - one.resistance) / one.atr;
  // Both momentum agents use the validated continuation trigger. Their
  // difference is campaign management: Jesse may pyramid; aggressive is all-in once.
  const aggressiveScore = Number(one.vol >= 1.5) + Number(closeStrength >= .7) + Number(body / one.atr >= .5 && body / one.atr <= 1.8) + Number(one.ema9 > one.ema21) + Number(breakoutExtension <= .75);
  if (btcStrong && liquid && trendUp && one.last.close > one.resistance && aggressiveScore >= 3) {
    const entry = one.last.high * 1.001; const stop = Math.max(one.resistance - one.atr * .2, entry - 1.2 * one.atr); const target = entry + (entry - stop) * 1.5;
    if (valid(entry, stop, target)) candidates.push({ id: id('breakout-specialist'), pair, agent: 'breakout-specialist', side: 'long', type: 'stop', timeframe: '1h', entryLow: entry, entryHigh: entry, stopPrice: stop, targetPrice: target, expiresAt: expiry(6), confirmations: ['Trend 4H + BTC kuat', `Skor breakout ${aggressiveScore}/5`, 'Continuation di atas high 1H'], score: aggressiveScore, validationStatus: 'validated', reason: 'Breakout 1H tervalidasi; buy-stop hanya terisi bila momentum berlanjut.' });
  }
  // Aggressive is a premium stop-entry and never pyramids.
  if (btcStrong && liquid && trendUp && four.adx >= 16 && one.last.close > one.resistance && aggressiveScore >= 3 {
    const entry = one.last.high * 1.001; const stop = Math.max(one.resistance - one.atr * .2, entry - 1.2 * one.atr); const target = entry + (entry - stop) * 1.5;
    if (valid(entry, stop, target)) candidates.push({ id: id('aggressive-breakout-trader'), pair, agent: 'aggressive-breakout-trader', side: 'long', type: 'stop', timeframe: '1h', entryLow: entry, entryHigh: entry, stopPrice: stop, targetPrice: target, expiresAt: expiry(4), confirmations: ['Trend 4H', `Skor momentum ${aggressiveScore}/5`, 'Buy-stop di atas high 1H'], score: aggressiveScore, validationStatus: 'validated', reason: 'Momentum 1H berkualitas tinggi; buy-stop membatalkan entry bila harga tidak melanjutkan breakout.' });
  }
  // Long-only mean reversion is treated as a pullback inside a verified uptrend.
  const previous = one.closed.at(-2)!; const previousEma9 = ema(one.closes.slice(0, -1), 9).at(-1)!;
  const pullbackScore = Number(one.last.low <= one.ema21 * 1.003) + Number(previous.close <= previousEma9) + Number(one.last.close > one.ema9) + Number(one.last.close > one.last.open) + Number(one.rsi >= 42 && one.rsi <= 65);
  // Four confirmations retain a structured pullback while avoiding the
  // impractical requirement that every candle-level condition align at once.
  if (btcStrong && liquid && trendUp && one.vol >= 1 && pullbackScore >= 3) {
    const entry = one.last.high * 1.001; const pullbackLow = Math.min(...one.closed.slice(-6).map((bar) => bar.low)); const stop = Math.max(pullbackLow - one.atr * .15, entry - one.atr * 1.3); const target = entry + (entry - stop) * 1.5;
    if (valid(entry, stop, target)) candidates.push({ id: id('mean-reversion-trader'), pair, agent: 'mean-reversion-trader', side: 'long', type: 'stop', timeframe: '1h', entryLow: entry, entryHigh: entry, stopPrice: stop, targetPrice: target, expiresAt: expiry(4), confirmations: ['Pullback EMA 1H', 'Trend 4H + BTC kuat', `Skor pullback ${pullbackScore}/5`], score: pullbackScore, validationStatus: 'research', reason: 'Kandidat riset pullback-to-mean dalam uptrend; belum boleh dieksekusi otomatis.' });
  }
  // SMC and Wyckoff remain separate research strategies.
  const fib = fibConfluence(fourHour, one.last.close); const engulfing = bullishCandle(oneHour);

  // Phase-D Sign of Strength / Last Point of Support is used instead of trying
  // to catch every Phase-C spring in a spot-only market.
  const wyckoffHistory = one.closed.slice(-41, -1);
  if (wyckoffHistory.length >= 24) {
    const rangeLow = Math.min(...wyckoffHistory.map((bar) => bar.low));
    const rangeHigh = Math.max(...wyckoffHistory.map((bar) => bar.high));
    const ranging4h = four.adx >= 12 && four.adx < 30 && four.ema9 >= four.ema21 && Math.abs(four.ema9 - four.ema21) / four.ema21 < .03;
    const sosScore = Number(one.last.close > rangeHigh) + Number(one.vol >= 1.5) + Number(closeStrength >= .7) + Number(body >= one.atr * .5) + Number((rangeHigh - rangeLow) / one.atr <= 7);
    const entry = Math.max(rangeHigh, one.last.close - one.atr * .25); const band = limitBand(entry, one.atr, rangeHigh, entry); const stop = Math.max(rangeHigh - one.atr * .55, band.high - one.atr * 1.2); const target = band.high + (band.high - stop) * 1.5;
    if (btcStrong && liquid && ranging4h && sosScore >= 4 && valid(band.high, stop, target)) {
      candidates.push({ id: id('wyckoff-trader'), pair, agent: 'wyckoff-trader', side: 'long', type: 'limit', timeframe: '1h', entryLow: band.low, entryHigh: band.high, stopPrice: stop, targetPrice: target, expiresAt: expiry(6), confirmations: ['Wyckoff phase D / SoS', `Skor ${sosScore}/5`, 'Retest last point of support'], score: sosScore, validationStatus: 'research', reason: 'Kandidat riset sign-of-strength dan last-point-of-support; belum boleh dieksekusi otomatis.' });
    }
  }
  const sweepWindow = one.closed.slice(-9, -2); const sweepCandle = one.closed.at(-2)!; const swept = sweepWindow.length >= 5 && sweepCandle.low < Math.min(...sweepWindow.map((bar) => bar.low)); const choch = one.last.close > sweepCandle.high && one.last.close > one.last.open;
  const smcScore = Number(Boolean(zone)) + Number(fib || engulfing) + Number(body >= one.atr * .4) + Number(closeStrength >= .55);
  if (btcStrong && liquid && trendUp && swept && choch && smcScore >= 2) {
    const entry = one.last.high * 1.001; const stop = Math.max(sweepCandle.low - one.atr * .15, entry - one.atr * 1.3); const target = entry + (entry - stop) * 1.5;
    if (valid(entry, stop, target)) {
      candidates.push({ id: id('smc-trader'), pair, agent: 'smc-trader', side: 'long', type: 'stop', timeframe: '1h', entryLow: entry, entryHigh: entry, stopPrice: stop, targetPrice: target, expiresAt: expiry(4), confirmations: ['Sweep + reclaim high 1H', `Skor konteks ${smcScore}/4`, zone ? 'Demand zone' : fib ? 'Fibonacci overlap' : 'Candle reversal'], score: smcScore, validationStatus: 'research', reason: 'Kandidat riset SMC sweep/reclaim; belum boleh dieksekusi otomatis.' });
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
