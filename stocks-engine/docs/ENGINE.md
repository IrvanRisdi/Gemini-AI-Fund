# NusaQuant delayed-paper engine

## Data boundary

Yahoo `.JK` is recorded as `DELAYED` with a configured delay of 10 minutes. It is suitable only for paper research. `NQ_ALLOW_DELAYED_PAPER=true` permits delayed fills; setting it to false makes the risk gate reject delayed proposals. Browser requests never invoke Yahoo or Arjum.

## Runtime flow

```text
IDX calendar gate -> Yahoo collector -> normalized candles -> timeframe-specific features
-> 5m: Scalping + Open=Low; Daily: Swing + Fundamental + Breakout–Retest
-> per-agent sizing -> fee-adjusted risk/reward -> portfolio cap + cooldown
-> pending paper order -> first eligible future 5m candle -> position/ledger/journal
-> report snapshot -> read-only dashboard
```

The evaluator budgets up to 3% equity risk per trade (the no-leverage notional cap can make realized risk smaller), 25% notional per order, 80% total agent exposure, and 10% aggregate open risk. Reward/risk must remain at least 1.5 after 0.15% buy and 0.25% sell fees. Orders cannot fill from a candle timestamp at or before the wall-clock decision time, and stops/targets cannot execute on the fill candle. If both touch in one later OHLC bar, the conservative stop outcome wins.

Scalping has a 60-active-minute time stop. Open=Low exits by the end of the session. Lunch and off-market time do not age a 5m order. A 30-active-minute symbol cooldown follows an intraday exit. The dashboard separates strategy v2 performance from retained `1.0-legacy` history.

## Cadence

- Intraday candidate universe: every 5 minutes during Session I/II.
- Pre-open: every 15 minutes from 08:30 WIB.
- Closing: every 5 minutes through closing processing.
- Post-close Daily scan/report: once per exchange day.
- Lunch, weekends, and validated exchange holidays: no run.

The intraday universe defaults to 50 cached candidates. The complete master universe is evaluated on Daily data after close. Scalping and Open=Low are active only as `paper-validation`; delayed Yahoo data is never represented as live execution.

## Commands

```powershell
python engine.py init
python engine.py status
python engine.py run --timeframe 5m --range 5d --force
python engine.py daemon --interval 60
```

Reference data must be imported before production:

```powershell
python engine.py import-universe idx_universe.csv
python engine.py import-holidays idx_holidays.json
python scripts/readiness.py
```

The scheduler uses an SQLite single-run lock with a 30-minute stale-lock timeout. Each run records counts, failures, proposals, orders, fills, and events. `/api/engine/status` exposes the latest audit state.

## Strategy status

- Swing: EMA trend, RSI, relative-volume gate.
- Scalping: 5m/15-minute-derived momentum, RSI, RVOL, and VWAP-distance gate; active delayed-paper validation.
- Open=Low: 5m one-tick session open/low plus VWAP/RVOL confirmation, limited to the first 60 active market minutes; active delayed-paper validation.
- Fundamental: returns `INCOMPLETE` until a validated fundamental snapshot exists.
- Breakout & Retest: prior Daily candle must break the 20-candle level and the following Daily candle must retest and close back above it; a one-candle breakout is not chased.

These rules are executable baselines, not validated alpha. Every strategy still requires historical backtest, walk-forward evaluation, and paper observation before its production status can become `validated`.
