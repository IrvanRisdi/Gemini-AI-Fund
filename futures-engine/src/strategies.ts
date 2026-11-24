import { clamp, computeIndicators, type ComputedIndicators } from './indicators.js';
import type {
  AgentDiagnosticDetail,
  BtcMacroRegime,
  ConvictionBreakdown,
  LeverageTier,
  OHLCV,
  Side,
  SignalCandidate,
  UniverseCoinDiagnostic,
} from './types.js';

export const DEFAULT_FEE_PER_SIDE = 0.0006; // 0.06% Futures taker + slippage assumption
export const SL_MIN_PCT = 0.012; // 1.2% floor (protects against fees & micro noise)
export const SL_MAX_PCT = 0.060; // 6.0% ceiling (prevents oversized spike stops)
export const SL_ATR_MULTIPLE = 1.5;
export const TP1_R_MULTIPLE = 1.2;
export const CHANDELIER_TRAIL_ATR = 3.0;
export const WYCKOFF_FIXED_TP2_R = 2.2;

export function netTargetPrice(
  side: Side,
  entry: number,
  stop: number,
  multiple: number,
  fee = DEFAULT_FEE_PER_SIDE,
): number {
  if (side === 'long') {
    const netLoss = entry - stop + fee * (entry + stop);
    return (entry * (1 + fee) + multiple * netLoss) / (1 - fee);
  }
  const netLoss = stop - entry + fee * (entry + stop);
  return (entry * (1 - fee) - multiple * netLoss) / (1 + fee);
}

export function breakevenStopPrice(side: Side, entry: number, fee = DEFAULT_FEE_PER_SIDE): number {
  return side === 'long'
    ? entry * ((1 + fee) / (1 - fee) + 0.001)
    : entry * ((1 - fee) / (1 + fee) - 0.001);
}

/**
 * Volatility-Adaptive Structural Stop:
 * SL = max(structuralStopDistance, 1.5 * ATR), bounded to [1.2%, 6.0%].
 */
export function adaptiveStructuralStop(
  side: Side,
  entry: number,
  structuralStop: number,
  atrVal: number,
  minPct = SL_MIN_PCT,
  maxPct = SL_MAX_PCT,
): number {
  const structRisk =
    side === 'long'
      ? Math.max(0, (entry - structuralStop) / entry)
      : Math.max(0, (structuralStop - entry) / entry);
  const atrRisk = Math.max(0, (SL_ATR_MULTIPLE * atrVal) / entry);
  const riskPct = clamp(Math.max(structRisk, atrRisk), minPct, maxPct);
  return side === 'long' ? entry * (1 - riskPct) : entry * (1 + riskPct);
}

export function buildConviction(params: {
  side: Side;
  btcMacroBull: boolean;
  rvol: number;
  rsVsBtc: number;
  atrPct: number;
  closeStrength: number;
}): ConvictionBreakdown {
  const macroAligned = params.side === 'long' ? params.btcMacroBull : !params.btcMacroBull;
  const strongVolume = params.rvol >= 2.5;
  const strongRelativeStrength =
    params.side === 'long' ? params.rsVsBtc >= 0.025 : params.rsVsBtc <= -0.025;
  const idealVolatilityBand = params.atrPct >= 0.015 && params.atrPct <= 0.045;
  const decisiveClose =
    params.side === 'long' ? params.closeStrength >= 0.82 : params.closeStrength <= 0.18;

  const score =
    Number(macroAligned) +
    Number(strongVolume) +
    Number(strongRelativeStrength) +
    Number(idealVolatilityBand) +
    Number(decisiveClose);

  // Validated 3-year conviction tiers:
  // Score 0-1 -> Skip (PF 0.79 historical)
  // Score 2-3 -> 2x leverage, 1.0% risk (PF 1.41, WR 54.1%)
  // Score 4-5 -> 3x leverage, 1.5% risk (PF 1.67, WR 60.1%)
  let baseLeverage: LeverageTier = 0;
  let baseRiskPct = 0;
  if (score >= 4) {
    baseLeverage = 3;
    baseRiskPct = 0.015;
  } else if (score >= 2) {
    baseLeverage = 2;
    baseRiskPct = 0.01;
  }

  return {
    score,
    macroAligned,
    strongVolume,
    strongRelativeStrength,
    idealVolatilityBand,
    decisiveClose,
    baseLeverage,
    baseRiskPct,
  };
}

