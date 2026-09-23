#!/usr/bin/env node
/** Spot-only paper executor. Scanner candidates become pending orders first.
 * Market prices are Binance USDT; all cash, risk, fees and equity remain IDR. */
import fs from 'node:fs';
import path from 'node:path';
import type { OHLCV } from '../lib/indicators.js';
import { fetchCoinMarketSnapshot, fetchCoinOhlcv, usdtPriceKey } from '../dashboard/lib/coin-market.js';
import { displayPair, type UniversePair } from './coin-universe.js';
import { meetsMinimumPaperNotional, MIN_PAPER_NOTIONAL_IDR, netRewardRisk, paperRiskPolicy, paperStrategyCanExecute, validNetPlan } from './trading-math.js';

const DESK = path.join(process.cwd(), '.desk');
const LEDGER = path.join(DESK, 'paper-ledger.json');
const SCAN = path.join(DESK, 'latest-scan.json');
const STATE = path.join(DESK, 'state.json');
const EQUITY_HISTORY = path.join(DESK, 'equity-history.json');
const COIN_STRATEGY_VERSION = 'recovery-v4-usdt';
const DEFAULT_MAX_NOTIONAL_PER_PAIR = 0.50;
const BREAKOUT_INITIAL_ALLOCATION = 0.20;
const BREAKOUT_MAX_NOTIONAL = 0.95;
const CASH_RESERVE_PCT = 0.10;
const FEE_RATE = 0.003;
const ATTEMPT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const ALLOW_RESEARCH_ORDERS = process.env.COIN_ALLOW_RESEARCH_ORDERS === 'true';
const OWNERS = new Set(['breakout-specialist', 'aggressive-breakout-trader', 'mean-reversion-trader', 'smc-trader', 'wyckoff-trader']);

type QuoteCurrency = 'IDR' | 'USDT';
type Pending = { id: string; campaignId: string; agent?: string; pair: string; side: 'long'; quoteCurrency?: QuoteCurrency; fxRateAtSignal?: number; type: 'limit' | 'stop'; entryLow: number; entryHigh: number; stopPrice: number; targetPrice: number; riskReservedIdr: number; notionalReservedIdr: number; expiresAt: string; createdAt: string; status: 'pending' | 'filled' | 'cancelled' | 'expired' | 'rejected'; confirmations: string[]; reason: string; score?: number; volumeRatio?: number; allocationPct?: number; rewardMultiple?: number; strategyVersion?: string; };
type Position = { side: 'long'; quoteCurrency?: QuoteCurrency; fxRateAtEntry?: number; costBasisIdr?: number; size: number; entryPrice: number; initialEntryPrice?: number; stopPrice: number; targetPrice: number; opened: string; campaignId: string; leg: number; initialRiskPerUnit: number; sizingNote: string; strategyVersion?: string; };
type Trade = { timestamp: string; instrument: string; side: 'long'; type: 'open' | 'close' | 'add'; size: number; price: number; priceCurrency?: QuoteCurrency; priceIdr?: number; fxRate?: number; realizedPnlIdr?: number; reason: string; campaignId: string; confirmations?: string[]; feeIdr?: number; maintenance?: boolean; strategyVersion?: string };
type Book = { balance: { IDR: number }; positions: Record<string, Position>; pendingOrders: Pending[]; trades: Trade[] };
type Ledger = { created?: string; last_cycle: string; starting_balance_per_agent?: number; agents: Record<string, Book> };
type Candidate = Omit<Pending, 'campaignId' | 'fxRateAtSignal' | 'riskReservedIdr' | 'notionalReservedIdr' | 'createdAt' | 'status'> & { agent: string; score: number; quoteCurrency: 'USDT'; validationStatus: 'validated' | 'research' };
type AllocationContext = { campaignId?: string; agent?: string; allocationPct?: number };
type EquityHistoryPoint = { date: string; capturedAt: string; kind: 'baseline' | 'snapshot'; totalEquity: number; agents: Record<string, { equity: number }> };
type EquityHistory = { version: 1; timezone: 'Asia/Jakarta'; points: EquityHistoryPoint[] };

