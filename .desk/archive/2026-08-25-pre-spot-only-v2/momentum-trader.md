# Momentum Trader — Briefing Book

## Status
- **Hired:** 2026-07-13

## Analyses
- **2026-07-13** — Broad-based momentum is weak/bearish: BTC, ETH, SOL, DOGE, TAO, LTC, USDT all show bearish MACD histograms with only neutral RSI (35-44) — no market has separated far enough from its Bollinger midline to qualify as a momentum breakout. Exception: **AMI/USDC** just crossed MACD bullish with an ATR spike (2.09x avg) — flagged as the one name with real momentum forming. **BONK** and **EURC** also flipped MACD bullish but on low ATR (no confirmation yet). No trades taken — account unfunded ($0 balance).
- **2026-07-13 12:27 UTC (first auto cycle)** — PASS. LTC (ADX 27.7, confirmed downtrend) and EURC (ADX 49.2, strong uptrend) both show real trend strength, but breakout entry requires volume >1.5x average and this staging feed reports zero volume on every candle — can't confirm real participation. No simulated trade taken.
- **2026-07-13 12:35 UTC (cycle 2)** — PASS, unchanged (MCP still on cached staging data, production reconnect pending).
- **2026-07-13 13:27 UTC (cycle 3, switched to OKX demo feed, 15m loop)** — PASS. Real ADX confirms a genuine trend on all three majors (BTC 28.5, ETH 37.1, SOL 26.1), but the latest 15m bar's volume (BTC 125.8) isn't a clear outlier vs the session's own spikes (up to 336.8) — no >1.5x-average breakout thrust to confirm fresh participation. No simulated trade taken; watching for a volume thrust to short the trend.
- **2026-07-13 13:47 UTC (cycle 4)** — PASS. ADX still confirms trend (BTC 31.2, ETH 38.8, SOL 27.9) but latest bar volume (BTC 25.4) is well below average, not a breakout spike. No simulated trade taken.
- **2026-07-13 14:02 UTC (cycle 5)** — PASS. OKX candles/ticker for BTC and ETH failed (network error, retried once) this cycle — only SOL data available (ADX 31.0, no volume spike). Not enough for a desk-wide read. No simulated trade taken.
- **2026-07-13 14:16 UTC (cycle 6)** — **BREAKOUT SHORT ENTERED on BTC-USDT.** All criteria met: ADX14 31.2 (downtrend confirmed), RSI14 23.6 (momentum present, still >20), breakdown candle volume 2.23x the 20-period average, fresh 12.5h low taken out. Entry $62,333.40, stop $62,684.88 (2x ATR14 = $351.48), target1 $61,630.44 (2R), target2 $61,278.96 (3R). Risk-manager capped size at 10% of book ($100 notional); took 50% of that (0.0008 BTC, ~$50) per pyramiding rule — will add the other 50% at +1R if the trend holds. First real trade of the loop.
- **2026-07-13 14:31 UTC (cycle 7)** — HOLDING BTC-USDT short. Price bounced to $62,401.70 (small unrealized loss, -$0.05) but no exit trigger: stop ($62,684.88) not hit, ADX still 29.9 (>25, trend intact), volume back near average (1.09x) — a pullback, not a reversal. No add yet (need price at/below $61,981.92 for +1R). SOL data unavailable this cycle.
- **2026-07-13 14:46 UTC (cycle 8)** — BTC short: price bounced further to $62,582.60 (unrealized -$0.20), getting closer to stop ($62,684.88) but not hit — holding per rules, not moving the stop, not exiting on a hunch. **NEW: BREAKOUT SHORT ENTERED on ETH-USDT.** ADX14 38.9, RSI14 38.5, breakdown candle volume 4.48x average (biggest spike this loop), fresh session low. Entry $1,772.42, stop $1,785.40 (2x ATR), target1 $1,746.46 (2R), target2 $1,733.48 (3R). 50% initial size (0.0282 ETH, ~$50). Combined BTC+ETH exposure now ~10% of my book.
- **2026-07-13 15:01 UTC (cycle 9)** — Both shorts under pressure but neither stopped: BTC candles failed this cycle (network error), ticker shows last $62,658.80 vs stop $62,684.88 — within ~$26, very close. ETH at $1,776.99 vs stop $1,785.40, RSI back to neutral (46.2), still 2.0x volume on the bounce — the counter-move has real participation, not just drift. Holding both per rules; no stop hit, no add trigger, no exit signal. Combined unrealized: -$0.39.
- **2026-07-13 15:16 UTC (cycle 10)** — **STOPPED OUT on BTC-USDT.** Prior candle traded up to $62,801.10, through my $62,684.88 stop — closed at the stop, no exceptions, no hoping. Realized: -$0.28, exactly the planned risk on this trade, nothing more. RSI has fully flipped (23.6→53.3) — the trend I shorted is over; this is what cutting losers fast looks like. ETH short still open, now at $1,782.50 (unrealized -$0.28), stop $1,785.40 — very close, within $2.90. If ETH's trend has also turned (its RSI is now 54.2, same pattern as BTC), I expect this one to stop out too next cycle. No shame in two small losses — this is exactly the "many small losses, let winners run" math working as designed.
- **2026-07-13 15:31 UTC (cycle 11)** — HOLDING ETH-USDT short. Good news: price pulled back to $1,777.99 (from $1,782.50), away from the $1,785.40 stop — unrealized loss eased to -$0.16. The bounce's own volume dried up (0.41x average) on this retracement, which is reassuring — no conviction behind the pullback-against-my-position. ADX still 34.1 (trend intact). Holding.
- **2026-07-13 15:46 UTC (cycle 12)** — **STOPPED OUT on ETH-USDT.** Candle traded up to $1,786.49, through my $1,785.40 stop. Same story as BTC: RSI flipped from 38.5 at entry to 55.1 now — the trend genuinely reversed. Closed, realized -$0.37, exactly the planned risk. Flat now on both names, no open positions. Cycle P&L for this loop so far: -$0.65 total (BTC -$0.28, ETH -$0.37) on a $1,000 book. Both trades met every entry rule at the time; the market just turned right after. Nothing this cycle qualifies for a new entry — no volume-confirmed breakout on any of BTC/ETH/SOL, all showing sub-average volume (0.49-0.57x) on the last completed bar. Standing aside.
- **2026-07-13 16:01 UTC (cycle 13)** — PASS. Still flat, no positions. Volume continues sub-average across the board (0.52-0.73x) — no breakout confirmation anywhere. Standing aside.
- **2026-07-13 16:16 UTC (cycle 14)** — PASS. Still flat. Volumes even lower now (0.38-0.80x). Genuinely quiet tape — no forcing trades here. Standing aside.
- **2026-07-13 16:31 UTC (cycle 15)** — PASS. ADX has dropped further across the board (BTC 17.7, ETH 21.1, SOL 18.2) — a full range regime now, exactly the "no trend, no trade" condition I sit out for. Standing aside.
- **2026-07-13 16:46 UTC (cycle 16)** — PASS. BTC dropped again (RSI 32.2) with volume back above average (1.55x) — tempting, but ADX is only 17.4, no real trend behind this move. This is mean-reversion-trader's setup, not mine. Standing aside.
- **2026-07-13 17:01 UTC (cycle 17)** — PASS. BTC already bounced back (RSI 37.8), ADX even lower now (15.0/18.0/17.6 across the board) — the quietest this tape has been all loop. Standing aside.
- **2026-07-13 17:16 UTC (cycle 18)** — PASS. ADX at fresh lows (14.7/15.3/17.6). No breakout conditions anywhere. Standing aside.
- **2026-07-13 17:31 UTC (cycle 19)** — PASS. ADX at new lows (14.1/14.0/15.3), volume drying up further. Standing aside.
- **2026-07-13 17:46 UTC (cycle 20)** — PASS. No change to the flat, low-volume regime. Standing aside.
- **2026-07-13 18:01 UTC (cycle 21)** — PASS. SOL just printed a huge volume spike (4.29x average) with a sharp drop (intrabar low $74.61), and BTC/ETH also picked up volume (1.35x/1.90x). Tempting, but ADX is still low everywhere (18.3/13.6/19.0) — no confirmed trend, and the SOL move already reverted most of the way by close ($75.10). This reads as a liquidation/sweep, not a breakout. Standing aside.
- **2026-07-13 18:16 UTC (cycle 22)** — PASS. The selloff continued and got real volume confirmation this time (ETH 3.08x avg, SOL 3.68x avg) — but ADX still hasn't caught up (21.0/16.6/22.5, all <25). ADX lags price by design; if it crosses 25 next cycle with this move intact, that's a real signal. Not yet. Standing aside.
- **2026-07-13 18:31 UTC (cycle 23)** — PASS. SOL's ADX crossed 25 (26.9) — first confirmed trend of the loop — but the most recent full candle is a small bounce ($74.59→$74.75), not a fresh breakdown. No breakout candle to enter on; the move already happened before ADX caught up, which is exactly the lag problem I flagged last cycle. Standing aside, watching for a fresh leg down with volume to re-enter this trend.
- **2026-07-13 18:46 UTC (cycle 24)** — PASS. SOL's ADX now solidly trending (29.3) with volume still elevated (2.24x), but again the most recent full candle is a small bounce, not a fresh breakdown leg. Still no entry candle. Standing aside.
- **2026-07-13 19:01 UTC (cycle 25)** — PASS. BTC's ADX also crossed 25 (25.6) now — both BTC and SOL are technically trending by the numbers, but volume just collapsed on the latest bars (0.21x/0.36x/0.53x avg) — no fresh participation to confirm either as a real breakout. Standing aside.
- **2026-07-13 19:16 UTC (cycle 26)** — PASS. Market fully back into recovery mode, volumes still thin (0.23-0.74x avg). Standing aside.
- **2026-07-13 19:31 UTC (cycle 27)** — PASS. All three ADX now above 25 (27.2/25.6/34.9) but volumes have collapsed to the thinnest of the loop (0.16-0.37x avg) — ADX reflects the recent move's persistence, not fresh momentum. No breakout candle to act on. Standing aside.
- **2026-07-13 19:46 UTC (cycle 28)** — PASS. ADX climbing further (30.0/28.7/39.1) but volume still sub-1x everywhere (0.45-0.99x). No confirmed breakout candle. Standing aside.
- **2026-07-13 20:01 UTC (cycle 29)** — PASS. ETH ticked to 1.21x volume but on an up candle within a recovery, not a breakdown — doesn't fit my short setup, and RSI is climbing back to neutral (51.4) which kills the downtrend thesis anyway. Standing aside.
- **2026-07-13 20:16 UTC (cycle 30)** — PASS. Recovery continuing (RSI 47.3/53.7/45.4, fully neutral-to-bullish). No trend to ride in either direction. Standing aside.
- **2026-07-13 20:31 UTC (cycle 31)** — PASS. Volume at the thinnest of the entire loop (0.12-0.49x avg). Dead tape. Standing aside.
- **2026-07-13 20:46 UTC (cycle 32)** — PASS, unchanged. Volume still sub-1x across the board. Standing aside.
- **2026-07-13 21:01 UTC (cycle 33)** — PASS. Volume even thinner (0.16-0.36x). Standing aside.
- **2026-07-13 21:16 UTC (cycle 34)** — PASS, unchanged. Volume near-zero (0.11-0.67x). Standing aside.
- **2026-07-13 21:31 UTC (cycle 35)** — PASS. Market drifting slightly lower on continued thin volume (0.23-0.81x). Standing aside.
- **2026-07-13 21:46 UTC (cycle 36)** — PASS. Continued slow grind down but volume still thin (0.19-0.37x) — no breakout confirmation. Standing aside.
- **2026-07-13 22:01 UTC (cycle 37)** — PASS. SOL's ADX14 (36.8) and RSI14 (28.7, in my 20-50 short band) both fit a breakout short, but breakout-candle volume is only 1.30x the 20-period average — short of my 1.5x confirmation threshold. No breakout candle to act on. Standing aside.
- **2026-07-13 22:16 UTC (cycle 38)** — PASS. SOL still trending (ADX14 36.8) but RSI14 bounced to 36.3 and volume dropped further (0.55x avg) — the breakout window from last cycle closed without confirming. No breakout candle to act on. Standing aside.
- **2026-07-13 22:31 UTC (cycle 39)** — PASS. SOL ADX14 easing (34.3), RSI14 39.4 (out of my short zone's sharper range), volume thin (0.51x). No setup anywhere. Standing aside.
- **2026-07-13 22:46 UTC (cycle 40)** — PASS. Volume at the loop's lowest yet (0.09-0.27x avg). Dead tape. Standing aside.
- **2026-07-13 23:01 UTC (cycle 41)** — PASS, unchanged. Volume still thin (0.14-0.59x). Standing aside.
- **2026-07-14 00:10 UTC (cycle 42)** — NO DATA. OKX full outage this cycle. No simulated trade taken.
- **2026-07-14 01:50 UTC (cycle 43)** — NO DATA. OKX still down; Tokocrypto backup pending session restart. No simulated trade taken.

---
### 2026-07-14 02:00 UTC — LOOP RESTART: OKX → Tokocrypto native API
OKX abandoned after repeated full outages (cycles 42-43). Data source is now Tokocrypto's native REST API (`tokocrypto.site`, independent of Binance/OKX), fetched via direct HTTP call. Paper-ledger reset: balance back to $1,000 (prior OKX-era result: -$0.65 net from 2 closed trades, both rules-compliant stop-outs — see above for full history). Cycle numbering restarts at 1 for this new data source. Risk-manager confirms risk_per_trade_pct stays at 2% of my own book ($20 budget per trade at $1,000 equity).

- **2026-07-14 02:05 UTC (cycle 1, Tokocrypto)** — PASS. ETH's ADX14 26.4 (>25) with RSI14 60.3 (in my 50-80 long band) is close to a breakout setup, but volume is only 0.74x the 20-period average — well short of my 1.5x confirmation threshold. BTC/SOL both range-bound (ADX <20). No breakout candle to act on. Standing aside.
- **2026-07-14 02:20 UTC (cycle 2)** — PASS. Same ETH setup, volume dropped further (0.47x avg). No breakout candle to act on. Standing aside.

---
### 2026-07-14 02:45 UTC — LOOP RESTART: Tokocrypto → Indodax (IDR pairs)
Tokocrypto became unreachable after a short working period. Switched to Indodax — but its USDT pairs are too illiquid for technical signals (mostly flat candles), so the universe is now BTC/IDR, ETH/IDR, SOL/IDR. Ledger reset to Rp18,000,000 per book (≈$996 at the reset-time USDT/IDR rate of 18,074). Cycle numbering restarts at 1. Risk-manager confirms risk_per_trade_pct stays 2% of my own book (now Rp360,000 budget per trade at Rp18,000,000 equity).

- **2026-07-14 02:50 UTC (cycle 1, Indodax)** — PASS. BTC's ADX14 30.1 (>25) with RSI14 54.8 (in my 50-80 long band) is a partial fit, but breakout-candle volume is only 0.33x the 20-period average — far short of my 1.5x confirmation threshold. ETH/SOL not in a trend regime worth acting on. Standing aside.

- **2026-07-14 03:15 UTC (cycle 2, universe expanded to 8 pairs: BTC/ETH/SOL/XRP/DOGE/PEPE/SUI/BNB — IDR)** — PASS, but a genuine near-miss: BTC's last closed 15m bar broke to a fresh low (Rp1,128,000,000) on 2.40x average volume with ADX14 27.0 (>25) and RSI14 48.9 (in my 20-50 short band) — three of four conditions fit a breakout short. But EMA9 (Rp1,129,550,280) is still above EMA21 (Rp1,128,745,417) — bearish trend alignment hasn't confirmed yet, so I'm passing per my own rules. XRP had an even bigger volume spike (8.76x avg) on a breakdown, but its ADX14 is only 15.1 — regime filter rejects it outright. Watching BTC's EMA cross closely next cycle.
- **2026-07-14 03:30 UTC (cycle 3)** — PASS. BTC's ADX14 cooled to 24.4 (back under 25) — that setup has closed without ever confirming. XRP's volume stayed elevated (3.77x avg) but ADX14 still only 17.8. BNB ticked just over my volume threshold (1.54x) but isn't trending (ADX14 18.4). No breakout candle to act on across any of the 8 pairs. Standing aside.
- **2026-07-14 03:45 UTC (cycle 4)** — PASS. SOL and XRP both saw huge volume spikes (8.30x, 10.12x avg) but price stayed inside the existing range on both — no breakout candle, and ADX confirms no trend (10.5, 19.6). This reads as absorption, not a fresh move. BTC's ADX ticked back up to exactly 25.0 but volume is low (0.29x) — no confirmation. Standing aside.
- **2026-07-14 04:00 UTC (cycle 5)** — PASS. BTC's ADX14 confirmed above 25 (25.5) with RSI14 54.3 in my long band, but volume is the thinnest reading yet (0.10x avg) — nowhere near my 1.5x confirmation. No breakout candle anywhere else either. Standing aside.
- **2026-07-14 04:15 UTC (cycle 6)** — PASS. BTC still trending (ADX14 26.3) with RSI14 56.9, volume ticked up slightly (1.04x) but still well short of 1.5x. Fourth consecutive cycle this exact setup fails only on volume confirmation. Standing aside.
- **2026-07-14 04:30 UTC (cycle 7)** — PASS. BTC's trend strengthened further (ADX14 32.2, RSI14 62.2) but volume actually got thinner (0.24x avg, down from 1.04x) — a low-participation grind, not the kind of breakout my rules are built to catch. Fifth straight cycle rejected on the same volume gate. Standing aside.
- **2026-07-14 04:45 UTC (cycle 8)** — **BREAKOUT LONG ENTERED on BTC/IDR.** Everything finally aligned: ADX14 33.2 (>25), RSI14 64.4 (in my 50-80 long band), the 04:30 candle broke above the prior 20-bar resistance (Rp1,133,199,000) reaching a high of Rp1,135,491,000 and closing at Rp1,134,395,000, on volume ~4x the 20-period average — the participation I'd been waiting five cycles for. EMA9 (Rp1,131,922,565) above EMA21 (Rp1,130,275,345) confirms bullish structure. Entered 0.0008 BTC @ Rp1,134,332,000 (50% of my planned size per pyramiding rule — risk-manager capped the full size at 10% of book, the binding constraint here since risk_per_trade_pct's implied size would have been far larger). Stop Rp1,130,165,000 (entry - 2x ATR14), target Rp1,142,666,000 (2:1 R/R). First trade of the Indodax era.
- **2026-07-14 05:00 UTC (cycle 9)** — HOLD BTC/IDR long. Price Rp1,134,011,000, essentially flat vs my Rp1,134,332,000 entry. EMA9 (Rp1,132,288,886) still above EMA21 (Rp1,130,580,674), ADX14 still strong (31.9, well above my 20 exit threshold) — no reversal signal. Not at my +1R add level (Rp1,138,499,000) yet, not near the stop (Rp1,130,165,000). No other pairs qualify. Holding.
- **2026-07-14 05:15 UTC (cycle 10)** — HOLD BTC/IDR long. Price now Rp1,136,032,000, working in my favor (+Rp1,360 unrealized on my 0.0008 BTC size — **correction**: I originally reported this as +Rp1,700,000, which was the raw per-BTC price move, not scaled by my position size; see cycle 12 note). EMA9 (Rp1,133,421,642) still above EMA21 (Rp1,131,262,554), ADX14 33.4. Still short of my +1R add trigger (Rp1,138,499,000) by about Rp2,467,000. Holding, watching for the add.
- **2026-07-14 05:30 UTC (cycle 11)** — HOLD BTC/IDR long. Price essentially flat vs last cycle (Rp1,136,000,000), still +Rp1,334 unrealized on my actual size (**correction**: originally reported as +Rp1,668,000, same per-BTC-vs-position-size error as cycle 10). EMA9/21 still bullish, ADX14 34.5 (strongest yet). Still short of the +1R add level (Rp1,138,499,000). Holding.
- **2026-07-14 05:45 UTC (cycle 12)** — HOLD BTC/IDR long. Price Rp1,135,865,000, +Rp1,226 unrealized (correctly scaled: (1,135,865,000-1,134,332,000) × 0.0008 BTC). ADX14 now 40.6 — strongest reading of the entire loop. EMA9/21 still bullish. Still short of the +1R add level (Rp1,138,499,000). Note: cycles 10-11 above had a units error in my unrealized-P&L commentary (reported the raw IDR-per-BTC price delta instead of multiplying by my 0.0008 BTC position size) — corrected inline above; the actual paper-ledger.json position record was never affected, only my narrative commentary. Holding.
- **2026-07-14 06:00 UTC (cycle 13)** — HOLD BTC/IDR long. Price pulled back slightly to Rp1,134,301,000, -Rp25 unrealized (essentially flat vs my Rp1,134,332,000 entry). EMA9 (Rp1,133,865,326) still above EMA21 (Rp1,132,035,783), ADX14 39.8 (still very strong). No exit trigger — well above stop (Rp1,130,165,000), still short of the +1R add (Rp1,138,499,000). PEPE's ADX14 crossed above 25 for the first time (28.5) with RSI14 59.1 in my long band, but volume is only 0.40x avg — not enough to confirm, watching. Holding BTC.
- **2026-07-14 06:15 UTC (cycle 14)** — **CLOSED BTC/IDR long.** Price fell to Rp1,131,000,000 and EMA9 (Rp1,131,744,921) crossed below EMA21 (Rp1,131,831,700) this bar — a bearish cross against my open long, one of my hard exit triggers. Not a stop-out (price was still Rp835,000 above my Rp1,130,165,000 stop) and ADX14 (22.8) hadn't dropped below my 20 exit floor either — the EMA-cross rule fired first, so I closed per rules with no hesitation. Realized: -Rp2,666 (0.0008 BTC × Rp3,332,000 adverse move). Flat now. PEPE's ADX14 climbed further (32.9) and SUI's crossed 25 too (27.9) — both worth watching for the next setup, but volume still doesn't confirm on either.
- **2026-07-14 09:00 UTC (cycle 15)** — PASS, closest near-miss since BTC's original breakout. PEPE now has ADX14 37.4, RSI14 60.6 (in my 50-80 long band), a genuine resistance break (08:30 bar closed at 0.049625 vs prior 20-bar resistance of 0.049618), and EMA9 (0.04955893) above EMA21 (0.04945588) — everything confirms except volume, which came in at 1.29x the 20-period average, short of my 1.5x threshold. SUI similarly trending (ADX14 30.4) but volume much weaker (0.40x). Standing aside on both, watching PEPE closely.
- **2026-07-14 09:15 UTC (cycle 16)** — PASS on both, despite two huge volume prints. PEPE crashed on the 08:45 bar (volume 26.48x avg — the largest single-bar event of the entire loop) with RSI14 dropping to 42.9 (now in my 20-50 short band, ADX14 32.2) — looked like a fresh short setup, but the candle's low (0.049156) stayed above my prior 20-bar support (0.049061), no break, and EMA9 is still barely above EMA21 (not confirmed bearish yet). SUI also spiked (8.26x avg, ADX14 31.8, RSI14 55.2 in my long band) but its high (13,272) never cleared the prior 20-bar resistance (13,298). Two enormous volume events, zero qualifying trades — exactly what my rules are built to filter out. Standing aside.
- **2026-07-15 01:05 UTC (cycle 18, loop resumed after session gap + roster/pipeline upgrade)** — PASS across all 8 pairs, unchanged read from cycle 17. BTC (ADX14 30.4, RSI14 55.0) and ETH (ADX14 48.3, RSI14 52.0) both trending with bullish EMA structure, but price sits below 20-bar resistance on both (BTC Rp1,166,759,000 vs Rp1,172,204,000; ETH similar gap) and volume is under average (0.38x/0.79x) — no breakout confirmation. PEPE's 7.46x volume spike again failed to clear its range. No simulated trade taken.
- **2026-07-15 03:50 UTC (cycle 20)** — PASS across all 8 pairs. BNB is the standout this cycle: ADX14 spiked to 61.6 (strongest single reading the desk has ever seen), close Rp10,484,956 sitting right under its 20-bar resistance of Rp10,489,999 — but EMA9 (Rp10,459,133) is still fractionally below EMA21 (Rp10,460,742), so my bullish trend-structure condition isn't confirmed despite the huge ADX, and volume is only 0.06x average — nowhere near the 1.5x breakout threshold. BTC's ADX crossed into trending territory (27.3) but EMA9 is now below EMA21 (bearish cross), so no long setup there either, and price still hasn't broken its resistance. No pair cleared both trend-structure and breakout-volume conditions together. No simulated trade taken.
- **2026-07-15 04:03 UTC (cycle 21)** — PASS, but BNB is getting genuinely close: ADX14 climbed further to 67.1 and EMA9 (Rp10,463,907) just crossed above EMA21 (Rp10,462,807) this bar — trend structure is now bullish, matching the trend strength. Still missing two of my six conditions: price (Rp10,482,999) hasn't closed above the Rp10,489,999 resistance yet, and volume is essentially dead (0.02x avg) — the opposite of a breakout confirmation. DOGE printed a real 4.3x volume spike but ADX14 is only 15.5 (no trend), so it doesn't qualify either. Watching BNB closely — if it clears resistance on real volume next cycle, that's my trigger. No simulated trade taken.
- **2026-07-15 04:18 UTC (cycle 22)** — PASS, but two names are now genuinely on my watchlist for opposite reasons. **BNB reversed hard**: close fell to Rp10,406,735, RSI14 dropped to 41.5, and EMA9 (Rp10,452,472) crossed back below EMA21 (Rp10,457,686) — bearish structure just re-confirmed, and ADX14 is now 70.1, the strongest trend reading this desk has ever recorded. Close is only Rp3,434 (0.03%) above my 20-bar support of Rp10,403,301 — a breakdown short is one bad candle away. The only thing missing is volume: this cycle printed just 0.05x average, nowhere near my 1.5x breakdown-confirmation threshold. **BTC**, meanwhile, is building the opposite case: RSI14 jumped to 62.9, EMA9 crossed above EMA21 for the first time this stretch, ADX14 holding at 26.8 — but price (Rp1,168,877,000) is still 0.28% under its Rp1,172,204,000 resistance and volume (0.69x) is under threshold too. Two real, opposite-direction near-misses on the same desk right now — neither confirmed. No simulated trade taken.

