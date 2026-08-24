# Mean Reversion Trader — Briefing Book

## Status
- **Hired:** 2026-07-13

## Analyses
- **2026-07-13** — Standout candidate: **LTC/USDC RSI 30.0 (oversold)**, price $43.34 sitting on the lower Bollinger band ($43.17) — textbook mean-reversion long setup once funded. Secondary watch: **EURC/USDC RSI 63.9**, price pinned to upper band with bandwidth at 99th percentile (unusually tight range) — fade candidate if it tags the band again. No trades taken — account unfunded ($0 balance).
- **2026-07-13 12:27 UTC (first auto cycle)** — NO SETUP. Re-checked LTC with ADX added: RSI 29.5 (oversold) but ADX is 27.7 — TRENDING, not range-bound. Regime filter (mandatory, ADX<25) rejects the setup — this looks like a shifting mean, not a fadeable extreme. No simulated trade taken.
- **2026-07-13 12:35 UTC (cycle 2)** — NO SETUP, unchanged (MCP still on cached staging data, production reconnect pending).
- **2026-07-13 13:27 UTC (cycle 3, switched to OKX demo feed, 15m loop)** — NO SETUP. RSI14 oversold on all three majors (BTC 27.0, ETH 28.8, SOL 28.7) but ADX14 also above the 25 regime threshold on all three (28.5 / 37.1 / 26.1) — trending, not range-bound. Regime filter rejects the fade on every name. No simulated trade taken.
- **2026-07-13 13:47 UTC (cycle 4)** — NO SETUP. RSI14 has bounced out of oversold on all three (BTC 35.4, ETH 36.5, SOL 34.5) — the extreme that might've qualified is gone, and ADX (31.2/38.8/27.9) still says trending anyway. No simulated trade taken.
- **2026-07-13 14:02 UTC (cycle 5)** — NO SETUP. BTC/ETH data unavailable this cycle (OKX network error). SOL back to oversold (RSI 24.2) but ADX 31.0 still rejects the regime. No simulated trade taken.
- **2026-07-13 14:16 UTC (cycle 6)** — NO SETUP. BTC RSI14 23.6 is deeply oversold but ADX14 31.2 confirms a real trend (this is the same breakdown momentum-trader just shorted) — not a range, regime filter rejects. ETH/SOL back to neutral RSI (39.5/36.5), nothing to fade. No simulated trade taken.
- **2026-07-13 14:31 UTC (cycle 7)** — NO SETUP. BTC RSI14 29.5, ADX14 29.9 — still trending, still rejected. ETH neutral (RSI 39.7). SOL data unavailable this cycle. No simulated trade taken.
- **2026-07-13 14:46 UTC (cycle 8)** — NO SETUP. Nothing oversold anymore — BTC RSI 40.0, ETH RSI 38.5, SOL RSI 43.8, all neutral. No simulated trade taken.
- **2026-07-13 15:01 UTC (cycle 9)** — NO SETUP. ETH RSI 46.2, SOL RSI 49.4 — fully neutral, both bouncing. BTC candles unavailable this cycle. No simulated trade taken.
- **2026-07-13 15:16 UTC (cycle 10)** — NO SETUP. Full reversal: BTC RSI 53.3, ETH 54.2, SOL 54.6 — all bullish-neutral now, nothing oversold to fade. No simulated trade taken.
- **2026-07-13 15:31 UTC (cycle 11)** — NO SETUP. Market has gone fully neutral (RSI 50-52 across the board) — not oversold, not overbought, nothing to fade either direction. ADX cooling toward the regime threshold (BTC 27.1, SOL 25.3) — watching for it to drop under 25 to open up a range-trade setup. No simulated trade taken.
- **2026-07-13 15:46 UTC (cycle 12)** — NO SETUP, but progress: SOL's ADX14 just dropped to 23.8 (<25, first regime qualifier this loop) — however RSI is 54.8, nowhere near an extreme to fade. Need both conditions; watching SOL closely now. No simulated trade taken.
- **2026-07-13 16:01 UTC (cycle 13)** — NO SETUP, but the regime is opening up: BTC ADX14 now 23.5, SOL 21.9 — both under the 25 threshold. Still no RSI extreme though (BTC 43.8, SOL 45.7, both neutral) — need price to actually reach an oversold/overbought band within this new range before there's a fadeable setup. Closest I've been to a real signal this loop. No simulated trade taken.
- **2026-07-13 16:16 UTC (cycle 14)** — NO SETUP. Range regime deepening (BTC ADX 20.7, SOL 20.4, ETH right at 25.2) but RSI still fully neutral everywhere (42.7-47.8) — no extreme to fade. This market is just quiet, not swinging to an edge yet. No simulated trade taken.
- **2026-07-13 16:31 UTC (cycle 15)** — NO SETUP. Regime is now unambiguously range-bound (all three ADX <25: BTC 17.7, ETH 21.1, SOL 18.2) but RSI is still boringly neutral (39.6-48.6) — low realized volatility, nothing swinging to the bands. No simulated trade taken.
- **2026-07-13 16:46 UTC (cycle 16)** — NO SETUP, but the closest yet: BTC RSI14 dropped to 32.2 (my threshold is <30) with ADX confirming range (17.4). Not there yet — needs both RSI<30 AND price at/beyond -2 sigma Bollinger, and I haven't confirmed the Bollinger condition. Watching BTC very closely next cycle; one more push down likely triggers a real long-reversion setup. No simulated trade taken.
- **2026-07-13 17:01 UTC (cycle 17)** — NO SETUP. The dip already reversed — BTC RSI back to 37.8, price ($62,396.80) well inside the Bollinger bands ($62,242.29 to $62,904.04), nowhere near -2 sigma. That setup came and went without confirming. Back to watching. No simulated trade taken.
- **2026-07-13 17:16 UTC (cycle 18)** — NO SETUP. BTC drifted back down (RSI 34.4, price $62,294.60) getting closer to the lower band ($62,197.61) again but still inside it and RSI still above 30. Watching. No simulated trade taken.
- **2026-07-13 17:31 UTC (cycle 19)** — NO SETUP, unchanged. BTC RSI holding at 34.4, price $62,286.70 still inside the bands. No simulated trade taken.
- **2026-07-13 17:46 UTC (cycle 20)** — NO SETUP. BTC RSI 33.9, price $62,218.30 vs lower band $62,115.98 — closer but still inside. Fourth cycle in a row hovering near this threshold without confirming. No simulated trade taken.
- **2026-07-13 18:01 UTC (cycle 21)** — NO SETUP, but the closest yet on SOL: intrabar low $74.61 traded *below* the current lower Bollinger band ($75.00) on 4.29x average volume — the Bollinger condition was technically satisfied intrabar. But it closed back at $75.10, above the band, and closing RSI14 is 32.1 — still above my 30 threshold. Both conditions need to hold at evaluation time, not just intrabar; this doesn't qualify. If SOL revisits this level and closes there, that's my trade. No simulated trade taken.
- **2026-07-13 18:16 UTC (cycle 22)** — NO SETUP, extremely close on all three but none aligned: **BTC** RSI14 29.9 (finally <30!) but price $61,992.30 hasn't reached the lower band ($61,918.89). **ETH** price $1,758.28 is beyond the lower band ($1,758.80) but RSI14 is only 35.1. **SOL** RSI14 30.5 (just above 30) with price $74.75 essentially at the band ($74.72). Both conditions have to hold on the same asset at the same time — none do right now. This is the closest the whole loop has come; if any one of these ticks another notch, I act. No simulated trade taken.
- **2026-07-13 18:31 UTC (cycle 23)** — NO SETUP, and one door just closed: **SOL's ADX crossed above 25 (26.9)** — my regime filter now rejects it outright, oversold RSI (31.2) or not. **BTC** RSI14 dropped to 26.8 (clearly oversold now) but price ($61,933.60) still hasn't reached the lower band ($61,835.31, ~$98 away) and ADX is 22.9 (still eligible). **ETH** price ($1,756.85) is essentially sitting on the band ($1,756.26) but RSI14 is 33.6, not oversold. BTC is now my best remaining candidate — watching for either the price to catch down to the band or ADX to hold under 25. No simulated trade taken.
- **2026-07-13 18:46 UTC (cycle 24)** — NO SETUP. BTC RSI14 26.7 (still deeply oversold) but ADX has crept up to 24.7 — right at my regime threshold — and price ($61,917.60) is still ~$137 above the lower band ($61,780.36). If ADX ticks to 25 next cycle, BTC gets disqualified like SOL did. This window may be closing without ever confirming. No simulated trade taken.
- **2026-07-13 19:01 UTC (cycle 25)** — NO SETUP. Confirmed: BTC's ADX crossed to 25.6 right as RSI recovered to 30.9 — the setup closed without ever triggering, exactly the risk I flagged last cycle. All three names are now either trending (BTC 25.6, SOL 31.8) or non-extreme (ETH RSI 39.9) — zero candidates for the first time in a while. This whole episode (BTC RSI dipping to 26.7 and climbing back without ever meeting the Bollinger condition) is a clean example of my rules correctly avoiding a trade that would have been a coin-flip, not an edge. No simulated trade taken.
- **2026-07-13 19:16 UTC (cycle 26)** — NO SETUP. Full recovery under way — all RSI back to neutral-ish (33.0/44.3/35.7), no extremes. The episode is over. No simulated trade taken.
- **2026-07-13 19:31 UTC (cycle 27)** — NO SETUP. ETH's ADX has now also crossed 25 (25.6) — all three names are technically trending. Zero candidates on my filter across the whole book. Genuinely nothing to do right now. No simulated trade taken.
- **2026-07-13 19:46 UTC (cycle 28)** — NO SETUP. All three ADX climbing further (30.0/28.7/39.1) — regime firmly trending now, zero candidates. No simulated trade taken.
- **2026-07-13 20:01 UTC (cycle 29)** — NO SETUP. RSI recovering across the board (42.3/51.4/41.4), ADX still elevated (30.0/29.1/39.4). No candidates. No simulated trade taken.
- **2026-07-13 20:16 UTC (cycle 30)** — NO SETUP. Full recovery — RSI 47.3/53.7/45.4, nothing close to extreme. No simulated trade taken.
- **2026-07-13 20:31 UTC (cycle 31)** — NO SETUP, unchanged. RSI 44.0/50.3/43.3, all neutral. No simulated trade taken.
- **2026-07-13 20:46 UTC (cycle 32)** — NO SETUP, unchanged. RSI 45.4/48.2/40.8. No simulated trade taken.
- **2026-07-13 21:01 UTC (cycle 33)** — NO SETUP. RSI 41.9/45.3/35.4 (SOL drifting a bit lower but not extreme), ADX still 25.3-36.7. No simulated trade taken.
- **2026-07-13 21:16 UTC (cycle 34)** — NO SETUP, unchanged. RSI 45.1/45.4/37.3. No simulated trade taken.
- **2026-07-13 21:31 UTC (cycle 35)** — NO SETUP. SOL RSI drifting down to 32.9 but ADX 36.8 (>25) still rejects the regime. No simulated trade taken.
- **2026-07-13 21:46 UTC (cycle 36)** — NO SETUP, but regime reopening: BTC ADX14 back under 25 (24.3), ETH too (23.1) — both back in range-eligible territory. RSI still not extreme (37.4/37.8). SOL remains trending (35.6) and rejected. Watching BTC/ETH closely now. No simulated trade taken.
- **2026-07-13 22:01 UTC (cycle 37)** — NO SETUP. Regime stays open on BTC (ADX14 24.0) and ETH (ADX14 23.1), and RSI has dropped further (BTC 33.6, ETH 34.1) — closer to my <30 threshold but not there yet, and price hasn't reached either lower band ($61,846.76 / $1,752.25 vs last close $61,939.90 / $1,755.33 — both within striking distance now). SOL's RSI14 hit 28.7 (oversold) but ADX14 36.8 keeps it regime-disqualified — the closest miss of the loop on that name. No simulated trade taken.
- **2026-07-13 22:16 UTC (cycle 38)** — NO SETUP. That approach fully reversed — RSI bounced back up on all three (BTC 43.7, ETH 46.1, SOL 36.3), none within range of my thresholds anymore. Regime stays open on BTC/ETH (ADX14 22.4/21.4) but with nothing extreme to act on. Another window closed without triggering. No simulated trade taken.
- **2026-07-13 22:31 UTC (cycle 39)** — NO SETUP, unchanged. RSI continuing to drift neutral (46.2/48.7/39.4), regime still open on BTC/ETH (ADX14 20.6/19.3). No simulated trade taken.
- **2026-07-13 22:46 UTC (cycle 40)** — NO SETUP, unchanged. RSI 46.9/48.6/40.9, volume near-zero (0.09-0.27x avg) — market essentially dormant. No simulated trade taken.
- **2026-07-13 23:01 UTC (cycle 41)** — NO SETUP, unchanged. RSI 42.2/46.6/41.0, still neutral. No simulated trade taken.
- **2026-07-14 00:10 UTC (cycle 42)** — NO DATA. OKX candles and tickers both failed for all three pairs this cycle (full outage, not just one symbol). No evaluation possible. No simulated trade taken.
- **2026-07-14 01:50 UTC (cycle 43)** — NO DATA. OKX still fully down (candles + tickers); Tokocrypto backup not yet loaded (pending session restart). No simulated trade taken.

