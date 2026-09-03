"""Create a consistent SQLite backup while the dashboard is running."""
from __future__ import annotations

import sqlite3
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import settings

target_dir = settings.data_dir / "backups"
target_dir.mkdir(parents=True, exist_ok=True)
target = target_dir / f"nusaquant-{datetime.now():%Y%m%d-%H%M%S}.db"
with sqlite3.connect(settings.database_path) as source, sqlite3.connect(target) as destination:
    source.backup(destination)
print(target)