---
### 2026-07-15 06:25 UTC (cycle 23, consolidated catch-up after a ~2h queued-cron gap) — TRADE: SOL/IDR breakout long
**OPENED.** Re-scanned the full 15m candle history across the gap first, since several cycles queued up before I could act. Two updates on the names I was watching: BNB never broke its support (lowest print Rp10,406,735 at 04:00, never below Rp10,403,301) — that setup quietly resolved without triggering. BTC did close above its resistance at 06:00 (Rp1,172,406,000) but ADX14 had dropped to 18.5 by then (below my 25 trend-confirmation floor) and volume was only 0.49x average — a breakout on a weakening trend and no size behind it is exactly the kind of move I stay out of, not chase.

**SOL/IDR is the real signal.** The 06:00 bar closed at Rp1,415,996 on 118.7 SOL of volume (3.01x the 20-period average), clearing the prior resistance of Rp1,413,979 (set by the 05:45 high). ADX14 26.65 (>25), RSI14 68.45 (in my 50-80 band, not exhausted), EMA9 (Rp1,407,556) above EMA21 (Rp1,402,961) confirming bullish structure. Every one of my six entry conditions cleared simultaneously — the first fully-confirmed breakout since the original BTC trade back on 2026-07-14.

Entry: Rp1,415,996 | Stop: Rp1,406,106 (entry − 2×ATR14) | Target 1: Rp1,435,775 (2:1 R/R) | Size: 0.635501 SOL (50% of the risk-manager-approved cap, ~5% of book) | Risk: ~Rp6,285 (well under the Rp359,947 budget — max_position_size_pct was the binding constraint, same pattern as the BTC trade). Watching for the +1R add level (Rp1,425,886) to pyramid, per my own rules.

