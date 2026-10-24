import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type Row = Record<string, unknown>;
export type StockAgent = { id: string; name: string; description: string; starting_equity: number; equity: number; pnl_pct: number; display_win_rate: number | null; status: string };
export type StockPosition = { id: number; agent_id: string; agent_name: string; symbol: string; lots: number; entry_price: number; last_price: number; stop_price?: number | null; target_price?: number | null; market_value: number; unrealized_pnl: number; pnl_pct: number };
export type StockScreenerRow = { symbol: string; name: string; sector?: string | null; subsector?: string | null; last_price?: number | null; change_pct?: number | null; evaluation_score?: number | null; evaluation_status?: string | null; market_data_as_of?: string | null; yahoo_status?: string | null; yahoo_retry_after?: string | null; intraday_rank?: number | null; is_intraday: boolean };
export type StockDashboard = { schema_version: number; generated_at: string; source_mode: string; paper_only: boolean; market_phase: string; latest_run: { status: string; started_at: string; completed_at?: string | null; symbols_ok: number; symbols_failed: number } | null; provider_usage: { requests_used: number; request_limit: number }; agents: StockAgent[]; positions: StockPosition[]; intraday_symbols: string[]; screener: StockScreenerRow[]; latest_report?: Row | null };
export type RuntimeState = { schema_version: number; exported_at: string; paper_only: boolean; tables: Record<string, Row[]> };
export type CompactCandle = [timestamp: number, open: number, high: number, low: number, close: number, volume: number];
export type StockChartSnapshot = { schema_version: number; symbol: string; generated_at: string; timeframes: Partial<Record<'5m' | '1d', { as_of: string; source: string; data_status: string; candles: CompactCandle[] }>> };

