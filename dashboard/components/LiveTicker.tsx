'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PriceTick } from '@/app/api/prices/route';

const POLL_MS = 30_000;

function formatUsdt(value: number): string {
  const maximumFractionDigits = value >= 1000 ? 2 : value >= 1 ? 4 : 8;
  return value.toLocaleString('en-US', { maximumFractionDigits });
}

export function LiveTicker() {
  const [ticks, setTicks] = useState<PriceTick[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/prices', { cache: 'no-store' });
        const data = (await res.json()) as { ticks: PriceTick[] };
        if (!cancelled) setTicks(data.ticks);
      } catch {
        // network hiccup — keep showing the last known ticks
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (ticks.length === 0) return null;

  // Duplicate the row so the CSS translateX(-50%) loop is seamless.
  const row = [...ticks, ...ticks];

  return (
    <div className="fixed bottom-0 left-0 z-50 flex h-11 w-full items-center overflow-hidden border-t border-border bg-surface/95 backdrop-blur">
      <div className="flex shrink-0 animate-ticker items-center gap-8 pr-8 whitespace-nowrap will-change-transform">
        {row.map((tick, i) => (
          <Link
            key={`${tick.symbol}-${i}`}
            href={`/pair/${tick.symbol.split('/')[0].toLowerCase()}`}
            className="flex items-center gap-2 font-mono text-xs hover:opacity-80"
          >
            <span className="font-semibold text-ink">{tick.symbol}</span>
            <span className="text-ink-muted">{formatUsdt(tick.price)} USDT</span>
            <span className={tick.changePct >= 0 ? 'text-positive' : 'text-negative'}>
              {tick.changePct >= 0 ? '▲' : '▼'} {Math.abs(tick.changePct).toFixed(2)}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