---
### 2026-07-15 06:47 UTC (cycle 24) — HOLD SOL/IDR long
Price at Rp1,415,290, essentially flat (-Rp706 vs my Rp1,415,996 entry, -Rp449 unrealized on my size). No exit trigger: still well above my Rp1,406,106 stop, EMA9 (Rp1,410,294) still above EMA21 (Rp1,405,068), and ADX14 actually strengthened to 32.9 (up from 26.65 at entry) — trend is intact, nowhere near my 20 exit floor. Not yet at my +1R add level (Rp1,425,886). Elsewhere: BTC printed a real volume spike (3.03x avg) and price nudged above its rolling resistance, but ADX14 dropped further to 16.9 — my trend-confirmation condition still fails, so still no entry there despite the volume. PEPE now has ADX14 30.7 and price above resistance too, but volume (0.12x) is nowhere close. No new trades. Holding SOL.

---
### 2026-07-16 07:46 UTC (cycle 60) — flat, market-wide selloff, no valid setup for me
Real move this cycle: BTC RSI14 crashed to 15.9, and ETH/SOL/XRP/DOGE/PEPE all broke their supports in the same bar with elevated volume (2.1x-5.8x across the board) — a genuine, correlated crash. But not one of them clears my full rule set: ADX14 on every single name is still under 25 (BTC 22.2, SOL 23.1, ETH 17.9, others lower) — the trend-strength indicator hasn't caught up to what's clearly already a trending move, because ADX is inherently lagging. By the letter of my rules, none of these qualify yet even though the price action is unambiguous. This is a real limitation of my framework worth naming honestly: I may miss the first leg of a fast, correlated crash precisely because ADX needs time to confirm what's already visually obvious. If ADX crosses 25 on the next bar while price keeps falling, several of these become valid breakdown shorts simultaneously. Watching closely. No trades yet — mean-reversion-trader took a position on BTC last cycle into this exact move and got stopped out hard, which is a useful data point on how this move actually behaved.

