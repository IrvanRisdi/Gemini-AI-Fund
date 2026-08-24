import Link from 'next/link';
import { DataCard, type DataCardBadge } from '@/components/DataCard';
import { CodeBlock } from '@/components/CodeBlock';
import { AiConsole } from '@/components/AiConsole';
import { LiveTicker } from '@/components/LiveTicker';
import { StatBadge } from '@/components/StatBadge';
import { getDeskSnapshot, listBriefingSlugs, type AgentSummary } from '@/lib/desk-data';
import type { BadgeTone } from '@/components/StatBadge';

export const dynamic = 'force-dynamic';

function agentCard(agent: AgentSummary) {
  const hasPosition = agent.openPairs.length > 0;
  const badges: DataCardBadge[] = [
    { label: agent.status === 'active' ? 'ACTIVE' : 'FIRED', tone: agent.status === 'active' ? 'positive' : 'neutral' },
  ];

  let statusTone: BadgeTone = 'neutral';
  let statusLabel = 'FLAT';
  let statusDescription = agent.lastAction;

  if (hasPosition) {
    const pos = agent.openPositions[0];
    statusTone = pos.side === 'long' ? 'positive' : 'negative';
    statusLabel = `${pos.side.toUpperCase()} ${agent.openPairs[0]}`;
    statusDescription = pos.sizingNote ?? `Entry Rp${pos.entryPrice.toLocaleString('id-ID')}, stop Rp${pos.stopPrice.toLocaleString('id-ID')}.`;
  } else if (agent.lastAction.startsWith('⚡ Signal:') || agent.lastAction.startsWith('🔥 Signal:')) {
    statusTone = 'accent';
    statusLabel = 'SIGNAL DETECTED';
    statusDescription = agent.lastAction;
  } else if (agent.latestTrade) {
    statusTone = agent.latestTrade.type === 'close' ? (agent.latestTrade.realizedPnlIdr ?? 0) >= 0 ? 'positive' : 'negative' : 'accent';
    statusLabel = agent.latestTrade.type === 'close' ? 'LAST: CLOSED' : 'LAST: OPENED';
    statusDescription = agent.latestTrade.reason;
  }

  return (
    <DataCard
      key={agent.slug}
      title={agent.slug}
      href={`/agent/${agent.slug}`}
      subtitle={`Rp${agent.startingBalance.toLocaleString('id-ID')} starting book`}
      badges={badges}
      statusTone={statusTone}
      statusLabel={statusLabel}
      statusDescription={statusDescription}
      value={`Rp${agent.balance.toLocaleString('id-ID')}`}
      deltaPct={agent.pnlPct}
      live={agent.status === 'active'}
    />
  );
}

export default async function DeskPage() {
  const [snapshot, allBriefingSlugs] = await Promise.all([getDeskSnapshot(), listBriefingSlugs()]);
  const deskPnl = snapshot.totalEquity - snapshot.startingTotal;
  const deskPnlPct = (deskPnl / (snapshot.startingTotal || 1)) * 100;

  const bookHoldingSlugs = new Set(snapshot.agents.map((a) => a.slug));
  const otherSlugs = allBriefingSlugs.filter((s) => !bookHoldingSlugs.has(s)).sort();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-blue-400 uppercase flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
            Gemini AI-Fund · Paper Desk
          </p>
          <h1 className="mt-1 font-sans text-3xl font-semibold text-ink">Desk Overview</h1>
          <p className="mt-1 font-mono text-xs text-ink-faint">
            last cycle <span className="text-ink-muted font-medium">{snapshot.lastCycle}</span> · mode {snapshot.deskMode}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-5 py-3 text-right">
          <p className="font-mono text-[11px] tracking-wide text-ink-muted uppercase">Total Equity</p>
          <p className="font-mono text-2xl font-semibold text-ink">Rp{Math.round(snapshot.totalEquity).toLocaleString('id-ID')}</p>
          <p className={`font-mono text-xs font-medium ${deskPnlPct >= 0 ? 'text-positive' : 'text-negative'}`}>
            {deskPnlPct >= 0 ? '+' : ''}
            {deskPnlPct.toFixed(3)}%
          </p>
        </div>
      </header>

      {snapshot.latestScanCandidates && snapshot.latestScanCandidates.length > 0 && (
        <section className="mb-8 rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-sans text-sm font-semibold text-blue-300 flex items-center gap-2">
              <span>⚡ Live Signals Detected</span>
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 font-mono text-[10px] text-blue-400 border border-blue-500/30">
                {snapshot.latestScanCandidates.length} Active Triggers
              </span>
            </h2>
            <span className="font-mono text-[11px] text-ink-faint">{snapshot.lastCycle}</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {snapshot.latestScanCandidates.map((c, idx) => (
              <div key={idx} className="rounded-lg border border-border/60 bg-surface/80 p-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-accent">{c.pair.toUpperCase()}</span>
                  <span className="text-ink-muted">{c.agent}</span>
                </div>
                <p className="mt-1 text-[11px] text-ink-muted leading-relaxed line-clamp-2">{c.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{snapshot.agents.map(agentCard)}</section>

      {otherSlugs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-sans text-sm font-medium text-ink-muted">Other Agents (oversight &amp; inactive)</h2>
          <div className="flex flex-wrap gap-2">
            {otherSlugs.map((slug) => (
              <Link
                key={slug}
                href={`/agent/${slug}`}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
              >
                {slug}
                <StatBadge tone="neutral">briefing</StatBadge>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CodeBlock
          filename="state.json"
          language="json"
          code={JSON.stringify(snapshot.riskLimits ?? {}, null, 2)}
        />
        <AiConsole snapshot={snapshot} />
      </section>

      <LiveTicker />
    </main>
  );
}
