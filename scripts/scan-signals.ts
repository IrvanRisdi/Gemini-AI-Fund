#!/usr/bin/env node
/**
 * Cheap, non-LLM signal scan across the desk's expanded pair universe.
 *
 * Run every cycle (cron) BEFORE any expensive Claude reasoning. Computes
 * each active trading agent's own mechanical entry thresholds in plain
 * TypeScript/math — no LLM judgment involved — and writes a JSON summary of
 * which (pair, agent) combos actually cleared their threshold this cycle.
 * Covers momentum-trader, jesse-livermore, mean-reversion-trader, smc-trader,
 * breakout-specialist, volatility-analyst, pairs-trader, wyckoff-trader,
 * supply-demand-trader, fibonacci-trader, and candlestick-trader. The four
 * newest (wyckoff/supply-demand/fibonacci/candlestick) use deliberately
 * simplified single-window proxies for their full SKILL.md rules (Spring/UTAD
 * volume signature, single-base zone departure, swing-relative Fib bands,
 * Engulfing-only pattern detection) — same convention as smc-trader deferring
 * OB/FVG confluence to the full-reasoning pass: Tier-1 finds the candidate,
 * Tier-2 verifies it against the complete rule set before anything trades.
 *
 * If `candidates` comes back empty, the calling loop should just log a
 * one-line "no signal" note and stop — skip the full narrative/briefing
 * pass entirely. Only escalate into the expensive flow when this script
 * actually finds something.
 *
 * Reuses the exact same indicator/SMC math the dashboard uses
 * (dashboard/lib/*), so the numbers here match what /pair/[symbol] would show.
 */

import { rsi, adx, ema, atr, bollingerBands, type OHLCV } from '../lib/indicators.js';
import { mean, standardDeviation, returns } from '../lib/math.js';
import { scorePairs, spreadZScore, pairSignal, hedgeRatio } from '../lib/stat-arb.js';
import { fetchOhlcv } from '../dashboard/lib/indodax.js';
import { detectSweepChochConfluence } from '../dashboard/lib/smc.js';
import fs from 'node:fs';
import path from 'node:path';

// xlmidr removed 2026-08-20 — Indodax returns zero candles for it (same
// thin-liquidity gap seen on aaveidr), so it never produced a usable snapshot anyway.
const PAIRS = [
  'btcidr', 'ethidr', 'solidr', 'xrpidr', 'dogeidr', 'pepeidr', 'suiidr', 'bnbidr',
  'trxidr', 'hypeidr', 'linkidr', 'adaidr', 'bchidr', 'tonidr', 'ltcidr',
  'hbaridr', 'avaxidr', 'shibidr', 'uniidr',
];

interface Snapshot {
  pair: string;
  close: number;
  rsi14: number;
  adx14: number;
  ema9: number;
  ema21: number;
  atr14: number;
  atr50: number;
  bbUpper: number;
  bbLower: number;
  bbMid: number;
  bandwidthPercentile: number;
  resistance20: number;
  support20: number;
  volRatio: number;
}

interface Candidate {
  pair: string;
  agent: string;
  reason: string;
  data: Record<string, number>;
}

