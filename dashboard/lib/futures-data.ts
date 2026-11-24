import { readFile } from 'node:fs/promises';
import path from 'node:path';

const RAW_BASE =
  'https://raw.githubusercontent.com/IrvanRisdi/Gemini-AI-Fund/futures-data/futures-engine/.futures-desk';

export interface FuturesAgentSummary {
  agent: 'wyckoff-4h' | 'smc-1h-bear';
  allocationShare: number;
  equityUsd: number;
  freeCashUsd: number;
  pnlPct: number;
  maxDrawdownPct: number;
  openPositions: number;
  pendingOrders: number;
  closedTrades: number;
  winRatePct: number;
  profitFactor: number;
  shadowAbComparison: {
    quantOnlyNetPnlUsd: number;
    geminiAdjustedNetPnlUsd: number;
    vetoCalibration: {
      totalEvaluated: number;
      vetoCount: number;
      vetoSavedR: number;
      vetoMissedR: number;
      downgradeCount: number;
      downgradeNetDeltaR: number;
      summary: string;
    };
  };
  killSwitchActive: boolean;
  killSwitchReason: string | null;
}

export interface FuturesOpenPosition {
  id: string;
  agent: string;
  symbol: string;
  side: 'long' | 'short';
  openedAt: string;
  entryPrice: number;
  stopPrice: number;
  tp1Price: number;
  tp2Price: number | null;
  leverage: number;
  marginUsd: number;
  notionalUsd: number;
  partialTpEnabled: boolean;
  tp1Hit: boolean;
  mfeR: number;
  maeR: number;
  geminiAction: string;
  precisionNote: string;
}

export interface FuturesPendingOrder {
  id: string;
  agent: string;
  symbol: string;
  side: 'long' | 'short';
  timeframe: string;
  createdAt: string;
  expiresAt: string;
  entryLow: number;
  entryHigh: number;
  stopPrice: number;
  tp1Price: number;
  baseLeverage: number;
  finalLeverage: number;
  convictionScore: number;
  geminiEvaluation: {
    action: string;
    modelUsed: string;
    confidenceScore: number;
    reasoning: string;
    riskFlags: string[];
  };
}

export interface FuturesClosedTrade {
  id: string;
  agent: string;
  symbol: string;
  side: 'long' | 'short';
  openedAt: string;
  closedAt: string;
  holdHours: number;
  entryPrice: number;
  exitPrice: number;
  leverage: number;
  tp1Hit: boolean;
  pnlUsd: number;
  rMultiple: number;
  quantOnlyPnlUsd: number;
  geminiAction: string;
  mfeR: number;
  maeR: number;
  closeReason: string;
}

export interface FuturesAgentDiagnostic {
  status: 'SIGNAL' | 'LOW_CONVICTION' | 'WAIT' | 'INACTIVE_BULL_MACRO';
  directionBias: 'long' | 'short' | 'neutral';
  passedChecks: string[];
  failedChecks: string[];
}

export interface FuturesUniverseDiagnostic {
  symbol: string;
  lastPrice: number;
  change24hPct: number;
  trend4h: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  atr4hPct: number;
  rvol4h: number;
  rsVsBtcPct: number;
  wyckoff4h: FuturesAgentDiagnostic;
  smc1hBear: FuturesAgentDiagnostic;
}

export interface FuturesLlmHealth {
  checkedAt: string;
  ok: boolean;
  modelUsed: string;
  latencyMs: number;
  detail: string;
}

export interface FuturesDashboardSummary {
  generatedAt: string | null;
  mode: string;
  startingCapitalUsd: number;
  totalEquityUsd: number;
  totalPnlPct: number;
  btcRegime: {
    timestamp: number;
    close: number;
    ema9: number;
    ema21: number;
    ema200: number;
    adx14: number;
    return24h: number;
    macroBull: boolean;
    riskOn: boolean;
    riskOff: boolean;
  } | null;
  llmHealth?: FuturesLlmHealth | null;
  universe: string[];
  universeDiagnostics?: FuturesUniverseDiagnostic[];
  agents: FuturesAgentSummary[];
  openPositions: FuturesOpenPosition[];
  pendingOrders: FuturesPendingOrder[];
  recentTrades: FuturesClosedTrade[];
  isInitialPlaceholder?: boolean;
}

export interface FuturesLessonItem {
  id: string;
  lesson: string;
  evidence: string;
  addedAt: string;
  confidence: 'HIGH' | 'MEDIUM';
}

export interface FuturesWeeklyReport {
  generatedAt: string;
  dateWib: string;
  modelUsed: string;
  headline: string;
  keyFindings: string[];
  vetoAssessment: string;
  recommendedLessons: FuturesLessonItem[];
  telegramDelivery?: {
    delivered: boolean;
    diagnostic: string;
  };
}

export interface MacroCalendarEvent {
  id: string;
  type: 'FOMC' | 'CPI' | 'NFP';
  title: string;
  utc: string;
  impact: string;
  hoursUntil: number;
}

