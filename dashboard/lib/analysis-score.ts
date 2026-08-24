import type { BadgeTone } from '@/components/StatBadge';
import type { TechnicalSnapshot } from './technical';
import type { SmcSnapshot } from './smc';
import type { FibonacciSnapshot } from './fibonacci';
import type { BreakoutSnapshot } from './breakout';

export interface AnalysisVerdict {
  key: string;
  title: string;
  label: string;
  tone: BadgeTone;
  score: -1 | 0 | 1;
  detail: string;
}

function toneFromScore(score: -1 | 0 | 1): BadgeTone {
  return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
}

export function scoreMovingAverage(t: TechnicalSnapshot): AnalysisVerdict {
  const strongBull = t.trend === 'bullish' && t.close > t.ema9;
  const strongBear = t.trend === 'bearish' && t.close < t.ema9;
  const score: -1 | 0 | 1 = strongBull ? 1 : strongBear ? -1 : 0;
  const label = strongBull ? 'Bullish alignment' : strongBear ? 'Bearish alignment' : 'Mixed';
  const detail = strongBull
    ? `Price is above EMA(9), and EMA(9) is above EMA(21) — a clean bullish stack.`
    : strongBear
      ? `Price is below EMA(9), and EMA(9) is below EMA(21) — a clean bearish stack.`
      : `EMA(9)/EMA(21) and price aren't cleanly aligned — no trend edge from moving averages right now.`;
  return { key: 'ma', title: 'Moving Average', label, tone: toneFromScore(score), score, detail };
}

export function scoreRsi(t: TechnicalSnapshot): AnalysisVerdict {
  const score: -1 | 0 | 1 = t.rsiSignal === 'oversold' ? 1 : t.rsiSignal === 'overbought' ? -1 : 0;
  const label = t.rsiSignal === 'oversold' ? 'Oversold' : t.rsiSignal === 'overbought' ? 'Overbought' : 'Neutral';
  const detail =
    t.rsiSignal === 'oversold'
      ? `RSI(14) = ${t.rsi14.toFixed(1)}, below 30 — stretched to the downside, a bounce is statistically more likely from here.`
      : t.rsiSignal === 'overbought'
        ? `RSI(14) = ${t.rsi14.toFixed(1)}, above 70 — stretched to the upside, a pullback is statistically more likely from here.`
        : `RSI(14) = ${t.rsi14.toFixed(1)} — no extreme, doesn't favor either side on its own.`;
  return { key: 'rsi', title: 'RSI', label, tone: toneFromScore(score), score, detail };
}

export function scoreBreakout(b: BreakoutSnapshot): AnalysisVerdict {
  let score: -1 | 0 | 1 = 0;
  let label = 'No break';
  let detail = 'Price hasn\'t cleared a meaningful structural level in either direction recently.';

  switch (b.state) {
    case 'breakout-up-confirmed':
      score = 1;
      label = 'Breakout up, holding';
      detail = `Closed above the prior structural high (${b.breakoutVolRatio.toFixed(1)}x volume) ${b.barsSinceBreakout} bars ago and hasn't come back to retest yet.`;
      break;
    case 'retesting-up':
      score = 1;
      label = 'Retesting breakout, holding';
      detail = `Pulled back to within ${b.retestDistancePct?.toFixed(2)}% of the broken level and is still holding above it — a textbook breakout-and-retest.`;
      break;
    case 'failed-breakout-up':
      score = -1;
      label = 'Failed breakout (fakeout up)';
      detail = `Broke the prior high but has closed back below it — a likely fakeout, which is itself a bearish tell.`;
      break;
    case 'breakout-down-confirmed':
      score = -1;
      label = 'Breakdown, holding';
      detail = `Closed below the prior structural low (${b.breakoutVolRatio.toFixed(1)}x volume) ${b.barsSinceBreakout} bars ago and hasn't reclaimed it.`;
      break;
    case 'retesting-down':
      score = -1;
      label = 'Retesting breakdown, holding';
      detail = `Pulled back to within ${b.retestDistancePct?.toFixed(2)}% of the broken level from below and is still rejecting it — a textbook breakdown-and-retest.`;
      break;
    case 'failed-breakout-down':
      score = 1;
      label = 'Failed breakdown (fakeout down)';
      detail = `Broke the prior low but has closed back above it — a likely fakeout to the downside, which is itself a bullish tell.`;
      break;
  }

  return { key: 'breakout', title: 'Breakout Structure', label, tone: toneFromScore(score), score, detail };
}