function computeSnapshot(pair: string, candles: OHLCV[]): Snapshot | null {
  const closed = candles.slice(0, -1);
  if (closed.length < 25) return null;

  const closes = closed.map((c) => c.close);
  const rsiArr = rsi(closes, 14);
  const adxArr = adx(closed, 14);
  const ema9Arr = ema(closes, 9);
  const ema21Arr = ema(closes, 21);
  const atr14Arr = atr(closed, 14);
  const atr50Arr = closed.length >= 51 ? atr(closed, 50) : atr14Arr;
  const bb = bollingerBands(closes, 20, 2);

  // Bollinger bandwidth percentile: where does the current bandwidth rank
  // against all bandwidth readings available in this window? (breakout-specialist's squeeze detector)
  const bandwidths = bb.upper.map((u, i) => (u - bb.lower[i]) / bb.middle[i]);
  const currentBw = bandwidths[bandwidths.length - 1];
  const bandwidthPercentile = (bandwidths.filter((b) => b <= currentBw).length / bandwidths.length) * 100;

  const last = closed[closed.length - 1];
  const last20 = closed.slice(-21, -1);
  const resistance20 = Math.max(...last20.map((c) => c.high));
  const support20 = Math.min(...last20.map((c) => c.low));
  const avgVol20 = last20.reduce((a, c) => a + c.volume, 0) / last20.length;

  return {
    pair,
    close: last.close,
    rsi14: rsiArr[rsiArr.length - 1],
    adx14: adxArr[adxArr.length - 1],
    ema9: ema9Arr[ema9Arr.length - 1],
    ema21: ema21Arr[ema21Arr.length - 1],
    atr14: atr14Arr[atr14Arr.length - 1],
    atr50: atr50Arr[atr50Arr.length - 1],
    bbUpper: bb.upper[bb.upper.length - 1],
    bbLower: bb.lower[bb.lower.length - 1],
    bbMid: bb.middle[bb.middle.length - 1],
    bandwidthPercentile,
    resistance20,
    support20,
    volRatio: avgVol20 > 0 ? last.volume / avgVol20 : 0,
  };
}

function checkMomentumTrader(s: Snapshot): Candidate | null {
  const bullish = s.ema9 > s.ema21;
  const bearish = s.ema9 < s.ema21;
  const trending = s.adx14 > 25;
  const volConfirms = s.volRatio > 1.5;

  if (trending && bullish && s.rsi14 >= 50 && s.rsi14 <= 80 && s.close > s.resistance20 && volConfirms) {
    return { pair: s.pair, agent: 'momentum-trader', reason: 'bullish breakout: ADX>25, EMA9>EMA21, RSI in 50-80, close above 20-bar resistance, volume>1.5x', data: { adx14: s.adx14, rsi14: s.rsi14, volRatio: s.volRatio } };
  }
  if (trending && bearish && s.rsi14 >= 20 && s.rsi14 <= 50 && s.close < s.support20 && volConfirms) {
    return { pair: s.pair, agent: 'momentum-trader', reason: 'bearish breakdown: ADX>25, EMA9<EMA21, RSI in 20-50, close below 20-bar support, volume>1.5x', data: { adx14: s.adx14, rsi14: s.rsi14, volRatio: s.volRatio } };
  }
  return null;
}

function checkJesseLivermore(s: Snapshot): Candidate | null {
  // Lighter than momentum-trader: pivot break + real volume, no ADX/RSI gate.
  const volConfirms = s.volRatio > 1.5;
  if (!volConfirms) return null;
  if (s.close > s.resistance20) {
    return { pair: s.pair, agent: 'jesse-livermore', reason: 'pivot break up with volume confirmation', data: { volRatio: s.volRatio, close: s.close, resistance20: s.resistance20 } };
  }
  if (s.close < s.support20) {
    return { pair: s.pair, agent: 'jesse-livermore', reason: 'pivot break down with volume confirmation', data: { volRatio: s.volRatio, close: s.close, support20: s.support20 } };
  }
  return null;
}

function checkMeanReversionTrader(s: Snapshot): Candidate | null {
  const rangeRegime = s.adx14 < 25;
  const noBreakoutBehind = s.volRatio < 1.5;
  if (!rangeRegime || !noBreakoutBehind) return null;
  if (s.rsi14 < 30 && s.close <= s.bbLower) {
    return { pair: s.pair, agent: 'mean-reversion-trader', reason: 'range regime, RSI<30, price at/below lower Bollinger, no volume behind the move', data: { adx14: s.adx14, rsi14: s.rsi14, volRatio: s.volRatio } };
  }
  if (s.rsi14 > 70 && s.close >= s.bbUpper) {
    return { pair: s.pair, agent: 'mean-reversion-trader', reason: 'range regime, RSI>70, price at/above upper Bollinger, no volume behind the move', data: { adx14: s.adx14, rsi14: s.rsi14, volRatio: s.volRatio } };
  }
  return null;
}

