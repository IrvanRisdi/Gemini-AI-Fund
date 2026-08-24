# Pairs Trader — Briefing Book

## Status
- **Hired:** 2026-07-13

## Analyses
- **2026-07-13 13:27 UTC (cycle 1, OKX demo feed, 15m loop)** — NO SETUP. ETH/BTC and SOL/BTC moved together this window (all three down 2.1-2.9%, no relative decorrelation) — a pairs trade needs the spread to diverge, not the whole basket falling in lockstep. No simulated trade taken.
- **2026-07-13 13:47 UTC (cycle 4)** — NO SETUP. BTC/ETH/SOL bounced together again this bar — still no relative divergence between the pair legs. No simulated trade taken.
- **2026-07-13 14:02 UTC (cycle 5)** — NO SETUP. BTC/ETH data unavailable this cycle (OKX network error) — can't compute a spread without both legs. No simulated trade taken.
- **2026-07-13 14:16 UTC (cycle 6)** — NO SETUP, but flagged by Quant Analyst: BTC diverging from ETH/SOL for the first time (BTC RSI 23.6/ADX 31.2 vs ETH 39.5/36.5, SOL 36.5/29.2). One bar of divergence isn't a tradeable spread z-score yet — need to see it persist before modeling a BTC/ETH or BTC/SOL pair entry. Watching closely next cycle.
- **2026-07-13 14:31 UTC (cycle 7)** — NO SETUP. BTC/ETH divergence narrowed this bar rather than widening; SOL data unavailable. No clean spread to model. No simulated trade taken.
- **2026-07-13 14:46 UTC (cycle 8)** — NO SETUP. ETH's sharp breakdown actually converges back toward BTC's move rather than diverging further — the dispersion trade I was watching for is fading, not building. No simulated trade taken.
- **2026-07-13 15:01 UTC (cycle 9)** — NO SETUP. ETH/SOL bouncing together, BTC data unavailable. No spread signal. No simulated trade taken.
- **2026-07-13 15:16 UTC (cycle 10)** — NO SETUP. BTC/ETH/SOL fully converged (RSI 53-55 across the board) — the dispersion is gone. No simulated trade taken.
- **2026-07-13 15:31 UTC (cycle 11)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 15:46 UTC (cycle 12)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 16:01 UTC (cycle 13)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 16:16 UTC (cycle 14)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 16:31 UTC (cycle 15)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 16:46 UTC (cycle 16)** — NO SETUP. BTC weakening a bit vs ETH/SOL again — minor divergence forming, not yet tradeable. No simulated trade taken.
- **2026-07-13 17:01 UTC (cycle 17)** — NO SETUP. Divergence faded again, all three moving together. No simulated trade taken.
- **2026-07-13 17:16 UTC (cycle 18)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 17:31 UTC (cycle 19)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 17:46 UTC (cycle 20)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 18:01 UTC (cycle 21)** — NO SETUP. SOL diverged sharply from BTC/ETH this bar (-1.70% vs -1.00%/-0.72%) on huge relative volume — the biggest single-bar divergence this loop. But it's one bar and already mean-reverting; need to see if SOL/BTC spread actually holds before modeling a pair entry. Closest candidate yet — watching next cycle. No simulated trade taken.
- **2026-07-13 18:16 UTC (cycle 22)** — NO SETUP. SOL still weakest (-2.16% vs BTC -1.28%/ETH -1.32%) but all three are now falling together — this reads as correlated risk-off, not a relative-value dispersion trade. No simulated trade taken.
- **2026-07-13 18:31 UTC (cycle 23)** — NO SETUP. SOL now the only one with confirmed trend (ADX 26.9) while BTC/ETH remain range-bound (22.9/18.5) — a genuine regime split forming between SOL and the other two. Worth modeling a SOL/BTC spread if this persists another cycle. No simulated trade taken.
- **2026-07-13 18:46 UTC (cycle 24)** — NO SETUP. Regime split persists (SOL ADX 29.3 vs BTC 24.7/ETH 21.9), but I don't have a mechanism to trade a pure regime-divergence signal without a defined spread entry rule — flagging for further model development, not executing on a hunch. No simulated trade taken.
- **2026-07-13 19:01 UTC (cycle 25)** — NO SETUP. BTC's ADX also crossed 25 now, joining SOL as trending while ETH lags at 23.1 — the split is now BTC+SOL vs ETH rather than SOL alone. Still no defined spread-entry rule to act on. No simulated trade taken.
- **2026-07-13 19:16 UTC (cycle 26)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 19:31 UTC (cycle 27)** — NO SETUP. Regime split resolved — all three trending together now (ADX 27.2/25.6/34.9), no divergence to trade. No simulated trade taken.
- **2026-07-13 19:46 UTC (cycle 28)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 20:01 UTC (cycle 29)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 20:16 UTC (cycle 30)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 20:31 UTC (cycle 31)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 20:46 UTC (cycle 32)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 21:01 UTC (cycle 33)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 21:16 UTC (cycle 34)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 21:31 UTC (cycle 35)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 21:46 UTC (cycle 36)** — NO SETUP. SOL diverging from BTC/ETH regime again (still trending at 35.6 vs both dropping under 25). Watching. No simulated trade taken.
- **2026-07-13 22:01 UTC (cycle 37)** — NO SETUP. Divergence widening — SOL RSI14 now the most oversold of the three (28.7) while BTC/ETH sit mid-30s, but this is a single-leg extreme, not a pair spread signal without a proper cointegration check. No simulated trade taken.
- **2026-07-13 22:16 UTC (cycle 38)** — NO SETUP. Divergence collapsed back — all three RSI converging toward neutral again (43.7/46.1/36.3). No simulated trade taken.
- **2026-07-13 22:31 UTC (cycle 39)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 22:46 UTC (cycle 40)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-13 23:01 UTC (cycle 41)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 00:10 UTC (cycle 42)** — NO DATA. OKX full outage this cycle. No simulated trade taken.
- **2026-07-14 01:50 UTC (cycle 43)** — NO DATA. OKX still down; Tokocrypto backup pending session restart. No simulated trade taken.

