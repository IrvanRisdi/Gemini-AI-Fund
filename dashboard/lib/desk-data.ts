import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fetchBulkIdrPrices } from './market-data';

// The dashboard workspace lives at <repo>/dashboard, .desk state lives at <repo>/.desk
const DESK_DIR = path.join(process.cwd(), '..', '.desk');

export interface LedgerTrade {
  timestamp: string;
  instrument: string;
  side: 'long' | 'short';
  type: 'open' | 'close' | 'add';
  size: number;
  price: number;
  realizedPnlIdr?: number;
  reason: string;
}

export interface LedgerPosition {
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  stopPrice: number;
  opened: string;
  sizingNote?: string;
}

interface LedgerAgent {
  active?: boolean;
  fired?: string;
  fired_reason?: string;
  balance: { IDR: number };
  positions: Record<string, LedgerPosition>;
  trades: LedgerTrade[];
}

interface PaperLedger {
  last_cycle: string;
  starting_balance_per_agent: number;
  base_currency: string;
  agents: Record<string, LedgerAgent>;
}

interface StateAgent {
  status: 'active' | 'fired';
  hired: string;
  last_action: string;
  fired_date?: string;
  fire_reason?: string;
  risk_limits?: Record<string, number | string>;
}

interface DeskState {
  desk: { created: string; last_session: string; mode: string };
  agents: Record<string, StateAgent>;
}

export interface AgentSummary {
  slug: string;
  status: 'active' | 'fired';
  balance: number;
  startingBalance: number;
  pnlIdr: number;
  pnlPct: number;
  openPositions: LedgerPosition[];
  openPairs: string[];
  latestTrade: LedgerTrade | null;
  lastAction: string;
}

export interface DeskSnapshot {
  lastCycle: string;
  deskMode: string;
  totalEquity: number;
  startingTotal: number;
  agents: AgentSummary[];
  riskLimits: Record<string, number | string> | null;
}

async function readJson<T>(file: string): Promise<T> {
  const raw = await readFile(path.join(DESK_DIR, file), 'utf8');
  return JSON.parse(raw) as T;
}

export async function getDeskSnapshot(): Promise<DeskSnapshot> {
  const [ledger, state] = await Promise.all([
    readJson<PaperLedger>('paper-ledger.json'),
    readJson<DeskState>('state.json'),
  ]);

  // Book-holding roster derived live from state.json + paper-ledger.json —
  // no hardcoded agent list to go stale every time something is hired/fired.
  // "Book-holding" = active in state.json AND has a balance entry in the
  // ledger (risk-manager/portfolio-manager/etc. are active but oversight-only,
  // no book, so they're naturally excluded here).
  const activeRoster = Object.keys(state.agents).filter(
    (slug) => state.agents[slug]?.status === 'active' && ledger.agents[slug]?.balance
  );

  const agents: AgentSummary[] = activeRoster.map((slug) => {
    const book = ledger.agents[slug];
    const stateAgent = state.agents[slug];
    const pnlIdr = book.balance.IDR - ledger.starting_balance_per_agent;
    const positions = Object.values(book.positions ?? {});
    const trades = book.trades ?? [];
    const latestTrade = trades.length
      ? [...trades].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
      : null;

    return {
      slug,
      status: stateAgent?.status ?? 'active',
      balance: book.balance.IDR,
      startingBalance: ledger.starting_balance_per_agent,
      pnlIdr,
      pnlPct: (pnlIdr / ledger.starting_balance_per_agent) * 100,
      openPositions: positions,
      openPairs: Object.keys(book.positions ?? {}),
      latestTrade,
      lastAction: stateAgent?.last_action ?? 'No recent action',
    };
  });

  const totalEquity = agents.reduce((sum, a) => sum + a.balance, 0);
  const startingTotal = agents.length * ledger.starting_balance_per_agent;

  return {
    lastCycle: ledger.last_cycle,
    deskMode: state.desk.mode,
    totalEquity,
    startingTotal,
    agents,
    riskLimits: state.agents['risk-manager']?.risk_limits ?? null,
  };
}

