#!/usr/bin/env node
/**
 * Automated Paper Trading Execution Engine
 *
 * Features:
 * - Live Indodax IDR prices
 * - Stop Loss / Take Profit
 * - 2% risk per trade
 * - Up to 10x gross portfolio leverage
 * - Max 25% of maximum leveraged exposure per position
 * - Total gross exposure limit
 * - Margin accounting for synthetic long/short positions
 * - No stale scanner price fallback for execution
 * - Position validation
 * - Atomic JSON writes
 * - Briefing logs
 */

import fs from 'node:fs';
import path from 'node:path';

const DESK_DIR = path.resolve(process.cwd(), '.desk');

const LEDGER_PATH = path.join(DESK_DIR, 'paper-ledger.json');
const STATE_PATH = path.join(DESK_DIR, 'state.json');
const SCAN_PATH = path.join(DESK_DIR, 'latest-scan.json');
const BRIEFINGS_DIR = path.join(DESK_DIR, 'briefings');

/**
 * =========================
 * RISK CONFIGURATION
 * =========================
 */

const RISK_PER_TRADE = 0.02;          // 2% equity risk per trade
const STOP_LOSS_PERCENT = 0.02;       // 2% stop distance
const TAKE_PROFIT_RR = 2.5;           // TP = 2.5R

const MAX_LEVERAGE = 10;              // Maximum gross exposure = 10x equity
const MAX_POSITION_LEVERAGE = 2.5;    // Maximum single position = 2.5x equity

/**
 * NOTE:
 * MAX_POSITION_LEVERAGE = 2.5 means:
 *
 * Equity Rp100m
 * Maximum position notional = Rp250m
 *
 * Portfolio:
 * Maximum gross exposure = Rp1bn
 *
 * This leaves room for multiple positions while keeping
 * total gross exposure below 10x equity.
 */

type PositionSide = 'long' | 'short';

interface Position {
  side: PositionSide;
  size: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice?: number;
  opened: string;
  sizingNote?: string;
  notionalValue?: number;
  marginUsed?: number;
  leverage?: number;
}

interface Trade {
  timestamp: string;
  instrument: string;
  side: PositionSide;
  type: 'open' | 'close';
  size: number;
  price: number;
  reason?: string;
  realizedPnlIdr?: number;
  notionalValue?: number;
  marginUsed?: number;
}

interface AgentBook {
  balance: {
    IDR: number;
  };
  positions: Record<string, Position>;
  trades: Trade[];
}

interface Ledger {
  last_cycle?: string;
  agents: Record<string, AgentBook>;
}

interface State {
  desk?: {
    created?: string;
    mode?: string;
    last_session?: string;
  };
  agents?: Record<
    string,
    {
      last_action?: string;
    }
  >;
}

interface ScanCandidate {
  agent: string;
  pair: string;
  reason: string;
  data?: {
    close?: number;
    price?: number;
    lastClose?: number;
  };
}

interface Scan {
  candidates?: ScanCandidate[];
}

/**
 * =========================
 * SYMBOL NORMALIZATION
 * =========================
 */

function normalizeIndodaxKey(rawPair: string): string {
  let clean = String(rawPair)
    .trim()
    .toLowerCase()
    .replace(/[\/\-_]/g, '');

  if (!clean.endsWith('idr')) {
    clean += 'idr';
  }

  return clean.replace(/idr$/, '_idr');
}

function formatInstrument(rawPair: string): string {
  const symbol = String(rawPair)
    .trim()
    .replace(/[\/\-_]?idr$/i, '')
    .toUpperCase();

  return `${symbol}/IDR`;
}

/**
 * =========================
 * NUMBER HELPERS
 * =========================
 */

function isPositiveNumber(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0
  );
}

function safeNumber(
  value: unknown,
  fallback = 0
): number {
  return isPositiveNumber(value) ? value : fallback;
}

function formatIdr(value: number): string {
  if (!Number.isFinite(value)) return 'Rp0';

  return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}

/**
 * =========================
 * FILE HELPERS
 * =========================
 */

function ensureDeskDirectories(): void {
  if (!fs.existsSync(DESK_DIR)) {
    fs.mkdirSync(DESK_DIR, { recursive: true });
  }

  if (!fs.existsSync(BRIEFINGS_DIR)) {
    fs.mkdirSync(BRIEFINGS_DIR, { recursive: true });
  }
}

