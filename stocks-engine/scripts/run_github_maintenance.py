"""End-of-day breadth, Arjum enrichment, fundamentals and report cycle."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import engine
import jobs
from config import settings
from github_state import finalize, prepare


def main() -> None:
    restored = prepare()
    daily = engine.run_engine(
        timeframe="1d",
        range_="6mo",
        collect=True,
        force=True,
        full_universe=True,
    )
    arjum_universe = None
    fundamentals = None
    if daily.get("status") in {"COMPLETED", "PARTIAL"} and settings.arjum_api_key:
        db = engine.server.connect()
        try:
            engine.ensure_runtime(db)
            arjum_universe = engine.collect_arjum_daily_universe(db)
        finally:
            db.close()
        # The collector opens the same ephemeral SQLite database and its result
        # is flattened by finalize(), so bulky raw statements never enter Git.
        jobs.collect_arjum_fundamentals(limit=None, refresh=False)
        fundamentals = "completed"
    elif not settings.arjum_api_key:
        arjum_universe = {"status": "SKIPPED_NOT_CONFIGURED"}
        fundamentals = "SKIPPED_NOT_CONFIGURED"
    published = finalize()
    print(json.dumps({
        "restore": restored,
        "daily": daily,
        "arjum_universe": arjum_universe,
        "fundamentals": fundamentals,
        "publish": published,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