const RAW_BASE = 'https://raw.githubusercontent.com/IrvanRisdi/Gemini-AI-Fund/paper-data/stocks-engine/.stock-desk';
const CURRENT_RULESET = '2026-10-25.1';
const STRATEGIES: Record<string, { objective: string; timeframes: string; entry_rules: string[]; exit_rules: string[]; no_trade: string[] }> = {
  swing: { objective: 'Menangkap impuls tren harian ber-volatilitas terkendali dengan eksekusi pembukaan sesi berikutnya (Backtest PF 1,95).', timeframes: 'Daily untuk setup · eksekusi NEXT_OPEN · time stop 10 sesi', entry_rules: ['Close > EMA20 > EMA50 dan close ≥ VWAP20', 'RSI 52–66, RVOL ≥ 1,25×, close strength ≥ 0,55, dan ATR ≤ 3,5%', 'Kenaikan harian +0,5% s/d +4,0% dan jarak harga ≤ 6% di atas EMA20'], exit_rules: ['Stop struktural 1,2 ATR; naik ke breakeven bersih saat +1,2R', 'Target 2,4R kotor (≥ 1,55R bersih setelah fee)', 'Time stop 10 sesi perdagangan; tanpa averaging down'], no_trade: ['ATR > 3,5% atau harga terlalu jauh dari EMA20', 'Gap pembukaan > 2% atau di bawah stop', 'IHSG risk-off ekstrem'] },
  scalping: { objective: 'Menangkap breakout 20-bar intraday 5 menit ber-volume tinggi di atas VWAP (Backtest PF 2,46).', timeframes: '5m · delayed-paper', entry_rules: ['Harga menembus high 20-bar dan Close > EMA20 > EMA50', 'RVOL minimal 2,2×, close strength ≥ 0,60, dan RSI 55–72', 'Jarak di atas VWAP20 0,15–1,50%'], exit_rules: ['Stop max(1,8 ATR, 1,5% harga) agar fee 0,40% tetap kecil; risiko equity 1%', 'Target 2,2R bersih setelah fee', 'Posisi ditutup pada akhir sesi (15:45 WIB)'], no_trade: ['Candle stale atau di luar sesi kontinu IDX', 'Breakout dengan volume lemah (< 2,2×) atau wick atas panjang', 'Edge setelah biaya tidak memadai'] },
  'open-low': { objective: 'Mencari kekuatan opening drive ketika open bertahan sebagai low sesi (Backtest PF 1,26).', timeframes: '5m · 5–60 menit aktif pertama', entry_rules: ['Low maksimal satu tick di bawah open sesi', 'Close > VWAP20 dan Close > EMA20; RVOL ≥ 1,6×; close strength ≥ 0,60', 'Kenaikan dari open 0,50–3,00% dan RSI 55–72'], exit_rules: ['Stop satu tick di bawah open (minimal jarak risiko 2,0%); risiko equity 1,5%', 'Target 2,4R bersih setelah fee', 'Keluar akhir sesi (15:45 WIB); tanpa averaging down'], no_trade: ['Di luar 60 menit pertama', 'Belum aktif diperdagangkan', 'Candle stale atau lonjakan > 3% dari open'] },
  fundamental: { objective: 'Mengakumulasi emiten berkualitas tinggi (Quality ≥ 70, OCF > 0) yang terkonfirmasi dalam tren naik (Backtest PF 2,93).', timeframes: 'Quarterly · Daily timing · eksekusi NEXT_OPEN', entry_rules: ['Quality score ≥ 70, ROE positif, dan arus kas operasi positif', 'Close ≥ EMA20 ≥ EMA50, Close ≥ VWAP20, dan jarak ≤ 6% di atas EMA20', 'RVOL ≥ 1,05×, close strength ≥ 0,55, RSI 48–66, dan ATR ≤ 4,0%'], exit_rules: ['Stop 1,6 ATR; naik ke breakeven bersih saat +1,2R', 'Target 2,4R kotor dan time stop 15 sesi perdagangan', 'Keluar bila thesis fundamental rusak atau gap pembukaan invalid'], no_trade: ['Laporan tidak lengkap atau > 210 hari', 'Harga sedang downtrend di bawah EMA20/EMA50', 'Arus kas operasi negatif'] },
  'breakout-retest': { objective: 'Membeli retest resistance 20-hari yang terkonfirmasi memantul kuat dengan eksekusi NEXT_OPEN (Backtest PF 4,42).', timeframes: 'Daily breakout · retest maksimal 5 sesi · entry pembukaan sesi berikutnya', entry_rules: ['Close breakout melewati high 20 sesi; retest dalam 1–5 sesi menutup di atas level', 'Close > EMA20 > EMA50; RVOL minimal 1,25×; close strength ≥ 0,60; RSI 50–68', 'Perubahan harian positif (0% hingga +5%) dan ATR ≤ 4,5%; gap pembukaan maksimal +2%'], exit_rules: ['Stop di bawah level retest atau 1,2 ATR; breakeven bersih saat +1,2R', 'Target sekurangnya 2R kotor dan minimal 1,55R setelah fee; time stop 10 sesi', 'Keluar bila stop, target, atau plan kadaluarsa'], no_trade: ['Retest melewati 5 sesi atau close strength < 0,60', 'Gap pembukaan > 2% atau di bawah stop', 'Data tidak lengkap atau volume < 1,25× rata-rata'] },
};

async function readLocal<T>(file: string): Promise<T> {
  const candidates = [path.join(process.cwd(), '..', 'stocks-engine', '.stock-desk', file), path.join(process.cwd(), 'stocks-engine', '.stock-desk', file)];
  let failure: unknown;
  for (const candidate of candidates) { try { return JSON.parse(await readFile(candidate, 'utf8')) as T; } catch (error) { failure = error; } }
  throw failure;
}

async function readSnapshot<T>(file: string): Promise<T> {
  if (process.env.NODE_ENV !== 'production') { try { return await readLocal<T>(file); } catch { /* remote fallback */ } }
  // GitHub's raw branch URL can remain cached after paper-data advances. A
  // minute-scoped URL keeps Vercel's shared fetch cache bounded while forcing
  // the origin to resolve the current branch at least once each minute.
  const revision = Math.floor(Date.now() / 60_000);
  const response = await fetch(`${RAW_BASE}/${file}?v=${revision}`, { next: { revalidate: 60 } });
  if (!response.ok) return readLocal<T>(file);
  return response.json() as Promise<T>;
}

