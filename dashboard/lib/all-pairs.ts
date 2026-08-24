import type { PairMeta } from './pairs';

interface IndodaxPairRaw {
  id: string;
  traded_currency: string;
  traded_currency_unit: string;
  base_currency: string;
  description: string;
  coingecko_id: string | null;
  is_maintenance: number;
  is_market_suspended: number;
}

/**
 * Full universe of active Indodax IDR pairs (currently ~477), for browsing
 * and research only — separate from `PAIRS` in `pairs.ts`, which is the
 * small curated list the paper-trading agents actually hold books in.
 * Indodax's own /api/pairs response conveniently already includes each
 * pair's CoinGecko id, so no separate mapping table is needed here.
 */
export async function fetchAllPairs(): Promise<PairMeta[]> {
  const res = await fetch('https://indodax.com/api/pairs', { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const raw = (await res.json()) as IndodaxPairRaw[];

  return raw
    .filter((p) => p.base_currency === 'idr' && !p.is_maintenance && !p.is_market_suspended && p.coingecko_id)
    .map(
      (p): PairMeta => ({
        symbol: p.traded_currency.toLowerCase(),
        name: p.traded_currency_unit,
        indodaxId: p.id,
        coingeckoId: p.coingecko_id as string,
      })
    )
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export async function findPairBySymbol(symbol: string): Promise<PairMeta | undefined> {
  const all = await fetchAllPairs();
  return all.find((p) => p.symbol === symbol.toLowerCase());
}
