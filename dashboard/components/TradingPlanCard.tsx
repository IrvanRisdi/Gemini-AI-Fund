import { StatBadge } from './StatBadge';
import type { TradingPlan } from '@/lib/analysis-score';

function fmt(value: number): string {
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString('id-ID');
  return value.toLocaleString('id-ID', { maximumFractionDigits: 6 });
}

export function TradingPlanCard({ plan }: { plan: TradingPlan }) {
  const biasTone = plan.bias === 'bullish' ? 'positive' : plan.bias === 'bearish' ? 'negative' : 'neutral';
  const isActionable = plan.verdict === 'trade' || plan.verdict === 'conditional';
  const status = plan.verdict === 'trade' ? 'setup aktif' : plan.verdict === 'conditional' ? 'menunggu konfirmasi' : 'belum ada setup';

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-lg font-semibold text-ink">Rencana Trading</h3>
        <div className="flex items-center gap-1.5">
          <StatBadge tone={biasTone}>{plan.bias === 'bullish' ? 'bullish' : plan.bias === 'bearish' ? 'bearish' : 'netral'}</StatBadge>
          <StatBadge tone={plan.verdict === 'trade' ? 'accent' : 'warning'}>{status}</StatBadge>
        </div>
      </div>

      <p className="font-sans text-sm leading-relaxed text-ink-muted italic">{plan.reasoning}</p>

      {isActionable && plan.entryZone && plan.stop != null && plan.target1 != null && plan.target2 != null && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-lg border border-accent-bg bg-accent-bg px-3 py-2.5">
            <span className="block font-mono text-[10px] tracking-wide text-accent uppercase">Entry Zone</span>
            <span className="font-mono text-sm font-semibold text-ink">
              {fmt(plan.entryZone[0])}–{fmt(plan.entryZone[1])}
            </span>
          </div>
          <div className="rounded-lg border border-negative-bg bg-negative-bg px-3 py-2.5">
            <span className="block font-mono text-[10px] tracking-wide text-negative uppercase">Stop</span>
            <span className="font-mono text-sm font-semibold text-ink">{fmt(plan.stop)}</span>
          </div>
          <div className="rounded-lg border border-positive-bg bg-positive-bg px-3 py-2.5">
            <span className="block font-mono text-[10px] tracking-wide text-positive uppercase">Target 1</span>
            <span className="font-mono text-sm font-semibold text-ink">{fmt(plan.target1)}</span>
            <span className="block font-mono text-[10px] text-ink-muted">R:R {plan.riskRewardT1?.toFixed(2)}</span>
          </div>
          <div className="rounded-lg border border-positive-bg bg-positive-bg px-3 py-2.5">
            <span className="block font-mono text-[10px] tracking-wide text-positive uppercase">Target 2</span>
            <span className="font-mono text-sm font-semibold text-ink">{fmt(plan.target2)}</span>
            <span className="block font-mono text-[10px] text-ink-muted">R:R {plan.riskRewardT2?.toFixed(2)}</span>
          </div>
        </div>
      )}

      <p className="font-mono text-[10px] text-ink-faint">
        Rencana berbasis indikator dan struktur harga. Bukan rekomendasi keuangan atau sinyal trading langsung.
      </p>
    </div>
  );
}
