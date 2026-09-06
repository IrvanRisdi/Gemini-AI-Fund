#!/usr/bin/env node
/** Spot-only paper executor. Scanner candidates become pending orders first.
 * Long-only is deliberate: Indodax spot cannot execute naked short positions. */
import fs from 'node:fs';
import path from 'node:path';
import type { OHLCV } from '../lib/indicators.js';
import { fetchBulkIdrPrices } from '../dashboard/lib/market-data.js';
import { fetchOhlcv } from '../dashboard/lib/indodax.js';
import { netRewardRisk, validNetPlan } from './trading-math.js';

const DESK = path.join(process.cwd(), '.desk');
const LEDGER = path.join(DESK, 'paper-ledger.json');
const SCAN = path.join(DESK, 'latest-scan.json');
const STATE = path.join(DESK, 'state.json');
const RISK_PER_CAMPAIGN = 0.05;
const DEFAULT_MAX_NOTIONAL_PER_PAIR = 0.50;
const BREAKOUT_INITIAL_ALLOCATION = 0.25;
const BREAKOUT_MAX_NOTIONAL = 0.95;
const MAX_ACTIVE_CAMPAIGNS = 4;
const CASH_RESERVE_PCT = 0.10;
const MAX_AGGREGATE_RISK_PCT = 0.10;
const FEE_RATE = 0.003;
const ATTEMPT_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const OWNERS = new Set(['breakout-specialist', 'aggressive-breakout-trader', 'mean-reversion-trader', 'smc-trader', 'wyckoff-trader']);

type Pending = { id: string; campaignId: string; agent?: string; pair: string; side: 'long'; type: 'limit' | 'stop'; entryLow: number; entryHigh: number; stopPrice: number; targetPrice: number; riskReservedIdr: number; notionalReservedIdr: number; expiresAt: string; createdAt: string; status: 'pending' | 'filled' | 'cancelled' | 'expired' | 'rejected'; confirmations: string[]; reason: string; score?: number; volumeRatio?: number; allocationPct?: number; rewardMultiple?: number; };
type Position = { side: 'long'; size: number; entryPrice: number; initialEntryPrice?: number; stopPrice: number; targetPrice: number; opened: string; campaignId: string; leg: number; initialRiskPerUnit: number; sizingNote: string; };
type Book = { balance: { IDR: number }; positions: Record<string, Position>; pendingOrders: Pending[]; trades: unknown[] };
type Ledger = { last_cycle: string; agents: Record<string, Book> };
type Candidate = Omit<Pending, 'campaignId' | 'riskReservedIdr' | 'notionalReservedIdr' | 'createdAt' | 'status'> & { agent: string; score: number; validationStatus: 'validated' | 'research' };
type AllocationContext = { campaignId?: string; agent?: string; allocationPct?: number };

function read<T>(file: string): T { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; }
function write(file: string, value: unknown) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function key(pair: string) { const clean = pair.replace('/', '').toLowerCase(); return clean.endsWith('idr') ? clean.replace(/idr$/, '_idr') : `${clean}_idr`; }
function now() { return new Date().toISOString(); }
function campaignId(agent: string, pair: string) { return `${agent}-${pair}-${Date.now()}`; }
function priceFor(pair: string, prices: Record<string, number>) { return prices[key(pair)] ?? 0; }
function hasLiveCampaign(book: Book, pair: string) { return Boolean(book.positions[pair]) || book.pendingOrders.some((order) => order.pair === pair && order.status === 'pending'); }
function hasRecentAttempt(book: Book, pair: string, timestamp: string) {
  const cutoff = Date.parse(timestamp) - ATTEMPT_COOLDOWN_MS;
  return book.pendingOrders.some((order) => order.pair === pair && Date.parse(order.createdAt) >= cutoff);
}
function accountEquity(book: Book) { return book.balance.IDR + Object.values(book.positions).reduce((total, position) => total + position.size * position.entryPrice, 0); }
function activeCampaigns(book: Book) { return Object.keys(book.positions).length + book.pendingOrders.filter((order) => order.status === 'pending').length; }
function reservedCash(book: Book, excludeId?: string) { return book.pendingOrders.filter((order) => order.status === 'pending' && order.id !== excludeId).reduce((total, order) => total + (order.notionalReservedIdr ?? 0), 0); }
function reservedRisk(book: Book, excludeId?: string) {
  const openRisk = Object.values(book.positions).reduce((total, position) => total + position.size * netRewardRisk(position.entryPrice, position.stopPrice, position.targetPrice).netRisk, 0);
  const pendingRisk = book.pendingOrders.filter((order) => order.status === 'pending' && order.id !== excludeId).reduce((total, order) => total + order.riskReservedIdr, 0);
  return openRisk + pendingRisk;
}
// Research candidates remain executable while this desk is in paper-trading
// mode, so their real-time outcomes can be measured independently. The status
// is retained in the scan data for reporting and later live-trading gating.
function valid(candidate: Candidate) { return candidate.side === 'long' && validNetPlan(candidate.entryHigh, candidate.stopPrice, candidate.targetPrice, candidate.rewardMultiple ?? 1.5); }
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

