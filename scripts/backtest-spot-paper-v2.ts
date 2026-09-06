#!/usr/bin/env node
/**
 * Historical validation for the five spot-paper-v2 entry strategies.
 * This is a signal-quality backtest, not a portfolio promise: it uses only
 * closed candles, pending entries, 0.3% fee per side, and pessimistic
 * same-candle stop/target handling.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fetchCoinOhlcv } from '../dashboard/lib/coin-market.js';
import { adx, type OHLCV } from '../lib/indicators.js';
import { CORE_PAIR_IDS, EXTERNAL_PAIR_IDS } from './coin-universe.js';

// Historical validation stays on the stable core plus explicitly configured
// external markets; rotating liquidity additions would introduce survivorship bias.
const PAIRS = [...CORE_PAIR_IDS, ...EXTERNAL_PAIR_IDS];
const AGENTS = ['breakout-specialist', 'aggressive-breakout-trader', 'mean-reversion-trader', 'smc-trader', 'wyckoff-trader'] as const;
type Agent = typeof AGENTS[number];
type Setup = { agent: Agent; entryLow: number; entryHigh: number; stop: number; target: number; expiryBars: number };
type Trade = { agent: Agent; pair: string; openedAt: number; closedAt: number; outcome: 'target' | 'stop' | 'expired'; netReturn: number; plannedRr: number };
type Result = { trades: number; wins: number; winRate: number; avgNetReturn: number; profitFactor: number; maxDrawdown: number; signalsPerMonth: number };
const FEE_PER_SIDE = 0.003;

function mean(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function ema(values: number[], period: number) {
  if (values.length < period) return NaN;
  let value = mean(values.slice(0, period)); const factor = 2 / (period + 1);
  for (let i = period; i < values.length; i++) value = (values[i] - value) * factor + value;
  return value;
}
function rsi(values: number[], period = 14) {
  if (values.length <= period) return NaN;
  let gains = 0; let losses = 0;
  for (let i = values.length - period; i < values.length; i++) { const diff = values[i] - values[i - 1]; gains += Math.max(0, diff); losses += Math.max(0, -diff); }
  return losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
}
function atr(candles: OHLCV[], period = 14) {
  if (candles.length <= period) return NaN;
  const trs = candles.slice(-period).map((candle, index, part) => {
    const previous = index === 0 ? candles[candles.length - period - 1] : part[index - 1];
    return Math.max(candle.high - candle.low, Math.abs(candle.high - previous.close), Math.abs(candle.low - previous.close));
  });
  return mean(trs);
}
function latestAdx(candles: OHLCV[]) { return adx(candles, 14).at(-1) ?? 0; }
function bollinger(values: number[]) {
  const window = values.slice(-20); const mid = mean(window); const deviation = Math.sqrt(mean(window.map(value => (value - mid) ** 2)));
  return { mid, lower: mid - 2 * deviation };
}
function valid(setup: Pick<Setup, 'entryHigh' | 'stop' | 'target'>) {
  const risk = (setup.entryHigh - setup.stop) / setup.entryHigh;
  const reward = (setup.target - setup.entryHigh) / setup.entryHigh;
  return setup.entryHigh > setup.stop && reward >= Math.max(risk * 1.5, 0.01);
}
function limitBand(entry: number, atrValue: number, floor: number, ceiling: number) {
  const high = Math.min(ceiling, entry);
  return { low: Math.max(floor, high - atrValue * 0.3), high };
}
function demandZone(candles: OHLCV[], price: number) {
  const recent = candles.slice(-32); const low = Math.min(...recent.map(c => c.low)); const high = Math.max(...recent.map(c => c.high)); const zoneHigh = low + (high - low) * 0.3;
  return price >= low * 0.995 && price <= zoneHigh * 1.025 ? { low, high: zoneHigh } : null;
}
function fibConfluence(candles: OHLCV[], price: number) {
  const recent = candles.slice(-50); const low = Math.min(...recent.map(c => c.low)); const high = Math.max(...recent.map(c => c.high));
  return [0.382, 0.5, 0.618].some(ratio => Math.abs(price - (high - (high - low) * ratio)) / price < 0.008);
}
function bullishEngulfing(candles: OHLCV[]) { const [previous, last] = candles.slice(-2); return Boolean(previous && last && last.close > last.open && last.close >= previous.open && last.open <= previous.close); }
function priorFourHour(candles: OHLCV[], timestamp: number) { return candles.filter(candle => candle.timestamp + 4 * 3_600_000 <= timestamp).slice(-70); }

function setups(one: OHLCV[], four: OHLCV[], btcFour: OHLCV[]): Setup[] {
  if (one.length < 60 || four.length < 55 || btcFour.length < 55) return [];
  const current = one.at(-1)!; const prior = one.slice(-21, -1); const closes = one.map(c => c.close); const fourCloses = four.map(c => c.close);
  const resistance = Math.max(...prior.map(c => c.high)); const support = Math.min(...prior.map(c => c.low)); const a = atr(one); const volume = current.volume / mean(prior.map(c => c.volume));
  const btcCloses = btcFour.map(candle => candle.close); const btcAdx = latestAdx(btcFour); const btcBullish = ema(btcCloses, 9) >= ema(btcCloses, 21) && btcFour.at(-1)!.close >= ema(btcCloses, 21); const btcStrong = btcBullish && btcAdx >= 18; const btcNeutral = btcFour.at(-1)!.close >= ema(btcCloses, 21) * .985;
  const trendUp = ema(fourCloses, 9) > ema(fourCloses, 21) && four.at(-1)!.close >= ema(fourCloses, 9) && latestAdx(four) >= 22; const fourAdx = latestAdx(four); const out: Setup[] = [];
  const liquid = one.slice(-20).filter(candle => candle.volume > 0).length >= 18 && a / current.close <= .08; const candleRange = Math.max(current.high - current.low, Number.EPSILON); const closeStrength = (current.close - current.low) / candleRange; const body = Math.abs(current.close - current.open);
  const extension = (current.close - resistance) / a;
  const aggressiveScore = Number(volume >= 1.5) + Number(closeStrength >= .7) + Number(body / a >= .5 && body / a <= 1.8) + Number(ema(closes, 9) > ema(closes, 21)) + Number(extension <= .75);
  if (btcStrong && liquid && trendUp && current.close > resistance && aggressiveScore >= 4) {
    const entry = current.high * 1.001; const stop = Math.max(resistance - a * .2, entry - 1.2 * a); const target = entry + (entry - stop) * 1.5;
    if (valid({ entryHigh: entry, stop, target })) out.push({ agent: 'breakout-specialist', entryLow: entry, entryHigh: entry, stop, target, expiryBars: 3 });
  }
  if (btcStrong && liquid && trendUp && fourAdx >= 22 && current.close > resistance && aggressiveScore >= 4) {
    const entry = current.high * 1.001; const stop = Math.max(resistance - a * .2, entry - 1.2 * a); const target = entry + (entry - stop) * 1.5;
    if (valid({ entryHigh: entry, stop, target })) out.push({ agent: 'aggressive-breakout-trader', entryLow: entry, entryHigh: entry, stop, target, expiryBars: 2 });
  }
  const oneEma9 = ema(closes, 9); const oneEma21 = ema(closes, 21); const previousEma9 = ema(closes.slice(0, -1), 9);
  const pullbackScore = Number(current.low <= oneEma21 * 1.003) + Number(one.at(-2)!.close <= previousEma9) + Number(current.close > oneEma9) + Number(current.close > current.open) + Number(rsi(closes) >= 42 && rsi(closes) <= 65);
  if (btcStrong && liquid && trendUp && volume >= 1 && pullbackScore >= 5) {
    const entry = current.high * 1.001; const pullbackLow = Math.min(...one.slice(-6).map(candle => candle.low)); const stop = Math.max(pullbackLow - a * .15, entry - a * 1.3); const target = entry + (entry - stop) * 1.5;
    if (valid({ entryHigh: entry, stop, target })) out.push({ agent: 'mean-reversion-trader', entryLow: entry, entryHigh: entry, stop, target, expiryBars: 2 });
  }
  const zone = demandZone(one, current.close); const fib = fibConfluence(four, current.close); const engulfing = bullishEngulfing(one);
  const wyckoffHistory = one.slice(-41, -1);
  if (wyckoffHistory.length >= 24) {
    const rangeLow = Math.min(...wyckoffHistory.map(bar => bar.low)); const rangeHigh = Math.max(...wyckoffHistory.map(bar => bar.high));
    const ranging4h = fourAdx >= 18 && fourAdx < 30 && ema(fourCloses, 9) >= ema(fourCloses, 21) && Math.abs(ema(fourCloses, 9) - ema(fourCloses, 21)) / ema(fourCloses, 21) < .03;
    const sosScore = Number(current.close > rangeHigh) + Number(volume >= 1.5) + Number(closeStrength >= .7) + Number(body >= a * .5) + Number((rangeHigh - rangeLow) / a <= 7);
    const entry = Math.max(rangeHigh, current.close - a * .25); const band = limitBand(entry, a, rangeHigh, entry); const stop = Math.max(rangeHigh - a * .55, band.high - a * 1.2); const target = band.high + (band.high - stop) * 1.5;
    if (btcStrong && liquid && ranging4h && sosScore >= 5 && valid({ entryHigh: band.high, stop, target })) out.push({ agent: 'wyckoff-trader', entryLow: band.low, entryHigh: band.high, stop, target, expiryBars: 3 });
  }
  const sweepWindow = one.slice(-9, -2); const sweepCandle = one.at(-2)!; const swept = sweepWindow.length >= 5 && sweepCandle.low < Math.min(...sweepWindow.map(c => c.low)); const choch = current.close > sweepCandle.high && current.close > current.open;
  const smcScore = Number(Boolean(zone)) + Number(fib || engulfing) + Number(body >= a * .4) + Number(closeStrength >= .55);
  if (btcStrong && liquid && trendUp && swept && choch && smcScore >= 3) {
    const entry = current.high * 1.001; const stop = Math.max(sweepCandle.low - a * .15, entry - a * 1.3); const target = entry + (entry - stop) * 1.5;
    if (valid({ entryHigh: entry, stop, target })) {
      out.push({ agent: 'smc-trader', entryLow: entry, entryHigh: entry, stop, target, expiryBars: 2 });
    }
  }
  return out;
}

function simulate(agent: Agent, pair: string, candles: OHLCV[], fourHour: OHLCV[], btcFourHour: OHLCV[]) {
  const trades: Trade[] = []; let available = 70;
  for (let index = 70; index < candles.length - 2; index++) {
    if (index < available) continue; const context = candles.slice(Math.max(0, index - 70), index + 1); const four = priorFourHour(fourHour, candles[index].timestamp); const btcFour = priorFourHour(btcFourHour, candles[index].timestamp);
    const setup = setups(context, four, btcFour).find(item => item.agent === agent); if (!setup) continue;
    let filledAt = -1; let entry = 0;
    for (let future = index + 1; future <= Math.min(candles.length - 1, index + setup.expiryBars); future++) {
      const bar = candles[future]; const fills = setup.entryLow === setup.entryHigh ? bar.high >= setup.entryHigh : bar.low <= setup.entryHigh && bar.high >= setup.entryLow;
      if (fills) { filledAt = future; entry = setup.entryLow === setup.entryHigh ? setup.entryHigh : Math.min(setup.entryHigh, Math.max(setup.entryLow, bar.open)); break; }
    }
    if (filledAt < 0) { available = index + setup.expiryBars; continue; }
    const expiryAt = Math.min(candles.length - 1, filledAt + 72);
    let outcome: Trade['outcome'] = 'expired'; let exit = candles[expiryAt].close; let closedAt = expiryAt; let activeStop = setup.stop; const initialRisk = entry - setup.stop;
    for (let future = filledAt; future <= expiryAt; future++) {
      const bar = candles[future]; const hitStop = bar.low <= activeStop; const hitTarget = bar.high >= setup.target;
      if (hitStop || hitTarget) { outcome = hitStop ? 'stop' : 'target'; exit = hitStop ? activeStop : setup.target; closedAt = future; break; }
      // Conservative ordering: breakeven becomes active only after this candle,
      // so a candle that first touches both the old stop and +1R remains a loss.
      if (bar.high >= entry + initialRisk * 1.25) activeStop = Math.max(activeStop, entry * (1 + FEE_PER_SIDE * 2));
    }
    const netReturn = (exit - entry) / entry - 2 * FEE_PER_SIDE;
    trades.push({ agent, pair, openedAt: candles[filledAt].timestamp, closedAt: candles[closedAt].timestamp, outcome, netReturn, plannedRr: (setup.target - entry) / (entry - setup.stop) });
    available = closedAt;
  }
  return trades;
}
function metrics(trades: Trade[]): Result {
  if (!trades.length) return { trades: 0, wins: 0, winRate: 0, avgNetReturn: 0, profitFactor: 0, maxDrawdown: 0, signalsPerMonth: 0 };
  const profits = trades.filter(t => t.netReturn > 0).reduce((s, t) => s + t.netReturn, 0); const losses = Math.abs(trades.filter(t => t.netReturn <= 0).reduce((s, t) => s + t.netReturn, 0));
  let equity = 1; let peak = 1; let maxDrawdown = 0; for (const trade of trades) { equity *= 1 + trade.netReturn; peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, 1 - equity / peak); }
  return { trades: trades.length, wins: trades.filter(t => t.netReturn > 0).length, winRate: trades.filter(t => t.netReturn > 0).length / trades.length, avgNetReturn: mean(trades.map(t => t.netReturn)), profitFactor: losses ? profits / losses : profits ? Infinity : 0, maxDrawdown, signalsPerMonth: trades.length / 12 };
}
function equityCurve(trades: Trade[]) {
  let equity = 1;
  return [...trades].sort((a, b) => a.closedAt - b.closedAt).map((trade) => {
    equity *= 1 + trade.netReturn;
    return { timestamp: trade.closedAt, equity };
  });
}
function compoundedReturn(trades: Trade[]) { return trades.reduce((equity, trade) => equity * (1 + trade.netReturn), 1) - 1; }
function pairEntries(trades: Trade[]) {
  return Object.entries(trades.reduce<Record<string, number>>((counts, trade) => {
    counts[trade.pair] = (counts[trade.pair] ?? 0) + 1; return counts;
  }, {})).sort(([, left], [, right]) => right - left).map(([pair, trades]) => ({ pair, trades }));
}
async function mapLimit<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) { const result: R[] = []; for (let i = 0; i < items.length; i += concurrency) result.push(...await Promise.all(items.slice(i, i + concurrency).map(task))); return result; }

async function main() {
  const bars = Number(process.env.BACKTEST_BARS ?? 8760); console.log(`Downloading ${bars} 1H bars and 4H context for ${PAIRS.length} pairs...`);
  const cachePath = path.resolve(process.cwd(), 'work', `backtest-market-cache-1h-${bars}-${PAIRS.length}pairs.json`);
  const datasets: Array<{ pair: string; one: OHLCV[]; four: OHLCV[] }> = fs.existsSync(cachePath)
    ? JSON.parse(fs.readFileSync(cachePath, 'utf8'))
    : await mapLimit(PAIRS, 3, async pair => ({ pair, one: await fetchCoinOhlcv(pair, '1h', bars), four: await fetchCoinOhlcv(pair, '4h', Math.ceil(bars / 4) + 80) }));
  if (!fs.existsSync(cachePath)) { fs.mkdirSync(path.dirname(cachePath), { recursive: true }); fs.writeFileSync(cachePath, JSON.stringify(datasets)); }
  const btcFour = datasets.find(data => data.pair === 'btcidr')?.four ?? [];
  const all = AGENTS.flatMap(agent => datasets.flatMap(data => simulate(agent, data.pair, data.one, data.four, btcFour)));
  const split = datasets[0]?.one[Math.floor(datasets[0].one.length * .7)]?.timestamp ?? 0;
  const btc = datasets.find(data => data.pair === 'btcidr')?.one ?? [];
  const btcEntry = btc.find(candle => candle.timestamp >= split); const btcExit = btc.at(-1);
  const btcBuyAndHold = btcEntry && btcExit ? { pair: 'btcidr', startedAt: btcEntry.timestamp, endedAt: btcExit.timestamp, grossReturn: btcExit.close / btcEntry.close - 1, netReturn: btcExit.close / btcEntry.close - 1 - 2 * FEE_PER_SIDE } : null;
  const universeBuyAndHold = datasets.map(data => {
    const entry = data.one.find(candle => candle.timestamp >= split); const exit = data.one.at(-1);
    return entry && exit ? { pair: data.pair, netReturn: exit.close / entry.close - 1 - 2 * FEE_PER_SIDE } : null;
  }).filter((value): value is { pair: string; netReturn: number } => value !== null);
  const equalWeightUniverse = { pairs: universeBuyAndHold.length, netReturn: mean(universeBuyAndHold.map(item => item.netReturn)), byPair: [...universeBuyAndHold].sort((left, right) => right.netReturn - left.netReturn) };
  const report = { generatedAt: new Date().toISOString(), assumptions: { bars, feePerSide: FEE_PER_SIDE, pendingOrders: true, sameCandleResolution: 'stop-first (conservative)', inSampleEnd: new Date(split).toISOString() }, benchmark: { btcBuyAndHold, equalWeightUniverse }, byAgent: Object.fromEntries(AGENTS.map(agent => { const trades = all.filter(t => t.agent === agent); const outOfSample = trades.filter(t => t.openedAt >= split); return [agent, { all: metrics(trades), inSample: metrics(trades.filter(t => t.openedAt < split)), outOfSample: metrics(outOfSample), compoundedReturn: compoundedReturn(outOfSample), equityCurve: equityCurve(outOfSample), pairEntries: pairEntries(outOfSample) }]; })), totalTrades: all.length };
  const destination = process.env.BACKTEST_OUTPUT ?? path.resolve(process.cwd(), '..', 'outputs', `spot-paper-v2-backtest-${new Date().toISOString().slice(0, 10)}.json`);
  fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, JSON.stringify({ ...report, trades: all }, null, 2));
  console.table(Object.entries(report.byAgent).map(([agent, value]) => ({ agent, trades: value.outOfSample.trades, winRate: `${(value.outOfSample.winRate * 100).toFixed(1)}%`, avgNet: `${(value.outOfSample.avgNetReturn * 100).toFixed(2)}%`, profitFactor: Number.isFinite(value.outOfSample.profitFactor) ? value.outOfSample.profitFactor.toFixed(2) : '∞', maxDD: `${(value.outOfSample.maxDrawdown * 100).toFixed(1)}%`, tradesPerMonth: value.all.signalsPerMonth.toFixed(1) })));
  console.log(`Backtest report: ${destination}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
