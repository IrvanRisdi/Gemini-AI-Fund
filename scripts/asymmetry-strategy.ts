/** Deterministic port of the "Jurnal Asimetri Kripto" method (crypto-desk
 * screen.py + ta_scan.py) so the feed can be rebuilt daily in GitHub Actions.
 * The human research layer (news, catalysts, bear case) is not reproduced:
 * finalists come from the transparent screen score plus hard exclusions. */
import type { JournalAsset, JournalFeed } from './asymmetry-journal.js';

export const SCREEN_MIN_MC = 100e6;
export const SCREEN_MIN_HR_ANN = 5e6;
/** Tokens above 150x MC/holder-revenue are not priced on cash flow. */
export const SHORTLIST_MAX_MC_HR = 150;
export const SHORTLIST_SIZE = 25;
export const FINALIST_MIN_SCORE = 55;
export const FINALIST_COUNT = 6;
/** Flags the journal treats as disqualifying without supporting research. */
export const FINALIST_EXCLUDED_FLAGS = ['lonjakan', 'revenue menurun', 'dilusi', 'crowded'];

export interface MarketCoin {
  id: string; symbol: string; name: string; current_price: number | null; market_cap: number | null;
  fully_diluted_valuation?: number | null; market_cap_rank?: number | null;
  price_change_percentage_30d_in_currency?: number | null; ath_change_percentage?: number | null;
}
export interface RevenueTotals { hr30: number; hrPrev30: number; hr1y: number; rev30: number }
export interface ScreenRow {
  id: string; ticker: string; name: string; category: string | null; price: number; mc: number; fdv: number;
  hrAnn: number; mcHr: number; hrGrowth: number | null; runRate: number | null; chg30d: number;
  score: number; parts: Record<'val' | 'gro' | 'dur' | 'dil' | 'crw', number>; flags: string[];
}
export interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number }

function clamp(value: number, low = 0, high = 1) { return Math.max(low, Math.min(high, value)); }

export function isStable(coin: MarketCoin) {
  const price = coin.current_price ?? 0;
  return (price >= 0.97 && price <= 1.03 && Math.abs(coin.price_change_percentage_30d_in_currency ?? 0) < 2)
    || ['xaut', 'paxg', 'kau'].includes(coin.symbol.toLowerCase());
}

/** Screen score 0-100: valuation 40, growth 20, durability 15, dilution 10, crowding 15. */
export function scoreCoin(coin: MarketCoin, totals: RevenueTotals, category: string | null = null): ScreenRow | null {
  const mc = coin.market_cap ?? 0;
  if (!mc || isStable(coin) || mc < SCREEN_MIN_MC) return null;
  const hrAnn = totals.hr30 * 365 / 30;
  if (hrAnn < SCREEN_MIN_HR_ANN) return null;
  const fdv = coin.fully_diluted_valuation || mc;
  const mcHr = mc / hrAnn;
  const growth = totals.hrPrev30 > 0 ? totals.hr30 / totals.hrPrev30 - 1 : null;
  const runRate = totals.hr1y > 0 ? totals.hr30 * 12.17 / totals.hr1y : null;
  const chg30d = coin.price_change_percentage_30d_in_currency ?? 0;
  const val = clamp((Math.log(100) - Math.log(Math.max(mcHr, 0.01))) / (Math.log(100) - Math.log(3)));
  const gro = clamp(((growth ?? 0) + 0.5) / 1.5);
  const dur = runRate == null ? 0.4 : runRate >= 0.8 && runRate <= 2 ? 1 : runRate < 0.8 ? clamp(runRate / 0.8) : clamp(1 - (runRate - 2) / 3);
  const dil = clamp(1 - (fdv / mc - 1) / 2);
  const crw = clamp(1 - (chg30d - 20) / 130);
  const flags: string[] = [];
  if (runRate != null && runRate > 3) flags.push('lonjakan');
  if (runRate != null && runRate < 0.6) flags.push('revenue menurun');
  if (chg30d > 80) flags.push('crowded');
  if (fdv / mc > 2.5) flags.push('dilusi');
  if (hrAnn < 20e6) flags.push('HR kecil');
  if ((coin.ath_change_percentage ?? -100) > -10) flags.push('dekat ATH');
  return {
    id: coin.id, ticker: coin.symbol.toUpperCase(), name: coin.name, category, price: coin.current_price ?? 0, mc, fdv,
    hrAnn, mcHr, hrGrowth: growth == null ? null : growth * 100, runRate, chg30d,
    score: Math.round(1000 * (0.40 * val + 0.20 * gro + 0.15 * dur + 0.10 * dil + 0.15 * crw)) / 10,
    parts: { val: Math.round(val * 100), gro: Math.round(gro * 100), dur: Math.round(dur * 100), dil: Math.round(dil * 100), crw: Math.round(crw * 100) },
    flags,
  };
}