async function readLocalDesk<T>(relPath: string): Promise<T> {
  const candidates = [
    path.join(process.cwd(), '..', 'futures-engine', '.futures-desk', relPath),
    path.join(process.cwd(), 'futures-engine', '.futures-desk', relPath),
  ];
  let lastErr: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(await readFile(candidate, 'utf8')) as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function readLocalData<T>(relPath: string): Promise<T> {
  const candidates = [
    path.join(process.cwd(), '..', 'futures-engine', 'data', relPath),
    path.join(process.cwd(), 'futures-engine', 'data', relPath),
  ];
  let lastErr: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(await readFile(candidate, 'utf8')) as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function readFuturesSnapshot<T>(relPath: string): Promise<T | null> {
  if (process.env.NODE_ENV !== 'production') {
    try {
      return await readLocalDesk<T>(relPath);
    } catch {
      // Fall through to remote futures-data branch
    }
  }
  try {
    const rev = Math.floor(Date.now() / 60_000);
    const res = await fetch(`${RAW_BASE}/${relPath}?v=${rev}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(6_000),
    });
    if (res.ok) return (await res.json()) as T;
  } catch {
    // Fall back to local
  }
  try {
    return await readLocalDesk<T>(relPath);
  } catch {
    return null;
  }
}

export async function getFuturesDashboard(): Promise<FuturesDashboardSummary> {
  const remote = await readFuturesSnapshot<FuturesDashboardSummary>('dashboard-summary.json');
  if (remote) return remote;

  // Clean bootstrap placeholder before the first GitHub Actions cycle populates futures-data
  return {
    generatedAt: null,
    mode: 'paper-cron (menunggu siklus pertama)',
    startingCapitalUsd: 10_000,
    totalEquityUsd: 10_000,
    totalPnlPct: 0,
    btcRegime: null,
    universe: ['ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'SUIUSDT'],
    agents: [
      {
        agent: 'wyckoff-4h',
        allocationShare: 0.7,
        equityUsd: 7_000,
        freeCashUsd: 7_000,
        pnlPct: 0,
        maxDrawdownPct: 0,
        openPositions: 0,
        pendingOrders: 0,
        closedTrades: 0,
        winRatePct: 0,
        profitFactor: 0,
        shadowAbComparison: {
          quantOnlyNetPnlUsd: 0,
          geminiAdjustedNetPnlUsd: 0,
          vetoCalibration: {
            totalEvaluated: 0,
            vetoCount: 0,
            vetoSavedR: 0,
            vetoMissedR: 0,
            downgradeCount: 0,
            downgradeNetDeltaR: 0,
            summary: 'Menunggu siklus cron futures-paper-loop pertama.',
          },
        },
        killSwitchActive: false,
        killSwitchReason: null,
      },
      {
        agent: 'smc-1h-bear',
        allocationShare: 0.3,
        equityUsd: 3_000,
        freeCashUsd: 3_000,
        pnlPct: 0,
        maxDrawdownPct: 0,
        openPositions: 0,
        pendingOrders: 0,
        closedTrades: 0,
        winRatePct: 0,
        profitFactor: 0,
        shadowAbComparison: {
          quantOnlyNetPnlUsd: 0,
          geminiAdjustedNetPnlUsd: 0,
          vetoCalibration: {
            totalEvaluated: 0,
            vetoCount: 0,
            vetoSavedR: 0,
            vetoMissedR: 0,
            downgradeCount: 0,
            downgradeNetDeltaR: 0,
            summary: 'Aktif otomatis saat BTC berada di bawah 4H EMA200.',
          },
        },
        killSwitchActive: false,
        killSwitchReason: null,
      },
    ],
    openPositions: [],
    pendingOrders: [],
    recentTrades: [],
    isInitialPlaceholder: true,
  };
}

export async function getFuturesWeeklyReport(): Promise<FuturesWeeklyReport | null> {
  return readFuturesSnapshot<FuturesWeeklyReport>('weekly-report.json');
}

export async function getFuturesLessons(): Promise<FuturesLessonItem[]> {
  const remote = await readFuturesSnapshot<{ lessons?: FuturesLessonItem[] }>('memory/lessons.json');
  if (remote?.lessons?.length) return remote.lessons;
  try {
    const seed = await readLocalData<{ lessons?: FuturesLessonItem[] }>('memory/lessons.json');
    return seed.lessons ?? [];
  } catch {
    return [];
  }
}

export async function getUpcomingMacroEvents(limit = 4): Promise<MacroCalendarEvent[]> {
  try {
    const cal = await readLocalData<{ events?: Array<{ id: string; type: 'FOMC' | 'CPI' | 'NFP'; title: string; utc: string; impact: string }> }>('macro-calendar-2026-2027.json');
    const now = Date.now();
    return (cal.events ?? [])
      .map((e) => ({
        ...e,
        hoursUntil: Number(((Date.parse(e.utc) - now) / 3_600_000).toFixed(1)),
      }))
      .filter((e) => e.hoursUntil >= -1)
      .sort((a, b) => a.hoursUntil - b.hoursUntil)
      .slice(0, limit);
  } catch {
    return [];
  }
}