---
### 2026-07-14 02:00 UTC — LOOP RESTART: OKX → Tokocrypto native API
OKX abandoned after repeated full outages. Data source is now Tokocrypto's native REST API (`tokocrypto.site`), fetched via direct HTTP call. Paper-ledger reset to $1,000. Cycle numbering restarts at 1. Zero trades in the OKX era (4 distinct near-misses where RSI-oversold and Bollinger-band conditions never aligned simultaneously) — that discipline record carries forward unchanged, just on new data.

- **2026-07-14 02:05 UTC (cycle 1, Tokocrypto)** — NO SETUP. All three RSI readings neutral (BTC 59.9, ETH 60.3, SOL 53.0) — none close to my 30/70 extremes, so the Bollinger/ADX conditions don't even need checking. No simulated trade taken.
- **2026-07-14 02:20 UTC (cycle 2)** — NO SETUP, unchanged. RSI 59.8/60.1/53.5, still neutral. No simulated trade taken.

---
### 2026-07-14 02:45 UTC — LOOP RESTART: Tokocrypto → Indodax (IDR pairs)
Data source switched to Indodax (BTC/IDR, ETH/IDR, SOL/IDR — the USDT pairs there are too illiquid). Ledger reset to Rp18,000,000/book. Cycle numbering restarts at 1.

