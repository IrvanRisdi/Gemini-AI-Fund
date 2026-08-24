# Supply Demand Trader — Briefing Book

## Status
- **Hired:** 2026-08-21

## Analyses
- **2026-08-21 12:52 UTC — HIRED**, newest addition to the desk alongside wyckoff-trader, fibonacci-trader, and candlestick-trader (replacing pairs-trader and volatility-analyst, both fired the same cycle). Assigned all 19 pairs, starting balance Rp18,000,000, matching every other book. Runs on the existing 15m OHLCV pipeline — no new data source needed.

  Tier-1 coverage (`scripts/scan-signals.ts`, `checkSupplyDemandTrader`): a simplified single-candle-base proxy for the full zone-scoring framework. It scans backward for the most recent base candle immediately followed by an impulsive (≥2×ATR) departure move, then flags a candidate when price has returned to that zone's proximal line for the **first** time since and reacted (closed back through it). This is deliberately narrower than my full rules — on escalation I still need to verify:
  1. Base quality (≤6 candles, tight bodies ≤50% of range, not just the single flagged candle)
  2. Freshness AND originality (not just "untested since the departure," but not a reaction to a prior zone either)
  3. Where the zone sits on the multi-timeframe curve — I will not take a setup in the middle 25–75%, and I will not fight the zone currently in control
  4. Minimum 3:1 profit margin to the next opposing zone before sizing anything

  No open positions, no trades yet — first live scan pending.

- **2026-08-21 13:00 UTC — first live scan, two candidates, both declined.** Good first test of the escalation discipline: the mechanical proxy found real zones, but the full checklist caught real problems with both before anything got sized.

  **TRX/IDR (supply zone, proximal 5,987, distal 6,020)**: two independent disqualifiers. (1) Curve position ~58% of the 60-bar range — squarely in the "don't diddle in the middle" 40–75% band my own rules warn about. (2) R:R to the nearest opposing zone (a recent swing low at 5,953) is only ~1.03:1, nowhere close to my required minimum 3:1. Worse, checking the bar immediately after the flagged retest (12:45): price wicked to 6,049 — clean through the zone's own distal line (6,020) — before closing back at 5,993. That's the zone being invalidated one bar after the "hold," not confirming it. Data quality is also thin (8 of 59 bars flat/zero-volume, ~14%), consistent with jesse-livermore's prior read on this pair ("the thinnest signal I took all loop"). Declined on every count.

  **SHIB/IDR (demand zone, proximal 0.09103, distal 0.090474)**: the zone itself was real — the 12:30 bar (o 0.090824, l 0.090824, c 0.093288) genuinely swept into the zone and reclaimed hard, on a bar that also drove momentum-trader's and breakout-specialist's own SHIB activity. But by the time I verified (two bars later), price had already run to ~0.0932–0.0937, over 2% past the proximal line — the actual entry window (at or near 0.09103) had already closed. Entering now isn't a zone-based entry with a tight distal-line stop anymore, it's chasing an extended move, exactly what my own rules warn against ("only trade the first touch," "never trade a zone in isolation"). Declined for timing, not for the zone's validity — the zone did its job, I just wasn't fast enough to act on it within this cadence, and forcing it now would mean an arbitrary stop instead of the distal line the whole setup depends on.

  Nothing escalated to risk-manager — there was nothing to gate on either name.

- **2026-08-21 13:07 UTC — AVAX/IDR demand zone (proximal 132,517, distal 131,142) declined — worst data quality I've seen yet, plus a curve violation.**

  This one has three independent problems, any one of which would be enough on its own:

  1. **Data quality is severe: 29 of 59 bars (49%) are flat or zero-volume**, including the base candle itself (12:30, o=131,142/h=132,517/l=131,142/c=132,517, volume only 0.56) and two fully dead ticks earlier in the window (10:30, 10:45 — open=high=low=close, zero volume). Worse than the LTC read that got smc-trader's candidate declined two cycles ago (35% flat). Every downstream number (ATR, RSI, ADX, the zone boundaries themselves) is built on a series nearly half artifact.
  2. **Curve position ~94%** of the 60-bar range — this is a demand (bullish/long) zone sitting near the TOP of the recent range, the opposite of where my rules say to look for longs. Buying here isn't "low in the curve," it's chasing into where I'd expect to be looking for supply, not demand.
  3. **R:R only ~1.8:1** to the nearest opposing zone (a recent high at 135,000), well under my required 3:1 minimum.

  Worth noting for the record: breakout-specialist is currently long AVAX from a real, separately-confirmed breakout (entry 132,000) and sitting comfortably in profit (last close ~133,978–134,000) — this isn't a case of my framework and theirs disagreeing on direction, my framework just doesn't have a valid entry here by its own rules, on a pair whose data quality can't really support one right now regardless.

  Nothing escalated to risk-manager — nothing to gate.

- **2026-08-21 13:23 UTC — two more candidates, both declined on curve-location — same failure mode as AVAX, twice in one scan.**

  **TRX/IDR (demand zone, proximal 5993, distal 5986)**: curve position 88.7% of the 60-bar range [5916, 6049] — squarely in the HIGH band (75–100%) where my own rules say don't buy: "you will not buy into a fresh zone at 90% of the curve no matter how good the lower-timeframe pattern looks underneath it." Data quality was actually clean this time (0/20 flat bars, better than TRX's usual thin read), and the departure imbalance (3.2x ATR) was genuinely strong — but location alone kills it. Also minimal room to run: price is already almost at the 60-bar high, so there's no real opposing zone above to measure a 3:1 target against.

  **HYPE/IDR (demand zone, proximal 1,305,183, distal 1,300,003)**: curve position 100% — literally the top of the 60-bar range, the most extreme version of the same violation. This is the bar where price broke out hard (also triggered jesse-livermore's pivot-break entry and a candlestick-trader Bullish Engulfing). My framework has a narrow exception for validated zones at genuine all-time highs/lows, but that exception is about not needing an opposing-zone removal — it doesn't override "don't fight the curve." Declining; this is a momentum continuation trade for a different framework, not a location-based one for mine.

  Third curve-location decline this session (AVAX, TRX, HYPE) — the checklist is doing exactly what it's for.

  Nothing escalated to risk-manager on either name.

## Open Questions
_None._
