import type { CoinEquityHistoryPoint } from '@/lib/desk-data';

const AGENT_STYLE: Record<string, { label: string; color: string }> = {
  'breakout-specialist': { label: 'Breakout Specialist', color: '#38bdf8' },
  'aggressive-breakout-trader': { label: 'Aggressive Breakout', color: '#f97316' },
  'mean-reversion-trader': { label: 'Mean Reversion', color: '#a78bfa' },
  'smc-trader': { label: 'SMC Trader', color: '#22c55e' },
  'wyckoff-trader': { label: 'Wyckoff Trader', color: '#f59e0b' },
};

function formatIdr(value: number): string {
  return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}

function compactIdr(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)} M`;
  if (absolute >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)} jt`;
  return formatIdr(value);
}

function pct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function percentage(value: number, basis: number): number | null {
  return basis > 0 ? ((value - basis) / basis) * 100 : null;
}

function dayDistance(left: string, right: string): number {
  return Math.round((Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / 86_400_000);
}

function dailyChange(points: CoinEquityHistoryPoint[], index: number, value: (point: CoinEquityHistoryPoint) => number | null): number | null {
  if (index <= 0 || dayDistance(points[index - 1]!.date, points[index]!.date) !== 1) return null;
  const previous = value(points[index - 1]!);
  const current = value(points[index]!);
  return previous != null && current != null && previous > 0 ? ((current - previous) / previous) * 100 : null;
}

function EquityCurve({
  points,
  value,
  color,
  label,
  compact = false,
}: {
  points: CoinEquityHistoryPoint[];
  value: (point: CoinEquityHistoryPoint) => number | null;
  color: string;
  label: string;
  compact?: boolean;
}) {
  const rows = points.flatMap((point) => {
    const amount = value(point);
    return amount == null || !Number.isFinite(amount) ? [] : [{ date: point.date, amount }];
  });
  if (rows.length === 0) return <div className="flex h-32 items-center justify-center text-xs text-ink-faint">Belum ada snapshot.</div>;

  const width = 720;
  const height = compact ? 150 : 230;
  const left = compact ? 14 : 62;
  const right = compact ? 14 : 18;
  const top = 16;
  const bottom = compact ? 26 : 34;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const dates = rows.map((row) => Date.parse(`${row.date}T00:00:00Z`));
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const amounts = rows.map((row) => row.amount);
  const rawMin = Math.min(...amounts);
  const rawMax = Math.max(...amounts);
  const padding = Math.max((rawMax - rawMin) * 0.12, rawMax * 0.005, 1);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const x = (date: string) => left + ((Date.parse(`${date}T00:00:00Z`) - minDate) / Math.max(1, maxDate - minDate)) * chartWidth;
  const y = (amount: number) => top + (1 - (amount - min) / Math.max(1, max - min)) * chartHeight;

  const segments: typeof rows[] = [];
  for (const row of rows) {
    const segment = segments.at(-1);
    if (!segment || dayDistance(segment.at(-1)!.date, row.date) > 1) segments.push([row]);
    else segment.push(row);
  }

  const gridValues = compact ? [] : [min, (min + max) / 2, max];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}, ${rows.length} snapshot harian`} className="h-auto w-full">
      {gridValues.map((gridValue) => (
        <g key={gridValue}>
          <line x1={left} y1={y(gridValue)} x2={width - right} y2={y(gridValue)} stroke="#1e293b" strokeDasharray="4 5" />
          <text x={left - 7} y={y(gridValue) + 4} textAnchor="end" fill="#8b93a7" fontSize="10">{compactIdr(gridValue)}</text>
        </g>
      ))}
      {segments.map((segment, index) => segment.length > 1 ? (
        <polyline key={index} points={segment.map((row) => `${x(row.date)},${y(row.amount)}`).join(' ')} fill="none" stroke={color} strokeWidth={compact ? 2.5 : 3} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <circle key={index} cx={x(segment[0]!.date)} cy={y(segment[0]!.amount)} r={compact ? 3 : 4} fill={color} />
      ))}
      {rows.map((row) => <circle key={row.date} cx={x(row.date)} cy={y(row.amount)} r="2.5" fill={color}><title>{row.date}: {formatIdr(row.amount)}</title></circle>)}
      <text x={left} y={height - 7} fill="#8b93a7" fontSize="10">{rows[0]!.date}</text>
      <text x={width - right} y={height - 7} textAnchor="end" fill="#8b93a7" fontSize="10">{rows.at(-1)!.date}</text>
    </svg>
  );
}

function ChangeLabel({ value, prefix }: { value: number | null; prefix: string }) {
  const tone = value == null ? 'text-ink-faint' : value >= 0 ? 'text-positive' : 'text-negative';
  return <span className={tone}>{prefix} {pct(value)}</span>;
}

export function CoinEquityHistory({
  points,
  agentSlugs,
  startingTotal,
  startingByAgent,
}: {
  points: CoinEquityHistoryPoint[];
  agentSlugs: string[];
  startingTotal: number;
  startingByAgent: Record<string, number>;
}) {
  const latest = points.at(-1);
  const previousIndex = points.length - 1;
  const totalDaily = latest ? dailyChange(points, previousIndex, (point) => point.totalEquity) : null;
  const totalReturn = latest ? percentage(latest.totalEquity, startingTotal) : null;
  const missingDays = points.some((point, index) => index > 0 && dayDistance(points[index - 1]!.date, point.date) > 1);
  const tablePoints = [...points].reverse().slice(0, 90);

  return (
    <section className="mt-6 sm:mt-8 rounded-xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="coin-equity-history">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-accent">Performance monitoring</p>
          <h2 id="coin-equity-history" className="font-sans text-base font-semibold text-ink sm:text-lg">Equity Harian Fund &amp; Agent</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-muted">Satu snapshot mark-to-market per hari WIB. Titik hari berjalan diperbarui setiap siklus; persentase harian hanya dihitung jika snapshot hari sebelumnya tersedia.</p>
        </div>
        <div className="text-right font-mono">
          <p className="text-lg font-semibold text-ink">{latest ? formatIdr(latest.totalEquity) : '—'}</p>
          <p className="flex justify-end gap-2 text-[10px]"><ChangeLabel value={totalDaily} prefix="Harian" /><ChangeLabel value={totalReturn} prefix="Total" /></p>
        </div>
      </div>

      {missingDays ? <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-warning">Ada jeda histori sebelum kolektor harian aktif. Grafik memutus garis pada tanggal tanpa snapshot agar tidak memberi kesan data tersedia.</div> : null}

      <div className="rounded-xl border border-border bg-bg/40 p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3"><span className="font-mono text-xs font-semibold text-ink">Total Fund</span><span className="font-mono text-[10px] text-ink-faint">{points.length} snapshot</span></div>
        <EquityCurve points={points} value={(point) => point.totalEquity} color="#e2e8f0" label="Kurva total equity fund" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {agentSlugs.map((slug) => {
          const style = AGENT_STYLE[slug] ?? { label: slug, color: '#94a3b8' };
          const latestEquity = latest?.agents[slug]?.equity ?? null;
          const dayChange = latest ? dailyChange(points, previousIndex, (point) => point.agents[slug]?.equity ?? null) : null;
          const totalChange = latestEquity == null ? null : percentage(latestEquity, startingByAgent[slug] ?? 0);
          return <article key={slug} className="rounded-xl border border-border bg-bg/40 p-3">
            <div className="flex items-start justify-between gap-2"><div><p className="font-sans text-sm font-medium text-ink">{style.label}</p><p className="font-mono text-[10px] text-ink-faint">{slug}</p></div><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: style.color }} /></div>
            <div className="mt-2 flex items-end justify-between gap-2"><p className="font-mono text-sm font-semibold text-ink">{latestEquity == null ? '—' : formatIdr(latestEquity)}</p><p className="font-mono text-[9px]"><ChangeLabel value={dayChange} prefix="D" /> · <ChangeLabel value={totalChange} prefix="T" /></p></div>
            <EquityCurve points={points} value={(point) => point.agents[slug]?.equity ?? null} color={style.color} label={`Kurva equity ${style.label}`} compact />
          </article>;
        })}
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[1320px] border-collapse font-mono text-xs">
          <caption className="sr-only">Tabel nilai equity, perubahan harian, dan return terhadap modal awal untuk total fund dan setiap agent.</caption>
          <thead><tr className="border-b border-border bg-bg/70 text-left text-[10px] uppercase tracking-wide text-ink-muted"><th className="sticky left-0 z-10 bg-bg px-3 py-2.5">Tanggal WIB</th><th className="px-3 py-2.5">Jenis</th><th className="px-3 py-2.5 text-right">Total Fund</th>{agentSlugs.map((slug) => <th key={slug} className="px-3 py-2.5 text-right">{AGENT_STYLE[slug]?.label ?? slug}</th>)}</tr></thead>
          <tbody>{tablePoints.map((point) => {
            const sourceIndex = points.findIndex((item) => item.date === point.date && item.kind === point.kind);
            return <tr key={`${point.date}-${point.kind}`} className="border-b border-border/60 last:border-0 hover:bg-surface-hover">
              <td className="sticky left-0 z-10 bg-surface px-3 py-3 font-semibold text-ink">{point.date}</td>
              <td className="px-3 py-3 text-ink-faint">{point.kind === 'baseline' ? 'Modal awal' : 'Snapshot'}</td>
              <td className="px-3 py-3 text-right"><p className="font-semibold text-ink">{formatIdr(point.totalEquity)}</p><p className="mt-0.5 text-[9px]"><ChangeLabel value={dailyChange(points, sourceIndex, (row) => row.totalEquity)} prefix="H" /> · <ChangeLabel value={percentage(point.totalEquity, startingTotal)} prefix="T" /></p></td>
              {agentSlugs.map((slug) => {
                const equity = point.agents[slug]?.equity ?? null;
                return <td key={slug} className="px-3 py-3 text-right">{equity == null ? <span className="text-ink-faint">—</span> : <><p className="font-semibold text-ink">{formatIdr(equity)}</p><p className="mt-0.5 text-[9px]"><ChangeLabel value={dailyChange(points, sourceIndex, (row) => row.agents[slug]?.equity ?? null)} prefix="H" /> · <ChangeLabel value={percentage(equity, startingByAgent[slug] ?? 0)} prefix="T" /></p></>}</td>;
              })}
            </tr>;
          })}</tbody>
        </table>
      </div>
      <p className="mt-2 font-mono text-[9px] text-ink-faint">H = perubahan terhadap hari kalender sebelumnya · T = return terhadap modal awal · Riwayat tabel dibatasi 90 snapshot terbaru.</p>
    </section>
  );
}

export function AgentEquityHistory({ points, slug, startingEquity }: { points: CoinEquityHistoryPoint[]; slug: string; startingEquity: number }) {
  const style = AGENT_STYLE[slug] ?? { label: slug, color: '#94a3b8' };
  const latest = points.at(-1)?.agents[slug]?.equity ?? null;
  return <section className="mb-7 rounded-xl border border-border bg-surface p-5" aria-labelledby="agent-equity-history">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono text-[10px] uppercase text-accent">Performance</p><h2 id="agent-equity-history" className="text-lg font-semibold">Equity harian</h2><p className="mt-1 text-xs text-ink-muted">Mark-to-market harian dalam IDR; garis terputus menandakan tanggal tanpa snapshot.</p></div><div className="text-right"><p className="font-mono text-sm font-semibold text-ink">{latest == null ? '—' : formatIdr(latest)}</p><p className="font-mono text-[10px] text-ink-faint">Total {latest == null ? '—' : pct(percentage(latest, startingEquity))}</p></div></div>
    <EquityCurve points={points} value={(point) => point.agents[slug]?.equity ?? null} color={style.color} label={`Kurva equity ${style.label}`} />
  </section>;
}
