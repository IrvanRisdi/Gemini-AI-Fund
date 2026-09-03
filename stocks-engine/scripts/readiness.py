"""Exit non-zero until the deployed dashboard is ready for paper trading."""
from __future__ import annotations

import json
import os
import sys
import urllib.request

url = os.getenv("NQ_STATUS_URL", "http://127.0.0.1:4173/api/system/status")
with urllib.request.urlopen(url, timeout=5) as response:
    status = json.load(response)
print(json.dumps(status, indent=2))
sys.exit(0 if status["ready"] else 1)
