#!/usr/bin/env node
/**
 * Unified Backtester — Single Source of Truth
 * Calls evaluateWyckoff4HAt & evaluateSmc1HBearAt directly from strategies.ts,
 * enforces Solusi #4 (precision & Partial TP1 auto-fallback), and runs
 * Blind-Spot #5 sensitivity check (standard fill vs strict 0.08% penetration fill).
 */
import { computeIndicators } from './indicators.js';
import {
  fetchKlinesRange,
  getPrecisionForSymbol,
  loadPrecisionMap,
  planOrderExecution,
} from './market-data.js';
import {
  breakevenStopPrice,
  computeBtcRegimeAt,
  DEFAULT_FEE_PER_SIDE,
  evaluateSmc1HBearAt,
  evaluateWyckoff4HAt,
} from './strategies.js';
import type { OHLCV, SignalCandidate } from './types.js';

const COINS = (
  process.env.BACKTEST_COINS ?? 'ETHUSDT,SOLUSDT,DOGEUSDT,ADAUSDT,LINKUSDT,SUIUSDT'
)
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const DAYS = Number(process.env.BACKTEST_DAYS ?? 365);
const START_EQUITY = Number(process.env.BACKTEST_CAPITAL_USD ?? 1000);
const STRICT_PENETRATION = Number(process.env.STRICT_FILL_PCT ?? 0.0008); // 0.08%
const FUNDING_PER_8H = 0.0001;

interface SimTrade {
  agent: string;
  symbol: string;
  side: string;
  closedAt: number;
  rMultiple: number;
  partialTpEnabled: boolean;
}

function htfIndexAt(htfBars: OHLCV[], htfMs: number, closeTs: number, hint = 0): number {
  let i = Math.max(0, hint);
  while (i + 1 < htfBars.length && htfBars[i + 1]!.timestamp + htfMs <= closeTs) i++;
  return htfBars[i]!.timestamp + htfMs > closeTs ? -1 : i;
}

