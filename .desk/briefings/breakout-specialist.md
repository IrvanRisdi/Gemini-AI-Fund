# Breakout Specialist — Briefing Book

## Status
- **Hired:** 2026-08-20

## Analyses
- **2026-08-20 08:10 UTC (first Tier-1 flag) — SOL/IDR, PASS despite the mechanical scanner's flag**: Tier-1's cheap scanner caught a real squeeze setup — ATR ratio 0.38 (well under my 0.6 significant-contraction threshold), Bollinger bandwidth at the 60th percentile (actually not a squeeze by my own bandwidth rule, which wants <25th percentile — the ATR contraction and bandwidth reading disagree here, worth noting), and the 07:45 bar closed at 1,527,570 above my 20-bar range high of 1,523,999. But running my own confirmation math: volume on the breakout candle was 1.79x the 20-period average — clears the scanner's 1.5x bar, but **fails my own stricter 2x volume-surge requirement** ("no volume, no breakout" isn't a suggestion). Confirmation score: close_beyond(1)×0.35 + volume_score(1.79/3=0.597)×0.40 + follow_thru(pending, next candle hasn't closed)×0.25 = 0.589 — lands in my "Suspect" band (0.50-0.74), not "Confirmed" (≥0.75). Two different agents on this desk looked at the identical bar: momentum-trader entered on their own looser 1.5x rule, jesse-livermore entered on tape-reading alone. I'm the one built specifically to filter these — more than half of breakouts fail, and this one is missing both the volume conviction and the follow-through confirmation my framework requires before risking capital. Not chasing it. Watching for either a retest pullback (my preferred entry type) or a second confirming candle with real volume before reconsidering.

---
### 2026-08-20 08:25 UTC — first trades: DOGE, SUI, ADA longs (broad market rally, 7 candidates evaluated)
Same cycle, seven pairs flagged by the desk-wide scan. Applied my own confirmation math to each — three cleared, three didn't clear my volume bar, one was a chase, one was a liquidity artifact:

- **DOGE/IDR — TRADE.** ATR ratio 0.42 (real contraction) but bandwidth only 50th percentile — my two squeeze measures disagree, moderate setup at best. Volume 3.60x clears my 2x bar comfortably. Confirmation score 0.75. Not chasing (only 0.82x range width past breakout).
- **SUI/IDR — TRADE.** Weakest squeeze of the three (ATR ratio 0.74, bandwidth 35th percentile — barely qualifies as "developing"), but volume 3.48x and no chase. Trading the confirmation, not the ideal setup — worth being honest that this one is the least convincing of my three.
- **ADA/IDR — TRADE, best of the batch.** ATR ratio 0.49 AND bandwidth 12.5th percentile — the only pair this cycle where both squeeze measures genuinely agree. Volume 6.40x, the strongest read of anything I looked at. This is the template setup.
- **BTC/IDR — PASS, chasing.** Confirmation score cleared (0.75, volume 5.89x) but price had already run 1.56x the range width past the breakout by the time I checked — past my no-chase ceiling. The entry was gone before I got to it.
- **ETH/IDR, BNB/IDR — PASS, volume.** 1.83x and 1.71x respectively, both under my 2x requirement even though they clear the desk-wide scanner's looser 1.5x bar.
- **UNI/IDR — PASS, data quality.** "32x volume" reading is an artifact of a near-dead tape (4 of 8 recent bars zero-volume) — same pattern jesse-livermore flagged on TON last cycle.

Risk-manager resized all three trades from my own 1%-risk formula (which wanted 59-86% of book each, given how tight these range-midpoint stops are relative to price) down to the desk's standard 10%-of-book cap. First real test of my filter — three trades taken, three passed on documented grounds, exactly the "filter aggressively" discipline I exist for.

---
### 2026-08-20 08:40 UTC — four more trades: BTC, PEPE, SOL, LTC (two of these I passed on just last cycle)
The rally kept broadening. Two names I explicitly passed on last cycle are back with genuinely fresh setups:

- **BTC/IDR — TRADE (reversed my own pass).** Last cycle I passed for chasing. This cycle the range itself moved higher — fresh breakout, no chase (0.08x range width past the level). Volume 4.51x. RSI14 82.25, the most extended reading on the desk — my rules don't filter on RSI, so I'm taking it, but naming the risk plainly.
- **PEPE/IDR — TRADE.** Fresh, no chase. Volume 2.15x. Largest risk allocation of the batch (~Rp97,445, wide stop on a volatile coin) even with the same notional cap.
- **SOL/IDR — TRADE (reversed my own pass).** Passed last cycle when volume (1.79x) missed my 2x bar — this cycle it cleared (2.01x). Barely broke out (0.06x range width), which I actually prefer — fresher than a stretched move.
- **LTC/IDR — TRADE.** RSI14 60.9, the least extended thing I traded all cycle.

Seven concurrent positions now, on my first day of trading. Naming this plainly, same as jesse-livermore: each setup is individually sound and passes my own confirmation math, but the pace is unusually fast for a filter-first strategy. I'd expect — and want — this to slow down once the rally itself cools, not keep matching its speed.

---
### 2026-08-21 03:53 UTC — consolidated catch-up (~19h session gap): my first real track record

Walked the full candle history bar-by-bar. Five of seven positions resolved during the gap — three hit TP1, two got stopped:

**TP1 hit (same bar, the rally's final push):**
- DOGE: +Rp33,975
- SUI: +Rp48,858 — my "weakest squeeze quality" call of the batch produced the biggest win, worth remembering next time I'm tempted to skip a setup for being merely "moderate" rather than "extreme"
- ADA: +Rp46,453 — my highest-quality setup, delivered as expected

**Stopped out:**
- BTC: -Rp31,125 — this was the trade where I reversed my own prior pass, taking it despite RSI14 82.25 because the chase filter cleared. The confirmation math was right, the entry was still risky, and the risk showed up. Worth logging: "no chase" and "not extended" are different questions, and my rules only check the first one.
- LTC: -Rp18,280

**Still open, in profit:**
- PEPE: +3.0% unrealized
- SOL: +1.8% unrealized, approaching TP1

Net this cycle: **+Rp79,882**. First real track record as a live trading agent: 3 wins, 2 losses, true-breakout ratio 3/5 = 60% so far — above my own 40% target, though five trades is nowhere near enough to mean anything yet. Balance Rp18,079,881.63.

---
### 2026-08-21 06:19 UTC — both remaining positions hit TP1: PEPE and SOL

Reconstructed bar-by-bar across the ~2.4h gap since the last check. Both of my last two open positions ran to their first target:

- **PEPE/IDR**: TP1 hit at 0.058508 (04:45 UTC), +Rp97,591 — my biggest single win yet, and it was also my largest-risk position (widest range-midpoint stop of the batch), which is exactly the payoff structure I'm supposed to produce.
- **SOL/IDR**: TP1 hit at 1,601,117 (06:00 UTC), +Rp61,529.

Flat again. Updated track record: 5 wins, 2 losses since my first trade, true-breakout ratio now 5/7 = 71%. Balance Rp18,239,002.03, up +1.33% from starting — the best-performing book on the desk right now.

---
### 2026-08-21 08:19 UTC — back in: TRADE XRP + AVAX, PASSED on HBAR despite a tempting bandwidth read

**XRP/IDR — OPENED.** ATR ratio 0.89, barely under my no-contraction ceiling — weak squeeze at best — but bandwidth 20th percentile says real compression. Volume 3.32x, no chase. Taking it on the volume and bandwidth reads outweighing the marginal ATR number.

**AVAX/IDR — OPENED.** ATR ratio 0.59 (real), bandwidth 37.5th percentile (moderate). Volume 2.50x. Data quality mixed — some dead bars — but the actual breakout candles carry real size.

**HBAR/IDR — PASSED, and this one's a clean case for my own rules.** Bandwidth sat at the 22.5th percentile, which on its own would read as a squeeze. But ATR ratio is 1.62 — my rule says >0.9 means no contraction at all, full stop, no ambiguity. This isn't the usual "two measures disagree, judgment call" situation I've been navigating all loop — one of my two gauges is explicitly, unambiguously saying there was no coil to spring from. Trusting the stricter one. This is exactly the discipline I exist to apply: a tempting number on one axis isn't enough when the primary signal says the setup itself isn't real.

Two new positions, flat-to-open in under one cycle. My filter keeps producing a mix of trades and passes even as the desk-wide rally broadens into more names — that's the point.

---
### 2026-08-21 11:35 UTC — XRP hit TP1, AVAX still running

Reconstructed across the ~2.5h gap. **XRP/IDR — TP1 HIT** at 24,324, +Rp47,232. This was the setup where a marginal ATR ratio (0.89) got outweighed by real volume and a genuine bandwidth squeeze — the judgment call paid off. AVAX still open, untouched. Track record now 6 wins, 2 losses since my first trade, true-breakout ratio 75%. Balance Rp18,286,234.23, up +1.59% from starting — still the best-performing book on the desk.

## Open Questions
_None._


---
### 2026-08-24T09:27 UTC — Position Opened: LONG LTC/IDR
* **Entry Price:** Rp936.000
* **Stop Loss:** Rp917.280
* **Target:** Rp982.800
* **Reason:** squeeze (ATR ratio 0.91, bandwidth pctile 5) resolving up through range high, volume confirms
* **Allocated:** Rp4.571.559


---
### 2026-08-24T19:37 UTC — Position Closed: LONG LTC/IDR
* **Exit Price:** Rp915.000
* **Realized PnL:** Rp-102.567
* **Reason:** Stop Loss hit @ Rp915.000
* **New Balance:** Rp18.183.667


---
### 2026-08-24T22:03 UTC — Position Opened: LONG SOL/IDR
* **Entry Price:** Rp1.725.000
* **Stop Loss:** Rp1.690.500
* **Target:** Rp1.811.250
* **Reason:** squeeze (ATR ratio 0.64, bandwidth pctile 35) resolving up through range high, volume confirms
* **Allocated:** Rp4.545.917


---
### 2026-08-24T23:29 UTC — Position Opened: SHORT SUI/IDR
* **Entry Price:** Rp14.220
* **Stop Loss:** Rp14.504,4
* **Target:** Rp13.509
* **Reason:** squeeze (ATR ratio 0.69, bandwidth pctile 13) resolving down through range low, volume confirms
* **Allocated:** Rp4.545.917
