"""Database schema owned by the market engine."""

ENGINE_SCHEMA = """
CREATE TABLE IF NOT EXISTS market_candles (
  symbol TEXT NOT NULL, timeframe TEXT NOT NULL, candle_at TEXT NOT NULL,
  open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL,
  volume REAL NOT NULL, source TEXT NOT NULL, data_status TEXT NOT NULL,
  collected_at TEXT NOT NULL, PRIMARY KEY(symbol,timeframe,candle_at)
);
CREATE INDEX IF NOT EXISTS idx_candles_lookup
  ON market_candles(symbol,timeframe,candle_at DESC);
CREATE TABLE IF NOT EXISTS engine_runs (
  id TEXT PRIMARY KEY, run_type TEXT NOT NULL, started_at TEXT NOT NULL,
  completed_at TEXT, status TEXT NOT NULL, timeframe TEXT,
  universe_size INTEGER NOT NULL DEFAULT 0, symbols_ok INTEGER NOT NULL DEFAULT 0,
  symbols_failed INTEGER NOT NULL DEFAULT 0, proposals INTEGER NOT NULL DEFAULT 0,
  orders_created INTEGER NOT NULL DEFAULT 0, fills_created INTEGER NOT NULL DEFAULT 0,
  source_delay_minutes INTEGER, stats_json TEXT, error TEXT
);
CREATE TABLE IF NOT EXISTS feature_snapshots (
  run_id TEXT NOT NULL, symbol TEXT NOT NULL, timeframe TEXT NOT NULL,
  computed_at TEXT NOT NULL, features_json TEXT NOT NULL,
  PRIMARY KEY(run_id,symbol,timeframe), FOREIGN KEY(run_id) REFERENCES engine_runs(id)
);
CREATE TABLE IF NOT EXISTS agent_proposals (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL, agent_id TEXT NOT NULL,
  symbol TEXT NOT NULL, action TEXT NOT NULL, confidence INTEGER,
  horizon TEXT, rationale TEXT NOT NULL, entry_low REAL, entry_high REAL,
  stop_price REAL, target_price REAL, equity_risk_pct REAL, risk_reward REAL,
  lots INTEGER, status TEXT NOT NULL, created_at TEXT NOT NULL, valid_until TEXT,
  data_status TEXT NOT NULL, strategy_version TEXT NOT NULL DEFAULT '1.0',
  FOREIGN KEY(run_id) REFERENCES engine_runs(id)
);
CREATE INDEX IF NOT EXISTS idx_proposals_symbol ON agent_proposals(symbol,created_at DESC);
CREATE TABLE IF NOT EXISTS paper_orders (
  id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL, agent_id TEXT NOT NULL,
  symbol TEXT NOT NULL, side TEXT NOT NULL, order_type TEXT NOT NULL,
  lots INTEGER NOT NULL, limit_price REAL NOT NULL, stop_price REAL,
  target_price REAL, status TEXT NOT NULL, created_at TEXT NOT NULL,
  expires_at TEXT, source_candle_at TEXT NOT NULL, timeframe TEXT NOT NULL DEFAULT '5m',
  strategy_version TEXT NOT NULL DEFAULT '2.0',
  FOREIGN KEY(proposal_id) REFERENCES agent_proposals(id)
);
CREATE INDEX IF NOT EXISTS idx_orders_open ON paper_orders(status,symbol);
CREATE TABLE IF NOT EXISTS paper_fills (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL, filled_at TEXT NOT NULL,
  price REAL NOT NULL, lots INTEGER NOT NULL, gross_value REAL NOT NULL,
  fees REAL NOT NULL, data_status TEXT NOT NULL,
  FOREIGN KEY(order_id) REFERENCES paper_orders(id)
);
CREATE TABLE IF NOT EXISTS agent_cooldowns (
  agent_id TEXT NOT NULL, symbol TEXT NOT NULL, until_at TEXT NOT NULL,
  reason TEXT NOT NULL, strategy_version TEXT NOT NULL DEFAULT '2.0',
  PRIMARY KEY(agent_id,symbol)
);
CREATE TABLE IF NOT EXISTS agent_ledgers (
  agent_id TEXT PRIMARY KEY, cash REAL NOT NULL, realized_pnl REAL NOT NULL DEFAULT 0,
  fees_paid REAL NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fundamental_snapshots (
  symbol TEXT NOT NULL, period_end TEXT NOT NULL, published_at TEXT,
  metrics_json TEXT NOT NULL, source TEXT NOT NULL, data_status TEXT NOT NULL,
  PRIMARY KEY(symbol,period_end)
);
CREATE TABLE IF NOT EXISTS financial_statements (
  symbol TEXT NOT NULL, report_type TEXT NOT NULL, period TEXT NOT NULL,
  period_end TEXT NOT NULL, published_at TEXT, fetched_at TEXT NOT NULL,
  metrics_json TEXT NOT NULL, source TEXT NOT NULL, data_status TEXT NOT NULL,
  PRIMARY KEY(symbol,report_type,period,period_end)
);
CREATE INDEX IF NOT EXISTS idx_financial_statements_lookup
  ON financial_statements(symbol,period_end DESC,report_type);
CREATE TABLE IF NOT EXISTS arjum_snapshots (
  symbol TEXT PRIMARY KEY, fetched_at TEXT NOT NULL, expires_at TEXT NOT NULL,
  payload_json TEXT NOT NULL, request_count INTEGER NOT NULL,
  status TEXT NOT NULL, error TEXT
);
CREATE INDEX IF NOT EXISTS idx_arjum_snapshots_expiry ON arjum_snapshots(expires_at);
CREATE TABLE IF NOT EXISTS screener_flow_cache (
  symbol TEXT PRIMARY KEY, source_fetched_at TEXT NOT NULL,
  status TEXT NOT NULL, verdict TEXT, net_buy REAL, foreign_net REAL,
  consistency TEXT, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_screener_flow_cache_updated ON screener_flow_cache(updated_at DESC);
CREATE TABLE IF NOT EXISTS arjum_screener_snapshots (
  snapshot_date TEXT PRIMARY KEY, fetched_at TEXT NOT NULL, expires_at TEXT NOT NULL,
  payload_json TEXT NOT NULL, status TEXT NOT NULL, error TEXT
);
CREATE TABLE IF NOT EXISTS engine_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL,
  level TEXT NOT NULL, component TEXT NOT NULL, event TEXT NOT NULL,
  details_json TEXT
);
CREATE TABLE IF NOT EXISTS engine_locks (
  name TEXT PRIMARY KEY, run_id TEXT NOT NULL, acquired_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS engine_meta (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
);
"""


def init_engine_schema(db) -> None:
    db.executescript(ENGINE_SCHEMA)
