#!/usr/bin/env node
/** Spot-only paper executor. Scanner candidates become pending orders first.
 * Long-only is deliberate: Indodax spot cannot execute naked short positions. */
import fs from 'node:fs';
import path from 'node:path';
import type { OHLCV } from '../lib/indicators.js';
import { fetchBulkIdrPrices } from '../dashboard/lib/market-data.js';
import { fetchOhlcv } from '../dashboard/lib/indodax.js';

const DESK = path.join(process.cwd(), '.desk');
const LEDGER = path.join(DESK, 'paper-ledger.json');
const SCAN = path.join(DESK, 'latest-scan.json');
const STATE = path.join(DESK, 'state.json');
const RISK_PER_CAMPAIGN = 0.05;
const MAX_NOTIONAL_MULTIPLE = 1;
const FEE_RATE = 0.003;
const OWNERS = new Set(['breakout-specialist', 'aggressive-breakout-trader', 'mean-reversion-trader', 'smc-trader', 'wyckoff-trader']);

type Pending = { id: string; campaignId: string; pair: string; side: 'long'; type: 'limit' | 'stop'; entryLow: number; entryHigh: number; stopPrice: number; targetPrice: number; riskReservedIdr: number; expiresAt: string; createdAt: string; status: 'pending' | 'filled' | 'cancelled' | 'expired' | 'rejected'; confirmations: string[]; reason: string; };
type Position = { side: 'long'; size: number; entryPrice: number; stopPrice: number; targetPrice: number; opened: string; campaignId: string; leg: number; initialRiskPerUnit: number; sizingNote: string; };
type Book = { balance: { IDR: number }; positions: Record<string, Position>; pendingOrders: Pending[]; trades: unknown[] };
type Ledger = { last_cycle: string; agents: Record<string, Book> };
type Candidate = Omit<Pending, 'campaignId' | 'riskReservedIdr' | 'createdAt' | 'status'> & { agent: string; score: number; validationStatus: 'validated' | 'research' };

function read<T>(file: string): T { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; }
function write(file: string, value: unknown) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function key(pair: string) { const clean = pair.replace('/', '').toLowerCase(); return clean.endsWith('idr') ? clean.replace(/idr$/, '_idr') : `${clean}_idr`; }
function now() { return new Date().toISOString(); }
function campaignId(agent: string, pair: string) { return `${agent}-${pair}-${Date.now()}`; }
function priceFor(pair: string, prices: Record<string, number>) { return prices[key(pair)] ?? 0; }
function hasLiveCampaign(book: Book, pair: string) { return Boolean(book.positions[pair]) || book.pendingOrders.some((order) => order.pair === pair && order.status === 'pending'); }
// Research candidates remain executable while this desk is in paper-trading
// mode, so their real-time outcomes can be measured independently. The status
// is retained in the scan data for reporting and later live-trading gating.
function valid(candidate: Candidate) { return candidate.side === 'long' && candidate.entryHigh > candidate.stopPrice && (candidate.targetPrice - candidate.entryHigh) / (candidate.entryHigh - candidate.stopPrice) >= 1.5; }

async function pendingTouches(ledger: Ledger) {
  const pairs = [...new Set(Object.values(ledger.agents).flatMap((book) => book.pendingOrders.filter((order) => order.status === 'pending').map((order) => order.pair)))];
  const entries = await Promise.all(pairs.map(async (pair) => {
    try { return [pair, await fetchOhlcv(pair, '15m', 24)] as const; }
    catch { return [pair, [] as OHLCV[]] as const; }
  }));
  return new Map(entries);
}

function reserveCandidate(book: Book, candidate: Candidate, timestamp: string): Pending | null {
  if (!valid(candidate) || hasLiveCampaign(book, candidate.pair)) return null;
  const equity = book.balance.IDR;
  const riskPerUnit = candidate.entryHigh - candidate.stopPrice;
  const size = Math.min(equity / candidate.entryHigh, (equity * RISK_PER_CAMPAIGN) / riskPerUnit);
  const risk = size * riskPerUnit;
  if (!Number.isFinite(size) || size <= 0 || risk <= 0) return null;
  return { ...candidate, campaignId: campaignId(candidate.agent, candidate.pair), riskReservedIdr: risk, createdAt: timestamp, status: 'pending' };
}

