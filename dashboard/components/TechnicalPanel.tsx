import { StatBadge, type BadgeTone } from './StatBadge';
import type { TechnicalSnapshot } from '@/lib/technical';

function fmt(value: number): string {
  const maximumFractionDigits = Math.abs(value) >= 1000 ? 2 : Math.abs(value) >= 1 ? 4 : 8;
  return value.toLocaleString('en-US', { maximumFractionDigits });
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: BadgeTone }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-bg/60 px-3 py-2.5">
      <span className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">{label}</span>
      <span className={`font-mono text-sm font-semibold ${tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : tone === 'warning' ? 'text-warning' : 'text-ink'}`}>
        {value}
      </span>
    </div>
  );
}

export function TechnicalPanel({ snapshot, timeframe }: { snapshot: TechnicalSnapshot; timeframe: string }) {
  const rsiTone: BadgeTone = snapshot.rsiSignal === 'oversold' ? 'positive' : snapshot.rsiSignal === 'overbought' ? 'negative' : 'neutral';
  const trendTone: BadgeTone = snapshot.trend === 'bullish' ? 'positive' : snapshot.trend === 'bearish' ? 'negative' : 'neutral';
  const adxTone: BadgeTone = snapshot.trending ? 'accent' : 'neutral';
  const bias = snapshot.trend === 'bullish' ? 'bullish ringan' : snapshot.trend === 'bearish' ? 'bearish ringan' : 'netral';
  const momentum = snapshot.trending ? 'kekuatan tren terkonfirmasi oleh ADX' : 'kekuatan tren masih terbatas karena ADX rendah';
  const volume = snapshot.volRatio >= 1.2 ? 'volume mendukung pergerakan' : 'volume belum memberi konfirmasi kuat';

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-lg font-semibold text-ink">Analisis Teknikal · {timeframe}</h3>
        <div className="flex gap-1.5">
          <StatBadge tone={trendTone}>{snapshot.trend}</StatBadge>
          <StatBadge tone={rsiTone}>{snapshot.rsiSignal}</StatBadge>
          <StatBadge tone={adxTone}>{snapshot.trending ? 'trending' : 'ranging'}</StatBadge>
        </div>
      </div>

      <div className="rounded-lg border border-accent-bg bg-accent-bg/40 p-3">
        <p className="font-mono text-[10px] tracking-wide text-accent uppercase">Kesimpulan teknis</p>
        <p className="mt-1 font-sans text-sm leading-relaxed text-ink">
          Bias {timeframe} saat ini <span className="font-semibold">{bias}</span>: {momentum}, dan {volume}. Pantau resistance {fmt(snapshot.resistance20)} USDT; skenario ini melemah bila harga ditutup di bawah support {fmt(snapshot.support20)} USDT.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Metric label="RSI(14)" value={snapshot.rsi14.toFixed(1)} tone={rsiTone} />
        <Metric label="ADX(14)" value={snapshot.adx14.toFixed(1)} tone={adxTone} />
        <Metric label="ATR(14)" value={`${fmt(snapshot.atr14)} USDT`} />
        <Metric label="EMA(9)" value={`${fmt(snapshot.ema9)} USDT`} />
        <Metric label="EMA(21)" value={`${fmt(snapshot.ema21)} USDT`} />
        <Metric label="Vol Ratio" value={`${snapshot.volRatio.toFixed(2)}x`} tone={snapshot.volRatio > 1.5 ? 'warning' : undefined} />
        <Metric label="BB Upper" value={`${fmt(snapshot.bbUpper)} USDT`} />
        <Metric label="BB Mid" value={`${fmt(snapshot.bbMid)} USDT`} />
        <Metric label="BB Lower" value={`${fmt(snapshot.bbLower)} USDT`} />
        <Metric label="Resistance(20)" value={`${fmt(snapshot.resistance20)} USDT`} tone="negative" />
        <Metric label="Support(20)" value={`${fmt(snapshot.support20)} USDT`} tone="positive" />
        <Metric label="Close" value={`${fmt(snapshot.close)} USDT`} />
      </div>
    </div>
  );
}