export const getStockDashboard = () => readSnapshot<StockDashboard>('dashboard.json');
export const getStockRuntime = () => readSnapshot<RuntimeState>('runtime-state.json');
const table = (state: RuntimeState, name: string) => state.tables[name] ?? [];
const n = (value: unknown) => Number(value ?? 0);
const s = (value: unknown) => String(value ?? '');
const byDateDesc = (key: string) => (a: Row, b: Row) => s(b[key]).localeCompare(s(a[key]));

function namedPositions(state: RuntimeState, agentId?: string, symbol?: string): StockPosition[] {
  const agents = new Map(table(state, 'agents').map((agent) => [s(agent.id), s(agent.name)]));
  return table(state, 'positions').filter((p) => s(p.status) === 'OPEN' && (!agentId || s(p.agent_id) === agentId) && (!symbol || s(p.symbol) === symbol)).map((p) => ({
    ...(p as object), id: n(p.id), agent_id: s(p.agent_id), agent_name: agents.get(s(p.agent_id)) ?? s(p.agent_id), symbol: s(p.symbol), lots: n(p.lots), entry_price: n(p.entry_price), last_price: n(p.last_price), stop_price: p.stop_price == null ? null : n(p.stop_price), target_price: p.target_price == null ? null : n(p.target_price), market_value: n(p.last_price) * n(p.lots) * 100, unrealized_pnl: (n(p.last_price) - n(p.entry_price)) * n(p.lots) * 100, pnl_pct: n(p.entry_price) ? (n(p.last_price) - n(p.entry_price)) / n(p.entry_price) * 100 : 0,
  }));
}

export async function getStockAgent(agentId: string) {
  const state = await getStockRuntime();
  const agent = table(state, 'agents').find((row) => s(row.id) === agentId);
  if (!agent) return null;
  const instruments = new Map(table(state, 'instruments').map((row) => [s(row.symbol), row]));
  const decisions = table(state, 'decisions').filter((row) => s(row.agent_id) === agentId).sort(byDateDesc('evaluated_at')).slice(0, 100).map((row) => ({ ...row, name: instruments.get(s(row.symbol))?.name ?? row.symbol }));
  const journal = table(state, 'trade_journal').filter((row) => s(row.agent_id) === agentId).sort(byDateDesc('opened_at'));
  const closed = journal.filter((row) => row.closed_at && s(row.strategy_version) === '2.0');
  const wins = closed.filter((row) => n(row.net_pnl) > 0);
  const losses = closed.filter((row) => n(row.net_pnl) < 0);
  const history = table(state, 'equity_history').filter((row) => s(row.agent_id) === agentId).sort((a, b) => s(a.equity_date).localeCompare(s(b.equity_date)));
  const positions = namedPositions(state, agentId);
  const pendingOrders = table(state, 'paper_orders').filter((row) => s(row.agent_id) === agentId && s(row.status) === 'PENDING').sort(byDateDesc('created_at'));
  const currentRuleset = CURRENT_RULESET;
  const cohort = closed.filter((row) => s(row.ruleset_version) === currentRuleset);
  const ledger = table(state, 'agent_ledgers').find((row) => s(row.agent_id) === agentId);
  const openBuyFees = positions.reduce((sum, row) => sum + n((row as unknown as Row).buy_fees), 0);
  const expectedEquity = n(agent.starting_equity) + n(ledger?.realized_pnl) + positions.reduce((sum, row) => sum + row.unrealized_pnl, 0) - openBuyFees;
  const reconciliationGap = n(agent.equity) - expectedEquity;
  return { ...agent, pnl_pct: n(agent.starting_equity) ? (n(agent.equity) - n(agent.starting_equity)) / n(agent.starting_equity) * 100 : 0, positions, pending_orders: pendingOrders, decisions, equity_history: history, trade_journal: journal, strategy: STRATEGIES[agentId],
    diagnostics: { ruleset: currentRuleset, closed_current: cohort.length, wins_current: cohort.filter((row) => n(row.net_pnl) > 0).length,
      net_current: cohort.reduce((sum, row) => sum + n(row.net_pnl), 0), gross_current: cohort.reduce((sum, row) => sum + n(row.gross_pnl), 0),
      fees_current: cohort.reduce((sum, row) => sum + n(row.fees), 0), gross_v2: closed.reduce((sum, row) => sum + n(row.gross_pnl), 0),
      fees_v2: closed.reduce((sum, row) => sum + n(row.fees), 0), legacy_closed: journal.filter((row) => s(row.strategy_version) !== '2.0').length,
      prior_v2_closed: closed.length - cohort.length, open_current: positions.filter((row) => s((row as unknown as Row).ruleset_version) === currentRuleset).length,
      reconciliation_gap: reconciliationGap },
    performance: { closed_trades: closed.length, wins: wins.length, win_rate: closed.length ? wins.length / closed.length * 100 : null, net_pnl: closed.reduce((sum, row) => sum + n(row.net_pnl), 0), profit_factor: losses.length ? wins.reduce((sum, row) => sum + n(row.net_pnl), 0) / Math.abs(losses.reduce((sum, row) => sum + n(row.net_pnl), 0)) : null, avg_r: closed.length ? closed.reduce((sum, row) => sum + n(row.r_multiple), 0) / closed.length : null, max_drawdown_pct: Math.min(0, ...history.map((row) => n(row.drawdown_pct))) } };
}

