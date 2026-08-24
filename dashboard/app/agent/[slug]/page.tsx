import { notFound } from 'next/navigation';
import { getAgentBookBreakdown, getAgentMeta, getFullBriefing, listBriefingSlugs } from '@/lib/desk-data';
import { renderBriefingMarkdown } from '@/lib/markdown';
import { StatBadge } from '@/components/StatBadge';
import { TradeJournal } from '@/components/TradeJournal';

export const dynamic = 'force-dynamic';

function displayName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function fmtIdr(value: number): string {
  return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}

export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const slugs = await listBriefingSlugs();
  if (!slugs.includes(slug)) notFound();

  const [meta, briefing, book] = await Promise.all([getAgentMeta(slug), getFullBriefing(slug), getAgentBookBreakdown(slug)]);
  const totalEquity = book.cash + book.unrealizedPnlIdr;
  const startingBalance = meta.startingBalance ?? 0;
  const realizedPct = startingBalance ? (book.realizedPnlIdr / startingBalance) * 100 : 0;
  const unrealizedPct = startingBalance ? (book.unrealizedPnlIdr / startingBalance) * 100 : 0;
  const openCount = book.cycles.filter((c) => c.status === 'open').length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">Briefing Book</p>
            <h1 className="mt-1 font-sans text-3xl font-semibold text-ink">{displayName(slug)}</h1>
          </div>
          <StatBadge tone={meta.status === 'active' ? 'positive' : meta.status === 'fired' ? 'negative' : 'neutral'}>
            {meta.status}
          </StatBadge>
        </div>

        <div className="flex flex-wrap gap-1.5 font-mono text-xs text-ink-muted">
          {meta.hired && <span>hired {meta.hired}</span>}
          {meta.firedDate && <span>· fired {meta.firedDate}</span>}
          {meta.assetsCovered.length > 0 && <span>· {meta.assetsCovered.length} pairs covered</span>}
        </div>

        {meta.fireReason && (
          <div className="rounded-lg border border-border bg-negative-bg/40 px-3 py-2.5">
            <span className="font-mono text-[10px] tracking-wide text-negative uppercase">Fire reason</span>
            <p className="mt-1 font-sans text-xs leading-relaxed text-ink-muted">{meta.fireReason}</p>
          </div>
        )}
      </header>

      {meta.hasBook && (
        <section className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <span className="block font-mono text-[10px] tracking-wide text-ink-muted uppercase">Total Ekuitas</span>
            <span className="font-mono text-sm font-semibold text-ink">{fmtIdr(totalEquity)}</span>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <span className="block font-mono text-[10px] tracking-wide text-ink-muted uppercase">Kas</span>
            <span className="font-mono text-sm font-semibold text-ink">{fmtIdr(book.cash)}</span>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <span className="block font-mono text-[10px] tracking-wide text-ink-muted uppercase">
              Nilai Posisi <span className="text-ink-faint">({openCount})</span>
            </span>
            <span className="font-mono text-sm font-semibold text-ink">{fmtIdr(book.openPositionValue)}</span>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <span className="block font-mono text-[10px] tracking-wide text-ink-muted uppercase">P&amp;L Realized</span>
            <span className={`font-mono text-sm font-semibold ${book.realizedPnlIdr >= 0 ? 'text-positive' : 'text-negative'}`}>
              {book.realizedPnlIdr >= 0 ? '+' : '-'}
              {fmtIdr(Math.abs(book.realizedPnlIdr))}
              <span className="ml-1 font-normal text-ink-faint">
                ({realizedPct >= 0 ? '+' : ''}
                {realizedPct.toFixed(2)}%)
              </span>
            </span>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <span className="block font-mono text-[10px] tracking-wide text-ink-muted uppercase">P&amp;L Unrealized</span>
            <span className={`font-mono text-sm font-semibold ${book.unrealizedPnlIdr >= 0 ? 'text-positive' : 'text-negative'}`}>
              {book.unrealizedPnlIdr >= 0 ? '+' : '-'}
              {fmtIdr(Math.abs(book.unrealizedPnlIdr))}
              <span className="ml-1 font-normal text-ink-faint">
                ({unrealizedPct >= 0 ? '+' : ''}
                {unrealizedPct.toFixed(2)}%)
              </span>
            </span>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <span className="block font-mono text-[10px] tracking-wide text-ink-muted uppercase">Last Trade</span>
            <span className="font-mono text-sm font-semibold text-ink">{meta.latestTrade ? meta.latestTrade.type.toUpperCase() : '—'}</span>
          </div>
        </section>
      )}

      {book.cycles.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-sans text-sm font-medium text-ink-muted">
            Jurnal Transaksi <span className="text-ink-faint">({book.cycles.length})</span>
          </h2>
          <TradeJournal cycles={book.cycles} />
        </section>
      )}

      <section className="mx-auto max-w-3xl rounded-xl border border-border bg-surface p-6">
        {briefing ? (
          <div className="briefing-content" dangerouslySetInnerHTML={{ __html: renderBriefingMarkdown(briefing) }} />
        ) : (
          <p className="font-sans text-sm text-ink-muted">No briefing on file for this agent yet.</p>
        )}
      </section>
    </main>
  );
}
