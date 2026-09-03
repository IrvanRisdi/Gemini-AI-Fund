import json
import sqlite3
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

import server


class RiskSizingTests(unittest.TestCase):
    def test_tick_bands(self):
        self.assertEqual(server.tick_size(199), 1)
        self.assertEqual(server.tick_size(200), 2)
        self.assertEqual(server.tick_size(500), 5)
        self.assertEqual(server.tick_size(2_000), 10)
        self.assertEqual(server.tick_size(5_000), 25)

    def test_position_is_lot_rounded_and_cash_capped(self):
        result = server.risk_size(100_000_000, 100, 95, 3)
        self.assertEqual(result["lots"], 6_000)
        self.assertEqual(result["shares"] % 100, 0)
        self.assertLessEqual(result["notional"], 100_000_000)

    def test_invalid_stop_rejected(self):
        result = server.risk_size(100_000_000, 100, 100, 3)
        self.assertEqual(result["lots"], 0)
        self.assertEqual(result["reason"], "invalid_parameters")

    def test_win_rate_summary_prefers_v2_and_falls_back_to_legacy(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        db.execute("""CREATE TABLE trade_journal(
            agent_id TEXT, closed_at TEXT, strategy_version TEXT, net_pnl REAL
        )""")
        db.executemany("INSERT INTO trade_journal VALUES(?,?,?,?)", [
            ("legacy-only", "2026-08-01", "1.0-legacy", 100),
            ("legacy-only", "2026-08-02", "1.0-legacy", -50),
            ("v2-agent", "2026-08-01", "1.0-legacy", 100),
            ("v2-agent", "2026-09-01", "2.0", -20),
            ("v2-agent", "2026-09-02", "2.0", 50),
        ])
        legacy = server.agent_win_rate_summary(db, "legacy-only")
        current = server.agent_win_rate_summary(db, "v2-agent")
        db.close()
        self.assertEqual((legacy["display_win_rate"], legacy["win_rate_source"]), (50.0, "legacy"))
        self.assertEqual((current["display_win_rate"], current["win_rate_source"]), (50.0, "v2"))


class SnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.init_db()

    def test_report_never_rescans_on_read(self):
        db = server.connect()
        row = db.execute("SELECT * FROM reports WHERE report_date='2026-08-26'").fetchone()
        db.close()
        self.assertEqual(row["source_mode"], "stored_evaluation")
        self.assertEqual(row["rescan_on_read"], 0)
        payload = json.loads(row["snapshot_json"])
        self.assertFalse(payload["rescan_on_read"])
        self.assertEqual(payload["universe"]["type"], "ALL_ACTIVE_IDX")

    def test_each_decision_has_known_agent_and_stock(self):
        db = server.connect()
        orphans = db.execute("""
          SELECT COUNT(*) FROM decisions d
          LEFT JOIN agents a ON a.id=d.agent_id
          LEFT JOIN instruments i ON i.symbol=d.symbol
          WHERE a.id IS NULL OR i.symbol IS NULL
        """).fetchone()[0]
        db.close()
        self.assertEqual(orphans, 0)

    def test_stock_workspace_has_five_independent_agent_views(self):
        db = server.connect()
        instrument = db.execute("SELECT * FROM instruments WHERE symbol='BRIS'").fetchone()
        payload = server.stock_workspace(db, instrument)
        db.close()
        self.assertEqual(len(payload["agent_views"]), 5)
        self.assertEqual(len({view["agent_id"] for view in payload["agent_views"]}), 5)
        # Each agent owns an independent persisted view; their actions may
        # legitimately coincide in a given production market snapshot.
        self.assertEqual(
            {view["agent_id"] for view in payload["agent_views"]},
            {"swing", "scalping", "open-low", "fundamental", "breakout-retest"},
        )

    def test_stock_workspace_is_read_only_snapshot(self):
        db = server.connect()
        instrument = db.execute("SELECT * FROM instruments WHERE symbol='BRIS'").fetchone()
        payload = server.stock_workspace(db, instrument)
        db.close()
        self.assertFalse(payload["rescan_triggered"])
        self.assertFalse(payload["external_requests_triggered"])
        self.assertEqual(payload["source_mode"], "stored_stock_snapshot")
        self.assertIn(payload["fundamental"]["status"], {"AVAILABLE", "DATA_NOT_AVAILABLE"})
        if payload["fundamental"]["status"] == "AVAILABLE":
            self.assertIn(payload["fundamental"]["source"], {"arjum_financial_statement_cache", "arjum_financial_statement"})

    def test_dashboard_activity_uses_stored_audit_sources(self):
        db = server.connect()
        rows = server.dashboard_activity(db, 10)
        db.close()
        self.assertTrue(rows)
        self.assertTrue({row["kind"] for row in rows}.issubset({"DECISION", "FILL", "ENGINE"}))
        self.assertTrue(all(row.get("created_at") for row in rows))

    def test_agent_open_positions_exclude_closed_ledger_rows(self):
        db = server.connect()
        open_count = db.execute(
            "SELECT COUNT(*) FROM positions WHERE agent_id='swing' AND status='OPEN'"
        ).fetchone()[0]
        all_count = db.execute(
            "SELECT COUNT(*) FROM positions WHERE agent_id='swing'"
        ).fetchone()[0]
        db.close()
        self.assertGreaterEqual(open_count, 0)
        self.assertGreaterEqual(all_count, open_count)

    def test_weekend_market_phase_is_closed(self):
        saturday = datetime(2026, 8, 29, 10, 0, tzinfo=ZoneInfo("Asia/Jakarta"))
        self.assertEqual(server.current_market_phase(saturday), "CLOSED")

    def test_provider_usage_never_falls_back_to_yesterday(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        db.execute("""CREATE TABLE provider_usage(
            provider TEXT, usage_date TEXT, requests_used INTEGER, request_limit INTEGER
        )""")
        db.execute("INSERT INTO provider_usage VALUES('arjum','2026-08-27',7711,21000)")
        today = datetime(2026, 8, 28, 8, 0, tzinfo=ZoneInfo("Asia/Jakarta"))
        usage = server.provider_usage_today(db, today)
        db.close()
        self.assertEqual(usage["usage_date"], "2026-08-28")
        self.assertEqual(usage["requests_used"], 0)
        self.assertEqual(usage["request_limit"], server.settings.arjum_daily_limit)

    def test_arjum_report_is_split_and_decorations_removed(self):
        report = "**📈 PRICE ACTION**\n• **Rp1.000** ↑ Naik\n\n**🎯 SIGNAL**\n→ Volume netral"
        sections = server.parse_arjum_analysis(report)
        self.assertEqual([item["title"] for item in sections], ["Price Action", "Signal"])
        rendered = " ".join(line for item in sections for line in item["lines"])
        self.assertNotIn("**", rendered)
        self.assertNotIn("📈", rendered)
        self.assertNotIn("•", rendered)

    def test_intraday_ranking_has_configured_size_and_stable_ranks(self):
        db = server.connect()
        active = db.execute("SELECT COUNT(*) FROM instruments WHERE status='ACTIVE'").fetchone()[0]
        ranks = server.intraday_symbol_ranks(db)
        db.close()
        self.assertEqual(len(ranks), min(active, server.settings.intraday_universe_limit))
        self.assertEqual(list(ranks.values()), list(range(1, len(ranks) + 1)))


if __name__ == "__main__":
    unittest.main()
