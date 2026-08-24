import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Pairs this desk's agents actually trade (see .desk/state.json assets_covered).
const PAIRS = ['btc', 'eth', 'sol', 'xrp', 'doge', 'pepe', 'sui', 'bnb'] as const;

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
      const res = await fetch(`https://indodax.com/api/ticker/${pair}idr`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`indodax ${pair} ${res.status}`);
      const data = (await res.json()) as IndodaxTicker;
      const last = parseFloat(data.ticker.last);
      const high = parseFloat(data.ticker.high);
      const low = parseFloat(data.ticker.low);
      // Indodax's public ticker doesn't expose a 24h-open field, so this is a
      // range-position proxy (last vs. the midpoint of today's high/low), not
      // a true 24h percent change.
      const mid = (high + low) / 2;
      const changePct = mid > 0 ? ((last - mid) / mid) * 100 : 0;
      return { symbol: `${pair.toUpperCase()}/IDR`, price: last, changePct };
    })
  );

  const ticks: PriceTick[] = results
    .filter((r): r is PromiseFulfilledResult<PriceTick> => r.status === 'fulfilled')
    .map((r) => r.value);

  return NextResponse.json({ ticks, fetchedAt: new Date().toISOString() });
}
