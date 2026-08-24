#!/usr/bin/env node
/**
 * Automated Paper Trading Execution Engine.
 * Evaluates candidates from scan-signals.ts against open positions,
 * applies risk management (Stop-Loss, Position Sizing, Take-Profit),
 * and updates .desk/paper-ledger.json and .desk/state.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fetchBulkIdrPrices } from '../dashboard/lib/market-data.js';

const DESK_DIR = path.resolve(process.cwd(), '.desk');
const LEDGER_PATH = path.join(DESK_DIR, 'paper-ledger.json');
const STATE_PATH = path.join(DESK_DIR, 'state.json');
const SCAN_PATH = path.join(DESK_DIR, 'latest-scan.json');

interface LedgerPosition {
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice?: number;
  opened: string;
  sizingNote?: string;
}

interface LedgerTrade {
  timestamp: string;
  instrument: string;
  side: 'long' | 'short';
  type: 'open' | 'close' | 'add';
  size: number;
  price: number;
  realizedPnlIdr?: number;
  reason: string;
}

interface LedgerAgent {
  active?: boolean;
  balance: { IDR: number };
  positions: Record<string, LedgerPosition>;
  trades: LedgerTrade[];
}

interface PaperLedger {
  mode: string;
  last_cycle: string;
  starting_balance_per_agent: number;
  base_currency: string;
  agents: Record<string, LedgerAgent>;
}

interface DeskState {
  desk: { created: string; last_session: string; mode: string };
  agents: Record<string, any>;
}

async function main() {
  if (!fs.existsSync(LEDGER_PATH) || !fs.existsSync(SCAN_PATH)) {
    console.log('[Paper Execution] ledger or scan file not found. Skipping.');
    return;
  }

  const ledger: PaperLedger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  const state: DeskState = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : { desk: {}, agents: {} };
  const scan = JSON.parse(fs.readFileSync(SCAN_PATH, 'utf8'));

  const now = new Date().toISOString();
  ledger.last_cycle = now;

  // 1. Ambil harga live dari Indodax
  const prices = await fetchBulkIdrPrices().catch(() => ({} as Record<string, number>));
  let tradesExecuted = 0;

  // 2. Periksa Posisi Terbuka (Stop-Loss & Take-Profit)
  for (const [agentSlug, agentBook] of Object.entries(ledger.agents)) {
    if (!agentBook.positions) agentBook.positions = {};
    if (!agentBook.trades) agentBook.trades = [];

    for (const [pair, pos] of Object.entries(agentBook.positions)) {
      const tickerKey = `${pair.split('/')[0].toLowerCase()}_idr`;
      const currentPrice = prices[tickerKey];
      if (!currentPrice) continue;

      let shouldClose = false;
      let closeReason = '';

      if (pos.side === 'long') {
        if (currentPrice <= pos.stopPrice) {
          shouldClose = true;
          closeReason = `Stop Loss hit at Rp${currentPrice.toLocaleString('id-ID')}`;
        } else if (pos.targetPrice && currentPrice >= pos.targetPrice) {
          shouldClose = true;
          closeReason = `Take Profit (Target) hit at Rp${currentPrice.toLocaleString('id-ID')}`;
        }
      } else {
        if (currentPrice >= pos.stopPrice) {
          shouldClose = true;
          closeReason = `Stop Loss hit at Rp${currentPrice.toLocaleString('id-ID')}`;
        } else if (pos.targetPrice && currentPrice <= pos.targetPrice) {
          shouldClose = true;
          closeReason = `Take Profit (Target) hit at Rp${currentPrice.toLocaleString('id-ID')}`;
        }
      }

      if (shouldClose) {
        const pnl = pos.side === 'long'
          ? (currentPrice - pos.entryPrice) * pos.size
          : (pos.entryPrice - currentPrice) * pos.size;

        agentBook.balance.IDR += pnl;

        agentBook.trades.push({
          timestamp: now,
          instrument: pair,
          side: pos.side,
          type: 'close',
          size: pos.size,
          price: currentPrice,
          realizedPnlIdr: pnl,
          reason: closeReason,
        });

        delete agentBook.positions[pair];
        tradesExecuted++;

        if (state.agents[agentSlug]) {
          state.agents[agentSlug].last_action = `Closed ${pos.side.toUpperCase()} ${pair} (${pnl >= 0 ? '+' : ''}Rp${Math.round(pnl).toLocaleString('id-ID')}) — ${closeReason}`;
        }
        console.log(`✓ [${agentSlug}] Closed position on ${pair}: PnL Rp${Math.round(pnl).toLocaleString('id-ID')}`);
      }
    }
  }

  // 3. Buka Posisi Baru dari Sinyal Hasil Scan
  const candidates: Array<{ pair: string; agent: string; reason: string; data?: any }> = scan.candidates || [];

  for (const c of candidates) {
    const agentSlug = c.agent;
    const agentBook = ledger.agents[agentSlug];
    if (!agentBook) continue;

    const instrument = `${c.pair.replace(/idr$/i, '').toUpperCase()}/IDR`;
    const tickerKey = `${c.pair.toLowerCase()}`;
    const currentPrice = prices[tickerKey] || c.data?.close || c.data?.price;
    if (!currentPrice) continue;

    if (agentBook.positions[instrument]) continue;
    if (Object.keys(agentBook.positions).length >= 3) continue;

    // Batasi risiko: 2% dari saldo buku saat ini
    const balance = agentBook.balance.IDR;
    const riskAmountIdr = balance * 0.02;

    const isLong = !c.reason.toLowerCase().includes('bearish') && !c.reason.toLowerCase().includes('down') && !c.reason.toLowerCase().includes('breakdown');
    const side: 'long' | 'short' = isLong ? 'long' : 'short';

    const stopDistance = currentPrice * 0.02; // Stop loss ~2%
    const stopPrice = isLong ? currentPrice - stopDistance : currentPrice + stopDistance;
    const targetPrice = isLong ? currentPrice + (stopDistance * 2) : currentPrice - (stopDistance * 2);

    const sizeInCoins = riskAmountIdr / (stopDistance || 1);
    const notionalValue = sizeInCoins * currentPrice;
    const maxNotional = balance * 0.25; // Maks 25% modal per posisi
    const finalSize = notionalValue > maxNotional ? maxNotional / currentPrice : sizeInCoins;

    agentBook.positions[instrument] = {
      side,
      size: finalSize,
      entryPrice: currentPrice,
      stopPrice,
      targetPrice,
      opened: now,
      sizingNote: `Allocated Rp${Math.round(finalSize * currentPrice).toLocaleString('id-ID')} (Risk Rp${Math.round(riskAmountIdr).toLocaleString('id-ID')})`,
    };

    agentBook.trades.push({
      timestamp: now,
      instrument,
      side,
      type: 'open',
      size: finalSize,
      price: currentPrice,
      reason: c.reason,
    });

    if (state.agents[agentSlug]) {
      state.agents[agentSlug].last_action = `Opened ${side.toUpperCase()} ${instrument} @ Rp${currentPrice.toLocaleString('id-ID')} (${c.reason})`;
    }

    tradesExecuted++;
    console.log(`✓ [${agentSlug}] Opened ${side.toUpperCase()} on ${instrument} @ Rp${currentPrice.toLocaleString('id-ID')}`);
  }

  // 4. Simpan pembaruan ledger & state
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
  if (fs.existsSync(STATE_PATH)) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
  }

  console.log(`[Paper Execution] Selesai. Total transaksi diproses: ${tradesExecuted}.`);
}

main().catch((e) => {
  console.error('[Paper Execution] Error:', e);
});