function read<T>(file: string): T { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; }
function write(file: string, value: unknown) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function now() { return new Date().toISOString(); }
function campaignId(agent: string, pair: string) { return `${agent}-${pair}-${Date.now()}`; }
function priceForUsdt(pair: string, prices: Record<string, number>) { return prices[usdtPriceKey(pair)] ?? 0; }
function quoteMultiplier(currency: QuoteCurrency | undefined, usdtIdr: number) { return currency === 'USDT' ? usdtIdr : 1; }
function currentQuotePrice(pair: string, currency: QuoteCurrency | undefined, pricesUsdt: Record<string, number>, usdtIdr: number) {
  const priceUsdt = priceForUsdt(pair, pricesUsdt);
  return currency === 'USDT' ? priceUsdt : priceUsdt * usdtIdr;
}
function hasLiveCampaign(book: Book, pair: string) { return Boolean(book.positions[pair]) || book.pendingOrders.some((order) => order.pair === pair && order.status === 'pending'); }
function hasRecentAttempt(book: Book, pair: string, timestamp: string) {
  const cutoff = Date.parse(timestamp) - ATTEMPT_COOLDOWN_MS;
  return book.pendingOrders.some((order) => order.pair === pair && order.strategyVersion === COIN_STRATEGY_VERSION && Date.parse(order.createdAt) >= cutoff);
}
function accountEquity(book: Book, pricesUsdt: Record<string, number>, usdtIdr: number) {
  return book.balance.IDR + Object.entries(book.positions).reduce((total, [pair, position]) => {
    const market = currentQuotePrice(pair, position.quoteCurrency, pricesUsdt, usdtIdr) || position.entryPrice;
    return total + position.size * market * quoteMultiplier(position.quoteCurrency, usdtIdr);
  }, 0);
}

