import type { AgentBook, FuturesLedger, OpenPosition, Side } from './types.js';

export const RISK_LIMITS = {
  maxLeverageHardCap: 3, // Hard cap 3x Isolated Margin
  maxPositionsTotal: 5, // Across entire portfolio
  maxSameDirectionTotal: 3, // Blind-Spot #1: Net Directional Correlation Cap (max 3 Long OR max 3 Short)
  maxTotalOpenRiskPct: 0.04, // Max 4.0% combined open risk across portfolio
  minFreeCashBufferPct: 0.15, // Always preserve >= 15% free margin buffer
  dailyLossKillSwitchPct: 0.02, // -2% daily drawdown -> 24h entry lock
  maxDrawdownHaltPct: 0.08, // -8% peak-to-trough -> system halt for audit
  alphaDecayMinTrades: 40, // Blind-Spot #8: Retirement rule
  alphaDecayMinPf: 1.05,
} as const;

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

export function bookEquityUsd(book: AgentBook, markPrices: Record<string, number>): number {
  let equity = book.freeCashUsd;
  for (const pos of book.positions) {
    const mark = markPrices[pos.symbol] ?? pos.entryPrice;
    const unrealized =
      pos.side === 'long'
        ? (mark - pos.entryPrice) * pos.remainingQty
        : (pos.entryPrice - mark) * pos.remainingQty;
    equity += pos.marginUsd + unrealized;
  }
  return Math.max(0, equity);
}

export function totalPortfolioEquityUsd(
  ledger: FuturesLedger,
  markPrices: Record<string, number>,
): number {
  return Object.values(ledger.books).reduce(
    (sum, book) => sum + bookEquityUsd(book, markPrices),
    0,
  );
}

export function allOpenPositions(ledger: FuturesLedger): OpenPosition[] {
  return Object.values(ledger.books).flatMap((book) => book.positions);
}

export function updateKillSwitches(
  book: AgentBook,
  currentEquity: number,
  nowIso: string,
): { triggered: boolean; reason?: string } {
  const todayUtc = nowIso.slice(0, 10);
  if (book.dailyStartDateUtc !== todayUtc) {
    book.dailyStartDateUtc = todayUtc;
    book.dailyStartEquityUsd = currentEquity;
  }

  if (currentEquity > book.peakEquityUsd) {
    book.peakEquityUsd = currentEquity;
  }

  const peakDd = book.peakEquityUsd > 0 ? 1 - currentEquity / book.peakEquityUsd : 0;
  if (peakDd >= RISK_LIMITS.maxDrawdownHaltPct) {
    book.haltedForAudit = true;
    book.killSwitchReason = `MAX_DD_HALT: Drawdown ${(peakDd * 100).toFixed(2)}% >= ${(RISK_LIMITS.maxDrawdownHaltPct * 100).toFixed(0)}% (wajib audit manual)`;
    return { triggered: true, reason: book.killSwitchReason };
  }

  const dailyLoss =
    book.dailyStartEquityUsd > 0 ? 1 - currentEquity / book.dailyStartEquityUsd : 0;
  if (dailyLoss >= RISK_LIMITS.dailyLossKillSwitchPct) {
    const unlockAt = new Date(Date.parse(nowIso) + 24 * 3_600_000).toISOString();
    book.killSwitchUntil = unlockAt;
    book.killSwitchReason = `DAILY_LOSS_LOCK: Rugi harian ${(dailyLoss * 100).toFixed(2)}% >= ${(RISK_LIMITS.dailyLossKillSwitchPct * 100).toFixed(0)}% (cooldown 24j hingga ${unlockAt})`;
    return { triggered: true, reason: book.killSwitchReason };
  }

  return { triggered: false };
}

export function checkAlphaDecay(book: AgentBook): { decayed: boolean; pf: number; trades: number } {
  const trades = book.closedTrades.length;
  if (trades < RISK_LIMITS.alphaDecayMinTrades) {
    return { decayed: false, pf: 0, trades };
  }
  const recent = book.closedTrades.slice(-RISK_LIMITS.alphaDecayMinTrades);
  const grossWin = recent.filter((t) => t.pnlUsd > 0).reduce((s, t) => s + t.pnlUsd, 0);
  const grossLoss = Math.abs(
    recent.filter((t) => t.pnlUsd <= 0).reduce((s, t) => s + t.pnlUsd, 0),
  );
  const pf = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;
  return {
    decayed: pf < RISK_LIMITS.alphaDecayMinPf,
    pf: Number(pf.toFixed(2)),
    trades,
  };
}

