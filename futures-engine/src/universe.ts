import { computeIndicators, median } from './indicators.js';
import { fetchAllUsdtTickers24h, fetchKlines } from './market-data.js';

export const FALLBACK_UNIVERSE = [
  'ETHUSDT',
  'SOLUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'LINKUSDT',
  'SUIUSDT',
  'XRPUSDT',
  'AVAXUSDT',
] as const;

const EXCLUDED_SYMBOLS = new Set([
  'BTCUSDT', // Macro compass only; too efficient for 4H breakout SL band
  'USDCUSDT',
  'FDUSDUSDT',
  'TUSDUSDT',
  'USDPUSDT',
  'DAIUSDT',
  'EURUSDT',
  'BUSDUSDT',
  'USDEUSDT',
  'PAXGUSDT',
  'XAUTUSDT',
]);

export interface UniverseCandidateDiagnostic {
  symbol: string;
  quoteVolumeUsd: number;
  medianAtr4hPct: number;
  selected: boolean;
  reason: string;
}

export interface UniverseSelectionResult {
  symbols: string[];
  diagnostics: UniverseCandidateDiagnostic[];
  updatedAt: string;
}

/**
 * Dynamic objective universe selection (anti-selection bias):
 * 1. 24h Quote Volume >= $150M (high liquidity, narrow spread)
 * 2. Median 4H ATR% over last 60 closed bars between 1.5% and 4.5%
 *    (high-beta majors sweet spot; excludes sluggish anchors & wild >8% memecoins)
 * 3. Always retains currently open/pending symbols so active risk is never orphaned.
 */
export async function discoverDynamicUniverse(
  pinnedSymbols: string[] = [],
  options: {
    minVolumeUsd?: number;
    minMedianAtrPct?: number;
    maxMedianAtrPct?: number;
    maxSymbols?: number;
  } = {},
): Promise<UniverseSelectionResult> {
  const minVolumeUsd = options.minVolumeUsd ?? 150_000_000;
  const minAtr = options.minMedianAtrPct ?? 0.015;
  const maxAtr = options.maxMedianAtrPct ?? 0.045;
  const maxSymbols = options.maxSymbols ?? 12;

  const diagnostics: UniverseCandidateDiagnostic[] = [];
  const selected = new Set<string>(pinnedSymbols.map((s) => s.toUpperCase()));

  try {
    const tickers = await fetchAllUsdtTickers24h();
    const liquid = tickers
      .filter((t) => !EXCLUDED_SYMBOLS.has(t.symbol) && t.quoteVolumeUsd >= minVolumeUsd)
      .sort((a, b) => b.quoteVolumeUsd - a.quoteVolumeUsd)
      .slice(0, 25);

    for (const ticker of liquid) {
      try {
        const klines = await fetchKlines(ticker.symbol, '4h', 80);
        const closed = klines.slice(0, -1);
        if (closed.length < 40) continue;
        const ind = computeIndicators(closed);
        const recentAtrPcts: number[] = [];
        for (let i = Math.max(15, closed.length - 40); i < closed.length; i++) {
          const atrVal = ind.atr14[i];
          const close = closed[i]!.close;
          if (Number.isFinite(atrVal) && close > 0) recentAtrPcts.push(atrVal / close);
        }
        const medAtrPct = median(recentAtrPcts);
        const passes = Number.isFinite(medAtrPct) && medAtrPct >= minAtr && medAtrPct <= maxAtr;

        if (passes && selected.size < maxSymbols) {
          selected.add(ticker.symbol);
        }
        diagnostics.push({
          symbol: ticker.symbol,
          quoteVolumeUsd: Math.round(ticker.quoteVolumeUsd),
          medianAtr4hPct: Number((medAtrPct * 100).toFixed(2)),
          selected: selected.has(ticker.symbol),
          reason: passes
            ? 'Lolos likuiditas >= $150M & ATR% 4H ideal (1.5%-4.5%)'
            : `ATR% 4H ${(medAtrPct * 100).toFixed(2)}% di luar pita 1.5%-4.5%`,
        });
      } catch {
        // Ignore transient per-symbol failure
      }
    }
  } catch {
    // Fallback below if ticker API unreachable
  }

  if (selected.size === 0) {
    for (const sym of FALLBACK_UNIVERSE) selected.add(sym);
  }

  return {
    symbols: [...selected],
    diagnostics,
    updatedAt: new Date().toISOString(),
  };
}