### 2026-07-16 07:32 UTC (cycle 59) — flat, but BTC just gave mean-reversion-trader its first trade
BTC dropped hard — RSI14 down to 26.2, ADX14 dropped to 18.9 (below my 25 floor, so this is now a range regime, not a trend I can act on even if I wanted to). Not my setup: this is mean-reversion-trader's exact conditions (oversold + range + no volume confirming a real breakdown), and they finally got a clean signal after 59 cycles of nothing. No trades for me here — I need a trending breakdown with volume, this is the opposite. Standing aside.

### 2026-07-16 07:16 UTC (cycle 58) — flat, quiet
BNB drifted back down (RSI14 48.2, volume 1.47x — just under my bar again), XRP came within 5 rupiah of its support on a 6.11x volume bar but ADX14 (7.48) is nowhere near trending. SUI also had a big volume bar (3.78x) with no trend confirmation. Lots of volume without qualifying trend strength this cycle — filed as more absorption, no trades.

### 2026-07-16 07:01 UTC (cycle 57) — flat, BNB bounced hard instead of breaking
The 06:45 bar opened at Rp10,472,572 (below where I was watching) but closed all the way back at Rp10,519,091 — a 0.44% intrabar recovery. RSI14 is back to 53.0, EMA9 has crossed back above EMA21. My near-miss from last cycle is now fully invalidated, the same way SOL's was. Third time this pattern has played out this loop (SOL's support hold, SOL's two resistance rejections, now BNB's support bounce) — this market keeps finding buyers/sellers exactly at the tested levels rather than breaking them. No trades, and increasingly the right call given how consistently these near-misses have resolved against continuation.

### 2026-07-16 06:46 UTC (cycle 56) — flat, BNB is now the closest name, not SOL
BNB dropped hard to Rp10,427,611 — just Rp1,186 (0.01%) above my Rp10,426,425 support, the tightest margin I've measured all loop. ADX14 41.3 (very strong), EMA9<EMA21 bearish, RSI14 39.7 (in band) — three conditions solid. Volume is the lone holdout at 0.99x, just under my 1.5x bar. SOL, meanwhile, drifted back to neutral (RSI14 47.6) after its two resistance rejections — that story has gone quiet for now. Watching BNB bar-by-bar.

### 2026-07-16 06:31 UTC (cycle 55) — flat, SOL rejected again with more conviction
SOL wicked to Rp1,394,657 this time (further above resistance than last cycle) and got rejected harder, closing at Rp1,391,752, on volume 2.17x average — real size behind the rejection. ADX14 dropped to 24.19 (just under my floor), EMA9/EMA21 essentially flat. Two rejections at the same level now, the second one on better volume. No short setup for me (need a support break, not a resistance rejection), but worth noting the level is proving resilient both ways. No trades.

### 2026-07-16 06:16 UTC (cycle 54) — flat, SOL rejected at resistance
SOL wicked up to touch its Rp1,393,646 resistance and closed back below it (Rp1,393,001, only Rp645 short) — ADX14 dipped just under my 25 floor (24.75) right as price got there, and volume stayed light (0.35x). A rejection at the exact level I was watching, with weak volume behind it — reads more like a pause than a breakout attempt. No trades.

### 2026-07-16 06:01 UTC (cycle 53) — flat, SOL sitting right under resistance now
Full role reversal from a few cycles ago: SOL is now Rp938 (0.07%) under its Rp1,393,646 resistance, RSI14 53.4, ADX14 26.6 (>25). But EMA9 is still fractionally below EMA21 (bullish cross hasn't happened yet) and volume is only 0.46x — no breakout confirmation either way. Quiet cycle otherwise. No trades.

### 2026-07-16 05:46 UTC (cycle 52) — SOL fully invalidated my thesis, and I want to say so plainly
The 05:00 bar's low touched Rp1,383,002 — my exact support level — and closed back above it at Rp1,384,309. It did not break. Then price didn't just hold, it rallied hard: Rp1,384,309 → Rp1,391,420 → Rp1,392,908 → Rp1,393,000 over the next three bars, a 0.65% recovery. RSI14 is back to 53.9, EMA9 has crossed back above EMA21, ADX14 is still elevated (28.6) but now describing an uptrend, not a downtrend. My breakdown thesis from cycles 47-51 — five of six conditions met, closest setup of the loop — is now fully wrong. The level held exactly where it should have if it was ever going to, and the market went the other way. This is what "no exceptions" discipline is for: I never entered on the near-miss, so there's no loss to report, just a clean read of being wrong about direction while being right to wait for confirmation before risking capital. No trades, no regrets about the ones not taken.

### 2026-07-16 05:01 UTC (cycle 51) — flat, SOL is the closest setup of the entire loop
Five of my six breakout-short conditions on SOL right now: ADX14 27.13 (>25), EMA9<EMA21 (bearish), RSI14 32.89 (comfortably in my 20-50 band), volume 2.18x average (clears my 1.5x bar). The bar's low (Rp1,383,537) came within Rp535 — 0.04% — of my Rp1,383,002 support. That's the tightest margin I've seen on any setup this entire loop, closer even than BNB's earlier near-misses. Still didn't break, so still no trade, but if the next bar takes this level out with any real volume behind it, that's an immediate entry. Watching this one bar-by-bar now.

### 2026-07-16 04:46 UTC (cycle 50) — flat, quiet
SOL holding roughly steady (RSI14 38.7, ADX14 27.4), still no volume to confirm either direction. BNB bounced back up (RSI14 54.1). PEPE had a real volume bar (2.26x) at a fresh low but I don't have a clean breakdown to act on. No trades.

### 2026-07-16 04:31 UTC (cycle 49) — flat, SOL leaning my way again but volume gone
SOL's RSI14 dropped further to 37.8 (closer to exhausted-short territory than before), ADX14 26.98 (still trending), EMA9<EMA21 still bearish — three of my conditions hold. But volume collapsed to 0.37x, and price is still above my support. The bounce from last cycle faded, price is drifting lower again, but without the volume conviction of cycle 47's move. Still not confirmed either way. No trades.

### 2026-07-16 04:16 UTC (cycle 48) — flat, SOL bounced instead of breaking
SOL didn't continue down — it bounced (close Rp1,388,951, up from Rp1,388,361), RSI14 recovered slightly to 40.4, volume eased to 2.24x (still elevated, but less than last cycle's 4.49x). My breakdown thesis needed continuation and got a pause instead. Still hasn't broken my support, still technically alive, but this cycle leans against it rather than for it. Not abandoning the read yet — one bounce isn't a reversal — but noting honestly that the momentum has cooled. No trades.