export function computeBtcRegimeAt(
  btc4h: ComputedIndicators,
  index: number,
): BtcMacroRegime | null {
  if (index < 200 || index >= btc4h.bars.length) return null;
  const bar = btc4h.bars[index]!;
  const ema9 = btc4h.ema9[index]!;
  const ema21 = btc4h.ema21[index]!;
  const ema200 = btc4h.ema200[index]!;
  const adx14 = btc4h.adx14[index]!;
  if (![ema9, ema21, ema200, adx14].every(Number.isFinite)) return null;

  const return24h = bar.close / btc4h.bars[index - 6]!.close - 1;
  const macroBull = bar.close >= ema200;
  const riskOn = ema9 >= ema21 && bar.close >= ema21 && adx14 >= 18;
  const riskOff = ema9 <= ema21 && bar.close <= ema21 && adx14 >= 18;

  return {
    timestamp: bar.timestamp,
    close: bar.close,
    ema9,
    ema21,
    ema200,
    adx14,
    return24h,
    macroBull,
    riskOn,
    riskOff,
  };
}

/**
 * Agen Core #1: Wyckoff 4H (Long + Short) — Single Source of Truth
 * Used identically by both backtest.ts and paper-runner.ts.
 */
export function evaluateWyckoff4HAt(
  symbol: string,
  d4: ComputedIndicators,
  index: number,
  btcRegime: BtcMacroRegime,
  options: {
    fee?: number;
    useFixedTp2?: boolean; // false = Chandelier 3.0x ATR uncapped runner (Plan F); true = Fixed TP2 2.2R (Plan B)
  } = {},
): SignalCandidate | null {
  const fee = options.fee ?? DEFAULT_FEE_PER_SIDE;
  const useFixedTp2 = options.useFixedTp2 ?? false;

  if (index < 55 || index >= d4.bars.length) return null;
  const bar = d4.bars[index]!;
  const atrVal = d4.atr14[index]!;
  const ema9 = d4.ema9[index]!;
  const ema21 = d4.ema21[index]!;
  if (![atrVal, ema9, ema21].every(Number.isFinite) || atrVal <= 0) return null;

  const atrPct = atrVal / bar.close;
  if (atrPct > 0.08) return null;

  let rangeHigh = -Infinity;
  let rangeLow = Infinity;
  for (let k = index - 45; k < index; k++) {
    const prev = d4.bars[k]!;
    if (prev.high > rangeHigh) rangeHigh = prev.high;
    if (prev.low < rangeLow) rangeLow = prev.low;
  }

  let volSum20 = 0;
  for (let k = index - 20; k < index; k++) volSum20 += d4.bars[k]!.volume;
  const rvol20 = volSum20 > 0 ? bar.volume / (volSum20 / 20) : 0;
  const compactRange = (rangeHigh - rangeLow) / atrVal <= 6.5;
  const candleRange = Math.max(bar.high - bar.low, 1e-12);
  const closeStrength = (bar.close - bar.low) / candleRange;
  const pairRet24h = bar.close / d4.bars[index - 6]!.close - 1;
  const rsVsBtc = pairRet24h - btcRegime.return24h;

  // Check Long (Sign of Strength breakout + retest)
  const longOk =
    ema9 > ema21 &&
    (btcRegime.riskOn || rsVsBtc >= 0.015) &&
    bar.close > rangeHigh &&
    rvol20 >= 1.6 &&
    closeStrength >= 0.7 &&
    compactRange &&
    bar.close > ema21;

  // Check Short (Sign of Weakness breakdown + retest)
  const shortOk =
    !longOk &&
    ema9 < ema21 &&
    (btcRegime.riskOff || rsVsBtc <= -0.015) &&
    bar.close < rangeLow &&
    rvol20 >= 1.6 &&
    closeStrength <= 0.3 &&
    compactRange &&
    bar.close < ema21;

  if (!longOk && !shortOk) return null;

  const side: Side = longOk ? 'long' : 'short';
  const conviction = buildConviction({
    side,
    btcMacroBull: btcRegime.macroBull,
    rvol: rvol20,
    rsVsBtc,
    atrPct,
    closeStrength,
  });

  if (side === 'long') {
    const entryHigh = Math.min(bar.close, rangeHigh + atrVal * 0.15);
    const entryLow = Math.min(entryHigh, Math.max(rangeHigh - atrVal * 0.25, entryHigh - atrVal * 0.3));
    const structStop = Math.min(rangeHigh - atrVal * 1.1, entryLow - atrVal * 0.7);
    const stopPrice = adaptiveStructuralStop('long', entryHigh, structStop, atrVal);
    const initRisk = entryHigh - stopPrice;
    if (initRisk <= 0) return null;
    const tp1Price = entryHigh + initRisk * TP1_R_MULTIPLE;
    const tp2Price = useFixedTp2 ? netTargetPrice('long', entryHigh, stopPrice, WYCKOFF_FIXED_TP2_R, fee) : null;

    return {
      id: `wyckoff-4h-${symbol}-long-${bar.timestamp}`,
      agent: 'wyckoff-4h',
      symbol,
      side: 'long',
      timeframe: '4h',
      signalBarAt: bar.timestamp,
      entryLow,
      entryHigh,
      stopPrice,
      tp1Price,
      tp2Price,
      trailAtrMultiple: CHANDELIER_TRAIL_ATR,
      atrAtSignal: atrVal,
      atrPct,
      rvol: rvol20,
      rsVsBtc,
      closeStrength,
      expiryHours: 32,
      timeStopHours: 480,
      conviction,
      confirmations: [
        `Wyckoff 4H SoS Long breakout (range <= 6.5 ATR, RVOL ${rvol20.toFixed(1)}x)`,
        `Close strength ${(closeStrength * 100).toFixed(0)}% · RS vs BTC ${(rsVsBtc * 100).toFixed(1)}%`,
        `Conviction ${conviction.score}/5 -> Base ${conviction.baseLeverage}x (Risk ${(conviction.baseRiskPct * 100).toFixed(1)}%)`,
      ],
      reason: 'Wyckoff 4H Long SoS: breakout dari konsolidasi padat dengan entry limit retest LPS.',
    };
  } else {
    const entryLow = Math.max(bar.close, rangeLow - atrVal * 0.15);
    const entryHigh = Math.max(entryLow, Math.min(rangeLow + atrVal * 0.25, entryLow + atrVal * 0.3));
    const structStop = Math.max(rangeLow + atrVal * 1.1, entryHigh + atrVal * 0.7);
    const stopPrice = adaptiveStructuralStop('short', entryLow, structStop, atrVal);
    const initRisk = stopPrice - entryLow;
    if (initRisk <= 0) return null;
    const tp1Price = entryLow - initRisk * TP1_R_MULTIPLE;
    if (tp1Price <= 0) return null;
    const tp2Price = useFixedTp2 ? netTargetPrice('short', entryLow, stopPrice, WYCKOFF_FIXED_TP2_R, fee) : null;

    return {
      id: `wyckoff-4h-${symbol}-short-${bar.timestamp}`,
      agent: 'wyckoff-4h',
      symbol,
      side: 'short',
      timeframe: '4h',
      signalBarAt: bar.timestamp,
      entryLow,
      entryHigh,
      stopPrice,
      tp1Price,
      tp2Price,
      trailAtrMultiple: CHANDELIER_TRAIL_ATR,
      atrAtSignal: atrVal,
      atrPct,
      rvol: rvol20,
      rsVsBtc,
      closeStrength,
      expiryHours: 32,
      timeStopHours: 480,
      conviction,
      confirmations: [
        `Wyckoff 4H SoW Short breakdown (range <= 6.5 ATR, RVOL ${rvol20.toFixed(1)}x)`,
        `Close strength ${(closeStrength * 100).toFixed(0)}% · RS vs BTC ${(rsVsBtc * 100).toFixed(1)}%`,
        `Conviction ${conviction.score}/5 -> Base ${conviction.baseLeverage}x (Risk ${(conviction.baseRiskPct * 100).toFixed(1)}%)`,
      ],
      reason: 'Wyckoff 4H Short SoW: breakdown dari distribusi padat dengan entry limit retest LPSY.',
    };
  }
}

