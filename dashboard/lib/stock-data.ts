import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type StockAgent = {
  id: string;
  name: string;
  starting_equity: number;
  equity: number;
  pnl_pct: number;
  display_win_rate: number | null;
  status: string;
};

export type StockPosition = {
  id: number;
  agent_id: string;
  agent_name: string;
  symbol: string;
  lots: number;
  entry_price: number;
  last_price: number;
  market_value: number;
  unrealized_pnl: number;
  pnl_pct: number;
};

export type StockScreenerRow = {
  symbol: string;
  name: string;
  sector?: string | null;
  last_price?: number | null;
  change_pct?: number | null;
  evaluation_score?: number | null;
  evaluation_status?: string | null;
  market_data_as_of?: string | null;
  intraday_rank?: number | null;
  is_intraday: boolean;
};

export type StockDashboard = {
  schema_version: number;
  generated_at: string;
  source_mode: string;
  paper_only: boolean;
  market_phase: string;
  latest_run: {
    status: string;
    started_at: string;
    completed_at?: string | null;
    symbols_ok: number;
    symbols_failed: number;
  } | null;
  provider_usage: {
    requests_used: number;
    request_limit: number;
  };
  agents: StockAgent[];
  positions: StockPosition[];
  intraday_symbols: string[];
  screener: StockScreenerRow[];
};

const STOCK_SNAPSHOT_URL =
  'https://raw.githubusercontent.com/IrvanRisdi/Gemini-AI-Fund/main/stocks-engine/.stock-desk/dashboard.json';

async function readLocalSnapshot(): Promise<StockDashboard> {
  const candidates = [
    path.join(process.cwd(), '..', 'stocks-engine', '.stock-desk', 'dashboard.json'),
    path.join(process.cwd(), 'stocks-engine', '.stock-desk', 'dashboard.json'),
  ];
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(await readFile(candidate, 'utf8')) as StockDashboard;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function getStockDashboard(): Promise<StockDashboard> {
  if (process.env.NODE_ENV !== 'production') {
    try {
      return await readLocalSnapshot();
    } catch {
      // Fall back to the repository snapshot when there is no local engine checkout.
    }
  }
  const response = await fetch(STOCK_SNAPSHOT_URL, { next: { revalidate: 60 } });
  if (!response.ok) return readLocalSnapshot();
  return (await response.json()) as StockDashboard;
}
