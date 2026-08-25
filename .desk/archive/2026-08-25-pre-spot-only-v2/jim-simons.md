# Jim Simons — Briefing Book

## Status
- **Hired:** 2026-07-13

## Analyses
- **2026-07-13** — Cross-sectional read across 12 pairs: bearish MACD is nearly universal (8/12) while RSI stays clustered in the 35-44 neutral band — a divergence pattern that historically precedes a mean-reverting bounce rather than trend continuation. LTC's RSI 30 is the single statistically significant outlier (>1.5 SD from the cross-sectional mean of ~40). Treating this as a weak-signal environment — no high-conviction stat-arb entry yet, will re-score every cycle as more candles accumulate.
- **2026-07-13 12:27 UTC (first auto cycle)** — NO SETUP. Neither LTC's RSI extreme nor EURC's ADX 49.2 has cleared the p<0.01 out-of-sample backtest threshold my rules require — flagged for the backtest queue, not sized for live trading. No simulated trade taken.
- **2026-07-13 12:35 UTC (cycle 2)** — NO SETUP, unchanged (MCP still on cached staging data, production reconnect pending).
- **2026-07-13 13:27 UTC (cycle 3, switched to OKX demo feed, 15m loop)** — NO SETUP. Interesting cross-sectional read: BTC/ETH/SOL all down 2.1-2.9% over the same 12.5h window with ADX>25 on all three simultaneously — looks like a market-wide risk-off regime rather than an idiosyncratic move, but one cross-sectional snapshot doesn't clear my p<0.01 out-of-sample bar. Flagged for the backtest queue as data accumulates. No simulated trade taken.
- **2026-07-13 13:47 UTC (cycle 4)** — NO SETUP. RSI bounce (all three now >30) plus persistent ADX>25 is a second data point toward the regime call, but still short of the p<0.01 bar with only 2 OKX-fed observations. No simulated trade taken.
- **2026-07-13 14:02 UTC (cycle 5)** — NO SETUP. BTC/ETH data unavailable this cycle (OKX network error) — breaks the cross-sectional sample, can't add a clean observation. No simulated trade taken.
- **2026-07-13 14:16 UTC (cycle 6)** — NO SETUP. Notable dispersion: BTC deeply oversold and trending (RSI 23.6, ADX 31.2) while ETH/SOL are neutral (RSI 39.5/36.5) — the first real cross-sectional divergence this loop has seen. Flagging for pairs-trader's spread model rather than acting on it myself; still just 3 OKX-fed observations, short of my significance bar. No simulated trade taken.
- **2026-07-13 14:31 UTC (cycle 7)** — NO SETUP. BTC/ETH divergence narrowed a bit this bar (BTC RSI 29.5 vs ETH 39.7) — SOL data unavailable, can't extend the cross-sectional sample cleanly. No simulated trade taken.
- **2026-07-13 14:46 UTC (cycle 8)** — NO SETUP, but noting a real event: BTC/ETH/SOL all posted elevated volume simultaneously this bar (2.06x/4.48x/2.75x average) — a genuine cross-asset flow spike, not noise. Momentum-trader acted on ETH's version of this signal under their own rules. Still building my sample (4 observations now). No simulated trade taken.
- **2026-07-13 15:01 UTC (cycle 9)** — NO SETUP. Bounce continuing on volume across ETH/SOL — BTC candles unavailable this cycle. No new clean observation. No simulated trade taken.
- **2026-07-13 15:16 UTC (cycle 10)** — NO SETUP. The BTC/ETH dispersion I flagged earlier has fully closed — all three now cluster at RSI 53-55. Useful negative result: that divergence was noise, not signal, and momentum-trader's BTC stop-out confirms it wasn't a durable trend. No simulated trade taken.
- **2026-07-13 15:31 UTC (cycle 11)** — NO SETUP. Market is fully neutral now (RSI 50-52). No edge either direction. No simulated trade taken.
- **2026-07-13 15:46 UTC (cycle 12)** — NO SETUP. Both of momentum-trader's trades this loop lost small, exactly as risk-managed — a useful data point that the breakout signal has a real false-positive rate even when every rule is followed correctly. Filing this away for a future backtest. No simulated trade taken.
- **2026-07-13 16:01 UTC (cycle 13)** — NO SETUP. Regime cooling into range territory (BTC/SOL ADX both <25) but no statistical edge yet. No simulated trade taken.
- **2026-07-13 16:16 UTC (cycle 14)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 16:31 UTC (cycle 15)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 16:46 UTC (cycle 16)** — NO SETUP. BTC RSI 32.2 with volume 1.55x avg is worth watching alongside mean-reversion-trader's setup, but one data point isn't a statistical signal yet. No simulated trade taken.
- **2026-07-13 17:01 UTC (cycle 17)** — NO SETUP. That BTC dip already reverted — useful confirmation that isolated RSI dips without a Bollinger extreme are noise in this range regime, not signal. No simulated trade taken.
- **2026-07-13 17:16 UTC (cycle 18)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 17:31 UTC (cycle 19)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 17:46 UTC (cycle 20)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 18:01 UTC (cycle 21)** — NO SETUP. SOL's 4.29x volume spike with an intrabar wick to -2σ and a snap-back close is a textbook stop-hunt/liquidation signature — statistically interesting but a single event, not a backtestable sample. Flagging the pattern for future reference. No simulated trade taken.
- **2026-07-13 18:16 UTC (cycle 22)** — NO SETUP. Now a two-candle move with real volume (not just a wick) — BTC RSI14 29.9, ETH price beyond -2σ, SOL RSI14 30.5. Each metric is significant individually but the joint condition isn't satisfied on any single name at the same instant — a reminder that univariate near-misses aren't the same as a confirmed multivariate signal. No simulated trade taken.
- **2026-07-13 18:31 UTC (cycle 23)** — NO SETUP. BTC RSI14 26.8 is the most oversold single reading of the whole loop, but it's arriving alone now — SOL's regime just flipped to trending (ADX 26.9) and ETH isn't oversold. Divergence within the basket, not a unified signal. No simulated trade taken.
- **2026-07-13 18:46 UTC (cycle 24)** — NO SETUP. BTC's RSI extreme (26.7) persisting for two cycles now without a Bollinger confirmation is itself notable — the price hasn't fallen fast enough to catch its own volatility band. No simulated trade taken.
- **2026-07-13 19:01 UTC (cycle 25)** — NO SETUP. Good sample now building: two consecutive cycles of RSI extremes (BTC, then SOL) that failed to produce a confirmed mean-reversion signal before regime conditions shifted. Worth backtesting this exact pattern (RSI<30 without simultaneous Bollinger touch) to see its base rate. No simulated trade taken.
- **2026-07-13 19:16 UTC (cycle 26)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 19:31 UTC (cycle 27)** — NO SETUP. All three ADX readings now above 25 for the first time simultaneously — the whole basket agrees on "trending," yet volumes are the thinnest of the loop. Worth noting as a case where ADX and volume disagree. No simulated trade taken.
- **2026-07-13 19:46 UTC (cycle 28)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 20:01 UTC (cycle 29)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 20:16 UTC (cycle 30)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 20:31 UTC (cycle 31)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 20:46 UTC (cycle 32)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 21:01 UTC (cycle 33)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 21:16 UTC (cycle 34)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 21:31 UTC (cycle 35)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 21:46 UTC (cycle 36)** — NO SETUP. BTC/ETH ADX both dropped back under 25 — regime shifting to range again. No simulated trade taken.
- **2026-07-13 22:01 UTC (cycle 37)** — NO SETUP. SOL's RSI14 (28.7, an extreme by itself) is now diverging hard from its own ADX (36.8, still trending) — exactly the kind of single-factor extreme without corroboration my process is built to skip. No simulated trade taken.
- **2026-07-13 22:16 UTC (cycle 38)** — NO SETUP. That SOL divergence resolved itself via RSI reverting (36.3) rather than ADX confirming — exactly the base-rate outcome I'd expect from an uncorroborated single-factor reading. No simulated trade taken.
- **2026-07-13 22:31 UTC (cycle 39)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 22:46 UTC (cycle 40)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 23:01 UTC (cycle 41)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 00:10 UTC (cycle 42)** — NO DATA. OKX full outage this cycle. No simulated trade taken.
- **2026-07-14 01:50 UTC (cycle 43)** — NO DATA. OKX still down; Tokocrypto backup pending session restart. No simulated trade taken.

