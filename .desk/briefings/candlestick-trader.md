# Candlestick Trader — Briefing Book

## Status
- **Hired:** 2026-08-21

## Analyses
- **2026-08-21 12:52 UTC — HIRED**, newest addition to the desk alongside wyckoff-trader, supply-demand-trader, and fibonacci-trader (replacing pairs-trader and volatility-analyst, both fired the same cycle). Assigned all 19 pairs, starting balance Rp18,000,000, matching every other book. Runs on the existing 15m OHLCV pipeline — no new data source needed.

  Tier-1 coverage (`scripts/scan-signals.ts`, `checkCandlestickTrader`): detects Bullish/Bearish Engulfing only — the simplest, purely-OHLC Level 1 pattern — checked against a short (5-bar) trend context so the same shape isn't misread out of context. Every other pattern in my own framework (stars, piercing/dark cloud, kicker, and everything in Levels 2–4) is left to the full-reasoning pass; the scan is not meant to replace my judgment, only to flag when it's worth spending it. On escalation I still need to verify:
  1. My own reliability tier for whatever pattern is actually present — Engulfing is Level 1 (trade directly), but I re-check the classification isn't wrong before treating it that way
  2. Volume behind the pattern
  3. A target and invalidation level from a separate framework (S/R, Fib, or supply/demand) — my method never supplies its own

  No open positions, no trades yet — first live scan pending.

- **2026-08-21 13:00 UTC — first live scan, one candidate (HYPE/IDR Bullish Engulfing), declined on R:R, not on the pattern itself.**

  The pattern read correctly: 12:15 bar (o 1,300,000, c 1,296,103, bearish) into 12:30 (o 1,296,103, c 1,305,183, bullish, body fully engulfs the prior candle) — genuine Level 1 Bullish Engulfing, and trend context checked out (5-bar window into the signal shows a clean decline, 1,317,784 → 1,296,103, so this is a real reversal setup, not a mid-range coin flip). Data clean, 0 flat/zero-volume bars. Volume on the engulfing candle itself was actually below its 10-bar average (0.82x) — a weaker-than-ideal signature per my own "volume is the pattern's lie detector" note, though not disqualifying on its own for a Level 1 pattern.

  What killed it was timing. Sourcing a target from S/R (my own rule — this method never supplies its own): 20-bar resistance at 1,336,999. Sourcing invalidation from the pattern's own extreme / nearest structural low: ~1,295,000–1,300,003. At the signal candle's own close (1,305,183), that's a genuine ~3:1 setup. But by the time I verified — two bars later — price had already run to ~1,313,377, most of the way toward that resistance target without me in the trade. Recomputed from a realistic current entry, R:R drops to roughly 1.3–1.8:1 depending on which invalidation reference is used, well under what I'd want for a method whose own base rate hovers near a coin flip (my Performance Metrics say it plainly: expectancy has to come from R:R, not hit rate). Declining rather than forcing a weak-R:R chase of a signal that already played out most of its move before I could act on it.

  Nothing escalated to risk-manager — nothing to gate.

- **2026-08-21 13:23 UTC — HYPE/IDR Bullish Engulfing declined again, this time for the opposite reason: no target reference, not a weak pattern.**

  The pattern itself was the strongest read I've had yet: 12:45 bar (o 1,301,813, c 1,303,234 — small down) into 13:00 (o 1,301,813, c 1,340,000 — a violent bullish bar that fully engulfs the prior candle and then some). Volume on the engulfing candle was 647.7, roughly 3–14x the preceding five bars — the opposite problem from last time (that one was 0.82x, this one is clearly real). Clean data, zero flat/zero-volume bars.

  What killed it: my own rule says this method never supplies its own target, and there was nothing solid to borrow one from. Price broke to a fresh high on this same bar (curve position 100% of the recent range) — there's no prior S/R above to anchor a target, and no trendline check run this pass. supply-demand-trader flagged a demand zone on the same bar but declined it themselves on curve-location grounds, so I can't borrow their level as a validated reference either. Rather than invent a target off an ATR multiple just to have a number, declining until there's an actual external level to point to. jesse-livermore took this same bar on their own pivot-and-volume framework, which doesn't need a fixed target the way mine does.

  Nothing escalated to risk-manager — nothing to gate.

## Open Questions
_None._


---
### 2026-08-24T08:54 UTC — Position Opened: SHORT PEPE/IDR
* **Entry Price:** Rp0,071
* **Stop Loss:** Rp0,072
* **Target:** Rp0,067
* **Reason:** Bullish Engulfing after a short downtrend (Level 1 reversal pattern)
* **Allocated:** Rp4.500.000


---
### 2026-08-24T09:27 UTC — Position Opened: SHORT XRP/IDR
* **Entry Price:** Rp26.055
* **Stop Loss:** Rp26.576,1
* **Target:** Rp24.752,25
* **Reason:** Bullish Engulfing after a short downtrend (Level 1 reversal pattern)
* **Allocated:** Rp4.500.000


---
### 2026-08-24T09:27 UTC — Position Opened: SHORT HYPE/IDR
* **Entry Price:** Rp1.386.328
* **Stop Loss:** Rp1.414.054,56
* **Target:** Rp1.317.011,6
* **Reason:** Bullish Engulfing after a short downtrend (Level 1 reversal pattern)
* **Allocated:** Rp4.500.000