export function shortlist(rows: ScreenRow[]) {
  return rows.filter((row) => row.mcHr <= SHORTLIST_MAX_MC_HR).sort((left, right) => right.score - left.score).slice(0, SHORTLIST_SIZE);
}

/** Replaces the analyst's finalist pick with explicit, auditable rules. */
export function selectFinalists(rows: ScreenRow[], binanceBases: Set<string>) {
  const finalists: ScreenRow[] = [];
  const rejected: Array<{ ticker: string; reason: string }> = [];
  for (const row of shortlist(rows)) {
    const flag = row.flags.find((item) => FINALIST_EXCLUDED_FLAGS.includes(item));
    if (row.score < FINALIST_MIN_SCORE) rejected.push({ ticker: row.ticker, reason: `skor ${row.score} < ${FINALIST_MIN_SCORE}` });
    else if (flag) rejected.push({ ticker: row.ticker, reason: `flag ${flag}` });
    else if (!binanceBases.has(row.ticker.toLowerCase())) rejected.push({ ticker: row.ticker, reason: 'tidak ada di Binance Spot USDT' });
    else if (finalists.length >= FINALIST_COUNT) rejected.push({ ticker: row.ticker, reason: `kuota ${FINALIST_COUNT} finalis penuh` });
    else finalists.push(row);
  }
  return { finalists, rejected };
}

// ---- technicals (same formulas as crypto-desk daily_report.py) ----

function ema(values: number[], period: number): Array<number | null> {
  const k = 2 / (period + 1); let current: number | null = null;
  return values.map((value, index) => { current = current == null ? value : value * k + current * (1 - k); return index >= period - 1 ? current : null; });
}

function pivots(high: number[], low: number[], window = 5) {
  const highs: number[] = []; const lows: number[] = [];
  for (let index = window; index < high.length - window; index += 1) {
    if (high[index] === Math.max(...high.slice(index - window, index + window + 1))) highs.push(index);
    if (low[index] === Math.min(...low.slice(index - window, index + window + 1))) lows.push(index);
  }
  return { highs, lows };
}

function volumeNodes(candles: Candle[], days = 90, bins = 24): Array<[number, number]> {
  const recent = candles.slice(-Math.min(days, candles.length));
  const top = Math.max(...recent.map((bar) => bar.high)); const bottom = Math.min(...recent.map((bar) => bar.low));
  const step = (top - bottom) / bins || 1e-12; const buckets = new Array<number>(bins).fill(0);
  for (const bar of recent) {
    const typical = (bar.high + bar.low + bar.close) / 3;
    // crypto-desk weights by quote volume; base volume x typical price approximates it.
    buckets[Math.min(Math.floor((typical - bottom) / step), bins - 1)]! += bar.volume * typical;
  }
  return [...buckets.keys()].sort((left, right) => buckets[right]! - buckets[left]!).slice(0, 3)
    .map((bucket): [number, number] => [bottom + step * bucket, bottom + step * (bucket + 1)]).sort((left, right) => right[0] - left[0]);
}