function checkSmcTrader(pair: string, candles: OHLCV[]): Candidate | null {
  // Sweep and CHoCH checked across a short window (not the same single bar —
  // see detectSweepChochConfluence's doc comment for why that was structurally
  // near-impossible and never fired in ~1,600 bar-checks of backtesting).
  // OB/FVG confluence still checked in the full reasoning pass, not here.
  const confluence = detectSweepChochConfluence(candles, 5);
  if (!confluence) return null;
  return {
    pair,
    agent: 'smc-trader',
    reason: `${confluence.sweep.type} liquidity sweep + ${confluence.choch} CHoCH confirmed (within 5 bars)`,
    data: { sweepVolRatio: confluence.sweep.volRatio, poolPrice: confluence.sweep.poolPrice },
  };
}

function checkBreakoutSpecialist(s: Snapshot): Candidate | null {
  // Squeeze = ATR(14)/ATR(50) contracted OR bandwidth in the bottom quartile
  // of its own recent history — then an actual break of the range with volume.
  const atrRatio = s.atr50 > 0 ? s.atr14 / s.atr50 : 1;
  const squeezed = atrRatio < 0.75 || s.bandwidthPercentile < 25;
  if (!squeezed) return null;
  const volConfirms = s.volRatio > 1.5;
  if (!volConfirms) return null;

  if (s.close > s.resistance20) {
    return { pair: s.pair, agent: 'breakout-specialist', reason: `squeeze (ATR ratio ${atrRatio.toFixed(2)}, bandwidth pctile ${s.bandwidthPercentile.toFixed(0)}) resolving up through range high, volume confirms`, data: { atrRatio, bandwidthPercentile: s.bandwidthPercentile, volRatio: s.volRatio } };
  }
  if (s.close < s.support20) {
    return { pair: s.pair, agent: 'breakout-specialist', reason: `squeeze (ATR ratio ${atrRatio.toFixed(2)}, bandwidth pctile ${s.bandwidthPercentile.toFixed(0)}) resolving down through range low, volume confirms`, data: { atrRatio, bandwidthPercentile: s.bandwidthPercentile, volRatio: s.volRatio } };
  }
  return null;
}

function checkVolatilityAnalyst(pair: string, closes: number[]): Candidate | null {
  // Adapted to the 15m bar count available here (not literal 7d/30d windows):
  // short window ~2h (8 bars) vs long window ~the full available history.
  if (closes.length < 40) return null;
  const rets = returns(closes);
  const shortRets = rets.slice(-8);
  const longRets = rets.slice(-40);
  const rvShort = standardDeviation(shortRets);
  const rvLong = standardDeviation(longRets);
  if (rvLong <= 0) return null;
  const ratio = rvShort / rvLong;

  if (ratio > 1.6) {
    return { pair, agent: 'volatility-analyst', reason: `realized vol expanding — short-window vol is ${ratio.toFixed(2)}x the longer-window baseline`, data: { rvShort, rvLong, ratio } };
  }
  return null;
}

function checkPairsTrader(closesByPair: Map<string, number[]>): Candidate[] {
  const pairs = [...closesByPair.keys()];
  const candidates_: Array<{ symbolA: string; symbolB: string; pricesA: number[]; pricesB: number[] }> = [];
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const a = closesByPair.get(pairs[i])!;
      const b = closesByPair.get(pairs[j])!;
      if (a.length < 30 || b.length < 30) continue;
      candidates_.push({ symbolA: pairs[i], symbolB: pairs[j], pricesA: a, pricesB: b });
    }
  }
  if (candidates_.length === 0) return [];

  const scored = scorePairs(candidates_).filter((p) => p.cointegrated && p.halfLife > 3 && p.halfLife < 200);
  const out: Candidate[] = [];

  for (const p of scored.slice(0, 15)) {
    const a = closesByPair.get(p.symbolA)!;
    const b = closesByPair.get(p.symbolB)!;
    const hr = hedgeRatio(a, b);
    const z = spreadZScore(a, b, hr.ratio, 50);
    const sig = pairSignal({ zScore: z.zScore });
    if (sig.signal === 'long_spread' || sig.signal === 'short_spread') {
      out.push({
        pair: `${p.symbolA}/${p.symbolB}`,
        agent: 'pairs-trader',
        reason: `${sig.signal} — z-score ${z.zScore.toFixed(2)}, cointegrated (half-life ${p.halfLife.toFixed(1)} bars, corr ${p.correlation.toFixed(2)})`,
        data: { zScore: z.zScore, halfLife: p.halfLife, correlation: p.correlation, hedgeRatio: hr.ratio },
      });
    }
  }
  return out;
}

