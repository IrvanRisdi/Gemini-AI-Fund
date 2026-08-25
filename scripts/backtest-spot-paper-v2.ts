#!/usr/bin/env node
/**
 * Historical validation for the five spot-paper-v2 entry strategies.
 * This is a signal-quality backtest, not a portfolio promise: it uses only
 * closed candles, pending entries, 0.3% fee per side, and pessimistic
 * same-candle stop/target handling.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fetchOhlcv } from '../dashboard/lib/indodax.js';
import { adx, type OHLCV } from '../lib/indicators.js';

const PAIRS = ['btcidr', 'ethidr', 'solidr', 'xrpidr', 'dogeidr', 'pepeidr', 'suiidr', 'bnbidr', 'trxidr', 'hypeidr', 'linkidr', 'adaidr', 'bchidr', 'tonidr', 'ltcidr', 'hbaridr', 'avaxidr', 'shibidr', 'uniidr'];
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
function valid(setup: Omit<Setup, 'agent' | 'expiryBars'>) { return setup.entryHigh > setup.stop && (setup.target - setup.entryHigh) / (setup.entryHigh - setup.stop) >= 1.5; }
function demandZone(candles: OHLCV[], price: number) {
  const recent = candles.slice(-32); const low = Math.min(...recent.map(c => c.low)); const high = Math.max(...recent.map(c => c.high)); const zoneHigh = low + (high - low) * 0.22;
  return price >= low * 0.995 && price <= zoneHigh * 1.02 ? { low, high: zoneHigh } : null;
}
function fibConfluence(candles: OHLCV[], price: number) {
  const recent = candles.slice(-50); const low = Math.min(...recent.map(c => c.low)); const high = Math.max(...recent.map(c => c.high));
  return [0.382, 0.5, 0.618].some(ratio => Math.abs(price - (high - (high - low) * ratio)) / price < 0.008);
}
function bullishEngulfing(candles: OHLCV[]) { const [previous, last] = candles.slice(-2); return Boolean(previous && last && last.close > last.open && last.close >= previous.open && last.open <= previous.close); }
function priorFourHour(candles: OHLCV[], timestamp: number) { return candles.filter(candle => candle.timestamp <= timestamp).slice(-70); }

function setups(one: OHLCV[], four: OHLCV[]): Setup[] {
  if (one.length < 60 || four.length < 55) return [];
  const current = one.at(-1)!; const prior = one.slice(-21, -1); const closes = one.map(c => c.close); const fourCloses = four.map(c => c.close);
  const resistance = Math.max(...prior.map(c => c.high)); const support = Math.min(...prior.map(c => c.low)); const a = atr(one); const volume = current.volume / mean(prior.map(c => c.volume));
  const trendUp = ema(fourCloses, 9) > ema(fourCloses, 21) && latestAdx(four) >= 22; const fourAdx = latestAdx(four); const out: Setup[] = [];
  if (trendUp && current.close > resistance && volume >= 1.5) {
    const entry = resistance; const stop = Math.min(support, entry - 1.2 * a); const target = entry + Math.max(resistance - support, (entry - stop) * 1.5);
    if (valid({ entryHigh: entry, stop, target })) out.push({ agent: 'breakout-specialist', entryLow: entry * .997, entryHigh: entry * 1.003, stop, target, expiryBars: 12 });
  }
  if (trendUp && current.close > resistance && volume >= 2 && fourAdx >= 25) {
    const entry = current.close * 1.002; const stop = Math.max(resistance * .992, entry - 1.5 * a); const target = entry + (entry - stop) * 2;
    if (valid({ entryHigh: entry, stop, target })) out.push({ agent: 'aggressive-breakout-trader', entryLow: entry, entryHigh: entry, stop, target, expiryBars: 6 });
  }
  const bb = bollinger(closes);
  if (fourAdx < 20 && ema(fourCloses, 9) <= ema(fourCloses, 21) * 1.01 && rsi(closes) < 30 && current.close <= bb.lower) {
    const entry = Math.min(current.close, bb.lower); const stop = entry - 1.5 * a;
    if (valid({ entryHigh: entry, stop, target: bb.mid })) out.push({ agent: 'mean-reversion-trader', entryLow: entry * .992, entryHigh: entry, stop, target: bb.mid, expiryBars: 12 });
  }
  const zone = demandZone(one, current.close); const trigger = fibConfluence(four, current.close) || bullishEngulfing(one);
  if (zone && trigger) {
    const stop = zone.low - a * .25; const target = Math.max(resistance, zone.high + (zone.high - stop) * 1.5);
    if (valid({ entryHigh: zone.high, stop, target })) {
      const recent = one.slice(-7, -1); const swept = recent.at(-2)!.low < Math.min(...recent.slice(0, -2).map(c => c.low)); const choch = current.close > Math.max(...recent.slice(0, -1).map(c => c.high));
      if (swept && choch) out.push({ agent: 'smc-trader', entryLow: zone.low, entryHigh: zone.high, stop, target, expiryBars: 16 });
      const [spring, test] = one.slice(-3, -1); if (spring && test && spring.low < support && spring.close > support && test.low >= spring.low && test.close > test.open) out.push({ agent: 'wyckoff-trader', entryLow: zone.low, entryHigh: zone.high, stop, target, expiryBars: 16 });
    }
  }
  return out;
}

function simulate(agent: Agent, pair: string, candles: OHLCV[], fourHour: OHLCV[]) {
  const trades: Trade[] = []; let available = 70;
  for (let index = 70; index < candles.length - 2; index++) {
    if (index < available) continue; const context = candles.slice(Math.max(0, index - 70), index + 1); const four = priorFourHour(fourHour, candles[index].timestamp);
    const setup = setups(context, four).find(item => item.agent === agent); if (!setup) continue;
    let filledAt = -1; let entry = 0;
    for (let future = index + 1; future <= Math.min(candles.length - 1, index + setup.expiryBars); future++) {
      const bar = candles[future]; const fills = setup.entryLow === setup.entryHigh ? bar.high >= setup.entryHigh : bar.low <= setup.entryHigh && bar.high >= setup.entryLow;
      if (fills) { filledAt = future; entry = setup.entryLow === setup.entryHigh ? setup.entryHigh : Math.min(setup.entryHigh, Math.max(setup.entryLow, bar.open)); break; }
    }
    if (filledAt < 0) { available = index + setup.expiryBars; continue; }
    const expiryAt = Math.min(candles.length - 1, filledAt + 72);
    let outcome: Trade['outcome'] = 'expired'; let exit = candles[expiryAt].close; let closedAt = expiryAt;
    for (let future = filledAt; future <= expiryAt; future++) {
      const bar = candles[future]; const hitStop = bar.low <= setup.stop; const hitTarget = bar.high >= setup.target;
      if (hitStop || hitTarget) { outcome = hitStop ? 'stop' : 'target'; exit = hitStop ? setup.stop : setup.target; closedAt = future; break; }
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
async function mapLimit<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) { const result: R[] = []; for (let i = 0; i < items.length; i += concurrency) result.push(...await Promise.all(items.slice(i, i + concurrency).map(task))); return result; }

async function main() {
  const bars = Number(process.env.BACKTEST_BARS ?? 8760); console.log(`Downloading ${bars} 1H bars and 4H context for ${PAIRS.length} pairs...`);
  const datasets = await mapLimit(PAIRS, 3, async pair => ({ pair, one: await fetchOhlcv(pair, '1h', bars), four: await fetchOhlcv(pair, '4h', Math.ceil(bars / 4) + 80) }));
  const all = AGENTS.flatMap(agent => datasets.flatMap(data => simulate(agent, data.pair, data.one, data.four)));
  const split = datasets[0]?.one[Math.floor(datasets[0].one.length * .7)]?.timestamp ?? 0;
  const report = { generatedAt: new Date().toISOString(), assumptions: { bars, feePerSide: FEE_PER_SIDE, pendingOrders: true, sameCandleResolution: 'stop-first (conservative)', inSampleEnd: new Date(split).toISOString() }, byAgent: Object.fromEntries(AGENTS.map(agent => { const trades = all.filter(t => t.agent === agent); return [agent, { all: metrics(trades), inSample: metrics(trades.filter(t => t.openedAt < split)), outOfSample: metrics(trades.filter(t => t.openedAt >= split)) }]; })), totalTrades: all.length };
  const destination = process.env.BACKTEST_OUTPUT ?? path.resolve(process.cwd(), '..', 'outputs', `spot-paper-v2-backtest-${new Date().toISOString().slice(0, 10)}.json`);
  fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, JSON.stringify({ ...report, trades: all }, null, 2));
  console.table(Object.entries(report.byAgent).map(([agent, value]) => ({ agent, trades: value.outOfSample.trades, winRate: `${(value.outOfSample.winRate * 100).toFixed(1)}%`, avgNet: `${(value.outOfSample.avgNetReturn * 100).toFixed(2)}%`, profitFactor: Number.isFinite(value.outOfSample.profitFactor) ? value.outOfSample.profitFactor.toFixed(2) : '∞', maxDD: `${(value.outOfSample.maxDrawdown * 100).toFixed(1)}%`, tradesPerMonth: value.all.signalsPerMonth.toFixed(1) })));
  console.log(`Backtest report: ${destination}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