- **2026-07-14 02:50 UTC (cycle 1, Indodax)** — NO SETUP. All three RSI readings neutral (BTC 54.8, ETH 55.1, SOL 47.1) — none near my 30/70 extremes. No simulated trade taken.

- **2026-07-14 03:15 UTC (cycle 2, universe expanded to 8 pairs)** — NO SETUP. All 8 RSI readings neutral (BTC 48.9, ETH 49.5, SOL 41.4, XRP 42.0, DOGE 46.8, PEPE 45.9, SUI 44.5, BNB 48.0) — none near my 30/70 extremes despite two of them (BTC, XRP) having notable volume spikes. No simulated trade taken.
- **2026-07-14 03:30 UTC (cycle 3)** — NO SETUP, unchanged. RSI 49.1/52.4/45.5/42.3/39.1/47.1/50.4/47.8 across the 8 pairs — all neutral. No simulated trade taken.
- **2026-07-14 03:45 UTC (cycle 4)** — NO SETUP. Despite the SOL/XRP volume spikes, neither RSI moved to an extreme (46.5, 46.7) — volume without a directional price move doesn't help me. No simulated trade taken.
- **2026-07-14 04:00 UTC (cycle 5)** — NO SETUP, unchanged. All 8 RSI readings neutral (46.5-54.3 range). No simulated trade taken.
- **2026-07-14 04:15 UTC (cycle 6)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 04:30 UTC (cycle 7)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 04:45 UTC (cycle 8)** — NO SETUP. BTC's RSI14 hit 64.4 (its highest of the loop) but that's nowhere near my 70 overbought threshold — momentum-trader's breakout long doesn't overlap with my mean-reversion filter. No simulated trade taken.
- **2026-07-14 05:00 UTC (cycle 9)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 05:15 UTC (cycle 10)** — NO SETUP. BNB's volume spiked hard (12.25x avg) but RSI14 only 55.5, nowhere near extreme, and ADX14 just 12.4 keeps it out of a real trend anyway. No simulated trade taken.
- **2026-07-14 05:30 UTC (cycle 11)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 05:45 UTC (cycle 12)** — NO SETUP. ETH's volume spiked hard (10.96x avg, the sharpest of the loop) but RSI14 only 56.7 and ADX14 just 16.9 — nowhere near my thresholds. No simulated trade taken.
- **2026-07-14 06:00 UTC (cycle 13)** — NO SETUP, unchanged. No simulated trade taken.
- **2026-07-14 06:15 UTC (cycle 14)** — NO SETUP. BTC's pullback (RSI14 46.7) still nowhere near my 30 threshold. No simulated trade taken.
- **2026-07-14 09:00 UTC (cycle 15)** — NO SETUP. PEPE and SUI both trending strongly (ADX 37.4, 30.4) but neither RSI is near my 30/70 extremes (60.6, 58.1) — momentum territory, not mine. No simulated trade taken.
- **2026-07-14 09:15 UTC (cycle 16)** — NO SETUP. PEPE's RSI14 dropped to 42.9 on that huge volume bar — closer to oversold but still nowhere near my 30 threshold, and ADX14 32.2 (>25) would disqualify it on the regime filter anyway. No simulated trade taken.
- **2026-07-15 01:05 UTC (cycle 18, loop resumed after session gap + roster/pipeline upgrade)** — NO SETUP, unchanged. RSI14 across all 8 pairs sits in a tight 44.4-57.6 band — nowhere near either extreme. DOGE/SUI/BNB do have the range regime I want (ADX14 14-18), but their RSI is also neutral (49-53), so the regime condition and the extreme condition aren't lining up on any name. No simulated trade taken.
- **2026-07-15 03:50 UTC (cycle 20)** — NO SETUP. Widest RSI spread of the loop so far — SUI dropped to 39.65 (closest to oversold yet, still well above my 30 threshold) while regime stays range-bound (ADX14 13.4). BNB's ADX exploded to 61.6 (firmly trending, disqualifying it from my regime filter regardless of RSI). No pair has both conditions. Watching SUI in case RSI keeps falling while ADX stays under 25. No simulated trade taken.
- **2026-07-15 04:03 UTC (cycle 21)** — NO SETUP. SUI's RSI bounced back to 48.58 — the near-miss from last cycle already resolved without confirming, exactly the base rate I'd expect. Nothing else close: RSI range across the basket is 44.5-57.7, ADX ranges from 12.9 (SOL) to 67.1 (BNB, firmly disqualified). No simulated trade taken.
- **2026-07-15 04:18 UTC (cycle 22)** — NO SETUP. BNB's sharp reversal dropped its RSI14 to 41.5 — a real move, but nowhere near my 30 threshold, and its ADX14 (70.1) is the most disqualifying regime reading possible for a mean-reversion entry. Everything else stayed in its familiar neutral band. No simulated trade taken.
- **2026-07-15 06:25 UTC (cycle 23, consolidated catch-up)** — NO SETUP. The desk's big event this window was SOL's breakout (momentum-trader and jesse-livermore both entered) — but that's a trend move with ADX14 now 26.65, the opposite regime from what I trade. ETH's RSI14 got closest to overbought at 68.09, just short of my 70 threshold, and its ADX14 (16.5) would have qualified the regime — a real near-miss, but not confirmed. No simulated trade taken.
- **2026-07-15 06:47 UTC (cycle 24)** — NO SETUP. DOGE's RSI14 climbed to 69.19 — the closest anyone's gotten to my 70 threshold all loop — with ADX14 16.4 (range regime, would qualify). One more tick and this would be a real setup; still watching, still not there. No simulated trade taken.
- **2026-07-15 07:02 UTC (cycle 25)** — NO SETUP. DOGE's near-miss reverted (RSI14 back to 59.74) — resolved without confirming, as expected. Everything basket-wide is back in the 49-60 neutral band. No simulated trade taken.
- **2026-07-15 07:16 UTC (cycle 26)** — NO SETUP. Quietest reading of the loop — RSI14 45.4-55.2 across all 8 pairs, nothing anywhere near an extreme. No simulated trade taken.
- **2026-07-15 07:31 UTC (cycle 27)** — NO SETUP. Basket drifted lower (RSI14 40-49) but still nowhere near my 30 threshold. DOGE's 9.23x volume spike is a genuine tape event, but paired with a neutral RSI (49.6) it's not my setup either. No simulated trade taken.
- **2026-07-15 07:46 UTC (cycle 28)** — NO SETUP. PEPE's RSI14 dropped to 39.0, the closest to my 30 threshold this cycle, but its ADX14 (26.0) has crossed into trending territory — disqualified by my own regime filter even as the RSI moves my way. No simulated trade taken.
- **2026-07-15 08:02 UTC (cycle 29)** — NO SETUP. PEPE's massive volume bar bounced RSI14 back up to 44.5 — the extreme I was watching for already faded before it reached my 30 threshold. No simulated trade taken.
- **2026-07-15 08:16 UTC (cycle 30)** — NO SETUP. BNB's RSI14 dropped to 39.4, PEPE back to 40.8 — both drifting my way but neither close to 30, and BNB's ADX14 (76.3) remains the single most disqualifying regime reading on the desk. No simulated trade taken.
- **2026-07-15 08:31 UTC (cycle 31)** — NO SETUP. Basket mostly neutral to mildly bullish (RSI14 43-55) except BNB (39.7, still trending hard per ADX). No simulated trade taken.
- **2026-07-15 08:46 UTC (cycle 32)** — NO SETUP. BNB broke its support and RSI14 dropped to 39.1 — but ADX14 (75.4) remains the most extreme trend reading on the desk, so this stays firmly outside my range-only mandate regardless of the RSI level. No simulated trade taken.
- **2026-07-15 09:01 UTC (cycle 33)** — NO SETUP. BNB's RSI14 (38.6) still nowhere near 30, and ADX14 (77.2) is now the highest reading yet — this name remains completely off-limits for my strategy no matter how the price action develops. No simulated trade taken.
- **2026-07-16 01:23 UTC (cycle 34, after overnight gap)** — NO SETUP, but the closest real candidate of the loop: SOL's RSI14 dropped to 34.87 (closest to my 30 threshold ever recorded) with ADX14 16.24 — a genuine range regime, both conditions finally converging in the right direction even if not quite there yet. Also worth noting: BNB's ADX14 collapsed from 77 to 11.8 overnight as it rallied — its regime finally opened up to my strategy, but RSI14 (69.2) is nowhere near overbought enough to act. No simulated trade taken.
- **2026-07-16 01:26 UTC (cycle 35)** — same closed candle as cycle 34, SOL's RSI14 still 34.87. No simulated trade taken.
- **2026-07-16 01:31 UTC (cycle 36)** — NO SETUP. SOL's RSI14 eased slightly to 34.69, still my closest candidate, ADX14 16.1 keeps the range regime intact. SUI also worth noting: RSI14 38.9 with ADX14 18.2 — a second range-regime name drifting toward oversold. Neither at 30 yet. No simulated trade taken.
- **2026-07-16 01:46 UTC (cycle 37)** — NO SETUP. SOL's RSI14 ticked up to 35.94, moving away from my threshold rather than toward it. SUI's huge volume bar didn't move its RSI14 much (43.5) — confirms it was an absorption event, not a directional extreme. No simulated trade taken.
- **2026-07-16 02:10 UTC (cycle 38)** — NO SETUP. Basket back to neutral across the board (RSI14 42-55). No simulated trade taken.
- **2026-07-16 02:16 UTC (cycle 40)** — NO SETUP. Still neutral across the board (RSI14 42-57). No simulated trade taken.
- **2026-07-16 02:31 UTC (cycle 41)** — NO SETUP. Basket still neutral (RSI14 41-59). No simulated trade taken.
- **2026-07-16 02:46 UTC (cycle 42)** — NO SETUP, but BNB is now my closest candidate yet: RSI14 dropped to 35.98, close (Rp10,426,703) sitting just Rp482 above its 20-bar support (Rp10,426,221), and ADX14 (19.96) keeps it inside my range-regime filter for the first time in many cycles — this name has been trending too hard to touch for most of the loop. If RSI14 crosses below 30 while ADX stays under 25, this is a real setup. No simulated trade taken.
- **2026-07-16 03:01 UTC (cycle 43)** — NO SETUP. BNB already bounced back (RSI14 54.87) — that near-miss resolved without confirming, same base rate as every other one this loop. SUI's RSI14 jumped to 62.5, the opposite extreme, but ADX14 (14.55) would qualify the regime if it kept climbing toward 70. No simulated trade taken.
- **2026-07-16 03:16 UTC (cycle 44)** — NO SETUP. SUI's RSI14 held near 62.5, still well short of 70. BNB's ADX14 just crossed above 25 (25.60), disqualifying it from my range-only mandate again. No simulated trade taken.
- **2026-07-16 03:31 UTC (cycle 45)** — NO SETUP. SUI's huge-volume rejection at resistance didn't push RSI14 into overbought (61.6, barely moved) — a real price event that my indicator didn't register as extreme. No simulated trade taken.
- **2026-07-16 03:46 UTC (cycle 46)** — NO SETUP. SUI's RSI14 ticked up to 63.3, still nowhere near 70. No simulated trade taken.
- **2026-07-16 04:01 UTC (cycle 47)** — NO SETUP. SOL's RSI14 dropped to 38.62 on real volume, but its ADX14 (29.86) just crossed into trending territory — disqualified from my regime right as the RSI moved my way, same pattern that's happened on other names all loop. No simulated trade taken.
- **2026-07-16 04:16 UTC (cycle 48)** — NO SETUP. SOL's RSI14 recovered to 40.4, ADX14 still 29.5 — well outside my range mandate either way. No simulated trade taken.
- **2026-07-16 04:31 UTC (cycle 49)** — NO SETUP. SOL's RSI14 dropped to 37.8, getting closer to my threshold, but ADX14 (26.98) still confirms a trend, not a range — still disqualified. No simulated trade taken.
- **2026-07-16 04:46 UTC (cycle 50)** — NO SETUP. Basket neutral, nothing close. No simulated trade taken.
- **2026-07-16 05:01 UTC (cycle 51)** — NO SETUP. SOL's RSI14 dropped to 32.89 — closest to my 30 threshold of the entire loop — but ADX14 (27.13) confirms a real trend, not a range, so it's momentum-trader's setup, not mine. No simulated trade taken.
- **2026-07-16 05:46 UTC (cycle 52)** — NO SETUP. SOL's near-oversold reading fully reversed — RSI14 back to 53.9 after the rally. My regime filter correctly kept me out regardless, since ADX14 never dropped into range territory. No simulated trade taken.
- **2026-07-16 06:01 UTC (cycle 53)** — NO SETUP. Basket neutral across the board. No simulated trade taken.
- **2026-07-16 06:16 UTC (cycle 54)** — NO SETUP. Basket still neutral. No simulated trade taken.
- **2026-07-16 06:31 UTC (cycle 55)** — NO SETUP. SOL's RSI14 sits at 50.9 after the resistance rejection — dead neutral, no extreme in either direction. No simulated trade taken.
- **2026-07-16 06:46 UTC (cycle 56)** — NO SETUP. BNB's RSI14 dropped to 39.7 but ADX14 (41.3) is nowhere near my range regime — this stays momentum-trader's territory. PEPE closed below its own support too (RSI14 40.1) but ADX14 (9.55) is genuinely low — worth a look, though RSI isn't near 30 yet either. No simulated trade taken.
- **2026-07-16 07:01 UTC (cycle 57)** — NO SETUP. BNB's RSI14 back to 53.0 after its bounce. Basket neutral. No simulated trade taken.
- **2026-07-16 07:16 UTC (cycle 58)** — NO SETUP. Basket neutral, nothing close. No simulated trade taken.

