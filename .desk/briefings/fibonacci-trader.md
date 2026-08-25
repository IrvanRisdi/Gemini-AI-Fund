# Fibonacci Trader — Briefing Book

## Status
- **Hired:** 2026-08-21

## Analyses
- **2026-08-21 12:52 UTC — HIRED**, newest addition to the desk alongside wyckoff-trader, supply-demand-trader, and candlestick-trader (replacing pairs-trader and volatility-analyst, both fired the same cycle). Assigned all 19 pairs, starting balance Rp18,000,000, matching every other book. Runs on the existing 15m OHLCV pipeline — no new data source needed.

  Tier-1 coverage (`scripts/scan-signals.ts`, `checkFibonacciTrader`): finds the most recent swing high/low (2-bar-lookback pivots) and flags a candidate when price tags the 38.2/50/61.8% retracement band of that swing with a reaction candle (a long opposing wick relative to the body — my "Fib stick" signature). This is a bare-level check by design — the scan can't see confluence. On escalation I still need to verify:
  1. The swing anchor is genuinely obvious (≥2 lower highs/higher lows on both sides), not a marginal pivot
  2. Confluence: does the same price also line up with prior support/resistance or an active trendline? A level with zero confluence is a watch level, not a trade
  3. Whether the market is actually trending (this tool works poorly in a range)
  4. Stop placement sized to the actual distance used (next level out vs. the swing extreme), never a fixed size regardless of setup

  No open positions, no trades yet — first live scan pending.

- **2026-08-21 13:23 UTC — first trade: SHORT SUI/IDR @ 13,989.** The 61.8% retracement (14,000.92) of the 14,169→13,729 down-leg wasn't a bare level this time — checked the surrounding 24 hours and this exact 13,990–14,020 band had already been tested and rejected four separate times before this retest (08:30, 09:30, 10:30, 11:15), plus a bearish reaction candle closing back below the level on the retest itself. Confluence score 2/3 (S/R + candlestick; no trendline check run this pass).

  Stop 14,075 (just past the 76.4% level). Target the swing low 13,729 (0% retracement) — R:R ~3.0:1. Curve position 77.6% of the recent range, favorable for a short (high in the range, working with location not against it). Size 144.75 (25% of full position, capped at 5%-of-desk, Rp8,099,582 off the current 9-book active desk total). Risk ~Rp12,449.

  Worth flagging: jesse-livermore holds SUI long from a much earlier, much lower entry (12,600) — opposite direction, same pair, different framework and timeframe. Not a contradiction, same precedent as mean-reversion-trader's opposite LTC short earlier this loop. Gated by risk-manager, no limit concerns (risk is trivial against any budget).

## Open Questions
_None._


---
### 2026-08-24T08:54 UTC — Position Opened: SHORT LTC/IDR
* **Entry Price:** Rp915.000
* **Stop Loss:** Rp933.300
* **Target:** Rp869.250
* **Reason:** 38.2% retracement (919910.000000) of swing high 923000->low 918000 tagged with a bearish reaction candle
* **Allocated:** Rp4.490.555


---
### 2026-08-24T09:27 UTC — Position Closed: SHORT LTC/IDR
* **Exit Price:** Rp936.000
* **Realized PnL:** Rp-103.062
* **Reason:** Stop Loss hit @ Rp936.000
* **New Balance:** Rp17.859.158


---
### 2026-08-24T09:27 UTC — Position Opened: SHORT LINK/IDR
* **Entry Price:** Rp202.640
* **Stop Loss:** Rp206.692,8
* **Target:** Rp192.508
* **Reason:** 61.8% retracement (204445.458000) of swing high 206883->low 200502 tagged with a bearish reaction candle
* **Allocated:** Rp4.464.790


---
### 2026-08-24T10:19 UTC — Position Opened: LONG SOL/IDR
* **Entry Price:** Rp1.674.182
* **Stop Loss:** Rp1.640.698,36
* **Target:** Rp1.757.891,1
* **Reason:** 38.2% retracement (1666486.222000) of swing low 1651729->high 1675608 tagged with a bullish reaction candle
* **Allocated:** Rp4.464.790


---
### 2026-08-24T13:05 UTC — Position Closed: SHORT LINK/IDR
* **Exit Price:** Rp208.344
* **Realized PnL:** Rp-125.677
* **Reason:** Stop Loss hit @ Rp208.344
* **New Balance:** Rp17.733.481


---
### 2026-08-24T15:03 UTC — Position Opened: SHORT DOGE/IDR
* **Entry Price:** Rp1.630
* **Stop Loss:** Rp1.662,6
* **Target:** Rp1.548,5
* **Reason:** 61.8% retracement (1627.900000) of swing high 1647->low 1597 tagged with a bearish reaction candle
* **Allocated:** Rp4.433.370


---
### 2026-08-25T02:05 UTC — Position Closed: LONG SOL/IDR

* **Exit Price:** Rp1.772.611
* **Realized PnL:** +Rp262.495
* **Reason:** Take Profit hit @ Rp1.772.611
* **Notional:** Rp4.727.285
* **Margin Used:** Rp472.728
* **New Balance:** Rp17.995.977


---
### 2026-08-25T03:08 UTC — Position Closed: LONG BTC/IDR

* **Exit Price:** Rp1.424.956.000
* **Realized PnL:** +Rp199.249
* **Reason:** Take Profit hit @ Rp1.424.956.000
* **Notional:** Rp4.689.804
* **Margin Used:** Rp468.980
* **New Balance:** Rp18.195.225


---
### 2026-08-25T04:03 UTC — Position Opened: LONG SOL/IDR

* **Entry Price:** Rp1.794.935
* **Stop Loss:** Rp1.759.036
* **Target:** Rp1.884.682
* **Reason:** 38.2% retracement (1790506.920000) of swing low 1767060->high 1805000 tagged with a bullish reaction candle
* **Notional:** Rp18.200.665
* **Margin Used:** Rp1.820.067
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp364.013
* **Maximum Risk Target:** Rp364.013
* **Portfolio Gross Exposure Before:** Rp4.427.931
* **Portfolio Gross Exposure After:** Rp22.628.596


---
### 2026-08-25T04:03 UTC — Position Opened: LONG BNB/IDR

* **Entry Price:** Rp12.655.136
* **Stop Loss:** Rp12.402.033
* **Target:** Rp13.287.893
* **Reason:** 38.2% retracement (12631257.954000) of swing low 12520047->high 12700000 tagged with a bullish reaction candle
* **Notional:** Rp18.200.665
* **Margin Used:** Rp1.820.067
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp364.013
* **Maximum Risk Target:** Rp364.013
* **Portfolio Gross Exposure Before:** Rp22.628.596
* **Portfolio Gross Exposure After:** Rp40.829.261
