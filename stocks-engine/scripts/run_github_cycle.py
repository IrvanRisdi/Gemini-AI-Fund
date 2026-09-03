"""One idempotent market cycle for a short-lived GitHub Actions runner."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import engine
from github_state import finalize, prepare


def main() -> None:
    restored = prepare()
    result = engine.run_engine(timeframe="5m", range_="5d", collect=True, force=False)
    # On an exchange holiday or outside a continuous session, leave the Git
    # state byte-for-byte unchanged so the workflow does not create empty
    # timestamp-only commits.
    published = None if result.get("status") == "SKIPPED" and result.get("reason") == "market_closed" else finalize()
    print(json.dumps({"restore": restored, "engine": result, "publish": published}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