/**
 * Agen Booster #2: SMC 1H Bear-Regime Specialist (Long + Short)
 * - Active ONLY when BTC < 4H EMA200 (validated bear-regime alpha)
 * - Removes contradictory 1H EMA9>EMA21 & RVOL filters that killed 98% of sweeps
 * - Uses 4H EMA21 bias + 24-bar 1H liquidity sweep & strong reclaim/rejection
 */
export function evaluateSmc1HBearAt(
  symbol: string,
  d1: ComputedIndicators,
  index1h: number,
  fourHourClose: number,
  fourHourEma21: number,
  btcRegime: BtcMacroRegime,
): SignalCandidate | null {
  // Hard Bear-Regime gate: only active when BTC is below 4H EMA200
  if (btcRegime.macroBull) return null;
  if (index1h < 55 || index1h >= d1.bars.length) return null;

  const reclaim = d1.bars[index1h]!;
  const sweep = d1.bars[index1h - 1]!;
  const atrVal = d1.atr14[index1h]!;
  if (!Number.isFinite(atrVal) || atrVal <= 0) return null;

  const atrPct = atrVal / reclaim.close;
  if (atrPct > 0.08) return null;
  if (Math.abs(reclaim.close - reclaim.open) / atrVal >= 1.08) return null;

  let winLow = Infinity;
  let winHigh = -Infinity;
  for (let k = index1h - 25; k < index1h - 1; k++) {
    const bar = d1.bars[k]!;
    if (bar.low < winLow) winLow = bar.low;
    if (bar.high > winHigh) winHigh = bar.high;
  }

  let volSum24 = 0;
  for (let k = index1h - 24; k < index1h; k++) volSum24 += d1.bars[k]!.volume;
  const rvol24 = volSum24 > 0 ? reclaim.volume / (volSum24 / 24) : 0;

  const range = Math.max(reclaim.high - reclaim.low, 1e-12);
  const closeStrength = (reclaim.close - reclaim.low) / range;
  const pairRet24h = reclaim.close / d1.bars[index1h - 24]!.close - 1;
  const rsVsBtc = pairRet24h - btcRegime.return24h;

  const longOk =
    btcRegime.return24h >= -0.035 &&
    sweep.low < winLow &&
    reclaim.close > sweep.high &&
    reclaim.close > reclaim.open &&
    closeStrength >= 0.65 &&
    fourHourClose > fourHourEma21;

  const shortOk =
    !longOk &&
    btcRegime.return24h <= 0.035 &&
    sweep.high > winHigh &&
    reclaim.close < sweep.low &&
    reclaim.close < reclaim.open &&
    closeStrength <= 0.35 &&
    fourHourClose < fourHourEma21;

  if (!longOk && !shortOk) return null;

  const side: Side = longOk ? 'long' : 'short';
  const conviction = buildConviction({
    side,
    btcMacroBull: btcRegime.macroBull,
    rvol: rvol24,
    rsVsBtc,
    atrPct,
    closeStrength,
  });

  const mid = (reclaim.high + reclaim.low) / 2;
  if (side === 'long') {
    const entryHigh = mid;
    const entryLow = mid - atrVal * 0.15;
    const structStop = Math.min(sweep.low - atrVal * 0.15, entryHigh - atrVal * 1.2);
    const stopPrice = adaptiveStructuralStop('long', entryHigh, structStop, atrVal);
    const initRisk = entryHigh - stopPrice;
    if (initRisk <= 0) return null;
    const tp1Price = entryHigh + initRisk * TP1_R_MULTIPLE;

    return {
      id: `smc-1h-bear-${symbol}-long-${reclaim.timestamp}`,
      agent: 'smc-1h-bear',
      symbol,
      side: 'long',
      timeframe: '1h',
      signalBarAt: reclaim.timestamp,
      entryLow,
      entryHigh,
      stopPrice,
      tp1Price,
      tp2Price: null, // Uncapped Chandelier 3.0x ATR runner (Plan F)
      trailAtrMultiple: CHANDELIER_TRAIL_ATR,
      atrAtSignal: atrVal,
      atrPct,
      rvol: rvol24,
      rsVsBtc,
      closeStrength,
      expiryHours: 6,
      timeStopHours: 168,
      conviction,
      confirmations: [
        `SMC 1H Long Sweep & Reclaim (24h low swept, close strength ${(closeStrength * 100).toFixed(0)}%)`,
        `Bias 4H di atas EMA21 · Aktif pada Bear Regime BTC < EMA200`,
        `Conviction ${conviction.score}/5 -> Base ${conviction.baseLeverage}x`,
      ],
      reason: 'SMC 1H Bear-Specialist Long: sapuan likuiditas 24 jam yang langsung direbut kembali.',
    };
  } else {
    const entryLow = mid;
    const entryHigh = mid + atrVal * 0.15;
    const structStop = Math.max(sweep.high + atrVal * 0.15, entryLow + atrVal * 1.2);
    const stopPrice = adaptiveStructuralStop('short', entryLow, structStop, atrVal);
    const initRisk = stopPrice - entryLow;
    if (initRisk <= 0) return null;
    const tp1Price = entryLow - initRisk * TP1_R_MULTIPLE;
    if (tp1Price <= 0) return null;

    return {
      id: `smc-1h-bear-${symbol}-short-${reclaim.timestamp}`,
      agent: 'smc-1h-bear',
      symbol,
      side: 'short',
      timeframe: '1h',
      signalBarAt: reclaim.timestamp,
      entryLow,
      entryHigh,
      stopPrice,
      tp1Price,
      tp2Price: null,
      trailAtrMultiple: CHANDELIER_TRAIL_ATR,
      atrAtSignal: atrVal,
      atrPct,
      rvol: rvol24,
      rsVsBtc,
      closeStrength,
      expiryHours: 6,
      timeStopHours: 168,
      conviction,
      confirmations: [
        `SMC 1H Short Sweep & Rejection (24h high swept, close strength ${(closeStrength * 100).toFixed(0)}%)`,
        `Bias 4H di bawah EMA21 · Selaras Bear Regime BTC < EMA200`,
        `Conviction ${conviction.score}/5 -> Base ${conviction.baseLeverage}x`,
      ],
      reason: 'SMC 1H Bear-Specialist Short: sapuan likuiditas atas 24 jam diikuti rejection kuat.',
    };
  }
}

