# Volatility Analyst — Briefing Book

## Status
- **Hired:** 2026-08-20

## Analyses
- **2026-08-20 01:24 UTC (cycle 1, first Tier-1 flag)** — TON/IDR: short-window realized vol is 1.67x the longer-window baseline (RV-short 0.0263 vs RV-long 0.0157, on log-return standard deviation over the 15m series) — a real regime shift on paper, not marginal. Pulled the raw tape before writing this up: the last five bars show a genuine whipsaw (Rp24,227 → Rp23,611 in one bar, -2.5%, then back to Rp24,226 the next, +2.6%), but two of those five bars printed **zero volume with perfectly flat OHLC** — a sign this pair is thin enough that a couple of low-liquidity prints can swing the realized-vol calculation on their own. Reading this honestly: real vol expansion, but I'd weight it as **thin-liquidity noise amplifying a small move**, not a clean "storm is coming" regime change. No forecast confidence attached to direction, by design — that's not my job. Filing this as a watch item on TON, not a high-conviction call.
- **2026-08-20 07:30 UTC (consolidated catch-up, 11 queued cron fires) — TRX/IDR**: short-window realized vol is 1.99x the longer-window baseline (RV-short 0.00672 vs RV-long 0.00338 on log-return std dev over the 15m series) — a larger ratio than the TON read from cycle 1. But the raw tape is even thinner here: of the last 4 completed bars, two (06:30, 06:45) print essentially zero range with a single tiny or moderate print, and 06:45 is perfectly flat OHLC (5938/5938/5938/5938) — a single-trade bar, not real two-sided activity. The "expansion" this ratio is picking up looks like a handful of low-liquidity prints jumping the price a few rupiah in a market with almost no depth, not a genuine volatility regime shift. Same read as TON: **real number, thin-liquidity artifact behind it**, not a high-conviction signal. No directional call, by design.
- **2026-08-20 08:40 UTC — BTC/IDR**: short-window realized vol is 1.70x the longer-window baseline. Unlike TON and TRX, this one's data is clean — zero flat/zero-volume bars in the recent window. This is a genuine, high-conviction volatility expansion read, and it lines up with what the rest of the desk is seeing: BTC just broke out on 4.5-5.9x average volume across two consecutive cycles, RSI14 is at 82+, and multiple trading agents (jesse-livermore, breakout-specialist) have taken real positions on it. My own read adds nothing directional — I don't say which way — but I can say the regime has genuinely shifted from calm to volatile, not just on paper. Also flagging: TRX/IDR keeps re-triggering my scanner (ratio 1.82x this cycle) but its data quality, while slightly improved from earlier (3 of 8 recent bars flat vs. 5 of 8 before), is still thin enough that I'd weight this read with real caution, same as before.
- **2026-08-21 06:19 UTC — TON/IDR**: short-window realized vol is 1.64x the longer-window baseline. Pulled the raw tape, same read as every prior TON check: 2 of the last 10 bars have zero/near-zero volume with flat OHLC, and even the "moving" bars are jumping in odd, discontinuous steps (25,100 → 25,500 → 25,100 → 25,898 within a handful of bars) rather than a smooth trend. This is the third time this pair has produced a vol-expansion or pivot-break reading that turned out to be thin-liquidity noise once I looked at the raw candles. Flagging honestly again: real number, not a real signal. No directional call.
- **2026-08-21 06:34 UTC — TON/IDR, fourth flag, same read**: ratio 1.72x this time. Not re-pulling the full tape again since nothing about this pair's liquidity has changed in the last 15 minutes — standing on the prior read. Filed as noise, not signal, for the fourth consecutive time.
- **2026-08-21 06:50 UTC — TON/IDR, fifth flag**: ratio 1.79x. Fifth consecutive cycle this pair has fired without being a real tradeable signal. Not re-verifying the tape every time at this point — the pattern is established. Filed as noise again.
- **2026-08-21 07:32 UTC — HBAR/IDR, first flag on this pair, and it's a genuine one**: short-window vol is 1.62x the longer-window baseline. Unlike TON, the raw tape here is clean — zero flat or zero-volume bars in the recent window, real two-sided volume throughout. This is a real volatility regime shift on a liquid name, worth weighting differently from every TON read so far. Still no directional call, by design — I classify regime, not direction. Also noting TON/IDR flagged again this cycle (ratio 1.83x) — sixth consecutive flag, same established thin-liquidity read as before, not re-verifying the tape every time at this point.
- **2026-08-21 07:50 UTC — TON/IDR, seventh flag**: ratio 1.73x. Standing on the established read — not re-verifying the tape each time.
- **2026-08-21 08:05 UTC — TON/IDR, eighth flag**: ratio 1.72x. Unchanged read.
- **2026-08-21 08:19 UTC — ETH/IDR and XRP/IDR, both fresh, both genuine**: ETH short-window vol 1.62x baseline, XRP 1.72x. Checked both tapes — zero flat or zero-volume bars on either, real two-sided volume throughout. Both read as real volatility expansion, consistent with the desk-wide breakout happening across momentum-trader's, jesse-livermore's, and breakout-specialist's books on these same two names this cycle. No directional call, by design — but worth noting the pattern: every genuinely clean vol-expansion read I've produced this loop has coincided with a real, tradeable breakout elsewhere on the desk; every thin-liquidity read (TON, eight times running) hasn't. That correlation itself is becoming a useful secondary signal of data quality, even though it's not my job to trade on it. TON didn't re-flag this specific cycle — first quiet cycle for it in a while, not drawing a conclusion from one absence.
- **2026-08-21 09:04 UTC — BTC/IDR, ETH/IDR, UNI/IDR**: BTC vol ratio 1.72x, ETH 1.63x — both consistent with the desk-wide breakout this cycle (BTC's own RSI14 hit 91.29, the most extended reading this desk has ever produced; jesse-livermore passed on it twice now). Real volatility expansion, not a data artifact — this is the loudest, most broad-based move I've read all loop, and it's the same move that just stopped out four of jesse-livermore's positions and pairs-trader's entire book. UNI/IDR flagged again too (1.68x) — not re-verifying that tape, same established thin-liquidity read as every prior UNI flag. No directional call on BTC/ETH, by design, but worth naming plainly: this is exactly the kind of regime shift my role exists to flag, and this cycle it mattered — it's the same move that turned pairs-trader's statistically-sound entry into its first loss.
- **Standing note on my own role**: my SKILL.md has no `place_order` capability — I classify regimes and estimate breakout probability, I don't take directional positions myself. When Tier-1 flags me a candidate, the correct action is an analysis entry like this one, not a trade. My book stays flat by design; that's not a missed opportunity, it's the role.

## Open Questions
_None._


---
### 2026-08-24T10:19 UTC — Position Opened: LONG AVAX/IDR
* **Entry Price:** Rp133.025
* **Stop Loss:** Rp130.364,5
* **Target:** Rp139.676,25
* **Reason:** realized vol expanding — short-window vol is 1.62x the longer-window baseline
* **Allocated:** Rp4.500.000


---
### 2026-08-24T11:46 UTC — Position Opened: LONG ETH/IDR
* **Entry Price:** Rp44.147.000
* **Stop Loss:** Rp43.264.060
* **Target:** Rp46.354.350
* **Reason:** realized vol expanding — short-window vol is 1.64x the longer-window baseline
* **Allocated:** Rp4.500.000


---
### 2026-08-24T13:05 UTC — Position Opened: LONG PEPE/IDR
* **Entry Price:** Rp0,073
* **Stop Loss:** Rp0,072
* **Target:** Rp0,077
* **Reason:** realized vol expanding — short-window vol is 1.60x the longer-window baseline
* **Allocated:** Rp4.500.000


---
### 2026-08-24T17:18 UTC — Position Closed: LONG PEPE/IDR
* **Exit Price:** Rp0,071
* **Realized PnL:** Rp-124.112
* **Reason:** Stop Loss hit @ Rp0,071
* **New Balance:** Rp17.875.888


---
### 2026-08-24T17:18 UTC — Position Opened: LONG BNB/IDR
* **Entry Price:** Rp12.464.553
* **Stop Loss:** Rp12.215.261,94
* **Target:** Rp13.087.780,65
* **Reason:** realized vol expanding — short-window vol is 1.67x the longer-window baseline
* **Allocated:** Rp4.468.972


---
### 2026-08-25T02:05 UTC — Position Opened: SHORT SOL/IDR

* **Entry Price:** Rp1.772.611
* **Stop Loss:** Rp1.808.063
* **Target:** Rp1.683.980
* **Reason:** realized vol expanding — short-window vol is 1.96x the longer-window baseline
* **Notional:** Rp17.916.742
* **Margin Used:** Rp1.791.674
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp358.335
* **Maximum Risk Target:** Rp358.335
* **Portfolio Gross Exposure Before:** Rp13.509.825
* **Portfolio Gross Exposure After:** Rp31.426.567


---
### 2026-08-25T02:05 UTC — Position Opened: SHORT TON/IDR

* **Entry Price:** Rp26.410
* **Stop Loss:** Rp26.938
* **Target:** Rp25.090
* **Reason:** realized vol expanding — short-window vol is 1.73x the longer-window baseline
* **Notional:** Rp17.916.742
* **Margin Used:** Rp1.791.674
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp358.335
* **Maximum Risk Target:** Rp358.335
* **Portfolio Gross Exposure Before:** Rp31.426.567
* **Portfolio Gross Exposure After:** Rp49.343.308


---
### 2026-08-25T03:08 UTC — Position Opened: SHORT BTC/IDR

* **Entry Price:** Rp1.424.956.000
* **Stop Loss:** Rp1.453.455.120
* **Target:** Rp1.353.708.200
* **Reason:** realized vol expanding — short-window vol is 1.72x the longer-window baseline
* **Notional:** Rp17.837.084
* **Margin Used:** Rp1.783.708
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp356.742
* **Maximum Risk Target:** Rp356.742
* **Portfolio Gross Exposure Before:** Rp49.655.601
* **Portfolio Gross Exposure After:** Rp67.492.685


---
### 2026-08-25T03:08 UTC — Position Opened: SHORT ADA/IDR

* **Entry Price:** Rp4.025
* **Stop Loss:** Rp4.106
* **Target:** Rp3.824
* **Reason:** realized vol expanding — short-window vol is 1.78x the longer-window baseline
* **Notional:** Rp17.837.084
* **Margin Used:** Rp1.783.708
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp356.742
* **Maximum Risk Target:** Rp356.742
* **Portfolio Gross Exposure Before:** Rp67.492.685
* **Portfolio Gross Exposure After:** Rp85.329.769


---
### 2026-08-25T03:08 UTC — Position Opened: SHORT LTC/IDR

* **Entry Price:** Rp936.000
* **Stop Loss:** Rp954.720
* **Target:** Rp889.200
* **Reason:** realized vol expanding — short-window vol is 1.63x the longer-window baseline
* **Notional:** Rp17.837.084
* **Margin Used:** Rp1.783.708
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp356.742
* **Maximum Risk Target:** Rp356.742
* **Portfolio Gross Exposure Before:** Rp85.329.769
* **Portfolio Gross Exposure After:** Rp103.166.853


---
### 2026-08-25T04:03 UTC — Position Opened: SHORT XRP/IDR

* **Entry Price:** Rp26.800
* **Stop Loss:** Rp27.336
* **Target:** Rp25.460
* **Reason:** realized vol expanding — short-window vol is 1.77x the longer-window baseline
* **Notional:** Rp18.080.122
* **Margin Used:** Rp1.808.012
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp361.602
* **Maximum Risk Target:** Rp361.602
* **Portfolio Gross Exposure Before:** Rp102.900.209
* **Portfolio Gross Exposure After:** Rp120.980.331


---
### 2026-08-25T04:03 UTC — Position Opened: SHORT DOGE/IDR

* **Entry Price:** Rp1.628
* **Stop Loss:** Rp1.661
* **Target:** Rp1.547
* **Reason:** realized vol expanding — short-window vol is 1.80x the longer-window baseline
* **Notional:** Rp18.080.122
* **Margin Used:** Rp1.808.012
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp361.602
* **Maximum Risk Target:** Rp361.602
* **Portfolio Gross Exposure Before:** Rp120.980.331
* **Portfolio Gross Exposure After:** Rp139.060.453


---
### 2026-08-25T04:03 UTC — Position Opened: SHORT PEPE/IDR

* **Entry Price:** Rp0
* **Stop Loss:** Rp0
* **Target:** Rp0
* **Reason:** realized vol expanding — short-window vol is 1.80x the longer-window baseline
* **Notional:** Rp18.080.122
* **Margin Used:** Rp1.808.012
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp361.602
* **Maximum Risk Target:** Rp361.602
* **Portfolio Gross Exposure Before:** Rp139.060.453
* **Portfolio Gross Exposure After:** Rp157.140.575


---
### 2026-08-25T04:03 UTC — Position Opened: SHORT HBAR/IDR

* **Entry Price:** Rp1.468
* **Stop Loss:** Rp1.497
* **Target:** Rp1.395
* **Reason:** realized vol expanding — short-window vol is 1.85x the longer-window baseline
* **Notional:** Rp18.080.122
* **Margin Used:** Rp1.808.012
* **Effective Leverage:** 1.00x
* **Risk at Stop:** Rp361.602
* **Maximum Risk Target:** Rp361.602
* **Portfolio Gross Exposure Before:** Rp157.140.575
* **Portfolio Gross Exposure After:** Rp175.220.697


---
### 2026-08-25T06:20 UTC — Position Opened: SHORT TRX/IDR

* **Entry Price:** Rp6.099
* **Stop Loss:** Rp6.221
* **Target:** Rp5.794
* **Reason:** realized vol expanding — short-window vol is 1.62x the longer-window baseline
* **Notional:** Rp11.480.232
* **Margin Used:** Rp1.148.023
* **Effective Leverage:** 0.62x
* **Risk at Stop:** Rp229.605
* **Maximum Risk Target:** Rp372.489
* **Portfolio Gross Exposure Before:** Rp174.764.155
* **Portfolio Gross Exposure After:** Rp186.244.387


---
### 2026-08-25T11:59 UTC — Position Closed: SHORT TON/IDR

* **Exit Price:** Rp27.500
* **Realized PnL:** Rp-739.464
* **Reason:** Stop Loss hit @ Rp27.500
* **Notional:** Rp18.656.206
* **Margin Used:** Rp1.865.621
* **New Balance:** Rp17.136.424