---
### 2026-07-16 07:32 UTC (cycle 59) — TRADE: first entry of the entire loop, BTC/IDR long
**OPENED.** After 59 cycles of watching, I finally got all three of my conditions at once: **range regime** (ADX14 18.91, comfortably under my 25 ceiling), **statistical extreme** (RSI14 26.18, price closed below the lower Bollinger band, z-score -3.44 — deep into "rare extreme" territory), and **no regime-change evidence** (volume on the decline was only 0.28x average — this is a stretch, not smart money driving a real breakdown). This is exactly the setup I exist for.

Being honest about the mechanics: this desk samples every 15 minutes, and price fell straight through my -2.0, -2.5, and -3.0 sigma trigger levels between checks rather than pausing at each one. So instead of three sequential grid fills, I'm logging one blended entry at the depth I actually found it — Rp1,162,530,000, z-score -3.44.

Sizing: my own formula (position size = risk budget ÷ distance to stop) wanted a position far bigger than my entire book, since the remaining distance to my -4.0-sigma stop is small relative to the risk budget — so the binding constraint was max_position_size_pct, which the user raised to 100% two days ago. Full book deployed: 0.0154835 BTC (Rp18,000,000 notional). Stop at -4.0 sigma (Rp1,161,895,324) — actual risk at this size is only ~Rp9,827, trivial. Targets: 50% at -0.5 sigma (Rp1,165,854,766), 50% at the mean (Rp1,166,420,400) — R:R to the mean is roughly 6.1:1.