function readJson<T>(
  filePath: string,
  fallback: T
): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    const raw = fs.readFileSync(filePath, 'utf8');

    if (!raw.trim()) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(
      `[JSON Read Error] ${filePath}:`,
      error
    );

    return fallback;
  }
}

/**
 * Atomic write:
 *
 * write temporary file first,
 * then replace original file.
 */
function writeJsonAtomic(
  filePath: string,
  data: unknown
): void {
  const tempPath = `${filePath}.tmp`;

  fs.writeFileSync(
    tempPath,
    JSON.stringify(data, null, 2) + '\n',
    'utf8'
  );

  fs.renameSync(tempPath, filePath);
}

/**
 * =========================
 * MARKET DATA
 * =========================
 */

async function fetchBulkIdrPrices(): Promise<
  Record<string, number>
> {
  try {
    const res = await fetch(
      'https://indodax.com/api/ticker_all',
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      console.warn(
        `[Market Data] Indodax HTTP ${res.status}`
      );

      return {};
    }

    const data = (await res.json()) as {
      tickers?: Record<
        string,
        {
          last?: string | number;
        }
      >;
    };

    const output: Record<string, number> = {};

    for (const [key, ticker] of Object.entries(
      data.tickers ?? {}
    )) {
      const price = Number(ticker?.last);

      if (isPositiveNumber(price)) {
        output[key.toLowerCase()] = price;
      }
    }

    return output;
  } catch (error) {
    console.error(
      '[Market Data] Failed to fetch Indodax ticker:',
      error
    );

    return {};
  }
}

/**
 * =========================
 * POSITION VALIDATION
 * =========================
 */

function isValidPosition(
  pos: unknown
): pos is Position {
  if (!pos || typeof pos !== 'object') {
    return false;
  }

  const p = pos as Position;

  return (
    (p.side === 'long' || p.side === 'short') &&
    isPositiveNumber(p.size) &&
    isPositiveNumber(p.entryPrice) &&
    isPositiveNumber(p.stopPrice)
  );
}

/**
 * =========================
 * EXPOSURE CALCULATIONS
 * =========================
 */

/**
 * Current notional exposure of one position.
 */
function getPositionNotional(
  pos: Position,
  currentPrice?: number
): number {
  const price =
    currentPrice && isPositiveNumber(currentPrice)
      ? currentPrice
      : pos.entryPrice;

  return Math.abs(pos.size * price);
}

/**
 * Total gross exposure.
 *
 * Example:
 *
 * Equity = Rp100m
 * Position A = Rp200m
 * Position B = Rp300m
 *
 * Gross exposure = Rp500m
 * Leverage = 5x
 */
function getGrossExposure(
  agentBook: AgentBook,
  prices: Record<string, number>
): number {
  let exposure = 0;

  for (const [instrument, pos] of Object.entries(
    agentBook.positions ?? {}
  )) {
    if (!isValidPosition(pos)) {
      continue;
    }

    const tickerKey = normalizeIndodaxKey(instrument);

    const currentPrice =
      prices[tickerKey] ?? pos.entryPrice;

    exposure += getPositionNotional(
      pos,
      currentPrice
    );
  }

  return exposure;
}

/**
 * Margin required under 10x leverage.
 *
 * Notional / leverage
 */
function getMarginRequired(
  notional: number
): number {
  return notional / MAX_LEVERAGE;
}

/**
 * =========================
 * PNL
 * =========================
 */

function calculatePnl(
  pos: Position,
  exitPrice: number
): number {
  if (pos.side === 'long') {
    return (
      (exitPrice - pos.entryPrice) *
      pos.size
    );
  }

  return (
    (pos.entryPrice - exitPrice) *
    pos.size
  );
}

/**
 * =========================
 * SIGNAL DIRECTION
 * =========================
 */

function determineSide(
  reason: string
): PositionSide {
  const normalized = String(reason ?? '')
    .toLowerCase();

  const bearishKeywords = [
    'bearish',
    'down',
    'breakdown',
    'short',
    'sell',
    'selling',
    'negative',
  ];

  const isBearish = bearishKeywords.some(
    keyword =>
      normalized.includes(keyword)
  );

  return isBearish ? 'short' : 'long';
}

