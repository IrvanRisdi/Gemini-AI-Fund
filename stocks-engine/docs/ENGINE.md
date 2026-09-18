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

Risk is strategy-specific after the recovery review: Scalping 1%, Open=Low 1.5%, Swing and Breakout–Retest 2%, Fundamental 1%. The budget is multiplied by 0.75 after a 5% agent drawdown and 0.50 after a 10% drawdown. Per-order notional caps are 10%, 15%, and 20% respectively. Total exposure/open-risk caps are isolated per agent (Scalping 30%/3%, Open=Low 45%/4.5%, Swing and Breakout 60%/6%, Fundamental 80%/8%). Reward/risk must remain at least 1.5 after 0.15% buy and 0.25% sell fees. Orders cannot fill from a candle timestamp at or before the wall-clock decision time, and stops/targets cannot execute on the fill candle. If both touch in one later OHLC bar, the conservative stop outcome wins.

Scalping and Open=Low have no intraday time stop. Stop-loss and target remain active throughout the session, and any surviving position exits on the final regular 5-minute candle at 15:45 WIB. An overnight safety exit closes a position at the next available open if the EOD cycle was missed. Lunch and off-market time do not age a 5m order. A 120-active-minute symbol cooldown follows an intraday exit. Each intraday agent is limited to three new entries per day, and new entries stop after realized daily loss reaches 2% of current equity. The dashboard separates strategy v2 performance from retained `1.0-legacy` history.

## Cadence

- Intraday candidate universe: every 5 minutes during Session I/II.
- Pre-open: every 15 minutes from 08:30 WIB.
- Closing: every 5 minutes through closing processing.
- Post-close Daily scan/report: once per exchange day.
- Lunch, weekends, and validated exchange holidays: no run.

The Daily discovery funnel uses a 100-name core ranked by adjusted average daily value plus up to 50 challengers ranked by technical score, relative volume, and Arjum screener priority. Both lanes must pass the same absolute liquidity and ATR gates. Up to 75 technical candidates are retained, while the intraday universe defaults to 75 symbols with open positions and pending orders pinned first. Arjum deep analysis remains limited to the best 20 setups. The complete master universe is evaluated on Daily data after close. Scalping and Open=Low are active only as `paper-validation`; delayed Yahoo data is never represented as live execution.

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

- Swing: EMA trend, RSI 52–66, RVOL ≥1.25, positive daily change, and anti-chasing distance from EMA20.
- Scalping: EMA20/50 trend, 15-minute momentum 0.35–1.25%, RSI 55–66, RVOL ≥2, and VWAP-distance 0.15–0.80%; active delayed-paper validation.
- Open=Low: 5m one-tick session open/low plus RSI/VWAP/RVOL confirmation, session gain and momentum bounds, limited to the first 45 active market minutes; active delayed-paper validation.
- Fundamental: returns `INCOMPLETE` until a validated fundamental snapshot exists.
- Breakout & Retest: prior Daily candle must break the 20-candle level and the following Daily candle must retest and close back above it, while trend, RVOL ≥1.5, RSI, and anti-chasing gates pass.

These rules are executable baselines, not validated alpha. Every strategy still requires historical backtest, walk-forward evaluation, and paper observation before its production status can become `validated`.