I want to flag the size honestly: deploying 100% of my book on one trade is a meaningfully different risk posture than anything this desk has done before (prior trades this loop were capped at 5-10% of a book). The setup itself is textbook by my own rules, but the position is large purely because the risk-based formula and the notional cap interact differently now that the cap is gone. Watching closely for either target hit or the stop.

---
### 2026-07-16 07:46 UTC (cycle 60) — STOPPED OUT, and I need to be honest about why I was wrong
**Closed at Rp1,156,059,000 (the bar's low, my conservative slippage assumption), realized loss -Rp100,194.** My stop at Rp1,161,895,324 did not hold cleanly — the 07:30 bar gapped straight through it to a low Rp5,836,324 (0.50%) further down, on volume 4.65x average. That volume number is the whole story: I read the *entry* volume (0.28x) as evidence this was a stretch, not a real breakdown. I did not — could not, from a single 15-minute snapshot — see that the very next bar would bring 4.65x volume on BTC and 2.1x-5.8x volume across ETH, SOL, XRP, DOGE, and PEPE simultaneously. That is not an isolated statistical overshoot reverting to its mean. That is the mean itself moving — a correlated, high-volume, market-wide decline, exactly the regime-change scenario my own rules exist to warn against ("mean reversion fails when the mean itself shifts... recognize the difference or get destroyed"). I recognized it one cycle too late.

**On the sizing**: this loss is 10.2x larger than the ~Rp9,827 I planned at entry, purely because the position was sized at 100% of book against a stop that assumed clean, orderly execution. The stop-loss requirement did its job — it triggered, and the loss was capped in the sense that I didn't ride the decline further — but it did not cap the loss at the *planned* amount, because a stop-loss order can only control where you try to exit, not what price you actually get when the market moves faster than the order can fill. This is the difference between "risk-based sizing" and "downside protection" that I should have weighted more heavily before deploying the full book: risk-based sizing controls *planned* risk assuming clean fills; it says nothing about *execution* risk when the market gaps. At 5-10% position sizing (the old cap), this same gap would have cost roughly 5-10x less in absolute rupiah — a genuinely different risk profile even with the identical percentage move.

**Final tally**: book down from Rp18,000,000 to Rp17,899,806 (-0.56%), desk-wide impact -0.09%. Small in absolute terms. But I want the record to show I take the process failure seriously even though the dollar cost was minor — the next setup this clean might not come with a market crash riding shotgun, and I don't want to relearn this lesson at a larger size next time.

### 2026-07-17 03:15 UTC (cycle 63, after ~17h53m gap) — nothing near an extreme, on any pair
Gap-scanned the full history since cycle 62 — no violent moves missed (largest range 3.74% on ETH), just continued drift. RSI14 has actually normalized back toward neutral everywhere now (40.2-56.5 across all 8 pairs) — nothing close to my 30/70 thresholds, let alone a z-score extreme. The whole desk has cooled off from the crash two cycles ago rather than producing a fresh dislocation. No trade, no setup anywhere.

### 2026-07-16 09:22 UTC (cycle 62) — same closed candle, no change
Same last-closed bar as cycle 61. BTC/ETH still oversold on RSI but ADX still confirms trend, not range — same correct decline, no new information. No trade.

### 2026-07-16 09:18 UTC (cycle 61) — the lesson gets applied immediately, and it's an easy call this time
BTC (RSI14 25.4) and ETH (RSI14 25.7) are both back under my 30 oversold threshold — on the surface, the same trigger that got me into last cycle's losing trade. But this time the second gate makes the decision trivial: **ADX14 is 36.3 on BTC and 41.1 on ETH — both miles above my 25 range-regime ceiling, and actually higher than the 18.91 reading that let the BTC trade through last time.** This isn't a stretched range bound by an overextended move, it's a confirmed, accelerating downtrend across the board (SOL, DOGE, PEPE, SUI, BNB all show the same ADX>25 pattern per momentum-trader's scan this cycle). My own framework's exact warning — mean reversion fails when the mean itself is moving — is written all over this data, and this time I don't need hindsight to see it; the ADX reading makes it obvious in real time. No trade, on any pair. This is the version of discipline that cycle 59-60 should have produced the first time; glad to see the rule holding now that the market is giving me an unambiguous test of it.

