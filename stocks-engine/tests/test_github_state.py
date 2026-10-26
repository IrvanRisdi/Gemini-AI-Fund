import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import github_state


class ChartPublisherTests(unittest.TestCase):
    def test_restored_daily_chart_corrects_legacy_screener_change(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        db.execute("""CREATE TABLE instruments(symbol TEXT PRIMARY KEY,status TEXT,last_price REAL,
          market_data_as_of TEXT,change_pct REAL,daily_close_price REAL,daily_close_date TEXT)""")
        db.execute("INSERT INTO instruments VALUES('BKSW','ACTIVE',55,'2026-09-04T09:05:00+07:00',1,NULL,NULL)")
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            from datetime import datetime
            from zoneinfo import ZoneInfo
            jakarta = ZoneInfo("Asia/Jakarta")
            timestamp = lambda day: int(datetime(2026, 9, day, 9, tzinfo=jakarta).timestamp() * 1000)
            (target / "BKSW.json").write_text(json.dumps({
                "schema_version": 1, "symbol": "BKSW", "timeframes": {
                    "1d": {"candles": [[timestamp(2), 50, 52, 49, 50, 1000],
                                       [timestamp(3), 54, 55, 53, 54, 2000]]}
                }
            }), encoding="utf-8")
            self.assertEqual(github_state.restore_daily_close_references(db, target), 1)
        result = db.execute("SELECT change_pct,daily_close_price,daily_close_date FROM instruments").fetchone()
        db.close()
        self.assertAlmostEqual(result["change_pct"], (55 - 54) / 54 * 100)
        self.assertEqual((result["daily_close_price"], result["daily_close_date"]), (54, "2026-09-03"))

    def test_chart_publisher_keeps_daily_when_intraday_is_refreshed(self):
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        db.executescript("""
          CREATE TABLE instruments(symbol TEXT PRIMARY KEY,status TEXT);
          CREATE TABLE market_candles(
            symbol TEXT,timeframe TEXT,candle_at TEXT,open REAL,high REAL,
            low REAL,close REAL,volume REAL,source TEXT,data_status TEXT
          );
        """)
        db.execute("INSERT INTO instruments VALUES('BKSW','ACTIVE')")
        db.executemany("INSERT INTO market_candles VALUES(?,?,?,?,?,?,?,?,?,?)", [
            ('BKSW','5m','2026-09-04T09:00:00+07:00',54,55,53,54,1000,'yahoo','DELAYED'),
            ('BKSW','5m','2026-09-04T09:05:00+07:00',54,56,54,55,2000,'yahoo','DELAYED'),
        ])
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            (target / "BKSW.json").write_text(json.dumps({
                "schema_version": 1, "symbol": "BKSW", "timeframes": {
                    "1d": {"as_of": "2026-09-03", "candles": [[1, 50, 55, 49, 54, 3000]]}
                }
            }), encoding="utf-8")
            result = github_state.publish_charts(db, target)
            payload = json.loads((target / "BKSW.json").read_text(encoding="utf-8"))
        db.close()

        self.assertEqual(result["symbols"], 1)
        self.assertIn("1d", payload["timeframes"])
        self.assertEqual(len(payload["timeframes"]["5m"]["candles"]), 2)
        self.assertEqual(payload["timeframes"]["5m"]["candles"][-1][4], 55)
        self.assertGreater(payload["timeframes"]["5m"]["candles"][-1][0], 1_000_000_000_000)


class ImportStateLegacyEquityTests(unittest.TestCase):
    def test_legacy_as_of_rows_map_to_equity_date(self):
        # Regression: a hand-written reset (Oct 2026) stored equity_history rows
        # with `id`/`as_of` instead of `equity_date`, which crashed every IDX
        # cycle with "NOT NULL constraint failed: equity_history.equity_date".
        db = sqlite3.connect(":memory:")
        db.execute("""CREATE TABLE equity_history (
            agent_id TEXT NOT NULL, equity_date TEXT NOT NULL, equity REAL NOT NULL,
            cash REAL NOT NULL, drawdown_pct REAL NOT NULL DEFAULT 0,
            PRIMARY KEY(agent_id, equity_date))""")
        payload = {"schema_version": 1, "tables": {"equity_history": [
            {"id": 1, "agent_id": "swing", "as_of": "2026-10-25T00:00:00.000Z",
             "equity": 100000000, "cash": 100000000, "drawdown_pct": 0},
        ]}}
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "runtime-state.json"
            source.write_text(json.dumps(payload), encoding="utf-8")
            original = github_state.TABLE_QUERIES
            github_state.TABLE_QUERIES = [("equity_history", "")]
            try:
                result = github_state.import_state(db, source)
            finally:
                github_state.TABLE_QUERIES = original
        row = db.execute("SELECT agent_id, equity_date, equity FROM equity_history").fetchone()
        db.close()
        self.assertEqual(result["status"], "RESTORED")
        self.assertEqual(row, ("swing", "2026-10-25", 100000000))


if __name__ == "__main__":
    unittest.main()
