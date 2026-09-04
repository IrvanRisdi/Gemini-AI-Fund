import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type Row = Record<string, unknown>;
export type StockAgent = { id: string; name: string; description: string; starting_equity: number; equity: number; pnl_pct: number; display_win_rate: number | null; status: string };
export type StockPosition = { id: number; agent_id: string; agent_name: string; symbol: string; lots: number; entry_price: number; last_price: number; stop_price?: number | null; target_price?: number | null; market_value: number; unrealized_pnl: number; pnl_pct: number };
export type StockScreenerRow = { symbol: string; name: string; sector?: string | null; subsector?: string | null; last_price?: number | null; change_pct?: number | null; evaluation_score?: number | null; evaluation_status?: string | null; market_data_as_of?: string | null; intraday_rank?: number | null; is_intraday: boolean };
export type StockDashboard = { schema_version: number; generated_at: string; source_mode: string; paper_only: boolean; market_phase: string; latest_run: { status: string; started_at: string; completed_at?: string | null; symbols_ok: number; symbols_failed: number } | null; provider_usage: { requests_used: number; request_limit: number }; agents: StockAgent[]; positions: StockPosition[]; intraday_symbols: string[]; screener: StockScreenerRow[]; latest_report?: Row | null };
export type RuntimeState = { schema_version: number; exported_at: string; paper_only: boolean; tables: Record<string, Row[]> };

const RAW_BASE = 'https://raw.githubusercontent.com/IrvanRisdi/Gemini-AI-Fund/paper-data/stocks-engine/.stock-desk';
const STRATEGIES: Record<string, { objective: string; timeframes: string; entry_rules: string[]; exit_rules: string[]; no_trade: string[] }> = {
  swing: { objective: 'Menangkap tren menengah pada saham likuid dengan momentum dan konfirmasi volume.', timeframes: 'Daily untuk setup · Weekly untuk regime', entry_rules: ['Close di atas EMA20 dan EMA50', 'Relative volume minimum 1,5×', 'Pullback sehat atau breakout terkonfirmasi'], exit_rules: ['Stop di bawah swing low atau ATR struktural', 'Partial profit pada 1,5R–2R', 'Time stop maksimal 20 hari bursa'], no_trade: ['Data stale', 'Likuiditas di bawah batas', 'IHSG risk-off ekstrem'] },
  scalping: { objective: 'Menangkap momentum intraday 5 menit yang masih memiliki edge setelah biaya.', timeframes: '5m · delayed-paper', entry_rules: ['Likuiditas dan relative volume lolos', 'Momentum dekat VWAP', 'Close di atas VWAP'], exit_rules: ['Stop berbasis ATR dan tick', 'Target minimal 1,5R setelah fee', 'Tanpa averaging down'], no_trade: ['Candle stale', 'Di luar sesi kontinu IDX', 'Edge setelah biaya tidak memadai'] },
  'open-low': { objective: 'Mencari kekuatan pembukaan ketika open bertahan sebagai low sesi.', timeframes: '5m · 60 menit aktif pertama', entry_rules: ['Low maksimal satu tick di bawah open', 'Relative volume lolos', 'Close di atas VWAP'], exit_rules: ['Stop satu tick di bawah open', 'Target minimal 1,5R', 'Tanpa averaging down'], no_trade: ['Di luar satu jam pertama', 'Belum aktif diperdagangkan', 'Candle stale'] },
  fundamental: { objective: 'Mengakumulasi emiten berkualitas pada valuasi wajar untuk beberapa bulan.', timeframes: 'Quarterly · Weekly/Daily timing', entry_rules: ['Quality dan health gate lolos', 'Valuasi memiliki margin of safety', 'Tidak ada red flag arus kas'], exit_rules: ['Thesis fundamental rusak', 'Valuasi melewati fair range', 'Trailing protection saat event risk'], no_trade: ['Laporan tidak lengkap', 'Restatement belum diproses', 'Model sektor tidak sesuai'] },
  'breakout-retest': { objective: 'Membeli breakout valid setelah resistance diuji dan bertahan sebagai support.', timeframes: 'Daily/1H · 15m confirmation', entry_rules: ['Close melewati resistance dengan volume', 'Retest gap maksimum 5%', 'Flow tidak hard-conflict'], exit_rules: ['Stop di bawah retest low', 'Target minimum 1,5R', 'Plan kedaluwarsa bila level lama terlewati'], no_trade: ['Deep retest', 'Historical trap', 'Breakout tanpa volume'] },
};

async function readLocal<T>(file: string): Promise<T> {
  const candidates = [path.join(process.cwd(), '..', 'stocks-engine', '.stock-desk', file), path.join(process.cwd(), 'stocks-engine', '.stock-desk', file)];
  let failure: unknown;
  for (const candidate of candidates) { try { return JSON.parse(await readFile(candidate, 'utf8')) as T; } catch (error) { failure = error; } }
  throw failure;
}

async function readSnapshot<T>(file: string): Promise<T> {
  if (process.env.NODE_ENV !== 'production') { try { return await readLocal<T>(file); } catch { /* remote fallback */ } }
  const response = await fetch(`${RAW_BASE}/${file}`, { next: { revalidate: 60 } });
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
  return { ...agent, pnl_pct: n(agent.starting_equity) ? (n(agent.equity) - n(agent.starting_equity)) / n(agent.starting_equity) * 100 : 0, positions: namedPositions(state, agentId), pending_orders: table(state, 'paper_orders').filter((row) => s(row.agent_id) === agentId && s(row.status) === 'PENDING').sort(byDateDesc('created_at')), decisions, equity_history: history, trade_journal: journal, strategy: STRATEGIES[agentId], performance: { closed_trades: closed.length, wins: wins.length, win_rate: closed.length ? wins.length / closed.length * 100 : null, net_pnl: closed.reduce((sum, row) => sum + n(row.net_pnl), 0), profit_factor: losses.length ? wins.reduce((sum, row) => sum + n(row.net_pnl), 0) / Math.abs(losses.reduce((sum, row) => sum + n(row.net_pnl), 0)) : null, avg_r: closed.length ? closed.reduce((sum, row) => sum + n(row.r_multiple), 0) / closed.length : null, max_drawdown_pct: Math.min(0, ...history.map((row) => n(row.drawdown_pct))) } };
}

export async function getStockWorkspace(symbolInput: string) {
  const symbol = symbolInput.toUpperCase();
  const state = await getStockRuntime();
  const instrument = table(state, 'instruments').find((row) => s(row.symbol) === symbol);
  if (!instrument) return null;
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
  return { instrument, views, positions: namedPositions(state, undefined, symbol), decisions, flow, fundamental, reports, generated_at: state.exported_at };
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