async function pendingTouches(ledger: Ledger) {
  const pairs = [...new Set(Object.values(ledger.agents).flatMap((book) => book.pendingOrders.filter((order) => order.status === 'pending').map((order) => order.pair)))];
  const entries = await Promise.all(pairs.map(async (pair) => {
    try { return [pair, await fetchOhlcv(pair, '1m', 30)] as const; }
    catch { return [pair, [] as OHLCV[]] as const; }
  }));
  return new Map(entries);
}

function reserveCandidate(book: Book, candidate: Candidate, timestamp: string): Pending | null {
  if (!valid(candidate) || hasLiveCampaign(book, candidate.pair) || hasRecentAttempt(book, candidate.pair, timestamp) || activeCampaigns(book) >= MAX_ACTIVE_CAMPAIGNS) return null;
  const equity = accountEquity(book);
  const riskPerUnit = netRewardRisk(candidate.entryHigh, candidate.stopPrice, candidate.targetPrice).netRisk;
  const cap = allocationCap(candidate);
  const cashAvailable = Math.max(0, book.balance.IDR - equity * cashReservePct(candidate) - reservedCash(book));
  const riskAvailable = Math.max(0, equity * MAX_AGGREGATE_RISK_PCT - reservedRisk(book));
  const size = Math.min(
    (equity * cap) / candidate.entryHigh,
    (equity * RISK_PER_CAMPAIGN) / riskPerUnit,
    riskAvailable / riskPerUnit,
    cashAvailable / (candidate.entryHigh * (1 + FEE_RATE)),
  );
  const risk = size * riskPerUnit; const notionalReservedIdr = size * candidate.entryHigh * (1 + FEE_RATE);
  if (!Number.isFinite(size) || size <= 0 || risk <= 0) return null;
  return { ...candidate, campaignId: campaignId(candidate.agent, candidate.pair), riskReservedIdr: risk, notionalReservedIdr, createdAt: timestamp, status: 'pending' };
}

function fill(book: Book, order: Pending, price: number, timestamp: string) {
  const fillPrice = order.type === 'stop' ? Math.max(price, order.entryHigh) : Math.min(Math.max(price, order.entryLow), order.entryHigh);
  const priceRiskPerUnit = fillPrice - order.stopPrice;
  const riskPerUnit = netRewardRisk(fillPrice, order.stopPrice, order.targetPrice).netRisk;
  const equity = accountEquity(book);
  const cap = allocationCap(order);
  const cashAvailable = Math.max(0, book.balance.IDR - equity * cashReservePct(order) - reservedCash(book, order.id));
  const riskAvailable = Math.max(0, equity * MAX_AGGREGATE_RISK_PCT - reservedRisk(book, order.id));
  // Allocation is strategy-specific. Breakout starts at 25% and pyramids;
  // aggressive momentum can deploy nearly all available cash at conviction 5.
  const size = Math.min(
    (equity * cap) / fillPrice,
    (equity * RISK_PER_CAMPAIGN) / riskPerUnit,
    riskAvailable / riskPerUnit,
    cashAvailable / (fillPrice * (1 + FEE_RATE)),
  );
  if (!Number.isFinite(size) || size <= 0 || fillPrice <= order.stopPrice) { order.status = 'rejected'; return; }
  const notional = fillPrice * size;
  const fee = notional * FEE_RATE;
  if (notional + fee > book.balance.IDR + 1) { order.status = 'rejected'; return; }
  // Spot purchases spend both notional and fee. This prevents later fills
  // from sizing against capital that is already tied up in a position.
  book.balance.IDR -= notional + fee;
  book.positions[order.pair] = { side: 'long', size, entryPrice: fillPrice, initialEntryPrice: fillPrice, stopPrice: order.stopPrice, targetPrice: order.targetPrice, opened: timestamp, campaignId: order.campaignId, leg: 1, initialRiskPerUnit: priceRiskPerUnit, sizingNote: `Spot-only | Alokasi awal ${(cap * 100).toFixed(0)}% | Risiko harga ${((priceRiskPerUnit / fillPrice) * 100).toFixed(2)}% | Risiko equity bersih maks. 5% | Fee masuk Rp${Math.round(fee).toLocaleString('id-ID')}` };
  order.status = 'filled';
  book.trades.push({ timestamp, instrument: order.pair, side: 'long', type: 'open', size, price: fillPrice, reason: order.reason, campaignId: order.campaignId, confirmations: order.confirmations, feeIdr: fee });
}