### 2026-07-20 03:00 UTC (cycle 64, after ~3-day gap) — market recovered, nothing near an extreme
Gap-scanned the ~72h since cycle 63 — no violent single moves, just a broad recovery off the cycle-60/61 lows (every pair up 0.4-4.9% over the gap except BNB, roughly flat). RSI14 now sits 53-63 across the board — comfortably neutral-to-mildly-overbought, nothing close to my 30/70 thresholds. ADX has cooled under 25 on 6 of 8 pairs too, so even the range-regime gate isn't the constraint right now — there's simply no statistical extreme anywhere to act on. No trade.

### 2026-07-20 04:00 UTC (cycle 65, first hourly-cadence cycle) — quiet, nothing extreme
RSI14 sits 45-54 across the entire universe — about as neutral as this desk gets. No trade.

### 2026-07-20 06:00 UTC (cycle 66) — closer, but still no extreme
RSI14 has drifted down toward my thresholds (BTC 32.2, SUI 35.4, closest of the universe) but nothing has actually crossed 30 yet, and ADX14 is genuinely mixed right now (BTC sitting almost exactly at my 25 range/trend boundary) — not a clean range regime I'd want to trade against. No trade. Watching BTC closely; if RSI clears under 30 while ADX stays capped, that's the setup I'd want.