function jakartaDate(iso: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function updateDailyEquityHistory(ledger: Ledger, pricesUsdt: Record<string, number>, usdtIdr: number, timestamp: string) {
  let history: EquityHistory = { version: 1, timezone: 'Asia/Jakarta', points: [] };
  try {
    history = read<EquityHistory>(EQUITY_HISTORY);
    if (!Array.isArray(history.points)) history.points = [];
  } catch {
    // The collector starts from a verified starting-capital baseline.
  }

  const agents = Object.fromEntries(Object.entries(ledger.agents).map(([slug, book]) => [
    slug,
    { equity: Math.round(accountEquity(book, pricesUsdt, usdtIdr) * 100) / 100 },
  ]));
  const totalEquity = Math.round(Object.values(agents).reduce((sum, item) => sum + item.equity, 0) * 100) / 100;
  const date = jakartaDate(timestamp);

  if (history.points.length === 0 && ledger.created && ledger.starting_balance_per_agent) {
    const baselineDate = jakartaDate(ledger.created);
    if (baselineDate !== date) {
      const baselineAgents = Object.fromEntries(Object.keys(ledger.agents).map((slug) => [slug, { equity: ledger.starting_balance_per_agent! }]));
      history.points.push({
        date: baselineDate,
        capturedAt: ledger.created,
        kind: 'baseline',
        totalEquity: ledger.starting_balance_per_agent * Object.keys(baselineAgents).length,
        agents: baselineAgents,
      });
    }
  }

  const point: EquityHistoryPoint = { date, capturedAt: timestamp, kind: 'snapshot', totalEquity, agents };
  const existingIndex = history.points.findIndex((item) => item.date === date && item.kind === 'snapshot');
  if (existingIndex >= 0) history.points[existingIndex] = point;
  else history.points.push(point);
  history.points.sort((left, right) => left.date.localeCompare(right.date));
  history.points = history.points.slice(-400);
  write(EQUITY_HISTORY, history);
}
function activeCampaigns(book: Book) { return Object.keys(book.positions).length + book.pendingOrders.filter((order) => order.status === 'pending').length; }
function reservedCash(book: Book, excludeId?: string) { return book.pendingOrders.filter((order) => order.status === 'pending' && order.id !== excludeId).reduce((total, order) => total + (order.notionalReservedIdr ?? 0), 0); }
function reservedRisk(book: Book, usdtIdr: number, excludeId?: string) {
  const openRisk = Object.values(book.positions).reduce((total, position) => total + position.size * netRewardRisk(position.entryPrice, position.stopPrice, position.targetPrice).netRisk * quoteMultiplier(position.quoteCurrency, usdtIdr), 0);
  const pendingRisk = book.pendingOrders.filter((order) => order.status === 'pending' && order.id !== excludeId).reduce((total, order) => total + order.riskReservedIdr, 0);
  return openRisk + pendingRisk;
}
// Research strategies remain visible as shadow signals but cannot allocate
// capital by default. This can only be overridden explicitly for experiments.
function valid(candidate: Candidate) {
  return paperStrategyCanExecute(candidate.validationStatus, ALLOW_RESEARCH_ORDERS)
    && candidate.side === 'long'
    && validNetPlan(candidate.entryHigh, candidate.stopPrice, candidate.targetPrice, candidate.rewardMultiple ?? 1.5);
}
function isAgent(order: AllocationContext, agent: string) {
  return order.agent === agent || order.campaignId?.startsWith(`${agent}-`);
}
function allocationCap(order: AllocationContext) {
  if (isAgent(order, 'breakout-specialist')) return BREAKOUT_INITIAL_ALLOCATION;
  return Math.min(1, Math.max(.25, order.allocationPct ?? DEFAULT_MAX_NOTIONAL_PER_PAIR));
}
function cashReservePct(order: AllocationContext) {
  return isAgent(order, 'aggressive-breakout-trader') && (order.allocationPct ?? 0) >= 1 ? 0 : CASH_RESERVE_PCT;
}

function cleanDustPositions(book: Book, pricesUsdt: Record<string, number>, usdtIdr: number, timestamp: string) {
  for (const [pair, position] of Object.entries(book.positions)) {
    // Only migrate positions that were already dust when they were opened.
    // A valid position that later falls below the threshold must remain under
    // its strategy stop/target rules, not acquire a hidden Rp500k exit rule.
    const multiplier = quoteMultiplier(position.quoteCurrency, position.fxRateAtEntry ?? usdtIdr);
    if (meetsMinimumPaperNotional(position.size, position.entryPrice * multiplier)) continue;
    const price = currentQuotePrice(pair, position.quoteCurrency, pricesUsdt, usdtIdr);
    if (!price) continue;
    const currentMultiplier = quoteMultiplier(position.quoteCurrency, usdtIdr);
    const proceeds = price * position.size * currentMultiplier;
    const fee = proceeds * FEE_RATE;
    const gross = proceeds - (position.costBasisIdr ?? position.entryPrice * position.size * multiplier);
    book.balance.IDR += proceeds - fee;
    delete book.positions[pair];
    book.trades.push({
      timestamp,
      instrument: pair,
      side: 'long',
      type: 'close',
      size: position.size,
      price,
      priceCurrency: position.quoteCurrency ?? 'IDR',
      priceIdr: price * currentMultiplier,
      fxRate: position.quoteCurrency === 'USDT' ? usdtIdr : undefined,
      realizedPnlIdr: gross - fee,
      reason: `Maintenance: posisi dust di bawah Rp${MIN_PAPER_NOTIONAL_IDR.toLocaleString('id-ID')} ditutup`,
      campaignId: position.campaignId,
      feeIdr: fee,
      maintenance: true,
      strategyVersion: position.strategyVersion,
    });
  }
}

async function pendingTouches(ledger: Ledger) {
  const pairs = [...new Set(Object.values(ledger.agents).flatMap((book) => book.pendingOrders.filter((order) => order.status === 'pending').map((order) => order.pair)))];
  const entries = await Promise.all(pairs.map(async (pair) => {
    try { return [pair, await fetchCoinOhlcv(pair, '1m', 30)] as const; }
    catch { return [pair, [] as OHLCV[]] as const; }
  }));
  return new Map(entries);
}

function reserveCandidate(book: Book, candidate: Candidate, timestamp: string, pricesUsdt: Record<string, number>, usdtIdr: number): Pending | null {
  const equity = accountEquity(book, pricesUsdt, usdtIdr);
  const policy = paperRiskPolicy(equity);
  if (!valid(candidate) || hasLiveCampaign(book, candidate.pair) || hasRecentAttempt(book, candidate.pair, timestamp) || activeCampaigns(book) >= policy.maxCampaigns) return null;
  const riskPerUnit = netRewardRisk(candidate.entryHigh, candidate.stopPrice, candidate.targetPrice).netRisk * usdtIdr;
  const cap = allocationCap(candidate);
  const cashAvailable = Math.max(0, book.balance.IDR - equity * cashReservePct(candidate) - reservedCash(book));
  const riskAvailable = Math.max(0, equity * policy.maxAggregateRisk - reservedRisk(book, usdtIdr));
  const size = Math.min(
    (equity * cap) / (candidate.entryHigh * usdtIdr),
    (equity * policy.riskPerCampaign) / riskPerUnit,
    riskAvailable / riskPerUnit,
    cashAvailable / (candidate.entryHigh * usdtIdr * (1 + FEE_RATE)),
  );
  const risk = size * riskPerUnit; const notionalReservedIdr = size * candidate.entryHigh * usdtIdr * (1 + FEE_RATE);
  if (!Number.isFinite(size) || size <= 0 || risk <= 0 || !meetsMinimumPaperNotional(size, candidate.entryHigh * usdtIdr)) return null;
  return { ...candidate, fxRateAtSignal: usdtIdr, campaignId: campaignId(candidate.agent, candidate.pair), riskReservedIdr: risk, notionalReservedIdr, createdAt: timestamp, status: 'pending' };
}

function fill(book: Book, order: Pending, price: number, timestamp: string, pricesUsdt: Record<string, number>, usdtIdr: number) {
  const fillPrice = order.type === 'stop' ? Math.max(price, order.entryHigh) : Math.min(Math.max(price, order.entryLow), order.entryHigh);
  const multiplier = quoteMultiplier(order.quoteCurrency, usdtIdr);
  const priceRiskPerUnit = fillPrice - order.stopPrice;
  const riskPerUnit = netRewardRisk(fillPrice, order.stopPrice, order.targetPrice).netRisk * multiplier;
  const equity = accountEquity(book, pricesUsdt, usdtIdr);
  const policy = paperRiskPolicy(equity);
  const cap = allocationCap(order);
  const cashAvailable = Math.max(0, book.balance.IDR - equity * cashReservePct(order) - reservedCash(book, order.id));
  const riskAvailable = Math.max(0, equity * policy.maxAggregateRisk - reservedRisk(book, usdtIdr, order.id));
  // Allocation is strategy-specific. Breakout starts at 20% and pyramids;
  // aggressive momentum can deploy nearly all available cash at conviction 5.
  const size = Math.min(
    (equity * cap) / (fillPrice * multiplier),
    (equity * policy.riskPerCampaign) / riskPerUnit,
    riskAvailable / riskPerUnit,
    cashAvailable / (fillPrice * multiplier * (1 + FEE_RATE)),
  );
  const notional = fillPrice * size * multiplier;
  if (!Number.isFinite(size) || size <= 0 || fillPrice <= order.stopPrice || !meetsMinimumPaperNotional(size, fillPrice * multiplier)) { order.status = 'rejected'; return; }
  const fee = notional * FEE_RATE;
  if (notional + fee > book.balance.IDR + 1) { order.status = 'rejected'; return; }
  // Spot purchases spend both notional and fee. This prevents later fills
  // from sizing against capital that is already tied up in a position.
  book.balance.IDR -= notional + fee;
  book.positions[order.pair] = { side: 'long', quoteCurrency: order.quoteCurrency ?? 'USDT', fxRateAtEntry: usdtIdr, costBasisIdr: notional, size, entryPrice: fillPrice, initialEntryPrice: fillPrice, stopPrice: order.stopPrice, targetPrice: order.targetPrice, opened: timestamp, campaignId: order.campaignId, leg: 1, initialRiskPerUnit: priceRiskPerUnit, sizingNote: `Spot-only ${order.quoteCurrency ?? 'USDT'} | Alokasi awal ${(cap * 100).toFixed(0)}% | Risiko harga ${((priceRiskPerUnit / fillPrice) * 100).toFixed(2)}% | Risiko equity maks. ${(policy.riskPerCampaign * 100).toFixed(0)}% (${policy.mode}) | Fee masuk Rp${Math.round(fee).toLocaleString('id-ID')}`, strategyVersion: order.strategyVersion };
  order.status = 'filled';
  book.trades.push({ timestamp, instrument: order.pair, side: 'long', type: 'open', size, price: fillPrice, priceCurrency: order.quoteCurrency ?? 'USDT', priceIdr: fillPrice * multiplier, fxRate: order.quoteCurrency === 'USDT' ? usdtIdr : undefined, reason: order.reason, campaignId: order.campaignId, confirmations: order.confirmations, feeIdr: fee, strategyVersion: order.strategyVersion });
}

function pyramidBreakout(book: Book, pair: string, position: Position, price: number, timestamp: string, pricesUsdt: Record<string, number>, usdtIdr: number) {
  if (position.leg >= 4) return;
  const initialRisk = position.initialRiskPerUnit;
  const initialEntry = position.initialEntryPrice ?? position.entryPrice;
  const addThresholds = [.5, 1, 1.5];
  const threshold = addThresholds[position.leg - 1] ?? 1.5;
  if (initialRisk <= 0 || price < initialEntry + initialRisk * threshold) return;
  const multiplier = quoteMultiplier(position.quoteCurrency, usdtIdr);
  const currentNotional = position.size * price * multiplier;
  const equity = accountEquity(book, pricesUsdt, usdtIdr);
  const policy = paperRiskPolicy(equity);
  const capacity = Math.max(0, equity * BREAKOUT_MAX_NOTIONAL - currentNotional);
  const cashAvailable = Math.max(0, book.balance.IDR - equity * .05 - reservedCash(book));
  const addRiskPerUnit = netRewardRisk(price, position.stopPrice, position.targetPrice).netRisk * multiplier;
  if (addRiskPerUnit <= 0) return;
  const riskCapacity = Math.max(0, equity * policy.maxAggregateRisk - reservedRisk(book, usdtIdr));
  const addSize = Math.min(
    (equity * BREAKOUT_INITIAL_ALLOCATION) / (price * multiplier * (1 + FEE_RATE)),
    capacity / (price * multiplier),
    riskCapacity / addRiskPerUnit,
    cashAvailable / (price * multiplier * (1 + FEE_RATE)),
  );
  if (!Number.isFinite(addSize) || addSize <= 0) return;
  const oldQuoteNotional = position.size * position.entryPrice;
  const addQuoteNotional = addSize * price;
  const addNotional = addQuoteNotional * multiplier;
  if (!meetsMinimumPaperNotional(addSize, price * multiplier)) return;
  const addFee = addNotional * FEE_RATE;
  if (addNotional + addFee > book.balance.IDR + 1) return;
  position.entryPrice = (oldQuoteNotional + addQuoteNotional) / (position.size + addSize);
  position.costBasisIdr = (position.costBasisIdr ?? oldQuoteNotional * quoteMultiplier(position.quoteCurrency, position.fxRateAtEntry ?? usdtIdr)) + addNotional;
  position.size += addSize;
  position.leg += 1;
  position.initialEntryPrice = initialEntry;
  if (position.leg >= 3) position.stopPrice = Math.max(position.stopPrice, initialEntry * (1 + FEE_RATE * 2));
  if (position.leg >= 4) position.stopPrice = Math.max(position.stopPrice, initialEntry + initialRisk * .5);
  book.balance.IDR -= addNotional + addFee;
  book.trades.push({ timestamp, instrument: pair, side: 'long', type: 'add', size: addSize, price, priceCurrency: position.quoteCurrency ?? 'IDR', priceIdr: price * multiplier, fxRate: position.quoteCurrency === 'USDT' ? usdtIdr : undefined, reason: `Jesse Livermore pyramid leg ${position.leg}/4 setelah +${threshold}R`, campaignId: position.campaignId, feeIdr: addFee, strategyVersion: position.strategyVersion });
}

function close(book: Book, pair: string, position: Position, price: number, timestamp: string, reason: string, usdtIdr: number) {
  const multiplier = quoteMultiplier(position.quoteCurrency, usdtIdr);
  const proceeds = price * position.size * multiplier;
  const gross = proceeds - (position.costBasisIdr ?? position.entryPrice * position.size * quoteMultiplier(position.quoteCurrency, position.fxRateAtEntry ?? usdtIdr)); const fee = proceeds * FEE_RATE; const pnl = gross - fee;
  // Return the full sale proceeds because the entry notional was removed from
  // cash when the position was opened; realized P&L remains reported below.
  book.balance.IDR += proceeds - fee; delete book.positions[pair];
  book.trades.push({ timestamp, instrument: pair, side: 'long', type: 'close', size: position.size, price, priceCurrency: position.quoteCurrency ?? 'IDR', priceIdr: price * multiplier, fxRate: position.quoteCurrency === 'USDT' ? usdtIdr : undefined, realizedPnlIdr: pnl, reason, campaignId: position.campaignId, feeIdr: fee, strategyVersion: position.strategyVersion });
}

async function main() {
  const ledger = read<Ledger>(LEDGER); const scan = read<{ candidates?: Candidate[]; universe?: UniversePair[] }>(SCAN); const state = read<{ agents?: Record<string, { status: string; last_action?: string; assets_covered?: string[] }> }>(STATE); const { pricesUsdt, usdtIdr } = await fetchCoinMarketSnapshot(); const timestamp = now(); const touches = await pendingTouches(ledger);
  for (const [agent, book] of Object.entries(ledger.agents)) {
    book.positions ??= {}; book.pendingOrders ??= []; book.trades ??= [];
    cleanDustPositions(book, pricesUsdt, usdtIdr, timestamp);
    for (const order of book.pendingOrders.filter((item) => item.status === 'pending')) {
      // Cancel unfilled orders produced by the former loose gates. Existing
      // filled positions continue under their original stop/target plan.
      if (order.strategyVersion !== COIN_STRATEGY_VERSION) {
        order.status = 'cancelled';
        continue;
      }
      if (order.entryLow > order.entryHigh || !validNetPlan(order.entryHigh, order.stopPrice, order.targetPrice, order.rewardMultiple ?? 1.5)) {
        order.status = 'rejected';
        continue;
      }
      const price = currentQuotePrice(order.pair, order.quoteCurrency, pricesUsdt, usdtIdr);
      if (timestamp >= order.expiresAt) { order.status = 'expired'; continue; }
      const created = Date.parse(order.createdAt); const bars = (touches.get(order.pair) ?? []).filter((bar) => bar.timestamp >= created);
      let resolved = false;
      for (const bar of bars) {
        const touched = order.type === 'limit'
          ? bar.low <= order.entryHigh && bar.high >= order.entryLow
          : bar.high >= order.entryHigh;
        if (touched) {
          // A candle that reaches entry and stop has no known order in OHLC
          // data. Record a fill and then the protective stop conservatively.
          fill(book, order, order.entryHigh, timestamp, pricesUsdt, usdtIdr);
          if (order.status === 'filled' && bar.low <= order.stopPrice) {
            close(book, order.pair, book.positions[order.pair]!, order.stopPrice, timestamp, 'Stop loss struktur pada candle entry', usdtIdr);
          }
          resolved = true; break;
        }
        if (bar.low <= order.stopPrice) { order.status = 'cancelled'; resolved = true; break; }
      }
      if (resolved) continue;
      const snapshotTouch = order.type === 'limit' ? price >= order.entryLow && price <= order.entryHigh : price >= order.entryHigh;
      if (snapshotTouch) fill(book, order, price, timestamp, pricesUsdt, usdtIdr);
      else if (price > 0 && price <= order.stopPrice) order.status = 'cancelled';
    }
    for (const [pair, position] of Object.entries(book.positions)) {
      const price = currentQuotePrice(pair, position.quoteCurrency, pricesUsdt, usdtIdr); if (!price) continue;
      if (price <= position.stopPrice) close(book, pair, position, price, timestamp, 'Stop loss struktur', usdtIdr);
      else if (price >= position.targetPrice) close(book, pair, position, price, timestamp, 'Target tercapai', usdtIdr);
      else {
        if (agent === 'breakout-specialist') pyramidBreakout(book, pair, position, price, timestamp, pricesUsdt, usdtIdr);
        else if (price >= position.entryPrice + position.initialRiskPerUnit * 1.25) position.stopPrice = Math.max(position.stopPrice, position.entryPrice * (1 + FEE_RATE * 2));
      }
    }
    const candidates = (scan.candidates ?? []).filter((item) => item.agent === agent && OWNERS.has(agent));
    for (const candidate of candidates) { const order = reserveCandidate(book, candidate, timestamp, pricesUsdt, usdtIdr); if (order) book.pendingOrders.push(order); }
    const open = Object.keys(book.positions).length; const pending = book.pendingOrders.filter((item) => item.status === 'pending').length;
    if (state.agents?.[agent]) {
      state.agents[agent].last_action = `${open} posisi spot terbuka · ${pending} pending order`;
      if (OWNERS.has(agent) && scan.universe?.length) state.agents[agent].assets_covered = scan.universe.map((item) => displayPair(item.pair));
    }
  }
  ledger.last_cycle = timestamp;
  updateDailyEquityHistory(ledger, pricesUsdt, usdtIdr, timestamp);
  write(LEDGER, ledger); write(STATE, state); console.log(`[Spot paper] cycle ${timestamp} complete`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

