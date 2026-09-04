"""Portable state and read-model publisher for ephemeral GitHub runners.

Raw provider payloads and the full candle database are deliberately excluded.
Scheduled collectors publish bounded per-symbol chart snapshots separately so
the website can render candles without calling Yahoo when a page is opened.
The compact JSON state keeps the paper ledger, positions, orders, rankings,
journal and audit evidence alive between otherwise stateless Actions jobs.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import engine
import server
from config import settings


STATE_DIR = ROOT / ".stock-desk"
STATE_PATH = STATE_DIR / "runtime-state.json"
DASHBOARD_PATH = STATE_DIR / "dashboard.json"
CHARTS_DIR = STATE_DIR / "charts"
JAKARTA = ZoneInfo("Asia/Jakarta")

# Parent tables must precede their children during restore.
TABLE_QUERIES: tuple[tuple[str, str], ...] = (
    ("instruments", "SELECT * FROM instruments ORDER BY symbol"),
    ("agents", "SELECT * FROM agents ORDER BY id"),
    ("engine_meta", "SELECT * FROM engine_meta ORDER BY key"),
    ("engine_runs", """SELECT * FROM engine_runs WHERE id IN
      (SELECT id FROM engine_runs ORDER BY started_at DESC LIMIT 100)
      OR id IN (SELECT run_id FROM agent_proposals WHERE id IN
        (SELECT proposal_id FROM paper_orders WHERE status='PENDING'))
      ORDER BY started_at DESC"""),
    ("agent_ledgers", "SELECT * FROM agent_ledgers ORDER BY agent_id"),
    ("agent_cooldowns", "SELECT * FROM agent_cooldowns ORDER BY agent_id,symbol"),
    ("decisions", "SELECT * FROM decisions ORDER BY id DESC LIMIT 1000"),
    ("agent_proposals", """SELECT * FROM agent_proposals WHERE id IN
      (SELECT id FROM agent_proposals ORDER BY created_at DESC LIMIT 1000)
      OR id IN (SELECT proposal_id FROM paper_orders WHERE status='PENDING')
      ORDER BY created_at DESC"""),
    ("paper_orders", "SELECT * FROM paper_orders ORDER BY created_at DESC LIMIT 1000"),
    ("paper_fills", "SELECT * FROM paper_fills ORDER BY filled_at DESC LIMIT 1000"),
    ("positions", "SELECT * FROM positions ORDER BY id"),
    ("trade_journal", "SELECT * FROM trade_journal ORDER BY opened_at DESC LIMIT 2000"),
    ("equity_history", "SELECT * FROM equity_history ORDER BY equity_date DESC LIMIT 2000"),
    ("reports", "SELECT * FROM reports ORDER BY report_date DESC LIMIT 30"),
    ("provider_usage", "SELECT * FROM provider_usage ORDER BY usage_date DESC LIMIT 14"),
    ("fundamental_snapshots", "SELECT * FROM fundamental_snapshots ORDER BY symbol,period_end DESC"),
    ("screener_flow_cache", "SELECT * FROM screener_flow_cache ORDER BY symbol"),
    ("engine_events", "SELECT * FROM engine_events ORDER BY id DESC LIMIT 200"),
)


def rows(db: sqlite3.Connection, query: str, parameters: tuple = ()) -> list[dict]:
    return [dict(row) for row in db.execute(query, parameters).fetchall()]


def export_state(db: sqlite3.Connection, target: Path = STATE_PATH) -> dict:
    target.parent.mkdir(parents=True, exist_ok=True)
    tables: dict[str, list[dict]] = {}
    for table, query in TABLE_QUERIES:
        exists = db.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
        ).fetchone()
        tables[table] = rows(db, query) if exists else []
    payload = {
        "schema_version": 1,
        "exported_at": datetime.now(JAKARTA).isoformat(timespec="seconds"),
        "paper_only": True,
        "tables": tables,
    }
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"path": str(target), "tables": {name: len(value) for name, value in tables.items()}}


def materialize_fundamentals(db: sqlite3.Connection) -> int:
    """Flatten bulky statement payloads before an ephemeral runner disappears."""
    symbols = [row[0] for row in db.execute(
        "SELECT DISTINCT symbol FROM financial_statements WHERE data_status='CACHED'"
    )]
    stored = 0
    for symbol in symbols:
        instrument = db.execute(
            "SELECT last_price,sector FROM instruments WHERE symbol=?", (symbol,)
        ).fetchone()
        snapshot = server.fundamental_snapshot(
            db,
            symbol,
            float(instrument["last_price"] or 0) if instrument else 0,
            (instrument["sector"] or "") if instrument else "",
        )
        if snapshot.get("status") != "AVAILABLE" or not snapshot.get("period_end"):
            continue
        db.execute(
            """INSERT OR REPLACE INTO fundamental_snapshots
            (symbol,period_end,published_at,metrics_json,source,data_status)
            VALUES(?,?,?,?,?,?)""",
            (
                symbol,
                snapshot["period_end"],
                snapshot.get("as_of"),
                json.dumps(snapshot, ensure_ascii=False),
                "arjum_financial_compact",
                "CACHED",
            ),
        )
        stored += 1
    db.commit()
    return stored


def _candle_timestamp(value: str) -> int:
    moment = datetime.fromisoformat(value)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=JAKARTA)
    return int(moment.timestamp() * 1000)


def publish_charts(db: sqlite3.Connection, target_dir: Path = CHARTS_DIR) -> dict:
    """Publish bounded OHLCV snapshots and preserve the other base timeframe.

    Intraday runners only own 5m candles while daily maintenance owns 1d
    candles. Existing files are merged so either job can refresh its timeframe
    without erasing the other one. Derived 15m, 1H and Weekly bars are built in
    the dashboard from these two canonical sources.
    """
    target_dir.mkdir(parents=True, exist_ok=True)
    symbols = [row[0] for row in db.execute("""SELECT DISTINCT c.symbol
      FROM market_candles c JOIN instruments i ON i.symbol=c.symbol
      WHERE i.status='ACTIVE' AND c.timeframe IN ('5m','1d') ORDER BY c.symbol""")]
    written = 0
    candle_count = 0
    for symbol in symbols:
        target = target_dir / f"{symbol}.json"
        payload = {"schema_version": 1, "symbol": symbol, "timeframes": {}}
        if target.exists():
            try:
                existing = json.loads(target.read_text(encoding="utf-8"))
                if existing.get("schema_version") == 1 and existing.get("symbol") == symbol:
                    payload = existing
            except (OSError, json.JSONDecodeError):
                pass
        changed = False
        for timeframe, limit in (("5m", 240), ("1d", 120)):
            candle_rows = rows(db, """SELECT candle_at,open,high,low,close,volume,
              source,data_status FROM market_candles WHERE symbol=? AND timeframe=?
              ORDER BY candle_at DESC LIMIT ?""", (symbol, timeframe, limit))
            if not candle_rows:
                continue
            candle_rows.reverse()
            latest = candle_rows[-1]
            payload["timeframes"][timeframe] = {
                "as_of": latest["candle_at"],
                "source": latest["source"],
                "data_status": latest["data_status"],
                "candles": [[
                    _candle_timestamp(row["candle_at"]),
                    row["open"], row["high"], row["low"], row["close"],
                    int(row["volume"] or 0),
                ] for row in candle_rows],
            }
            candle_count += len(candle_rows)
            changed = True
        if not changed:
            continue
        payload["generated_at"] = datetime.now(JAKARTA).isoformat(timespec="seconds")
        target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        written += 1
    return {"path": str(target_dir), "symbols": written, "candles": candle_count}


def import_state(db: sqlite3.Connection, source: Path = STATE_PATH) -> dict:
    if not source.exists():
        return {"status": "EMPTY", "path": str(source), "rows": 0}
    payload = json.loads(source.read_text(encoding="utf-8"))
    if payload.get("schema_version") != 1 or not isinstance(payload.get("tables"), dict):
        raise ValueError("unsupported GitHub state schema")
    restored = 0
    db.execute("PRAGMA foreign_keys=OFF")
    try:
        for table, _ in TABLE_QUERIES:
            incoming = payload["tables"].get(table) or []
            if not incoming:
                continue
            known = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
            for item in reversed(incoming):
                values = {key: value for key, value in item.items() if key in known}
                if not values:
                    continue
                columns = list(values)
                placeholders = ",".join("?" for _ in columns)
                db.execute(
                    f"INSERT OR REPLACE INTO {table} ({','.join(columns)}) VALUES ({placeholders})",
                    [values[column] for column in columns],
                )
                restored += 1
        db.commit()
    finally:
        db.execute("PRAGMA foreign_keys=ON")
    return {"status": "RESTORED", "path": str(source), "rows": restored}


def publish_dashboard(db: sqlite3.Connection, target: Path = DASHBOARD_PATH) -> dict:
    target.parent.mkdir(parents=True, exist_ok=True)
    agents = rows(
        db,
        "SELECT *,ROUND((equity-starting_equity)/starting_equity*100,2) pnl_pct FROM agents ORDER BY id",
    )
    for agent in agents:
        agent.update(server.agent_win_rate_summary(db, agent["id"]))
    positions = rows(
        db,
        """SELECT p.*,a.name agent_name,
        ROUND(p.last_price*p.lots*100,0) market_value,
        ROUND((p.last_price-p.entry_price)*p.lots*100,0) unrealized_pnl,
        ROUND((p.last_price-p.entry_price)/p.entry_price*100,2) pnl_pct
        FROM positions p JOIN agents a ON a.id=p.agent_id
        WHERE p.status='OPEN' ORDER BY p.id DESC""",
    )
    ranking = server.intraday_symbol_ranks(db)
    screener = rows(
        db,
        """SELECT symbol,name,sector,subsector,last_price,change_pct,evaluation_score,
        evaluation_status,market_data_as_of FROM instruments
        WHERE status='ACTIVE' ORDER BY COALESCE(evaluation_score,0) DESC,symbol""",
    )
    for item in screener:
        item["intraday_rank"] = ranking.get(item["symbol"])
        item["is_intraday"] = item["symbol"] in ranking
    latest_run = db.execute("SELECT * FROM engine_runs ORDER BY started_at DESC LIMIT 1").fetchone()
    latest_report = db.execute("SELECT snapshot_json FROM reports ORDER BY report_date DESC LIMIT 1").fetchone()
    usage = server.provider_usage_today(db)
    payload = {
        "schema_version": 1,
        "generated_at": datetime.now(JAKARTA).isoformat(timespec="seconds"),
        "source_mode": "github_actions_snapshot",
        "paper_only": True,
        "market_phase": engine.market_phase(),
        "latest_run": dict(latest_run) if latest_run else None,
        "provider_usage": usage,
        "agents": agents,
        "positions": positions,
        "intraday_symbols": list(ranking),
        "screener": screener,
        "latest_report": json.loads(latest_report[0]) if latest_report else None,
    }
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"path": str(target), "agents": len(agents), "positions": len(positions), "screener": len(screener)}


def prepare() -> dict:
    server.init_db()
    db = server.connect()
    try:
        engine.ensure_runtime(db)
        engine.sync_universe(db, engine.load_universe())
        return import_state(db)
    finally:
        db.close()


def finalize() -> dict:
    server.init_db()
    db = server.connect()
    try:
        engine.ensure_runtime(db)
        compact_fundamentals = materialize_fundamentals(db)
        return {
            "compact_fundamentals": compact_fundamentals,
            "state": export_state(db),
            "dashboard": publish_dashboard(db),
            "charts": publish_charts(db),
        }
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Persist NusaQuant state across GitHub Actions runners")
    parser.add_argument("command", choices=("prepare", "finalize", "export", "import", "publish"))
    args = parser.parse_args()
    if args.command == "prepare":
        result = prepare()
    elif args.command == "finalize":
        result = finalize()
    else:
        server.init_db()
        db = server.connect()
        try:
            engine.ensure_runtime(db)
            result = {
                "export": lambda: export_state(db),
                "import": lambda: import_state(db),
                "publish": lambda: publish_dashboard(db),
            }[args.command]()
        finally:
            db.close()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
