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


if __name__ == "__main__":
    unittest.main()
