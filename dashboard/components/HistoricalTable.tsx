import type { OHLCV } from  '@/lib/indicators';

function fmt(value: number): string {
  if (value >= 1000) return Math.round(value).toLocaleString('id-ID');
  return value.toLocaleString('id-ID', { maximumFractionDigits: 6 });
}

export function HistoricalTable({ candles }: { candles: OHLCV[] }) {
  const rows = [...candles].reverse();

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-3 font-sans text-lg font-semibold text-ink">Historical Data (Daily)</h3>
      <div className="max-h-96 overflow-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-left text-ink-muted">
              <th className="border-b border-border py-2 pr-3 font-medium">Date</th>
              <th className="border-b border-border py-2 pr-3 font-medium">Open</th>
              <th className="border-b border-border py-2 pr-3 font-medium">High</th>
              <th className="border-b border-border py-2 pr-3 font-medium">Low</th>
              <th className="border-b border-border py-2 pr-3 font-medium">Close</th>
              <th className="border-b border-border py-2 font-medium">Δ%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const changePct = ((c.close - c.open) / c.open) * 100;
              return (
                <tr key={c.timestamp} className={i % 2 === 0 ? '' : 'bg-bg/40'}>
                  <td className="py-1.5 pr-3 text-ink-muted">{new Date(c.timestamp).toISOString().slice(0, 10)}</td>
                  <td className="py-1.5 pr-3 text-ink">{fmt(c.open)}</td>
                  <td className="py-1.5 pr-3 text-positive">{fmt(c.high)}</td>
                  <td className="py-1.5 pr-3 text-negative">{fmt(c.low)}</td>
                  <td className="py-1.5 pr-3 text-ink">{fmt(c.close)}</td>
                  <td className={`py-1.5 ${changePct >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {changePct >= 0 ? '+' : ''}
                    {changePct.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