export function scoreSmc(s: SmcSnapshot): AnalysisVerdict {
  let score: -1 | 0 | 1 = 0;
  let label = 'No confluence';
  let detail = 'Structure and zone aren\'t lining up into a setup this framework would act on yet.';

  if (s.choch === 'bullish') {
    score = 1;
    label = 'CHoCH bullish';
    detail = `Price closed back above the last swing high after a downtrend — a change of character, the framework's highest-value bullish signal.`;
  } else if (s.choch === 'bearish') {
    score = -1;
    label = 'CHoCH bearish';
    detail = `Price closed back below the last swing low after an uptrend — a change of character, the framework's highest-value bearish signal.`;
  } else if (s.structure === 'uptrend' && s.zone === 'discount') {
    score = 1;
    label = 'Uptrend, discount zone';
    detail = `Structure reads HH+HL (uptrend) and price sits in the discount half of the range — the coherent zone this framework looks for longs in.${s.sweep?.type === 'sell-side' ? ' A sell-side sweep just printed too.' : ''}`;
  } else if (s.structure === 'downtrend' && s.zone === 'premium') {
    score = -1;
    label = 'Downtrend, premium zone';
    detail = `Structure reads LH+LL (downtrend) and price sits in the premium half of the range — the coherent zone this framework looks for shorts in.${s.sweep?.type === 'buy-side' ? ' A buy-side sweep just printed too.' : ''}`;
  } else {
    detail = `Structure reads ${s.structure}, zone reads ${s.zone} — that combination isn't the framework's setup (it wants uptrend+discount for longs, downtrend+premium for shorts).`;
  }

  return { key: 'smc', title: 'Smart Money Concept', label, tone: toneFromScore(score), score, detail };
}

export function scoreFibonacci(f: FibonacciSnapshot): AnalysisVerdict {
  const inZone = f.inGoldenPocket || (f.nearestLevel.ratio >= 0.5 && f.nearestLevel.ratio <= 0.786 && f.distanceToNearestPct < 1);
  let score: -1 | 0 | 1 = 0;
  let label = 'No reaction zone';
  let detail = `Nearest level is the ${f.nearestLevel.label} retracement, ${f.distanceToNearestPct.toFixed(2)}% away — not currently sitting in a high-probability reaction zone.`;

  if (inZone && f.direction === 'retracing-down') {
    score = 1;
    label = f.inGoldenPocket ? 'In golden pocket (61.8–65%)' : 'In 50–78.6% retracement zone';
    detail = `Price has retraced into the ${f.nearestLevel.label} level of the recent up-leg — the classic zone for a bullish continuation reaction.`;
  } else if (inZone && f.direction === 'retracing-up') {
    score = -1;
    label = f.inGoldenPocket ? 'In golden pocket (61.8–65%)' : 'In 50–78.6% retracement zone';
    detail = `Price has retraced into the ${f.nearestLevel.label} level of the recent down-leg — the classic zone for a bearish continuation reaction.`;
  }

  return { key: 'fib', title: 'Fibonacci', label, tone: toneFromScore(score), score, detail };
}

export interface CompositeAnalysis {
  verdicts: AnalysisVerdict[];
  totalScore: number;
  bias: 'bullish' | 'bearish' | 'neutral';
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  /** How many of the 5 factors support the composite bias (0 for a neutral bias — there's no dominant side to align on). */
  alignedCount: number;
}

export function computeComposite(verdicts: AnalysisVerdict[]): CompositeAnalysis {
  const totalScore = verdicts.reduce((sum, v) => sum + v.score, 0);
  const bullishCount = verdicts.filter((v) => v.score > 0).length;
  const bearishCount = verdicts.filter((v) => v.score < 0).length;
  const neutralCount = verdicts.length - bullishCount - bearishCount;
  const bias: CompositeAnalysis['bias'] = totalScore >= 2 ? 'bullish' : totalScore <= -2 ? 'bearish' : 'neutral';
  const alignedCount = bias === 'bullish' ? bullishCount : bias === 'bearish' ? bearishCount : 0;
  return { verdicts, totalScore, bias, bullishCount, bearishCount, neutralCount, alignedCount };
}

