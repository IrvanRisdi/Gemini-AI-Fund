'use client';

import { useMemo, useState } from 'react';
import type { CompactCandle, StockChartSnapshot } from '@/lib/stock-data';

type Frame = '1m' | '5m' | '15m' | '1h' | '1d' | '1wk';
export type ChartLevel = { label: string; value: number; tone: 'entry' | 'stop' | 'target' };
type Candle = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };

const W = 920, H = 460, LEFT = 14, RIGHT = 74, TOP = 18, PRICE_BOTTOM = 346, VOLUME_TOP = 372, VOLUME_BOTTOM = 430;
const OFFSET = 7 * 60 * 60 * 1000;
const frameMeta: Array<{ id: Frame; label: string }> = [
  { id: '1m', label: '1m' }, { id: '5m', label: '5m' }, { id: '15m', label: '15m' },
  { id: '1h', label: '1H' }, { id: '1d', label: 'Daily' }, { id: '1wk', label: 'Weekly' },
];

function expand(row: CompactCandle): Candle {
  return { timestamp: row[0], open: row[1], high: row[2], low: row[3], close: row[4], volume: row[5] };
}

function aggregate(rows: Candle[], bucket: number, weekly = false): Candle[] {
  const grouped = new Map<number, Candle[]>();
  for (const row of rows) {
    let key: number;
    if (weekly) {
      const shifted = new Date(row.timestamp + OFFSET);
      const mondayOffset = (shifted.getUTCDay() + 6) % 7;
      key = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - mondayOffset) - OFFSET;
    } else {
      key = Math.floor((row.timestamp + OFFSET) / bucket) * bucket - OFFSET;
    }
    const group = grouped.get(key);
    if (group) group.push(row); else grouped.set(key, [row]);
  }
  return [...grouped.entries()].map(([timestamp, group]) => ({
    timestamp, open: group[0].open, high: Math.max(...group.map((row) => row.high)),
    low: Math.min(...group.map((row) => row.low)), close: group.at(-1)!.close,
    volume: group.reduce((sum, row) => sum + row.volume, 0),
  })).sort((a, b) => a.timestamp - b.timestamp);
}

function ema(rows: Candle[], period = 20) {
  const multiplier = 2 / (period + 1), output: number[] = [];
  rows.forEach((row, index) => output.push(index ? (row.close - output[index - 1]) * multiplier + output[index - 1] : row.close));
  return output;
}

function vwap(rows: Candle[]) {
  let currentDay = '', totalVolume = 0, totalValue = 0;
  return rows.map((row) => {
    const day = new Date(row.timestamp + OFFSET).toISOString().slice(0, 10);
    if (day !== currentDay) { currentDay = day; totalVolume = 0; totalValue = 0; }
    totalVolume += row.volume;
    totalValue += ((row.high + row.low + row.close) / 3) * row.volume;
    return totalVolume ? totalValue / totalVolume : row.close;
  });
}

