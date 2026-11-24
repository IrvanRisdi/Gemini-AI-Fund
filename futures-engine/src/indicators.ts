import type { OHLCV } from './types.js';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function emaSeries(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i]!;
  let current = sum / period;
  out[period - 1] = current;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    current = (values[i]! - current) * k + current;
    out[i] = current;
  }
  return out;
}

export function atrSeries(bars: OHLCV[], period = 14): number[] {
  const n = bars.length;
  const out = new Array<number>(n).fill(NaN);
  if (n <= period) return out;
  const tr = new Array<number>(n).fill(0);
  tr[0] = bars[0]!.high - bars[0]!.low;
  for (let i = 1; i < n; i++) {
    const prevClose = bars[i - 1]!.close;
    const bar = bars[i]!;
    tr[i] = Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - prevClose),
      Math.abs(bar.low - prevClose),
    );
  }
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i]!;
  let current = sum / period;
  out[period] = current;
  for (let i = period + 1; i < n; i++) {
    current = (current * (period - 1) + tr[i]!) / period;
    out[i] = current;
  }
  return out;
}

export function adxSeries(bars: OHLCV[], period = 14): number[] {
  const n = bars.length;
  const out = new Array<number>(n).fill(NaN);
  if (n < period * 2 + 1) return out;
  const tr = new Array<number>(n).fill(0);
  const pdm = new Array<number>(n).fill(0);
  const mdm = new Array<number>(n).fill(0);

  for (let i = 1; i < n; i++) {
    const up = bars[i]!.high - bars[i - 1]!.high;
    const down = bars[i - 1]!.low - bars[i]!.low;
    pdm[i] = up > down && up > 0 ? up : 0;
    mdm[i] = down > up && down > 0 ? down : 0;
    const prevClose = bars[i - 1]!.close;
    tr[i] = Math.max(
      bars[i]!.high - bars[i]!.low,
      Math.abs(bars[i]!.high - prevClose),
      Math.abs(bars[i]!.low - prevClose),
    );
  }

  let sTr = 0;
  let sP = 0;
  let sM = 0;
  for (let i = 1; i <= period; i++) {
    sTr += tr[i]!;
    sP += pdm[i]!;
    sM += mdm[i]!;
  }

  const dx = new Array<number>(n).fill(NaN);
  for (let i = period; i < n; i++) {
    if (i > period) {
      sTr = sTr - sTr / period + tr[i]!;
      sP = sP - sP / period + pdm[i]!;
      sM = sM - sM / period + mdm[i]!;
    }
    const pdi = sTr > 0 ? (100 * sP) / sTr : 0;
    const mdi = sTr > 0 ? (100 * sM) / sTr : 0;
    dx[i] = pdi + mdi > 0 ? (100 * Math.abs(pdi - mdi)) / (pdi + mdi) : 0;
  }

  let sDx = 0;
  for (let i = period; i < period * 2; i++) sDx += dx[i]!;
  let current = sDx / period;
  out[period * 2 - 1] = current;
  for (let i = period * 2; i < n; i++) {
    current = (current * (period - 1) + dx[i]!) / period;
    out[i] = current;
  }
  return out;
}

export interface ComputedIndicators {
  bars: OHLCV[];
  closes: number[];
  ema9: number[];
  ema21: number[];
  ema200: number[];
  atr14: number[];
  adx14: number[];
}

export function computeIndicators(bars: OHLCV[]): ComputedIndicators {
  const closes = bars.map((b) => b.close);
  return {
    bars,
    closes,
    ema9: emaSeries(closes, 9),
    ema21: emaSeries(closes, 21),
    ema200: emaSeries(closes, 200),
    atr14: atrSeries(bars, 14),
    adx14: adxSeries(bars, 14),
  };
}

export function median(values: number[]): number {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (valid.length === 0) return NaN;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 1 ? valid[mid]! : (valid[mid - 1]! + valid[mid]!) / 2;
}
