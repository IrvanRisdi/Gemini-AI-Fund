import { fetchAllPairs } from '@/lib/all-pairs';
import { fetchExplorePairs } from '@/lib/market-data';
import { PairExplorer } from '@/components/PairExplorer';
import { getLatestCoinScan } from '@/lib/desk-data';

export const dynamic = 'force-dynamic';

export default async function ExplorePage() {
  const [basePairs, latestScan] = await Promise.all([fetchAllPairs(), getLatestCoinScan()]);
  const pairs = await fetchExplorePairs(basePairs);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <p className="font-mono text-xs tracking-wide text-ink-muted uppercase">Market Intelligence · Multi-venue · IDR</p>
        <h1 className="mt-1 font-sans text-3xl font-semibold text-ink">Market Explorer</h1>
        <p className="mt-1 max-w-3xl font-sans text-sm leading-relaxed text-ink-muted">
          Temukan pair kripto, lihat universe yang benar-benar dipindai agen dan status tren 4H, lalu buka analisis teknikal.
          Tambahkan pair ke watchlist agar riset Anda tetap fokus—Explore tidak membuka atau mengubah posisi paper trading.
        </p>
        <p className="mt-2 font-mono text-[10px] text-ink-faint">
          Pair IDR: Indodax · ZEC: Kraken ZEC/USD yang dikonversi ke IDR · Market cap serta perubahan global 24 jam: CoinGecko.
        </p>
      </header>

      {pairs.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-muted">
          Couldn&apos;t load the pair list from Indodax right now. Try refreshing.
        </p>
      ) : (
        <PairExplorer pairs={pairs} updatedAt={new Date().toISOString()} latestScan={latestScan} />
      )}
    </main>
  );
}
