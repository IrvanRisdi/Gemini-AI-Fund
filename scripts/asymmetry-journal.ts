/** Asymmetry Journal agent: turns the daily asymmetry feed (built in GitHub
 * Actions by asymmetry-screen.ts, following the "Jurnal Asimetri Kripto"
 * method) into spot paper candidates. The feed owns the finalists, levels, and
 * BTC filter; this module only checks that a plan is still executable. */
import { validNetPlan } from './trading-math.js';

export const JOURNAL_AGENT = 'asymmetry-journal-trader';
export const JOURNAL_FEED_PATH = '.desk/asymmetry-feed.json';
/** The feed is rebuilt daily; one failed rebuild is tolerated before blocking. */
export const JOURNAL_MAX_AGE_HOURS = 48;
export const JOURNAL_MIN_SCORE = 5.5;
export const JOURNAL_MIN_NET_RR = 1.5;
export const JOURNAL_ORDER_TTL_HOURS = 26;
const JOURNAL_ALLOCATION_PCT = 0.25;

export interface JournalSetup {
  name: string;
  kind: 'pullback' | 'breakout' | 'trail' | string;
  primary?: boolean;
  trigger?: number;
  entry: [number, number] | null;
  stop: number | null;
  targets: number[];
}

export interface JournalAsset {
  ticker: string;
  name?: string;
  score: number | null;
  verdict: string;
  thesis?: string;
  invalidation?: string;
  setups: JournalSetup[];
}

export interface JournalFeed {
  version: 1;
  source: 'asymmetry-screen';
  reportDate: string;
  generatedAt: string;
  headline?: string;
  btcFilter: { greenAbove: number; redBelow: number };
  assets: JournalAsset[];
}

export interface JournalPlan { pair: string; type: 'limit' | 'stop'; entryLow: number; entryHigh: number; stopPrice: number; targetPrice: number }

export interface JournalCandidate extends JournalPlan {
  id: string; agent: typeof JOURNAL_AGENT; side: 'long'; quoteCurrency: 'USDT'; timeframe: '1d'; expiresAt: string;
  confirmations: string[]; reason: string; score: number; volumeRatio: number; allocationPct: number;
  rewardMultiple: number; validationStatus: 'research'; strategyVersion: string;
}

export interface JournalDecision { ticker: string; setup?: string; action: 'candidate' | 'skip'; reason: string }

export interface JournalScan {
  status: 'active' | 'blocked' | 'unavailable';
  reportDate: string | null;
  btcFilter: 'green' | 'yellow' | 'red' | 'unknown';
  reason: string;
  /** Price-independent plans the current report endorses; pending orders outside this list are withdrawn. */
  plans: JournalPlan[];
  candidates: JournalCandidate[];
  decisions: JournalDecision[];
}

function pairFor(ticker: string) { return `${ticker.toLowerCase()}idr`; }

function btcFilterState(feed: JournalFeed, btcPrice: number | undefined): JournalScan['btcFilter'] {
  if (!btcPrice) return 'unknown';
  if (btcPrice >= feed.btcFilter.greenAbove) return 'green';
  if (btcPrice < feed.btcFilter.redBelow) return 'red';
  return 'yellow';
}

/** First journal target that clears the desk's net reward/risk floor. */
function executableTarget(entryHigh: number, stop: number, targets: number[]) {
  return [...targets].sort((left, right) => left - right).find((target) => validNetPlan(entryHigh, stop, target, JOURNAL_MIN_NET_RR));
}

/** Converts a journal setup into order levels, independent of the current price. */
function setupPlan(asset: JournalAsset, setup: JournalSetup): JournalPlan | { skip: string } {
  if (!setup.entry || setup.stop == null || setup.targets.length === 0) return { skip: 'setup tanpa entry/stop/target' };
  const [low, high] = [Math.min(...setup.entry), Math.max(...setup.entry)];
  const stop = setup.stop;
  if (setup.kind === 'pullback') {
    const target = executableTarget(high, stop, setup.targets);
    if (!target) return { skip: `tidak ada target dengan R:R bersih ≥ ${JOURNAL_MIN_NET_RR} dari entry ${high}` };
    return { pair: pairFor(asset.ticker), type: 'limit', entryLow: low, entryHigh: high, stopPrice: stop, targetPrice: target };
  }
  if (setup.kind === 'breakout') {
    const trigger = setup.trigger ?? low;
    const target = executableTarget(trigger, stop, setup.targets);
    if (!target) return { skip: `tidak ada target dengan R:R bersih ≥ ${JOURNAL_MIN_NET_RR} dari pemicu ${trigger}` };
    return { pair: pairFor(asset.ticker), type: 'stop', entryLow: trigger, entryHigh: trigger, stopPrice: stop, targetPrice: target };
  }
  return { skip: `jenis setup "${setup.kind}" tidak dieksekusi` };
}

/** Why a new order may not be placed for the plan at the current price. */
function priceBlocker(plan: JournalPlan, price: number): string | null {
  if (price <= plan.stopPrice) return `harga ${price} sudah di bawah stop ${plan.stopPrice}`;
  // The journal prefers retests to chasing: an already-triggered breakout
  // is skipped rather than bought at whatever the market offers now.
  if (plan.type === 'stop' && price >= plan.entryHigh) return `breakout sudah terpicu (harga ${price} ≥ pemicu ${plan.entryHigh}); tidak mengejar`;
  return null;
}