function checkWyckoffTrader(pair: string, candles: OHLCV[]): Candidate | null {
  // Mechanical proxy for a Wyckoff Phase C test (Spring / UTAD): price
  // penetrates the recent trading range's extreme and closes back inside it
  // on BELOW-AVERAGE volume — the Wyckoff signature of supply/demand
  // exhaustion, distinct from a plain wick-and-reclaim (which doesn't require
  // a volume floor). This only flags the CANDIDATE test bar; confirming it as
  // a genuine Spring/UTAD (via the low-volume follow-through Test, the Nine
  // Tests checklist, and a P&F count) is the full-reasoning pass's job.
  const closed = candles.slice(0, -1);
  if (closed.length < 25) return null;
  const last = closed[closed.length - 1];
  const prior20 = closed.slice(-21, -1);
  if (prior20.length < 20) return null;
  const rangeHigh = Math.max(...prior20.map((c) => c.high));
  const rangeLow = Math.min(...prior20.map((c) => c.low));
  const avgVol = prior20.reduce((a, c) => a + c.volume, 0) / prior20.length;
  if (avgVol <= 0) return null;
  const volRatio = last.volume / avgVol;

  if (last.low < rangeLow && last.close > rangeLow && volRatio < 1) {
    return {
      pair,
      agent: 'wyckoff-trader',
      reason: `possible Spring: wicked below the 20-bar range low (${rangeLow}) on below-average volume (${volRatio.toFixed(2)}x), closed back inside — Phase C test candidate, needs the Test bar to confirm`,
      data: { rangeLow, rangeHigh, volRatio },
    };
  }
  if (last.high > rangeHigh && last.close < rangeHigh && volRatio < 1) {
    return {
      pair,
      agent: 'wyckoff-trader',
      reason: `possible UTAD: wicked above the 20-bar range high (${rangeHigh}) on below-average volume (${volRatio.toFixed(2)}x), closed back inside — Phase C test candidate, needs the Test bar to confirm`,
      data: { rangeHigh, rangeLow, volRatio },
    };
  }
  return null;
}

function checkSupplyDemandTrader(pair: string, candles: OHLCV[]): Candidate | null {
  // Mechanical proxy for "fresh zone, first retest, 2:1 departure": scans
  // backward for the most recent single-candle base immediately followed by
  // an impulsive (>=2xATR) move away from it, then checks whether price has
  // now returned to that zone's proximal line for the FIRST time and reacted.
  // The full base-quality checklist (<=6 candles, tight bodies, originality,
  // 3:1 profit margin) is deferred to the full-reasoning pass, same as
  // smc-trader defers OB/FVG confluence here.
  const closed = candles.slice(0, -1);
  if (closed.length < 30) return null;
  const atr14Arr = atr(closed, 14);
  if (atr14Arr.length === 0) return null;
  const last = closed[closed.length - 1];
  const offset = closed.length - atr14Arr.length;

  for (let i = closed.length - 2; i >= Math.max(1, closed.length - 20); i--) {
    const base = closed[i];
    const move = closed[i + 1];
    const localAtr = atr14Arr[Math.max(0, i - offset)] ?? atr14Arr[atr14Arr.length - 1];
    if (!localAtr || localAtr <= 0) continue;

    const departureUp = move.close - base.low;
    if (move.close > move.open && departureUp >= 2 * localAtr) {
      const zoneProximal = Math.max(base.open, base.close);
      const zoneDistal = base.low;
      const untouchedSince = closed.slice(i + 2, closed.length - 1).every((c) => c.low > zoneProximal);
      if (untouchedSince && last.low <= zoneProximal && last.low >= zoneDistal && last.close > zoneProximal) {
        return {
          pair,
          agent: 'supply-demand-trader',
          reason: `fresh demand zone (proximal ${zoneProximal}, distal ${zoneDistal}) retested for the first time and held, ${(departureUp / localAtr).toFixed(1)}x ATR departure`,
          data: { zoneProximal, zoneDistal, departureToAtr: departureUp / localAtr },
        };
      }
      break;
    }

    const departureDown = base.high - move.close;
    if (move.close < move.open && departureDown >= 2 * localAtr) {
      const zoneProximal = Math.min(base.open, base.close);
      const zoneDistal = base.high;
      const untouchedSince = closed.slice(i + 2, closed.length - 1).every((c) => c.high < zoneProximal);
      if (untouchedSince && last.high >= zoneProximal && last.high <= zoneDistal && last.close < zoneProximal) {
        return {
          pair,
          agent: 'supply-demand-trader',
          reason: `fresh supply zone (proximal ${zoneProximal}, distal ${zoneDistal}) retested for the first time and held, ${(departureDown / localAtr).toFixed(1)}x ATR departure`,
          data: { zoneProximal, zoneDistal, departureToAtr: departureDown / localAtr },
        };
      }
      break;
    }
  }
  return null;
}

