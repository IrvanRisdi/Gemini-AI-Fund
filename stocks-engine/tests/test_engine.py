import sqlite3
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from datetime import datetime, timedelta
from pathlib import Path

import engine
import jobs
import providers
from engine_schema import init_engine_schema


def yahoo_fixture(count=60):
    start = datetime(2026, 8, 24, 9, 0, tzinfo=engine.JAKARTA)
    timestamps, opens, highs, lows, closes, volumes = [], [], [], [], [], []
    for index in range(count):
        close = 1000 + index * 2 + (25 if index == count - 1 else 0)
        timestamps.append(int((start + timedelta(minutes=5 * index)).timestamp()))
        opens.append(close - 3); highs.append(close + 4); lows.append(close - 6)
        closes.append(close); volumes.append(1_000_000 if index < count - 1 else 2_500_000)
    return {"chart": {"result": [{"timestamp": timestamps, "indicators": {"quote": [{
        "open": opens, "high": highs, "low": lows, "close": closes, "volume": volumes
    }]}}], "error": None}}


class EngineFeatureTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.execute("CREATE TABLE instruments(symbol TEXT PRIMARY KEY,last_price REAL,change_pct REAL,market_data_as_of TEXT)")
        self.db.execute("CREATE TABLE provider_usage(provider TEXT NOT NULL, usage_date TEXT NOT NULL, requests_used INTEGER NOT NULL, request_limit INTEGER, PRIMARY KEY(provider,usage_date))")
        self.db.execute("INSERT INTO instruments(symbol) VALUES('TEST')")
        init_engine_schema(self.db)

    def tearDown(self): self.db.close()

    def test_yahoo_payload_is_normalized_as_delayed(self):
        count = engine.ingest_yahoo(self.db, "TEST", "5m", yahoo_fixture())
        self.assertEqual(count, 60)
        row = self.db.execute("SELECT * FROM market_candles ORDER BY candle_at DESC LIMIT 1").fetchone()
        self.assertEqual(row["source"], "yahoo")
        self.assertEqual(row["data_status"], "DELAYED")

    def test_yahoo_index_symbol_is_not_given_jk_suffix(self):
        with patch.object(providers, "get_json", return_value={}) as request:
            providers.YahooClient().chart("^JKSE", "1d", "1y")
        self.assertIn("%5EJKSE?", request.call_args.args[0])
        self.assertNotIn("JKSE.JK", request.call_args.args[0])

    def test_feature_engine_routes_only_intraday_agents_to_five_minute(self):
        engine.ingest_yahoo(self.db, "TEST", "5m", yahoo_fixture())
        rows = engine.candle_rows(self.db, "TEST", "5m")
        features = engine.feature_set(rows)
        self.assertIsNotNone(features["ema20"])
        self.assertIsNotNone(features["rsi14"])
        self.assertTrue(features["breakout"])
        proposals = engine.evaluate_agents(features, False, "5m")
        self.assertEqual({p.agent_id for p in proposals}, {"scalping", "open-low"})

    def test_agent_evaluator_uses_price_fallback_when_atr_is_missing(self):
        features = engine.feature_set(engine.yahoo_rows(yahoo_fixture()))
        features["atr14"] = None
        proposals = engine.evaluate_agents(features, False, "5m")
        self.assertEqual(len(proposals), 2)
        self.assertEqual({p.agent_id for p in proposals}, {"scalping", "open-low"})

    def test_fundamental_accumulate_creates_first_tranche_plan(self):
        features = engine.feature_set(engine.yahoo_rows(yahoo_fixture()))
        features["ema20"] = features["close"] * .98
        features["rsi14"] = 60
        proposal = next(p for p in engine.evaluate_agents(features, 75, "1d") if p.agent_id == "fundamental")
        self.assertEqual((proposal.action, proposal.status), ("ACCUMULATE", "ACTIONABLE"))
        self.assertEqual(proposal.risk_pct, 1)
        self.assertIsNotNone(proposal.entry)
        self.assertLess(proposal.stop, proposal.entry)
        self.assertGreater(proposal.target, proposal.entry)
        self.assertIn("1/3", proposal.rationale)

    def test_expired_pending_orders_release_capacity(self):
        self.db.execute("""INSERT INTO paper_orders
          (id,proposal_id,agent_id,symbol,side,order_type,lots,limit_price,stop_price,target_price,
           status,created_at,expires_at,source_candle_at,timeframe,strategy_version) VALUES(
          'order-old','proposal-old','swing','TEST','BUY','LIMIT',1,100,95,110,
          'PENDING','2026-08-27T09:00:00+07:00','2026-08-27T09:30:00+07:00',
          '2026-08-27T09:00:00+07:00','5m','2.0')
        """)
        expired = engine.expire_pending_orders(self.db, datetime(2026, 8, 28, 9, 0, tzinfo=engine.JAKARTA))
        self.assertEqual(expired, 1)
        self.assertEqual(self.db.execute("SELECT status FROM paper_orders WHERE id='order-old'").fetchone()[0], "EXPIRED")

    def test_feature_engine_ignores_trailing_zero_volume_bar(self):
        rows = engine.yahoo_rows(yahoo_fixture())
        expected_candle = rows[-2]["candle_at"]
        rows[-1]["volume"] = 0
        features = engine.feature_set(rows)
        self.assertEqual(features["candle_at"], expected_candle)
        self.assertTrue(features["used_completed_candle"])
        self.assertGreater(features["volume"], 0)

    def test_open_low_uses_whole_session_not_latest_bar(self):
        rows = engine.yahoo_rows(yahoo_fixture())
        rows[0]["open"] = rows[0]["low"]
        rows[-1]["open"] = rows[-1]["low"] + 100
        features = engine.feature_set(rows)
        self.assertTrue(features["open_is_low"])
        self.assertEqual(features["session_open"], rows[0]["open"])

    def test_open_low_actionable_uses_session_open_stop_on_five_minute(self):
        features = engine.feature_set(engine.yahoo_rows(yahoo_fixture()))
        features.update({"open_is_low": True, "session_open": features["close"]-10,
                         "session_trading_minutes": 30, "vwap20": features["close"]-1,
                         "relative_volume": 2, "change_pct": .5})
        proposal = next(p for p in engine.evaluate_agents(features, None, "5m") if p.agent_id == "open-low")
        self.assertEqual((proposal.action, proposal.status), ("BUY", "ACTIONABLE"))
        self.assertEqual(proposal.stop, features["session_open"]-engine.server.tick_size(features["session_open"]))

    def test_daily_evaluator_does_not_emit_scalping_or_open_low(self):
        features = engine.feature_set(engine.yahoo_rows(yahoo_fixture()))
        proposals = engine.evaluate_agents(features, None, "1d")
        self.assertEqual({p.agent_id for p in proposals}, {"swing", "fundamental", "breakout-retest"})

    def test_fee_adjusted_target_clears_minimum_net_reward(self):
        entry, stop = 358, 354
        target = engine.minimum_target_for_net_rr(entry, stop)
        self.assertGreaterEqual(engine.net_risk_reward(entry, stop, target), engine.MIN_NET_RISK_REWARD)

    def test_technical_score_is_not_wait_confidence(self):
        weak = dict(engine.feature_set(engine.yahoo_rows(yahoo_fixture())), breakout=False, relative_volume=.2, change_pct=-1)
        strong = dict(weak, close=weak["prior_high20"] + 50, breakout=True, relative_volume=2, change_pct=2)
        self.assertGreater(engine.technical_score(strong), engine.technical_score(weak))

    def test_intraday_freshness_rejects_stale_completed_candle(self):
        moment = datetime(2026, 8, 24, 10, 0, tzinfo=engine.JAKARTA)
        fresh = {"candle_at": (moment - timedelta(minutes=15)).isoformat()}
        stale = {"candle_at": (moment - timedelta(minutes=31)).isoformat()}
        self.assertTrue(engine.intraday_feature_is_fresh(fresh, moment))
        self.assertFalse(engine.intraday_feature_is_fresh(stale, moment))

    def test_intraday_freshness_excludes_lunch_break(self):
        monday_lunch = datetime(2026, 8, 24, 13, 30, tzinfo=engine.JAKARTA)
        before_break = {"candle_at": datetime(2026, 8, 24, 11, 40, tzinfo=engine.JAKARTA).isoformat()}
        self.assertTrue(engine.intraday_feature_is_fresh(before_break, monday_lunch))
        self.assertEqual(engine.idx_trading_minutes_between(datetime.fromisoformat(before_break["candle_at"]), monday_lunch), 20)
        self.assertFalse(engine.intraday_feature_is_fresh(before_break, monday_lunch + timedelta(minutes=11)))

    def test_friday_lunch_and_overnight_are_not_analysis_time(self):
        friday_resume = datetime(2026, 8, 28, 14, 0, tzinfo=engine.JAKARTA)
        before_break = {"candle_at": datetime(2026, 8, 28, 11, 20, tzinfo=engine.JAKARTA).isoformat()}
        self.assertTrue(engine.intraday_feature_is_fresh(before_break, friday_resume))
        next_monday = datetime(2026, 8, 31, 9, 0, tzinfo=engine.JAKARTA)
        self.assertFalse(engine.intraday_feature_is_fresh(before_break, next_monday))

    def test_intraday_candle_outside_idx_session_is_excluded(self):
        self.assertFalse(engine.is_idx_trading_timestamp("2026-08-24T12:30:00+07:00"))
        self.assertTrue(engine.is_idx_trading_timestamp("2026-08-24T11:55:00+07:00"))
        closing = datetime(2026, 8, 24, 16, 5, tzinfo=engine.JAKARTA)
        last_regular = datetime(2026, 8, 24, 15, 45, tzinfo=engine.JAKARTA)
        self.assertFalse(engine.is_idx_trading_timestamp(closing))
        self.assertEqual(engine.idx_trading_minutes_between(last_regular, closing), 5)

    def test_market_session_gate(self):
        monday = datetime(2026, 8, 24, 9, 30, tzinfo=engine.JAKARTA)
        lunch = datetime(2026, 8, 24, 12, 30, tzinfo=engine.JAKARTA)
        saturday = datetime(2026, 8, 29, 10, 0, tzinfo=engine.JAKARTA)
        self.assertEqual(engine.market_phase(monday), "SESSION_1")
        self.assertEqual(engine.market_phase(lunch), "CLOSED")
        self.assertEqual(engine.market_phase(saturday), "CLOSED")

    def test_engine_lock_prevents_overlapping_run(self):
        self.assertTrue(engine.acquire_run_lock(self.db, "run-one"))
        self.assertFalse(engine.acquire_run_lock(self.db, "run-two"))

    def test_validated_calendar_blocks_idx_holiday(self):
        holiday = datetime(2026, 8, 25, 10, 0, tzinfo=engine.JAKARTA)
        self.assertEqual(engine.market_phase(holiday), "CLOSED")

    def test_idx_universe_normalizer_filters_non_equity_records(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "idx.csv"
            path.write_text(
                "Kode Saham,Nama Perusahaan,Sektor,Jenis Instrumen,Status\n"
                "ABCD,Alpha Tbk,Financials,Saham,Active\n"
                "XETF,ETF Test,Financials,ETF,Active\n"
                "AB,Invalid Code,Financials,Saham,Active\n"
                "WXYZ,Delisted Tbk,Financials,Saham,Delisted\n",
                encoding="utf-8",
            )
            rows, excluded = jobs.normalize_idx_universe(path)
        self.assertEqual([row["symbol"] for row in rows], ["ABCD"])
        self.assertEqual({row["reason"] for row in excluded}, {"non_common_stock", "invalid_or_non_equity_ticker", "inactive_or_delisted"})

    def test_financial_statement_normalizer_preserves_missing_metrics(self):
        payload = {"stock_code":"TEST","report_type":"INCOME_STATEMENT","period":"quarterly","items":[{"year":"2026","quarter":"1","fetched_at":"2026-08-01","data":{"laba_operasional":120,"laba_rugi":100,"laba_rugi_per_saham":{"laba_per_saham_dasar_diatribusikan_kepada_pemilik_entitas_induk":{"total":10}}}}]}
        rows = jobs.normalize_financial_statement(payload)
        self.assertEqual(rows[0]["period_end"], "2026-Q1")
        self.assertEqual(rows[0]["metrics"]["net_income"], 100)
        self.assertEqual(rows[0]["metrics"]["eps"], 10)
        self.assertIsNone(rows[0]["metrics"]["revenue"])

    def test_financial_normalizer_reads_balance_and_cash_flow_totals(self):
        balance = {"stock_code":"TEST","report_type":"BALANCE_SHEET","period":"quarterly","items":[{"year":"2026","quarter":"1","data":{"aset":{"aset":1000},"liabilitas_dan_ekuitas":{"liabilitas":{"liabilitas":400},"ekuitas":{"ekuitas":600}}}}]}
        cash = {"stock_code":"TEST","report_type":"CASH_FLOW_REPORT","period":"quarterly","items":[{"year":"2026","quarter":"1","data":{"arus_kas_dari_aktivitas_operasi":{"arus_kas_bersih_yang_diperoleh_dari_digunakan_untuk_aktivitas_operasi":125}}}]}
        bmetrics = jobs.normalize_financial_statement(balance)[0]["metrics"]
        cmetrics = jobs.normalize_financial_statement(cash)[0]["metrics"]
        self.assertEqual((bmetrics["total_assets"], bmetrics["total_liabilities"], bmetrics["total_equity"]), (1000, 400, 600))
        self.assertEqual(cmetrics["operating_cash_flow"], 125)

    def test_arjum_snapshot_is_cached_and_quota_accounted(self):
        class FakeArjum:
            def __init__(self, _key): pass
            def __getattr__(self, name): return lambda _symbol: {"resource": name}
        fake_settings = SimpleNamespace(arjum_enabled=True, arjum_api_key="test-key", arjum_daily_limit=1000, arjum_cache_hours=24)
        with patch.object(engine, "settings", fake_settings), patch.object(engine, "ArjumClient", FakeArjum):
            first = engine.collect_arjum_snapshot(self.db, "TEST")
            second = engine.collect_arjum_snapshot(self.db, "TEST")
        self.assertEqual(first["status"], "CACHED")
        self.assertEqual(first["requests"], 5)
        self.assertEqual(second["requests"], 0)
        self.assertEqual(self.db.execute("SELECT requests_used FROM provider_usage").fetchone()[0], 5)

    def test_arjum_screener_is_cached(self):
        class FakeArjum:
            def __init__(self, _key): pass
            def screener(self): return {"rows": [{"stock_code": "TEST"}]}
        fake_settings = SimpleNamespace(arjum_enabled=True, arjum_api_key="test-key", arjum_daily_limit=1000, arjum_cache_hours=24)
        with patch.object(engine, "settings", fake_settings), patch.object(engine, "ArjumClient", FakeArjum):
            first = engine.collect_arjum_screener(self.db)
            second = engine.collect_arjum_screener(self.db)
        self.assertEqual(first["rows"], 1)
        self.assertEqual(second["requests"], 0)
        self.assertEqual(engine.arjum_screened_symbols(self.db), {"TEST"})

    def test_local_liquidity_pipeline_prioritizes_screener_then_limits_candidates(self):
        features = engine.feature_set(engine.yahoo_rows(yahoo_fixture()))
        features["average_daily_value"] = 500_000_000
        features["atr_pct"] = 3
        features["relative_volume"] = 2
        features["ema20"] = 1000; features["ema50"] = 900; features["close"] = 1100
        fake_settings = SimpleNamespace(liquidity_min_adv=250_000_000, liquid_universe_limit=100, technical_candidate_limit=50)
        with patch.object(engine, "settings", fake_settings):
            liquid, candidates = engine.local_liquidity_shortlist([("ABCD", features)], {"ABCD"})
        self.assertEqual([symbol for symbol, _ in liquid], ["ABCD"])
        self.assertEqual([symbol for symbol, _ in candidates], ["ABCD"])


class PaperExecutionV2Tests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
          CREATE TABLE agents(id TEXT PRIMARY KEY,starting_equity REAL,equity REAL,win_rate REAL,open_risk_pct REAL);
          CREATE TABLE positions(
            id INTEGER PRIMARY KEY AUTOINCREMENT,agent_id TEXT,symbol TEXT,lots INTEGER,
            entry_price REAL,last_price REAL,stop_price REAL,target_price REAL,status TEXT,
            fill_id TEXT,opened_at TEXT,entry_candle_at TEXT,last_managed_candle_at TEXT,
            buy_fees REAL DEFAULT 0,initial_risk REAL,strategy_version TEXT DEFAULT '2.0');
          CREATE TABLE trade_journal(
            id INTEGER PRIMARY KEY AUTOINCREMENT,agent_id TEXT,symbol TEXT,opened_at TEXT,
            closed_at TEXT,side TEXT DEFAULT 'LONG',lots INTEGER,entry_price REAL,exit_price REAL,
            gross_pnl REAL,fees REAL DEFAULT 0,net_pnl REAL,r_multiple REAL,setup TEXT,
            exit_reason TEXT,notes TEXT,buy_fees REAL DEFAULT 0,sell_fees REAL DEFAULT 0,
            initial_risk REAL,strategy_version TEXT DEFAULT '2.0');
          CREATE TABLE equity_history(agent_id TEXT,equity_date TEXT,equity REAL,cash REAL,drawdown_pct REAL,PRIMARY KEY(agent_id,equity_date));
        """)
        init_engine_schema(self.db)
        self.db.execute("INSERT INTO agents VALUES('scalping',100000000,100000000,0,0)")
        self.db.execute("INSERT INTO agent_ledgers(agent_id,cash,updated_at) VALUES('scalping',100000000,'2026-08-24T09:00:00+07:00')")
        self.db.execute("""INSERT INTO paper_orders
          (id,proposal_id,agent_id,symbol,side,order_type,lots,limit_price,stop_price,target_price,
           status,created_at,expires_at,source_candle_at,timeframe,strategy_version)
          VALUES('o1','p1','scalping','TEST','BUY','LIMIT',10,100,95,112,'PENDING',
          '2026-08-24T09:10:00+07:00','2026-08-24T10:00:00+07:00',
          '2026-08-24T09:00:00+07:00','5m','2.0')""")

    def tearDown(self): self.db.close()

    def candle(self, at, low=99, high=101, close=100):
        self.db.execute("""INSERT INTO market_candles
          (symbol,timeframe,candle_at,open,high,low,close,volume,source,data_status,collected_at)
          VALUES('TEST','5m',?,?,?,?,?,1000000,'yahoo','DELAYED','2026-08-24T10:30:00+07:00')""",
          (at, close, high, low, close))

    def test_fill_never_uses_candle_before_decision_time(self):
        self.candle('2026-08-24T09:05:00+07:00')
        self.candle('2026-08-24T09:15:00+07:00')
        with patch.object(engine, "expire_pending_orders", return_value=0):
            self.assertEqual(engine.process_pending_orders(self.db, '5m'), 1)
        fill = self.db.execute("SELECT * FROM paper_fills").fetchone()
        position = self.db.execute("SELECT * FROM positions").fetchone()
        self.assertEqual(fill['filled_at'], '2026-08-24T09:15:00+07:00')
        self.assertEqual(position['opened_at'], fill['filled_at'])

    def test_exit_ignores_fill_candle_and_journal_includes_both_fees(self):
        self.candle('2026-08-24T09:15:00+07:00', low=94, high=113)
        with patch.object(engine, "expire_pending_orders", return_value=0):
            engine.process_pending_orders(self.db, '5m')
        self.assertEqual(engine.manage_positions(self.db, '5m'), 0)
        self.candle('2026-08-24T09:20:00+07:00', low=94, high=113)
        self.assertEqual(engine.manage_positions(self.db, '5m'), 1)
        trade = self.db.execute("SELECT * FROM trade_journal").fetchone()
        self.assertEqual(trade['opened_at'], '2026-08-24T09:15:00+07:00')
        self.assertEqual(trade['closed_at'], '2026-08-24T09:20:00+07:00')
        self.assertEqual(trade['exit_reason'], 'AMBIGUOUS_STOP')
        self.assertAlmostEqual(trade['fees'], trade['buy_fees'] + trade['sell_fees'])
        self.assertIsNotNone(trade['r_multiple'])


if __name__ == "__main__": unittest.main()
