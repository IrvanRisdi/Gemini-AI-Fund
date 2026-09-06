import { NextResponse } from 'next/server';
import { PAIRS } from '@/lib/pairs';
import { fetchCoinOhlcv } from '@/lib/coin-market';

export const dynamic = 'force-dynamic';

interface IndodaxTicker {
  ticker: { buy: string; sell: string; last: string; high: string; low: string; server_time: number };
}

export interface PriceTick {
  symbol: string;
  price: number;
  changePct: number;
}

export async function GET() {
  const results = await Promise.allSettled(
    PAIRS.map(async (pair): Promise<PriceTick> => {
      if (pair.venue === 'kraken') {
        const candles = await fetchCoinOhlcv(pair.indodaxId, '1d', 2);
        const latest = candles.at(-1);
        const prior = candles.at(-2);
        if (!latest) throw new Error(`${pair.symbol} external price unavailable`);
        const changePct = prior ? ((latest.close - prior.close) / prior.close) * 100 : 0;
        return { symbol: `${pair.symbol.toUpperCase()}/IDR*`, price: latest.close, changePct };
      }
      const res = await fetch(`https://indodax.com/api/ticker/${pair.indodaxId}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`indodax ${pair.symbol} ${res.status}`);
      const data = (await res.json()) as IndodaxTicker;
      const last = parseFloat(data.ticker.last);
      const high = parseFloat(data.ticker.high);
      const low = parseFloat(data.ticker.low);
      // Indodax's public ticker doesn't expose a 24h-open field, so this is a
      // range-position proxy (last vs. the midpoint of today's high/low), not
      // a true 24h percent change.
      const mid = (high + low) / 2;
      const changePct = mid > 0 ? ((last - mid) / mid) * 100 : 0;
      return { symbol: `${pair.symbol.toUpperCase()}/IDR`, price: last, changePct };
    })
  );

  const ticks: PriceTick[] = results
    .filter((r): r is PromiseFulfilledResult<PriceTick> => r.status === 'fulfilled')
    .map((r) => r.value);

  return NextResponse.json({ ticks, fetchedAt: new Date().toISOString() });
}
