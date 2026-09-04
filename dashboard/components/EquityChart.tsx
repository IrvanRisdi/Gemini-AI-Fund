import type { Row } from '@/lib/stock-data';

export function EquityChart({ rows }: { rows: Row[] }) {
  if (!rows.length) return <p className="py-12 text-center font-mono text-xs text-ink-faint">Belum ada histori equity.</p>;
  const values = rows.map((row) => Number(row.equity ?? 0));
  const low = Math.min(...values), high = Math.max(...values), span = high - low || 1;
  const points = values.map((value, index) => `${30 + index * (660 / Math.max(1, values.length - 1))},${170 - ((value - low) / span) * 125}`).join(' ');
  return <svg viewBox="0 0 720 205" role="img" aria-label={`Kurva equity ${rows.length} hari`} className="h-auto w-full"><defs><linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity=".3"/><stop offset="1" stopColor="#10b981" stopOpacity="0"/></linearGradient></defs><line x1="30" y1="170" x2="690" y2="170" stroke="#1e293b"/><polygon points={`30,170 ${points} 690,170`} fill="url(#equityFill)"/><polyline points={points} fill="none" stroke="#10b981" strokeWidth="3"/><text x="30" y="198" fill="#8b93a7" fontSize="11">{String(rows[0].equity_date)}</text><text x="690" y="198" textAnchor="end" fill="#8b93a7" fontSize="11">{String(rows.at(-1)?.equity_date)}</text></svg>;
}
