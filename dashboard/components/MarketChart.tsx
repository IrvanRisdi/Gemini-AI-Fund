import type { Row } from '@/lib/stock-data';

export function MarketChart({ candles }: { candles: Row[] }) {
  if (!candles.length) return <p className="py-16 text-center text-sm text-ink-faint">Chart IHSG tidak tersedia.</p>;
  const data = candles.slice(-70), closes = data.map((row) => Number(row.close ?? 0)), averages = data.map((row) => Number(row.sma20 ?? row.close ?? 0));
  const low = Math.min(...data.map((row) => Number(row.low ?? row.close ?? 0))), high = Math.max(...data.map((row) => Number(row.high ?? row.close ?? 0))), span = high - low || 1;
  const point = (value: number, index: number) => `${25 + index * (670 / Math.max(1, data.length - 1))},${180 - ((value - low) / span) * 140}`;
  return <svg viewBox="0 0 720 210" role="img" aria-label="Chart harian IHSG" className="h-auto w-full"><line x1="25" y1="180" x2="695" y2="180" stroke="#1e293b"/><polyline points={averages.map(point).join(' ')} fill="none" stroke="#f59e0b" strokeWidth="2"/><polyline points={closes.map(point).join(' ')} fill="none" stroke="#38bdf8" strokeWidth="3"/><text x="25" y="203" fill="#8b93a7" fontSize="10">{String(data[0].candle_at).slice(0, 10)}</text><text x="695" y="203" textAnchor="end" fill="#8b93a7" fontSize="10">{String(data.at(-1)?.candle_at).slice(0, 10)}</text></svg>;
}