### 2026-07-16 04:01 UTC (cycle 47) — flat, SOL is my new closest name
SOL just gave me four of six breakout-short conditions at once: ADX14 29.86 (>25, genuinely trending now, not just borderline), EMA9<EMA21 bearish, RSI14 38.62 (comfortably in my 20-50 band), and volume 4.49x average — my strongest volume reading in a long time. The only thing missing: price hasn't actually closed below my Rp1,383,002 support yet, the bar's low (Rp1,385,123) got within 0.15% of it but didn't clear it. This is a genuinely live setup now, not a stretch. Watching next cycle for the actual break.

### 2026-07-16 03:46 UTC (cycle 46) — flat, quiet after the rejection
SUI settled at Rp13,749, well under its (now recalculated) resistance of Rp13,789, RSI14 holding near 63.3 but ADX14 only 16.3 — still not my regime. BNB's ADX14 climbed further to 33.6 but volume evaporated (0.005x) and price dropped back to Rp10,469,392. DOGE had another elevated volume bar (7.5x) right at its resistance but didn't clear it. No trades.

### 2026-07-16 03:31 UTC (cycle 45) — flat, SUI rejected hard at resistance
SUI's 03:15 bar wicked to Rp13,789 — clean above my Rp13,735 resistance — on volume of 3,848 (vs a typical 60-480 range this session, easily the largest single-bar volume this name has shown). But it closed back down at Rp13,728, below the level. My rule needs a CLOSE above resistance, not a wick — this is a rejection, not a breakout, no matter how loud the volume was. If anything, a rejection this violent on this much size is a point against chasing longs here, not for it. BNB's ADX14 climbed further to 29.3 but volume collapsed back to 0.18x — the two conditions keep taking turns being ready, never together. No trades.

### 2026-07-16 03:16 UTC (cycle 44) — flat, two names building
SUI is sitting right on its resistance (Rp13,733 vs Rp13,735, just Rp2 away) but ADX14 (14.07) is far below my 25 floor and volume (0.85x) is under threshold too — a range name drifting up, not a trend I can act on. More interesting: BNB's ADX14 just crossed back above 25 (25.60), volume cleared my 1.5x bar (1.58x) for the first time in a while, and EMA9>EMA21 confirms bullish structure — three of my six long conditions now line up. Still missing the actual resistance break (close Rp10,519,818 vs Rp10,549,916, about 0.29% away) and RSI14 (54.9) is fine but not yet showing real momentum. Watching BNB closely again.

### 2026-07-16 03:01 UTC (cycle 43) — flat, quiet
BNB bounced back (RSI14 54.9), mean-reversion-trader's near-miss faded the same as mine did earlier. SUI is edging toward its resistance (Rp13,729 vs Rp13,735, just Rp6 away) but ADX14 (14.55) is nowhere near my 25 floor. DOGE had another huge volume bar (9.47x) with no price break — filed the same as prior absorption events. No trades.

### 2026-07-16 02:46 UTC (cycle 42) — flat, quiet
BNB dropped further (RSI14 35.98) and is sitting almost exactly on its support again (Rp482 above), but ADX14 has fallen to 19.96 — no longer trending hard enough for my strategy to care regardless of what the level does. This one's mean-reversion-trader's territory now, not mine. XRP (4.07x) and SUI (3.62x) both had volume spikes but stayed inside their ranges. No trades.

### 2026-07-16 02:31 UTC (cycle 41) — flat, quiet
BTC's wick rejection resolved into nothing (RSI14 44.3, still neutral). SOL had a volume spike (3.25x) but stayed inside its range — another absorption event, no breakout. Nothing else close. No trades.

### 2026-07-16 02:16 UTC (cycle 40) — flat, quiet
BTC wicked up to Rp1,167,676,000 intrabar then closed back down at Rp1,166,725,000 on volume 2.62x average — real volume, but no level of mine got broken (price stayed well inside my resistance/support range). ADX14 still strong at 44.5 but RSI14 (43.6) is back toward neutral, out of my short band's more useful range. No trades.

### 2026-07-16 02:10 UTC (cycle 38) — flat, quiet cycle
BTC's RSI14 recovered further to 46.5, ADX14 still strong (46.4) but the setup is no longer close — momentum has genuinely stalled rather than confirming. Nothing else close to a breakout anywhere. No trades.

### 2026-07-16 01:46 UTC (cycle 37) — flat, BTC's setup cooled slightly
BTC bounced a touch (RSI14 back to 39.7 from 37.3) and the gap to my support widened from 0.19% to 0.36%, while volume dropped back under threshold (0.73x, was 1.75x). ADX14 is still very strong (48.0) and structure still bearish, but this cycle regressed on the two conditions that were closest — not a fresh signal, more a reminder that near-misses can fade as easily as they can confirm. SUI printed the largest single-bar volume of the entire loop (10.24x average) with price staying inside its range — another clean absorption event, no breakout, filed the same way as PEPE's and DOGE's earlier ones. No trades.

### 2026-07-16 01:31 UTC (cycle 36) — flat, BTC now the closest name on the desk
Fresh candle closed and BTC has five of my six breakout-short conditions: ADX14 47.4 (very strong trend), EMA9<EMA21 (bearish structure), RSI14 37.3 (in my 20-50 short band), volume 1.75x average (clears my 1.5x bar for the first time on this name). The only thing missing: price hasn't actually closed below my Rp1,163,249,000 support yet — still Rp2,249,000 (0.19%) above it. This is now the most complete non-breakout setup on the desk. Everything else: ETH and DOGE both had huge volume (4.88x, 4.80x) but ADX under 11 on both — pure noise by my rules regardless of size. Watching BTC closely next cycle.

### 2026-07-16 01:26 UTC (cycle 35) — same closed candle as cycle 34, no new read. Flat.

### 2026-07-16 01:23 UTC (cycle 34, consolidated after ~16h22m session gap) — flat, BNB's base fully resolved upward
Re-scanned the whole gap window first (no cycles ran overnight) — largest move was PEPE at 6.5% range, nothing extreme anywhere, confirmed via raw candle high/low across all 8 pairs. **BNB's story resolved**: the base that formed after its cycle-32 breakdown held, and price rallied from Rp10,400,004 to Rp10,549,916 overnight (+1.44%) — it's now cleanly above its old resistance (Rp10,500,001), RSI14 69.2 (near my upper band edge), EMA9>EMA21 bullish. But ADX14 has collapsed to 11.8 (the trend strength I was requiring evaporated exactly as price finally moved) and volume is essentially zero (0.009x). A clean structural break with no trend confirmation and no volume behind it — the opposite failure mode from before (used to fail on volume with everything else aligned; now aligned on price/RSI but fails on both ADX and volume). Elsewhere: BTC's ADX jumped to 46.5 (strong trend) but bearish (EMA9<EMA21, RSI14 37.1) with price still above support, no break. No trades.

### 2026-07-15 09:01 UTC (cycle 33) — flat, BNB stalled rather than continued
Worth being precise here: BNB did NOT make a fresh new low this bar — it opened, tested up to Rp10,403,000, and closed right back at Rp10,400,004, identical to the prior bar's close. Volume actually cleared my threshold this time (1.93x average) but there's no new break to trigger against — the rolling 20-bar support reference has simply absorbed last cycle's breakdown level as its new floor, so "price below support" isn't a fresh signal anymore, it's the same level repeating. Read plainly: sellers pushed through last cycle, and now the market is pausing exactly at the new low rather than continuing down — that's either distribution before another leg down, or the start of a base. Not enough information yet to call it either way. No trade.

### 2026-07-15 08:46 UTC (cycle 32) — flat, closest miss of the entire loop
**BNB finally broke.** After five cycles pinned right on Rp10,403,645, the 08:30 bar closed at Rp10,400,004 — a clean Rp3,641 (0.035%) break below support, not a wick. Every other condition lines up: ADX14 75.4 (trend confirmed), EMA9 (Rp10,425,886) below EMA21 (Rp10,443,646, bearish structure), RSI14 39.1 (right in my 20-50 short band). **Volume is the only thing standing in the way, and it's agonizingly close: 1.474x the 20-period average, against my 1.5x requirement — a shortfall of about 1.7%.** By the letter of my own rule, this doesn't confirm. No exceptions, no "close enough" — if I start rounding up on volume, the rule stops meaning anything. Passing on this one, but flagging it as the single closest near-miss of the whole loop. If the next bar holds below this level with any real volume behind it, I'll treat it as a fresh, valid breakdown rather than chasing this bar after the fact.

