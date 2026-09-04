"""Environment-only configuration. Secrets never enter browser bundles."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def load_local_env() -> None:
    """Load .env for direct Python runs; Docker injects it itself."""
    env_file = Path(__file__).with_name(".env")
    if not env_file.exists():
        return
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


load_local_env()


def flag(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


def configured_data_dir() -> Path:
    """Keep Docker's /data volume, while direct Windows runs use repo data/."""
    raw = os.getenv("NQ_DATA_DIR")
    if raw == "/data" and os.name == "nt":
        return Path(__file__).parent / "data"
    return Path(raw) if raw else Path(__file__).parent / "data"


@dataclass(frozen=True)
class Settings:
    environment: str = os.getenv("NQ_ENV", "development")
    host: str = os.getenv("NQ_HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", os.getenv("NQ_PORT", "4173")))
    data_dir: Path = configured_data_dir()
    demo_mode: bool = flag("NQ_DEMO_MODE", True)
    paper_only: bool = flag("NQ_PAPER_ONLY", True)
    yahoo_enabled: bool = flag("NQ_YAHOO_ENABLED", True)
    yahoo_delay_minutes: int = int(os.getenv("NQ_YAHOO_DELAY_MINUTES", "10"))
    allow_delayed_paper: bool = flag("NQ_ALLOW_DELAYED_PAPER", True)
    min_universe_size: int = int(os.getenv("NQ_MIN_UNIVERSE_SIZE", "700"))
    intraday_universe_limit: int = int(os.getenv("NQ_INTRADAY_UNIVERSE_LIMIT", "50"))
    intraday_stale_minutes: int = int(os.getenv("NQ_INTRADAY_STALE_MINUTES", "30"))
    access_user: str = os.getenv("NQ_ACCESS_USER", "")
    access_password: str = os.getenv("NQ_ACCESS_PASSWORD", "")
    data_license_acknowledged: bool = flag("NQ_DATA_LICENSE_ACKNOWLEDGED", False)
    arjum_api_key: str | None = os.getenv("ARJUM_API_KEY")
    arjum_daily_limit: int = int(os.getenv("ARJUM_DAILY_LIMIT", "1000"))
    arjum_enabled: bool = flag("NQ_ARJUM_ENABLED", True)
    arjum_candidate_limit: int = int(os.getenv("NQ_ARJUM_CANDIDATE_LIMIT", "20"))
    arjum_cache_hours: int = int(os.getenv("NQ_ARJUM_CACHE_HOURS", "24"))
    fundamental_cache_days: int = int(os.getenv("NQ_FUNDAMENTAL_CACHE_DAYS", "7"))
    liquidity_min_adv: int = int(os.getenv("NQ_LIQUIDITY_MIN_ADV", "250000000"))
    liquid_universe_limit: int = int(os.getenv("NQ_LIQUID_UNIVERSE_LIMIT", "100"))
    technical_candidate_limit: int = int(os.getenv("NQ_TECHNICAL_CANDIDATE_LIMIT", "50"))
    stale_after_hours: int = int(os.getenv("NQ_STALE_AFTER_HOURS", "30"))

    @property
    def database_path(self) -> Path:
        return self.data_dir / "nusaquant.db"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