export async function getBriefingExcerpt(slug: string, maxChars = 2400): Promise<string> {
  try {
    const raw = await readFile(path.join(DESK_DIR, 'briefings', `${slug}.md`), 'utf8');
    return raw.length > maxChars ? raw.slice(0, maxChars) + '\n…' : raw;
  } catch {
    return `# ${slug}\n\nNo briefing on file yet.`;
  }
}

/** Full, untruncated briefing markdown — for the per-agent detail page. */
export async function getFullBriefing(slug: string): Promise<string | null> {
  try {
    return await readFile(path.join(DESK_DIR, 'briefings', `${slug}.md`), 'utf8');
  } catch {
    return null;
  }
}

/** Full trade history for one agent, newest first — the data behind the journal table. */
export async function getAgentTrades(slug: string): Promise<LedgerTrade[]> {
  const ledger = await readJson<PaperLedger>('paper-ledger.json').catch(() => null);
  const trades = ledger?.agents[slug]?.trades ?? [];
  return [...trades].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export interface PositionCycle {
  instrument: string;
  side: 'long' | 'short';
  status: 'open' | 'closed';
  entryPrice: number;
  size: number;
  exitPrice: number | null;
  currentPrice: number | null;
  stopPrice: number | null;
  openedAt: string;
  closedAt: string | null;
  realizedPnlIdr: number | null;
  unrealizedPnlIdr: number | null;
}

export interface AgentBookBreakdown {
  cash: number;
  openPositionValue: number;
  realizedPnlIdr: number;
  unrealizedPnlIdr: number;
  cycles: PositionCycle[];
}

/**
 * Reconstructs one row per round-trip position (not per buy/sell leg) by walking
 * each instrument's open/add/close trades in chronological order — an 'open' starts
 * a cycle, 'add' folds into its weighted-average entry, 'close' ends it. Whatever has
 * no matching close yet is still open, marked with live unrealized P&L off a single
 * bulk Indodax ticker fetch. Multiple round-trips on the same pair are handled
 * correctly since each close only consumes the most recent still-open cycle.
 */
export async function getAgentBookBreakdown(slug: string): Promise<AgentBookBreakdown> {
  const ledger = await readJson<PaperLedger>('paper-ledger.json').catch(() => null);
  const book = ledger?.agents[slug];
  const trades = book?.trades ?? [];
  const chronological = [...trades].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  interface Building {
    side: 'long' | 'short';
    openedAt: string;
    legs: { size: number; price: number }[];
  }
  const openByInstrument = new Map<string, Building>();
  const cycles: PositionCycle[] = [];

  for (const t of chronological) {
    const key = t.instrument;
    if (t.type === 'open') {
      openByInstrument.set(key, { side: t.side, openedAt: t.timestamp, legs: [{ size: t.size, price: t.price }] });
    } else if (t.type === 'add') {
      openByInstrument.get(key)?.legs.push({ size: t.size, price: t.price });
    } else if (t.type === 'close') {
      const building = openByInstrument.get(key);
      if (!building) continue; // close with no matching open in this trade log — skip rather than guess
      const totalSize = building.legs.reduce((sum, l) => sum + l.size, 0);
      const weightedEntry = building.legs.reduce((sum, l) => sum + l.size * l.price, 0) / totalSize;
      cycles.push({
        instrument: key,
        side: building.side,
        status: 'closed',
        entryPrice: weightedEntry,
        size: totalSize,
        exitPrice: t.price,
        currentPrice: null,
        stopPrice: null,
        openedAt: building.openedAt,
        closedAt: t.timestamp,
        realizedPnlIdr: t.realizedPnlIdr ?? null,
        unrealizedPnlIdr: null,
      });
      openByInstrument.delete(key);
    }
  }

  // Whatever's left open needs a live price for unrealized P&L — one bulk fetch covers every pair.
  const stillOpen = [...openByInstrument.entries()];
  const prices = stillOpen.length > 0 ? await fetchBulkIdrPrices() : {};

  let openPositionValue = 0;
  let unrealizedPnlIdr = 0;

  for (const [instrument, building] of stillOpen) {
    const totalSize = building.legs.reduce((sum, l) => sum + l.size, 0);
    const weightedEntry = building.legs.reduce((sum, l) => sum + l.size * l.price, 0) / totalSize;
    const tickerKey = `${instrument.split('/')[0].toLowerCase()}_idr`;
    const currentPrice = prices[tickerKey] ?? null;
    const positionValue = currentPrice != null ? totalSize * currentPrice : null;
    const unrealized =
      currentPrice != null
        ? building.side === 'long'
          ? totalSize * (currentPrice - weightedEntry)
          : totalSize * (weightedEntry - currentPrice)
        : null;

    if (positionValue != null) openPositionValue += positionValue;
    if (unrealized != null) unrealizedPnlIdr += unrealized;

    cycles.push({
      instrument,
      side: building.side,
      status: 'open',
      entryPrice: weightedEntry,
      size: totalSize,
      exitPrice: null,
      currentPrice,
      stopPrice: book?.positions?.[instrument]?.stopPrice ?? null,
      openedAt: building.openedAt,
      closedAt: null,
      realizedPnlIdr: null,
      unrealizedPnlIdr: unrealized,
    });
  }

  cycles.sort((a, b) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt));

  return {
    cash: book?.balance.IDR ?? 0,
    openPositionValue,
    realizedPnlIdr: book && ledger ? book.balance.IDR - ledger.starting_balance_per_agent : 0,
    unrealizedPnlIdr,
    cycles,
  };
}

