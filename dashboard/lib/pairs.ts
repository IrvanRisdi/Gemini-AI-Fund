export interface PairMeta {
  /** Lowercase route/API symbol, e.g. "btc" */
  symbol: string;
  /** Display name, e.g. "Bitcoin" */
  name: string;
  /** Indodax market id, e.g. "btcidr" */
  indodaxId: string;
  /** CoinGecko coin id for the /coins/{id} public endpoint */
  coingeckoId: string;
}

// The 8 pairs this desk's agents actually trade (see .desk/state.json assets_covered).
export const PAIRS: PairMeta[] = [
  { symbol: 'btc', name: 'Bitcoin', indodaxId: 'btcidr', coingeckoId: 'bitcoin' },
  { symbol: 'eth', name: 'Ethereum', indodaxId: 'ethidr', coingeckoId: 'ethereum' },
  { symbol: 'sol', name: 'Solana', indodaxId: 'solidr', coingeckoId: 'solana' },
  { symbol: 'xrp', name: 'XRP', indodaxId: 'xrpidr', coingeckoId: 'ripple' },
  { symbol: 'doge', name: 'Dogecoin', indodaxId: 'dogeidr', coingeckoId: 'dogecoin' },
  { symbol: 'pepe', name: 'Pepe', indodaxId: 'pepeidr', coingeckoId: 'pepe' },
  { symbol: 'sui', name: 'Sui', indodaxId: 'suiidr', coingeckoId: 'sui' },
  { symbol: 'bnb', name: 'BNB', indodaxId: 'bnbidr', coingeckoId: 'binancecoin' },
];

export function getPair(symbol: string): PairMeta | undefined {
  return PAIRS.find((p) => p.symbol === symbol.toLowerCase());
}
