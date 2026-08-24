import { fetchAllPairs } from '@/lib/all-pairs';
import { fetchExplorePairs } from '@/lib/market-data';
import { PairExplorer } from '@/components/PairExplorer';

export const dynamic = 'force-dynamic';

export default async function ExplorePage() {
  const basePairs = await fetchAllPairs();
  const pairs = await fetchExplorePairs(basePairs);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">Indodax · All IDR Pairs</p>
        <h1 className="mt-1 font-sans text-3xl font-semibold text-ink">Explore</h1>
        <p className="mt-1 font-sans text-sm text-ink-muted">
          Browse chart + technical/SMC/Fibonacci analysis for any actively traded pair. This is separate from the paper-trading
          desk's own 8-pair universe on the Desk Overview page — nothing here opens or affects a real position.
        </p>
      </header>

      {pairs.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-muted">
          Couldn&apos;t load the pair list from Indodax right now. Try refreshing.
        </p>
      ) : (
        <PairExplorer pairs={pairs} />
      )}
    </main>
  );
}
