const COIN_SEARCH_ALIASES: Record<string, string> = {
  BTCUSDT: '("Bitcoin" OR "BTC")',
  ETHUSDT: '("Ethereum" OR "ETH")',
  SOLUSDT: '("Solana" OR "SOL")',
  BNBUSDT: '("Binance Coin" OR "BNB")',
  XRPUSDT: '("Ripple" OR "XRP")',
  DOGEUSDT: '("Dogecoin" OR "DOGE")',
  ADAUSDT: '("Cardano" OR "ADA")',
  LINKUSDT: '("Chainlink" OR "LINK")',
  AVAXUSDT: '("Avalanche" OR "AVAX")',
  SUIUSDT: '("Sui Network" OR "Sui crypto" OR "SUI token")',
};

export interface SanitizedHeadline {
  title: string;
  domain: string;
  seenAt: string;
}

export function sanitizeHeadlineText(raw: string, maxLen = 160): string {
  return raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>{}\[\]`]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Fetches recent crypto-filtered headlines from GDELT (free, no API key required)
 * with mandatory crypto context keywords to avoid short-ticker false matches
 * and strict sanitization against indirect prompt injection.
 */
export async function fetchSanitizedCryptoNews(
  symbol: string,
  maxRecords = 8,
): Promise<SanitizedHeadline[]> {
  const sym = symbol.toUpperCase();
  const base = sym.replace(/USDT$/, '');
  const subject = COIN_SEARCH_ALIASES[sym] ?? `"${base}"`;
  const query = `${subject} AND (crypto OR cryptocurrency OR token OR binance OR blockchain)`;

  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    maxrecords: String(maxRecords),
    timespan: '24h',
    format: 'json',
    sort: 'datedesc',
  });

  try {
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`, {
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      articles?: Array<{ title?: string; domain?: string; seendate?: string }>;
    };
    return (data.articles ?? [])
      .filter((a) => typeof a.title === 'string' && a.title.trim().length > 8)
      .slice(0, maxRecords)
      .map((a) => ({
        title: sanitizeHeadlineText(a.title ?? ''),
        domain: sanitizeHeadlineText(a.domain ?? 'unknown', 60),
        seenAt: sanitizeHeadlineText(a.seendate ?? '', 24),
      }));
  } catch {
    return [];
  }
}

export function formatNewsBlock(headlines: SanitizedHeadline[]): string {
  if (headlines.length === 0) {
    return '<untrusted_news>\n(Tidak ada berita spesifik kripto 24 jam terakhir dari GDELT)\n</untrusted_news>';
  }
  const lines = headlines.map(
    (h, idx) => `${idx + 1}. [${h.domain} | ${h.seenAt}] ${h.title}`,
  );
  return `<untrusted_news>\n${lines.join('\n')}\n</untrusted_news>`;
}