function simulateCandidate(
  bars: OHLCV[],
  atrArr: number[],
  idx: number,
  sig: SignalCandidate,
  strictPenetration: number,
  equityRef: number,
  precisionMap: Awaited<ReturnType<typeof loadPrecisionMap>>,
): { trade: SimTrade; closedIdx: number } | null {
  const expiryBars = sig.timeframe === '4h' ? Math.ceil(sig.expiryHours / 4) : sig.expiryHours;
  const timeStopBars = sig.timeframe === '4h' ? Math.ceil(sig.timeStopHours / 4) : sig.timeStopHours;

  let filledAt = -1;
  let entry = 0;
  for (let j = idx + 1; j <= Math.min(bars.length - 1, idx + expiryBars); j++) {
    const b = bars[j]!;
    if (sig.side === 'long' && b.low <= sig.stopPrice) return null;
    if (sig.side === 'short' && b.high >= sig.stopPrice) return null;

    const touched =
      sig.side === 'long'
        ? b.low <= sig.entryHigh * (1 - strictPenetration) && b.high >= sig.entryLow
        : b.high >= sig.entryLow * (1 + strictPenetration) && b.low <= sig.entryHigh;
    if (touched) {
      filledAt = j;
      entry =
        sig.side === 'long'
          ? Math.min(sig.entryHigh, Math.max(sig.entryLow, b.open))
          : Math.max(sig.entryLow, Math.min(sig.entryHigh, b.open));
      break;
    }
  }
  if (filledAt < 0) return null;
  if ((sig.side === 'long' && entry <= sig.stopPrice) || (sig.side === 'short' && entry >= sig.stopPrice)) {
    return null;
  }

  const initRisk = Math.abs(entry - sig.stopPrice);
  const netRiskPct = (initRisk + DEFAULT_FEE_PER_SIDE * (entry + sig.stopPrice)) / entry;
  const targetNotional = (equityRef * sig.conviction.baseRiskPct) / netRiskPct;
  const precision = getPrecisionForSymbol(sig.symbol, precisionMap);
  const execPlan = planOrderExecution(targetNotional, entry, sig.tp1Price, precision, 0.5);
  if (!execPlan.accepted) return null;

  let activeStop = sig.stopPrice;
  let tp1Hit = false;
  let remW = 1.0;
  let realizedNet = 0;
  let extremeFav = entry;
  const maxBar = Math.min(bars.length - 1, filledAt + timeStopBars);
  let closedAt = maxBar;
  let exit = bars[maxBar]!.close;

  for (let j = filledAt; j <= maxBar; j++) {
    const b = bars[j]!;
    const barAtr = Number.isFinite(atrArr[j]) ? atrArr[j]! : sig.atrAtSignal;
    const hrs = Math.max(0, (b.timestamp - bars[filledAt]!.timestamp) / 3_600_000);
    const fund = Math.floor(hrs / 8) * FUNDING_PER_8H;

    if (sig.side === 'long') {
      if (b.low <= activeStop) {
        exit = Math.min(activeStop, b.open < activeStop && j > filledAt ? b.open : activeStop);
        closedAt = j;
        break;
      }
      if (j > filledAt) {
        if (b.high > extremeFav) extremeFav = b.high;
        if (!tp1Hit && b.high >= sig.tp1Price) {
          if (!execPlan.partialTpEnabled) {
            exit = sig.tp1Price;
            closedAt = j;
            break;
          }
          realizedNet += 0.5 * ((sig.tp1Price - entry) / entry - DEFAULT_FEE_PER_SIDE * (1 + sig.tp1Price / entry) - fund);
          remW = 0.5;
          tp1Hit = true;
          activeStop = Math.max(activeStop, breakevenStopPrice('long', entry, DEFAULT_FEE_PER_SIDE));
        }
        if (tp1Hit) {
          activeStop = Math.max(activeStop, extremeFav - sig.trailAtrMultiple * barAtr);
        }
      }
    } else {
      if (b.high >= activeStop) {
        exit = Math.max(activeStop, b.open > activeStop && j > filledAt ? b.open : activeStop);
        closedAt = j;
        break;
      }
      if (j > filledAt) {
        if (b.low < extremeFav) extremeFav = b.low;
        if (!tp1Hit && b.low <= sig.tp1Price) {
          if (!execPlan.partialTpEnabled) {
            exit = sig.tp1Price;
            closedAt = j;
            break;
          }
          realizedNet += 0.5 * ((entry - sig.tp1Price) / entry - DEFAULT_FEE_PER_SIDE * (1 + sig.tp1Price / entry) - fund);
          remW = 0.5;
          tp1Hit = true;
          activeStop = Math.min(activeStop, breakevenStopPrice('short', entry, DEFAULT_FEE_PER_SIDE));
        }
        if (tp1Hit) {
          activeStop = Math.min(activeStop, extremeFav + sig.trailAtrMultiple * barAtr);
        }
      }
    }
  }

  const hrsTotal = Math.max(0, (bars[closedAt]!.timestamp - bars[filledAt]!.timestamp) / 3_600_000);
  const fundRem = Math.floor(hrsTotal / 8) * FUNDING_PER_8H;
  const grossRem = sig.side === 'long' ? (exit - entry) / entry : (entry - exit) / entry;
  const totalNet = realizedNet + remW * (grossRem - DEFAULT_FEE_PER_SIDE * (1 + exit / entry) - fundRem);
  const rMultiple = netRiskPct > 0 ? totalNet / netRiskPct : 0;

  return {
    trade: {
      agent: sig.agent,
      symbol: sig.symbol,
      side: sig.side,
      closedAt: bars[closedAt]!.timestamp,
      rMultiple,
      partialTpEnabled: execPlan.partialTpEnabled,
    },
    closedIdx: closedAt,
  };
}

function summarize(trades: SimTrade[]) {
  if (trades.length === 0) return { n: 0, wr: 0, pf: 0, ret1Pct: 0, maxDD: 0, partialFallbackCount: 0 };
  const sorted = [...trades].sort((a, b) => a.closedAt - b.closedAt);
  let wins = 0;
  let gw = 0;
  let gl = 0;
  let eq = 1;
  let peak = 1;
  let maxDD = 0;
  for (const t of sorted) {
    if (t.rMultiple > 0) {
      wins++;
      gw += t.rMultiple;
    } else {
      gl += Math.abs(t.rMultiple);
    }
    eq *= 1 + t.rMultiple * 0.01;
    if (eq > peak) peak = eq;
    maxDD = Math.max(maxDD, 1 - eq / peak);
  }
  return {
    n: sorted.length,
    wr: Number(((wins / sorted.length) * 100).toFixed(1)),
    pf: Number((gl > 0 ? gw / gl : 99).toFixed(2)),
    ret1Pct: Number(((eq - 1) * 100).toFixed(1)),
    maxDD: Number((maxDD * 100).toFixed(1)),
    partialFallbackCount: sorted.filter((t) => !t.partialTpEnabled).length,
  };
}