### 2026-07-20 07:00 UTC (cycle 67) — still nothing extreme
RSI14 36-45 across the universe, no extreme, ADX mostly trending now (BTC 36.9, ETH 30.0, XRP 26.4, DOGE 27.0, SUI 27.4 all above my range ceiling) — this is looking more like a real trending move than a range, consistent with jesse-livermore's SUI trade this cycle. Correctly staying out. No trade.

### 2026-07-20 08:00 UTC (cycle 68) — quiet, neutral
RSI14 44-54 across the board, dead center of neutral. No trade.

---
### 2026-08-20 08:25 UTC — TRADE: SHIB/IDR short (first setup under the new architecture), two others correctly declined

Three candidates flagged this cycle, right in the middle of a broad market-wide rally on the desk (BTC/ETH/BNB/DOGE/SUI/ADA all breaking out with real volume elsewhere). That backdrop matters enormously for me — it's exactly the "know when the mean has moved" scenario.

**SHIB/IDR — OPENED short.** Range regime confirmed (ADX14 13.74, comfortably under 25 — nowhere near the borderline zone). Full z-score calc (not just RSI): +2.51 against the 20-period mean, deep-extreme band. Critically: SHIB's own volume on this move is only 0.46x average — no participation surge on this specific pair, meaning it isn't obviously being swept up in the broader move. Sized conservatively: Layer 1 only (25% of full size), not blending Layer 1+2, given the elevated market-wide uncertainty this cycle. Entry 0.086855, stop 0.088022 (+4.0 sigma), targets 0.085274 (+0.5 sigma, 50%) and 0.084882 (mean, 50%). Risk ~Rp60,123.

**XRP/IDR — DECLINED.** RSI14 75.1 and price at the upper Bollinger band looked like a fit mechanically, but ADX14 22.66 sits in my own "borderline 20-25, elevated risk" zone, and this is a name plainly caught in the desk-wide rally. Fading it here is fighting a trend, not fading an extreme.

**PEPE/IDR — DECLINED, for a sharper reason.** ADX14 24.95 — literally on my 25 boundary — and momentum-trader is currently LONG this exact asset on confirmed trend strength. Shorting the same pair a strategy sibling is riding long, into the same rally that's lifting everything else, is precisely the regime-change trap my own rules exist to catch. Passed without hesitation.

---
### 2026-08-21 03:53 UTC — SHIB stopped out, exactly as I warned it might

Consolidated catch-up after a ~19-hour session gap. Reconstructed the SHIB short bar-by-bar: stopped out within 20 minutes of entry, at +4.0 sigma, -Rp60,126. This is the mean-shift risk I flagged explicitly in my own entry note coming true almost immediately — SHIB was genuinely swept up in the same broad rally lifting BTC/ETH/BNB/DOGE/SUI/ADA that cycle, not an isolated overbought extreme after all. I'm not treating this as a bad call: the whole reason I sized Layer 1 only instead of blending in Layer 2 was specifically to keep a wrong read like this small, and it did exactly that. Balance Rp17,839,679.72. Flat again, watching for the next genuinely isolated extreme rather than one riding a broader move.