const price = (value: number) => value.toLocaleString('id-ID', { maximumFractionDigits: 2 });
const volume = (value: number) => value >= 1e9 ? `${(value / 1e9).toFixed(1)}B` : value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(1)}K` : String(Math.round(value));
const when = (timestamp: number, daily: boolean) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: daily ? '2-digit' : undefined, hour: daily ? undefined : '2-digit', minute: daily ? undefined : '2-digit' }).format(timestamp);

export function StockPriceChart({ snapshot, levels }: { snapshot: StockChartSnapshot | null; levels: ChartLevel[] }) {
  const base5 = useMemo(() => (snapshot?.timeframes['5m']?.candles ?? []).map(expand), [snapshot]);
  const baseDaily = useMemo(() => (snapshot?.timeframes['1d']?.candles ?? []).map(expand), [snapshot]);
  const frames = useMemo<Record<Frame, Candle[]>>(() => ({
    '1m': [], '5m': base5, '15m': aggregate(base5, 15 * 60_000), '1h': aggregate(base5, 60 * 60_000),
    '1d': baseDaily, '1wk': aggregate(baseDaily, 7 * 24 * 60 * 60_000, true),
  }), [base5, baseDaily]);
  const initial: Frame = base5.length ? '5m' : baseDaily.length ? '1d' : '5m';
  const [active, setActive] = useState<Frame>(initial);
  const [visible, setVisible] = useState(80);
  const [hover, setHover] = useState<number | null>(null);
  const candles = frames[active].slice(-visible);
  const intraday = active === '5m' || active === '15m' || active === '1h';
  const source = intraday ? snapshot?.timeframes['5m'] : snapshot?.timeframes['1d'];
  const computed = useMemo(() => {
    if (!candles.length) return null;
    const rawLow = Math.min(...candles.map((row) => row.low)), rawHigh = Math.max(...candles.map((row) => row.high));
    const padding = Math.max((rawHigh - rawLow) * 0.08, rawHigh * 0.005, 1);
    const min = rawLow - padding, max = rawHigh + padding, span = max - min;
    const chartWidth = W - LEFT - RIGHT, slot = chartWidth / candles.length;
    const y = (value: number) => TOP + (PRICE_BOTTOM - TOP) * (1 - (value - min) / span);
    const maxVolume = Math.max(...candles.map((row) => row.volume), 1);
    const average = ema(candles), weighted = intraday ? vwap(candles) : [];
    return { min, max, slot, y, maxVolume, average, weighted };
  }, [candles, intraday]);
  const hovered = hover == null ? null : candles[hover];

  if (!snapshot || (!base5.length && !baseDaily.length)) return <div className="py-16 text-center"><p className="text-sm font-semibold text-warning">Chart belum dipublikasikan untuk ticker ini</p><p className="mt-2 text-xs text-ink-faint">Collector akan mengisinya saat ticker masuk batch intraday atau setelah daily maintenance.</p></div>;

  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <nav className="flex flex-wrap gap-1" aria-label="Pilih timeframe saham">{frameMeta.map((frame) => { const disabled = !frames[frame.id].length; return <button key={frame.id} type="button" disabled={disabled} onClick={() => { setActive(frame.id); setHover(null); }} className={`rounded-md border px-3 py-1.5 font-mono text-xs ${active === frame.id ? 'border-accent bg-accent-bg text-accent' : disabled ? 'cursor-not-allowed border-border text-ink-faint opacity-40' : 'border-border text-ink-muted hover:text-ink'}`} title={frame.id === '1m' ? 'Yahoo delayed-paper belum menyediakan snapshot 1 menit' : disabled ? 'Timeframe belum tersedia pada snapshot' : undefined}>{frame.label}</button>; })}</nav>
      <div className="flex items-center gap-2"><span className="font-mono text-[10px] uppercase text-ink-faint">Tampilkan</span>{[40, 80, 120].map((count) => <button key={count} type="button" onClick={() => setVisible(count)} className={`rounded px-2 py-1 font-mono text-[10px] ${visible === count ? 'bg-surface-hover text-ink' : 'text-ink-faint'}`}>{count}</button>)}</div>
    </div>
    {computed && candles.length ? <div className="relative overflow-x-auto rounded-lg border border-border bg-bg p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-h-[340px] w-full min-w-[720px]" role="img" aria-label={`Candlestick ${snapshot.symbol} timeframe ${active}`} onMouseLeave={() => setHover(null)} onMouseMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const rel = (event.clientX - rect.left) / rect.width * W; setHover(Math.max(0, Math.min(candles.length - 1, Math.floor((rel - LEFT) / computed.slot)))); }}>
        {[0, .25, .5, .75, 1].map((fraction) => { const y = TOP + (PRICE_BOTTOM - TOP) * fraction, value = computed.max - (computed.max - computed.min) * fraction; return <g key={fraction}><line x1={LEFT} x2={W - RIGHT} y1={y} y2={y} stroke="var(--color-border)" strokeWidth="1"/><text x={W - RIGHT + 8} y={y + 4} fill="var(--color-ink-faint)" fontSize="11">{price(value)}</text></g>; })}
        {levels.filter((level) => level.value >= computed.min && level.value <= computed.max).slice(0, 12).map((level) => { const color = level.tone === 'stop' ? 'var(--color-negative)' : level.tone === 'target' ? 'var(--color-positive)' : 'var(--color-accent)'; return <g key={`${level.label}-${level.value}`}><line x1={LEFT} x2={W - RIGHT} y1={computed.y(level.value)} y2={computed.y(level.value)} stroke={color} strokeWidth="1" strokeDasharray="6 5" opacity=".75"/><text x={LEFT + 4} y={computed.y(level.value) - 4} fill={color} fontSize="9">{level.label} · {price(level.value)}</text></g>; })}
        <polyline points={computed.average.map((value, index) => `${LEFT + computed.slot * (index + .5)},${computed.y(value)}`).join(' ')} fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity=".9"/>
        {intraday ? <polyline points={computed.weighted.map((value, index) => `${LEFT + computed.slot * (index + .5)},${computed.y(value)}`).join(' ')} fill="none" stroke="#a78bfa" strokeWidth="1.5" opacity=".9"/> : null}
        {candles.map((row, index) => { const x = LEFT + computed.slot * (index + .5), bullish = row.close >= row.open, color = bullish ? 'var(--color-positive)' : 'var(--color-negative)', top = computed.y(Math.max(row.open, row.close)), bottom = computed.y(Math.min(row.open, row.close)), bodyWidth = Math.max(1.5, computed.slot * .62), volumeHeight = row.volume / computed.maxVolume * (VOLUME_BOTTOM - VOLUME_TOP); return <g key={row.timestamp} opacity={hover == null || hover === index ? 1 : .62}><line x1={x} x2={x} y1={computed.y(row.high)} y2={computed.y(row.low)} stroke={color}/><rect x={x - bodyWidth / 2} y={top} width={bodyWidth} height={Math.max(1.5, bottom - top)} fill={color}/><rect x={x - bodyWidth / 2} y={VOLUME_BOTTOM - volumeHeight} width={bodyWidth} height={volumeHeight} fill={color} opacity=".45"/></g>; })}
        <line x1={LEFT} x2={W - RIGHT} y1={360} y2={360} stroke="var(--color-border)"/><text x={LEFT} y={VOLUME_TOP - 3} fill="var(--color-ink-faint)" fontSize="10">VOLUME</text>
        {hovered ? <line x1={LEFT + computed.slot * (hover! + .5)} x2={LEFT + computed.slot * (hover! + .5)} y1={TOP} y2={VOLUME_BOTTOM} stroke="var(--color-ink-muted)" strokeDasharray="3 3"/> : null}
        <text x={LEFT} y={H - 7} fill="var(--color-ink-faint)" fontSize="10">{when(candles[0].timestamp, !intraday)}</text><text x={W - RIGHT} y={H - 7} textAnchor="end" fill="var(--color-ink-faint)" fontSize="10">{when(candles.at(-1)!.timestamp, !intraday)}</text>
      </svg>
      {hovered ? <div className="pointer-events-none absolute right-4 top-4 rounded-lg border border-border bg-surface/95 px-3 py-2 font-mono text-[11px] shadow-xl"><p className="mb-1 text-ink-muted">{when(hovered.timestamp, !intraday)}</p><p>O {price(hovered.open)} · H <span className="text-positive">{price(hovered.high)}</span></p><p>L <span className="text-negative">{price(hovered.low)}</span> · C {price(hovered.close)}</p><p className="text-ink-muted">Volume {volume(hovered.volume)}</p></div> : null}
    </div> : <div className="py-16 text-center text-sm text-ink-faint">Timeframe ini belum tersedia.</div>}
    <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[10px] text-ink-faint"><span><i className="mr-1 inline-block h-0.5 w-4 bg-warning"/>EMA20</span>{intraday ? <span><i className="mr-1 inline-block h-0.5 w-4 bg-violet-400"/>VWAP</span> : null}<span>Source {source?.source ?? '—'} · {source?.data_status ?? '—'}</span><span>As of {source?.as_of ?? '—'}</span><span>{candles.length} candle</span></div>
  </div>;
}
