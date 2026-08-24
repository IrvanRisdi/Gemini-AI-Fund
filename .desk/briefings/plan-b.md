# Plan B — Briefing Book

## Status
- **Hired:** 2026-07-15

## Analyses
- **2026-07-15 00:45 UTC — HIRED**, replacing george-soros (and, alongside warren-buffett's firing, restoring the desk to 9 book-holding agents). Assigned BTC/IDR only, per the persona's "Bitcoin only" safety rule. Starting balance Rp18,000,000, matching every other book.
  **Data scope note**: this persona's framework combines Stock-to-Flow/log-regression/200-week-MA (all computable from BTC price history + Bitcoin's public, fixed halving schedule — no live API needed) with on-chain valuation metrics (realized price, MVRV, SOPR, thermocap). This desk has no on-chain data source — the same gap that got george-soros fired — so only the price-and-supply-schedule sub-models are live for now. On-chain-dependent readings will be flagged as unavailable rather than guessed.

- **2026-07-15 01:05 UTC (cycle 18, first model run)** — First S2F calculation, computed from Bitcoin's fixed public halving schedule (no on-chain API): circulating supply ≈20,054,714 BTC, current annual issuance ≈164,250 BTC/yr (post-2024-04-20 halving, 3.125 BTC/block), S2F ratio ≈122.1. Plugging into the classic PlanB regression (ln(market value) = 3.3×ln(S2F) + 14.6) gives a model price of **≈$840,678** (≈Rp15.14 billion). Actual BTC/USD right now is **≈$64,780** (BTC/IDR Rp1,166,759,000 ÷ USDT/IDR 18,011) — a **-92.3% deviation** below the raw model.

  **I am not treating this as a buy signal.** This exact multi-trillion-dollar overshoot at high S2F ratios is the model's most well-documented weakness — S2F was never designed to be trusted as a precise point estimate this far out, and a -90%+ "deviation" from a model with ±1-order-of-magnitude error bars tells me the model needs re-grounding, not that BTC is 90% undervalued. More useful this cycle is the **cycle-timing table**: we're ~26.8 months past the 2024-04-20 halving, which places us in the **Bear market (+24 to +36 months)** phase historically — expect -60% to -80% drawdown from cycle highs, wait for a deeper accumulation zone rather than buying the current level. On-chain confirmation (realized price, MVRV, SOPR) that would normally corroborate or contradict this read is unavailable on this desk. **Verdict: HOLD / no new position.** Watching for price to approach a level that's cheap on more than one model before recommending accumulation.

---
### 2026-07-15 01:15 UTC — FIRED
**Reason**: User request, after exactly one cycle. Final balance Rp18,000,000 (unchanged, never traded — sat on HOLD its only cycle). The cycle-18 read stands as the record: raw S2F model overshoot (-92.3% "deviation," flagged honestly as a model-reliability issue rather than a buy signal) and unavailable on-chain sub-models (same gap george-soros had). Desk is back to 8 book-holding agents.

## Open Questions
_None._