export async function listBriefingSlugs(): Promise<string[]> {
  const files = await readdir(path.join(DESK_DIR, 'briefings'));
  return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
}

export interface AgentMeta {
  slug: string;
  status: 'active' | 'fired' | 'unknown';
  hired: string | null;
  firedDate: string | null;
  fireReason: string | null;
  lastAction: string | null;
  assetsCovered: string[];
  hasBook: boolean;
  balance: number | null;
  startingBalance: number | null;
  pnlIdr: number | null;
  pnlPct: number | null;
  openPositions: LedgerPosition[];
  latestTrade: LedgerTrade | null;
}

/** Full status + book context for one agent, whether it's active, fired, oversight-only, or book-holding. */
export async function getAgentMeta(slug: string): Promise<AgentMeta> {
  const [ledger, state] = await Promise.all([
    readJson<PaperLedger>('paper-ledger.json').catch(() => null),
    readJson<DeskState & { agents: Record<string, StateAgent & { assets_covered?: string[] }> }>('state.json').catch(() => null),
  ]);

  const stateAgent = state?.agents[slug];
  const book = ledger?.agents[slug];
  const hasBook = !!book?.balance;
  const pnlIdr = hasBook && ledger ? book!.balance.IDR - ledger.starting_balance_per_agent : null;

  const trades = book?.trades ?? [];
  const latestTrade = trades.length ? [...trades].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] : null;

  return {
    slug,
    status: stateAgent?.status ?? (book?.active === false ? 'fired' : 'unknown'),
    hired: stateAgent?.hired ?? null,
    firedDate: stateAgent?.fired_date ?? (book as { fired?: string } | undefined)?.fired ?? null,
    fireReason: stateAgent?.fire_reason ?? (book as { fired_reason?: string } | undefined)?.fired_reason ?? null,
    lastAction: stateAgent?.last_action ?? null,
    assetsCovered: stateAgent?.assets_covered ?? [],
    hasBook,
    balance: hasBook ? book!.balance.IDR : null,
    startingBalance: ledger?.starting_balance_per_agent ?? null,
    pnlIdr,
    pnlPct: pnlIdr != null && ledger ? (pnlIdr / ledger.starting_balance_per_agent) * 100 : null,
    openPositions: hasBook ? Object.values(book!.positions ?? {}) : [],
    latestTrade,
  };
}
