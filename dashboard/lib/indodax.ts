import type { OHLCV } from './indicators';

// Indodax's TradingView-compatible candle endpoint. Same one ccxt's indodax
// adapter calls internally — fetched directly here so the dashboard doesn't
// need ccxt as a dependency of its own.
const TF_MAP: Record<string, string> = {
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': '1D',
};

interface RawCandle {
  Time: number;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: string | number;
}

export async function fetchOhlcv(indodaxId: string, timeframe: '15m' | '1h' | '4h' | '1d', limit: number): Promise<OHLCV[]> {
  const tf = TF_MAP[timeframe];
  const now = Math.floor(Date.now() / 1000);
  const durationSec = timeframe === '15m' ? 900 : timeframe === '1h' ? 3600 : timeframe === '4h' ? 14400 : 86400;
  const from = now - limit * durationSec - durationSec;

  const url = `https://indodax.com/tradingview/history_v2?symbol=${indodaxId}&tf=${tf}&from=${from}&to=${now}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`indodax history ${indodaxId} ${res.status}`);
  const raw = (await res.json()) as RawCandle[];

  return raw
    .map((c): OHLCV => ({
      timestamp: c.Time * 1000,
      open: c.Open,
      high: c.High,
      low: c.Low,
      close: c.Close,
      volume: typeof c.Volume === 'string' ? parseFloat(c.Volume) : c.Volume,
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit);
}
