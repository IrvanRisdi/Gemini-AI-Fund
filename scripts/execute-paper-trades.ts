#!/usr/bin/env node
/**
 * Automated Paper Trading Execution Engine (Gemini AI-Fund).
 * Evaluates candidates from scan-signals.ts against open positions,
 * applies risk management (Stop-Loss, Position Sizing, Take-Profit),
 * and updates .desk/paper-ledger.json, .desk/state.json, and .desk/briefings/.
 */


import fs from 'node:fs';
import path from 'node:path';

const DESK_DIR = path.resolve(process.cwd(), '.desk');
const LEDGER_PATH = path.join(DESK_DIR, 'paper-ledger.json');
const STATE_PATH = path.join(DESK_DIR, 'state.json');
const SCAN_PATH = path.join(DESK_DIR, 'latest-scan.json');
const BRIEFINGS_DIR = path.join(DESK_DIR, 'briefings');

function normalizeIndodaxKey(rawPair: string): string {
  const clean = rawPair.replace('/', '').toLowerCase();
  return clean.endsWith('idr') ? clean.replace(/idr$/, '_idr') : `${clean}_idr`;
}

function formatInstrument(rawPair: string): string {
  const symbol = rawPair.replace(/idr$/i, '').replace('/', '').toUpperCase();
  return `${symbol}/IDR`;
}

async function fetchBulkIdrPrices(): Promise<Record<string, number>> {
  try {
    const res = await fetch('https://indodax.com/api/ticker_all');
    if (!res.ok) return {};
    const data = (await res.json()) as { tickers: Record<string, { last: string }> };
    const out: Record<string, number> = {};
    for (const [key, t] of Object.entries(data.tickers ?? {})) {
      const price = parseFloat(t.last);
      if (!Number.isNaN(price)) out[key.toLowerCase()] = price;
    }
    return out;
  } catch {
    return {};
  }
}