export function technicals(candles: Candle[]) {
  const high = candles.map((bar) => bar.high); const low = candles.map((bar) => bar.low); const close = candles.map((bar) => bar.close);
  const last = close.at(-1)!;
  const ema20 = ema(close, 20).at(-1) ?? null; const ema50 = ema(close, 50).at(-1) ?? null; const ema200 = ema(close, 200).at(-1) ?? null;
  const { highs, lows } = pivots(high, low);
  const resistance = [...new Set(highs.map((index) => high[index]!).filter((value) => value > last))].sort((a, b) => a - b).slice(0, 3);
  const support = [...new Set(lows.map((index) => low[index]!).filter((value) => value < last))].sort((a, b) => b - a).slice(0, 3);
  const span = Math.min(150, close.length);
  let lowIndex = close.length - span;
  for (let index = lowIndex; index < close.length; index += 1) if (low[index]! < low[lowIndex]!) lowIndex = index;
  let highIndex = lowIndex;
  for (let index = lowIndex; index < close.length; index += 1) if (high[index]! > high[highIndex]!) highIndex = index;
  const fibLow = low[lowIndex]!; const fibHigh = high[highIndex]!;
  const trend = ema50 != null && ema20 != null && last > ema20 && ema20 > ema50 ? 'naik' : ema50 != null && ema20 != null && last < ema20 && ema20 < ema50 ? 'turun' : 'campuran';
  return {
    close: last, ema20, ema50, ema200, trend,
    hi30: Math.max(...high.slice(-30)), lo30: Math.min(...low.slice(-30)),
    resistance, support, volumeNodes: volumeNodes(candles),
    fib: { f382: fibHigh - (fibHigh - fibLow) * 0.382, f5: fibHigh - (fibHigh - fibLow) * 0.5 },
  };
}

/** ta_scan.py draft: pullback zone at the nearest EMA20/fib/volume levels below price. */
export function draftPullback(t: ReturnType<typeof technicals>) {
  const close = t.close;
  const below = [t.ema20, t.fib.f382, t.fib.f5, ...t.volumeNodes.map((node) => node[1])]
    .filter((value): value is number => value != null && value < close).sort((a, b) => b - a);
  const zoneHigh = below[0] ?? close * 0.95;
  const zoneLow = below.length > 1 && below[1]! > zoneHigh * 0.9 ? below[1]! : zoneHigh * 0.95;
  const lower = t.support.filter((value) => value < zoneLow);
  const stop = (lower[0] ?? zoneLow * 0.92) * 0.985;
  const highs = t.resistance.filter((value) => value > close);
  const targets = [...new Set([...(highs.length ? highs : [t.hi30]), t.hi30].filter((value) => value > close))].sort((a, b) => a - b).slice(0, 3);
  return { entry: [zoneLow, zoneHigh] as [number, number], stop, targets };
}

/** Journal rule: green above daily EMA50; red below the lower of EMA50/EMA200. */
export function btcFilterLevels(btcCandles: Candle[]) {
  const t = technicals(btcCandles);
  const greenAbove = t.ema50 ?? t.close;
  return { greenAbove: Math.round(greenAbove), redBelow: Math.round(Math.min(greenAbove, t.ema200 ?? greenAbove)) };
}

function percent(value: number | null, digits = 0) { return value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`; }

export function finalistAsset(row: ScreenRow, candles: Candle[]): JournalAsset {
  const t = technicals(candles);
  const draft = draftPullback(t);
  return {
    ticker: row.ticker, name: row.name, score: Math.round(row.score) / 10,
    verdict: `Finalis screen otomatis · tren harian ${t.trend}`,
    thesis: `MC/HR ${row.mcHr.toFixed(1)}x · holder revenue ${(row.hrAnn / 1e6).toFixed(0)} jt USD/thn (${percent(row.hrGrowth)} 30h) · harga 30h ${percent(row.chg30d)}`,
    invalidation: `Close harian di bawah ${draft.stop.toPrecision(4)} atau keluar dari shortlist screen`,
    setups: [{ name: 'A · Pullback (draf otomatis)', kind: 'pullback', primary: true, entry: draft.entry, stop: draft.stop, targets: draft.targets }],
  };
}

export function buildFeed(input: {
  now: Date; reportDate: string; btcCandles: Candle[]; finalists: Array<{ row: ScreenRow; candles: Candle[] }>;
}): JournalFeed {
  return {
    version: 1, source: 'asymmetry-screen', reportDate: input.reportDate, generatedAt: input.now.toISOString(),
    headline: `Screen otomatis: ${input.finalists.map(({ row }) => row.ticker).join(', ') || 'tidak ada finalis'}`,
    btcFilter: btcFilterLevels(input.btcCandles),
    assets: input.finalists.map(({ row, candles }) => finalistAsset(row, candles)),
  };
}