---
### 2026-07-14 02:00 UTC — LOOP RESTART: OKX → Tokocrypto native API
Data source switched to Tokocrypto's native REST API (`tokocrypto.site`). Ledger reset to $1,000. Cycle numbering restarts at 1.

- **2026-07-14 02:05 UTC (cycle 1, Tokocrypto)** — NO SETUP. No cointegration baseline established yet on the new data source. No simulated trade taken.
- **2026-07-14 02:20 UTC (cycle 2)** — NO SETUP, unchanged. No simulated trade taken.

---
### 2026-07-14 02:45 UTC — LOOP RESTART: Tokocrypto → Indodax (IDR pairs)
Data source switched to Indodax (BTC/IDR, ETH/IDR, SOL/IDR). Ledger reset to Rp18,000,000/book. Cycle numbering restarts at 1.

- **2026-07-14 02:50 UTC (cycle 1, Indodax)** — NO SETUP. No cointegration baseline established yet on the new venue. No simulated trade taken.

- **2026-07-14 03:15 UTC (cycle 2, universe expanded to 8 pairs)** — NO SETUP. 8 pairs gives me a real candidate set for cointegration screening going forward (vs. only 3 before), but I need more history before scoring any pair combinations. No simulated trade taken.
- **2026-07-14 03:30 UTC (cycle 3)** — NO SETUP, unchanged. Still accumulating history for a proper cointegration test. No simulated trade taken.
- **2026-07-14 03:45 UTC (cycle 4)** — NO SETUP. SOL and XRP spiking volume simultaneously is worth logging for a future correlation check once I have enough history. No simulated trade taken.
- **2026-07-14 04:00 UTC (cycle 5)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 04:15 UTC (cycle 6)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 04:30 UTC (cycle 7)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 04:45 UTC (cycle 8)** — NO SETUP. BTC moving alone without the rest of the universe confirms it's an idiosyncratic move, not a basket-wide correlation shift. No simulated trade taken.
- **2026-07-14 05:00 UTC (cycle 9)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 05:15 UTC (cycle 10)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 05:30 UTC (cycle 11)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 05:45 UTC (cycle 12)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 06:00 UTC (cycle 13)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 06:15 UTC (cycle 14)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 09:00 UTC (cycle 15)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 09:15 UTC (cycle 16)** — NO SETUP. PEPE and SUI spiking volume in the same bar is worth logging for a future correlation check. No simulated trade taken.

---
### 2026-07-15 01:05 UTC — PIPELINE UPGRADE: real cointegration scan added
`lib/stat-arb.ts`'s `scorePairs()` (Engle-Granger + ADF + half-life) now runs every cycle across all 28 combinations of the 8-pair universe using 15m close series. This replaces 43 cycles of "no cointegration baseline established" with an actual, real answer.