### 2026-07-15 08:31 UTC (cycle 31) — flat
BNB is now sitting almost exactly on its support (Rp10,403,645, essentially identical to the Rp10,403,645 support level) for something like the fifth consecutive check — volume ticked up to 1.40x but still short of my 1.5x bar, and ADX14 is still 75.9. This is the most persistent level-test of the whole loop; if volume finally clears 1.5x on the next touch, I'd have a real breakdown short (EMA9<EMA21 already bearish, RSI14 39.7 in my short band). Everything else is quiet. No trades yet.

### 2026-07-15 08:16 UTC (cycle 30) — flat
PEPE's bounce faded — back down to Rp0.050005, retesting the same Rp0.05 support it tested at cycle 28, on unremarkable volume this time (no repeat of that huge print). BNB is doing the same thing at its support (close Rp10,403,646 vs support Rp10,403,649 — a 3-rupiah margin, essentially sitting right on the line) with ADX14 still pinned above 75 and volume still absent (0.24x). Both names are camped right on their support lines without confirming a break either way. Not chasing either without volume. No trades.

### 2026-07-15 08:02 UTC (cycle 29) — flat
PEPE printed a genuinely enormous volume bar (~15.4B units, 19-20x the 20-period average by my calc) but price stayed entirely inside its existing range (high Rp0.050239, low Rp0.050002, close Rp0.050183) — no level broken in either direction, so no signal regardless of size. Also, EMA9 is still below EMA21 (bearish) while RSI14 sits at 44.5, in my short band, but with no support break to trigger against. DOGE had a smaller version of the same pattern (9.7x volume, flat price). Filing both as absorption events, not breakouts. No trades.

### 2026-07-15 07:46 UTC (cycle 28) — flat
PEPE's support break got cleaner (close Rp0.05 vs support Rp0.050057, now a real break not a hairline one) but volume (0.39x) still fails badly — same conclusion, no trade. BNB's volume finally picked up (1.84x, clears my threshold) but price is still Rp25,151 above its support (not broken), and its whipsaw between ~Rp10,403,000-10,483,000 for hours now doesn't inspire confidence even if it does break — I'd want to see it hold beyond one bar. No trades.

### 2026-07-15 07:31 UTC (cycle 27) — flat, one near-miss worth flagging
Market drifted lower across the board (RSI14 40-49 on most pairs). Two things worth noting: DOGE printed a huge volume bar (9.23x average) but ADX14 is still only 20.5 (below my 25 trend floor) and price didn't clear either level — pure noise by my rules, not a signal. PEPE is right at the edge of a short: ADX14 26.6 (>25), EMA9 just crossed below EMA21, RSI14 40.1 (in my 20-50 short band), and close (0.050057) is marginally below its 20-bar support (0.05006) — but by a razor-thin margin, and volume (0.63x) is nowhere near my 1.5x confirmation. Not treating that hairline support break as real without volume behind it. No trades.

### 2026-07-15 07:16 UTC (cycle 26) — flat, no new setups
Market cooled off across the board — RSI14 back to 45-55 neutral on every pair, no breakouts confirmed anywhere. SOL (where I was just stopped out) pulled back further to Rp1,406,436, still well below its Rp1,418,900 resistance. PEPE's ADX14 (27.5) is technically trending but RSI14 dropped to 45.4 (below my 50 floor) and price is well under resistance — no case there either. Noting the new risk policy (max_position_size_pct now 100%, was 10%) for the next time a real setup appears — my initial-entry sizing rule (50% of approved size) stays the same, but "approved size" itself will be much larger now. Standing aside.

### 2026-07-15 07:02 UTC (cycle 25) — STOPPED OUT SOL/IDR long
**Closed at Rp1,406,106, my stop, exactly as planned.** Price gave the move back fast: the 06:45 bar's low (Rp1,409,794) already tested my zone, and the forming 07:00 bar traded straight through to Rp1,405,349 (confirmed against the live book, bid now Rp1,404,404). ADX14 was still climbing (33.2 on the last full close) right up until the reversal — this wasn't a trend-death exit or an EMA cross, the stop simply got hit first. Realized loss -Rp6,285, precisely the risk I committed to at entry, not a cent more. No hesitation, no moving the stop, no "let me wait and see." Flat now. No new setups elsewhere this cycle — BTC's resistance moved further away (now Rp1,175,000,000) and ADX14 dropped to 15.5; PEPE pulled back below its resistance with RSI14 back to neutral (49.6). Standing aside.

### 2026-07-17 03:15 UTC (cycle 63, after ~17h53m gap) — the crash lost steam, and BNB is now the closest call of the loop
**Gap check first**: scanned the full 15m history across the gap (last cycle 2026-07-16T09:22 UTC) — largest range was ETH at 3.74%, everything else 1.8-2.9%, all just continued grinding lower rather than any fresh violent move. Nothing missed, and I had no open positions to manage through it anyway.

The picture has shifted meaningfully: ADX14 has cooled below my 25 floor on ETH (24.1), XRP (23.6), DOGE (20.0), PEPE (13.7), and SUI (15.6) — the broad, desk-wide downtrend from two cycles ago is fading on most names. But BTC (37.4), SOL (29.3), and **BNB (40.1)** still trend, and BNB is the story this cycle: close Rp10,280,001 against a 20-bar support of Rp10,280,000 — essentially sitting exactly on the line, ADX strongly confirming, EMA9<EMA21 bearish, RSI14 40.3 comfortably in my 20-50 short band. **Every one of my conditions clears except volume** (1.04x average vs. my 1.5x floor) — the closest a setup has come to triggering without actually doing so since the BNB near-miss weeks ago. Not entering on a hairline support touch without volume behind it. Watching this one bar-by-bar now.

### 2026-07-16 09:22 UTC (cycle 62) — same closed candle, no change
Cron fired again just minutes after cycle 61 — same last-closed 15m bar (09:00 UTC), nothing new to re-evaluate. Reads stand exactly as cycle 61: strong bearish structure everywhere, no pair has broken its own support yet. Standing aside.

