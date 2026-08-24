/**
 * Technical indicator calculations for trading skills.
 * All functions take arrays of numbers (typically close prices)
 * and return computed indicator values.
 */

export interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

// ── Moving Averages ────────────────────────────────────────

export function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

export function ema(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  result.push(data.slice(0, period).reduce((a, b) => a + b, 0) / period);

  for (let i = period; i < data.length; i++) {
    result.push((data[i] - result[result.length - 1]) * multiplier + result[result.length - 1]);
  }
  return result;
}

// ── RSI ────────────────────────────────────────────────────

export function rsi(closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  if (gains.length < period) return [];

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + rs));

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

// ── Bollinger Bands ────────────────────────────────────────

export function bollingerBands(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i - period + 1];
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    upper.push(mean + stdDev * stdDevMultiplier);
    lower.push(mean - stdDev * stdDevMultiplier);
  }

  return { upper, middle, lower };
}

// ── ATR ────────────────────────────────────────────────────

export function atr(candles: OHLCV[], period: number = 14): number[] {
  if (candles.length < 2) return [];

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }

  if (trs.length < period) return [];

  const result: number[] = [];
  let currentAtr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(currentAtr);

  for (let i = period; i < trs.length; i++) {
    currentAtr = (currentAtr * (period - 1) + trs[i]) / period;
    result.push(currentAtr);
  }

  return result;
}

// ── ADX ────────────────────────────────────────────────────

export function adx(
  candles: OHLCV[],
  period: number = 14
): number[] {
  if (candles.length < period + 1) return [];

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const trs: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;
    const prevClose = candles[i - 1].close;

    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }

  const smoothTR: number[] = [trs.slice(0, period).reduce((a, b) => a + b, 0)];
  const smoothPlusDM: number[] = [plusDM.slice(0, period).reduce((a, b) => a + b, 0)];
  const smoothMinusDM: number[] = [minusDM.slice(0, period).reduce((a, b) => a + b, 0)];

  for (let i = period; i < trs.length; i++) {
    smoothTR.push(smoothTR[smoothTR.length - 1] - smoothTR[smoothTR.length - 1] / period + trs[i]);
    smoothPlusDM.push(smoothPlusDM[smoothPlusDM.length - 1] - smoothPlusDM[smoothPlusDM.length - 1] / period + plusDM[i]);
    smoothMinusDM.push(smoothMinusDM[smoothMinusDM.length - 1] - smoothMinusDM[smoothMinusDM.length - 1] / period + minusDM[i]);
  }

  const dx: number[] = [];
  for (let i = 0; i < smoothTR.length; i++) {
    const plusDI = smoothTR[i] === 0 ? 0 : (smoothPlusDM[i] / smoothTR[i]) * 100;
    const minusDI = smoothTR[i] === 0 ? 0 : (smoothMinusDM[i] / smoothTR[i]) * 100;
    const diSum = plusDI + minusDI;
    dx.push(diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100);
  }

  if (dx.length < period) return [];

  const adxResult: number[] = [];
  let firstAdx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  adxResult.push(firstAdx);

  for (let i = period; i < dx.length; i++) {
    firstAdx = (firstAdx * (period - 1) + dx[i]) / period;
    adxResult.push(firstAdx);
  }

  return adxResult;
}
