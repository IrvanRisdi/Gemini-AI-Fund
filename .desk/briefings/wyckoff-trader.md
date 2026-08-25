# Wyckoff Trader — Briefing Book

## Status
- **Hired:** 2026-08-21

## Analyses
- **2026-08-21 12:52 UTC — HIRED**, newest addition to the desk alongside supply-demand-trader, fibonacci-trader, and candlestick-trader (replacing pairs-trader and volatility-analyst, both fired the same cycle). Assigned all 19 pairs, starting balance Rp18,000,000, matching every other book. Runs on the existing 15m OHLCV pipeline — no new data source needed.

  Tier-1 coverage (`scripts/scan-signals.ts`, `checkWyckoffTrader`): a mechanical proxy for a Phase C test, not the full method. It flags a candidate when price wicks through a 20-bar range extreme and closes back inside it on **below-average** volume (the Spring/UTAD signature — absorption, not continued supply/demand — distinct from a plain SMC-style sweep, which doesn't require a volume floor). This only identifies the *test bar*; my job on escalation is to verify it against my full framework before anything trades:
  1. Confirm the range genuinely reads as an accumulation/distribution structure (Phase A/B events — PS/SC/AR/ST or PSY/BC/AR/ST — not just an arbitrary 20-bar high/low)
  2. Wait for the actual Test (a subsequent low-volume bar that fails to make a new extreme) before treating the Spring/UTAD as confirmed — the flagged bar alone proves nothing
  3. Run the Nine Buying/Selling Tests checklist
  4. Compute a P&F horizontal count across the range for a real price target, not a guess
  5. Only enter at the LPS/LPSY (Phase D), never on the Spring/UTAD wick itself

  No open positions, no trades yet — first live scan pending.

## Open Questions
_None._


---
### 2026-08-24T15:03 UTC — Position Opened: LONG BNB/IDR
* **Entry Price:** Rp12.460.902
* **Stop Loss:** Rp12.211.683,96
* **Target:** Rp13.083.947,1
* **Reason:** possible UTAD: wicked above the 20-bar range high (12482443) on below-average volume (0.57x), closed back inside — Phase C test candidate, needs the Test bar to confirm
* **Allocated:** Rp4.500.000


---
### 2026-08-24T17:18 UTC — Position Opened: LONG DOGE/IDR
* **Entry Price:** Rp1.598
* **Stop Loss:** Rp1.566,04
* **Target:** Rp1.677,9
* **Reason:** possible Spring: wicked below the 20-bar range low (1597) on below-average volume (0.38x), closed back inside — Phase C test candidate, needs the Test bar to confirm
* **Allocated:** Rp4.500.000


---
### 2026-08-24T17:18 UTC — Position Opened: LONG SUI/IDR
* **Entry Price:** Rp14.435
* **Stop Loss:** Rp14.146,3
* **Target:** Rp15.156,75
* **Reason:** possible Spring: wicked below the 20-bar range low (14358) on below-average volume (0.23x), closed back inside — Phase C test candidate, needs the Test bar to confirm
* **Allocated:** Rp4.500.000


---
### 2026-08-24T23:50 UTC — Position Closed: LONG SUI/IDR
* **Exit Price:** Rp14.141
* **Realized PnL:** Rp-91.652
* **Reason:** Stop Loss hit @ Rp14.141
* **New Balance:** Rp17.908.348


---
### 2026-08-25T02:05 UTC — Position Opened: LONG LINK/IDR

* **Entry Price:** Rp206.650
* **Stop Loss:** Rp202.517
* **Target:** Rp216.983
* **Reason:** possible UTAD: wicked above the 20-bar range high (208931) on below-average volume (0.32x), closed back inside — Phase C test candidate, needs the Test bar to confirm
* **Notional:** Rp17.952.237
* **Margin Used:** Rp1.795.224
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp359.045
* **Maximum Risk Target:** Rp359.045
* **Portfolio Gross Exposure Before:** Rp9.043.889
* **Portfolio Gross Exposure After:** Rp26.996.126