- **2026-07-15 01:05 UTC (cycle 18, first real scan, n=59 bars)** — NO SETUP, but for a specific and now well-documented reason. 10 of 28 pairs show statistically cointegrated residuals (ADF p<0.01, e.g. ETH/BNB, SUI/BNB, SOL/BNB, ETH/SUI, all correlation >0.90) — but every one of them has a half-life under 1 period (~7-20 minutes), which fails my own tradeable-range filter (5-50 periods, "too fast = noise" per my rules). The only pair with a tradeable half-life, BTC/ETH at 5.6 periods, is **not** statistically cointegrated (ADF p=0.46) — its apparent relationship doesn't clear the bar. So: real cointegration exists in this basket, but only at noise-speed half-lives my strategy is built to reject, and the one candidate with a sane half-life fails the cointegration test itself. Correct read: no trade. Caveat: n=59 bars (~14.75h) is thin for a robust Engle-Granger test — my own framework recommends 200+ candles; will keep accumulating history and re-run.

---
### 2026-07-15 03:42 UTC — FIRED
**Reason**: User request. Final balance Rp18,000,000 (unchanged, never traded across either era of the loop). The one cycle I had real cointegration tooling gave an honest, well-supported "no trade" — but that same result (real cointegration only at noise-speed half-lives, thin n=59 sample) is exactly the kind of result that needs a much longer price history to resolve, which this desk's cadence isn't set up to accumulate quickly.

---
### 2026-08-21 07:32 UTC — FIRST LIVE TRADE: BTC/DOGE short_spread, ~48 cycles into re-hire

Every candidate since being re-hired has failed on half-life — real cointegration, but reverting inside 1.5 bars, faster than my own 5-50 period tradeable window and this desk's 15-minute cadence can act on. This one is different.

**Statistical case**: BTC/DOGE spread (regressing BTC price on DOGE price, 60-bar window). Engle-Granger cointegration test: ADF p-value 0.028, clears my 0.05 bar with room. Half-life 6.6 bars — squarely inside 5-50, the first candidate in this desk's history to land there. Correlation 0.76. Both legs' raw candles checked clean — zero flat or zero-volume bars, unlike the thin-liquidity names (TON, UNI) that have contaminated other agents' signals repeatedly this loop. Current z-score +2.01, just past my +2.0 entry threshold.

**Trade**: short_spread signal means BTC is rich relative to DOGE — short BTC, long DOGE, sized to the hedge ratio (695,794.51 DOGE-price-units per BTC-price-unit). Short 0.00133516 BTC (Rp1,800,000 notional), long 928.997 DOGE (Rp1,375,845 notional) — not dollar-neutral by design (this hedge ratio targets spread-neutrality via the regression, not equal notional), but the same order of magnitude, which is a reasonable sanity check that the ratio itself isn't broken.

**Sizing note, for the record**: my own SKILL's literal position-sizing formula (`risk_budget × equity / (entry_z × sigma_spread)`) produces an unreasonable size at BTC's price scale — the formula doesn't cleanly specify which units "sigma_spread" should be read in when the two legs' price levels differ by six orders of magnitude. Rather than trust a formula output I can't fully justify, I sized the BTC leg to the desk's standard 10%-of-book convention and derived the DOGE leg from the hedge ratio. Total risk to my 3.5-sigma stop: ~Rp11,158 across both legs — appropriately small for an unproven strategy's first real fill on this desk.

**Levels**: entry spread ~Rp317,681,328. Exit target (|z|<0.5): spread reverts to ~Rp309,199,177. Stop (|z|>3.5): spread widens to ~Rp326,038,326. Time stop: 2× half-life ≈ 13.2 bars (~3.3 hours) without reversion.

**Correlation breakdown watch**: will flag immediately if rolling correlation drops under 0.60, ADF significance is lost, or half-life doubles from 6.6 bars — any of those means the statistical foundation moved, not just the price.

---
### 2026-08-21 07:50 UTC — spread reverting as expected, holding

Z-score moved from +2.01 at entry to +1.32 this check — the spread is doing exactly what the statistics predicted, contracting back toward the mean. Not yet at my exit threshold (|z|<0.5), so holding both legs unchanged. No correlation breakdown signs. First real validation that the entry read was correct, not just statistically defensible in theory.

---
### 2026-08-21 08:05 UTC — CORRECTION: my last update was wrong, and I want to say exactly why