export interface TradingPlan {
  bias: 'bullish' | 'bearish' | 'neutral';
  verdict: 'trade' | 'wait';
  reasoning: string;
  entryZone?: [number, number];
  stop?: number;
  target1?: number;
  target2?: number;
  riskRewardT1?: number;
  riskRewardT2?: number;
}

export function buildTradingPlan(
  composite: CompositeAnalysis,
  tech: TechnicalSnapshot,
  smc: SmcSnapshot,
  fib: FibonacciSnapshot,
  breakout: BreakoutSnapshot
): TradingPlan {
  const { bias, alignedCount, bullishCount, bearishCount, neutralCount } = composite;

  if (bias === 'neutral') {
    return {
      bias,
      verdict: 'wait',
      reasoning: `Signals are mixed, not aligned — ${bullishCount} bullish, ${bearishCount} bearish, ${neutralCount} neutral, with no dominant direction (composite score ${composite.totalScore >= 0 ? '+' : ''}${composite.totalScore}). Wait for the factors to actually agree rather than trading a coin-flip.`,
    };
  }

  if (alignedCount < 3) {
    return {
      bias,
      verdict: 'wait',
      reasoning: `Only ${alignedCount}/5 analyses support the ${bias} case — that's below the 3-of-5 confluence bar this desk's agents require before sizing a trade. Wait for more alignment rather than forcing an entry.`,
    };
  }

  const close = tech.close;

  if (bias === 'bullish') {
    const stopCandidates = [tech.support20, smc.swingLow.price, fib.direction === 'retracing-down' ? fib.levels.find((l) => l.ratio === 0.786)?.price : undefined].filter(
      (v): v is number => typeof v === 'number' && v < close
    );
    const stop = (stopCandidates.length ? Math.max(...stopCandidates) : close - tech.atr14 * 2) - tech.atr14 * 0.3;
    const entryHigh = close;
    const entryLow = Math.max(stop + tech.atr14 * 0.3, Math.min(close, breakout.level));
    const target1 = tech.resistance20 > close ? tech.resistance20 : close + (close - stop) * 1.5;
    const target2 = close + (target1 - close) * 1.8;

    return {
      bias,
      verdict: 'trade',
      reasoning: `${alignedCount}/5 analyses align bullish — moving average trend, RSI, breakout structure, SMC zone/CHoCH, and Fibonacci positioning are pointing the same direction. This is the kind of confluence this desk's agents would size a real entry on.`,
      entryZone: [Math.min(entryLow, entryHigh), Math.max(entryLow, entryHigh)],
      stop,
      target1,
      target2,
      riskRewardT1: (target1 - close) / (close - stop),
      riskRewardT2: (target2 - close) / (close - stop),
    };
  }

  // bearish
  const stopCandidates = [tech.resistance20, smc.swingHigh.price, fib.direction === 'retracing-up' ? fib.levels.find((l) => l.ratio === 0.786)?.price : undefined].filter(
    (v): v is number => typeof v === 'number' && v > close
  );
  const stop = (stopCandidates.length ? Math.min(...stopCandidates) : close + tech.atr14 * 2) + tech.atr14 * 0.3;
  const entryLow = close;
  const entryHigh = Math.min(stop - tech.atr14 * 0.3, Math.max(close, breakout.level));
  const target1 = tech.support20 < close ? tech.support20 : close - (stop - close) * 1.5;
  const target2 = close - (close - target1) * 1.8;

  return {
    bias,
    verdict: 'trade',
    reasoning: `${alignedCount}/5 analyses align bearish — moving average trend, RSI, breakout structure, SMC zone/CHoCH, and Fibonacci positioning are pointing the same direction. This is the kind of confluence this desk's agents would size a real entry on.`,
    entryZone: [Math.min(entryLow, entryHigh), Math.max(entryLow, entryHigh)],
    stop,
    target1,
    target2,
    riskRewardT1: (close - target1) / (stop - close),
    riskRewardT2: (close - target2) / (stop - close),
  };
}
