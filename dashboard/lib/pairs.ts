export interface PairMeta {
  /** Lowercase route/API symbol, e.g. "btc" */
  symbol: string;
  /** Display name, e.g. "Bitcoin" */
  name: string;
  /** Indodax market id, e.g. "btcidr" */
  indodaxId: string;
  /** CoinGecko coin id for the /coins/{id} public endpoint */
  coingeckoId: string;
  /** Candle/price venue. Indodax is the default for backward compatibility. */
  venue?: 'indodax' | 'kraken';
  /** Native market symbol used by an external venue, e.g. ZECUSD. */
  venueSymbol?: string;
}

// Featured routes in the top navigation. The actual agent universe is selected
// dynamically by scripts/coin-universe.ts and is shown in Market Explorer.
export const PAIRS: PairMeta[] = [
  { symbol: 'btc', name: 'Bitcoin', indodaxId: 'btcidr', coingeckoId: 'bitcoin' },
  { symbol: 'eth', name: 'Ethereum', indodaxId: 'ethidr', coingeckoId: 'ethereum' },
  { symbol: 'sol', name: 'Solana', indodaxId: 'solidr', coingeckoId: 'solana' },
  { symbol: 'xrp', name: 'XRP', indodaxId: 'xrpidr', coingeckoId: 'ripple' },
  { symbol: 'doge', name: 'Dogecoin', indodaxId: 'dogeidr', coingeckoId: 'dogecoin' },
  { symbol: 'pepe', name: 'Pepe', indodaxId: 'pepeidr', coingeckoId: 'pepe' },
  { symbol: 'sui', name: 'Sui', indodaxId: 'suiidr', coingeckoId: 'sui' },
  { symbol: 'bnb', name: 'BNB', indodaxId: 'bnbidr', coingeckoId: 'binancecoin' },
  // ZEC is no longer present in Indodax's active public pair feed. The desk
  // therefore follows Kraken ZEC/USD candles and converts them to synthetic
  // IDR with the live USDT/IDR rate. It remains paper-trading only.
  { symbol: 'zec', name: 'Zcash', indodaxId: 'zecidr', coingeckoId: 'zcash', venue: 'kraken', venueSymbol: 'ZECUSD' },
];

export function getPair(symbol: string): PairMeta | undefined {
  return PAIRS.find((p) => p.symbol === symbol.toLowerCase());
}