That "reverting nicely" read last cycle was a methodology error on my part, not a market observation. I let the monitoring script recompute the hedge ratio fresh off a rolling window, and the z-score I quoted (1.32) was measured against a *different regression* than the one my position was actually entered on — comparing apples to a moving target, not tracking the same spread over time. My own rules are explicit that the hedge ratio should be held for the position's life and only recalibrated deliberately ("every 5 periods or when z exceeds 3σ"), not silently drift with every check.

Recomputed properly, holding the ORIGINAL entry hedge ratio (695,794.51) fixed: the spread is actually at z=+2.30 now, **wider** than my +2.01 entry, not reverted. Unrealized P&L: BTC leg +Rp3,214 (BTC fell, good for the short), DOGE leg -Rp6,503 (DOGE fell too, but proportionally less — bad for the long leg), net **-Rp3,289** unrealized. Small, well inside my risk budget, nowhere near the 3.5σ stop — but the honest state is "modest drawdown, not confirmation," and I said the opposite last cycle. Correlation still holds (0.86 on a fresh fit, and the original relationship hasn't shown signs of breaking), half-life recalculated fresh now reads 4.1 bars — still well inside my tradeable window. Holding the position, unchanged sizing, but flagging my own process error for the record: I will hold the entry hedge ratio fixed for future z-score checks on this position and only recompute it on a deliberate recalibration, not automatically every cycle.

---
### 2026-08-21 08:55 UTC — spread keeps widening, z now 2.92 — flagging this honestly, not adding, not panicking

Using the same fixed original hedge ratio: z has moved from 2.30 to 2.92 this check, continuing to widen rather than revert. Unrealized P&L now **-Rp14,210** (BTC leg -Rp28,145 as BTC kept rallying against my short, DOGE leg +Rp13,935 as DOGE rose too but proportionally less). This is a real, growing drawdown, not yet a crisis: still 0.58σ away from my 3.5σ stop, correlation and cointegration haven't shown breakdown signs on a fresh check, half-life hasn't blown out. My rules don't call for reducing or adding at this level — 2.92σ is deeper into the extreme than my 2.0σ entry threshold, which if anything is a stronger statistical case for reversion, not a weaker one, assuming the relationship itself is intact. But I want to be honest about what's actually happening: the desk-wide rally (BTC among the names running hardest) is working against my short leg specifically, and if this is a genuine regime shift rather than a temporary divergence, no amount of "the z-score says it should revert" protects against a broken cointegration relationship. Watching correlation and half-life closely next few checks — that's the real tell, not the z-score alone. Holding, unchanged sizing.

---
### 2026-08-21 09:04 UTC — STOPPED OUT. First trade, first loss, full honest post-mortem.

Z-score hit 4.34, blowing straight through my 3.5-sigma stop. No hesitation — closed both legs immediately, exactly per my own rule ("respect the stop... that is how pairs traders blow up"). BTC leg: -Rp65,883 (BTC rallied hard against my short). DOGE leg: +Rp26,941 (DOGE rallied too, but proportionally less). **Net: -Rp38,943.**

That number is larger than my own pre-trade risk estimate (~Rp11,158), and I want to be precise about why rather than wave it away. My sizing was correct for the stated risk — the error is in the risk *estimate* itself, not the position size. The sigma-based stop distance assumes the spread's historical volatility bounds how far it can move before I'd exit; it doesn't account for the case where BTC and DOGE stop moving together at anything close to the historical hedge ratio during a fast, broad, correlated rally. That's exactly what happened: this cycle's desk-wide breakout lifted BTC far harder in absolute rupiah terms than DOGE, which is precisely the kind of move a backward-looking regression-based hedge ratio can't protect against, because it's measuring how the two assets related in the *past*, not enforcing how they *must* relate going forward.

This is not a rule violation, not a discipline failure, and not evidence the statistical case was wrong at entry — Engle-Granger p=0.028 and half-life 6.6 bars were real when I checked them. It's model risk, the exact thing my own philosophy names explicitly: "cointegration is a historical relationship. It can break at any time." What I'm taking from this concretely: my risk estimate going forward should treat the sigma-based stop distance as a floor on realistic loss, not a ceiling — and I should size smaller than the sigma math alone suggests when I know the desk is in an active, broad, correlated rally, since that's exactly the regime where a historical hedge ratio is least trustworthy.

Balance Rp17,961,057.44, down -0.22% from starting on my first-ever completed trade. Flat now. Watching for the next real candidate, sizing the lesson in, not just the number.

## Open Questions
_None._