function fill(book: Book, order: Pending, price: number, timestamp: string) {
  const fillPrice = order.type === 'stop' ? Math.max(price, order.entryHigh) : Math.min(Math.max(price, order.entryLow), order.entryHigh);
  const riskPerUnit = fillPrice - order.stopPrice;
  const equity = book.balance.IDR;
  // Jesse Livermore manages breakout campaigns in four 25% legs. Other
  // primary agents may use the full allowed notional at their first fill.
  const initialNotionalCap = order.campaignId.startsWith('breakout-specialist-') ? equity * 0.25 : equity * MAX_NOTIONAL_MULTIPLE;
  const size = Math.min(initialNotionalCap / fillPrice, (equity * RISK_PER_CAMPAIGN) / riskPerUnit);
  if (!Number.isFinite(size) || size <= 0 || fillPrice <= order.stopPrice) { order.status = 'rejected'; return; }
  const fee = fillPrice * size * FEE_RATE;
  book.balance.IDR -= fee;
  book.positions[order.pair] = { side: 'long', size, entryPrice: fillPrice, stopPrice: order.stopPrice, targetPrice: order.targetPrice, opened: timestamp, campaignId: order.campaignId, leg: 1, initialRiskPerUnit: riskPerUnit, sizingNote: `Spot-only | Risiko maks 5% | Fee masuk Rp${Math.round(fee).toLocaleString('id-ID')}` };
  order.status = 'filled';
  book.trades.push({ timestamp, instrument: order.pair, side: 'long', type: 'open', size, price: fillPrice, reason: order.reason, campaignId: order.campaignId, confirmations: order.confirmations, feeIdr: fee });
}

function pyramidBreakout(book: Book, pair: string, position: Position, price: number, timestamp: string) {
  if (position.leg >= 4) return;
  const initialRisk = position.initialRiskPerUnit;
  if (initialRisk <= 0 || price < position.entryPrice + initialRisk * position.leg) return;
  // The first winning leg is protected before any addition. New legs are
  // added only while total spot notional remains at or below current equity.
  position.stopPrice = Math.max(position.stopPrice, position.entryPrice);
  const equity = book.balance.IDR;
  const currentNotional = position.size * price;
  const capacity = Math.max(0, equity * MAX_NOTIONAL_MULTIPLE - currentNotional);
  const addSize = Math.min((equity * 0.25) / price, capacity / price);
  if (!Number.isFinite(addSize) || addSize <= 0) return;
  const oldNotional = position.size * position.entryPrice;
  const addFee = addSize * price * FEE_RATE;
  position.entryPrice = (oldNotional + addSize * price) / (position.size + addSize);
  position.size += addSize;
  position.leg += 1;
  book.balance.IDR -= addFee;
  book.trades.push({ timestamp, instrument: pair, side: 'long', type: 'add', size: addSize, price, reason: `Jesse Livermore pyramid leg ${position.leg}/4 setelah +${position.leg - 1}R`, campaignId: position.campaignId, feeIdr: addFee });
}

function close(book: Book, pair: string, position: Position, price: number, timestamp: string, reason: string) {
  const gross = (price - position.entryPrice) * position.size; const fee = price * position.size * FEE_RATE; const pnl = gross - fee;
  book.balance.IDR += pnl; delete book.positions[pair];
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
      const invalidated = bars.some((bar) => bar.low <= order.stopPrice) || (price > 0 && price <= order.stopPrice);
      if (invalidated) { order.status = 'cancelled'; continue; }
      const intrabarTouch = order.type === 'limit'
        ? bars.some((bar) => bar.low <= order.entryHigh && bar.high >= order.entryLow)
        : bars.some((bar) => bar.high >= order.entryHigh);
      const snapshotTouch = order.type === 'limit' ? price >= order.entryLow && price <= order.entryHigh : price >= order.entryHigh;
      if (intrabarTouch || snapshotTouch) fill(book, order, intrabarTouch ? order.entryHigh : price, timestamp);
    }
    for (const [pair, position] of Object.entries(book.positions)) {
      const price = priceFor(pair, prices); if (!price) continue;
      if (price <= position.stopPrice) close(book, pair, position, price, timestamp, 'Stop loss struktur');
      else if (price >= position.targetPrice) close(book, pair, position, price, timestamp, 'Target tercapai');
      else {
        if (price >= position.entryPrice + position.initialRiskPerUnit * 1.25) position.stopPrice = Math.max(position.stopPrice, position.entryPrice * (1 + FEE_RATE * 2));
        if (agent === 'breakout-specialist') pyramidBreakout(book, pair, position, price, timestamp);
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