/**
 * =========================
 * BRIEFING
 * =========================
 */

function appendBriefing(
  agentSlug: string,
  content: string
): void {
  const briefingFile = path.join(
    BRIEFINGS_DIR,
    `${agentSlug}.md`
  );

  fs.appendFileSync(
    briefingFile,
    content,
    'utf8'
  );
}

/**
 * =========================
 * AGENT INITIALIZATION
 * =========================
 */

function ensureAgentBook(
  agentBook: AgentBook
): void {
  if (!agentBook.balance) {
    agentBook.balance = {
      IDR: 0,
    };
  }

  if (!Number.isFinite(agentBook.balance.IDR)) {
    agentBook.balance.IDR = 0;
  }

  if (!agentBook.positions) {
    agentBook.positions = {};
  }

  if (!agentBook.trades) {
    agentBook.trades = [];
  }
}

/**
 * =========================
 * MAIN
 * =========================
 */

async function main(): Promise<void> {
  ensureDeskDirectories();

  /**
   * Required files.
   */
  if (
    !fs.existsSync(LEDGER_PATH) ||
    !fs.existsSync(SCAN_PATH)
  ) {
    console.log(
      '[Paper Execution] ledger or scan file not found. Skipping.'
    );

    return;
  }

  const ledger = readJson<Ledger>(
    LEDGER_PATH,
    {
      agents: {},
    }
  );

  const state = readJson<State>(
    STATE_PATH,
    {
      desk: {},
      agents: {},
    }
  );

  const scan = readJson<Scan>(
    SCAN_PATH,
    {
      candidates: [],
    }
  );

  if (!ledger.agents) {
    ledger.agents = {};
  }

  if (!state.agents) {
    state.agents = {};
  }

  const now = new Date().toISOString();

  ledger.last_cycle = now;

  if (!state.desk) {
    state.desk = {
      created: '2026-07-13',
      mode: 'paper',
    };
  }

  state.desk.last_session =
    now.split('T')[0];

  /**
   * =========================
   * FETCH LIVE PRICES
   * =========================
   */

  console.log(
    '[Paper Execution] Fetching live Indodax prices...'
  );

  const prices =
    await fetchBulkIdrPrices();

  const priceCount =
    Object.keys(prices).length;

  console.log(
    `[Paper Execution] Live tickers received: ${priceCount}`
  );

  if (priceCount === 0) {
    console.error(
      '[Paper Execution] No live prices received. No trades will be executed.'
    );

    return;
  }

  let openedTrades = 0;
  let closedTrades = 0;

  /**
   * =========================
   * 1. MANAGE OPEN POSITIONS
   * =========================
   */

  for (const [
    agentSlug,
    agentBook,
  ] of Object.entries(ledger.agents)) {
    ensureAgentBook(agentBook);

    for (const [
      instrument,
      pos,
    ] of Object.entries(
      agentBook.positions
    )) {
      /**
       * Remove malformed positions rather than
       * allowing them to crash the execution cycle.
       */
      if (!isValidPosition(pos)) {
        console.warn(
          `[${agentSlug}] Invalid position detected on ${instrument}. Skipping.`
        );

        continue;
      }

      const tickerKey =
        normalizeIndodaxKey(instrument);

      const currentPrice =
        prices[tickerKey];

      /**
       * IMPORTANT:
       *
       * No fallback to scanner price.
       * Execution requires a live market price.
       */
      if (!isPositiveNumber(currentPrice)) {
        console.warn(
          `[${agentSlug}] Live price missing for ${instrument} (${tickerKey}). Position not evaluated.`
        );

        continue;
      }

      let shouldClose = false;
      let closeReason = '';

      /**
       * LONG
       */
      if (pos.side === 'long') {
        if (
          currentPrice <=
          pos.stopPrice
        ) {
          shouldClose = true;

          closeReason =
            `Stop Loss hit @ ${formatIdr(
              currentPrice
            )}`;
        } else if (
          isPositiveNumber(
            pos.targetPrice
          ) &&
          currentPrice >=
          pos.targetPrice
        ) {
          shouldClose = true;

          closeReason =
            `Take Profit hit @ ${formatIdr(
              currentPrice
            )}`;
        }
      }

      /**
       * SHORT
       */
      else {
        if (
          currentPrice >=
          pos.stopPrice
        ) {
          shouldClose = true;

          closeReason =
            `Stop Loss hit @ ${formatIdr(
              currentPrice
            )}`;
        } else if (
          isPositiveNumber(
            pos.targetPrice
          ) &&
          currentPrice <=
          pos.targetPrice
        ) {
          shouldClose = true;

          closeReason =
            `Take Profit hit @ ${formatIdr(
              currentPrice
            )}`;
        }
      }

      if (!shouldClose) {
        continue;
      }

      /**
       * =========================
       * REALIZED PNL
       * =========================
       */

      const pnl = calculatePnl(
        pos,
        currentPrice
      );

      /**
       * Balance is changed ONLY by realized PnL.
       *
       * Margin itself was never deducted from
       * balance, because this is a leveraged
       * paper-trading accounting model.
       */
      agentBook.balance.IDR += pnl;

      const notionalValue =
        getPositionNotional(
          pos,
          currentPrice
        );

      const marginUsed =
        getMarginRequired(
          notionalValue
        );

      agentBook.trades.push({
        timestamp: now,
        instrument,
        side: pos.side,
        type: 'close',
        size: pos.size,
        price: currentPrice,
        realizedPnlIdr: pnl,
        reason: closeReason,
        notionalValue,
        marginUsed,
      });

      delete agentBook.positions[
        instrument
      ];

      closedTrades++;

      /**
       * =========================
       * STATE UPDATE
       * =========================
       */

      const actionText =
        `Closed ${pos.side.toUpperCase()} ${instrument} (${pnl >= 0 ? '+' : ''}${formatIdr(
          pnl
        )}) — ${closeReason} (${now.slice(
          0,
          16
        )} UTC)`;

      if (
        state.agents?.[agentSlug]
      ) {
        state.agents[
          agentSlug
        ].last_action = actionText;
      }

      /**
       * =========================
       * BRIEFING
       * =========================
       */

      const entryLog = `

---
### ${now.slice(
        0,
        16
      )} UTC — Position Closed: ${pos.side.toUpperCase()} ${instrument}

* **Exit Price:** ${formatIdr(
        currentPrice
      )}
* **Realized PnL:** ${
        pnl >= 0 ? '+' : ''
      }${formatIdr(pnl)}
* **Reason:** ${closeReason}
* **Notional:** ${formatIdr(
        notionalValue
      )}
* **Margin Used:** ${formatIdr(
        marginUsed
      )}
* **New Balance:** ${formatIdr(
        agentBook.balance.IDR
      )}
`;

      appendBriefing(
        agentSlug,
        entryLog
      );

      console.log(
        `✓ [${agentSlug}] ${actionText}`
      );
    }
  }

  /**
   * =========================
   * 2. OPEN NEW SIGNALS
   * =========================
   */

  const candidates =
    scan.candidates ?? [];

  for (const candidate of candidates) {
    const agentSlug =
      candidate.agent;

    const agentBook =
      ledger.agents[
        agentSlug
      ];

    if (!agentBook) {
      console.warn(
        `[Signal] Unknown agent: ${agentSlug}`
      );

      continue;
    }

    ensureAgentBook(agentBook);

    const instrument =
      formatInstrument(
        candidate.pair
      );

    const tickerKey =
      normalizeIndodaxKey(
        candidate.pair
      );

    /**
     * IMPORTANT:
     *
     * Execution price MUST be live.
     */
    const currentPrice =
      prices[tickerKey];

    if (
      !isPositiveNumber(
        currentPrice
      )
    ) {
      console.warn(
        `[${agentSlug}] Cannot execute ${instrument}: live price unavailable (${tickerKey}).`
      );

      continue;
    }

    /**
     * =========================
     * DUPLICATE POSITION CHECK
     * =========================
     */

    if (
      agentBook.positions[
        instrument
      ]
    ) {
      console.log(
        `[${agentSlug}] Skipping ${instrument}: position already open.`
      );

      continue;
    }

    /**
     * =========================
     * EQUITY
     * =========================
     *
     * For this paper model:
     *
     * Equity =
     * cash balance + unrealized PnL
     */

    let equity =
      agentBook.balance.IDR;

    for (const [
      openInstrument,
      openPosition,
    ] of Object.entries(
      agentBook.positions
    )) {
      if (
        !isValidPosition(
          openPosition
        )
      ) {
        continue;
      }

      const openTicker =
        normalizeIndodaxKey(
          openInstrument
        );

      const openPrice =
        prices[openTicker];

      if (
        !isPositiveNumber(
          openPrice
        )
      ) {
        continue;
      }

      equity += calculatePnl(
        openPosition,
        openPrice
      );
    }

    if (
      !isPositiveNumber(equity)
    ) {
      console.warn(
        `[${agentSlug}] Invalid/non-positive equity. Cannot open ${instrument}.`
      );

      continue;
    }

    /**
     * =========================
     * CURRENT GROSS EXPOSURE
     * =========================
     */

    const currentGrossExposure =
      getGrossExposure(
        agentBook,
        prices
      );

    const maximumGrossExposure =
      equity *
      MAX_LEVERAGE;

    const remainingGrossCapacity =
      Math.max(
        0,
        maximumGrossExposure -
          currentGrossExposure
      );

    if (
      remainingGrossCapacity <= 0
    ) {
      console.log(
        `[${agentSlug}] ${instrument} skipped: 10x gross exposure limit reached.`
      );

      continue;
    }

    /**
     * =========================
     * SIGNAL SIDE
     * =========================
     */

    const side =
      determineSide(
        candidate.reason
      );

    /**
     * =========================
     * STOP LOSS
     * =========================
     */

    const stopDistance =
      currentPrice *
      STOP_LOSS_PERCENT;

    if (
      !isPositiveNumber(
        stopDistance
      )
    ) {
      continue;
    }

    const stopPrice =
      side === 'long'
        ? currentPrice -
          stopDistance
        : currentPrice +
          stopDistance;

    /**
     * =========================
     * TAKE PROFIT
     * =========================
     */

    const targetDistance =
      stopDistance *
      TAKE_PROFIT_RR;

    const targetPrice =
      side === 'long'
        ? currentPrice +
          targetDistance
        : currentPrice -
          targetDistance;

    /**
     * =========================
     * RISK-BASED POSITION SIZE
     * =========================
     *
     * Risk = Equity * 2%
     *
     * Size =
     * Risk / Stop Distance
     */

    const riskAmountIdr =
      equity *
      RISK_PER_TRADE;

    const riskBasedSize =
      riskAmountIdr /
      stopDistance;

    const riskBasedNotional =
      riskBasedSize *
      currentPrice;

    /**
     * =========================
     * MAX POSITION NOTIONAL
     * =========================
     *
     * Maximum single position:
     *
     * Equity * 2.5x
     */

    const maxPositionNotional =
      equity *
      MAX_POSITION_LEVERAGE;

    /**
     * Final position is limited by:
     *
     * 1. Risk sizing
     * 2. Maximum position notional
     * 3. Remaining portfolio leverage capacity
     */

    const finalNotional =
      Math.min(
        riskBasedNotional,
        maxPositionNotional,
        remainingGrossCapacity
      );

    if (
      !isPositiveNumber(
        finalNotional
      )
    ) {
      console.log(
        `[${agentSlug}] ${instrument} skipped: no available exposure capacity.`
      );

      continue;
    }

    const finalSize =
      finalNotional /
      currentPrice;

    const marginUsed =
      getMarginRequired(
        finalNotional
      );

    const effectiveLeverage =
      finalNotional /
      equity;

    /**
     * Actual dollar risk after all caps.
     */
    const actualRiskIdr =
      finalSize *
      stopDistance;

    /**
     * =========================
     * CREATE POSITION
     * =========================
     */

    const position: Position = {
      side,
      size: finalSize,
      entryPrice: currentPrice,
      stopPrice,
      targetPrice,
      opened: now,
      notionalValue: finalNotional,
      marginUsed,
      leverage: effectiveLeverage,
      sizingNote:
        `Notional ${formatIdr(
          finalNotional
        )} | Margin ${formatIdr(
          marginUsed
        )} | Leverage ${effectiveLeverage.toFixed(
          2
        )}x | Risk ${formatIdr(
          actualRiskIdr
        )}`,
    };

    agentBook.positions[
      instrument
    ] = position;

    /**
     * =========================
     * TRADE LOG
     * =========================
     */

    agentBook.trades.push({
      timestamp: now,
      instrument,
      side,
      type: 'open',
      size: finalSize,
      price: currentPrice,
      reason: candidate.reason,
      notionalValue: finalNotional,
      marginUsed,
    });

    openedTrades++;

    /**
     * =========================
     * STATE UPDATE
     * =========================
     */

    const actionText =
      `Opened ${side.toUpperCase()} ${instrument} @ ${formatIdr(
        currentPrice
      )} | SL ${formatIdr(
        stopPrice
      )} | TP ${formatIdr(
        targetPrice
      )} | ${effectiveLeverage.toFixed(
        2
      )}x`;

    if (
      state.agents?.[agentSlug]
    ) {
      state.agents[
        agentSlug
      ].last_action =
        actionText;
    }

    /**
     * =========================
     * BRIEFING
     * =========================
     */

    const entryLog = `

---
### ${now.slice(
      0,
      16
    )} UTC — Position Opened: ${side.toUpperCase()} ${instrument}

* **Entry Price:** ${formatIdr(
      currentPrice
    )}
* **Stop Loss:** ${formatIdr(
      stopPrice
    )}
* **Target:** ${formatIdr(
      targetPrice
    )}
* **Reason:** ${candidate.reason}
* **Notional:** ${formatIdr(
      finalNotional
    )}
* **Margin Used:** ${formatIdr(
      marginUsed
    )}
* **Effective Leverage:** ${effectiveLeverage.toFixed(
      2
    )}x
* **Risk at Stop:** ${formatIdr(
      actualRiskIdr
    )}
* **Maximum Risk Target:** ${formatIdr(
      riskAmountIdr
    )}
* **Portfolio Gross Exposure Before:** ${formatIdr(
      currentGrossExposure
    )}
* **Portfolio Gross Exposure After:** ${formatIdr(
      currentGrossExposure +
        finalNotional
    )}
`;

    appendBriefing(
      agentSlug,
      entryLog
    );

    console.log(
      `✓ [${agentSlug}] ${actionText}`
    );
  }

  /**
   * =========================
   * 3. PORTFOLIO SUMMARY
   * =========================
   */

  for (const [
    agentSlug,
    agentBook,
  ] of Object.entries(ledger.agents)) {
    ensureAgentBook(agentBook);

    const equity =
      calculateEquity(
        agentBook,
        prices
      );

    const grossExposure =
      getGrossExposure(
        agentBook,
        prices
      );

    const leverage =
      equity > 0
        ? grossExposure /
          equity
        : 0;

    console.log(
      `[${agentSlug}] Equity=${formatIdr(
        equity
      )} | Gross Exposure=${formatIdr(
        grossExposure
      )} | Leverage=${leverage.toFixed(
        2
      )}x | Positions=${Object.keys(
        agentBook.positions
      ).length}`
    );
  }

  /**
   * =========================
   * 4. SAVE
   * =========================
   */

  writeJsonAtomic(
    LEDGER_PATH,
    ledger
  );

  /**
   * Preserve existing behavior:
   * only write state if it already exists.
   */
  if (
    fs.existsSync(STATE_PATH)
  ) {
    writeJsonAtomic(
      STATE_PATH,
      state
    );
  }

  console.log(
    `[Paper Execution] Completed. Opened=${openedTrades}, Closed=${closedTrades}. Ledger updated at ${now}`
  );
}

/**
 * =========================
 * EQUITY CALCULATION
 * =========================
 */

function calculateEquity(
  agentBook: AgentBook,
  prices: Record<string, number>
): number {
  let equity =
    agentBook.balance.IDR;

  for (const [
    instrument,
    pos,
  ] of Object.entries(
    agentBook.positions ?? {}
  )) {
    if (!isValidPosition(pos)) {
      continue;
    }

    const tickerKey =
      normalizeIndodaxKey(
        instrument
      );

    const currentPrice =
      prices[tickerKey];

    if (
      !isPositiveNumber(
        currentPrice
      )
    ) {
      continue;
    }

    equity += calculatePnl(
      pos,
      currentPrice
    );
  }

  return equity;
}

/**
 * =========================
 * PROCESS ENTRY
 * =========================
 */

main().catch(error => {
  console.error(
    '[Paper Execution] Fatal error:',
    error
  );

  process.exitCode = 1;
});