### 2026-07-16 09:18 UTC (cycle 61) — the ADX finally caught up, but still no valid short
Last cycle's crash now has full trend confirmation behind it: ADX14 has surged to 36.3 (BTC), 41.1 (ETH), 37.6 (SOL), 42.3 (BNB), 34.6 (SUI), 35.3 (PEPE), 27.7 (DOGE) — every pair but XRP (22.5) now clears my 25 trend floor, and EMA9<EMA21 confirms bearish structure on all of them. RSI14 is deep in my 20-50 short band everywhere (25.4-43.7). By four of my six conditions, this is about as clean a bearish picture as this desk has produced. **But not one pair has actually closed below its own 20-bar support yet** — BTC (Rp1,154,177,000 vs support Rp1,151,003,000), ETH, SOL, DOGE, PEPE, SUI, BNB are all still trading inside their existing ranges, just near the bottom of them. No level broken means no entry, full stop, regardless of how good the rest of the picture looks. PEPE's volume is the standout anomaly (10.83x its 20-period average, the largest single-bar reading I've seen from it) but even that hasn't produced a break — filing it as pressure building, not a signal yet. Watching every pair's support level closely next cycle; if one breaks with volume behind it, this would be the first trade under the current sizing regime since the SOL stop-outs.

### 2026-07-20 03:00 UTC (cycle 64, after ~3-day gap) — the market recovered without me, and PEPE just missed by a hair
**Gap check**: last cycle was 2026-07-17T03:15 UTC — a genuine ~71h45m gap. Scanned 1h candles across the whole window for all 8 pairs: ranges of 2.5%-9.6% (PEPE widest), but every pair actually finished the gap **higher** than where it started (BTC +1.71%, ETH +0.83%, SOL +1.78%, XRP +0.38%, DOGE +0.38%, PEPE +4.86%, SUI +1.22%) except BNB (-0.40%, roughly flat). No violent single-bar move stands out beyond what the daily candles already show — the market bottomed around 2026-07-17 (BTC's daily low that day was Rp1,126,071,000) and has been grinding back up since. No positions were open, so nothing was left unmanaged.

**Current picture**: the desk-wide downtrend from cycle 60-61 is gone — ADX14 has collapsed under 25 on BTC (14.3), ETH (14.6), XRP (18.7), DOGE (15.8), SUI (12.4), BNB (13.1). Only SOL (34.3) and PEPE (26.0) still trend, both now bullish (EMA9>EMA21, RSI>50). **PEPE is the story this cycle**: RSI14 62.7, ADX14 26.0 (clears my floor), EMA9>EMA21 bullish, and the last closed bar actually wicked to Rp0.052588 — above my Rp0.052 resistance20 — before closing back at Rp0.051974, just under it. Volume on that bar was 1.48x average, a hair under my 1.5x floor. Every single one of my six conditions is right at the edge: trend confirmed, RSI in band, resistance technically pierced intrabar but not on a closing basis, volume just short. This is the closest a genuine breakout attempt has come to triggering without doing so. Not entering on an intrabar wick that closed back below the level — I need a clean close through it. Watching PEPE closely next cycle.

### 2026-07-20 04:00 UTC (cycle 65, first hourly-cadence cycle) — PEPE's breakout attempt fully faded
Loop now runs hourly (changed from 15-min per user request). PEPE gave back the whole move — RSI14 back to 48.8 (from 62.7), price retreated to Rp0.051201, well off both the resistance it wicked through and its own EMAs starting to flatten. That near-miss is fully closed out; filing it as a rejection, not an ongoing setup. SOL still shows some trend (ADX14 28.2) but RSI14 sits right at my 50 floor and price remains well under resistance — no case there either. Everything else has cooled to low-ADX chop (BTC 8.7, ETH 7.9, XRP 13.2, DOGE 13.9, SUI 11.3, BNB 9.5). Quiet, range-bound cycle. No trades.

### 2026-07-20 06:00 UTC (cycle 66) — three supports broke, none confirmed by my own rules
The market turned back down hard. BTC (close Rp1,150,941,000 vs support Rp1,151,803,000), BNB (Rp10,145,080 vs Rp10,152,269), and SUI (Rp13,277 vs Rp13,309) all closed below their 20-bar support this bar. But not one of them clears my full criteria: BTC's ADX14 sits at 24.998 — a hair under my 25 floor — and its volume (0.82x) fails badly anyway. BNB's ADX (16.9) and volume (0.40x) both fail. SUI is the interesting one: massive volume (13.8x average, the loudest print it's shown all loop) but ADX14 only 19.1 — well under my trend-confirmation floor, so my own rules keep me out despite the size behind the move. Worth being honest that this is exactly the ADX-lag pattern I've hit before — the volume and price break are real, my trend-strength gate just hasn't caught up yet. Standing aside on all three; jesse-livermore's rules don't require ADX the way mine do, so his read on SUI may differ.

### 2026-07-20 07:00 UTC (cycle 67) — XRP is the closest call now, SUI reversed hard
None of the three near-misses from last cycle extended: BTC and DOGE both stayed above their (recalculated, slightly wider) support levels, and SUI actually reversed sharply — the exact bar jesse-livermore entered on rallied hard and stopped him out within minutes, confirming this wasn't a clean breakdown after all. New candidate: **XRP** — ADX14 just cleared my floor (26.4), EMA9<EMA21 bearish, RSI14 37.65 in band, and volume already confirms hard (2.56x average) — every condition met except the actual close below support20 (Rp19,490 vs Rp19,459, only 31 rupiah / 0.16% away). This is now the tightest, most complete near-miss on the desk. Watching XRP closely next cycle.

### 2026-07-20 08:00 UTC (cycle 68) — XRP near-miss fully invalidated, quiet cycle
XRP recovered well clear of its support (close Rp19,593 vs Rp19,459, a comfortable buffer now, up from 31 rupiah last cycle) — that near-miss is closed out, same pattern as SUI's reversal. Nothing else close: BTC and ETH both still show slightly bearish EMA structure but RSI has drifted back toward 48-49 (neutral), no breaks anywhere. Quiet, recovering market. No trades.

---
### 2026-08-20 04:20 UTC — TRADE: PEPE/IDR breakout long (new two-tier architecture, first trade since the roster/pair-universe expansion)
**OPENED.** First real signal from the Tier-1 mechanical scanner (`scripts/scan-signals.ts`) since the desk moved to the 19-pair universe and 15-minute cadence. Every one of my six conditions cleared together: ADX14 42.7 (strong trend), EMA9 (0.051365) above EMA21 (0.050859), long-term structure also bullish (EMA50 0.049714 > EMA200 0.047459 — the first time I've had this confirmed on this trade), RSI14 62.0 (in my 50-80 band, not exhausted), the 04:15 UTC bar closed at 0.051976, clean above the prior 20-bar resistance of 0.051838, on volume 2.07x the 20-period average.

Entry: 0.051976 | Stop: 0.0504136 (entry − 2×ATR14, ATR14 0.00078121) | Target 1: 0.0551009 (2R) | Target 2: 0.0566633 (3R) | Size: 17,307,073.46 PEPE (50% of the risk-manager-approved cap per pyramiding rule). Risk-manager gate: 10% of book notional cap (Rp1,799,105) was the binding constraint, not risk_per_trade_pct — actual risk ~Rp27,041, well under the Rp359,821 budget. jesse-livermore flagged the same pivot break independently on their own (looser) rules — two different lenses agreeing is a useful cross-check, though we act on our own separate books. Watching for the +1R add level to pyramid, per my own rules.

### 2026-08-20 07:30 UTC — HOLD PEPE/IDR long (consolidated catch-up, 11 queued cron fires)
Re-scanned the full candle history across the gap before touching anything. Price ranged 0.05101–0.05235 since entry, currently 0.0521 — essentially flat, +0.24% unrealized. My wider 2xATR stop (0.0504136) was never in danger despite a real dip to 0.051008 (05:30 bar) that stopped jesse-livermore out of the same pivot break on their tighter stop — a useful live comparison of the two approaches on the identical entry. EMA9 (0.051811) still above EMA21 (0.051518), ADX14 30.1 (still >25, above my 20 exit floor), RSI14 60.8 — no exit trigger. Not yet at my +1R add level (highest close since entry was 0.052321, only ~0.22R). Holding, no changes to stop or size.

---
### 2026-08-20 08:10 UTC — TRADE: SOL/IDR breakout long (second concurrent position)
**OPENED.** All six conditions cleared on a genuinely liquid pair this time — worth contrasting with the TON near-miss jesse-livermore passed on last cycle, which fell apart under a data-quality check. ADX14 39.6, EMA9 (1,519,193.78) above EMA21 (1,511,148.75), long-term structure also bullish (EMA50 1,492,919.80 > EMA200 1,421,479.05), RSI14 74.3 (in my 50-80 band, though close enough to the top edge that I'll watch for exhaustion), the 07:45 UTC bar closed at 1,527,570 above the prior 20-bar resistance of 1,523,999 on volume 1.79x average — real volume across a clean, liquid tape, no flat candles anywhere in the window.

Entry: 1,527,570 | Stop: 1,519,250.57 (entry − 2×ATR14, ATR14 4,159.71) | Target 1: 1,544,208.86 (2R) | Target 2: 1,552,528.29 (3R) | Size: 0.5889 SOL (50% of the risk-manager-approved cap). Risk: ~Rp4,899, well under the Rp359,821 budget — 10% book notional cap (Rp1,799,105) was binding, same pattern as always. This runs alongside my still-open PEPE/IDR long as a second, independently-stopped position, not a pyramid add — combined exposure now ~20% of book. breakout-specialist looked at the same bar and passed (volume didn't clear their stricter 2x bar) — a useful cross-check that my own threshold is the looser one here, by design.

---
### 2026-08-20 08:25 UTC — broad market rally: SOL pyramided to full size, TRADE: ETH/IDR + BNB/IDR longs
A genuinely broad move this cycle — BTC, ETH, BNB, DOGE, SUI, ADA all broke out with real volume in the same 15-minute window, not an isolated single-pair fluke.

**SOL/IDR fully pyramided.** Both my +1R (1,535,889.43) and +2R (1,544,208.86) add triggers were crossed between checks — added 30% at +1R and 20% at +2R, now at full planned size (1.1778 SOL), weighted avg entry 1,533,393.60. Trail rules moved my stop to 1,539,430.43 (1.5xATR below the highest close) — **now above my average entry, this position is risk-free from here.**

**ETH/IDR — OPENED.** Full six-condition breakout: ADX14 34.9, RSI14 66.0, EMA structure and long-term trend both bullish, close through resistance on 1.83x volume, clean liquid data. Entry 40,370,000, stop 40,095,428.57, target1 40,919,142.86 (2R). Standard 50%-initial, 10%-book-cap sizing, risk ~Rp6,118.

**BNB/IDR — OPENED, with a caveat.** Same six conditions clear, but RSI14 79.05 is right at my 80 exhaustion ceiling — flagging this one as the most likely to reverse fast of anything I've entered this cycle. Entry 11,300,321, stop 11,235,023.86, target1 11,430,915.29 (2R). Risk ~Rp5,198.

Now holding four concurrent positions (PEPE, SOL, ETH, BNB) — the widest my book has ever been. Watching closely, not adding further this cycle.

---
### 2026-08-20 08:40 UTC — rally continues: TRADE LTC/IDR, trail updates across the board
**PEPE cleared +2R** — stop trailed to 0.05456943 (from 0.0504136), a large locked-in gain now; only my 3R target (0.0566633) remains ahead. **SOL continues trailing** at 1.5xATR below its highest close, stop now 1,540,063.18, still risk-free, +3R not yet hit. **BNB crossed +1R** — stop moved to breakeven (11,300,321), risk-free.

**LTC/IDR — OPENED.** Sixth pair in this rally, and the least extended entry I've taken today: RSI14 60.9 (mid-band, not stretched like BTC/PEPE/SOL/BNB have been). Full six-condition breakout, ADX14 27.1, close through resistance on 2.13x volume. Entry 837,000, stop 828,714.29, target1 853,571.43 (2R). Standard sizing, risk ~Rp8,905.

Five concurrent positions now (PEPE, SOL, ETH, BNB, LTC).

---
### 2026-08-21 03:53 UTC — consolidated catch-up (~19h session gap): the whole rally cashed out
Walked the full 15m candle history bar-by-bar (not just the aggregate high/low) since several positions had both a trail-adjusted stop and a target technically touched somewhere in the gap, and only a proper sequential simulation says which came first. All five positions from the rally closed on their trailing stops as the move rolled over:

| Pair | Exit | P&L | Note |
|---|---|---|---|
| PEPE | trail stop 0.05539943 | **+Rp59,250** | Best trade — trail kept most of a big move even after the reversal |
| SOL | trail stop 1,547,577.79 | **+Rp16,706** | Full pyramided position, gave back some of the peak but still a clean win |
| BNB | trail stop 11,405,027.14 | **+Rp8,335** | Cleared +2R before rolling over, trail protected the gain |
| ETH | trail stop = entry | **Rp0** | Breakeven exact — the trail rule's job is to turn a would-be loss into a scratch, and it did |
| LTC | hard stop 828,714.29 | **-Rp8,905** | Never reached +1R, cut clean at the pre-committed risk |

Net this cycle: **+Rp75,386**. Book is flat again, balance Rp18,066,434.76. This is the trailing-stop mechanic's first real stress test across a full rally-and-reversal cycle, and it worked exactly as designed: real gains locked in on the winners, a would-be loser turned into a scratch, only the position that never got going lost money, and that loss was capped at the original budget.

---
### 2026-08-21 06:19 UTC — back in: TRADE SOL/IDR + PEPE/IDR, same pairs, fresh legs

Cron resumed after a gap (session interruption, not a market event) — first fire since flattening out. Both pairs I'd already round-tripped are back with fresh breakouts on the continuing rally:

- **SOL/IDR — OPENED.** ADX14 57.0, the strongest trend reading of this whole loop. RSI14 79.3, hot but momentum intact. Entry 1,604,001, stop 1,586,962.71 (2xATR), target1 1,638,077.57. Risk ~Rp9,595.
- **PEPE/IDR — OPENED.** ADX14 28.0, RSI14 78.9, volume 2.51x. Entry 0.06014, stop 0.0590464, target1 0.0623271. Risk ~Rp16,426. jesse-livermore confirmed the same bar independently.

Two concurrent positions, both fresh entries not pyramid adds to anything prior.

---
### 2026-08-21 06:34 UTC — TRADE DOGE/IDR, third position, existing two untouched

Checked SOL and PEPE against the fresh bar — both safe, both still in profit. **DOGE/IDR — OPENED**: ADX14 48.4, RSI14 73.2 (not extended), clean breakout on 1.53x volume. Entry 1,472, stop 1,456.86, target1 1,502.29. Risk ~Rp9,293. jesse-livermore already holds DOGE from the earlier leg — same pivot area, both riding the same continued strength independently.

---
### 2026-08-21 07:32 UTC — TRADE ETH/IDR, fourth position

All three existing positions checked safe. **ETH/IDR — OPENED**: ADX14 28.0, RSI14 68.8 (comfortably unextended), close through resistance on 5.14x volume — the loudest reading on this pair this loop. Entry 42,017,000, stop 41,723,571.43, target1 42,603,857.14. Risk ~Rp6,308. jesse-livermore confirmed the same bar independently. Four concurrent positions now — the widest my book has been since the last full unwind.

---
### 2026-08-21 07:50 UTC — TRADE SHIB/IDR, fifth position

All four existing positions checked safe. **SHIB/IDR — OPENED**: ADX14 50.5 (strong trend), RSI14 78.7 (hot but in band), close through resistance on 1.99x volume, clean data. Entry 0.0918, stop 0.090392, target1 0.094615. Risk ~Rp13,852. Five concurrent positions — this rally keeps broadening into new names rather than fading.

---
### 2026-08-21 08:19 UTC — TRADE ADA/IDR, sixth position

All five existing positions checked safe. **ADA/IDR — OPENED**: ADX14 40.1, RSI14 67.3 (unextended), clean breakout on 2.27x volume. Entry 3,758, stop 3,697.14, target1 3,879.71. Risk ~Rp14,628. jesse-livermore's own ADA position (held since two days ago) confirms the same underlying strength. Six concurrent positions — the widest my book has been this entire loop.

---
### 2026-08-21 08:55 UTC — DOGE stopped out on a real flash-wick, TRADE BNB/IDR

**DOGE/IDR — STOPPED OUT.** The 08:30 bar wicked down to 1,400 (from a 1,491 open) before recovering to close at 1,496 in the same candle — a real, sharp intrabar move, confirmed by that bar carrying the highest volume in the window, not a data glitch. My stop triggers on intrabar touches, not the close, so this is a genuine stop-out even though DOGE went on to keep climbing right after. -Rp9,291, exactly the pre-committed risk. jesse-livermore's own DOGE position (stop further away) survived the identical wick — this time it's just where the stop happened to sit, not a discipline gap; a wick that size would have caught either of us if placed a little closer.

**BNB/IDR — OPENED.** ADX14 29.1, RSI14 71.2, clean breakout on 2.66x volume. Entry 11,963,448, stop 11,807,817.71, target1 12,274,708.57. Risk ~Rp11,745. jesse-livermore confirmed the same bar independently. Six concurrent positions, unchanged in count (DOGE out, BNB in).

---
### 2026-08-21 09:04 UTC — TRADE AVAX + re-entered DOGE, eight positions now, and my BNB survived what jesse-livermore's didn't

Checked all six positions first. BNB safe (low 11,838,159 vs my stop 11,807,817.71 — the same pullback that stopped jesse-livermore's tighter BNB stop stayed just above mine). Everything else safe too.

- **AVAX/IDR — OPENED.** ADX14 28.6, RSI14 68.5, breakout on a very loud 11.61x volume, confirmed independently by both jesse-livermore and breakout-specialist on the same pair. Entry 134,707, stop 132,752.57, target1 138,615.86. Risk ~Rp13,099.
- **DOGE/IDR — RE-ENTERED.** Same pair I was stopped out of one cycle ago on the flash-wick. This is a fresh pivot, fresh stop, treating it as an independent trade rather than chasing the loss. ADX14 53.1, very strong. Entry 1,510, stop 1,476.43, target1 1,577.14. Risk ~Rp20,073.

Eight concurrent positions — a new high for this book.

---
### 2026-08-21 11:35 UTC — consolidated catch-up (~2.5h gap): seven closed, one survivor, my best trailing-stop win yet

Reconstructed every position bar-by-bar across the gap:

| Pair | Exit | P&L |
|---|---|---|
| PEPE | trail stop, after 3 checkpoint tightenings | **+Rp63,751** — biggest win of the loop |
| SOL | trail stop at breakeven | Rp0 |
| ETH | trail stop at breakeven | Rp0 |
| ADA | hard stop | -Rp14,629 |
| AVAX | hard stop | -Rp13,099 |
| DOGE | hard stop (second loss in two attempts on this pair) | -Rp20,072 |
| BNB | hard stop | -Rp11,745 |

Net: **+Rp4,205**. Only SHIB survives (not yet at +1R, stop unchanged). Down to one open position from eight — the trailing mechanic once again did its job on the winner (PEPE), turned two marginal trend trades into scratches (SOL, ETH), and everything else was cut clean at its pre-committed budget. DOGE specifically has now cost me twice in a row at this stop distance — not chasing a third immediate re-entry, waiting for a cleaner signal.

## Open Questions
_None._


---
### 2026-08-24T09:27 UTC — Position Opened: LONG LTC/IDR
* **Entry Price:** Rp936.000
* **Stop Loss:** Rp917.280
* **Target:** Rp982.800
* **Reason:** bullish breakout: ADX>25, EMA9>EMA21, RSI in 50-80, close above 20-bar resistance, volume>1.5x
* **Allocated:** Rp4.515.337


---
### 2026-08-24T13:05 UTC — Position Opened: LONG ETH/IDR
* **Entry Price:** Rp44.212.000
* **Stop Loss:** Rp43.327.760
* **Target:** Rp46.422.600
* **Reason:** bullish breakout: ADX>25, EMA9>EMA21, RSI in 50-80, close above 20-bar resistance, volume>1.5x
* **Allocated:** Rp4.515.337


---
### 2026-08-24T19:37 UTC — Position Closed: LONG LTC/IDR
* **Exit Price:** Rp915.000
* **Realized PnL:** Rp-101.306
* **Reason:** Stop Loss hit @ Rp915.000
* **New Balance:** Rp17.960.043
