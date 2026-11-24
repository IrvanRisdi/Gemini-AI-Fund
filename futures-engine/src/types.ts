export type Side = 'long' | 'short';
export type AgentId = 'wyckoff-4h' | 'smc-1h-bear';
export type Timeframe = '5m' | '1h' | '4h';
export type LeverageTier = 0 | 1 | 2 | 3;

export interface OHLCV {
  timestamp: number; // ms UTC open time
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketPrecision {
  symbol: string;
  stepSize: number;
  tickSize: number;
  minQty: number;
  minNotional: number;
  source: 'futures-api' | 'spot-api' | 'fallback';
}

export interface PrecisionPlan {
  accepted: boolean;
  rejectReason?: string;
  totalQty: number;
  totalNotionalUsd: number;
  tp1Qty: number;
  runnerQty: number;
  partialTpEnabled: boolean;
  precisionNote: string;
}

export interface BtcMacroRegime {
  timestamp: number;
  close: number;
  ema9: number;
  ema21: number;
  ema200: number;
  adx14: number;
  return24h: number;
  macroBull: boolean; // close >= ema200
  riskOn: boolean;
  riskOff: boolean;
}

export interface ConvictionBreakdown {
  score: number; // 0..5
  macroAligned: boolean;
  strongVolume: boolean;
  strongRelativeStrength: boolean;
  idealVolatilityBand: boolean; // 1.5% <= ATR% <= 4.5%
  decisiveClose: boolean;
  baseLeverage: LeverageTier; // 0 (skip), 2, or 3
  baseRiskPct: number; // 0, 0.01, or 0.015
}

export interface SignalCandidate {
  id: string;
  agent: AgentId;
  symbol: string; // e.g. SOLUSDT
  side: Side;
  timeframe: '1h' | '4h';
  signalBarAt: number;
  entryLow: number;
  entryHigh: number;
  stopPrice: number;
  tp1Price: number;
  tp2Price: number | null; // null when using uncapped Chandelier trailing runner
  trailAtrMultiple: number; // e.g. 3.0x ATR after TP1
  atrAtSignal: number;
  atrPct: number;
  rvol: number;
  rsVsBtc: number;
  closeStrength: number;
  expiryHours: number;
  timeStopHours: number;
  conviction: ConvictionBreakdown;
  confirmations: string[];
  reason: string;
}

export interface MacroEvent {
  id: string;
  type: 'FOMC' | 'CPI' | 'NFP';
  title: string;
  utc: string;
  impact: 'HIGH' | 'MEDIUM';
  vetoHoursBefore: number;
  cautionHoursBefore: number;
}

export interface MacroWindowStatus {
  hardBlackout: boolean; // within vetoHoursBefore
  cautionActive: boolean; // within cautionHoursBefore
  nearestEvent: (MacroEvent & { hoursUntil: number }) | null;
  upcomingWithin24h: Array<MacroEvent & { hoursUntil: number }>;
}

export type GeminiDecisionAction = 'APPROVE' | 'DOWNGRADE' | 'VETO';

export interface GeminiEvaluation {
  action: GeminiDecisionAction;
  finalLeverage: LeverageTier;
  finalRiskPct: number;
  confidenceScore: number; // 0..100
  riskFlags: string[];
  reasoning: string;
  modelUsed: string;
  evaluatedAt: string;
  fallbackUsed: boolean;
}

export interface PendingOrder {
  id: string;
  clientOrderId: string;
  agent: AgentId;
  symbol: string;
  side: Side;
  timeframe: '1h' | '4h';
  createdAt: string;
  expiresAt: string;
  entryLow: number;
  entryHigh: number;
  stopPrice: number;
  tp1Price: number;
  tp2Price: number | null;
  trailAtrMultiple: number;
  atrAtSignal: number;
  timeStopHours: number;
  baseLeverage: LeverageTier;
  baseRiskPct: number;
  finalLeverage: LeverageTier;
  finalRiskPct: number;
  convictionScore: number;
  geminiEvaluation: GeminiEvaluation;
  status: 'pending' | 'filled' | 'expired' | 'cancelled' | 'rejected';
  statusNote?: string;
}

export interface OpenPosition {
  id: string;
  clientOrderId: string;
  agent: AgentId;
  symbol: string;
  side: Side;
  openedAt: string;
  timeStopAt: string;
  entryPrice: number;
  stopPrice: number;
  initialStopPrice: number;
  tp1Price: number;
  tp2Price: number | null;
  trailAtrMultiple: number;
  initialRiskPerUnit: number;
  netRiskPct: number;
  leverage: LeverageTier;
  riskPct: number;
  marginUsd: number;
  notionalUsd: number;
  initialQty: number;
  remainingQty: number;
  tp1Qty: number;
  partialTpEnabled: boolean;
  tp1Hit: boolean;
  realizedPartialPnlUsd: number;
  fundingPaidUsd: number;
  feesPaidUsd: number;
  extremeFavorablePrice: number;
  mfeR: number;
  maeR: number;
  precisionNote: string;
  // Shadow A/B: what the notional/margin would have been under Quant-only (before Gemini)
  quantBaseLeverage: LeverageTier;
  quantBaseRiskPct: number;
  geminiAction: GeminiDecisionAction;
}

export interface ClosedTrade {
  id: string;
  clientOrderId: string;
  agent: AgentId;
  symbol: string;
  side: Side;
  openedAt: string;
  closedAt: string;
  holdHours: number;
  entryPrice: number;
  exitPrice: number;
  leverage: LeverageTier;
  partialTpEnabled: boolean;
  tp1Hit: boolean;
  pnlUsd: number;
  rMultiple: number;
  quantOnlyPnlUsd: number;
  quantOnlyRMultiple: number;
  geminiAction: GeminiDecisionAction;
  feesUsd: number;
  fundingUsd: number;
  mfeR: number;
  maeR: number;
  closeReason: string;
}

export interface ShadowVetoedSignal {
  id: string;
  agent: AgentId;
  symbol: string;
  side: Side;
  createdAt: string;
  expiresAt: string;
  entryLow: number;
  entryHigh: number;
  stopPrice: number;
  tp1Price: number;
  tp2Price: number | null;
  trailAtrMultiple: number;
  timeStopHours: number;
  baseLeverage: LeverageTier;
  baseRiskPct: number;
  geminiReasoning: string;
  // Shadow tracking state
  status: 'watching' | 'open' | 'closed' | 'expired';
  filledAt?: string;
  entryPrice?: number;
  activeStop?: number;
  tp1Hit?: boolean;
  extremeFav?: number;
  realizedR?: number;
  closedAt?: string;
}

export interface LessonItem {
  id: string;
  lesson: string;
  evidence: string;
  addedAt: string;
  confidence: 'HIGH' | 'MEDIUM';
}

export interface VetoCalibration {
  totalEvaluated: number;
  vetoCount: number;
  vetoSavedR: number;
  vetoMissedR: number;
  downgradeCount: number;
  downgradeNetDeltaR: number;
  summary: string;
}

export interface AgentBook {
  agent: AgentId;
  allocationShare: number; // 0.70 or 0.30
  freeCashUsd: number;
  peakEquityUsd: number;
  dailyStartDateUtc: string;
  dailyStartEquityUsd: number;
  killSwitchUntil?: string;
  killSwitchReason?: string;
  haltedForAudit?: boolean;
  positions: OpenPosition[];
  pendingOrders: PendingOrder[];
  closedTrades: ClosedTrade[];
  shadowVetoed: ShadowVetoedSignal[];
}

export interface FuturesLedger {
  version: 'futures-v1';
  mode: 'paper-cron';
  createdAt: string;
  lastCycleAt: string;
  startingCapitalUsd: number;
  feeRatePerSide: number;
  fundingRatePer8h: number;
  consecutiveErrors: number;
  universe: string[];
  universeUpdatedAt: string;
  btcRegime: BtcMacroRegime | null;
  books: Record<AgentId, AgentBook>;
}
