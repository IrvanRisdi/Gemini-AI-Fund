import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fetchBulkIdrPrices } from './market-data';


function normalizeIndodaxKey(rawPair: string): string {
  const clean = rawPair.replace('/', '').toLowerCase();
  return clean.endsWith('idr') ? clean.replace(/idr$/, '_idr') : `${clean}_idr`;
}

function getDeskDir(): string {
  const candidates = [
    path.join(process.cwd(), '.desk'),
    path.join(process.cwd(), '..', '.desk'),
    path.join(process.cwd(), 'dashboard', '.desk'),
    path.resolve('.desk'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return path.join(process.cwd(), '.desk');
}

export interface LedgerTrade {
  timestamp: string;
  instrument: string;
  side: 'long';
  type: 'open' | 'close' | 'add';
  size: number;
  price: number;
  realizedPnlIdr?: number;
  reason: string;
}

export interface LedgerPosition {
  side: 'long';
  size: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice?: number;
  opened: string;
  sizingNote?: string;
  campaignId?: string;
  leg?: number;
}

export interface PendingOrder {
  id: string;
  campaignId: string;
  pair: string;
  side: 'long';
  type: 'limit' | 'stop';
  entryLow: number;
  entryHigh: number;
  stopPrice: number;
  targetPrice: number;
  riskReservedIdr: number;
  expiresAt: string;
  createdAt: string;
  status: 'pending' | 'filled' | 'cancelled' | 'expired' | 'rejected';
  confirmations: string[];
  reason: string;
}

interface LedgerAgent {
  active?: boolean;
  fired?: string;
  fired_reason?: string;
  balance: { IDR: number };
  positions: Record<string, LedgerPosition>;
  trades: LedgerTrade[];
  pendingOrders?: PendingOrder[];
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

export interface LatestScanCandidate {
  pair: string;
  agent: string;
  reason: string;
  data?: Record<string, number>;
}

export interface LatestScan {
  timestamp: string;
  pairsScanned: number;
  candidates: LatestScanCandidate[];
  errors: string[];
}

export interface AgentSummary {
  slug: string;
  status: 'active' | 'fired';
  equity: number; // Nilai Ekuitas Mark-to-Market (Kas + Floating PnL)
  cash: number;   // Saldo Kas
  unrealizedPnlIdr: number;
  balance: number; // Kompatibilitas komponen
  startingBalance: number;
  pnlIdr: number;
  pnlPct: number;
  openPositions: LedgerPosition[];
  openPairs: string[];
  pendingOrders: PendingOrder[];
  latestTrade: LedgerTrade | null;
  lastAction: string;
}

export interface DeskSnapshot {
  lastCycle: string;
  deskMode: string;
  totalEquity: number; // Total Ekuitas seluruh agen
  totalCash: number;   // Total Saldo Kas seluruh agen
  totalUnrealizedPnl: number;
  startingTotal: number;
  agents: AgentSummary[];
  riskLimits: Record<string, number | string> | null;
  latestScanCandidates?: LatestScanCandidate[];
}

export const DEFAULT_AGENTS = [
  'mean-reversion-trader',
  'smc-trader',
  'breakout-specialist',
  'wyckoff-trader',
  'aggressive-breakout-trader',
];

const DEFAULT_STARTING_BALANCE = 50000000;
const GITHUB_DESK_BASE = 'https://raw.githubusercontent.com/IrvanRisdi/Gemini-AI-Fund/main/.desk';

async function readJson<T>(file: string): Promise<T | null> {
  try {
    // Paper-loop commits update GitHub every cycle. Read that source first so
    // production does not need a full Vercel deployment every 15 minutes.
    const response = await fetch(`${GITHUB_DESK_BASE}/${file}`, {
      next: { revalidate: 60 },
    });
    if (response.ok) return await response.json() as T;
  } catch {
    // Fall through to the bundled desk snapshot for local/offline resilience.
  }

  try {
    const dir = getDeskDir();
    const fullPath = path.join(dir, file);
    if (!existsSync(fullPath)) return null;
    const raw = await readFile(fullPath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getDeskSnapshot(): Promise<DeskSnapshot> {
  const [ledger, state, scan, prices] = await Promise.all([
    readJson<PaperLedger>('paper-ledger.json'),
    readJson<DeskState>('state.json'),
    readJson<LatestScan>('latest-scan.json'),
    fetchBulkIdrPrices().catch(() => ({} as Record<string, number>)),
  ]);

  const defaultStartingBalance = DEFAULT_STARTING_BALANCE;
  let lastCycle = scan?.timestamp || ledger?.last_cycle || new Date().toISOString();

  if (!ledger || !state) {
    const agents: AgentSummary[] = DEFAULT_AGENTS.map((slug) => {
      const agentCandidates = scan?.candidates?.filter((c) => c.agent === slug) ?? [];
      const lastAction = agentCandidates.length > 0
        ? `⚡ Signal: ${agentCandidates.map((c) => `${c.pair.toUpperCase()} (${c.reason})`).join(' | ')}`
        : 'Active — awaiting next 15-min scan cycle';

      return {
        slug,
        status: 'active',
        equity: defaultStartingBalance,
        cash: defaultStartingBalance,
        unrealizedPnlIdr: 0,
        balance: defaultStartingBalance,
        startingBalance: defaultStartingBalance,
        pnlIdr: 0,
        pnlPct: 0,
        openPositions: [],
        openPairs: [],
        pendingOrders: [],
        latestTrade: null,
        lastAction,
      };
    });

    return {
      lastCycle,
      deskMode: 'paper (local-simulation)',
      totalEquity: agents.length * defaultStartingBalance,
      totalCash: agents.length * defaultStartingBalance,
      totalUnrealizedPnl: 0,
      startingTotal: agents.length * defaultStartingBalance,
      agents,
      riskLimits: {
        max_position_size_pct: 100,
        max_portfolio_drawdown_pct: 10,
        stop_loss_required: 1,
      },
      latestScanCandidates: (scan?.candidates ?? []).filter((candidate) => DEFAULT_AGENTS.includes(candidate.agent)),
    };
  }

  const activeRoster = Object.keys(state.agents || {}).filter(
    (slug) => state.agents[slug]?.status === 'active' && ledger.agents?.[slug]?.balance
  );

  const rosterToUse = activeRoster.length > 0 ? activeRoster : DEFAULT_AGENTS;

  const agents: AgentSummary[] = rosterToUse.map((slug) => {
    const book = ledger.agents?.[slug];
    const stateAgent = state.agents?.[slug];
    const startingBal = ledger.starting_balance_per_agent || defaultStartingBalance;
    const cash = book?.balance?.IDR ?? startingBal;
    
    // Hitung Floating PnL secara Real-Time berdasarkan harga Indodax saat ini
    let unrealizedPnl = 0;
    const rawPositions = book?.positions ?? {};
    const positionsList: LedgerPosition[] = [];

    for (const [pair, pos] of Object.entries(rawPositions)) {
      positionsList.push(pos);
      const tickerKey = normalizeIndodaxKey(pair);
      const currentPrice = prices[tickerKey] ?? pos.entryPrice;
      const posPnl = pos.side === 'long'
        ? (currentPrice - pos.entryPrice) * pos.size
        : (pos.entryPrice - currentPrice) * pos.size;
      unrealizedPnl += posPnl;
    }

    // Ekuitas = Kas + Laba/Rugi Posisi Terbuka
    const equity = cash + unrealizedPnl;
    const pnlIdr = equity - startingBal;
    const pnlPct = startingBal > 0 ? (pnlIdr / startingBal) * 100 : 0;

    const trades = book?.trades ?? [];
    const pendingOrders = (book?.pendingOrders ?? []).filter((order) => order.status === 'pending');
    const latestTrade = trades.length
      ? [...trades].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
      : null;

    const agentCandidates = scan?.candidates?.filter((c) => c.agent === slug) ?? [];
    let lastAction = stateAgent?.last_action ?? 'Active';
    if (agentCandidates.length > 0) {
      lastAction = `⚡ Signal: ${agentCandidates.map((c) => `${c.pair.toUpperCase()} — ${c.reason}`).join(' | ')}`;
    }

    return {
      slug,
      status: stateAgent?.status ?? 'active',
      equity,
      cash,
      unrealizedPnlIdr: unrealizedPnl,
      balance: equity,
      startingBalance: startingBal,
      pnlIdr,
      pnlPct,
      openPositions: positionsList,
      openPairs: Object.keys(rawPositions),
      pendingOrders,
      latestTrade,
      lastAction,
    };
  });

  const totalEquity = agents.reduce((sum, a) => sum + a.equity, 0);
  const totalCash = agents.reduce((sum, a) => sum + a.cash, 0);
  const totalUnrealizedPnl = agents.reduce((sum, a) => sum + a.unrealizedPnlIdr, 0);
  const startingTotal = agents.length * (ledger.starting_balance_per_agent || defaultStartingBalance);

  const activeCandidates = (scan?.candidates ?? []).filter((candidate) =>
    rosterToUse.includes(candidate.agent),
  );

  return {
    lastCycle,
    deskMode: state.desk?.mode || 'paper',
    totalEquity,
    totalCash,
    totalUnrealizedPnl,
    startingTotal,
    agents,
    riskLimits: state.agents?.['risk-manager']?.risk_limits ?? null,
    latestScanCandidates: activeCandidates,
  };
}

export async function getBriefingExcerpt(slug: string, maxChars = 2400): Promise<string> {
  try {
    const dir = getDeskDir();
    const fullPath = path.join(dir, 'briefings', `${slug}.md`);
    if (!existsSync(fullPath)) return `# ${slug}\n\nActive strategy persona on Gemini AI-Fund desk.`;
    const raw = await readFile(fullPath, 'utf8');
    return raw.length > maxChars ? raw.slice(0, maxChars) + '\n…' : raw;
  } catch {
    return `# ${slug}\n\nActive strategy persona on Gemini AI-Fund desk.`;
  }
}

export async function getFullBriefing(slug: string): Promise<string | null> {
  try {
    const dir = getDeskDir();
    const fullPath = path.join(dir, 'briefings', `${slug}.md`);
    if (!existsSync(fullPath)) return `# ${slug}\n\nActive strategy persona on Gemini AI-Fund desk.`;
    return await readFile(fullPath, 'utf8');
  } catch {
    return `# ${slug}\n\nActive strategy persona on Gemini AI-Fund desk.`;
  }
}

export async function getAgentTrades(slug: string): Promise<LedgerTrade[]> {
  try {
    const ledger = await readJson<PaperLedger>('paper-ledger.json');
    const trades = ledger?.agents?.[slug]?.trades ?? [];
    return [...trades].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch {
    return [];
  }
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
  pendingOrders: PendingOrder[];
}

export async function getAgentBookBreakdown(slug: string): Promise<AgentBookBreakdown> {
  try {
    const ledger = await readJson<PaperLedger>('paper-ledger.json');
    const book = ledger?.agents?.[slug];
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
        if (!building) continue;
        const totalSize = building.legs.reduce((sum, l) => sum + l.size, 0);
        const weightedEntry = building.legs.reduce((sum, l) => sum + l.size * l.price, 0) / (totalSize || 1);
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

    const stillOpen = [...openByInstrument.entries()];
    const prices = (stillOpen.length > 0 ? await fetchBulkIdrPrices().catch(() => ({})) : {}) as Record<string, number>;

    let openPositionValue = 0;
    let unrealizedPnlIdr = 0;

    for (const [instrument, building] of stillOpen) {
      const totalSize = building.legs.reduce((sum, l) => sum + l.size, 0);
      const weightedEntry = building.legs.reduce((sum, l) => sum + l.size * l.price, 0) / (totalSize || 1);
      const tickerKey = normalizeIndodaxKey(instrument);
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

    // Jumlahkan hanya trade yang benar-benar closed. `cash - startingBalance`
    // SALAH di sini: cash juga turun saat posisi dibuka (notional terpotong),
    // itu modal yang berpindah jadi aset yang dipegang, bukan rugi realized.
    const realizedPnlIdr = cycles
      .filter((cycle) => cycle.status === 'closed')
      .reduce((sum, cycle) => sum + (cycle.realizedPnlIdr ?? 0), 0);

    return {
      cash: book?.balance?.IDR ?? DEFAULT_STARTING_BALANCE,
      openPositionValue,
      realizedPnlIdr,
      unrealizedPnlIdr,
      cycles,
      pendingOrders: (book?.pendingOrders ?? []).filter((order) => order.status === 'pending').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  } catch {
    return {
      cash: DEFAULT_STARTING_BALANCE,
      openPositionValue: 0,
      realizedPnlIdr: 0,
      unrealizedPnlIdr: 0,
      cycles: [],
      pendingOrders: [],
    };
  }
}

export async function listBriefingSlugs(): Promise<string[]> {
  try {
    const dir = getDeskDir();
    const briefingsPath = path.join(dir, 'briefings');
    if (!existsSync(briefingsPath)) return DEFAULT_AGENTS;
    const files = await readdir(briefingsPath);
    const slugs = files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
    const [ledger, state] = await Promise.all([
      readJson<PaperLedger>('paper-ledger.json'),
      readJson<DeskState>('state.json'),
    ]);
    const activeStrategySlugs = new Set(
      Object.keys(state?.agents ?? {}).filter(
        (slug) => state?.agents[slug]?.status === 'active' && ledger?.agents?.[slug]?.balance,
      ),
    );
    const activeBriefings = slugs.filter((slug) => activeStrategySlugs.has(slug));
    return activeBriefings.length > 0 ? activeBriefings : DEFAULT_AGENTS;
  } catch {
    return DEFAULT_AGENTS;
  }
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

export async function getAgentMeta(slug: string): Promise<AgentMeta> {
  try {
    const [ledger, state] = await Promise.all([
      readJson<PaperLedger>('paper-ledger.json'),
      readJson<DeskState & { agents: Record<string, StateAgent & { assets_covered?: string[] }> }>('state.json'),
    ]);

    const stateAgent = state?.agents?.[slug];
    const book = ledger?.agents?.[slug];
    const hasBook = !!book?.balance;
    const startingBal = ledger?.starting_balance_per_agent ?? DEFAULT_STARTING_BALANCE;
    const pnlIdr = hasBook && ledger ? book!.balance.IDR - startingBal : 0;

    const trades = book?.trades ?? [];
    const latestTrade = trades.length ? [...trades].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] : null;

    return {
      slug,
      status: stateAgent?.status ?? (book?.active === false ? 'fired' : 'active'),
      hired: stateAgent?.hired ?? '2026-07-13',
      firedDate: stateAgent?.fired_date ?? (book as { fired?: string } | undefined)?.fired ?? null,
      fireReason: stateAgent?.fire_reason ?? (book as { fired_reason?: string } | undefined)?.fired_reason ?? null,
      lastAction: stateAgent?.last_action ?? 'Active',
      assetsCovered: stateAgent?.assets_covered ?? [],
      hasBook,
      balance: hasBook ? book!.balance.IDR : startingBal,
      startingBalance: startingBal,
      pnlIdr,
      pnlPct: (pnlIdr / startingBal) * 100,
      openPositions: hasBook ? Object.values(book!.positions ?? {}) : [],
      latestTrade,
    };
  } catch {
    return {
      slug,
      status: 'active',
      hired: '2026-07-13',
      firedDate: null,
      fireReason: null,
      lastAction: 'Active',
      assetsCovered: [],
      hasBook: true,
      balance: DEFAULT_STARTING_BALANCE,
      startingBalance: DEFAULT_STARTING_BALANCE,
      pnlIdr: 0,
      pnlPct: 0,
      openPositions: [],
      latestTrade: null,
    };
  }
}