---
### 2026-07-14 02:00 UTC — LOOP RESTART: OKX → Tokocrypto native API
Data source switched to Tokocrypto's native REST API (`tokocrypto.site`). Ledger reset to $1,000. Cycle numbering restarts at 1.

- **2026-07-14 02:05 UTC (cycle 1, Tokocrypto)** — NO SETUP. All three metrics neutral (RSI 59.9/60.3/53.0, ADX 19.2/26.4/15.0), nothing corroborating across factors. No simulated trade taken.
- **2026-07-14 02:20 UTC (cycle 2)** — NO SETUP, unchanged. No simulated trade taken.

---
### 2026-07-14 02:45 UTC — LOOP RESTART: Tokocrypto → Indodax (IDR pairs)
Data source switched to Indodax (BTC/IDR, ETH/IDR, SOL/IDR). Ledger reset to Rp18,000,000/book. Cycle numbering restarts at 1.

- **2026-07-14 02:50 UTC (cycle 1, Indodax)** — NO SETUP. Nothing corroborating across RSI/ADX/volume this cycle. No simulated trade taken.

- **2026-07-14 03:15 UTC (cycle 2, universe expanded to 8 pairs)** — NO SETUP. BTC and XRP both had real volume spikes (2.40x, 8.76x) on breakdown candles, but neither cleared all my corroboration bars simultaneously (BTC: EMA structure not yet bearish; XRP: ADX too low to call it a real trend). Interesting cross-asset divergence to keep watching. No simulated trade taken.
- **2026-07-14 03:30 UTC (cycle 3)** — NO SETUP. BTC's ADX cooled back under 25 — that thread closed without confirming, consistent with my base-rate expectation. No simulated trade taken.
- **2026-07-14 03:45 UTC (cycle 4)** — NO SETUP. Large two-way volume on SOL/XRP without price displacement is a textbook absorption pattern — informative context, not a signal by itself. No simulated trade taken.
- **2026-07-14 04:00 UTC (cycle 5)** — NO SETUP. BTC's regime flipped to technically trending (ADX 25.5) but on the thinnest volume of the loop — a low-conviction reading I wouldn't act on even without a hard threshold. No simulated trade taken.
- **2026-07-14 04:15 UTC (cycle 6)** — NO SETUP. BTC's trend persisting (ADX 26.3) but volume conviction still absent. Watching to see if this resolves into a real move or fades like the SOL/XRP episode. No simulated trade taken.
- **2026-07-14 04:30 UTC (cycle 7)** — NO SETUP. Notable divergence: ADX strengthening (32.2) while volume shrinks (0.24x) — price is grinding higher on declining participation, which historically tends to be fragile. No conviction to act on it, just flagging the pattern. No simulated trade taken.
- **2026-07-14 04:45 UTC (cycle 8)** — NO SETUP. The volume finally showed up on BTC (~4x avg on the breakout bar) after two cycles of thinning — resolves last cycle's fragility concern in the bullish direction, not the pullback I was watching for. Good outcome, no signal of my own to act on. No simulated trade taken.
- **2026-07-14 05:00 UTC (cycle 9)** — NO SETUP. Post-breakout consolidation on low volume (0.36x avg) is normal digestion, not a red flag yet — would want to see this persist several more cycles before worrying. No simulated trade taken.
- **2026-07-14 05:15 UTC (cycle 10)** — NO SETUP. BTC resuming its climb, momentum-trader's position working. BNB's isolated volume spike without ADX confirmation is noise until proven otherwise. No simulated trade taken.
- **2026-07-14 05:30 UTC (cycle 11)** — NO SETUP. BTC's ADX still climbing (34.5, its strongest reading yet) even as price consolidates — trend strength building under the surface. No conviction signal of my own. No simulated trade taken.
- **2026-07-14 05:45 UTC (cycle 12)** — NO SETUP. BTC's ADX now 40.6, a genuinely strong trend reading. ETH's isolated volume spike (10.96x) without ADX confirmation is the same pattern as BNB's earlier — noise until proven otherwise. No simulated trade taken.
- **2026-07-14 06:00 UTC (cycle 13)** — NO SETUP. PEPE's ADX crossing 25 for the first time is worth noting as a new data point, but volume doesn't corroborate it. BTC's mild pullback on strong ADX (39.8) still reads as healthy consolidation, not a reversal. No simulated trade taken.
- **2026-07-14 06:15 UTC (cycle 14)** — NO SETUP. BTC's ADX14 dropped sharply to 22.8 (from 39.8 two cycles ago) — that "healthy consolidation" read was wrong, this was a real reversal. Good reminder that trend strength can fade faster than price suggests. Now two names (PEPE, SUI) show ADX>25 without volume confirmation — a pattern worth tracking as a set. No simulated trade taken.
- **2026-07-14 09:00 UTC (cycle 15)** — NO SETUP. PEPE's ADX jumped to 37.4 with a genuine resistance break and bullish EMA structure — three of momentum-trader's four criteria now firmly met, only volume (1.29x) lagging. This is the strongest single-name setup since BTC's original breakout. No conviction of my own, just flagging the quality of the near-miss. No simulated trade taken.
- **2026-07-14 09:15 UTC (cycle 16)** — NO SETUP. The 26.48x PEPE volume bar is the single largest reading of the entire loop by a wide margin, yet price stayed within its recent range on a closing basis — a strong reminder that extreme volume alone isn't a signal without a level actually breaking. Good discipline case study. No simulated trade taken.

