export interface CoinInfo {
  name: string;
  symbol: string;
  rank: number | null;
  descriptionEn: string;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  circulatingSupply: number | null;
  athUsd: number | null;
  athDate: string | null;
  homepage: string | null;
}

/**
 * CoinGecko's free public API (no key). Returns null on any failure —
 * network block, rate limit, unknown id — so callers can render a graceful
 * "unavailable" state instead of crashing the page.
 */
export async function fetchCoinInfo(coingeckoId: string): Promise<CoinInfo | null> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = await res.json();

    return {
      name: data.name,
      symbol: (data.symbol ?? '').toUpperCase(),
      rank: data.market_cap_rank ?? null,
      descriptionEn: data.description?.en ?? '',
      marketCapUsd: data.market_data?.market_cap?.usd ?? null,
      volume24hUsd: data.market_data?.total_volume?.usd ?? null,
      circulatingSupply: data.market_data?.circulating_supply ?? null,
      athUsd: data.market_data?.ath?.usd ?? null,
      athDate: data.market_data?.ath_date?.usd ?? null,
      homepage: data.links?.homepage?.[0] || null,
    };
  } catch {
    return null;
  }
}
