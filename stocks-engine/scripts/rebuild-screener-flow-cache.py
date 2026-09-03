"""One-time local cache rebuild; it never calls Yahoo or Arjum."""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import settings
from engine import refresh_screener_flow_cache
from engine_schema import init_engine_schema


def main() -> None:
    db = sqlite3.connect(settings.database_path)
    db.row_factory = sqlite3.Row
    init_engine_schema(db)
    rows = db.execute("SELECT symbol,fetched_at,payload_json FROM arjum_snapshots").fetchall()
    for row in rows:
        try:
            payload = json.loads(row["payload_json"])
        except (TypeError, json.JSONDecodeError):
            payload = {}
        refresh_screener_flow_cache(db, row["symbol"], payload, row["fetched_at"])
    db.commit()
    db.close()
    print(f"rebuilt {len(rows)} screener flow summaries")


if __name__ == "__main__":
    main()