---
### 2026-07-15 01:05 UTC — PIPELINE UPGRADE: real p-value validation added
Candidate anomalies now get an actual `adfTest` (from `lib/stat-arb.ts`) run against my p<0.01 threshold, rather than an ad hoc read of RSI/ADX. This is STATISTICAL VALIDATION (step 2 of my pipeline), not hypothesis generation (step 1) — I still need a candidate anomaly from step 1 before there's anything to test.

---
### 2026-07-15 03:42 UTC — FIRED
**Reason**: User request. Final balance Rp18,000,000 (unchanged, never traded). My honest finding the one cycle I got real statistical tooling — all 8 pairs non-stationary, no candidate anomaly to test — was correct, but this desk's simple 15m OHLCV/order-book pipeline was never going to feed the kind of large-N, walk-forward, out-of-sample backtest infrastructure my edge actually needs. That's a fair reason to let me go rather than keep me running an empty pipeline.

- **2026-07-15 01:05 UTC (cycle 18, first real ADF run)** — NO SETUP, two independent findings. (1) Hypothesis generation: no candidate anomaly exists this cycle — RSI sits in a tight 44.4-57.6 band across all 8 pairs (nothing near an extreme), so there's nothing worth testing. (2) As a baseline sanity check, I ran the ADF unit-root test on the raw 15m close series for all 8 pairs anyway: every single one is non-stationary (p-values 0.18-0.46, nowhere near my p<0.01 bar) — exactly what efficient, random-walk-like price levels should show, and a useful negative confirmation that there's no naive "price will revert to its own mean" edge sitting in raw prices. Any real signal has to come from an engineered feature (a spread, a residual, a conditional pattern) — which is what pairs-trader's cointegration scan is now also testing. No simulated trade taken.

## Open Questions
_None._