export async function getStockWorkspace(symbolInput: string) {
  const symbol = symbolInput.toUpperCase();
  const state = await getStockRuntime();
  const instrument = table(state, 'instruments').find((row) => s(row.symbol) === symbol);
  if (!instrument) return null;
  let chart: StockChartSnapshot | null = null;
  try { chart = await readSnapshot<StockChartSnapshot>(`charts/${symbol}.json`); } catch { /* chart collector has not published this symbol yet */ }
  const agents = table(state, 'agents');
  const proposals = table(state, 'agent_proposals').filter((row) => s(row.symbol) === symbol).sort(byDateDesc('created_at'));
  const decisions = table(state, 'decisions').filter((row) => s(row.symbol) === symbol).sort(byDateDesc('evaluated_at'));
  const views = agents.map((agent) => {
    const decision = decisions.find((row) => s(row.agent_id) === s(agent.id));
    const proposal = proposals.find((row) => s(row.agent_id) === s(agent.id));
    return { agent_id: s(agent.id), agent_name: s(agent.name), description: s(agent.description), action: s(decision?.action || proposal?.action || 'NOT_EVALUATED'), confidence: decision?.confidence ?? proposal?.confidence ?? null, rationale: s(decision?.rationale || proposal?.rationale || 'Belum ada evaluasi tersimpan.'), status: s(decision?.status || proposal?.status || 'NOT_EVALUATED'), horizon: s(proposal?.horizon || STRATEGIES[s(agent.id)]?.timeframes || '—'), plan: proposal ?? decision ?? null };
  });
  const fundamentalRow = table(state, 'fundamental_snapshots').find((row) => s(row.symbol) === symbol);
  const flow = table(state, 'screener_flow_cache').find((row) => s(row.symbol) === symbol) ?? null;
  const reports: Row[] = table(state, 'reports').sort(byDateDesc('report_date')).flatMap((row): Row[] => { try { const payload = JSON.parse(s(row.snapshot_json)) as Row; const setups = Array.isArray(payload.setups) ? payload.setups as Row[] : []; const setup = setups.find((item) => s(item.symbol) === symbol); return setup ? [{ report_date: row.report_date, ...setup } as Row] : []; } catch { return []; } });
  let fundamental: Row | null = null;
  if (fundamentalRow?.metrics_json) { try { fundamental = JSON.parse(s(fundamentalRow.metrics_json)) as Row; } catch { fundamental = null; } }
  return { instrument, views, positions: namedPositions(state, undefined, symbol), decisions, flow, fundamental, reports, chart, generated_at: state.exported_at };
}

export async function getStockReports(): Promise<Array<Row & { snapshot: Row | null }>> {
  const state = await getStockRuntime();
  return table(state, 'reports').sort(byDateDesc('report_date')).map((row) => { let snapshot: Row | null = null; try { snapshot = JSON.parse(s(row.snapshot_json)) as Row; } catch { /* invalid snapshot */ } return { ...row, snapshot } as Row & { snapshot: Row | null }; });
}

export async function getStockReport(date?: string) {
  const reports = await getStockReports();
  if (!date || date === 'latest') return reports[0] ?? null;
  return reports.find((row) => s(row['report_date']) === date) ?? null;
}