---
### 2026-08-24T11:46 UTC — Position Closed: SHORT PEPE/IDR
* **Exit Price:** Rp0,073
* **Realized PnL:** Rp-101.229
* **Reason:** Stop Loss hit @ Rp0,073
* **New Balance:** Rp17.898.771


---
### 2026-08-24T11:46 UTC — Position Closed: SHORT XRP/IDR
* **Exit Price:** Rp26.645
* **Realized PnL:** Rp-101.900
* **Reason:** Stop Loss hit @ Rp26.645
* **New Balance:** Rp17.796.871


---
### 2026-08-24T11:46 UTC — Position Closed: SHORT HYPE/IDR
* **Exit Price:** Rp1.414.487
* **Realized PnL:** Rp-91.404
* **Reason:** Stop Loss hit @ Rp1.414.487
* **New Balance:** Rp17.705.467


---
### 2026-08-24T13:05 UTC — Position Opened: SHORT TON/IDR
* **Entry Price:** Rp26.339
* **Stop Loss:** Rp26.865,78
* **Target:** Rp25.022,05
* **Reason:** Bearish Engulfing after a short uptrend (Level 1 reversal pattern)
* **Allocated:** Rp4.426.367


---
### 2026-08-24T15:03 UTC — Position Opened: SHORT BNB/IDR
* **Entry Price:** Rp12.460.902
* **Stop Loss:** Rp12.710.120,04
* **Target:** Rp11.837.856,9
* **Reason:** Bearish Engulfing after a short uptrend (Level 1 reversal pattern)
* **Allocated:** Rp4.426.367


---
### 2026-08-24T15:03 UTC — Position Opened: SHORT HYPE/IDR
* **Entry Price:** Rp1.397.454
* **Stop Loss:** Rp1.425.403,08
* **Target:** Rp1.327.581,3
* **Reason:** Bearish Engulfing after a short uptrend (Level 1 reversal pattern)
* **Allocated:** Rp4.426.367


---
### 2026-08-25T03:08 UTC — Position Closed: SHORT HYPE/IDR

* **Exit Price:** Rp1.426.400
* **Realized PnL:** Rp-91.685
* **Reason:** Stop Loss hit @ Rp1.426.400
* **Notional:** Rp4.518.052
* **Margin Used:** Rp451.805
* **New Balance:** Rp17.613.782


---
### 2026-08-25T05:19 UTC — Position Opened: SHORT ADA/IDR

* **Entry Price:** Rp3.992
* **Stop Loss:** Rp4.072
* **Target:** Rp3.792
* **Reason:** Bullish Engulfing after a short downtrend (Level 1 reversal pattern)
* **Notional:** Rp17.538.735
* **Margin Used:** Rp1.753.874
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp350.775
* **Maximum Risk Target:** Rp350.775
* **Portfolio Gross Exposure Before:** Rp8.927.781
* **Portfolio Gross Exposure After:** Rp26.466.516


---
### 2026-08-25T05:51 UTC — Position Opened: SHORT PEPE/IDR

* **Entry Price:** Rp0
* **Stop Loss:** Rp0
* **Target:** Rp0
* **Reason:** Bearish Engulfing after a short uptrend (Level 1 reversal pattern)
* **Notional:** Rp17.536.549
* **Margin Used:** Rp1.753.655
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp350.731
* **Maximum Risk Target:** Rp350.731
* **Portfolio Gross Exposure Before:** Rp26.468.703
* **Portfolio Gross Exposure After:** Rp44.005.252


---
### 2026-08-25T06:20 UTC — Position Opened: SHORT SOL/IDR

* **Entry Price:** Rp1.798.543
* **Stop Loss:** Rp1.834.514
* **Target:** Rp1.708.616
* **Reason:** Bearish Engulfing after a short uptrend (Level 1 reversal pattern)
* **Notional:** Rp17.745.472
* **Margin Used:** Rp1.774.547
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp354.909
* **Maximum Risk Target:** Rp354.909
* **Portfolio Gross Exposure Before:** Rp43.796.328
* **Portfolio Gross Exposure After:** Rp61.541.801


---
### 2026-08-25T06:20 UTC — Position Opened: SHORT SUI/IDR

* **Entry Price:** Rp14.661
* **Stop Loss:** Rp14.954
* **Target:** Rp13.928
* **Reason:** Bearish Engulfing after a short uptrend (Level 1 reversal pattern)
* **Notional:** Rp17.745.472
* **Margin Used:** Rp1.774.547
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp354.909
* **Maximum Risk Target:** Rp354.909
* **Portfolio Gross Exposure Before:** Rp61.541.801
* **Portfolio Gross Exposure After:** Rp79.287.273


---
### 2026-08-25T09:44 UTC — Position Opened: SHORT DOGE/IDR

* **Entry Price:** Rp1.612
* **Stop Loss:** Rp1.644
* **Target:** Rp1.531
* **Reason:** Bearish Engulfing after a short uptrend (Level 1 reversal pattern)
* **Notional:** Rp19.282.870
* **Margin Used:** Rp1.928.287
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp385.657
* **Maximum Risk Target:** Rp385.657
* **Portfolio Gross Exposure Before:** Rp77.749.875
* **Portfolio Gross Exposure After:** Rp97.032.745