export function extractLatestClosedBars(rawBars: OHLCV[]): OHLCV[] {
  // Drop the currently forming live bar so signals never repaint
  return rawBars.length > 1 ? rawBars.slice(0, -1) : rawBars;
}

/**
 * Produces human-readable pass/fail diagnostics for BOTH Wyckoff-4H and SMC-1H-Bear
 * on a given coin so the dashboard can transparently display WHY a coin did or did not trigger.
 */
export function diagnoseCoinAt(
  symbol: string,
  d4: ComputedIndicators,
  d1: ComputedIndicators,
  btcRegime: BtcMacroRegime,
  livePrice?: number,
): UniverseCoinDiagnostic {
  const i4 = d4.bars.length - 1;
  const i1 = d1.bars.length - 1;
  const b4 = d4.bars[i4]!;
  const a4 = d4.atr14[i4] ?? 0;
  const e9 = d4.ema9[i4] ?? b4.close;
  const e21 = d4.ema21[i4] ?? b4.close;
  const lastPrice = livePrice && livePrice > 0 ? livePrice : b4.close;
  const change24hPct = i4 >= 6 ? (b4.close / d4.bars[i4 - 6]!.close - 1) * 100 : 0;
  const rsVsBtc = change24hPct / 100 - btcRegime.return24h;
  const atr4hPct = b4.close > 0 ? (a4 / b4.close) * 100 : 0;

  let rangeHigh = -Infinity;
  let rangeLow = Infinity;
  for (let k = Math.max(0, i4 - 45); k < i4; k++) {
    if (d4.bars[k]!.high > rangeHigh) rangeHigh = d4.bars[k]!.high;
    if (d4.bars[k]!.low < rangeLow) rangeLow = d4.bars[k]!.low;
  }
  let v20 = 0;
  for (let k = Math.max(0, i4 - 20); k < i4; k++) v20 += d4.bars[k]!.volume;
  const rvol4h = v20 > 0 ? b4.volume / (v20 / 20) : 0;
  const cs4 = (b4.close - b4.low) / Math.max(b4.high - b4.low, 1e-12);
  const rangeWidthAtr = a4 > 0 ? (rangeHigh - rangeLow) / a4 : 99;

  const trend4h: UniverseCoinDiagnostic['trend4h'] =
    e9 > e21 && b4.close > e21 ? 'UPTREND' : e9 < e21 && b4.close < e21 ? 'DOWNTREND' : 'SIDEWAYS';

  // --- Wyckoff-4H Diagnostic ---
  const wykSig = evaluateWyckoff4HAt(symbol, d4, i4, btcRegime);
  const wykBias: Side | 'neutral' = e9 > e21 ? 'long' : e9 < e21 ? 'short' : 'neutral';
  const wykPass: string[] = [];
  const wykFail: string[] = [];

  if (atr4hPct <= 8) wykPass.push(`Volatilitas aman (ATR ${atr4hPct.toFixed(2)}% ≤ 8%)`);
  else wykFail.push(`Volatilitas ekstrem (ATR ${atr4hPct.toFixed(2)}% > 8%)`);

  if (rangeWidthAtr <= 6.5) wykPass.push(`Range 45-bar padat (${rangeWidthAtr.toFixed(1)} ATR ≤ 6.5)`);
  else wykFail.push(`Range 45-bar terlalu lebar (${rangeWidthAtr.toFixed(1)} ATR > 6.5)`);

  if (rvol4h >= 1.6) wykPass.push(`Volume kuat (RVOL ${rvol4h.toFixed(2)}x ≥ 1.6x)`);
  else wykFail.push(`Volume kurang (RVOL ${rvol4h.toFixed(2)}x < 1.6x)`);

  if (wykBias === 'long') {
    wykPass.push('Tren 4H bullish (EMA9 > EMA21)');
    if (b4.close > rangeHigh) wykPass.push(`Breakout di atas Range High`);
    else wykFail.push(`Close belum tembus Range High ($${rangeHigh.toFixed(rangeHigh >= 10 ? 2 : 4)})`);
    if (cs4 >= 0.7) wykPass.push(`Close strength kuat (${(cs4 * 100).toFixed(0)}% ≥ 70%)`);
    else wykFail.push(`Close strength lemah (${(cs4 * 100).toFixed(0)}% < 70%)`);
    if (btcRegime.riskOn || rsVsBtc >= 0.015) wykPass.push('Regime BTC/RS mendukung Long');
    else wykFail.push(`Regime BTC belum riskOn & RS ${(rsVsBtc * 100).toFixed(1)}% < +1.5%`);
  } else if (wykBias === 'short') {
    wykPass.push('Tren 4H bearish (EMA9 < EMA21)');
    if (b4.close < rangeLow) wykPass.push(`Breakdown di bawah Range Low`);
    else wykFail.push(`Close belum jebol Range Low ($${rangeLow.toFixed(rangeLow >= 10 ? 2 : 4)})`);
    if (cs4 <= 0.3) wykPass.push(`Close strength bearish kuat (${(cs4 * 100).toFixed(0)}% ≤ 30%)`);
    else wykFail.push(`Close strength kurang bearish (${(cs4 * 100).toFixed(0)}% > 30%)`);
    if (btcRegime.riskOff || rsVsBtc <= -0.015) wykPass.push('Regime BTC/RS mendukung Short');
    else wykFail.push(`Regime BTC belum riskOff & RS ${(rsVsBtc * 100).toFixed(1)}% > -1.5%`);
  } else {
    wykFail.push('EMA9 ≈ EMA21 (belum ada bias tren 4H)');
  }

  let wykStatus: AgentDiagnosticDetail['status'] = 'WAIT';
  if (wykSig) {
    if (wykSig.conviction.baseLeverage > 0) {
      wykStatus = 'SIGNAL';
      wykPass.push(`Conviction ${wykSig.conviction.score}/5 -> Base ${wykSig.conviction.baseLeverage}x`);
    } else {
      wykStatus = 'LOW_CONVICTION';
      wykFail.push(`Skor Conviction terlalu rendah (${wykSig.conviction.score}/5, min 2/5)`);
    }
  }

  // --- SMC-1H-Bear Diagnostic ---
  const smcPass: string[] = [];
  const smcFail: string[] = [];
  let smcStatus: AgentDiagnosticDetail['status'] = 'WAIT';
  const smcBias: Side | 'neutral' = b4.close > e21 ? 'long' : b4.close < e21 ? 'short' : 'neutral';

  if (btcRegime.macroBull) {
    smcStatus = 'INACTIVE_BULL_MACRO';
    smcFail.push('Nonaktif: BTC di atas 4H EMA200 (SMC-1H khusus rezim Bear)');
  } else {
    smcPass.push('Rezim Bear aktif (BTC < 4H EMA200)');
    const smcSig = evaluateSmc1HBearAt(symbol, d1, i1, b4.close, e21, btcRegime);
    const reclaim = d1.bars[i1]!;
    const sweep = d1.bars[i1 - 1]!;
    const a1 = d1.atr14[i1] ?? 0;
    let winLo = Infinity;
    let winHi = -Infinity;
    for (let k = Math.max(0, i1 - 25); k < i1 - 1; k++) {
      if (d1.bars[k]!.low < winLo) winLo = d1.bars[k]!.low;
      if (d1.bars[k]!.high > winHi) winHi = d1.bars[k]!.high;
    }
    const cs1 = (reclaim.close - reclaim.low) / Math.max(reclaim.high - reclaim.low, 1e-12);
    const bodyAtr = a1 > 0 ? Math.abs(reclaim.close - reclaim.open) / a1 : 99;

    if (bodyAtr < 1.08) smcPass.push(`Body reclaim sehat (${bodyAtr.toFixed(2)} ATR < 1.08)`);
    else smcFail.push(`Body reclaim terlalu panjang (${bodyAtr.toFixed(2)} ATR ≥ 1.08)`);

    if (smcBias === 'long') {
      smcPass.push('Bias 4H di atas EMA21 (cari Sweep Low)');
      if (sweep.low < winLo) smcPass.push('Terjadi Sweep Low 24 jam');
      else smcFail.push('Belum ada Sweep Low 24 jam');
      if (reclaim.close > sweep.high && reclaim.close > reclaim.open && cs1 >= 0.65) {
        smcPass.push(`Reclaim bullish kuat (${(cs1 * 100).toFixed(0)}%)`);
      } else {
        smcFail.push(`Belum reclaim di atas sweep high / CS ${(cs1 * 100).toFixed(0)}% < 65%`);
      }
    } else {
      smcPass.push('Bias 4H di bawah EMA21 (cari Sweep High)');
      if (sweep.high > winHi) smcPass.push('Terjadi Sweep High 24 jam');
      else smcFail.push('Belum ada Sweep High 24 jam');
      if (reclaim.close < sweep.low && reclaim.close < reclaim.open && cs1 <= 0.35) {
        smcPass.push(`Rejection bearish kuat (${(cs1 * 100).toFixed(0)}%)`);
      } else {
        smcFail.push(`Belum rejection di bawah sweep low / CS ${(cs1 * 100).toFixed(0)}% > 35%`);
      }
    }

    if (smcSig) {
      if (smcSig.conviction.baseLeverage > 0) {
        smcStatus = 'SIGNAL';
        smcPass.push(`Conviction ${smcSig.conviction.score}/5 -> Base ${smcSig.conviction.baseLeverage}x`);
      } else {
        smcStatus = 'LOW_CONVICTION';
        smcFail.push(`Skor Conviction terlalu rendah (${smcSig.conviction.score}/5, min 2/5)`);
      }
    }
  }

  return {
    symbol,
    lastPrice,
    change24hPct: Number(change24hPct.toFixed(2)),
    trend4h,
    atr4hPct: Number(atr4hPct.toFixed(2)),
    rvol4h: Number(rvol4h.toFixed(2)),
    rsVsBtcPct: Number((rsVsBtc * 100).toFixed(2)),
    wyckoff4h: {
      status: wykStatus,
      directionBias: wykBias,
      passedChecks: wykPass,
      failedChecks: wykFail,
    },
    smc1hBear: {
      status: smcStatus,
      directionBias: smcBias,
      passedChecks: smcPass,
      failedChecks: smcFail,
    },
  };
}
