"""NusaQuant delayed-paper engine.

Yahoo data is treated as DELAYED. The website never calls this module; a
separate scheduler executes it and publishes snapshots to SQLite.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import shutil
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, time as clock_time, timedelta
from pathlib import Path
from statistics import mean
from zoneinfo import ZoneInfo

import server
from config import settings
from engine_schema import init_engine_schema
from providers import ArjumClient, ProviderError, YahooClient

JAKARTA = ZoneInfo("Asia/Jakarta")
ROOT = Path(__file__).resolve().parent
UNIVERSE_PATH = ROOT / "data" / "idx_universe.csv"
HOLIDAYS_PATH = ROOT / "data" / "idx_holidays.json"
BUY_FEE = 0.0015
SELL_FEE = 0.0025
STRATEGY_VERSION = "2.0"
MIN_NET_RISK_REWARD = 1.5
# Full cached profile for a shortlisted ticker. Fundamental statements are not
# included because Arjum's documented API does not expose them.
ARJUM_ENDPOINTS = ("analysis", "broker_summary", "broker_accumulation", "history", "seasonal")
ARJUM_DAILY_PROFILE_ENDPOINTS = ("analysis", "broker_summary")

AGENT_DEFAULTS = [
    ("swing", "Swing Momentum", "Daily trend · 2–20 hari", "validated"),
    ("scalping", "Scalping Desk", "Momentum 5m · delayed-paper", "paper-validation"),
    ("open-low", "Open = Low", "Opening strength 5m · delayed-paper", "paper-validation"),
    ("fundamental", "Fundamental Alpha", "Quality value · 1–6 bulan", "research"),
    ("breakout-retest", "Breakout & Retest", "Structure · 1–10 hari", "validated"),
]


def table_has_column(db, table: str, column: str) -> bool:
    return column in {row[1] for row in db.execute(f"PRAGMA table_info({table})").fetchall()}


def ensure_column(db, table: str, column: str, definition: str) -> None:
    if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone() and not table_has_column(db, table, column):
        db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def now_wib() -> datetime:
    return datetime.now(JAKARTA)


def iso(value: datetime | None = None) -> str:
    return (value or now_wib()).isoformat(timespec="seconds")


def log_event(db, level: str, component: str, event: str, details=None) -> None:
    db.execute("INSERT INTO engine_events(created_at,level,component,event,details_json) VALUES(?,?,?,?,?)",
               (iso(), level, component, event, json.dumps(details or {}, ensure_ascii=False)))


def ensure_runtime(db) -> None:
    init_engine_schema(db)
    migrations = {
        "paper_orders": {
            "timeframe": "TEXT NOT NULL DEFAULT '5m'",
            "strategy_version": "TEXT NOT NULL DEFAULT '2.0'",
        },
        "positions": {
            "fill_id": "TEXT", "opened_at": "TEXT", "entry_candle_at": "TEXT",
            "last_managed_candle_at": "TEXT", "buy_fees": "REAL NOT NULL DEFAULT 0",
            "initial_risk": "REAL", "strategy_version": "TEXT NOT NULL DEFAULT '2.0'",
        },
        "trade_journal": {
            "buy_fees": "REAL NOT NULL DEFAULT 0", "sell_fees": "REAL NOT NULL DEFAULT 0",
            "initial_risk": "REAL", "strategy_version": "TEXT NOT NULL DEFAULT '2.0'",
        },
    }
    for table, columns in migrations.items():
        for column, definition in columns.items():
            ensure_column(db, table, column, definition)
    migrated = db.execute("SELECT value FROM engine_meta WHERE key='strategy_v2_migrated'").fetchone()
    if not migrated:
        # Preserve all v1 evidence, but prevent an old pending order from being
        # filled under the new simulator. Existing open positions remain visible
        # and mark-to-market, while only v2 positions are auto-managed.
        db.execute("UPDATE paper_orders SET strategy_version='1.0-legacy'")
        db.execute("UPDATE paper_orders SET status='CANCELLED_LEGACY' WHERE status='PENDING'")
        db.execute("UPDATE positions SET strategy_version='1.0-legacy'")
        db.execute("UPDATE trade_journal SET strategy_version='1.0-legacy'")
        db.execute("INSERT INTO engine_meta(key,value,updated_at) VALUES('strategy_v2_migrated','true',?)", (iso(),))
    for agent_id, name, description, validation in AGENT_DEFAULTS:
        db.execute("""INSERT OR IGNORE INTO agents
          (id,name,description,starting_equity,equity,win_rate,open_risk_pct,status,validation_status)
          VALUES(?,?,?,?,?,?,?,?,?)""",
          (agent_id, name, description, 100_000_000, 100_000_000, 0, 0,
           "ACTIVE" if validation != "research" else "RESEARCH", validation))
        db.execute("""UPDATE agents SET name=?,description=?,status=?,validation_status=?,strategy_version=?
          WHERE id=?""", (name, description, "ACTIVE" if validation != "research" else "RESEARCH",
          validation, STRATEGY_VERSION, agent_id))
        db.execute("INSERT OR IGNORE INTO agent_ledgers(agent_id,cash,updated_at) VALUES(?,?,?)",
                   (agent_id, 100_000_000, iso()))
    db.commit()


def load_universe(path: Path = UNIVERSE_PATH) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"IDX universe file missing: {path}")
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = [dict(row) for row in csv.DictReader(handle)]
    return [row for row in rows if row.get("status", "ACTIVE").upper() == "ACTIVE"]


def sync_universe(db, universe: list[dict]) -> None:
    for row in universe:
        db.execute("""INSERT INTO instruments(symbol,name,sector,subsector,status)
          VALUES(?,?,?,?,?) ON CONFLICT(symbol) DO UPDATE SET
          name=excluded.name,sector=excluded.sector,subsector=excluded.subsector,status=excluded.status""",
          (row["symbol"].upper(), row.get("name") or row["symbol"], row.get("sector"),
           row.get("subsector"), row.get("status", "ACTIVE")))
    db.commit()


def intraday_universe(db, universe: list[dict]) -> list[dict]:
    """Prioritize cached candidates; never fan out every five minutes to all IDX."""
    by_symbol = {row["symbol"].upper(): row for row in universe}
    ranked = list(server.intraday_symbol_ranks(db, settings.intraday_universe_limit))
    selected = [by_symbol[symbol] for symbol in ranked if symbol in by_symbol]
    selected.extend(row for symbol, row in by_symbol.items() if symbol not in set(ranked))
    return selected[:settings.intraday_universe_limit]


def exchange_holidays(path: Path = HOLIDAYS_PATH) -> set[str]:
    if not path.exists():
        return set()
    payload = json.loads(path.read_text(encoding="utf-8"))
    return set(payload.get("holidays", []))


def market_phase(moment: datetime | None = None) -> str:
    moment = (moment or now_wib()).astimezone(JAKARTA)
    if moment.weekday() >= 5 or moment.date().isoformat() in exchange_holidays():
        return "CLOSED"
    t, friday = moment.time(), moment.weekday() == 4
    if clock_time(8, 30) <= t < clock_time(9, 0): return "PREOPEN"
    if clock_time(9, 0) <= t < (clock_time(11, 30) if friday else clock_time(12, 0)): return "SESSION_1"
    if (clock_time(14, 0) if friday else clock_time(13, 30)) <= t < clock_time(15, 50): return "SESSION_2"
    if clock_time(15, 50) <= t <= clock_time(16, 15): return "CLOSING"
    if clock_time(16, 15) < t <= clock_time(17, 30): return "POSTCLOSE"
    return "CLOSED"


def idx_trading_intervals(moment: datetime) -> list[tuple[datetime, datetime]]:
    """Continuous IDX analysis windows; lunch and off-hours are excluded."""
    moment = moment.astimezone(JAKARTA)
    if moment.weekday() >= 5 or moment.date().isoformat() in exchange_holidays(): return []
    friday = moment.weekday() == 4
    times = ((clock_time(9, 0), clock_time(11, 30)), (clock_time(14, 0), clock_time(15, 50))) if friday else (
      (clock_time(9, 0), clock_time(12, 0)), (clock_time(13, 30), clock_time(15, 50)))
    return [(datetime.combine(moment.date(), start, JAKARTA), datetime.combine(moment.date(), end, JAKARTA)) for start,end in times]


def is_idx_trading_timestamp(value: str | datetime) -> bool:
    try:
        moment = datetime.fromisoformat(value) if isinstance(value,str) else value
        if moment.tzinfo is None: moment=moment.replace(tzinfo=JAKARTA)
        moment=moment.astimezone(JAKARTA)
        return any(start <= moment < end for start,end in idx_trading_intervals(moment))
    except (TypeError,ValueError):
        return False


def idx_trading_minutes_between(start: datetime, end: datetime) -> float | None:
    """Elapsed active-session minutes on one trading date; never bridges days."""
    start,end=start.astimezone(JAKARTA),end.astimezone(JAKARTA)
    if start.date()!=end.date() or end<start: return None
    return sum(max(0.0,(min(end,finish)-max(start,begin)).total_seconds()/60)
      for begin,finish in idx_trading_intervals(start) if min(end,finish)>max(start,begin))


def add_idx_trading_minutes(start: datetime, minutes: int) -> datetime:
    """Advance only through continuous IDX trading windows."""
    current = start.astimezone(JAKARTA)
    remaining = max(0, minutes)
    while remaining:
        intervals = idx_trading_intervals(current)
        active = next(((begin, end) for begin, end in intervals if begin <= current < end), None)
        if active:
            available = int((active[1] - current).total_seconds() // 60)
            if remaining <= available:
                return current + timedelta(minutes=remaining)
            remaining -= available
            current = active[1]
        else:
            future = [begin for begin, _ in intervals if begin > current]
            if future:
                current = future[0]
            else:
                current = datetime.combine(current.date() + timedelta(days=1), clock_time(8, 59), JAKARTA)
    return current


def yahoo_rows(payload: dict) -> list[dict]:
    result = ((payload.get("chart") or {}).get("result") or [None])[0]
    if not result:
        error = (payload.get("chart") or {}).get("error")
        raise ValueError(f"Yahoo chart has no result: {error}")
    timestamps = result.get("timestamp") or []
    quote = (((result.get("indicators") or {}).get("quote") or [{}])[0])
    rows = []
    for index, timestamp in enumerate(timestamps):
        values = {key: (quote.get(key) or [None] * len(timestamps))[index]
                  for key in ("open", "high", "low", "close", "volume")}
        if any(values[key] is None for key in ("open", "high", "low", "close")):
            continue
        rows.append({"candle_at": datetime.fromtimestamp(timestamp, JAKARTA).isoformat(timespec="seconds"), **values})
    return rows


def ingest_yahoo(db, symbol: str, timeframe: str, payload: dict, collected_at: str | None = None) -> int:
    collected_at = collected_at or iso()
    rows = yahoo_rows(payload)
    for row in rows:
        db.execute("""INSERT INTO market_candles
          (symbol,timeframe,candle_at,open,high,low,close,volume,source,data_status,collected_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(symbol,timeframe,candle_at) DO UPDATE SET
          open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,
          volume=excluded.volume,data_status=excluded.data_status,collected_at=excluded.collected_at""",
          (symbol.upper(), timeframe, row["candle_at"], row["open"], row["high"], row["low"],
           row["close"], row["volume"] or 0, "yahoo", "DELAYED", collected_at))
    if rows:
        last = rows[-1]
        previous = rows[-2]["close"] if len(rows) > 1 else last["close"]
        change = (last["close"] - previous) / previous * 100 if previous else 0
        db.execute("UPDATE instruments SET last_price=?,change_pct=?,market_data_as_of=? WHERE symbol=?",
                   (last["close"], change, last["candle_at"], symbol.upper()))
    db.commit()
    return len(rows)


def collect_yahoo(db, universe: list[dict], timeframe: str, range_: str) -> tuple[int, list[dict]]:
    client, ok, errors = YahooClient(), 0, []
    for item in universe:
        symbol = item["symbol"].upper()
        try:
            payload = client.chart(symbol, timeframe, range_)
            count = ingest_yahoo(db, symbol, timeframe, payload)
            ok += 1
            log_event(db, "INFO", "collector", "symbol_collected", {"symbol": symbol, "candles": count})
        except (ProviderError, ValueError, IndexError) as exc:
            errors.append({"symbol": symbol, "error": str(exc)})
            log_event(db, "ERROR", "collector", "symbol_failed", errors[-1])
        db.commit()
    return ok, errors


def collect_ihsg_daily(db) -> dict:
    """Cache IHSG Daily candles once per EOD run for report generation."""
    try:
        count = ingest_yahoo(db, "^JKSE", "1d", YahooClient().chart("^JKSE", "1d", "1y"))
        result = {"status": "CACHED", "symbol": "^JKSE", "candles": count}
        log_event(db, "INFO", "collector", "ihsg_collected", result)
        return result
    except (ProviderError, ValueError, IndexError) as exc:
        result = {"status": "FAILED", "symbol": "^JKSE", "error": str(exc)}
        log_event(db, "WARNING", "collector", "ihsg_failed", result)
        return result


def arjum_usage(db) -> tuple[int, int]:
    """Return today's recorded calls and configured ceiling, never the API key."""
    today = now_wib().date().isoformat()
    row = db.execute("SELECT requests_used,request_limit FROM provider_usage WHERE provider='arjum' AND usage_date=?", (today,)).fetchone()
    if not row:
        db.execute("INSERT INTO provider_usage(provider,usage_date,requests_used,request_limit) VALUES('arjum',?,?,?)", (today, 0, settings.arjum_daily_limit))
        db.commit()
        return 0, settings.arjum_daily_limit
    # Keep today's persisted guard in sync after an operator changes the
    # provider plan/quota in .env. Usage is preserved; only the ceiling moves.
    configured_limit = int(settings.arjum_daily_limit)
    if int(row["request_limit"] or 0) != configured_limit:
        db.execute("UPDATE provider_usage SET request_limit=? WHERE provider='arjum' AND usage_date=?", (configured_limit, today))
        db.commit()
    return int(row["requests_used"]), configured_limit


def arjum_cache_is_fresh(db, symbol: str) -> bool:
    row = db.execute("SELECT expires_at,status FROM arjum_snapshots WHERE symbol=?", (symbol,)).fetchone()
    if not row or row["status"] != "CACHED":
        return False
    try:
        return datetime.fromisoformat(row["expires_at"]) > now_wib()
    except ValueError:
        return False


def collect_arjum_screener(db) -> dict:
    """Fetch the single daily Arjum screener snapshot and cache it locally."""
    today = now_wib().date().isoformat()
    row = db.execute("SELECT * FROM arjum_screener_snapshots WHERE snapshot_date=?", (today,)).fetchone()
    if row:
        try:
            if row["status"] == "CACHED" and datetime.fromisoformat(row["expires_at"]) > now_wib():
                return {"status": "CACHED", "requests": 0, "rows": len(json.loads(row["payload_json"]).get("rows", []))}
        except ValueError:
            pass
    if not settings.arjum_enabled or not settings.arjum_api_key:
        return {"status": "SKIPPED_NOT_CONFIGURED", "requests": 0, "rows": 0}
    used, limit = arjum_usage(db)
    if used >= limit:
        return {"status": "SKIPPED_QUOTA", "requests": 0, "rows": 0}
    db.execute("UPDATE provider_usage SET requests_used=requests_used+1 WHERE provider='arjum' AND usage_date=?", (today,)); db.commit()
    try:
        payload, error, status = ArjumClient(settings.arjum_api_key).screener(), None, "CACHED"
    except ProviderError as exc:
        payload, error, status = {}, str(exc), "ERROR"
    fetched_at, expires_at = iso(), iso(now_wib() + timedelta(hours=settings.arjum_cache_hours))
    db.execute("""INSERT INTO arjum_screener_snapshots VALUES(?,?,?,?,?,?) ON CONFLICT(snapshot_date) DO UPDATE SET
      fetched_at=excluded.fetched_at,expires_at=excluded.expires_at,payload_json=excluded.payload_json,status=excluded.status,error=excluded.error""",
      (today, fetched_at, expires_at, json.dumps(payload, ensure_ascii=False), status, error))
    log_event(db, "INFO" if status == "CACHED" else "ERROR", "arjum", "screener_collected", {"rows": len(payload.get("rows", [])), "error": error})
    db.commit()
    return {"status": status, "requests": 1, "rows": len(payload.get("rows", []))}


def arjum_screened_symbols(db) -> set[str]:
    row = db.execute("SELECT payload_json FROM arjum_screener_snapshots ORDER BY snapshot_date DESC LIMIT 1").fetchone()
    if not row:
        return set()
    try:
        rows = json.loads(row["payload_json"]).get("rows", [])
    except (TypeError, json.JSONDecodeError):
        return set()
    return {str(item.get("stock_code", "")).upper() for item in rows if isinstance(item, dict) and str(item.get("stock_code", "")).isalpha()}


def refresh_screener_flow_cache(db, symbol: str, payload: dict, fetched_at: str) -> None:
    """Persist the small flow fields used by the 962-row screener.

    The raw Arjum payload can be tens of kilobytes per ticker. Parsing every
    payload on a page request makes the local dashboard feel frozen, so this
    compact projection is refreshed only when the collector changes a snapshot.
    """
    broker = payload.get("broker_summary") if isinstance(payload.get("broker_summary"), dict) else {}
    history_block = payload.get("history") if isinstance(payload.get("history"), dict) else {}
    brokers = broker.get("brokers") if isinstance(broker.get("brokers"), list) else []
    history = history_block.get("rows") if isinstance(history_block.get("rows"), list) else []
    buyers = sorted((item for item in brokers if isinstance(item, dict) and float(item.get("nval") or 0) > 0), key=lambda item: float(item.get("nval") or 0), reverse=True)
    sellers = sorted((item for item in brokers if isinstance(item, dict) and float(item.get("nval") or 0) < 0), key=lambda item: float(item.get("nval") or 0))
    recent = history[:20] if history and str(history[0].get("date", "")) > str(history[-1].get("date", "")) else history[-20:]
    net_buy = sum(float(item.get("nval") or 0) for item in buyers[:5]) + sum(float(item.get("nval") or 0) for item in sellers[:5])
    foreign_net = sum(float(item.get("n_foreign") or 0) for item in recent)
    positive_days = sum(1 for item in recent if float(item.get("n_foreign") or 0) > 0)
    available = bool(brokers or history)
    db.execute("""INSERT INTO screener_flow_cache(symbol,source_fetched_at,status,verdict,net_buy,foreign_net,consistency,updated_at)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(symbol) DO UPDATE SET source_fetched_at=excluded.source_fetched_at,
      status=excluded.status,verdict=excluded.verdict,net_buy=excluded.net_buy,foreign_net=excluded.foreign_net,
      consistency=excluded.consistency,updated_at=excluded.updated_at""",
      (symbol, fetched_at, "AVAILABLE" if available else "DATA_NOT_AVAILABLE", "ACCUMULATION" if net_buy > 0 else "DISTRIBUTION" if available else None,
       net_buy if available else None, foreign_net if available else None,
       f"{positive_days}/{len(recent)} foreign-positive" if recent else None, iso()))


def collect_arjum_snapshot(db, symbol: str, endpoints: tuple[str, ...] | None = None, refresh_daily: bool = False) -> dict:
    """Fill a cached Arjum profile incrementally, within the daily quota."""
    symbol = symbol.upper()
    requested = tuple(endpoints or ARJUM_ENDPOINTS)
    unknown = set(requested) - set(ARJUM_ENDPOINTS)
    if unknown:
        raise ValueError(f"unknown Arjum resources: {sorted(unknown)}")
    if not settings.arjum_enabled or not settings.arjum_api_key:
        return {"symbol": symbol, "status": "SKIPPED_NOT_CONFIGURED", "requests": 0}
    cached = db.execute("SELECT payload_json,fetched_at,expires_at,status FROM arjum_snapshots WHERE symbol=?", (symbol,)).fetchone()
    payload = {}
    if cached:
        try: payload = json.loads(cached["payload_json"])
        except (TypeError, json.JSONDecodeError): payload = {}
        resource_times = payload.setdefault("_resource_fetched_at", {})
        for endpoint in ARJUM_ENDPOINTS:
            if endpoint in payload and endpoint not in resource_times:
                resource_times[endpoint] = cached["fetched_at"]
        missing_items = []
        for endpoint in requested:
            if endpoint not in payload:
                missing_items.append(endpoint); continue
            try:
                fetched = datetime.fromisoformat(resource_times[endpoint]).astimezone(JAKARTA)
                stale = fetched + timedelta(hours=settings.arjum_cache_hours) <= now_wib()
                wrong_day = refresh_daily and fetched.date() != now_wib().date()
            except (KeyError, TypeError, ValueError):
                stale, wrong_day = True, refresh_daily
            if stale or wrong_day:
                missing_items.append(endpoint)
        missing = tuple(missing_items)
        if not missing:
            return {"symbol": symbol, "status": "CACHED", "requests": 0}
    else:
        missing = requested
        payload["_resource_fetched_at"] = {}
    used, limit = arjum_usage(db)
    if used + len(missing) > limit:
        log_event(db, "WARNING", "arjum", "quota_reserved", {"symbol": symbol, "used": used, "limit": limit})
        db.commit()
        return {"symbol": symbol, "status": "SKIPPED_QUOTA", "requests": 0}
    # Reserve before calls: timeouts can still count at the provider.
    db.execute("UPDATE provider_usage SET requests_used=requests_used+? WHERE provider='arjum' AND usage_date=?", (len(missing), now_wib().date().isoformat()))
    db.commit()
    client, errors = ArjumClient(settings.arjum_api_key), []
    for endpoint in missing:
        try:
            payload[endpoint] = getattr(client, endpoint)(symbol)
            payload["_resource_fetched_at"][endpoint] = iso()
        except ProviderError as exc:
            errors.append({"endpoint": endpoint, "error": str(exc)})
    fetched_at, expires_at = iso(), iso(now_wib() + timedelta(hours=settings.arjum_cache_hours))
    status = "CACHED" if any(endpoint in payload for endpoint in ARJUM_ENDPOINTS) else "ERROR"
    db.execute("""INSERT INTO arjum_snapshots(symbol,fetched_at,expires_at,payload_json,request_count,status,error)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(symbol) DO UPDATE SET fetched_at=excluded.fetched_at,
      expires_at=excluded.expires_at,payload_json=excluded.payload_json,request_count=excluded.request_count,
      status=excluded.status,error=excluded.error""",
      (symbol, fetched_at, expires_at, json.dumps(payload, ensure_ascii=False), len(missing), status, json.dumps(errors, ensure_ascii=False) if errors else None))
    refresh_screener_flow_cache(db, symbol, payload, fetched_at)
    resources = sorted(endpoint for endpoint in ARJUM_ENDPOINTS if endpoint in payload)
    log_event(db, "INFO" if status == "CACHED" else "ERROR", "arjum", "snapshot_collected", {"symbol": symbol, "requests": len(missing), "resources": resources, "errors": errors})
    db.commit()
    return {"symbol": symbol, "status": status, "requests": len(missing), "errors": errors}


def collect_arjum_daily_universe(db) -> dict:
    """Refresh daily analysis and broker summary for every active IDX equity."""
    symbols = [row[0] for row in db.execute("SELECT symbol FROM instruments WHERE status='ACTIVE' ORDER BY symbol")]
    summary = {"selected": len(symbols), "cached": 0, "errors": 0, "quota_skips": 0, "requests": 0}
    log_event(db, "INFO", "arjum", "daily_universe_started", {"selected": len(symbols), "resources": list(ARJUM_DAILY_PROFILE_ENDPOINTS)})
    db.commit()
    for symbol in symbols:
        try:
            result = collect_arjum_snapshot(db, symbol, ARJUM_DAILY_PROFILE_ENDPOINTS, refresh_daily=True)
        except Exception as exc:
            result = {"symbol": symbol, "status": "ERROR", "requests": 0, "error": str(exc)}
        summary["requests"] += int(result.get("requests") or 0)
        if result.get("status") == "CACHED": summary["cached"] += 1
        elif result.get("status") == "SKIPPED_QUOTA": summary["quota_skips"] += 1
        else: summary["errors"] += 1
        if result.get("status") == "SKIPPED_QUOTA": break
    log_event(db, "INFO" if not summary["errors"] else "WARNING", "arjum", "daily_universe_completed", summary)
    db.commit()
    return summary


def collect_arjum_candidates(db, candidates: list[tuple[str, int]]) -> list[dict]:
    """Enrich only high-confidence actionable names; never scan the whole universe."""
    selected = sorted(candidates, key=lambda item: (-item[1], item[0]))[:max(0, settings.arjum_candidate_limit)]
    return [collect_arjum_snapshot(db, symbol) for symbol, _ in selected]


def ema(values: list[float], period: int) -> float | None:
    if len(values) < period: return None
    value, k = mean(values[:period]), 2 / (period + 1)
    for item in values[period:]: value = item * k + value * (1 - k)
    return value


def rsi(values: list[float], period: int = 14) -> float | None:
    if len(values) <= period: return None
    changes = [b-a for a, b in zip(values, values[1:])][-period:]
    gains, losses = mean([max(x, 0) for x in changes]), mean([max(-x, 0) for x in changes])
    if losses == 0: return 100.0
    return 100 - 100 / (1 + gains/losses)


def atr(rows: list[dict], period: int = 14) -> float | None:
    if len(rows) <= period: return None
    tr = []
    for previous, current in zip(rows, rows[1:]):
        tr.append(max(current["high"]-current["low"], abs(current["high"]-previous["close"]), abs(current["low"]-previous["close"])))
    return mean(tr[-period:])


def feature_set(rows: list[dict]) -> dict | None:
    # Yahoo can append a placeholder/current bar whose OHLC is populated but
    # volume is still zero. It must not suppress every volume-confirmed setup.
    source_latest = rows[-1]["candle_at"] if rows else None
    rows = [row for row in rows if float(row.get("volume") or 0) > 0]
    if len(rows) < 20: return None
    closes, volumes = [r["close"] for r in rows], [r["volume"] for r in rows]
    latest, previous = rows[-1], rows[-2]
    ema12, ema26 = ema(closes, 12), ema(closes, 26)
    volume_base = mean(volumes[-21:-1]) if len(volumes) >= 21 else mean(volumes[:-1])
    typical_value = sum(((r["high"]+r["low"]+r["close"])/3)*r["volume"] for r in rows[-20:])
    volume_sum = sum(r["volume"] for r in rows[-20:])
    prior_high = max(r["high"] for r in rows[-21:-1]) if len(rows) >= 21 else max(r["high"] for r in rows[:-1])
    latest_day = datetime.fromisoformat(latest["candle_at"]).date()
    session_rows = [row for row in rows if datetime.fromisoformat(row["candle_at"]).date() == latest_day]
    session_open = session_rows[0]["open"] if session_rows else latest["open"]
    session_low = min(row["low"] for row in session_rows) if session_rows else latest["low"]
    session_started_at = datetime.fromisoformat(session_rows[0]["candle_at"]) if session_rows else None
    latest_at = datetime.fromisoformat(latest["candle_at"])
    session_trading_minutes = idx_trading_minutes_between(session_started_at, latest_at) if session_started_at else None
    prior_breakout_level = None
    previous_breakout = False
    retest_confirmed = False
    if len(rows) >= 22:
        prior_breakout_level = max(r["high"] for r in rows[-22:-2])
        previous_breakout = previous["close"] > prior_breakout_level
        retest_confirmed = bool(previous_breakout and latest["low"] <= prior_breakout_level * 1.02
                                and latest["close"] >= prior_breakout_level and latest["close"] > latest["open"])
    return {
        "candle_at": latest["candle_at"], "open": latest["open"], "high": latest["high"],
        "low": latest["low"], "close": latest["close"], "volume": latest["volume"],
        "source_latest_candle_at": source_latest, "used_completed_candle": latest["candle_at"] != source_latest,
        "change_pct": (latest["close"]-previous["close"])/previous["close"]*100,
        "momentum_15m_pct": (latest["close"]-rows[-4]["close"])/rows[-4]["close"]*100 if len(rows) >= 4 and rows[-4]["close"] else 0,
        "ema12": ema12, "ema20": ema(closes, 20), "ema26": ema26, "ema50": ema(closes, 50),
        "sma20": mean(closes[-20:]), "rsi14": rsi(closes), "atr14": atr(rows),
        "macd": (ema12-ema26) if ema12 is not None and ema26 is not None else None,
        "relative_volume": latest["volume"]/volume_base if volume_base else 0,
        "vwap20": typical_value/volume_sum if volume_sum else latest["close"],
        "average_daily_volume": mean(volumes[-20:]),
        "average_daily_value": typical_value / min(20, len(rows)),
        "atr_pct": (atr(rows) or 0) / latest["close"] * 100 if latest["close"] else None,
        "prior_high20": prior_high, "breakout": latest["close"] > prior_high,
        "session_open": session_open, "session_low": session_low,
        "open_is_low": abs(session_open-session_low) <= server.tick_size(session_open),
        "session_trading_minutes": session_trading_minutes,
        "previous_breakout": previous_breakout, "breakout_level": prior_breakout_level,
        "retest_confirmed": retest_confirmed,
    }


def technical_score(features: dict) -> int:
    """Comparable 0–100 setup score, independent from WAIT confidence."""
    close = float(features.get("close") or 0)
    ema20, ema50 = features.get("ema20"), features.get("ema50")
    score = 0.0
    if ema20 and ema50 and close > ema20 > ema50: score += 25
    elif ema20 and close > ema20: score += 10
    rsi14 = features.get("rsi14")
    if rsi14 is not None and 45 <= float(rsi14) <= 75: score += 15
    score += min(max(float(features.get("relative_volume") or 0), 0) / 2, 1) * 25
    if features.get("breakout"): score += 20
    score += min(max(float(features.get("change_pct") or 0), 0) / 2, 1) * 10
    if float(features.get("average_daily_value") or 0) >= settings.liquidity_min_adv: score += 5
    return max(0, min(100, round(score)))


def intraday_feature_is_fresh(features: dict, moment: datetime | None = None) -> bool:
    try:
        candle_at = datetime.fromisoformat(features["candle_at"])
        if candle_at.tzinfo is None: candle_at = candle_at.replace(tzinfo=JAKARTA)
        candle_at=candle_at.astimezone(JAKARTA); current=(moment or now_wib()).astimezone(JAKARTA)
        elapsed=idx_trading_minutes_between(candle_at,current)
        return elapsed is not None and elapsed <= settings.intraday_stale_minutes and is_idx_trading_timestamp(candle_at)
    except (KeyError, TypeError, ValueError):
        return False


def local_liquidity_shortlist(staged: list[tuple[str, dict]], arjum_symbols: set[str]) -> tuple[list[tuple[str, dict]], list[tuple[str, dict]]]:
    """Gate Yahoo-cached IDX data locally: 900 -> 100 liquid -> 30–50 technical."""
    liquid = []
    for symbol, features in staged:
        adv = float(features.get("average_daily_value") or 0)
        atr_pct = float(features.get("atr_pct") or 0)
        if adv >= settings.liquidity_min_adv and .25 <= atr_pct <= 20:
            # Arjum's daily screener is a priority signal, never a liquidity bypass.
            priority = 1.20 if symbol in arjum_symbols else 1.0
            liquid.append((symbol, features, adv * priority))
    liquid.sort(key=lambda item: item[2], reverse=True)
    liquid_top = [(symbol, features) for symbol, features, _ in liquid[:settings.liquid_universe_limit]]
    technical = []
    for symbol, features in liquid_top:
        trend = int(bool(features.get("ema20") and features.get("ema50") and features["close"] > features["ema20"] > features["ema50"]))
        breakout = int(bool(features.get("breakout")))
        score = technical_score(features)
        if symbol in arjum_symbols:
            score += 10
        if score > 10:
            technical.append((symbol, features, score))
    technical.sort(key=lambda item: item[2], reverse=True)
    return liquid_top, [(symbol, features) for symbol, features, _ in technical[:settings.technical_candidate_limit]]


def candle_rows(db, symbol: str, timeframe: str, limit: int = 120) -> list[dict]:
    rows = db.execute("""SELECT candle_at,open,high,low,close,volume,data_status
      FROM market_candles WHERE symbol=? AND timeframe=? ORDER BY candle_at DESC LIMIT ?""",
      (symbol, timeframe, limit)).fetchall()
    normalized=[dict(row) for row in reversed(rows)]
    if timeframe != "1d":
        normalized=[row for row in normalized if is_idx_trading_timestamp(row["candle_at"])]
    return normalized


@dataclass
class Proposal:
    agent_id: str; action: str; confidence: int | None; rationale: str
    horizon: str; entry: float | None = None; stop: float | None = None
    target: float | None = None; risk_pct: float = 0; status: str = "WAITING"


def evaluate_agents(features: dict, fundamental_quality: int | None, timeframe: str = "5m") -> list[Proposal]:
    f = features
    close = float(features["close"])
    volatility = float(features.get("atr14") or close * .03)
    proposals: list[Proposal] = []
    if timeframe == "5m":
        vwap_distance = (close - f["vwap20"]) / f["vwap20"] * 100 if f.get("vwap20") else 99
        momentum_15m = float(f.get("momentum_15m_pct") or f["change_pct"])
        scalp_ok = bool(.20 <= momentum_15m <= 2.0 and 0 <= vwap_distance <= 1.5
                        and f["relative_volume"] >= 1.5 and 50 <= (f.get("rsi14") or 0) <= 72)
        scalp_stop_distance = max(1.2 * volatility, close * .008)
        scalp_target_distance = 2.4 * scalp_stop_distance + close * (BUY_FEE + SELL_FEE)
        proposals.append(Proposal("scalping", "BUY" if scalp_ok else "WAIT", 72 if scalp_ok else 45,
            "Momentum 5m, RVOL, RSI, dan jarak VWAP lolos." if scalp_ok else "Gate momentum 5m/RVOL/RSI/VWAP belum lengkap.",
            "Intraday 5m delayed", close if scalp_ok else None,
            close-scalp_stop_distance if scalp_ok else None,
            close+scalp_target_distance if scalp_ok else None, 3 if scalp_ok else 0,
            "ACTIONABLE" if scalp_ok else "WAITING"))
        opening_window = f.get("session_trading_minutes") is not None and f["session_trading_minutes"] <= 60
        open_ok = bool(opening_window and f["open_is_low"] and close > f["vwap20"]
                       and f["relative_volume"] >= 1.25 and momentum_15m > .10)
        open_stop = f["session_open"] - server.tick_size(f["session_open"])
        open_risk = max(close-open_stop, close*.006)
        proposals.append(Proposal("open-low", "BUY" if open_ok else "NOT_APPLICABLE", 74 if open_ok else None,
            "Open sesi bertahan sebagai low; candle 5m, RVOL, VWAP, dan jendela 60 menit lolos." if open_ok else "Open=Low 5m tidak valid atau jendela 60 menit sudah lewat.",
            "Hari ini · 5m delayed", close if open_ok else None, open_stop if open_ok else None,
            close + 2.2*open_risk + close*(BUY_FEE+SELL_FEE) if open_ok else None,
            3 if open_ok else 0, "ACTIONABLE" if open_ok else "WAITING"))
        return proposals

    trend = f["ema20"] and f["ema50"] and close > f["ema20"] > f["ema50"]
    swing_ok = bool(trend and 48 <= (f["rsi14"] or 0) <= 72 and f["relative_volume"] >= 1.0)
    proposals.append(Proposal("swing", "BUY" if swing_ok else "WAIT", 76 if swing_ok else 50,
        "Trend Daily EMA20/50, RSI, dan volume lolos." if swing_ok else "Setup Daily belum memenuhi trend/RSI/volume.",
        "5–15 hari", close if swing_ok else None, close-1.8*volatility if swing_ok else None, close+3.2*volatility if swing_ok else None, 3 if swing_ok else 0, "ACTIONABLE" if swing_ok else "WAITING"))
    quality = int(fundamental_quality) if isinstance(fundamental_quality, (int, float)) and not isinstance(fundamental_quality, bool) else None
    fundamental_timing = bool(quality is not None and quality >= 60 and f.get("ema20") and
        close >= f["ema20"] * .95 and close <= f["ema20"] * 1.10 and (f.get("rsi14") or 100) <= 70)
    if quality is None:
        fundamental = Proposal("fundamental", "WATCH", None,
            "DATA NOT AVAILABLE; menunggu snapshot fundamental tervalidasi.", "3–6 bulan", status="INCOMPLETE")
    elif fundamental_timing:
        fundamental = Proposal("fundamental", "ACCUMULATE", min(85, max(60, quality)),
            "Cicilan 1/3: quality score dan timing harga lolos; penambahan berikutnya menunggu evaluasi baru.",
            "3–6 bulan · tranche 1/3", close, close-2.25*volatility, close+4*volatility, 1, "ACTIONABLE")
    else:
        fundamental = Proposal("fundamental", "WATCH", min(80, max(40, quality)),
            "Fundamental tersedia, tetapi quality minimum atau timing entry belum lolos.", "3–6 bulan", status="WAITING")
    proposals.append(fundamental)
    breakout_ok = f.get("retest_confirmed") and f["relative_volume"] >= .8
    proposals.append(Proposal("breakout-retest", "BUY" if breakout_ok else "WAIT", 84 if breakout_ok else 55,
        "Breakout Daily candle sebelumnya telah retest dan bertahan di atas resistance." if breakout_ok else "Menunggu breakout Daily diikuti retest valid; breakout satu candle tidak dikejar.",
        "2–10 hari", close if breakout_ok else None,
        min((f.get("breakout_level") or close)-server.tick_size(close), close-1.2*volatility) if breakout_ok else None,
        close+3*volatility if breakout_ok else None, 3 if breakout_ok else 0, "ACTIONABLE" if breakout_ok else "WAITING"))
    return proposals


def round_to_tick(price: float) -> float:
    tick = server.tick_size(price)
    return math.floor(price/tick)*tick


def round_up_to_tick(price: float) -> float:
    tick = server.tick_size(price)
    return math.ceil(price/tick)*tick


def net_risk_reward(entry: float, stop: float, target: float) -> float:
    """Risk/reward after both Indonesian broker-side paper fees."""
    net_target = target * (1-SELL_FEE) - entry * (1+BUY_FEE)
    net_stop_loss = entry * (1+BUY_FEE) - stop * (1-SELL_FEE)
    return net_target / net_stop_loss if net_target > 0 and net_stop_loss > 0 else 0


def minimum_target_for_net_rr(entry: float, stop: float, ratio: float = 1.55) -> float:
    net_stop_loss = entry*(1+BUY_FEE)-stop*(1-SELL_FEE)
    required = (entry*(1+BUY_FEE)+ratio*net_stop_loss)/(1-SELL_FEE)
    return round_up_to_tick(required)


def cooldown_active(db, agent_id: str, symbol: str, moment: datetime | None = None) -> bool:
    row = db.execute("SELECT until_at FROM agent_cooldowns WHERE agent_id=? AND symbol=?", (agent_id, symbol)).fetchone()
    return bool(row and row["until_at"] > iso(moment))


def portfolio_usage(db, agent_id: str) -> tuple[float, float]:
    pending = db.execute("""SELECT COALESCE(SUM(limit_price*lots*100),0) notional,
      COALESCE(SUM(MAX(limit_price-COALESCE(stop_price,limit_price),0)*lots*100),0) risk
      FROM paper_orders WHERE agent_id=? AND status='PENDING'""", (agent_id,)).fetchone()
    opened = db.execute("""SELECT COALESCE(SUM(last_price*lots*100),0) notional,
      COALESCE(SUM(MAX(entry_price-COALESCE(stop_price,entry_price),0)*lots*100),0) risk
      FROM positions WHERE agent_id=? AND status='OPEN'""", (agent_id,)).fetchone()
    return float(pending["notional"] + opened["notional"]), float(pending["risk"] + opened["risk"])


def persist_proposal(db, run_id: str, symbol: str, proposal: Proposal, data_status: str,
                     timeframe: str = "5m") -> tuple[str, bool]:
    proposal_id = f"prop-{uuid.uuid4().hex[:18]}"
    entry, stop, target = proposal.entry, proposal.stop, proposal.target
    if entry and stop and target:
        entry, stop, target = round_to_tick(entry), round_to_tick(stop), round_to_tick(target)
        target = max(target, minimum_target_for_net_rr(entry, stop))
        rr = net_risk_reward(entry, stop, target) if entry > stop else 0
        equity = db.execute("SELECT equity FROM agents WHERE id=?", (proposal.agent_id,)).fetchone()[0]
        sizing = server.risk_size(equity, entry, stop, proposal.risk_pct, 25)
        lots = sizing["lots"]
        final_status = proposal.status if rr >= MIN_NET_RISK_REWARD and lots > 0 else "REJECTED_BY_RISK"
        if data_status == "DELAYED" and not settings.allow_delayed_paper:
            final_status = "REJECTED_DELAYED_DATA"
    else:
        rr, lots, final_status = None, None, proposal.status
    created_at = now_wib()
    created = iso(created_at)
    valid_until = (iso(add_idx_trading_minutes(created_at, 45)) if timeframe == "5m"
                   else iso(created_at+timedelta(days=3))) if entry else None
    db.execute("""INSERT INTO agent_proposals
      (id,run_id,agent_id,symbol,action,confidence,horizon,rationale,entry_low,entry_high,
       stop_price,target_price,equity_risk_pct,risk_reward,lots,status,created_at,valid_until,data_status,strategy_version)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
      (proposal_id, run_id, proposal.agent_id, symbol, proposal.action, proposal.confidence,
       proposal.horizon, proposal.rationale, entry, entry, stop, target, proposal.risk_pct,
       round(rr, 2) if rr is not None else None, lots, final_status, created, valid_until, data_status, STRATEGY_VERSION))
    db.execute("""INSERT INTO decisions(agent_id,symbol,action,confidence,rationale,entry_low,
      entry_high,stop_price,target_price,equity_risk_pct,risk_reward,status,evaluated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",
      (proposal.agent_id, symbol, proposal.action, proposal.confidence, proposal.rationale,
       entry, entry, stop, target, proposal.risk_pct, round(rr,2) if rr is not None else None,
       final_status, created))
    order_created = False
    if final_status == "ACTIONABLE" and proposal.action in {"BUY", "ACCUMULATE"} and lots and not settings.demo_mode:
        exists = db.execute("SELECT 1 FROM paper_orders WHERE agent_id=? AND symbol=? AND status='PENDING'", (proposal.agent_id, symbol)).fetchone()
        position_count = db.execute("SELECT COUNT(*) FROM positions WHERE agent_id=? AND symbol=? AND status='OPEN'", (proposal.agent_id, symbol)).fetchone()[0]
        max_symbol_positions = 3 if proposal.agent_id == "fundamental" else 1
        equity = db.execute("SELECT equity FROM agents WHERE id=?", (proposal.agent_id,)).fetchone()[0]
        reserved_notional, reserved_risk = portfolio_usage(db, proposal.agent_id)
        order_notional, order_risk = entry*lots*100, max(0,(entry-stop)*lots*100)
        capacity_ok = reserved_notional+order_notional <= equity*.80 and reserved_risk+order_risk <= equity*.10
        cooling_down = cooldown_active(db, proposal.agent_id, symbol, created_at)
        if not exists and position_count < max_symbol_positions and capacity_ok and not cooling_down:
            order_id = f"ord-{uuid.uuid4().hex[:18]}"
            db.execute("""INSERT INTO paper_orders
              (id,proposal_id,agent_id,symbol,side,order_type,lots,limit_price,stop_price,target_price,
               status,created_at,expires_at,source_candle_at,timeframe,strategy_version)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (order_id, proposal_id, proposal.agent_id, symbol, "BUY", "LIMIT", lots, entry,
               stop, target, "PENDING", created, valid_until, features_candle(db, run_id, symbol),
               timeframe, STRATEGY_VERSION))
            order_created = True
        elif not capacity_ok:
            db.execute("UPDATE agent_proposals SET status='REJECTED_PORTFOLIO_CAP' WHERE id=?", (proposal_id,))
        elif cooling_down:
            db.execute("UPDATE agent_proposals SET status='REJECTED_COOLDOWN' WHERE id=?", (proposal_id,))
        elif position_count >= max_symbol_positions:
            db.execute("UPDATE agent_proposals SET status='REJECTED_POSITION_EXISTS' WHERE id=?", (proposal_id,))
    return proposal_id, order_created


def features_candle(db, run_id: str, symbol: str) -> str:
    row = db.execute("SELECT features_json FROM feature_snapshots WHERE run_id=? AND symbol=?", (run_id, symbol)).fetchone()
    return json.loads(row[0])["candle_at"]


def expire_pending_orders(db, moment: datetime | None = None) -> int:
    """Release portfolio capacity held by paper orders past their validity."""
    cursor = db.execute("""UPDATE paper_orders SET status='EXPIRED'
      WHERE status='PENDING' AND expires_at IS NOT NULL AND expires_at<?""", (iso(moment),))
    db.commit()
    return cursor.rowcount


def process_pending_orders(db, timeframe: str) -> int:
    if timeframe != "5m":
        return 0
    fills = 0
    expire_pending_orders(db)
    orders = db.execute("SELECT * FROM paper_orders WHERE status='PENDING' AND strategy_version=?", (STRATEGY_VERSION,)).fetchall()
    for order in orders:
        eligible_after = max(order["source_candle_at"], order["created_at"])
        candles = db.execute("""SELECT * FROM market_candles WHERE symbol=? AND timeframe=?
          AND candle_at>? ORDER BY candle_at""", (order["symbol"], timeframe, eligible_after)).fetchall()
        for candle in candles:
            if not is_idx_trading_timestamp(candle["candle_at"]):
                continue
            if order["expires_at"] and candle["candle_at"] > order["expires_at"]:
                db.execute("UPDATE paper_orders SET status='EXPIRED' WHERE id=?", (order["id"],)); break
            if not (candle["low"] <= order["limit_price"] <= candle["high"]):
                continue
            price, shares = order["limit_price"], order["lots"]*100
            gross, fees = price*shares, price*shares*BUY_FEE
            ledger = db.execute("SELECT cash FROM agent_ledgers WHERE agent_id=?", (order["agent_id"],)).fetchone()
            if not ledger or ledger["cash"] < gross+fees:
                db.execute("UPDATE paper_orders SET status='REJECTED_CASH' WHERE id=?", (order["id"],)); break
            fill_id = f"fill-{uuid.uuid4().hex[:18]}"
            db.execute("INSERT INTO paper_fills VALUES(?,?,?,?,?,?,?,?)", (fill_id,order["id"],candle["candle_at"],price,order["lots"],gross,fees,candle["data_status"]))
            db.execute("UPDATE paper_orders SET status='FILLED' WHERE id=?", (order["id"],))
            db.execute("UPDATE agent_ledgers SET cash=cash-?,fees_paid=fees_paid+?,updated_at=? WHERE agent_id=?", (gross+fees,fees,iso(),order["agent_id"]))
            initial_risk = (price*(1+BUY_FEE)-order["stop_price"]*(1-SELL_FEE))*shares
            db.execute("""INSERT INTO positions
              (agent_id,symbol,lots,entry_price,last_price,stop_price,target_price,status,fill_id,
               opened_at,entry_candle_at,last_managed_candle_at,buy_fees,initial_risk,strategy_version)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (order["agent_id"],order["symbol"],order["lots"],price,candle["close"],
               order["stop_price"],order["target_price"],"OPEN",fill_id,candle["candle_at"],
               candle["candle_at"],candle["candle_at"],fees,initial_risk,STRATEGY_VERSION))
            fills += 1
            break
    db.commit(); return fills


def manage_positions(db, timeframe: str) -> int:
    if timeframe != "5m":
        return 0
    closed = 0
    positions = db.execute("SELECT * FROM positions WHERE status='OPEN' AND strategy_version=?", (STRATEGY_VERSION,)).fetchall()
    for position in positions:
        after = position["last_managed_candle_at"] or position["entry_candle_at"] or position["opened_at"]
        candles = db.execute("""SELECT * FROM market_candles WHERE symbol=? AND timeframe=?
          AND candle_at>? ORDER BY candle_at""", (position["symbol"], timeframe, after)).fetchall()
        for candle in candles:
            if not is_idx_trading_timestamp(candle["candle_at"]):
                continue
            db.execute("UPDATE positions SET last_price=?,last_managed_candle_at=? WHERE id=?",
                       (candle["close"], candle["candle_at"], position["id"]))
            stop_hit = bool(position["stop_price"] and candle["low"] <= position["stop_price"])
            target_hit = bool(position["target_price"] and candle["high"] >= position["target_price"])
            exit_price = reason = None
            if stop_hit:
                exit_price = min(position["stop_price"], candle["open"])
                reason = "AMBIGUOUS_STOP" if target_hit else "STOP_LOSS"
            elif target_hit:
                exit_price, reason = position["target_price"], "TARGET"
            elif position["agent_id"] in {"scalping", "open-low"}:
                opened = datetime.fromisoformat(position["opened_at"])
                current_candle = datetime.fromisoformat(candle["candle_at"])
                active_age = idx_trading_minutes_between(opened, current_candle)
                if current_candle.date() > opened.date():
                    exit_price, reason = candle["open"], "OVERNIGHT_SAFETY_EXIT"
                elif position["agent_id"] == "scalping" and active_age is not None and active_age >= 60:
                    exit_price, reason = candle["close"], "TIME_STOP_60M"
                elif position["agent_id"] == "open-low" and current_candle.time() >= clock_time(15, 40):
                    exit_price, reason = candle["close"], "END_OF_DAY_EXIT"
            if not exit_price:
                continue
            shares = position["lots"]*100
            gross = exit_price*shares
            sell_fees = gross*SELL_FEE
            gross_pnl = (exit_price-position["entry_price"])*shares
            net_pnl = gross_pnl-float(position["buy_fees"] or 0)-sell_fees
            initial_risk = float(position["initial_risk"] or 0)
            r_multiple = net_pnl/initial_risk if initial_risk > 0 else None
            db.execute("UPDATE positions SET last_price=?,status='CLOSED',last_managed_candle_at=? WHERE id=?",
                       (exit_price,candle["candle_at"],position["id"]))
            db.execute("""UPDATE agent_ledgers SET cash=cash+?,realized_pnl=realized_pnl+?,
              fees_paid=fees_paid+?,updated_at=? WHERE agent_id=?""",
              (gross-sell_fees,net_pnl,sell_fees,iso(),position["agent_id"]))
            db.execute("""INSERT INTO trade_journal
              (agent_id,symbol,opened_at,closed_at,lots,entry_price,exit_price,gross_pnl,fees,
               net_pnl,r_multiple,setup,exit_reason,notes,buy_fees,sell_fees,initial_risk,strategy_version)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
              (position["agent_id"],position["symbol"],position["opened_at"],candle["candle_at"],
               position["lots"],position["entry_price"],exit_price,gross_pnl,
               float(position["buy_fees"] or 0)+sell_fees,net_pnl,r_multiple,"engine-paper-v2",
               reason,"Yahoo delayed; stop diprioritaskan bila urutan intrabar ambigu",
               float(position["buy_fees"] or 0),sell_fees,initial_risk,STRATEGY_VERSION))
            exit_at = datetime.fromisoformat(candle["candle_at"])
            cooldown_until = (add_idx_trading_minutes(exit_at, 30) if position["agent_id"] in {"scalping","open-low"}
                              else exit_at+timedelta(days=1))
            db.execute("""INSERT INTO agent_cooldowns(agent_id,symbol,until_at,reason,strategy_version)
              VALUES(?,?,?,?,?) ON CONFLICT(agent_id,symbol) DO UPDATE SET
              until_at=excluded.until_at,reason=excluded.reason,strategy_version=excluded.strategy_version""",
              (position["agent_id"],position["symbol"],iso(cooldown_until),reason,STRATEGY_VERSION))
            closed += 1
            break
    db.commit(); return closed


def mark_to_market(db) -> None:
    for agent in db.execute("SELECT id,starting_equity FROM agents").fetchall():
        ledger = db.execute("SELECT cash FROM agent_ledgers WHERE agent_id=?",(agent["id"],)).fetchone()
        if not ledger: continue
        market_value=db.execute("SELECT COALESCE(SUM(last_price*lots*100),0) FROM positions WHERE agent_id=? AND status='OPEN'",(agent["id"],)).fetchone()[0]
        equity=ledger["cash"]+market_value
        journal = db.execute("""SELECT COUNT(*) trades,
          COALESCE(SUM(CASE WHEN net_pnl>0 THEN 1 ELSE 0 END),0) wins
          FROM trade_journal WHERE agent_id=? AND strategy_version=? AND closed_at IS NOT NULL""",
          (agent["id"],STRATEGY_VERSION)).fetchone()
        risk_value = db.execute("""SELECT COALESCE(SUM(MAX(entry_price-COALESCE(stop_price,entry_price),0)*lots*100),0)
          FROM positions WHERE agent_id=? AND status='OPEN'""", (agent["id"],)).fetchone()[0]
        peak = db.execute("SELECT MAX(equity) FROM equity_history WHERE agent_id=?", (agent["id"],)).fetchone()[0]
        peak = max(float(peak or equity), equity)
        drawdown = (equity-peak)/peak*100 if peak else 0
        win_rate = journal["wins"]/journal["trades"]*100 if journal["trades"] else 0
        open_risk_pct = risk_value/equity*100 if equity else 0
        db.execute("UPDATE agents SET equity=?,win_rate=?,open_risk_pct=? WHERE id=?",
                   (equity,win_rate,open_risk_pct,agent["id"]))
        db.execute("INSERT OR REPLACE INTO equity_history(agent_id,equity_date,equity,cash,drawdown_pct) VALUES(?,?,?,?,?)",
                   (agent["id"],now_wib().date().isoformat(),equity,ledger["cash"],drawdown))
    db.commit()


def ihsg_report_snapshot(db, report_date) -> dict:
    rows = [dict(row) for row in db.execute("""SELECT candle_at,open,high,low,close,volume
      FROM market_candles WHERE symbol='^JKSE' AND timeframe='1d' AND date(candle_at)<=?
      ORDER BY candle_at DESC LIMIT 80""", (report_date.isoformat(),)).fetchall()]
    rows.reverse()
    if not rows:
        return {"status":"DATA_NOT_AVAILABLE","symbol":"^JKSE","candles":[],
          "explanation":"Data IHSG Daily belum tersedia pada snapshot. Collector EOD akan mengisinya tanpa request saat report dibuka."}
    closes = [float(row["close"]) for row in rows]
    latest = rows[-1]
    previous = closes[-2] if len(closes) > 1 else closes[-1]
    sma20 = mean(closes[-20:]) if len(closes) >= 20 else None
    sma50 = mean(closes[-50:]) if len(closes) >= 50 else None
    rsi14 = rsi(closes) if len(closes) >= 15 else None
    change_pct = (closes[-1]-previous)/previous*100 if previous else 0
    return_5d = (closes[-1]/closes[-6]-1)*100 if len(closes) >= 6 else None
    return_20d = (closes[-1]/closes[-21]-1)*100 if len(closes) >= 21 else None
    high20 = max(closes[-20:]) if len(closes) >= 20 else max(closes)
    drawdown_high20 = (closes[-1]/high20-1)*100 if high20 else None
    above20 = bool(sma20 and closes[-1] >= sma20)
    above50 = bool(sma50 and closes[-1] >= sma50)
    trend = "BULLISH" if above20 and above50 else "BEARISH" if not above20 and not above50 else "NEUTRAL"
    momentum = "positif" if change_pct > .15 else "negatif" if change_pct < -.15 else "datar"
    position = "di atas" if above20 else "di bawah"
    explanation = (f"IHSG ditutup {momentum} {abs(change_pct):.2f}% pada {closes[-1]:,.2f}. "
      f"Indeks berada {position} SMA20"
      + (f" dan {'di atas' if above50 else 'di bawah'} SMA50" if sma50 else "")
      + f". Regime teknikal Daily diklasifikasikan {trend.lower()}"
      + (f" dengan RSI14 {rsi14:.1f}." if rsi14 is not None else "."))
    chart_rows = []
    for index, row in enumerate(rows[-60:]):
        source_index = len(rows)-min(60,len(rows))+index
        window = closes[max(0,source_index-19):source_index+1]
        chart_rows.append({**row,"sma20":round(mean(window),2) if len(window) >= 20 else None})
    return {"status":"AVAILABLE","symbol":"^JKSE","name":"Indeks Harga Saham Gabungan",
      "as_of":latest["candle_at"],"close":round(closes[-1],2),"change_pct":round(change_pct,2),
      "return_5d_pct":round(return_5d,2) if return_5d is not None else None,
      "return_20d_pct":round(return_20d,2) if return_20d is not None else None,
      "sma20":round(sma20,2) if sma20 is not None else None,"sma50":round(sma50,2) if sma50 is not None else None,
      "rsi14":round(rsi14,1) if rsi14 is not None else None,"distance_from_20d_high_pct":round(drawdown_high20,2) if drawdown_high20 is not None else None,
      "trend":trend,"explanation":explanation,"candles":chart_rows,"source":"Yahoo cached - delayed paper data"}


def publish_daily_report(db, run_id: str, run_status: str, universe_size: int) -> None:
    proposals = [dict(row) for row in db.execute("""SELECT p.*,a.name agent_name
      FROM agent_proposals p JOIN agents a ON a.id=p.agent_id
      WHERE p.run_id=? ORDER BY COALESCE(p.confidence,0) DESC""", (run_id,)).fetchall()]
    actionable = [p for p in proposals if p["status"] == "ACTIONABLE"]
    ranked = [p for p in proposals if p["action"] in {"BUY", "ACCUMULATE"}]
    setup_source = actionable or ranked
    instrument_rows = {row["symbol"]: dict(row) for row in db.execute(
        "SELECT symbol,last_price,change_pct,evaluation_score,evaluation_status FROM instruments"
    ).fetchall()}
    setups = [{"rank": index+1, "symbol": p["symbol"], "owner_agent": p["agent_id"],
      "owner_agent_name": p["agent_name"], "action": p["action"],
      "status": p["status"], "score": p["confidence"], "last_price": p["entry_high"],
      "change_pct": instrument_rows.get(p["symbol"], {}).get("change_pct"),
      "rationale": p["rationale"], "horizon": p["horizon"], "valid_until": p["valid_until"],
      "entry_low": p["entry_low"], "entry_high": p["entry_high"], "stop_price": p["stop_price"],
      "target_price": p["target_price"], "stop_distance_pct": round((p["entry_high"]-p["stop_price"])/p["entry_high"]*100,2) if p["entry_high"] and p["stop_price"] else None,
      "agent_equity_risk_pct": p["equity_risk_pct"], "risk_reward": p["risk_reward"], "lots":p["lots"], "evaluation_ref": p["id"]}
      for index, p in enumerate(setup_source[:20])]

    run = db.execute("SELECT * FROM engine_runs WHERE id=?", (run_id,)).fetchone()
    try:
        report_date = datetime.fromisoformat(run["completed_at"] or run["started_at"]).astimezone(JAKARTA).date()
    except (TypeError, ValueError, KeyError):
        report_date = now_wib().date()
    symbols_ok = int(run["symbols_ok"] or 0) if run else 0
    symbols_failed = int(run["symbols_failed"] or 0) if run else 0
    coverage_pct = round(symbols_ok / universe_size * 100, 1) if universe_size else 0
    quality_errors = []
    if symbols_failed: quality_errors.append(f"{symbols_failed} symbol gagal mengambil data")
    if universe_size and symbols_ok < universe_size: quality_errors.append(f"Coverage {symbols_ok}/{universe_size}")

    feature_rows = db.execute("SELECT features_json FROM feature_snapshots WHERE run_id=?", (run_id,)).fetchall()
    features = []
    for row in feature_rows:
        try: features.append(json.loads(row["features_json"]))
        except (TypeError, ValueError): pass
    advancing = sum(1 for f in features if float(f.get("change_pct") or 0) > 0)
    above_ema20 = sum(1 for f in features if f.get("ema20") and float(f.get("close") or 0) > float(f["ema20"]))
    sample_size = len(features)
    breadth_pct = round(advancing / sample_size * 100, 1) if sample_size else None
    trend_pct = round(above_ema20 / sample_size * 100, 1) if sample_size else None
    if sample_size:
        regime_score = ((breadth_pct or 0) + (trend_pct or 0)) / 2
        regime_label = "BULLISH" if regime_score >= 60 else "BEARISH" if regime_score < 40 else "NEUTRAL"
        regime_confidence = round(abs(regime_score - 50) * 2)
    else:
        regime_label, regime_confidence = "UNCLASSIFIED", None

    agent_evaluations = []
    for agent in db.execute("SELECT id,name FROM agents ORDER BY rowid").fetchall():
        own = [p for p in proposals if p["agent_id"] == agent["id"]]
        counts = {}
        for proposal in own: counts[proposal["status"]] = counts.get(proposal["status"], 0) + 1
        best = max(own, key=lambda p: p["confidence"] or -1, default=None)
        agent_evaluations.append({"agent_id": agent["id"], "agent_name": agent["name"],
          "evaluated": len(own), "actionable": counts.get("ACTIONABLE", 0),
          "waiting": counts.get("WAITING", 0), "research": counts.get("RESEARCH", 0),
          "rejected": sum(v for k,v in counts.items() if k.startswith("REJECTED")),
          "best_symbol": best["symbol"] if best else None, "best_action": best["action"] if best else None,
          "best_confidence": best["confidence"] if best else None,"best_status":best["status"] if best else None,
          "best_rationale":best["rationale"] if best else None})

    payload = {"schema_version":"1.3","report_id":f"idx-engine-{report_date}","evaluation_date":report_date.isoformat(),
      "generated_at":iso(),"status":"READY" if run_status in {"COMPLETED","PARTIAL"} else "NOT_READY",
      "source_mode":"engine_snapshot","rescan_on_read":False,"run_id":run_id,
      "universe":{"type":"ALL_ACTIVE_IDX","index_filter":None,"eligible_count":universe_size,"evaluated_count":len({p['symbol'] for p in proposals}),"symbols_ok":symbols_ok,"failed_count":symbols_failed,"coverage_pct":coverage_pct},
      "data_quality":{"score_pct":coverage_pct,"market_data_as_of":max((p["created_at"] for p in proposals),default=None),"provider":"yahoo","provider_delay_minutes":settings.yahoo_delay_minutes,"status":"DELAYED" if symbols_ok else "INCOMPLETE","errors":quality_errors},
      "market_regime":{"label":regime_label,"confidence":regime_confidence,"new_position_cap":8,"breadth_positive_pct":breadth_pct,"above_ema20_pct":trend_pct,"sample_size":sample_size},
      "ihsg":ihsg_report_snapshot(db, report_date),
      "funnel":{"universe_scanned":symbols_ok,"feature_samples":sample_size,
        "unique_candidates":len({p['symbol'] for p in proposals}),"agent_evaluations":len(proposals),
        "technical_matches":len(proposals),"hard_rejects":len([p for p in proposals if p['status'].startswith('REJECTED')]),
        "shortlisted":len([p for p in proposals if p['action'] in {'BUY','ACCUMULATE'}]),"actionable":len(actionable),"silent_accumulation":0},
      "setups":setups,"agent_evaluations":agent_evaluations}
    db.execute("INSERT OR REPLACE INTO reports VALUES(?,?,?,?,?,?)",(payload["evaluation_date"],payload["status"],json.dumps(payload,ensure_ascii=False),payload["generated_at"],payload["source_mode"],0));db.commit()


def acquire_run_lock(db, run_id: str) -> bool:
    db.execute("BEGIN IMMEDIATE")
    lock = db.execute("SELECT * FROM engine_locks WHERE name='engine'").fetchone()
    if lock:
        try: stale = now_wib() - datetime.fromisoformat(lock["acquired_at"]) > timedelta(minutes=30)
        except ValueError: stale = True
        if not stale:
            db.rollback(); return False
        db.execute("DELETE FROM engine_locks WHERE name='engine'")
    db.execute("INSERT INTO engine_locks VALUES('engine',?,?)", (run_id,iso()))
    db.commit(); return True


def run_engine(timeframe: str="5m", range_: str="5d", collect: bool=True, force: bool=False, full_universe: bool=False) -> dict:
    phase=market_phase()
    allowed_phases={"POSTCLOSE"} if timeframe=="1d" else {"SESSION_1","SESSION_2"}
    if not force and phase not in allowed_phases:
        return {"status":"SKIPPED","reason":"market_closed","phase":phase}
    server.init_db(); db=server.connect(); ensure_runtime(db); master_universe=load_universe(); sync_universe(db,master_universe)
    universe=master_universe if timeframe=="1d" or full_universe else intraday_universe(db,master_universe)
    run_id=f"run-{uuid.uuid4().hex[:18]}"; started=iso()
    if not acquire_run_lock(db,run_id):
        db.close(); return {"status":"SKIPPED","reason":"engine_already_running"}
    run_type="eod" if timeframe=="1d" else ("full_intraday" if full_universe else "intraday")
    db.execute("INSERT INTO engine_runs(id,run_type,started_at,status,timeframe,universe_size,source_delay_minutes) VALUES(?,?,?,?,?,?,?)",(run_id,run_type,started,"RUNNING",timeframe,len(universe),settings.yahoo_delay_minutes));db.commit()
    try:
        ok, errors=(collect_yahoo(db,universe,timeframe,range_) if collect else (len(universe),[]))
        ihsg_collection = collect_ihsg_daily(db) if collect and timeframe == "1d" else None
        fills=process_pending_orders(db,timeframe) if not settings.demo_mode and timeframe == "5m" else 0
        closed=manage_positions(db,timeframe) if not settings.demo_mode and timeframe == "5m" else 0
        proposal_count=order_count=features_count=stale_features=0
        arjum_candidates=[]
        screener_result = collect_arjum_screener(db) if timeframe == "1d" or full_universe else None
        arjum_symbols = arjum_screened_symbols(db)
        staged=[]
        for item in universe:
            symbol=item["symbol"].upper(); rows=candle_rows(db,symbol,timeframe)
            features=feature_set(rows)
            if not features: continue
            features_count += 1
            db.execute("INSERT OR REPLACE INTO feature_snapshots VALUES(?,?,?,?,?)",(run_id,symbol,timeframe,iso(),json.dumps(features)))
            staged.append((symbol, features))
        if full_universe and timeframe != "1d":
            # A breadth scan owns today's watchlist state. Clear yesterday's
            # actionable flags, score every fresh symbol, and exclude stale
            # symbols from liquidity/candidate selection without erasing their
            # last known score.
            db.execute("UPDATE instruments SET evaluation_status='INCOMPLETE' WHERE status='ACTIVE'")
            fresh_staged=[]
            for symbol,features in staged:
                if not intraday_feature_is_fresh(features):
                    stale_features += 1
                    continue
                db.execute("UPDATE instruments SET evaluation_score=?,evaluation_status='WATCH' WHERE symbol=?",(technical_score(features),symbol))
                fresh_staged.append((symbol,features))
            staged=fresh_staged
        liquid, candidates = local_liquidity_shortlist(staged, arjum_symbols) if timeframe == "1d" or full_universe else (staged, staged)
        for symbol, features in candidates:
            best=technical_score(features)
            # A stale completed candle may refresh the read-only dashboard score,
            # but it must never create a proposal/order. This replaces placeholder
            # 55 values while keeping execution freshness as a hard gate.
            db.execute("UPDATE instruments SET evaluation_score=?,evaluation_status='WATCH' WHERE symbol=?",(best,symbol))
            if timeframe != "1d" and not intraday_feature_is_fresh(features):
                stale_features += 1
                continue
            instrument = db.execute("SELECT sector FROM instruments WHERE symbol=?", (symbol,)).fetchone()
            fundamental = server.fundamental_snapshot(db, symbol, float(features["close"]), instrument["sector"] if instrument else "")
            evaluated = evaluate_agents(features,
                fundamental.get("quality_score") if fundamental.get("status") == "AVAILABLE" else None,
                timeframe)
            for proposal in evaluated:
                _, created=persist_proposal(db,run_id,symbol,proposal,"DELAYED",timeframe)
                proposal_count += 1; order_count += int(created)
            final="ACTIONABLE" if any(p.status=="ACTIONABLE" and p.action in {"BUY","ACCUMULATE"} for p in evaluated) else "WATCH"
            if final == "ACTIONABLE":
                arjum_candidates.append((symbol, best))
            db.execute("UPDATE instruments SET evaluation_score=?,evaluation_status=? WHERE symbol=?",(best,final,symbol))
        if not settings.demo_mode:
            mark_to_market(db)
        # Enrichment does not block Yahoo-based strategy evaluation or paper fills.
        arjum_results = collect_arjum_candidates(db, arjum_candidates) if timeframe == "1d" else []
        stats={"phase":phase,"features":features_count,"stale_features":stale_features,"liquid_universe":len(liquid),"technical_candidates":len(candidates),"collector_errors":errors,"positions_closed":closed,"ihsg":ihsg_collection,"arjum_screener":screener_result,"arjum":arjum_results}
        status="COMPLETED" if not errors else ("PARTIAL" if ok else "FAILED")
        db.execute("""UPDATE engine_runs SET completed_at=?,status=?,symbols_ok=?,symbols_failed=?,proposals=?,orders_created=?,fills_created=?,stats_json=? WHERE id=?""",(iso(),status,ok,len(errors),proposal_count,order_count,fills,json.dumps(stats),run_id));db.commit()
        if timeframe == "1d" or phase == "POSTCLOSE":
            publish_daily_report(db,run_id,status,len(master_universe))
        return {"run_id":run_id,"status":status,"universe":len(universe),"symbols_ok":ok,"features":features_count,"proposals":proposal_count,"orders":order_count,"fills":fills,"errors":errors}
    except Exception as exc:
        db.execute("UPDATE engine_runs SET completed_at=?,status='FAILED',error=? WHERE id=?",(iso(),str(exc),run_id));db.commit();raise
    finally:
        db.execute("DELETE FROM engine_locks WHERE name='engine' AND run_id=?", (run_id,));db.commit();db.close()


def daemon(interval_seconds: int=60) -> None:
    print("NusaQuant engine daemon started; Yahoo data is DELAYED paper-only.")
    if settings.arjum_enabled and settings.arjum_api_key:
        maintenance_db = server.connect()
        try:
            ensure_runtime(maintenance_db)
            result = collect_arjum_daily_universe(maintenance_db)
            print(json.dumps({"event":"arjum_daily_warmup", **result}, ensure_ascii=False), flush=True)
        except Exception as exc:
            print(json.dumps({"event":"arjum_daily_warmup_failed", "error":str(exc)}, ensure_ascii=False), flush=True)
        finally:
            maintenance_db.close()
    last_bucket=None
    while True:
        moment=now_wib(); phase=market_phase(moment)
        cadence=15 if phase=="PREOPEN" else 5
        bucket=(moment.date().isoformat(),phase) if phase=="POSTCLOSE" else (moment.date().isoformat(),moment.hour,moment.minute//cadence,phase)
        if phase in {"SESSION_1","SESSION_2","POSTCLOSE"} and bucket!=last_bucket:
            timeframe="5m" if phase not in {"POSTCLOSE"} else "1d"
            try: print(json.dumps(run_engine(timeframe,"5d" if timeframe=="5m" else "6mo"),ensure_ascii=False))
            except Exception as exc: print(json.dumps({"status":"FAILED","error":str(exc)}))
            last_bucket=bucket
        time.sleep(max(10,interval_seconds))


def status() -> dict:
    server.init_db(); db=server.connect(); ensure_runtime(db)
    run=db.execute("SELECT * FROM engine_runs ORDER BY rowid DESC LIMIT 1").fetchone()
    result={"market_phase":market_phase(),"universe_size":len(load_universe()),"latest_run":dict(run) if run else None,"pending_orders":db.execute("SELECT COUNT(*) FROM paper_orders WHERE status='PENDING'").fetchone()[0],"open_positions":db.execute("SELECT COUNT(*) FROM positions WHERE status='OPEN'").fetchone()[0],"yahoo_delay_minutes":settings.yahoo_delay_minutes,"paper_only":settings.paper_only}
    db.close();return result


def main() -> None:
    parser=argparse.ArgumentParser(description="NusaQuant delayed-paper engine")
    sub=parser.add_subparsers(dest="command",required=True)
    sub.add_parser("init"); sub.add_parser("status")
    universe_import=sub.add_parser("import-universe");universe_import.add_argument("path",type=Path)
    holidays_import=sub.add_parser("import-holidays");holidays_import.add_argument("path",type=Path)
    run=sub.add_parser("run");run.add_argument("--timeframe",default="5m");run.add_argument("--range",dest="range_",default="5d");run.add_argument("--no-collect",action="store_true");run.add_argument("--force",action="store_true");run.add_argument("--full-universe",action="store_true",help="explicit breadth scan; daemon watchlist cadence remains capped")
    collect=sub.add_parser("collect");collect.add_argument("--timeframe",default="5m");collect.add_argument("--range",dest="range_",default="5d")
    serve=sub.add_parser("daemon");serve.add_argument("--interval",type=int,default=60)
    args=parser.parse_args();server.init_db();db=server.connect();ensure_runtime(db)
    if args.command=="init": sync_universe(db,load_universe());print("Engine initialized")
    elif args.command=="status": print(json.dumps(status(),indent=2,ensure_ascii=False,default=str))
    elif args.command=="import-universe":
        rows=load_universe(args.path)
        if not rows or any("symbol" not in row for row in rows): raise ValueError("universe CSV is invalid")
        shutil.copyfile(args.path,UNIVERSE_PATH);sync_universe(db,rows);print(f"Imported {len(rows)} active IDX instruments")
    elif args.command=="import-holidays":
        payload=json.loads(args.path.read_text(encoding="utf-8"))
        if payload.get("status")!="VALIDATED" or not isinstance(payload.get("holidays"),list): raise ValueError("holiday JSON must be VALIDATED and contain holidays[]")
        shutil.copyfile(args.path,HOLIDAYS_PATH);print(f"Imported {len(payload['holidays'])} IDX holidays")
    elif args.command=="collect":
        universe=load_universe();sync_universe(db,universe);print(json.dumps({"ok":collect_yahoo(db,universe,args.timeframe,args.range_)},ensure_ascii=False))
    elif args.command=="run": print(json.dumps(run_engine(args.timeframe,args.range_,not args.no_collect,args.force,args.full_universe),indent=2,ensure_ascii=False))
    elif args.command=="daemon": db.close();daemon(args.interval);return
    db.close()


if __name__=="__main__": main()
