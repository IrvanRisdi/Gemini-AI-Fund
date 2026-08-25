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
  return { last, closes, adx: adx(closed, 14).at(-1)!, ema9: ema(closes, 9).at(-1)!, ema21: ema(closes, 21).at(-1)!, rsi: rsi(closes, 14).at(-1)!, atr: atr(closed, 14).at(-1)!, upper: bands.upper.at(-1)!, lower: bands.lower.at(-1)!, mid: bands.middle.at(-1)!, resistance: Math.max(...prior.map((c) => c.high)), support: Math.min(...prior.map((c) => c.low)), vol: av > 0 ? last.volume / av : 0, closed };
}
function valid(entry: number, stop: number, target: number) { return stop > 0 && entry > stop && (target - entry) / (entry - stop) >= 1.5; }
function expiry(hours: number) { return new Date(Date.now() + hours * 3_600_000).toISOString(); }
function demandZone(candles: OHLCV[], current: number) {
  const recent = candles.slice(-32, -1); const low = Math.min(...recent.map((c) => c.low)); const high = Math.max(...recent.map((c) => c.high));
  const zoneHigh = low + (high - low) * 0.22; return current >= low * 0.995 && current <= zoneHigh * 1.02 ? { low, high: zoneHigh } : null;
}
function fibConfluence(candles: OHLCV[], price: number) {
  const recent = candles.slice(-50, -1); const low = Math.min(...recent.map((c) => c.low)); const high = Math.max(...recent.map((c) => c.high));
  return [0.382, 0.5, 0.618].some((ratio) => Math.abs(price - (high - (high - low) * ratio)) / price < 0.008);
}
function bullishCandle(candles: OHLCV[]) { const [prev, last] = candles.slice(-3, -1); return !!prev && !!last && last.close > last.open && last.close >= prev.open && last.open <= prev.close; }

async function scanPair(pair: string): Promise<Candidate[]> {
  const [oneHour, fourHour] = await Promise.all([fetchOhlcv(pair, '1h', 140), fetchOhlcv(pair, '4h', 140)]);
  const one = metric(oneHour); const four = metric(fourHour); if (!one || !four) return [];
  const candidates: Candidate[] = []; const trendUp = four.ema9 > four.ema21 && four.adx >= 22; const zone = demandZone(oneHour, one.last.close);
  const id = (owner: Owner) => `${owner}-${pair}-${Date.now()}`;

  // Breakout: use a pullback pending order rather than chasing the breakout candle.
  if (trendUp && one.last.close > one.resistance && one.vol >= 1.5) {
    const entry = one.resistance; const stop = Math.min(one.support, entry - 1.2 * one.atr); const target = entry + Math.max(one.resistance - one.support, (entry - stop) * 1.5);
    if (valid(entry, stop, target)) candidates.push({ id: id('breakout-specialist'), pair, agent: 'breakout-specialist', side: 'long', type: 'limit', timeframe: '1h', entryLow: entry * 0.997, entryHigh: entry * 1.003, stopPrice: stop, targetPrice: target, expiresAt: expiry(12), confirmations: ['Trend 4H', 'Close breakout 1H', 'Volume ≥1.5x'], score: 3, reason: 'Breakout 1H searah tren 4H; menunggu retest level breakout.' });
  }
  // Aggressive is a premium stop-entry and never pyramids.
  if (trendUp && one.last.close > one.resistance && one.vol >= 2 && four.adx >= 25) {
    const entry = one.last.close * 1.002; const stop = Math.max(one.resistance * 0.992, entry - 1.5 * one.atr); const target = entry + (entry - stop) * 2;
    if (valid(entry, stop, target)) candidates.push({ id: id('aggressive-breakout-trader'), pair, agent: 'aggressive-breakout-trader', side: 'long', type: 'stop', timeframe: '1h', entryLow: entry, entryHigh: entry, stopPrice: stop, targetPrice: target, expiresAt: expiry(6), confirmations: ['Trend 4H kuat', 'Volume ≥2x', 'Breakout close 1H'], score: 4, reason: 'Breakout premium; stop entry hanya bila harga melanjutkan momentum.' });
  }
  // Mean reversion is allowed only in a verified ranging 4H regime.
  if (four.adx < 20 && four.ema9 <= four.ema21 * 1.01 && one.rsi < 30 && one.last.close <= one.lower) {
    const entry = Math.min(one.last.close, one.lower); const stop = entry - 1.5 * one.atr; const target = one.mid;
    if (valid(entry, stop, target)) candidates.push({ id: id('mean-reversion-trader'), pair, agent: 'mean-reversion-trader', side: 'long', type: 'limit', timeframe: '1h', entryLow: entry * 0.992, entryHigh: entry, stopPrice: stop, targetPrice: target, expiresAt: expiry(12), confirmations: ['Range 4H', 'RSI oversold', 'Bollinger lower band'], score: 3, reason: 'Reversion long dalam regime range; menunggu limit fill di area ekstrem.' });
  }
  // SMC / Wyckoff own their campaign, while S&D is mandatory and Fib OR candle is the trigger.
  const trigger = fibConfluence(fourHour, one.last.close) ? 'Fibonacci overlap' : bullishCandle(oneHour) ? 'Bullish engulfing 1H' : null;
  if (zone && trigger) {
    const stop = zone.low - one.atr * 0.25; const target = Math.max(one.resistance, zone.high + (zone.high - stop) * 1.5);
    if (valid(zone.high, stop, target)) {
      const smc = detectSweepChochConfluence(oneHour, 5);
      if (smc?.choch === 'bullish') candidates.push({ id: id('smc-trader'), pair, agent: 'smc-trader', side: 'long', type: 'limit', timeframe: '1h', entryLow: zone.low, entryHigh: zone.high, stopPrice: stop, targetPrice: target, expiresAt: expiry(16), confirmations: ['Fresh demand zone', 'Sweep + CHoCH', trigger], score: 3 + (trigger === 'Fibonacci overlap' ? 1 : 0), reason: 'SMC bullish dengan zona demand sebagai lokasi entry.' });
      const bars = one.closed.slice(-3); const spring = bars[0] && bars[1] && bars[0].low < one.support && bars[0].close > one.support && bars[1].low >= bars[0].low && bars[1].close > bars[1].open;
      if (spring) candidates.push({ id: id('wyckoff-trader'), pair, agent: 'wyckoff-trader', side: 'long', type: 'limit', timeframe: '1h', entryLow: zone.low, entryHigh: zone.high, stopPrice: stop, targetPrice: target, expiresAt: expiry(16), confirmations: ['Spring + Test', 'Fresh demand zone', trigger], score: 3 + (trigger === 'Fibonacci overlap' ? 1 : 0), reason: 'Wyckoff Spring/Test dengan demand zone sebagai entry.' });
    }
  }
  return candidates;
}

async function main() {
  const results = await Promise.allSettled(PAIRS.map(scanPair)); const candidates: Candidate[] = []; const errors: string[] = [];
  for (const result of results) result.status === 'fulfilled' ? candidates.push(...result.value) : errors.push(String(result.reason));
  const output = { timestamp: new Date().toISOString(), mode: 'spot-only-v2', pairsScanned: PAIRS.length, candidates, errors };
  fs.writeFileSync(path.join(process.cwd(), '.desk', 'latest-scan.json'), JSON.stringify(output, null, 2) + '\n'); console.log(JSON.stringify(output, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
