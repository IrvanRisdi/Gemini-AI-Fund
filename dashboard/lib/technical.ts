import { rsi, adx, ema, atr, bollingerBands, type OHLCV } from '@ai-fund/lib/indicators';

export interface TechnicalSnapshot {
  close: number;
  timestamp: number;
  rsi14: number;
  adx14: number;
  ema9: number;
  ema21: number;
  atr14: number;
  bbUpper: number;
  bbMid: number;
  bbLower: number;
  resistance20: number;
  support20: number;
  volRatio: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  rsiSignal: 'oversold' | 'overbought' | 'neutral';
  trending: boolean;
}

/**
 * Mirrors the exact methodology the trading loop's agents use each cycle:
 * drop the still-forming final candle, compute RSI14/ADX14/EMA9/EMA21/ATR14/
 * Bollinger(20,2) off the closed bars, and derive a 20-bar support/resistance
 * + volume-ratio read off the bar before that.
 */
export function computeTechnicalSnapshot(candles: OHLCV[]): TechnicalSnapshot | null {
  const closed = candles.slice(0, -1);
  if (closed.length < 25) return null;

  const closes = closed.map((c) => c.close);
  const rsiArr = rsi(closes, 14);
  const adxArr = adx(closed, 14);
  const ema9Arr = ema(closes, 9);
  const ema21Arr = ema(closes, 21);
  const atrArr = atr(closed, 14);
  const bb = bollingerBands(closes, 20, 2);

  const last = closed[closed.length - 1];
  const last20 = closed.slice(-21, -1);
  const resistance20 = Math.max(...last20.map((c) => c.high));
  const support20 = Math.min(...last20.map((c) => c.low));
  const avgVol20 = last20.reduce((a, c) => a + c.volume, 0) / last20.length;

  const rsi14 = rsiArr[rsiArr.length - 1];
  const adx14 = adxArr[adxArr.length - 1];
  const ema9v = ema9Arr[ema9Arr.length - 1];
  const ema21v = ema21Arr[ema21Arr.length - 1];

  return {
    close: last.close,
    timestamp: last.timestamp,
    rsi14,
    adx14,
    ema9: ema9v,
    ema21: ema21v,
    atr14: atrArr[atrArr.length - 1],
    bbUpper: bb.upper[bb.upper.length - 1],
    bbMid: bb.middle[bb.middle.length - 1],
    bbLower: bb.lower[bb.lower.length - 1],
    resistance20,
    support20,
    volRatio: avgVol20 > 0 ? last.volume / avgVol20 : 0,
    trend: ema9v > ema21v ? 'bullish' : ema9v < ema21v ? 'bearish' : 'neutral',
    rsiSignal: rsi14 < 30 ? 'oversold' : rsi14 > 70 ? 'overbought' : 'neutral',
    trending: adx14 > 25,
  };
}