async function main() {
  if (!fs.existsSync(LEDGER_PATH) || !fs.existsSync(SCAN_PATH)) {
    console.log('[Paper Execution] ledger or scan file not found. Skipping.');
    return;
  }

  const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  const state = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : { desk: {}, agents: {} };
  const scan = JSON.parse(fs.readFileSync(SCAN_PATH, 'utf8'));

  const now = new Date().toISOString();
  ledger.last_cycle = now;
  if (!state.desk) state.desk = { created: '2026-07-13', mode: 'paper' };
  state.desk.last_session = now.split('T')[0];

  // 1. Ambil harga pasar live dari Indodax
  const prices = await fetchBulkIdrPrices();
  let tradesExecuted = 0;

  if (!fs.existsSync(BRIEFINGS_DIR)) {
    fs.mkdirSync(BRIEFINGS_DIR, { recursive: true });
  }

  // 2. Periksa Posisi Terbuka (Cek Stop-Loss & Take-Profit)
  for (const [agentSlug, agentBook] of Object.entries(ledger.agents as Record<string, any>)) {
    if (!agentBook.positions) agentBook.positions = {};
    if (!agentBook.trades) agentBook.trades = [];

    for (const [pair, pos] of Object.entries(agentBook.positions as Record<string, any>)) {
      const tickerKey = normalizeIndodaxKey(pair);
      const currentPrice = prices[tickerKey];
      if (!currentPrice) continue;

      let shouldClose = false;
      let closeReason = '';

      if (pos.side === 'long') {
        if (currentPrice <= pos.stopPrice) {
          shouldClose = true;
          closeReason = `Stop Loss hit @ Rp${currentPrice.toLocaleString('id-ID')}`;
        } else if (pos.targetPrice && currentPrice >= pos.targetPrice) {
          shouldClose = true;
          closeReason = `Take Profit (Target) hit @ Rp${currentPrice.toLocaleString('id-ID')}`;
        }
      } else {
        if (currentPrice >= pos.stopPrice) {
          shouldClose = true;
          closeReason = `Stop Loss hit @ Rp${currentPrice.toLocaleString('id-ID')}`;
        } else if (pos.targetPrice && currentPrice <= pos.targetPrice) {
          shouldClose = true;
          closeReason = `Take Profit (Target) hit @ Rp${currentPrice.toLocaleString('id-ID')}`;
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

        const actionText = `Closed ${pos.side.toUpperCase()} ${pair} (${pnl >= 0 ? '+' : ''}Rp${Math.round(pnl).toLocaleString('id-ID')}) — ${closeReason} (${now.slice(0, 16)} UTC)`;
        if (state.agents && state.agents[agentSlug]) {
          state.agents[agentSlug].last_action = actionText;
        }

        const briefingFile = path.join(BRIEFINGS_DIR, `${agentSlug}.md`);
        const entryLog = `\n\n---\n### ${now.slice(0, 16)} UTC — Position Closed: ${pos.side.toUpperCase()} ${pair}\n* **Exit Price:** Rp${currentPrice.toLocaleString('id-ID')}\n* **Realized PnL:** ${pnl >= 0 ? '+' : ''}Rp${Math.round(pnl).toLocaleString('id-ID')}\n* **Reason:** ${closeReason}\n* **New Balance:** Rp${Math.round(agentBook.balance.IDR).toLocaleString('id-ID')}\n`;
        fs.appendFileSync(briefingFile, entryLog, 'utf8');

        console.log(`✓ [${agentSlug}] ${actionText}`);
      }
    }
  }

  // 3. Eksekusi Sinyal Baru dari Hasil Scan
  const candidates: Array<any> = scan.candidates || [];

  for (const c of candidates) {
    const agentSlug = c.agent;
    const agentBook = (ledger.agents as Record<string, any>)[agentSlug];
    if (!agentBook) continue;

    const instrument = formatInstrument(c.pair);
    const tickerKey = normalizeIndodaxKey(c.pair);
    const currentPrice = prices[tickerKey] || c.data?.close || c.data?.price || c.data?.lastClose;
    if (!currentPrice) continue;

    // Hindari membuka posisi ganda di pair yang sama
    if (agentBook.positions[instrument]) continue;

    // Boleh membuka posisi multi-aset di seluruh 19 pairs yang dipantau (maks. 1 posisi per koin)

    // Manajemen risiko: Risiko 2% modal per trade
    const balance = agentBook.balance.IDR;
    const riskAmountIdr = balance * 0.02;

    const isLong = !c.reason.toLowerCase().includes('bearish') && !c.reason.toLowerCase().includes('down') && !c.reason.toLowerCase().includes('breakdown');
    const side: 'long' | 'short' = isLong ? 'long' : 'short';

    const stopDistance = currentPrice * 0.02; // Stop loss buffer 2%
    const stopPrice = isLong ? currentPrice - stopDistance : currentPrice + stopDistance;
    const targetPrice = isLong ? currentPrice + (stopDistance * 2.5) : currentPrice - (stopDistance * 2.5);

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

    const actionText = `1 open (${instrument}) — ${side.toUpperCase()} entry @ Rp${currentPrice.toLocaleString('id-ID')}, stop Rp${stopPrice.toLocaleString('id-ID')} (${now.slice(0, 16)} UTC)`;
    if (state.agents && state.agents[agentSlug]) {
      state.agents[agentSlug].last_action = actionText;
    }

    const briefingFile = path.join(BRIEFINGS_DIR, `${agentSlug}.md`);
    const entryLog = `\n\n---\n### ${now.slice(0, 16)} UTC — Position Opened: ${side.toUpperCase()} ${instrument}\n* **Entry Price:** Rp${currentPrice.toLocaleString('id-ID')}\n* **Stop Loss:** Rp${stopPrice.toLocaleString('id-ID')}\n* **Target:** Rp${targetPrice.toLocaleString('id-ID')}\n* **Reason:** ${c.reason}\n* **Allocated:** Rp${Math.round(finalSize * currentPrice).toLocaleString('id-ID')}\n`;
    fs.appendFileSync(briefingFile, entryLog, 'utf8');

    tradesExecuted++;
    console.log(`✓ [${agentSlug}] Opened ${side.toUpperCase()} on ${instrument} @ Rp${currentPrice.toLocaleString('id-ID')}`);
  }

  // 4. Simpan perubahan ke paper-ledger.json dan state.json
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
  if (fs.existsSync(STATE_PATH)) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
  }

  console.log(`[Paper Execution] Selesai. Total order diproses: ${tradesExecuted}. Ledger updated at: ${now}`);
}

main().catch((e) => console.error('[Paper Execution] Error:', e));
