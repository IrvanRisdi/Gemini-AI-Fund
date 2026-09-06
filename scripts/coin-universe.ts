export const CORE_PAIR_IDS = [
  'btcidr', 'ethidr', 'solidr', 'xrpidr', 'dogeidr', 'pepeidr', 'suiidr', 'bnbidr',
  'trxidr', 'hypeidr', 'linkidr', 'adaidr', 'bchidr', 'tonidr', 'ltcidr', 'hbaridr',
  'avaxidr', 'shibidr', 'uniidr',
] as const;

export const EXTERNAL_PAIR_IDS = ['zecidr'] as const;

const EXCLUDED_BASES = new Set([
  'usdt', 'usdc', 'dai', 'busd', 'tusd', 'usdp', 'idrt', 'bidr',
]);

export interface UniverseTicker {
  pair: string;
  volumeIdr: number;
}

export interface UniversePair extends UniverseTicker {
  source: 'indodax' | 'kraken';
  selectedBecause: 'core' | 'external' | 'open-or-pending' | 'liquidity';
}

interface RawTicker {
  vol_idr?: string;
}

function normalizePair(raw: string): string {
  const clean = raw.replace('/', '').replace('_', '').toLowerCase();
  return clean.endsWith('idr') ? clean : `${clean}idr`;
}

function baseSymbol(pair: string): string {
  return normalizePair(pair).replace(/idr$/, '');
}

export function selectUniverse(
  liquidTickers: UniverseTicker[],
  pinnedPairs: string[],
  maxPairs = 50,
): UniversePair[] {
  const liquidity = new Map(liquidTickers.map((ticker) => [normalizePair(ticker.pair), ticker.volumeIdr]));
  const selected: UniversePair[] = [];
  const seen = new Set<string>();
  const add = (pair: string, selectedBecause: UniversePair['selectedBecause']) => {
    const normalized = normalizePair(pair);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    selected.push({
      pair: normalized,
      volumeIdr: liquidity.get(normalized) ?? 0,
      source: (EXTERNAL_PAIR_IDS as readonly string[]).includes(normalized) ? 'kraken' : 'indodax',
      selectedBecause,
    });
  };

  CORE_PAIR_IDS.forEach((pair) => add(pair, 'core'));
  EXTERNAL_PAIR_IDS.forEach((pair) => add(pair, 'external'));
  pinnedPairs.forEach((pair) => add(pair, 'open-or-pending'));

  for (const ticker of [...liquidTickers].sort((left, right) => right.volumeIdr - left.volumeIdr)) {
    if (selected.length >= maxPairs) break;
    if (EXCLUDED_BASES.has(baseSymbol(ticker.pair))) continue;
    add(ticker.pair, 'liquidity');
  }
  return selected;
}

/**
 * Selects at most 50 liquid markets while never dropping core, external,
 * open-position, or pending-order pairs. The cap can be tuned in Actions
 * through SCAN_MAX_PAIRS without editing code.
 */
export async function discoverTradingUniverse(pinnedPairs: string[] = []): Promise<UniversePair[]> {
  const configuredMax = Number(process.env.SCAN_MAX_PAIRS ?? 50);
  const maxPairs = Number.isFinite(configuredMax) ? Math.min(80, Math.max(20, Math.floor(configuredMax))) : 50;
  const configuredMinimum = Number(process.env.SCAN_MIN_VOLUME_IDR ?? 250_000_000);
  const minimumVolume = Number.isFinite(configuredMinimum) ? Math.max(0, configuredMinimum) : 250_000_000;
  let tickers: UniverseTicker[] = [];

  try {
    const response = await fetch('https://indodax.com/api/ticker_all', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Indodax ticker_all ${response.status}`);
    const payload = await response.json() as { tickers?: Record<string, RawTicker> };
    tickers = Object.entries(payload.tickers ?? {})
      .filter(([key]) => key.endsWith('_idr'))
      .map(([key, ticker]) => ({ pair: normalizePair(key), volumeIdr: Number(ticker.vol_idr ?? 0) }))
      .filter((ticker) => Number.isFinite(ticker.volumeIdr) && ticker.volumeIdr >= minimumVolume);
  } catch (error) {
    console.warn(`[Universe] Dynamic Indodax discovery unavailable: ${String(error)}`);
  }

  return selectUniverse(tickers, pinnedPairs, maxPairs);
}

export function displayPair(pair: string): string {
  const normalized = normalizePair(pair);
  return `${normalized.replace(/idr$/, '').toUpperCase()}/IDR`;
}