async function main() {
  const endMs = Date.now();
  const startMs = endMs - (DAYS + 40) * 86_400_000;
  const evalStartMs = endMs - DAYS * 86_400_000;

  console.log(
    `[Unified Backtest] Fetching ${DAYS}d candles for ${COINS.length} coins (Capital=$${START_EQUITY})...`,
  );
  const precisionMap = await loadPrecisionMap();
  const btc4Raw = await fetchKlinesRange('BTCUSDT', '4h', startMs, endMs);
  const btc4 = computeIndicators(btc4Raw);

  const d4Map = new Map<string, ReturnType<typeof computeIndicators>>();
  const d1Map = new Map<string, ReturnType<typeof computeIndicators>>();
  for (const sym of COINS) {
    const [b4, b1] = await Promise.all([
      fetchKlinesRange(sym, '4h', startMs, endMs),
      fetchKlinesRange(sym, '1h', startMs, endMs),
    ]);
    d4Map.set(sym, computeIndicators(b4));
    d1Map.set(sym, computeIndicators(b1));
  }

  for (const [label, pen] of [
    ['Standard Limit Fill (0.00%)', 0],
    [`Strict Limit Fill (${(STRICT_PENETRATION * 100).toFixed(2)}% penetration)`, STRICT_PENETRATION],
  ] as const) {
    const wykTrades: SimTrade[] = [];
    const smcTrades: SimTrade[] = [];

    for (const sym of COINS) {
      const d4 = d4Map.get(sym)!;
      const d1 = d1Map.get(sym)!;

      // Wyckoff-4H
      let avail4 = 200;
      let btcH4 = 0;
      for (let i = 200; i < d4.bars.length - 2; i++) {
        if (i < avail4 || d4.bars[i]!.timestamp < evalStartMs) continue;
        btcH4 = htfIndexAt(btc4.bars, 14_400_000, d4.bars[i]!.timestamp + 14_400_000, btcH4);
        const regime = computeBtcRegimeAt(btc4, btcH4);
        if (!regime) continue;
        const sig = evaluateWyckoff4HAt(sym, d4, i, regime);
        if (!sig || sig.conviction.baseLeverage === 0) continue;
        const res = simulateCandidate(d4.bars, d4.atr14, i, sig, pen, START_EQUITY * 0.7, precisionMap);
        if (res) {
          wykTrades.push(res.trade);
          avail4 = res.closedIdx + 1;
        }
      }

      // SMC-1H-Bear
      let avail1 = 200;
      let h4H = 0;
      let btcH1 = 0;
      for (let i = 200; i < d1.bars.length - 2; i++) {
        if (i < avail1 || d1.bars[i]!.timestamp < evalStartMs) continue;
        const closeTs = d1.bars[i]!.timestamp + 3_600_000;
        h4H = htfIndexAt(d4.bars, 14_400_000, closeTs, h4H);
        btcH1 = htfIndexAt(btc4.bars, 14_400_000, closeTs, btcH1);
        const regime = computeBtcRegimeAt(btc4, btcH1);
        if (!regime || h4H < 55) continue;
        const sig = evaluateSmc1HBearAt(sym, d1, i, d4.bars[h4H]!.close, d4.ema21[h4H]!, regime);
        if (!sig || sig.conviction.baseLeverage === 0) continue;
        const res = simulateCandidate(d1.bars, d1.atr14, i, sig, pen, START_EQUITY * 0.3, precisionMap);
        if (res) {
          smcTrades.push(res.trade);
          avail1 = res.closedIdx + 1;
        }
      }
    }

    console.log(`\n=== ${label} ===`);
    console.log('wyckoff-4h  :', summarize(wykTrades));
    console.log('smc-1h-bear :', summarize(smcTrades));
    console.log('COMBINED    :', summarize([...wykTrades, ...smcTrades]));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