function findLastSwing(candles: OHLCV[]): { high: { price: number; index: number }; low: { price: number; index: number } } | null {
  const lookback = 2;
  const highs: { price: number; index: number }[] = [];
  const lows: { price: number; index: number }[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const windowHighs = candles.slice(i - lookback, i + lookback + 1).map((c) => c.high);
    const windowLows = candles.slice(i - lookback, i + lookback + 1).map((c) => c.low);
    if (candles[i].high === Math.max(...windowHighs)) highs.push({ price: candles[i].high, index: i });
    if (candles[i].low === Math.min(...windowLows)) lows.push({ price: candles[i].low, index: i });
  }
  if (highs.length === 0 || lows.length === 0) return null;
  return { high: highs[highs.length - 1], low: lows[lows.length - 1] };
}

function checkFibonacciTrader(pair: string, candles: OHLCV[]): Candidate | null {
  // Mechanical proxy for a "Fib stick": price tags the 38.2/50/61.8%
  // retracement band of the most recent swing with a reversal-candle
  // signature. Confluence against separate S/R and trendlines is deferred to
  // the full-reasoning pass, same convention as the other zone-based agents.
  const closed = candles.slice(0, -1);
  if (closed.length < 30) return null;
  const swing = findLastSwing(closed);
  if (!swing) return null;
  const last = closed[closed.length - 1];
  const range = swing.high.price - swing.low.price;
  if (range <= 0) return null;

  const levels = [0.382, 0.5, 0.618];
  const isUptrendLeg = swing.high.index > swing.low.index;

  for (const lvl of levels) {
    if (isUptrendLeg) {
      const price = swing.high.price - range * lvl;
      const inBand = last.low <= price * 1.002 && last.low >= price * 0.998;
      const bodySize = Math.abs(last.close - last.open);
      const bullishReaction = last.close > last.open && last.close - last.low > 2 * bodySize;
      if (inBand && bullishReaction) {
        return {
          pair,
          agent: 'fibonacci-trader',
          reason: `${(lvl * 100).toFixed(1)}% retracement (${price.toFixed(6)}) of swing low ${swing.low.price}->high ${swing.high.price} tagged with a bullish reaction candle`,
          data: { level: lvl, price, swingHigh: swing.high.price, swingLow: swing.low.price },
        };
      }
    } else {
      const price = swing.low.price + range * lvl;
      const inBand = last.high >= price * 0.998 && last.high <= price * 1.002;
      const bodySize = Math.abs(last.close - last.open);
      const bearishReaction = last.close < last.open && last.high - last.close > 2 * bodySize;
      if (inBand && bearishReaction) {
        return {
          pair,
          agent: 'fibonacci-trader',
          reason: `${(lvl * 100).toFixed(1)}% retracement (${price.toFixed(6)}) of swing high ${swing.high.price}->low ${swing.low.price} tagged with a bearish reaction candle`,
          data: { level: lvl, price, swingHigh: swing.high.price, swingLow: swing.low.price },
        };
      }
    }
  }
  return null;
}

