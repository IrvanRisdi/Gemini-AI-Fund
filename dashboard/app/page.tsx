import Link from 'next/link';
import { DataCard, type DataCardBadge } from '@/components/DataCard';
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

  if (agent.unrealizedPnlIdr !== 0) {
    badges.push({
      label: `FL: ${agent.unrealizedPnlIdr >= 0 ? '+' : ''}Rp${Math.round(agent.unrealizedPnlIdr).toLocaleString('id-ID')}`,
      tone: agent.unrealizedPnlIdr >= 0 ? 'positive' : 'negative',
    });
  }

  let statusTone: BadgeTone = 'neutral';
  let statusLabel = 'FLAT';
  let statusDescription = agent.lastAction;

  if (hasPosition) {
    const pos = agent.openPositions[0];
    statusTone = pos.side === 'long' ? 'positive' : 'negative';
    statusLabel = `${pos.side.toUpperCase()} ${agent.openPairs[0]}`;
    statusDescription = pos.sizingNote ?? `Entry Rp${pos.entryPrice.toLocaleString('id-ID'), stop Rp${pos.stopPrice.toLocaleString('id-ID')}.`;
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
      subtitle={`Rp${agent.startingBalance.toLocaleString('id-ID')} modal · Kas: Rp${Math.round(agent.cash).toLocaleString('id-ID')}`}
      badges={badges}
      statusTone={statusTone}
      statusLabel={statusLabel}
      statusDescription={statusDescription}
      value={`Rp${Math.round(agent.equity).toLocaleString('id-ID')}`}
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
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      {/* Header Overview */}
      <header className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-blue-400 uppercase flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            Gemini AI-Fund · Paper Desk
          </p>
          <h1 className="mt-1 font-sans text-2xl sm:text-3xl font-semibold text-ink">Desk Overview</h1>
          <p className="mt-1 font-mono text-xs text-ink-faint">
            last cycle <span className="text-ink-muted font-medium">{snapshot.lastCycle}</span> · mode {snapshot.deskMode}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 sm:px-5 py-3 text-left sm:text-right">
          <p className="font-mono text-[11px] tracking-wide text-ink-muted uppercase">Total Equity (Mark-to-Market)</p>
          <p className="font-mono text-xl sm:text-2xl font-semibold text-ink">Rp{Math.round(snapshot.totalEquity).toLocaleString('id-ID')}</p>
          <div className="flex items-center sm:justify-end gap-2 mt-0.5 font-mono text-xs">
            <span className={deskPnlPct >= 0 ? 'text-positive font-medium' : 'text-negative font-medium'}>
              {deskPnlPct >= 0 ? '+' : ''}{deskPnlPct.toFixed(3)}% ({deskPnl >= 0 ? '+' : ''}Rp{Math.round(deskPnl).toLocaleString('id-ID')})
            </span>
          </div>
          {snapshot.totalUnrealizedPnl !== 0 && (
            <p className="font-mono text-[10px] text-ink-faint mt-0.5">
              Kas: Rp{Math.round(snapshot.totalCash).toLocaleString('id-ID')} · Floating: {snapshot.totalUnrealizedPnl >= 0 ? '+' : ''}Rp{Math.round(snapshot.totalUnrealizedPnl).toLocaleString('id-ID')}
            </p>
          )}
        </div>
      </header>

      {/* Sinyal Pasar Aktif */}
      {snapshot.latestScanCandidates && snapshot.latestScanCandidates.length > 0 && (
        <section className="mb-6 sm:mb-8 rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 backdrop-blur">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="font-sans text-xs sm:text-sm font-semibold text-blue-300 flex items-center gap-2">
              <span>⚡ Sinyal Pasar Aktif</span>
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 font-mono text-[10px] text-blue-400 border border-blue-500/30">
                {snapshot.latestScanCandidates.length} Terdeteksi
              </span>
            </h2>
            <span className="font-mono text-[10px] sm:text-[11px] text-ink-faint">{snapshot.lastCycle.slice(11, 19)} UTC</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {snapshot.latestScanCandidates.map((c, idx) => (
              <div key={idx} className="rounded-lg border border-border/60 bg-surface/80 p-2.5 sm:p-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-accent">{c.pair.toUpperCase()}</span>
                  <span className="text-ink-muted text-[11px]">{c.agent}</span>
                </div>
                <p className="mt-1 text-[11px] text-ink-muted leading-relaxed line-clamp-2">{c.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Kartu Agen Trading Aktif */}
      <section className="grid grid-cols-1 gap-3.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {snapshot.agents.map(agentCard)}
      </section>

      {/* Agen Pengawas & Riset Khusus */}
      {otherSlugs.length > 0 && (
        <section className="mt-6 sm:mt-8 rounded-xl border border-border/80 bg-surface/60 p-4">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h2 className="font-sans text-xs sm:text-sm font-semibold text-ink">Agen Pengawas &amp; Riset Khusus</h2>
              <p className="text-[11px] text-ink-faint">Persona analis makro dan pengawas risiko (tanpa buku saldo langsung)</p>
            </div>
            <span className="rounded bg-surface-hover px-2 py-0.5 font-mono text-[10px] text-ink-muted border border-border">
              {otherSlugs.length} Agen
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
            {otherSlugs.map((slug) => (
              <Link
                key={slug}
                href={`/agent/${slug}`}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-bg/80 px-2.5 py-1.5 font-mono text-[11px] text-ink-muted transition-colors hover:border-accent hover:text-ink"
              >
                {slug}
                <StatBadge tone="neutral">briefing</StatBadge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Bagian Bawah: Kebijakan Risiko & Gemini AI Console */}
      <section className="mt-6 sm:mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Kartu Manajemen Risiko yang Rapi & Deskriptif */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
              <div>
                <h3 className="font-sans text-base sm:text-lg font-semibold text-ink flex items-center gap-2">
                  <span>🛡️</span> Kebijakan &amp; Batasan Risiko
                </h3>
                <p className="text-[11px] sm:text-xs text-ink-faint mt-0.5">
                  Dikelola otomatis oleh sistem Chief Risk Officer (CRO)
                </p>
              </div>
              <span className="rounded-full bg-positive-bg px-2.5 py-0.5 font-mono text-[10px] font-medium text-positive border border-positive/20 uppercase">
                AKTIF
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
              <div className="rounded-lg border border-border/60 bg-bg/60 p-3">
                <p className="font-mono text-[10px] text-ink-faint uppercase">Risiko per Transaksi</p>
                <p className="mt-0.5 font-sans font-semibold text-ink text-sm">2% dari Modal Buku</p>
                <p className="text-[10px] text-ink-muted mt-0.5">Membatasi potensi rugi per posisi agar modal tetap aman.</p>
              </div>

              <div className="rounded-lg border border-border/60 bg-bg/60 p-3">
                <p className="font-mono text-[10px] text-ink-faint uppercase">Proteksi Stop-Loss</p>
                <p className="mt-0.5 font-sans font-semibold text-positive text-sm">Wajib Aktif (100%)</p>
                <p className="text-[10px] text-ink-muted mt-0.5">Setiap order wajib memasang batas harga pengaman.</p>
              </div>

              <div className="rounded-lg border border-border/60 bg-bg/60 p-3">
                <p className="font-mono text-[10px] text-ink-faint uppercase">Maks. Drawdown Portofolio</p>
                <p className="mt-0.5 font-sans font-semibold text-ink text-sm">10% Toleransi</p>
                <p className="text-[10px] text-ink-muted mt-0.5">Circuit breaker otomatis menghentikan trade jika rugi 10%.</p>
              </div>

              <div className="rounded-lg border border-border/60 bg-bg/60 p-3">
                <p className="font-mono text-[10px] text-ink-faint uppercase">Cakupan Multi-Aset</p>
                <p className="mt-0.5 font-sans font-semibold text-ink text-sm">1 Posisi per Pasang Koin</p>
                <p className="text-[10px] text-ink-muted mt-0.5">Agen bebas membuka posisi di seluruh aset yang dipantau (maks. 1 posisi per koin).</p>
              </div>

              <div className="rounded-lg border border-border/60 bg-bg/60 p-3">
                <p className="font-mono text-[10px] text-ink-faint uppercase">Maks. Leverage</p>
                <p className="mt-0.5 font-sans font-semibold text-ink text-sm">3x (Konservatif)</p>
                <p className="text-[10px] text-ink-muted mt-0.5">Fokus pada perdagangan spot &amp; margin rendah risiko.</p>
              </div>

              <div className="rounded-lg border border-border/60 bg-bg/60 p-3">
                <p className="font-mono text-[10px] text-ink-faint uppercase">Diversifikasi Sektor</p>
                <p className="mt-0.5 font-sans font-semibold text-ink text-sm">Maks. 30% per Sektor</p>
                <p className="text-[10px] text-ink-muted mt-0.5">Menghindari penumpukan modal di satu kategori koin.</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-ink-faint">
            <span>Protokol Keamanan: Terverifikasi</span>
            <span className="font-mono text-positive">Zero Margin Call Risk</span>
          </div>
        </div>

        {/* Gemini AI Console */}
        <AiConsole snapshot={snapshot} />
      </section>

      <LiveTicker />
    </main>
  );
}
