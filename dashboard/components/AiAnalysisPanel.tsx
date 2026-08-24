'use client';

import { useEffect, useRef, useState } from 'react';
import { CodeBlock } from './CodeBlock';
import type { TechnicalSnapshot } from '@/lib/technical';
import type { SmcSnapshot } from '@/lib/smc';
import type { FibonacciSnapshot } from '@/lib/fibonacci';
import type { BreakoutSnapshot } from '@/lib/breakout';
import type { CompositeAnalysis, TradingPlan } from '@/lib/analysis-score';

const LINE_DELAY_MS = 90;

function fmt(v: number): string {
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString('id-ID');
  return v.toLocaleString('id-ID', { maximumFractionDigits: 6 });
}

/**
 * Placeholder narrative built entirely from real, already-computed
 * technical/structure numbers — no LLM is connected. Swap this for a real
 * `fetch('/api/ai-analysis', ...)` call to Claude once a backend exists.
 */
function buildNarrative(
  symbol: string,
  name: string,
  t: TechnicalSnapshot,
  smc: SmcSnapshot,
  fib: FibonacciSnapshot,
  breakout: BreakoutSnapshot,
  composite: CompositeAnalysis,
  plan: TradingPlan
): string[] {
  const lines: string[] = [];
  lines.push(`# ${name} (${symbol.toUpperCase()}/IDR) — full analysis`);
  lines.push('');

  lines.push('## Trend & Momentum');
  lines.push(
    `EMA(9)/EMA(21) read ${t.trend}, ADX(14) = ${t.adx14.toFixed(1)} (${t.trending ? 'confirmed trend' : 'range-bound'}), RSI(14) = ${t.rsi14.toFixed(1)} (${t.rsiSignal}).`
  );
  lines.push('');

  lines.push('## Breakout & Retest');
  if (breakout.state === 'no-breakout') {
    lines.push('No structural break in either direction over the recent window — price is trading inside its established range.');
  } else {
    const dir = breakout.state.includes('up') ? 'above' : 'below';
    const failed = breakout.state.startsWith('failed');
    lines.push(
      `Price ${failed ? 'attempted a break' : 'broke'} ${dir} Rp${fmt(breakout.level)} ${breakout.barsSinceBreakout} bars ago on ${breakout.breakoutVolRatio.toFixed(1)}x volume.${
        failed
          ? ' That break has since failed — a classic fakeout, and a tell in the opposite direction.'
          : breakout.retestDistancePct != null && breakout.retestDistancePct < 0.5
            ? ` It's now retesting that level from the ${dir === 'above' ? 'top' : 'bottom'} side and holding — the textbook retest-and-continuation pattern.`
            : ' It has not come back to retest that level yet.'
      }`
    );
  }
  lines.push('');

  lines.push('## Smart Money Concept');
  lines.push(
    `Structure reads ${smc.structure}. Price sits in the ${smc.zone} zone (equilibrium Rp${fmt(smc.equilibrium)}).${
      smc.sweep ? ` A ${smc.sweep.type} liquidity sweep just printed at Rp${fmt(smc.sweep.poolPrice)} (${smc.sweep.volRatio.toFixed(1)}x volume).` : ' No liquidity sweep this bar.'
    }${smc.choch ? ` A ${smc.choch} change of character (CHoCH) just confirmed — the framework's highest-conviction signal.` : ''}`
  );
  if (smc.bullishOB || smc.bearishOB) {
    const obParts: string[] = [];
    if (smc.bullishOB) obParts.push(`bullish OB at Rp${fmt(smc.bullishOB.low)}–${fmt(smc.bullishOB.high)}`);
    if (smc.bearishOB) obParts.push(`bearish OB at Rp${fmt(smc.bearishOB.low)}–${fmt(smc.bearishOB.high)}`);
    lines.push(`Unmitigated order blocks in range: ${obParts.join(', ')}.${smc.inOte ? ' Price is currently inside the 61.8–79% OTE zone.' : ''}`);
  }
  lines.push('');

  lines.push('## Fibonacci');
  lines.push(
    `${fib.direction === 'retracing-down' ? 'Retracing down from' : 'Retracing up from'} the Rp${fmt(fib.swingLowPrice)}–Rp${fmt(fib.swingHighPrice)} swing. Nearest level: ${fib.nearestLevel.label} (Rp${fmt(fib.nearestLevel.price)}, ${fib.distanceToNearestPct.toFixed(2)}% away).${
      fib.inGoldenPocket ? ' Currently sitting inside the golden pocket (61.8–65%) — the tightest, highest-probability reaction zone.' : ''
    }`
  );
  lines.push('');

  lines.push('## Composite Read');
  lines.push(
    composite.bias === 'neutral'
      ? `${composite.bullishCount} bullish, ${composite.bearishCount} bearish, ${composite.neutralCount} neutral — no dominant direction (score ${composite.totalScore >= 0 ? '+' : ''}${composite.totalScore}).`
      : `${composite.alignedCount}/5 factors align ${composite.bias} (score ${composite.totalScore >= 0 ? '+' : ''}${composite.totalScore}).`
  );
  lines.push('');
  lines.push('## Trading Plan');
  lines.push(plan.reasoning);
  if (plan.verdict === 'trade' && plan.entryZone) {
    lines.push(
      `Entry Rp${fmt(plan.entryZone[0])}–Rp${fmt(plan.entryZone[1])} · Stop Rp${fmt(plan.stop!)} · T1 Rp${fmt(plan.target1!)} (R:R ${plan.riskRewardT1?.toFixed(2)}) · T2 Rp${fmt(plan.target2!)} (R:R ${plan.riskRewardT2?.toFixed(2)})`
    );
  }
  lines.push('');
  lines.push('// Placeholder analysis generated from real indicator/structure values — no LLM is wired up yet. Not financial advice.');

  return lines;
}

export function AiAnalysisPanel({
  symbol,
  name,
  snapshot,
  smc,
  fib,
  breakout,
  composite,
  plan,
}: {
  symbol: string;
  name: string;
  snapshot: TechnicalSnapshot;
  smc: SmcSnapshot;
  fib: FibonacciSnapshot;
  breakout: BreakoutSnapshot;
  composite: CompositeAnalysis;
  plan: TradingPlan;
}) {
  const [displayed, setDisplayed] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const lines = buildNarrative(symbol, name, snapshot, smc, fib, breakout, composite, plan);
    let i = 0;
    setDisplayed('');
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      i += 1;
      setDisplayed(lines.slice(0, i).join('\n'));
      if (i >= lines.length && timerRef.current) clearInterval(timerRef.current);
    }, LINE_DELAY_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-lg font-semibold text-ink">AI Analysis</h3>
        <span className="rounded-full bg-accent-bg px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide text-accent uppercase">
          preview
        </span>
      </div>
      <CodeBlock filename={`${symbol}-analysis.md`} language="text" code={displayed} />
    </div>
  );
}
