#!/usr/bin/env node
/** Daily asymmetry screen for GitHub Actions: top-500 CoinGecko tokens x
 * DefiLlama holder revenue -> finalists -> draft pullback levels -> feed for
 * the asymmetry-journal-trader paper agent. Runs once per UTC day; later
 * trading-loop cycles reuse the feed. Pass --force to rebuild. */
import fs from 'node:fs';
import path from 'node:path';
import { fetchBinanceOhlcv, fetchBinanceSpotBases } from '../dashboard/lib/binance.js';
import { JOURNAL_FEED_PATH, type JournalFeed } from './asymmetry-journal.js';
import { buildFeed, scoreCoin, selectFinalists, shortlist, type Candle, type MarketCoin, type RevenueTotals, type ScreenRow } from './asymmetry-strategy.js';

const FEED = path.join(process.cwd(), JOURNAL_FEED_PATH);
const SCREEN_LOG = path.join(process.cwd(), '.desk', 'asymmetry-screen.json');
const DAY_MS = 86_400_000;

type LlamaOverview = { protocols: Array<{ name: string; id?: string; defillamaId?: string; parentProtocol?: string; category?: string; total30d?: number; total60dto30d?: number; total1y?: number }> };
type LlamaLite = { protocols: Array<{ id?: string; defillamaId?: string; gecko_id?: string | null }>; parentProtocols: Array<{ id: string; gecko_id?: string | null }> };

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function getJson<T>(url: string, tries = 4): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'gemini-ai-fund asymmetry-screen' } });
      if (response.ok) return await response.json() as T;
      // CoinGecko's free tier rate-limits shared CI IPs; back off and retry.
      if (attempt >= tries || (response.status !== 429 && response.status < 500)) throw new Error(`${response.status} ${url}`);
    } catch (error) {
      if (attempt >= tries) throw error;
    }
    await sleep(10_000 * attempt);
  }
}

function closedDaily(candles: Candle[], now: number) {
  return candles.filter((bar) => bar.timestamp + DAY_MS <= now);
}

async function revenueByGeckoId() {
  const lite = await getJson<LlamaLite>('https://api.llama.fi/lite/protocols2?b=2');
  const parentGecko = new Map(lite.parentProtocols.map((item) => [item.id, item.gecko_id ?? null]));
  const protocolGecko = new Map(lite.protocols.map((item) => [String(item.defillamaId ?? item.id), item.gecko_id ?? null]));
  const chainGecko = new Map((await getJson<Array<{ name: string; gecko_id?: string | null }>>('https://api.llama.fi/v2/chains')).map((item) => [item.name, item.gecko_id ?? null]));
  const totals = new Map<string, RevenueTotals>();
  const categories = new Map<string, string | null>();
  for (const [dataType, key] of [['dailyHoldersRevenue', 'hr'], ['dailyRevenue', 'rev']] as const) {
    const overview = await getJson<LlamaOverview>(`https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=${dataType}`);
    for (const item of overview.protocols) {
      const gecko = (item.parentProtocol ? parentGecko.get(item.parentProtocol) : null)
        ?? protocolGecko.get(String(item.defillamaId)) ?? protocolGecko.get(String(item.id))
        ?? (item.category === 'Chain' ? chainGecko.get(item.name) : null);
      if (!gecko) continue;
      const row = totals.get(gecko) ?? { hr30: 0, hrPrev30: 0, hr1y: 0, rev30: 0 };
      if (key === 'hr') { row.hr30 += item.total30d ?? 0; row.hrPrev30 += item.total60dto30d ?? 0; row.hr1y += item.total1y ?? 0; }
      else row.rev30 += item.total30d ?? 0;
      totals.set(gecko, row);
      if (!categories.has(gecko)) categories.set(gecko, item.category ?? null);
    }
  }
  return { totals, categories };
}

async function main() {
  const now = new Date();
  const reportDate = now.toISOString().slice(0, 10);
  try {
    const existing = JSON.parse(fs.readFileSync(FEED, 'utf8')) as JournalFeed;
    if (existing.reportDate === reportDate && !process.argv.includes('--force')) {
      console.log(`[Asymmetry] feed ${reportDate} already built; skipping`);
      return;
    }
  } catch {
    // No feed yet: build one.
  }

  const markets: MarketCoin[] = [];
  for (const page of [1, 2]) {
    markets.push(...await getJson<MarketCoin[]>(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&price_change_percentage=30d`));
    await sleep(6_000);
  }
  const { totals, categories } = await revenueByGeckoId();
  const rows = markets.flatMap((coin) => {
    const revenue = totals.get(coin.id);
    const row = revenue ? scoreCoin(coin, revenue, categories.get(coin.id) ?? null) : null;
    return row ? [row] : [];
  });
  const bases = await fetchBinanceSpotBases();
  if (!bases) throw new Error('Binance exchangeInfo unavailable; finalists cannot be checked for tradability');
  const { finalists, rejected } = selectFinalists(rows, bases);

  const btcCandles = closedDaily(await fetchBinanceOhlcv('btcusdt', '1d', 400), now.getTime());
  const withCandles: Array<{ row: ScreenRow; candles: Candle[] }> = [];
  for (const row of finalists) {
    const candles = closedDaily(await fetchBinanceOhlcv(`${row.ticker.toLowerCase()}usdt`, '1d', 400), now.getTime());
    if (candles.length >= 60) withCandles.push({ row, candles });
    else rejected.push({ ticker: row.ticker, reason: `riwayat candle harian ${candles.length} < 60` });
  }

  const feed = buildFeed({ now, reportDate, btcCandles, finalists: withCandles });
  fs.writeFileSync(FEED, JSON.stringify(feed, null, 2) + '\n');
  fs.writeFileSync(SCREEN_LOG, JSON.stringify({
    date: reportDate, generatedAt: now.toISOString(),
    universe: { scanned: markets.length, withRevenue: totals.size, passed: rows.length },
    shortlist: shortlist(rows), rejected,
  }, null, 2) + '\n');
  console.log(`[Asymmetry] ${reportDate}: ${rows.length} lolos screen, finalis ${feed.assets.map((asset) => asset.ticker).join(', ') || '—'}; BTC hijau di atas ${feed.btcFilter.greenAbove}`);
  for (const item of rejected) console.log(`  - ${item.ticker}: ${item.reason}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
