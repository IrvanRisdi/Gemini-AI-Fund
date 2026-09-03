"""Market-data provider adapters. Calls happen only from explicit jobs."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


class ProviderError(RuntimeError):
    pass


def get_json(url: str, headers: dict[str, str] | None = None, timeout: int = 20) -> Any:
    request = urllib.request.Request(url, headers=headers or {"User-Agent": "NusaQuant/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        raise ProviderError(str(exc)) from exc


@dataclass
class ArjumClient:
    api_key: str
    base_url: str = "https://stock.arjum.com"

    def _get(self, path: str, params: dict | None = None):
        query = f"?{urllib.parse.urlencode(params)}" if params else ""
        return get_json(f"{self.base_url}{path}{query}", {
            "X-API-Key": self.api_key,
            "Accept": "application/json",
            "User-Agent": "NusaQuant/1.0 (personal-paper-trading collector)",
        })

    def analysis(self, symbol: str): return self._get(f"/api/analysis/{symbol.upper()}")
    def history(self, symbol: str): return self._get(f"/api/history/{symbol.upper()}")
    def broker_summary(self, symbol: str): return self._get(f"/api/broker-summary/{symbol.upper()}")
    def broker_accumulation(self, symbol: str): return self._get(f"/api/broker-accumulation/{symbol.upper()}")
    def seasonal(self, symbol: str): return self._get(f"/api/seasonal/{symbol.upper()}")
    def financial_statement(self, symbol: str, report_type: str, period: str = "quarterly", limit: int = 12):
        """Read the documented Arjum financial-statements endpoint."""
        return self._get(f"/api/financial-statements/{symbol.upper()}", {
            "report_type": report_type.upper(), "period": period, "limit": max(1, min(int(limit), 40)),
        })
    def screener(self): return self._get("/api/screener/latest")
    def health(self): return self._get("/api/health")


@dataclass
class YahooClient:
    base_url: str = "https://query1.finance.yahoo.com/v8/finance/chart"

    def chart(self, symbol: str, interval: str = "1d", range_: str = "1mo"):
        normalized = symbol.upper()
        ticker = normalized if normalized.startswith("^") or normalized.endswith(".JK") else f"{normalized}.JK"
        params = urllib.parse.urlencode({"interval": interval, "range": range_, "includePrePost": "false"})
        return get_json(f"{self.base_url}/{urllib.parse.quote(ticker)}?{params}")