---
### 2026-08-20 08:40 UTC — SHIB moving against me, UNI declined on data quality
**SHIB/IDR — HOLDING, watching closely, not adding.** Price has moved up since entry (0.086855 → 0.087762 high this cycle), toward my stop at 0.088022 — only ~0.3% away now. Recomputed the z-score fresh: still 2.30 (deep-extreme band, thesis technically intact), but the 20-period mean itself has drifted up (0.08488 at entry → 0.08506 now). That's worth naming honestly against my own rule #6: "know when the mean has moved." I'm treating this as early warning, not yet confirmation — the mean shift is small so far, and I sized Layer 1 only specifically so a move like this wouldn't force a bad decision. Not adding a Layer 2 here even though price is technically deeper into the extreme, because the reason to add (a fresh, isolated extreme) isn't what's happening — the reason for the move (a broad rally) is exactly what I already flagged as disqualifying for new entries. If the stop is hit next cycle, that's the discipline working as designed, not a failure.

**UNI/IDR — DECLINED, data quality.** RSI14 71.1 and z-score 2.87 look like a textbook setup, but the raw tape shows 4 of the last 8 bars with zero volume and 6 of 8 flat OHLC — this pair is barely trading on this timeframe. Same read jesse-livermore and breakout-specialist have both already flagged on TON. Not trusting a statistical extreme computed on a series this thin.

---
### 2026-08-21 07:32 UTC — UNI declined again, same reason, now worse

Flagged a second time: RSI14 70.9, ADX14 18.0, volume 0.12x average (the lowest own-pair volume reading I've seen — normally a point in favor of "no regime change," but the underlying data quality here is now 5 of 8 bars zero-volume and 8 of 8 flat OHLC — worse than last time, not better. This isn't a statistical extreme I can trust; it's a pair barely trading at all on this timeframe. Declined again, consistent with the prior read.

---
### 2026-08-21 07:50 UTC — TRADE: LTC/IDR short, first setup since the SHIB stop-out

**LTC/IDR — OPENED short.** Range regime confirmed (ADX14 13.55) — and this is the distinction that matters right now: SOL/DOGE/SUI/ADA/ETH/LINK/SHIB are all trending together in the desk's current rally, but LTC's own ADX says it genuinely isn't part of that move, the opposite situation from XRP and PEPE (which I declined earlier for being borderline-trending and swept up in the same rally). Z-score +2.93 against the 20-period mean, RSI14 73.25, price at the upper Bollinger band. Volume 1.32x — right at the edge, not a clean read either way, so I weighted the ADX distinction more heavily. Sized Layer 1 only again (25% of full size) — still only one trade past the SHIB lesson, staying conservative until I've validated this approach holds up more than once. Entry 874,000, stop 880,289.30 (+4σ), risk ~Rp32,094. Targets: 50% at 859,736.16 (+0.5σ), 50% at the mean (856,800).

---
### 2026-08-21 08:05 UTC — LINK declined (the exact conflict I watch for), UNI declined again, and jesse-livermore just took the other side of my LTC trade

**LINK/IDR — DECLINED.** RSI14 73.2 and upper-band touch look like a fit, ADX14 18.6 is more ambiguous than LTC's clean 13.55 — closer to my borderline zone. More decisively: jesse-livermore is holding a live LONG on this exact pair right now, entered on a real 7x-volume pivot break. Shorting into a position a strategy sibling just took on real volume confirmation is precisely the regime-sweep trap I exist to avoid, even with ADX reading more ambiguous than usual. Declined.

**UNI/IDR — DECLINED, data quality, still deteriorating.** 5 straight bars flat at the exact same price with zero volume, then a discontinuous jump. Not a market I can trust a statistical read on.

**Worth noting**: jesse-livermore opened a LONG on LTC — the exact pair I'm short — one cycle after my entry, on a volume-confirmed pivot break. I'm not treating this as a reason to second-guess my own trade (different frameworks, different evidence bars, and I looked at the same tape before deciding), but it's the first time this loop a sibling has taken the literal opposite side of one of my open positions. Watching how this resolves with real interest — it's a genuine test of whether my range read or their trend read is right, on the same asset, at the same time.

---
### 2026-08-21 08:19 UTC — the LTC test resolved, against me — and UNI declined again

**LTC/IDR stopped out.** jesse-livermore's trend read won this round: RSI kept climbing (73.25 at my entry → 80.95 at the stop) and price never reverted, it just kept running. -Rp32,094, the pre-committed risk, no more. Full accounting is in my trade log — the short version: I read this as an isolated range extreme because ADX (13.55) said range-bound, but the trend was real, my indicator just hadn't caught up to it yet. That's now two losses this loop (SHIB, LTC) where the mean genuinely moved out from under me, against two correct declines (XRP, PEPE) where I caught the regime-sweep risk in time. The declines are working; my entries into what I judge as "genuinely isolated" extremes are 0-for-2 so far. Worth tightening that judgment rather than the mechanical rules themselves — both losses had a live, real trend running elsewhere on the desk in the same name (broad rally for SHIB, jesse-livermore's own position for LTC) that I noted but didn't weight heavily enough.

**UNI/IDR — DECLINED again**, unchanged data-quality read (still effectively dead on this timeframe).

Flat now. Small sample, but two real data points either way this loop, and I'd rather learn from both honestly than average them into "roughly working."

## Open Questions
_None._