/**
 * Only the feed's primary setup is traded, only for scored finalists that
 * Binance quotes, and only while the feed's BTC filter is green.
 */
export function journalCandidates(
  feed: JournalFeed | null,
  options: { now: Date; pricesUsdt: Record<string, number>; strategyVersion: string },
): JournalScan {
  const empty = { plans: [], candidates: [], decisions: [] };
  if (!feed || feed.source !== 'asymmetry-screen' || !Array.isArray(feed.assets)) {
    return { status: 'unavailable', reportDate: null, btcFilter: 'unknown', reason: 'Feed asimetri tidak tersedia', ...empty };
  }
  const ageHours = (options.now.getTime() - Date.parse(feed.generatedAt)) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours > JOURNAL_MAX_AGE_HOURS) {
    return { status: 'blocked', reportDate: feed.reportDate, btcFilter: 'unknown', reason: `Feed asimetri kedaluwarsa (${Number.isFinite(ageHours) ? ageHours.toFixed(0) : '?'} jam > ${JOURNAL_MAX_AGE_HOURS} jam)`, ...empty };
  }
  const btcFilter = btcFilterState(feed, options.pricesUsdt.btc_usdt);
  if (btcFilter === 'unknown') return { status: 'unavailable', reportDate: feed.reportDate, btcFilter, reason: 'Harga BTC tidak tersedia', ...empty };
  if (btcFilter !== 'green') {
    return { status: 'blocked', reportDate: feed.reportDate, btcFilter, reason: `Filter BTC ${btcFilter}: entry baru hanya saat BTC ≥ ${feed.btcFilter.greenAbove} (EMA50 harian)`, ...empty };
  }

  const expiresAt = new Date(options.now.getTime() + JOURNAL_ORDER_TTL_HOURS * 3_600_000).toISOString();
  const plans: JournalPlan[] = [];
  const candidates: JournalCandidate[] = [];
  const decisions: JournalDecision[] = [];
  for (const asset of feed.assets) {
    const price = options.pricesUsdt[`${asset.ticker.toLowerCase()}_usdt`];
    if (asset.score == null || asset.score < JOURNAL_MIN_SCORE) { decisions.push({ ticker: asset.ticker, action: 'skip', reason: `skor ${asset.score ?? 'kosong'} < ${JOURNAL_MIN_SCORE} · ${asset.verdict}` }); continue; }
    if (!price) { decisions.push({ ticker: asset.ticker, action: 'skip', reason: 'tidak tersedia di Binance Spot USDT' }); continue; }
    const setup = asset.setups.find((item) => item.primary);
    if (!setup) { decisions.push({ ticker: asset.ticker, action: 'skip', reason: 'tidak ada setup utama' }); continue; }
    const plan = setupPlan(asset, setup);
    if ('skip' in plan) { decisions.push({ ticker: asset.ticker, setup: setup.name, action: 'skip', reason: plan.skip }); continue; }
    plans.push(plan);
    const blocker = priceBlocker(plan, price);
    if (blocker) { decisions.push({ ticker: asset.ticker, setup: setup.name, action: 'skip', reason: blocker }); continue; }
    candidates.push({
      ...plan, id: `${JOURNAL_AGENT}-${asset.ticker.toLowerCase()}-${options.now.getTime()}`, agent: JOURNAL_AGENT, side: 'long', quoteCurrency: 'USDT', timeframe: '1d', expiresAt,
      confirmations: [`Finalis ${feed.reportDate} · skor ${asset.score}/10 · ${asset.verdict}`, `Setup utama: ${setup.name}`, `Invalidasi: ${asset.invalidation ?? '—'}`],
      reason: `Asimetri: ${asset.thesis ?? asset.verdict}`,
      score: asset.score, volumeRatio: 0, allocationPct: JOURNAL_ALLOCATION_PCT, rewardMultiple: JOURNAL_MIN_NET_RR, validationStatus: 'research', strategyVersion: options.strategyVersion,
    });
    decisions.push({ ticker: asset.ticker, setup: setup.name, action: 'candidate', reason: `${plan.type} ${plan.entryLow}–${plan.entryHigh}, stop ${plan.stopPrice}, target ${plan.targetPrice}` });
  }
  return { status: 'active', reportDate: feed.reportDate, btcFilter, reason: `Filter BTC hijau · ${candidates.length} setup dapat dieksekusi`, plans, candidates, decisions };
}

type OrderLevels = { pair: string; entryLow: number; entryHigh: number; stopPrice: number; targetPrice: number };

/**
 * A pending journal order is stale when the latest report no longer endorses
 * the same plan. An unavailable feed or price keeps orders: a missing file or
 * network error is not a research decision.
 */
export function staleJournalOrder(order: OrderLevels, scan: JournalScan | undefined) {
  if (!scan || scan.status === 'unavailable') return false;
  return !(scan.plans ?? []).some((plan) => plan.pair === order.pair
    && plan.entryLow === order.entryLow && plan.entryHigh === order.entryHigh
    && plan.stopPrice === order.stopPrice && plan.targetPrice === order.targetPrice);
}