export function checkPortfolioRiskBeforeEntry(
  ledger: FuturesLedger,
  book: AgentBook,
  symbol: string,
  side: Side,
  proposedRiskPct: number,
  nowIso: string,
  markPrices: Record<string, number>,
): RiskCheckResult {
  if (book.haltedForAudit) {
    return { allowed: false, reason: book.killSwitchReason ?? 'Book dihentikan untuk audit manual.' };
  }
  if (book.killSwitchUntil && nowIso < book.killSwitchUntil) {
    return { allowed: false, reason: `Daily kill-switch aktif hingga ${book.killSwitchUntil}` };
  }

  const decay = checkAlphaDecay(book);
  if (decay.decayed) {
    return {
      allowed: false,
      reason: `Alpha-Decay Guard: PF ${decay.pf} < ${RISK_LIMITS.alphaDecayMinPf} pada ${decay.trades} trade terakhir (wajib audit Gemini Carbon).`,
    };
  }

  const openPositions = allOpenPositions(ledger);
  const pendingCount = Object.values(ledger.books).reduce(
    (sum, b) => sum + b.pendingOrders.filter((o) => o.status === 'pending').length,
    0,
  );

  // Max 1 active/pending position per coin globally
  const hasSameSymbol =
    openPositions.some((p) => p.symbol === symbol) ||
    Object.values(ledger.books).some((b) =>
      b.pendingOrders.some((o) => o.status === 'pending' && o.symbol === symbol),
    );
  if (hasSameSymbol) {
    return { allowed: false, reason: `Sudah ada posisi atau pending order aktif pada ${symbol}.` };
  }

  if (openPositions.length + pendingCount >= RISK_LIMITS.maxPositionsTotal) {
    return {
      allowed: false,
      reason: `Batas maksimal ${RISK_LIMITS.maxPositionsTotal} posisi/pending portofolio tercapai.`,
    };
  }

  // Blind-Spot #1: Directional Correlation Cap (max 3 Long OR max 3 Short across portfolio)
  const sameSideOpen = openPositions.filter((p) => p.side === side).length;
  const sameSidePending = Object.values(ledger.books).reduce(
    (sum, b) => sum + b.pendingOrders.filter((o) => o.status === 'pending' && o.side === side).length,
    0,
  );
  if (sameSideOpen + sameSidePending >= RISK_LIMITS.maxSameDirectionTotal) {
    return {
      allowed: false,
      reason: `Directional Correlation Cap: sudah ada ${sameSideOpen + sameSidePending} posisi/order ${side.toUpperCase()} (maks ${RISK_LIMITS.maxSameDirectionTotal}).`,
    };
  }

  // Total Open Risk Cap (<= 4.0% of total portfolio equity)
  const totalEq = totalPortfolioEquityUsd(ledger, markPrices);
  const bookEq = bookEquityUsd(book, markPrices);
  const existingOpenRiskUsd = openPositions.reduce((sum, pos) => {
    // Once TP1 hit & SL moved to breakeven, residual risk drops to ~0
    if (pos.tp1Hit) return sum;
    const stopDist = Math.abs(pos.entryPrice - pos.stopPrice);
    return sum + stopDist * pos.remainingQty;
  }, 0);
  const proposedRiskUsd = bookEq * proposedRiskPct;
  if (totalEq > 0 && (existingOpenRiskUsd + proposedRiskUsd) / totalEq > RISK_LIMITS.maxTotalOpenRiskPct) {
    return {
      allowed: false,
      reason: `Total Open Risk melebihi batas ${(RISK_LIMITS.maxTotalOpenRiskPct * 100).toFixed(1)}% ekuitas portofolio.`,
    };
  }

  // Minimum free cash buffer inside this book
  if (bookEq > 0 && book.freeCashUsd / bookEq < RISK_LIMITS.minFreeCashBufferPct) {
    return {
      allowed: false,
      reason: `Kas bebas book di bawah buffer minimum ${(RISK_LIMITS.minFreeCashBufferPct * 100).toFixed(0)}%.`,
    };
  }

  return { allowed: true };
}
