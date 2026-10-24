import type { PairMeta } from './pairs';
import { PAIRS } from './pairs';

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

let allPairsCache: { expiresAt: number; data: PairMeta[] } | null = null;

/**
 * Full universe of active Indodax IDR pairs (currently ~477), for browsing
 * and research only — separate from `PAIRS` in `pairs.ts`, which is the
 * small curated list the paper-trading agents actually hold books in.
 * CoinGecko ids are used when Indodax supplies them; unlisted/thin assets
 * remain browseable even when their global metadata is unavailable.
 */
export async function fetchAllPairs(): Promise<PairMeta[]> {
  const now = Date.now();
  if (allPairsCache && allPairsCache.expiresAt > now) {
    return allPairsCache.data;
  }
  try {
    const res = await fetch('https://indodax.com/api/pairs', {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return allPairsCache?.data ?? [...PAIRS];
    const raw = (await res.json()) as IndodaxPairRaw[];

    const indodaxPairs = raw
      .filter((p) => p.base_currency === 'idr' && !p.is_maintenance && !p.is_market_suspended)
      .map(
        (p): PairMeta => ({
          symbol: p.traded_currency.toLowerCase(),
          name: p.traded_currency_unit,
          indodaxId: p.id,
          coingeckoId: p.coingecko_id ?? '',
        }),
      );
    const seen = new Set(indodaxPairs.map((p) => p.symbol));
    const extraPairs = PAIRS.filter((pair) => !seen.has(pair.symbol));
    const merged = [...indodaxPairs, ...extraPairs].sort((a, b) => a.symbol.localeCompare(b.symbol));
    allPairsCache = { expiresAt: now + 3600_000, data: merged };
    return merged;
  } catch {
    return allPairsCache?.data ?? [...PAIRS];
  }
}

export async function findPairBySymbol(symbol: string): Promise<PairMeta | undefined> {
  const clean = symbol.toLowerCase();
  const featured = PAIRS.find((p) => p.symbol === clean);
  if (featured) return featured;
  const all = await fetchAllPairs();
  return all.find((p) => p.symbol === clean);
}