function pyramidBreakout(book: Book, pair: string, position: Position, price: number, timestamp: string) {
  if (position.leg >= 4) return;
  const initialRisk = position.initialRiskPerUnit;
  const initialEntry = position.initialEntryPrice ?? position.entryPrice;
  const addThresholds = [.5, 1, 1.5];
  const threshold = addThresholds[position.leg - 1] ?? 1.5;
  if (initialRisk <= 0 || price < initialEntry + initialRisk * threshold) return;
  const currentNotional = position.size * price;
  const equity = accountEquity(book);
  const capacity = Math.max(0, equity * BREAKOUT_MAX_NOTIONAL - currentNotional);
  const cashAvailable = Math.max(0, book.balance.IDR - equity * .05 - reservedCash(book));
  const addSize = Math.min((equity * 0.25) / (price * (1 + FEE_RATE)), capacity / price, cashAvailable / (price * (1 + FEE_RATE)));
  if (!Number.isFinite(addSize) || addSize <= 0) return;
  const oldNotional = position.size * position.entryPrice;
  const addNotional = addSize * price;
  const addFee = addNotional * FEE_RATE;
  if (addNotional + addFee > book.balance.IDR + 1) return;
  position.entryPrice = (oldNotional + addNotional) / (position.size + addSize);
  position.size += addSize;
  position.leg += 1;
  position.initialEntryPrice = initialEntry;
  if (position.leg >= 3) position.stopPrice = Math.max(position.stopPrice, initialEntry * (1 + FEE_RATE * 2));
  if (position.leg >= 4) position.stopPrice = Math.max(position.stopPrice, initialEntry + initialRisk * .5);
  book.balance.IDR -= addNotional + addFee;
  book.trades.push({ timestamp, instrument: pair, side: 'long', type: 'add', size: addSize, price, reason: `Jesse Livermore pyramid leg ${position.leg}/4 setelah +${threshold}R`, campaignId: position.campaignId, feeIdr: addFee });
}

function close(book: Book, pair: string, position: Position, price: number, timestamp: string, reason: string) {
  const gross = (price - position.entryPrice) * position.size; const fee = price * position.size * FEE_RATE; const pnl = gross - fee;
  // Return the full sale proceeds because the entry notional was removed from
  // cash when the position was opened; realized P&L remains reported below.
  const proceeds = price * position.size;
  book.balance.IDR += proceeds - fee; delete book.positions[pair];
  book.trades.push({ timestamp, instrument: pair, side: 'long', type: 'close', size: position.size, price, realizedPnlIdr: pnl, reason, campaignId: position.campaignId, feeIdr: fee });
}

async function main() {
  const ledger = read<Ledger>(LEDGER); const scan = read<{ candidates?: Candidate[] }>(SCAN); const state = read<{ agents?: Record<string, { status: string; last_action?: string }> }>(STATE); const prices = await fetchBulkIdrPrices(); const timestamp = now(); const touches = await pendingTouches(ledger);
  for (const [agent, book] of Object.entries(ledger.agents)) {
    book.positions ??= {}; book.pendingOrders ??= []; book.trades ??= [];
    for (const order of book.pendingOrders.filter((item) => item.status === 'pending')) {
      const price = priceFor(order.pair, prices);
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
          fill(book, order, order.entryHigh, timestamp);
          if (order.status === 'filled' && bar.low <= order.stopPrice) {
            close(book, order.pair, book.positions[order.pair]!, order.stopPrice, timestamp, 'Stop loss struktur pada candle entry');
          }
          resolved = true; break;
        }
        if (bar.low <= order.stopPrice) { order.status = 'cancelled'; resolved = true; break; }
      }
      if (resolved) continue;
      const snapshotTouch = order.type === 'limit' ? price >= order.entryLow && price <= order.entryHigh : price >= order.entryHigh;
      if (snapshotTouch) fill(book, order, price, timestamp);
      else if (price > 0 && price <= order.stopPrice) order.status = 'cancelled';
    }
    for (const [pair, position] of Object.entries(book.positions)) {
      const price = priceFor(pair, prices); if (!price) continue;
      if (price <= position.stopPrice) close(book, pair, position, price, timestamp, 'Stop loss struktur');
      else if (price >= position.targetPrice) close(book, pair, position, price, timestamp, 'Target tercapai');
      else {
        if (agent === 'breakout-specialist') pyramidBreakout(book, pair, position, price, timestamp);
        else if (price >= position.entryPrice + position.initialRiskPerUnit * 1.25) position.stopPrice = Math.max(position.stopPrice, position.entryPrice * (1 + FEE_RATE * 2));
      }
    }
    const candidates = (scan.candidates ?? []).filter((item) => item.agent === agent && OWNERS.has(agent));
    for (const candidate of candidates) { const order = reserveCandidate(book, candidate, timestamp); if (order) book.pendingOrders.push(order); }
    const open = Object.keys(book.positions).length; const pending = book.pendingOrders.filter((item) => item.status === 'pending').length;
    if (state.agents?.[agent]) state.agents[agent].last_action = `${open} posisi spot terbuka · ${pending} pending order`;
  }
  ledger.last_cycle = timestamp; write(LEDGER, ledger); write(STATE, state); console.log(`[Spot paper] cycle ${timestamp} complete`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