function checkCandlestickTrader(pair: string, candles: OHLCV[]): Candidate | null {
  // Mechanical proxy for the method's Level 1 (trade-directly) patterns:
  // Bullish/Bearish Engulfing, checked against short-term trend context
  // (never name the pattern without checking what preceded it — per the
  // SKILL.md's own Hammer-vs-Hanging-Man warning). Other Level 1 patterns
  // (stars, piercing/dark cloud, kicker) are left to the full-reasoning pass.
  const closed = candles.slice(0, -1);
  if (closed.length < 10) return null;
  const prev = closed[closed.length - 2];
  const last = closed[closed.length - 1];
  const trendWindow = closed.slice(-6, -1).map((c) => c.close);
  const priorTrendUp = trendWindow[trendWindow.length - 1] > trendWindow[0];
  const priorTrendDown = trendWindow[trendWindow.length - 1] < trendWindow[0];

  const prevBearish = prev.close < prev.open;
  const lastBullish = last.close > last.open;
  const bullishEngulf = prevBearish && lastBullish && last.open <= prev.close && last.close >= prev.open;
  if (bullishEngulf && priorTrendDown) {
    return {
      pair,
      agent: 'candlestick-trader',
      reason: 'Bullish Engulfing after a short downtrend (Level 1 reversal pattern)',
      data: { prevOpen: prev.open, prevClose: prev.close, lastOpen: last.open, lastClose: last.close },
    };
  }

  const prevBullish = prev.close > prev.open;
  const lastBearish = last.close < last.open;
  const bearishEngulf = prevBullish && lastBearish && last.open >= prev.close && last.close <= prev.open;
  if (bearishEngulf && priorTrendUp) {
    return {
      pair,
      agent: 'candlestick-trader',
      reason: 'Bearish Engulfing after a short uptrend (Level 1 reversal pattern)',
      data: { prevOpen: prev.open, prevClose: prev.close, lastOpen: last.open, lastClose: last.close },
    };
  }
  return null;
}

async function main() {
  const results = await Promise.allSettled(
    PAIRS.map(async (pair) => {
      const candles = await fetchOhlcv(pair, '15m', 60);
      const snapshot = computeSnapshot(pair, candles);
      return { pair, candles, snapshot };
    })
  );

  const candidates: Candidate[] = [];
  const errors: string[] = [];
  const closesByPair = new Map<string, number[]>();

  for (const r of results) {
    if (r.status === 'rejected') {
      errors.push(String(r.reason));
      continue;
    }
    const { pair, candles, snapshot } = r.value;
    if (!snapshot) continue;

    const closed = candles.slice(0, -1);
    closesByPair.set(pair, closed.map((c) => c.close));

    for (const check of [checkMomentumTrader, checkJesseLivermore, checkMeanReversionTrader, checkBreakoutSpecialist]) {
      const c = check(snapshot);
      if (c) candidates.push(c);
    }
    const smcCandidate = checkSmcTrader(pair, candles);
    if (smcCandidate) candidates.push(smcCandidate);

    const volCandidate = checkVolatilityAnalyst(pair, closesByPair.get(pair)!);
    if (volCandidate) candidates.push(volCandidate);

    for (const check of [checkWyckoffTrader, checkSupplyDemandTrader, checkFibonacciTrader, checkCandlestickTrader]) {
      const c = check(pair, candles);
      if (c) candidates.push(c);
    }
  }

  candidates.push(...checkPairsTrader(closesByPair));

  const summary = {
    timestamp: new Date().toISOString(),
    pairsScanned: PAIRS.length,
    candidates,
    errors,
  };

  const outPath = path.join(process.cwd(), '.desk', 'latest-scan.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error('scan-signals failed:', e);
  process.exit(1);
});
