import type { TechnicalSnapshot } from '@/lib/technical';
import type { SmcSnapshot } from '@/lib/smc';
import type { FibonacciSnapshot } from '@/lib/fibonacci';
import type { BreakoutSnapshot } from '@/lib/breakout';
import type { CompositeAnalysis, TradingPlan } from '@/lib/analysis-score';

function fmt(v: number): string {
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString('id-ID');
  return v.toLocaleString('id-ID', { maximumFractionDigits: 6 });
}

function buildSummary(
  symbol: string,
  name: string,
  t: TechnicalSnapshot,
  smc: SmcSnapshot,
  fib: FibonacciSnapshot,
  breakout: BreakoutSnapshot,
  composite: CompositeAnalysis,
  plan: TradingPlan
): { summary: string; structure: string; levels: string } {
  const direction = composite.bias === 'bullish' ? 'cenderung naik' : composite.bias === 'bearish' ? 'cenderung turun' : 'belum memiliki arah dominan';
  const summary = `${name} (${symbol.toUpperCase()}/IDR) ${direction}. EMA menunjukkan tren ${t.trend}, RSI berada di ${t.rsi14.toFixed(1)}, dan ${t.trending ? 'tren memiliki kekuatan yang cukup' : 'pasar masih cenderung bergerak dalam range'}.`;
  const structure = breakout.state === 'no-breakout'
    ? `Belum ada breakout yang jelas. Struktur SMC terbaca ${smc.structure} pada zona ${smc.zone}.`
    : `Struktur terakhir: ${breakout.state.replaceAll('-', ' ')} di sekitar Rp${fmt(breakout.level)}. SMC terbaca ${smc.structure} pada zona ${smc.zone}.`;
  const levels = `Level terdekat: Fibonacci ${fib.nearestLevel.label} di Rp${fmt(fib.nearestLevel.price)}. Support Rp${fmt(t.support20)} dan resistance Rp${fmt(t.resistance20)}. ${plan.reasoning}`;
  return { summary, structure, levels };
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
  const analysis = buildSummary(symbol, name, snapshot, smc, fib, breakout, composite, plan);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <div>
        <h3 className="font-sans text-lg font-semibold text-ink">Ringkasan Berbasis Indikator</h3>
        <p className="mt-1 font-sans text-xs text-ink-muted">Dihitung dari data harga saat ini, tanpa pemanggilan AI.</p>
      </div>
      <div className="space-y-3 font-sans text-sm leading-relaxed text-ink-muted">
        <p>{analysis.summary}</p>
        <p>{analysis.structure}</p>
        <p>{analysis.levels}</p>
      </div>
    </div>
  );
}
