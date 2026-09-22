import { NextResponse } from 'next/server';
import { PAIRS } from '@/lib/pairs';
import { fetchBinance24hStats } from '@/lib/binance';

export const dynamic = 'force-dynamic';

export interface PriceTick {
  symbol: string;
  price: number;
  changePct: number;
}

export async function GET() {
  const stats = await fetchBinance24hStats();
  const ticks: PriceTick[] = PAIRS.flatMap((pair) => {
    const ticker = stats.get(pair.symbol);
    return ticker ? [{ symbol: `${pair.symbol.toUpperCase()}/USDT`, price: ticker.lastPrice, changePct: ticker.priceChangePct }] : [];
  });

  return NextResponse.json({ ticks, fetchedAt: new Date().toISOString() });
}
