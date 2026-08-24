import { StatBadge } from './StatBadge';
import type { AnalysisVerdict, CompositeAnalysis } from '@/lib/analysis-score';

function VerdictCard({ v }: { v: AnalysisVerdict }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg/60 p-3.5">
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs font-medium text-ink-muted">{v.title}</span>
        <StatBadge tone={v.tone}>{v.label}</StatBadge>
      </div>
      <p className="font-sans text-xs leading-relaxed text-ink-muted italic">{v.detail}</p>
    </div>
  );
}

export function AnalysisGrid({ composite }: { composite: CompositeAnalysis }) {
  const biasTone = composite.bias === 'bullish' ? 'positive' : composite.bias === 'bearish' ? 'negative' : 'neutral';

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-lg font-semibold text-ink">Multi-Factor Analysis</h3>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-ink-muted">
            {composite.bias === 'neutral'
              ? `${composite.bullishCount} bull · ${composite.bearishCount} bear · ${composite.neutralCount} neutral`
              : `${composite.alignedCount}/5 aligned`}
          </span>
          <StatBadge tone={biasTone}>{composite.bias}</StatBadge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {composite.verdicts.map((v) => (
          <VerdictCard key={v.key} v={v} />
        ))}
      </div>
    </div>
  );
}
