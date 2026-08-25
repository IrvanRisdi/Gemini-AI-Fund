'use client';

import { useMemo, useState } from 'react';
import type { OHLCV } from '@/lib/indicators';
import { formatWibDate, formatWibDateTime } from '@/lib/time';

const WIDTH = 800;
const HEIGHT = 300;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 24;

function formatPrice(value: number): string {
  if (value >= 1000) return Math.round(value).toLocaleString('id-ID');
  return value.toLocaleString('id-ID', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

function formatTime(ts: number, timeframe: string): string {
  return timeframe === 'Daily' ? formatWibDate(ts) : formatWibDateTime(ts);
}

export function PriceChart({ candles, timeframe }: { candles: OHLCV[]; timeframe: string }) {
  const [hover, setHover] = useState<number | null>(null);

  const { bars, minPrice, maxPrice } = useMemo(() => {
    if (candles.length === 0) return { bars: [], minPrice: 0, maxPrice: 0 };

    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const range = max - min || 1;
    const chartHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
    const slotWidth = WIDTH / candles.length;
    const bodyWidth = Math.max(1, slotWidth * 0.6);

    const y = (price: number) => PADDING_TOP + chartHeight - ((price - min) / range) * chartHeight;

    const computed = candles.map((c, i) => {
      const x = i * slotWidth + slotWidth / 2;
      const bullish = c.close >= c.open;
      const bodyTop = y(Math.max(c.open, c.close));
      const bodyBottom = y(Math.min(c.open, c.close));
      return {
        x,
        wickY1: y(c.high),
        wickY2: y(c.low),
        bodyTop,
        bodyHeight: Math.max(1, bodyBottom - bodyTop),
        bodyWidth,
        bullish,
        candle: c,
      };
    });

    return { bars: computed, minPrice: min, maxPrice: max };
  }, [candles]);

  const hovered = hover != null ? bars[hover] : null;

  if (bars.length === 0) {
    return <p className="py-12 text-center font-sans text-sm text-ink-muted">No candle data to chart.</p>;
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
          const idx = Math.min(bars.length - 1, Math.max(0, Math.floor(relX / (WIDTH / bars.length))));
          setHover(idx);
        }}
      >
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={0}
            x2={WIDTH}
            y1={PADDING_TOP + (HEIGHT - PADDING_TOP - PADDING_BOTTOM) * frac}
            y2={PADDING_TOP + (HEIGHT - PADDING_TOP - PADDING_BOTTOM) * frac}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        ))}

        {bars.map((b, i) => (
          <g key={i} opacity={hover == null || hover === i ? 1 : 0.55}>
            <line
              x1={b.x}
              x2={b.x}
              y1={b.wickY1}
              y2={b.wickY2}
              stroke={b.bullish ? 'var(--color-positive)' : 'var(--color-negative)'}
              strokeWidth={1}
            />
            <rect
              x={b.x - b.bodyWidth / 2}
              y={b.bodyTop}
              width={b.bodyWidth}
              height={b.bodyHeight}
              fill={b.bullish ? 'var(--color-positive)' : 'var(--color-negative)'}
            />
          </g>
        ))}

        {hovered && (
          <line x1={hovered.x} x2={hovered.x} y1={0} y2={HEIGHT} stroke="var(--color-ink-faint)" strokeWidth={1} strokeDasharray="3,3" />
        )}
      </svg>

      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-faint">
        <span>Rp{formatPrice(minPrice)}</span>
        <span>Rp{formatPrice(maxPrice)}</span>
      </div>

      {hovered && (
        <div className="pointer-events-none absolute top-2 right-2 rounded-lg border border-border bg-bg/95 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink shadow-lg">
          <div className="text-ink-muted">{formatTime(hovered.candle.timestamp, timeframe)}</div>
          <div>
            O <span className="text-ink">Rp{formatPrice(hovered.candle.open)}</span>
          </div>
          <div>
            H <span className="text-positive">Rp{formatPrice(hovered.candle.high)}</span>
          </div>
          <div>
            L <span className="text-negative">Rp{formatPrice(hovered.candle.low)}</span>
          </div>
          <div>
            C <span className="text-ink">Rp{formatPrice(hovered.candle.close)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
