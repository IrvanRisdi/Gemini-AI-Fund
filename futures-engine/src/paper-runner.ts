#!/usr/bin/env node
/**
 * Futures Engine — 5m-Precision Paper Trading Cron Runner
 * - Replays 5m candles since lastCycleAt so GitHub Actions cron delays never miss fills, TP1, trailing, or SL.
 * - Enforces Solusi #4 (minNotional / stepSize / partial TP1 auto-fallback) on every fill.
 * - Runs Wyckoff-4H (Core 70%) + SMC-1H-Bear (Booster 30%) using Single Source of Truth strategies.ts.
 * - Evaluates qualifying signals (Conviction >= 2) with Gemini 4 Neon + 3-Layer Memory + Macro Calendar.
 * - Tracks Shadow A/B (quantOnly vs geminiAdjusted + shadowVetoed outcomes) for scientific auditability.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeIndicators } from './indicators.js';
import { evaluateMacroWindow } from './macro-calendar.js';
import {
  fetchKlines,
  fetchKlinesRange,
  getPrecisionForSymbol,
  loadPrecisionMap,
  planOrderExecution,
  roundToTick,
} from './market-data.js';
import { buildStructuredMemoryPack, computeVetoCalibration, loadLessons, saveLessons } from './memory.js';
import { fetchSanitizedCryptoNews } from './news.js';
import { evaluateSignalWithGemini, pingGeminiPretradeModel } from './gemini-evaluator.js';
import {
  bookEquityUsd,
  checkPortfolioRiskBeforeEntry,
  RISK_LIMITS,
  totalPortfolioEquityUsd,
  updateKillSwitches,
} from './risk-guard.js';
import {
  breakevenStopPrice,
  computeBtcRegimeAt,
  DEFAULT_FEE_PER_SIDE,
  diagnoseCoinAt,
  evaluateSmc1HBearAt,
  evaluateWyckoff4HAt,
  extractLatestClosedBars,
} from './strategies.js';
import { discoverDynamicUniverse, FALLBACK_UNIVERSE } from './universe.js';
import { deliverTelegramMessage, escapeTelegramHtml } from './telegram.js';
import type {
  AgentBook,
  AgentId,
  ClosedTrade,
  FuturesLedger,
  MarketPrecision,
  OHLCV,
  OpenPosition,
  PendingOrder,
  ShadowVetoedSignal,
  UniverseCoinDiagnostic,
} from './types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = path.resolve(HERE, '..');
const DESK_DIR = path.join(ENGINE_ROOT, '.futures-desk');
const LEDGER_PATH = path.join(DESK_DIR, 'ledger.json');
const SUMMARY_PATH = path.join(DESK_DIR, 'dashboard-summary.json');
const LOG_PATH = path.join(DESK_DIR, 'cycle-log.jsonl');
const LESSONS_PATH = path.join(DESK_DIR, 'memory', 'lessons.json');
const SEED_LESSONS_PATH = path.join(ENGINE_ROOT, 'data', 'memory', 'lessons.json');

const FUNDING_PER_8H = 0.0001;
const MAINTENANCE_MARGIN_RATE = 0.005;
const STARTING_CAPITAL_USD = Number(process.env.FUTURES_STARTING_CAPITAL_USD ?? 10_000);
const USE_FIXED_TP2_WYCKOFF = process.env.WYCKOFF_FIXED_TP2 === 'true';

function ensureDeskInitialized(nowIso: string): FuturesLedger {
  fs.mkdirSync(path.dirname(LESSONS_PATH), { recursive: true });
  if (!fs.existsSync(LESSONS_PATH) && fs.existsSync(SEED_LESSONS_PATH)) {
    const seed = loadLessons(SEED_LESSONS_PATH);
    saveLessons(LESSONS_PATH, seed);
  }

  if (fs.existsSync(LEDGER_PATH)) {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')) as FuturesLedger;
  }

  const todayUtc = nowIso.slice(0, 10);
  const coreCap = Number((STARTING_CAPITAL_USD * 0.7).toFixed(2));
  const boosterCap = Number((STARTING_CAPITAL_USD * 0.3).toFixed(2));

  const makeBook = (agent: AgentId, share: number, cap: number): AgentBook => ({
    agent,
    allocationShare: share,
    freeCashUsd: cap,
    peakEquityUsd: cap,
    dailyStartDateUtc: todayUtc,
    dailyStartEquityUsd: cap,
    positions: [],
    pendingOrders: [],
    closedTrades: [],
    shadowVetoed: [],
  });

  return {
    version: 'futures-v1',
    mode: 'paper-cron',
    createdAt: nowIso,
    lastCycleAt: nowIso,
    startingCapitalUsd: STARTING_CAPITAL_USD,
    feeRatePerSide: DEFAULT_FEE_PER_SIDE,
    fundingRatePer8h: FUNDING_PER_8H,
    consecutiveErrors: 0,
    universe: [...FALLBACK_UNIVERSE],
    universeUpdatedAt: '1970-01-01T00:00:00.000Z',
    btcRegime: null,
    books: {
      'wyckoff-4h': makeBook('wyckoff-4h', 0.7, coreCap),
      'smc-1h-bear': makeBook('smc-1h-bear', 0.3, boosterCap),
    },
  };
}

async function sendTelegramAlert(lines: string[]): Promise<void> {
  if (lines.length === 0) return;
  const plain = `FUTURES ENGINE ALERT\n${lines.join('\n')}`;
  const html = `⚡ <b>FUTURES ENGINE ALERT</b>\n${lines.map((l) => escapeTelegramHtml(l)).join('\n')}`;
  await deliverTelegramMessage(html, plain);
}

function resolvePendingOrderOnBars(
  book: AgentBook,
  order: PendingOrder,
  bars5m: OHLCV[],
  precision: MarketPrecision,
  markPrices: Record<string, number>,
  feeRate: number,
  nowIso: string,
): { filledPos?: OpenPosition; note?: string } {
  if (nowIso >= order.expiresAt) {
    order.status = 'expired';
    order.statusNote = 'Limit order expired before fill.';
    return {};
  }

  const createdMs = Date.parse(order.createdAt);
  const relevant = bars5m.filter((b) => b.timestamp + 300_000 >= createdMs);

  for (const bar of relevant) {
    // Invalidate pending limit if stop touched before entry
    if (order.side === 'long' && bar.low <= order.stopPrice) {
      order.status = 'cancelled';
      order.statusNote = 'Stop level touched before limit fill.';
      return {};
    }
    if (order.side === 'short' && bar.high >= order.stopPrice) {
      order.status = 'cancelled';
      order.statusNote = 'Stop level touched before limit fill.';
      return {};
    }

    const touched =
      order.side === 'long'
        ? bar.low <= order.entryHigh && bar.high >= order.entryLow
        : bar.high >= order.entryLow && bar.low <= order.entryHigh;

    if (!touched) continue;

    const rawFill =
      order.side === 'long'
        ? Math.min(order.entryHigh, Math.max(order.entryLow, bar.open))
        : Math.max(order.entryLow, Math.min(order.entryHigh, bar.open));
    const entryPrice = roundToTick(rawFill, precision.tickSize);

    if (
      (order.side === 'long' && entryPrice <= order.stopPrice) ||
      (order.side === 'short' && entryPrice >= order.stopPrice)
    ) {
      order.status = 'rejected';
      order.statusNote = 'Fill gapped beyond stop price.';
      return {};
    }

    const equity = bookEquityUsd(book, markPrices);
    const initRisk = Math.abs(entryPrice - order.stopPrice);
    const netRiskPct = (initRisk + feeRate * (entryPrice + order.stopPrice)) / entryPrice;
    const availMargin = Math.max(
      0,
      book.freeCashUsd - equity * RISK_LIMITS.minFreeCashBufferPct,
    );

    let targetNotional = (equity * order.finalRiskPct) / netRiskPct;
    let requiredMargin = targetNotional / order.finalLeverage;
    if (requiredMargin > availMargin) {
      if (availMargin < requiredMargin * 0.25) {
        order.status = 'rejected';
        order.statusNote = 'Insufficient free margin buffer at fill time.';
        return {};
      }
      requiredMargin = availMargin;
      targetNotional = requiredMargin * order.finalLeverage;
    }

    // Solusi Nomer 4: Precision, stepSize, minNotional & Partial TP1 auto-fallback
    const execPlan = planOrderExecution(
      targetNotional,
      entryPrice,
      order.tp1Price,
      precision,
      0.5,
    );
    if (!execPlan.accepted) {
      order.status = 'rejected';
      order.statusNote = execPlan.rejectReason;
      return { note: execPlan.precisionNote };
    }

    const finalNotional = execPlan.totalNotionalUsd;
    const finalMargin = finalNotional / order.finalLeverage;
    const entryFee = finalNotional * feeRate;
    if (finalMargin + entryFee > book.freeCashUsd) {
      order.status = 'rejected';
      order.statusNote = 'Insufficient cash for margin + entry fee.';
      return {};
    }

    book.freeCashUsd -= finalMargin + entryFee;
    order.status = 'filled';
    order.statusNote = execPlan.precisionNote;

    const filledAtIso = new Date(bar.timestamp).toISOString();
    const pos: OpenPosition = {
      id: `pos-${order.id}`,
      clientOrderId: order.clientOrderId,
      agent: order.agent,
      symbol: order.symbol,
      side: order.side,
      openedAt: filledAtIso,
      timeStopAt: new Date(bar.timestamp + order.timeStopHours * 3_600_000).toISOString(),
      entryPrice,
      stopPrice: roundToTick(order.stopPrice, precision.tickSize),
      initialStopPrice: roundToTick(order.stopPrice, precision.tickSize),
      tp1Price: roundToTick(order.tp1Price, precision.tickSize),
      tp2Price: order.tp2Price != null ? roundToTick(order.tp2Price, precision.tickSize) : null,
      trailAtrMultiple: order.trailAtrMultiple,
      initialRiskPerUnit: initRisk,
      netRiskPct,
      leverage: order.finalLeverage,
      riskPct: order.finalRiskPct,
      marginUsd: finalMargin,
      notionalUsd: finalNotional,
      initialQty: execPlan.totalQty,
      remainingQty: execPlan.totalQty,
      tp1Qty: execPlan.tp1Qty,
      partialTpEnabled: execPlan.partialTpEnabled,
      tp1Hit: false,
      realizedPartialPnlUsd: 0,
      fundingPaidUsd: 0,
      feesPaidUsd: entryFee,
      extremeFavorablePrice: entryPrice,
      mfeR: 0,
      maeR: 0,
      precisionNote: execPlan.precisionNote,
      quantBaseLeverage: order.baseLeverage,
      quantBaseRiskPct: order.baseRiskPct,
      geminiAction: order.geminiEvaluation.action,
    };

    book.positions.push(pos);
    return { filledPos: pos, note: execPlan.precisionNote };
  }

  return {};
}

function advanceOpenPositionOnBars(
  book: AgentBook,
  pos: OpenPosition,
  bars5m: OHLCV[],
  latestAtrForTrail: number,
  precision: MarketPrecision,
  feeRate: number,
  nowIso: string,
): ClosedTrade | null {
  const openedMs = Date.parse(pos.openedAt);
  const relevant = bars5m.filter((b) => b.timestamp > openedMs);
  const liqDistPct = pos.leverage > 1 ? 1 / pos.leverage - MAINTENANCE_MARGIN_RATE : 1;

  for (const bar of relevant) {
    // Update MFE / MAE in R-multiples
    const favR =
      pos.side === 'long'
        ? (bar.high - pos.entryPrice) / pos.initialRiskPerUnit
        : (pos.entryPrice - bar.low) / pos.initialRiskPerUnit;
    const advR =
      pos.side === 'long'
        ? (pos.entryPrice - bar.low) / pos.initialRiskPerUnit
        : (bar.high - pos.entryPrice) / pos.initialRiskPerUnit;
    if (favR > pos.mfeR) pos.mfeR = Number(favR.toFixed(3));
    if (advR > pos.maeR) pos.maeR = Number(advR.toFixed(3));

    const barIso = new Date(bar.timestamp).toISOString();
    const hrsHeld = Math.max(0, (bar.timestamp - openedMs) / 3_600_000);
    const expectedFundingEvents = Math.floor(hrsHeld / 8);
    const targetFundingUsd = expectedFundingEvents * FUNDING_PER_8H * (pos.remainingQty * pos.entryPrice);
    if (targetFundingUsd > pos.fundingPaidUsd) {
      pos.fundingPaidUsd = targetFundingUsd;
    }

    // 1. Check Isolated Liquidation First (ultra-conservative)
    const adversePct =
      pos.side === 'long'
        ? (pos.entryPrice - bar.low) / pos.entryPrice
        : (bar.high - pos.entryPrice) / pos.entryPrice;
    if (pos.leverage > 1 && adversePct >= liqDistPct) {
      return closePosition(book, pos, pos.stopPrice, barIso, 'Isolated Liquidation (flash wick)', feeRate, true);
    }

    // 2. Check Stop-Loss / Breakeven / Trailing Stop (pessimistic: stop checked BEFORE target on same bar)
    const hitStop = pos.side === 'long' ? bar.low <= pos.stopPrice : bar.high >= pos.stopPrice;
    if (hitStop) {
      const exitPrice =
        pos.side === 'long'
          ? Math.min(pos.stopPrice, bar.open < pos.stopPrice ? bar.open : pos.stopPrice)
          : Math.max(pos.stopPrice, bar.open > pos.stopPrice ? bar.open : pos.stopPrice);
      const reason = pos.tp1Hit
        ? pos.tp2Price == null
          ? 'Chandelier Trailing Stop (Runner)'
          : 'Breakeven Stop setelah TP1'
        : 'Stop Loss Struktur/ATR';
      return closePosition(book, pos, exitPrice, barIso, reason, feeRate, false);
    }

    // 3. Update extreme favorable price
    if (pos.side === 'long' && bar.high > pos.extremeFavorablePrice) {
      pos.extremeFavorablePrice = bar.high;
    } else if (pos.side === 'short' && bar.low < pos.extremeFavorablePrice) {
      pos.extremeFavorablePrice = bar.low;
    }

    // 4. Check Partial TP1 (or 100% TP1 if Solusi #4 disabled split)
    const hitTp1 = pos.side === 'long' ? bar.high >= pos.tp1Price : bar.low <= pos.tp1Price;
    if (!pos.tp1Hit && hitTp1) {
      if (!pos.partialTpEnabled || pos.tp1Qty >= pos.remainingQty) {
        return closePosition(
          book,
          pos,
          pos.tp1Price,
          barIso,
          'TP1 Full Exit (auto-fallback minNotional)',
          feeRate,
          false,
        );
      }
      // Execute 50% scale-out
      const closeQty = pos.tp1Qty;
      const grossPartial =
        pos.side === 'long'
          ? (pos.tp1Price - pos.entryPrice) * closeQty
          : (pos.entryPrice - pos.tp1Price) * closeQty;
      const exitFee = closeQty * pos.tp1Price * feeRate;
      const releasedMargin = pos.marginUsd * (closeQty / pos.remainingQty);

      pos.marginUsd -= releasedMargin;
      pos.remainingQty = Number((pos.remainingQty - closeQty).toFixed(8));
      pos.feesPaidUsd += exitFee;
      pos.realizedPartialPnlUsd += grossPartial - exitFee;
      book.freeCashUsd += releasedMargin + grossPartial - exitFee;
      pos.tp1Hit = true;

      // Move stop to breakeven (+fee)
      const be = roundToTick(breakevenStopPrice(pos.side, pos.entryPrice, feeRate), precision.tickSize);
      pos.stopPrice =
        pos.side === 'long' ? Math.max(pos.stopPrice, be) : Math.min(pos.stopPrice, be);
    }

    // 5. Runner Management: Fixed TP2 or Chandelier Trailing 3.0x ATR
    if (pos.tp2Price != null) {
      const hitTp2 = pos.side === 'long' ? bar.high >= pos.tp2Price : bar.low <= pos.tp2Price;
      if (hitTp2) {
        return closePosition(book, pos, pos.tp2Price, barIso, 'Target TP2 Tercapai', feeRate, false);
      }
    } else if (pos.tp1Hit && latestAtrForTrail > 0) {
      const trail =
        pos.side === 'long'
          ? roundToTick(pos.extremeFavorablePrice - pos.trailAtrMultiple * latestAtrForTrail, precision.tickSize)
          : roundToTick(pos.extremeFavorablePrice + pos.trailAtrMultiple * latestAtrForTrail, precision.tickSize);
      pos.stopPrice =
        pos.side === 'long' ? Math.max(pos.stopPrice, trail) : Math.min(pos.stopPrice, trail);
    }

    // 6. Time Stop
    if (barIso >= pos.timeStopAt) {
      return closePosition(book, pos, bar.close, barIso, 'Time Stop tercapai', feeRate, false);
    }
  }

  // Also check if current time passed timeStopAt even if no bars returned
  if (nowIso >= pos.timeStopAt && relevant.length > 0) {
    const last = relevant[relevant.length - 1]!;
    return closePosition(book, pos, last.close, nowIso, 'Time Stop tercapai', feeRate, false);
  }

  return null;
}

function closePosition(
  book: AgentBook,
  pos: OpenPosition,
  exitPrice: number,
  closedAtIso: string,
  reason: string,
  feeRate: number,
  liquidated: boolean,
): ClosedTrade {
  const grossRem = liquidated
    ? -pos.marginUsd
    : pos.side === 'long'
      ? (exitPrice - pos.entryPrice) * pos.remainingQty
      : (pos.entryPrice - exitPrice) * pos.remainingQty;
  const exitFee = liquidated ? 0 : pos.remainingQty * exitPrice * feeRate;
  const remNet = grossRem - exitFee - pos.fundingPaidUsd;
  const returnToCash = liquidated ? 0 : Math.max(0, pos.marginUsd + remNet);

  book.freeCashUsd += returnToCash;
  const totalPnl = pos.realizedPartialPnlUsd + remNet - (pos.feesPaidUsd - exitFee);
  // Wait: entryFee was already deducted from freeCashUsd on open; realizedPartialPnlUsd already deducted partial exitFee.
  // Accurate net P&L = realizedPartialPnlUsd + grossRem - exitFee - fundingPaidUsd - entryFee_portion_not_in_partial
  const entryFeeOnly = pos.feesPaidUsd - (pos.tp1Hit ? pos.tp1Qty * pos.tp1Price * feeRate : 0);
  const netPnlUsd = liquidated
    ? -(pos.marginUsd + entryFeeOnly) + pos.realizedPartialPnlUsd
    : pos.realizedPartialPnlUsd + grossRem - exitFee - pos.fundingPaidUsd - entryFeeOnly;

  const initialRiskUsd = pos.notionalUsd * pos.netRiskPct;
  const rMultiple = initialRiskUsd > 0 ? netPnlUsd / initialRiskUsd : 0;

  // Shadow A/B: scale realized PnL proportionally to what Quant-only sizing would have earned
  const sizeScale =
    pos.riskPct > 0 && pos.quantBaseRiskPct > 0 ? pos.quantBaseRiskPct / pos.riskPct : 1;
  const quantOnlyPnlUsd = netPnlUsd * sizeScale;
  const quantOnlyRMultiple = rMultiple; // same R-multiple, different dollar scale

  const holdHours = Math.max(
    0.1,
    (Date.parse(closedAtIso) - Date.parse(pos.openedAt)) / 3_600_000,
  );

  const trade: ClosedTrade = {
    id: `tr-${pos.id}`,
    clientOrderId: pos.clientOrderId,
    agent: pos.agent,
    symbol: pos.symbol,
    side: pos.side,
    openedAt: pos.openedAt,
    closedAt: closedAtIso,
    holdHours: Number(holdHours.toFixed(1)),
    entryPrice: pos.entryPrice,
    exitPrice,
    leverage: pos.leverage,
    partialTpEnabled: pos.partialTpEnabled,
    tp1Hit: pos.tp1Hit,
    pnlUsd: Number(netPnlUsd.toFixed(2)),
    rMultiple: Number(rMultiple.toFixed(3)),
    quantOnlyPnlUsd: Number(quantOnlyPnlUsd.toFixed(2)),
    quantOnlyRMultiple: Number(quantOnlyRMultiple.toFixed(3)),
    geminiAction: pos.geminiAction,
    feesUsd: Number((pos.feesPaidUsd + exitFee).toFixed(2)),
    fundingUsd: Number(pos.fundingPaidUsd.toFixed(2)),
    mfeR: pos.mfeR,
    maeR: pos.maeR,
    closeReason: reason,
  };

  book.positions = book.positions.filter((p) => p.id !== pos.id);
  book.closedTrades.push(trade);
  void totalPnl;
  return trade;
}

function advanceShadowVetoed(
  shadow: ShadowVetoedSignal,
  bars5m: OHLCV[],
  feeRate: number,
  nowIso: string,
): void {
  if (shadow.status === 'closed' || shadow.status === 'expired') return;
  const createdMs = Date.parse(shadow.createdAt);
  const relevant = bars5m.filter((b) => b.timestamp >= createdMs);

  for (const bar of relevant) {
    const barIso = new Date(bar.timestamp).toISOString();
    if (shadow.status === 'watching') {
      if (barIso >= shadow.expiresAt) {
        shadow.status = 'expired';
        return;
      }
      const touched =
        shadow.side === 'long'
          ? bar.low <= shadow.entryHigh && bar.high >= shadow.entryLow
          : bar.high >= shadow.entryLow && bar.low <= shadow.entryHigh;
      if (touched) {
        shadow.status = 'open';
        shadow.filledAt = barIso;
        shadow.entryPrice =
          shadow.side === 'long'
            ? Math.min(shadow.entryHigh, Math.max(shadow.entryLow, bar.open))
            : Math.max(shadow.entryLow, Math.min(shadow.entryHigh, bar.open));
        shadow.activeStop = shadow.stopPrice;
        shadow.tp1Hit = false;
        shadow.extremeFav = shadow.entryPrice;
      }
      continue;
    }

    if (shadow.status === 'open' && shadow.entryPrice && shadow.activeStop) {
      const initRisk = Math.abs(shadow.entryPrice - shadow.stopPrice);
      const hitStop =
        shadow.side === 'long' ? bar.low <= shadow.activeStop : bar.high >= shadow.activeStop;
      const hitTp1 =
        shadow.side === 'long' ? bar.high >= shadow.tp1Price : bar.low <= shadow.tp1Price;
      const hitTp2 =
        shadow.tp2Price != null &&
        (shadow.side === 'long' ? bar.high >= shadow.tp2Price : bar.low <= shadow.tp2Price);

      if (hitStop) {
        const remR =
          shadow.side === 'long'
            ? (shadow.activeStop - shadow.entryPrice) / initRisk
            : (shadow.entryPrice - shadow.activeStop) / initRisk;
        shadow.realizedR = Number(((shadow.tp1Hit ? 0.6 + 0.5 * remR : remR) - 0.05).toFixed(2));
        shadow.status = 'closed';
        shadow.closedAt = barIso;
        return;
      }
      if (!shadow.tp1Hit && hitTp1) {
        shadow.tp1Hit = true;
        shadow.activeStop = breakevenStopPrice(shadow.side, shadow.entryPrice, feeRate);
      }
      if (hitTp2 && shadow.tp2Price != null) {
        const tp2R =
          shadow.side === 'long'
            ? (shadow.tp2Price - shadow.entryPrice) / initRisk
            : (shadow.entryPrice - shadow.tp2Price) / initRisk;
        shadow.realizedR = Number((0.6 + 0.5 * tp2R - 0.05).toFixed(2));
        shadow.status = 'closed';
        shadow.closedAt = barIso;
        return;
      }
      if (
        shadow.filledAt &&
        bar.timestamp >= Date.parse(shadow.filledAt) + shadow.timeStopHours * 3_600_000
      ) {
        const curR =
          shadow.side === 'long'
            ? (bar.close - shadow.entryPrice) / initRisk
            : (shadow.entryPrice - bar.close) / initRisk;
        shadow.realizedR = Number(((shadow.tp1Hit ? 0.6 + 0.5 * curR : curR) - 0.05).toFixed(2));
        shadow.status = 'closed';
        shadow.closedAt = barIso;
        return;
      }
    }
  }

  if (shadow.status === 'watching' && nowIso >= shadow.expiresAt) {
    shadow.status = 'expired';
  }
}

function buildDashboardSummary(
  ledger: FuturesLedger,
  markPrices: Record<string, number>,
  universeDiagnostics: UniverseCoinDiagnostic[],
) {
  const totalEquityUsd = totalPortfolioEquityUsd(ledger, markPrices);
  const agents = Object.values(ledger.books).map((book) => {
    const eq = bookEquityUsd(book, markPrices);
    const startEq = ledger.startingCapitalUsd * book.allocationShare;
    const wins = book.closedTrades.filter((t) => t.pnlUsd > 0).length;
    const gw = book.closedTrades.filter((t) => t.pnlUsd > 0).reduce((s, t) => s + t.pnlUsd, 0);
    const gl = Math.abs(
      book.closedTrades.filter((t) => t.pnlUsd <= 0).reduce((s, t) => s + t.pnlUsd, 0),
    );
    const quantNetPnl = book.closedTrades.reduce((s, t) => s + t.quantOnlyPnlUsd, 0);
    const geminiNetPnl = book.closedTrades.reduce((s, t) => s + t.pnlUsd, 0);
    return {
      agent: book.agent,
      allocationShare: book.allocationShare,
      equityUsd: Number(eq.toFixed(2)),
      freeCashUsd: Number(book.freeCashUsd.toFixed(2)),
      pnlPct: Number((((eq - startEq) / startEq) * 100).toFixed(2)),
      maxDrawdownPct: Number(
        (book.peakEquityUsd > 0 ? (1 - eq / book.peakEquityUsd) * 100 : 0).toFixed(2),
      ),
      openPositions: book.positions.length,
      pendingOrders: book.pendingOrders.filter((o) => o.status === 'pending').length,
      closedTrades: book.closedTrades.length,
      winRatePct: book.closedTrades.length
        ? Number(((wins / book.closedTrades.length) * 100).toFixed(1))
        : 0,
      profitFactor: gl > 0 ? Number((gw / gl).toFixed(2)) : gw > 0 ? 99 : 0,
      shadowAbComparison: {
        quantOnlyNetPnlUsd: Number(quantNetPnl.toFixed(2)),
        geminiAdjustedNetPnlUsd: Number(geminiNetPnl.toFixed(2)),
        vetoCalibration: computeVetoCalibration(book),
      },
      killSwitchActive: Boolean(
        book.haltedForAudit || (book.killSwitchUntil && ledger.lastCycleAt < book.killSwitchUntil),
      ),
      killSwitchReason: book.killSwitchReason ?? null,
    };
  });

  return {
    generatedAt: ledger.lastCycleAt,
    mode: ledger.mode,
    startingCapitalUsd: ledger.startingCapitalUsd,
    totalEquityUsd: Number(totalEquityUsd.toFixed(2)),
    totalPnlPct: Number(
      (((totalEquityUsd - ledger.startingCapitalUsd) / ledger.startingCapitalUsd) * 100).toFixed(2),
    ),
    btcRegime: ledger.btcRegime,
    llmHealth: ledger.llmHealth ?? null,
    universe: ledger.universe,
    universeDiagnostics,
    agents,
    openPositions: Object.values(ledger.books).flatMap((b) => b.positions),
    pendingOrders: Object.values(ledger.books).flatMap((b) =>
      b.pendingOrders.filter((o) => o.status === 'pending'),
    ),
    recentTrades: Object.values(ledger.books)
      .flatMap((b) => b.closedTrades)
      .sort((a, b) => b.closedAt.localeCompare(a.closedAt))
      .slice(0, 30),
  };
}

async function main() {
  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const nowMs = nowDate.getTime();
  const ledger = ensureDeskInitialized(nowIso);
  const alerts: string[] = [];

  try {
    const precisionMap = await loadPrecisionMap();

    // 1. Refresh dynamic universe weekly (every 7 days)
    const universeAgeDays = (nowMs - Date.parse(ledger.universeUpdatedAt)) / 86_400_000;
    const pinnedSymbols = [
      ...new Set([
        ...Object.values(ledger.books).flatMap((b) => b.positions.map((p) => p.symbol)),
        ...Object.values(ledger.books).flatMap((b) =>
          b.pendingOrders.filter((o) => o.status === 'pending').map((o) => o.symbol),
        ),
      ]),
    ];
    if (universeAgeDays >= 7 || ledger.universe.length < 6) {
      const discovered = await discoverDynamicUniverse(pinnedSymbols);
      ledger.universe = discovered.symbols;
      ledger.universeUpdatedAt = discovered.updatedAt;
    }

    // 1b. Daily lightweight LLM health smoke-check (~50 tokens once per 24h)
    const llmHealthAgeHours = ledger.llmHealth?.checkedAt
      ? (nowMs - Date.parse(ledger.llmHealth.checkedAt)) / 3_600_000
      : Infinity;
    if (!ledger.llmHealth || !ledger.llmHealth.ok || llmHealthAgeHours >= 24) {
      ledger.llmHealth = await pingGeminiPretradeModel();
      console.log(`[LLM Health] ${ledger.llmHealth.ok ? 'OK' : 'FAIL'} (${ledger.llmHealth.modelUsed}): ${ledger.llmHealth.detail}`);
    }

    // 2. Fetch BTC 4H Macro Regime
    const btc4Raw = await fetchKlines('BTCUSDT', '4h', 260);
    const btc4Closed = extractLatestClosedBars(btc4Raw);
    const btc4Ind = computeIndicators(btc4Closed);
    const btcRegime = computeBtcRegimeAt(btc4Ind, btc4Closed.length - 1);
    if (!btcRegime) throw new Error('Insufficient BTCUSDT 4H data to compute macro regime.');
    ledger.btcRegime = btcRegime;

    // 3. Collect all symbols we need 5m replay candles for (active positions, pending orders, shadow vetoes)
    const replaySymbols = new Set<string>([
      ...pinnedSymbols,
      ...Object.values(ledger.books).flatMap((b) =>
        b.shadowVetoed
          .filter((s) => s.status === 'watching' || s.status === 'open')
          .map((s) => s.symbol),
      ),
    ]);

    const lastCycleMs = Date.parse(ledger.lastCycleAt);
    const replayStartMs = Math.max(nowMs - 48 * 3_600_000, lastCycleMs - 15 * 60_000);
    const bars5mBySymbol = new Map<string, OHLCV[]>();
    const markPrices: Record<string, number> = { BTCUSDT: btcRegime.close };

    for (const sym of replaySymbols) {
      try {
        const bars5m = await fetchKlinesRange(sym, '5m', replayStartMs, nowMs);
        bars5mBySymbol.set(sym, bars5m);
        const lastBar = bars5m.at(-1);
        if (lastBar) markPrices[sym] = lastBar.close;
      } catch (err) {
        console.warn(`[Replay 5m] Failed for ${sym}: ${String(err)}`);
      }
    }

    // Fetch 4H/1H candles for universe symbols (used for ATR trailing & signal scanning)
    const data4h = new Map<string, ReturnType<typeof computeIndicators>>();
    const data1h = new Map<string, ReturnType<typeof computeIndicators>>();
    const scanSymbols = [...new Set([...ledger.universe, ...replaySymbols])];

    for (const sym of scanSymbols) {
      try {
        const [raw4h, raw1h] = await Promise.all([
          fetchKlines(sym, '4h', 120),
          fetchKlines(sym, '1h', 120),
        ]);
        const c4 = extractLatestClosedBars(raw4h);
        const c1 = extractLatestClosedBars(raw1h);
        if (c4.length >= 60) data4h.set(sym, computeIndicators(c4));
        if (c1.length >= 60) data1h.set(sym, computeIndicators(c1));
        const liveClose = raw1h.at(-1)?.close ?? raw4h.at(-1)?.close;
        if (liveClose) markPrices[sym] = liveClose;
      } catch (err) {
        console.warn(`[Scan fetch] Failed for ${sym}: ${String(err)}`);
      }
    }

    // 4. Advance open positions, pending orders, and shadow vetoes using 5m replay candles
    for (const book of Object.values(ledger.books)) {
      for (const pos of [...book.positions]) {
        const bars5m = bars5mBySymbol.get(pos.symbol) ?? [];
        const precision = getPrecisionForSymbol(pos.symbol, precisionMap);
        const trailAtr =
          pos.agent === 'wyckoff-4h'
            ? (data4h.get(pos.symbol)?.atr14.at(-1) ?? 0)
            : (data1h.get(pos.symbol)?.atr14.at(-1) ?? 0);
        const closed = advanceOpenPositionOnBars(
          book,
          pos,
          bars5m,
          trailAtr,
          precision,
          ledger.feeRatePerSide,
          nowIso,
        );
        if (closed) {
          alerts.push(
            `🔔 *CLOSED* [${closed.agent}] ${closed.symbol} ${closed.side.toUpperCase()} | PnL: $${closed.pnlUsd} (${closed.rMultiple >= 0 ? '+' : ''}${closed.rMultiple}R) | ${closed.closeReason}`,
          );
        }
      }

      for (const order of book.pendingOrders.filter((o) => o.status === 'pending')) {
        const bars5m = bars5mBySymbol.get(order.symbol) ?? [];
        const precision = getPrecisionForSymbol(order.symbol, precisionMap);
        const { filledPos } = resolvePendingOrderOnBars(
          book,
          order,
          bars5m,
          precision,
          markPrices,
          ledger.feeRatePerSide,
          nowIso,
        );
        if (filledPos) {
          alerts.push(
            `✅ *FILLED* [${filledPos.agent}] ${filledPos.symbol} ${filledPos.side.toUpperCase()} @ ${filledPos.entryPrice} | Lev ${filledPos.leverage}x | PartialTP: ${filledPos.partialTpEnabled ? 'ON' : '100% Fallback'}`,
          );
        }
      }

      for (const shadow of book.shadowVetoed.filter(
        (s) => s.status === 'watching' || s.status === 'open',
      )) {
        advanceShadowVetoed(
          shadow,
          bars5mBySymbol.get(shadow.symbol) ?? [],
          ledger.feeRatePerSide,
          nowIso,
        );
      }

      // Trim old history lists gently
      book.pendingOrders = book.pendingOrders.slice(-80);
      book.shadowVetoed = book.shadowVetoed.slice(-80);

      // Update Daily & MaxDD Kill-Switches
      const eq = bookEquityUsd(book, markPrices);
      const ks = updateKillSwitches(book, eq, nowIso);
      if (ks.triggered && ks.reason) {
        alerts.push(`🛑 *KILL-SWITCH* [${book.agent}]: ${ks.reason}`);
      }
    }

    // 5. Scan New Signals & Build Per-Coin Evaluation Diagnostics
    const macroWindow = evaluateMacroWindow(nowMs);
    const universeDiagnostics: UniverseCoinDiagnostic[] = [];
    let newOrdersCreated = 0;
    let vetoedCount = 0;

    for (const sym of ledger.universe) {
      const d4 = data4h.get(sym);
      const d1 = data1h.get(sym);
      if (!d4 || !d1) continue;

      universeDiagnostics.push(diagnoseCoinAt(sym, d4, d1, btcRegime, markPrices[sym]));

      const candidates = [
        evaluateWyckoff4HAt(sym, d4, d4.bars.length - 1, btcRegime, {
          fee: ledger.feeRatePerSide,
          useFixedTp2: USE_FIXED_TP2_WYCKOFF,
        }),
        evaluateSmc1HBearAt(
          sym,
          d1,
          d1.bars.length - 1,
          d4.bars.at(-1)!.close,
          d4.ema21.at(-1)!,
          btcRegime,
        ),
      ].filter((c): c is NonNullable<typeof c> => c !== null);

      for (const candidate of candidates) {
        // Skip Conviction 0-1 before calling Gemini (validated PF 0.79 historical)
        if (candidate.conviction.baseLeverage === 0) continue;

        const book = ledger.books[candidate.agent];
        const clientOrderId = `${candidate.agent}-${candidate.symbol}-${candidate.signalBarAt}`;

        // Idempotency check: never create duplicate order for the same signal bar
        const alreadySeen =
          book.pendingOrders.some((o) => o.clientOrderId === clientOrderId) ||
          book.positions.some((p) => p.clientOrderId === clientOrderId) ||
          book.closedTrades.some((t) => t.clientOrderId === clientOrderId) ||
          book.shadowVetoed.some((s) => s.id === `veto-${clientOrderId}`);
        if (alreadySeen) continue;

        const riskCheck = checkPortfolioRiskBeforeEntry(
          ledger,
          book,
          candidate.symbol,
          candidate.side,
          candidate.conviction.baseRiskPct,
          nowIso,
          markPrices,
        );
        if (!riskCheck.allowed) continue;

        // Pre-trade event-driven call to Gemini 4 Neon with 3-Layer Memory + Sanitized News
        const headlines = await fetchSanitizedCryptoNews(candidate.symbol, 8);
        const memory = buildStructuredMemoryPack(ledger, book, candidate.symbol, LESSONS_PATH);
        const evaluation = await evaluateSignalWithGemini({
          candidate,
          btcRegime,
          macro: macroWindow,
          headlines,
          memory,
        });
        if (!evaluation.fallbackUsed && evaluation.modelUsed !== 'deterministic-macro-guard') {
          ledger.llmHealth = {
            checkedAt: evaluation.evaluatedAt,
            ok: true,
            modelUsed: evaluation.modelUsed,
            latencyMs: 0,
            detail: `Evaluasi live ${candidate.symbol} (${evaluation.action} ${evaluation.finalLeverage}x) berhasil.`,
          };
        }

        const expiresAt = new Date(nowMs + candidate.expiryHours * 3_600_000).toISOString();

        if (evaluation.action === 'VETO' || evaluation.finalLeverage === 0) {
          vetoedCount++;
          book.shadowVetoed.push({
            id: `veto-${clientOrderId}`,
            agent: candidate.agent,
            symbol: candidate.symbol,
            side: candidate.side,
            createdAt: nowIso,
            expiresAt,
            entryLow: candidate.entryLow,
            entryHigh: candidate.entryHigh,
            stopPrice: candidate.stopPrice,
            tp1Price: candidate.tp1Price,
            tp2Price: candidate.tp2Price,
            trailAtrMultiple: candidate.trailAtrMultiple,
            timeStopHours: candidate.timeStopHours,
            baseLeverage: candidate.conviction.baseLeverage,
            baseRiskPct: candidate.conviction.baseRiskPct,
            geminiReasoning: evaluation.reasoning,
            status: 'watching',
          });
          alerts.push(
            `🛡️ *VETO* [${candidate.agent}] ${candidate.symbol} ${candidate.side.toUpperCase()} (${evaluation.modelUsed}): ${evaluation.reasoning}`,
          );
          continue;
        }

        const pendingOrder: PendingOrder = {
          id: candidate.id,
          clientOrderId,
          agent: candidate.agent,
          symbol: candidate.symbol,
          side: candidate.side,
          timeframe: candidate.timeframe,
          createdAt: nowIso,
          expiresAt,
          entryLow: candidate.entryLow,
          entryHigh: candidate.entryHigh,
          stopPrice: candidate.stopPrice,
          tp1Price: candidate.tp1Price,
          tp2Price: candidate.tp2Price,
          trailAtrMultiple: candidate.trailAtrMultiple,
          atrAtSignal: candidate.atrAtSignal,
          timeStopHours: candidate.timeStopHours,
          baseLeverage: candidate.conviction.baseLeverage,
          baseRiskPct: candidate.conviction.baseRiskPct,
          finalLeverage: evaluation.finalLeverage,
          finalRiskPct: evaluation.finalRiskPct,
          convictionScore: candidate.conviction.score,
          geminiEvaluation: evaluation,
          status: 'pending',
        };
        book.pendingOrders.push(pendingOrder);
        newOrdersCreated++;
        alerts.push(
          `📌 *PENDING* [${candidate.agent}] ${candidate.symbol} ${candidate.side.toUpperCase()} | Conv ${candidate.conviction.score}/5 | ${evaluation.action} ${evaluation.finalLeverage}x (${evaluation.modelUsed})`,
        );
      }
    }

    ledger.lastCycleAt = nowIso;
    ledger.consecutiveErrors = 0;

    fs.mkdirSync(DESK_DIR, { recursive: true });
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n');
    const summary = buildDashboardSummary(ledger, markPrices, universeDiagnostics);
    fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2) + '\n');
    fs.appendFileSync(
      LOG_PATH,
      JSON.stringify({
        timestamp: nowIso,
        totalEquityUsd: summary.totalEquityUsd,
        btcClose: btcRegime.close,
        btcMacroBull: btcRegime.macroBull,
        macroBlackout: macroWindow.hardBlackout,
        newOrdersCreated,
        vetoedCount,
      }) + '\n',
    );

    if (alerts.length > 0) {
      await sendTelegramAlert(alerts);
    }

    console.log(
      `[Futures Paper] Cycle ${nowIso} complete | Equity: $${summary.totalEquityUsd} (${summary.totalPnlPct}%) | BTC Macro: ${btcRegime.macroBull ? 'BULL' : 'BEAR'} | New Orders: ${newOrdersCreated} | Vetoes: ${vetoedCount}`,
    );
  } catch (error) {
    ledger.consecutiveErrors += 1;
    fs.mkdirSync(DESK_DIR, { recursive: true });
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n');
    if (ledger.consecutiveErrors >= 2) {
      await sendTelegramAlert([
        `🚨 HEARTBEAT ALERT: Futures Paper Engine gagal ${ledger.consecutiveErrors}x berturut-turut: ${String(error).slice(0, 260)}`,
      ]);
    }
    throw error;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
