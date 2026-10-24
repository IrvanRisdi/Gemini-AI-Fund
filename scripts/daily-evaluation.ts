#!/usr/bin/env node
/**
 * Unified Daily Evaluation & Intelligence Report (Crypto Spot + IDX Stock NusaQuant)
 * Powered by Gemini 2.5 Pro (smartest reasoning model) with automatic fallback,
 * plus optional daily delivery to WhatsApp (Fonnte / CallMeBot / Webhook) & Telegram.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSmartestGeminiModelCandidates } from '../dashboard/lib/gemini-models.js';

const API_KEY = process.env.GEMINI_API_KEY;
const REPO_ROOT = fs.existsSync(path.resolve(process.cwd(), '.desk'))
  ? process.cwd()
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESK_DIR = path.join(REPO_ROOT, '.desk');
const STOCK_DESK_DIR = path.join(REPO_ROOT, 'stocks-engine/.stock-desk');
const BRIEFINGS_DIR = path.join(DESK_DIR, 'briefings');
const UNIFIED_REPORT_FILE = path.join(DESK_DIR, 'unified-daily-report.json');
const PRIMARY_AGENTS = [
  'breakout-specialist',
  'mean-reversion-trader',
  'smc-trader',
  'wyckoff-trader',
  'aggressive-breakout-trader',
  'asymmetry-journal-trader',
];

type AgentBook = {
  balance?: { IDR?: number };
  positions?: Record<
    string,
    {
      size?: number;
      entryPrice?: number;
      quoteCurrency?: 'IDR' | 'USDT';
      fxRateAtEntry?: number;
      costBasisIdr?: number;
      notional?: number;
    }
  >;
  pendingOrders?: Array<{
    pair?: string;
    status?: string;
    type?: string;
    quoteCurrency?: 'IDR' | 'USDT';
    entryLow?: number;
    entryHigh?: number;
    stopPrice?: number;
    targetPrice?: number;
  }>;
};

type Ledger = {
  mode?: string;
  last_cycle?: string;
  total_starting_capital?: number;
  agents?: Record<string, AgentBook>;
};

type Scan = {
  timestamp?: string;
  pairsScanned?: number;
  marketRegime?: {
    riskOn?: boolean;
    close?: number | null;
    ema21?: number | null;
    adx?: number | null;
    btcReturn24h?: number;
    reason?: string;
  };
  diagnostics?: Array<{
    pair: string;
    status: string;
    lastClose?: number | null;
    rsi14?: number | null;
    relativeVolume?: number | null;
  }>;
  asymmetryJournal?: {
    status?: string;
    btcFilter?: string;
    watchlist?: Array<{
      symbol?: string;
      pair?: string;
      score?: number;
      entryLow?: number;
      entryHigh?: number;
      stopPrice?: number;
      target1?: number;
      thesis?: string;
    }>;
  };
  candidates?: Array<{
    agent?: string;
    pair?: string;
    type?: string;
    quoteCurrency?: 'USDT';
    entryLow?: number;
    entryHigh?: number;
    stopPrice?: number;
    targetPrice?: number;
    reason?: string;
  }>;
  errors?: unknown[];
};

type StockDashboard = {
  generated_at?: string;
  market_phase?: string;
  agents?: Array<{
    id: string;
    name: string;
    equity: number;
    starting_equity: number;
    pnl_pct: number;
  }>;
  positions?: Array<{
    symbol: string;
    agent_name: string;
    lots: number;
    entry_price: number;
    last_price: number;
    pnl_pct: number;
  }>;
  screener?: Array<{
    symbol: string;
    name: string;
    sector?: string;
    last_price?: number | null;
    change_pct?: number | null;
    evaluation_score?: number | null;
    evaluation_status?: string | null;
  }>;
  latest_report?: {
    report_date?: string;
    snapshot?: {
      market_regime?: { label?: string; confidence?: number; breadth_positive_pct?: number };
      ihsg?: { close?: number; change_pct?: number; trend?: string; explanation?: string };
      setups?: Array<{
        rank?: number;
        symbol?: string;
        owner_agent_name?: string;
        entry_low?: number;
        stop_price?: number;
        target_price?: number;
        risk_reward?: number;
        rationale?: string;
      }>;
    };
  };
};

export interface UnifiedDailyReport {
  generatedAt: string;
  dateWib: string;
  session: 'ASIA_OPEN' | 'US_OPEN';
  modelUsed: string;
  portfolio: {
    cryptoEquityIdr: number;
    cryptoCashIdr: number;
    cryptoOpenPositions: number;
    cryptoPendingOrders: number;
    stockEquityIdr: number;
    stockOpenPositions: number;
    totalCombinedEquityIdr: number;
  };
  cryptoSummary: {
    posture: string;
    regimeReason: string;
    btcPriceUsdt: number | null;
    btcChange24hPct: number | null;
    pairsScanned: number;
    uptrendCount: number;
    topSetups: Array<{
      pair: string;
      agent: string;
      entry: string;
      stop: string;
      target: string;
      note: string;
    }>;
  };
  stockSummary: {
    marketPhase: string;
    ihsgTrend: string;
    ihsgClose: number | null;
    ihsgChangePct: number | null;
    regimeLabel: string;
    topSetups: Array<{
      symbol: string;
      name: string;
      agent: string;
      price: string;
      entry: string;
      stop: string;
      target: string;
      score: number | null;
      note: string;
    }>;
  };
  aiDigest: {
    headline: string;
    marketWeather: string;
    cryptoRecommendation: string;
    stockRecommendation: string;
    actionableTakeaway: string;
  };
  whatsappText: string;
}

function formatIdr(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUsdt(value: number) {
  return `${value.toLocaleString('en-US', {
    maximumFractionDigits: value >= 1000 ? 2 : value >= 1 ? 4 : 6,
  })} USDT`;
}

function displayPair(pair: string) {
  return `${pair
    .replace('/', '')
    .replace('_', '')
    .replace(/(?:idr|usdt)$/i, '')
    .toUpperCase()}/USDT`;
}

function getCurrentSession(): 'ASIA_OPEN' | 'US_OPEN' {
  return new Date().getUTCHours() >= 12 ? 'US_OPEN' : 'ASIA_OPEN';
}

function getWibDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function readJson<T>(fullPath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function buildFacts(ledger: Ledger, scan: Scan, stockDash: StockDashboard) {
  const agents = ledger.agents ?? {};
  const agentRows = PRIMARY_AGENTS.map((agent) => {
    const book = agents[agent] ?? {};
    const positions = Object.values(book.positions ?? {});
    const pending = (book.pendingOrders ?? []).filter((order) => order.status === 'pending');
    const cash = book.balance?.IDR ?? 0;
    const exposure = positions.reduce(
      (sum, p) =>
        sum +
        (p.notional ??
          p.costBasisIdr ??
          (p.size ?? 0) * (p.entryPrice ?? 0) * (p.quoteCurrency === 'USDT' ? p.fxRateAtEntry ?? 0 : 1)),
      0,
    );
    return { agent, cash, exposure, positions: positions.length, pending: pending.length };
  });

  const openPositions = agentRows.reduce((sum, row) => sum + row.positions, 0);
  const pendingOrders = agentRows.reduce((sum, row) => sum + row.pending, 0);
  const totalCash = agentRows.reduce((sum, row) => sum + row.cash, 0);
  const totalExposure = agentRows.reduce((sum, row) => sum + row.exposure, 0);
  const cryptoEquityIdr = totalCash + totalExposure || 300_000_000;
  const candidateCount = scan.candidates?.length ?? 0;
  const dataHealth = (scan.errors?.length ?? 0) === 0 ? 'NORMAL' : `PERLU DICEK (${scan.errors?.length} error)`;
  const posture =
    openPositions === 0 && pendingOrders === 0 && candidateCount === 0
      ? 'WAIT / SELEKTIF — menunggu konfirmasi setup probabilitas tinggi'
      : 'AKTIF SELEKTIF — pantau area entry & manajemen stop';

  const uptrendDiag = (scan.diagnostics ?? []).filter((d) => d.status === 'uptrend');

  // Top Crypto Setups: combine live scan candidates + Asymmetry watchlist + top 4H uptrends
  const cryptoTopSetups: UnifiedDailyReport['cryptoSummary']['topSetups'] = [];
  for (const c of (scan.candidates ?? []).slice(0, 4)) {
    cryptoTopSetups.push({
      pair: c.pair ? displayPair(c.pair) : '-',
      agent: c.agent ?? 'scanner',
      entry:
        c.entryLow != null && c.entryHigh != null
          ? `${formatUsdt(c.entryLow)} – ${formatUsdt(c.entryHigh)}`
          : '-',
      stop: c.stopPrice != null ? formatUsdt(c.stopPrice) : '-',
      target: c.targetPrice != null ? formatUsdt(c.targetPrice) : '-',
      note: c.reason ?? 'Setup teknikal tervalidasi (PF > 1,0)',
    });
  }
  for (const w of (scan.asymmetryJournal?.watchlist ?? []).slice(0, 3)) {
    if (cryptoTopSetups.length >= 5) break;
    const pairLabel = w.pair ? displayPair(w.pair) : `${w.symbol ?? 'COIN'}/USDT`;
    if (cryptoTopSetups.some((s) => s.pair === pairLabel)) continue;
    cryptoTopSetups.push({
      pair: pairLabel,
      agent: 'asymmetry-journal-trader',
      entry:
        w.entryLow != null && w.entryHigh != null
          ? `${formatUsdt(w.entryLow)} – ${formatUsdt(w.entryHigh)}`
          : 'Area Pullback EMA20/50',
      stop: w.stopPrice != null ? formatUsdt(w.stopPrice) : '-3,5% s/d -5,0%',
      target: w.target1 != null ? formatUsdt(w.target1) : '+1,8R s/d +2,2R',
      note: w.thesis ?? `Skor Fundamental On-Chain ${w.score ?? '-'}/100 · Tunggu pullback sehat`,
    });
  }
  for (const d of uptrendDiag.slice(0, 3)) {
    if (cryptoTopSetups.length >= 4) break;
    const pairLabel = displayPair(d.pair);
    if (cryptoTopSetups.some((s) => s.pair === pairLabel)) continue;
    const px = d.lastClose ?? 0;
    cryptoTopSetups.push({
      pair: pairLabel,
      agent: 'Watchlist 4H Uptrend',
      entry: px > 0 ? `Dekat ${formatUsdt(px * 0.99)}` : '-',
      stop: px > 0 ? formatUsdt(px * 0.955) : '-',
      target: px > 0 ? formatUsdt(px * 1.09) : '-',
      note: `Struktur 4H Uptrend (RSI ${d.rsi14?.toFixed(0) ?? '-'}, RVOL ${d.relativeVolume?.toFixed(1) ?? '-'}x) — pantau breakout/pullback`,
    });
  }

  // Stock Desk Facts
  const stockEquityIdr =
    (stockDash.agents ?? []).reduce((sum, a) => sum + Number(a.equity || 0), 0) || 500_000_000;
  const stockOpenPositions = (stockDash.positions ?? []).length;
  const reportSnap = stockDash.latest_report?.snapshot;
  const ihsg = reportSnap?.ihsg;
  const stockRegime = reportSnap?.market_regime;

  const stockNameBySymbol = new Map(
    (stockDash.screener ?? []).map((s) => [s.symbol, { name: s.name, price: s.last_price, score: s.evaluation_score }]),
  );

  const stockTopSetups: UnifiedDailyReport['stockSummary']['topSetups'] = [];
  for (const s of (reportSnap?.setups ?? []).slice(0, 5)) {
    const sym = String(s.symbol ?? '');
    const info = stockNameBySymbol.get(sym);
    stockTopSetups.push({
      symbol: sym,
      name: info?.name ?? sym,
      agent: String(s.owner_agent_name ?? 'NusaQuant'),
      price: info?.price ? formatIdr(info.price) : '-',
      entry: s.entry_low ? formatIdr(Number(s.entry_low)) : '-',
      stop: s.stop_price ? formatIdr(Number(s.stop_price)) : '-',
      target: s.target_price ? formatIdr(Number(s.target_price)) : '-',
      score: info?.score ?? null,
      note: String(s.rationale ?? 'Setup prioritas harian BEI'),
    });
  }

  if (stockTopSetups.length === 0) {
    const topScreener = [...(stockDash.screener ?? [])]
      .sort((a, b) => (b.evaluation_score ?? -1) - (a.evaluation_score ?? -1))
      .slice(0, 5);
    for (const row of topScreener) {
      const px = row.last_price ?? 0;
      stockTopSetups.push({
        symbol: row.symbol,
        name: row.name,
        agent: row.evaluation_status === 'ACTIONABLE' ? 'Actionable Setup' : 'Top Screener IDX',
        price: px > 0 ? formatIdr(px) : '-',
        entry: px > 0 ? formatIdr(Math.round(px)) : '-',
        stop: px > 0 ? formatIdr(Math.round(px * 0.96)) : '-',
        target: px > 0 ? formatIdr(Math.round(px * 1.08)) : '-',
        score: row.evaluation_score ?? null,
        note: `Sektor ${row.sector ?? 'BEI'} · Skor teknikal & likuiditas ${row.evaluation_score ?? '-'}/100`,
      });
    }
  }

  return {
    agentRows,
    openPositions,
    pendingOrders,
    totalCash,
    totalExposure,
    cryptoEquityIdr,
    candidateCount,
    dataHealth,
    posture,
    uptrendCount: uptrendDiag.length,
    cryptoTopSetups,
    stockEquityIdr,
    stockOpenPositions,
    ihsg,
    stockRegime,
    stockTopSetups,
  };
}

function buildFallbackDigest(
  facts: ReturnType<typeof buildFacts>,
  scan: Scan,
  stockDash: StockDashboard,
): UnifiedDailyReport['aiDigest'] {
  const btcPx = scan.marketRegime?.close ? formatUsdt(scan.marketRegime.close) : 'stabil';
  const ihsgTrend = facts.ihsg?.trend ?? 'NEUTRAL';
  const ihsgPx = facts.ihsg?.close ? formatIdr(facts.ihsg.close) : 'menunggu penutupan BEI';
  const topCoins = facts.cryptoTopSetups.map((c) => c.pair).slice(0, 3).join(', ') || 'BTC/USDT, ETH/USDT, SOL/USDT';
  const topStocks = facts.stockTopSetups.map((s) => s.symbol).slice(0, 3).join(', ') || 'BBCA, BMRI, TLKM';

  return {
    headline: `Fokus Selektif: Pantau ${topCoins} di Kripto & ${topStocks} di Saham IDX dengan Disiplin Stop-Loss Ketat`,
    marketWeather: `Pasar Kripto saat ini berada pada fase ${scan.marketRegime?.riskOn ? 'Konstruktif (Risk-On)' : 'Selektif / Konsolidasi'} dengan harga acuan BTC di ${btcPx} (${facts.uptrendCount} pair dalam tren naik 4H). Sementara itu, indeks saham Indonesia (IHSG) berada di level ${ihsgPx} dengan kecenderungan ${ihsgTrend} (fase pasar: ${stockDash.market_phase ?? 'CLOSED'}). Artinya, kita tidak perlu terburu-buru mengejar harga yang sudah naik tinggi; fokuslah pada aset yang sedang berada di area beli (pullback/breakout valid).`,
    cryptoRecommendation:
      facts.cryptoTopSetups.length > 0
        ? `Prioritaskan pemantauan pada ${topCoins}. Gunakan strategi antre beli (limit/pullback) atau tunggu penutupan candle 4H yang kuat. Pastikan batas rugi (stop-loss) selalu terpasang sekitar 3,5%–5% di bawah harga beli dan geser stop ke titik impas (breakeven) segera setelah profit berjalan +1,25R.`
        : `Saat ini belum ada koin yang memicu sinyal beli instan pada scanner 15m/4H. Langkah terbaik adalah menahan kas tetap aman (Rp${Math.round(facts.totalCash / 1_000_000)} juta siap pakai) sambil memantau koin berfundamental kuat di daftar pantauan.`,
    stockRecommendation:
      facts.stockTopSetups.length > 0
        ? `Di Bursa Efek Indonesia (BEI), saham dengan skor dan struktur terbaik hari ini adalah ${topStocks}. Seluruh order harian menggunakan aturan NEXT_OPEN (eksekusi pada pembukaan sesi berikutnya jika tidak terjadi gap >2%) serta dilindungi buffer 30 menit pertama (09:00–09:30 WIB) agar tidak terkena gocekan jarum bawah pembukaan pasar.`
        : `Pasar saham IDX sedang menunggu sinyal pembukaan sesi berikutnya. Hindari membeli saham berlikuiditas tipis (<Rp15 Miliar/hari) agar tidak terjebak biaya broker.`,
    actionableTakeaway: `Total modal kelolaan gabungan saat ini adalah ${formatIdr(facts.cryptoEquityIdr + facts.stockEquityIdr)} (${formatIdr(facts.cryptoEquityIdr)} di Kripto Spot & ${formatIdr(facts.stockEquityIdr)} di Saham IDX). Gunakan maksimal 1–3% risiko per transaksi dan biarkan sistem mengeksekusi hanya peluang dengan rasio untung-rugi (Reward/Risk) minimal 1,8x hingga 3,0x setelah biaya.`,
  };
}

async function generateSmartGeminiDigest(
  facts: ReturnType<typeof buildFacts>,
  scan: Scan,
  stockDash: StockDashboard,
): Promise<{ digest: UnifiedDailyReport['aiDigest']; modelUsed: string }> {
  const fallback = buildFallbackDigest(facts, scan, stockDash);
  if (!API_KEY) {
    return { digest: fallback, modelUsed: 'rule-based-analyst' };
  }

  const contextPayload = {
    portfolio: {
      cryptoEquityIdr: facts.cryptoEquityIdr,
      cryptoOpenPositions: facts.openPositions,
      stockEquityIdr: facts.stockEquityIdr,
      stockOpenPositions: facts.stockOpenPositions,
    },
    cryptoMarket: {
      btcPriceUsdt: scan.marketRegime?.close ?? null,
      btcChange24hPct: scan.marketRegime?.btcReturn24h ?? null,
      regimeReason: scan.marketRegime?.reason ?? null,
      pairsScanned: scan.pairsScanned ?? 0,
      uptrend4hCount: facts.uptrendCount,
      topSetups: facts.cryptoTopSetups,
    },
    idxStockMarket: {
      marketPhase: stockDash.market_phase ?? 'CLOSED',
      ihsgClose: facts.ihsg?.close ?? null,
      ihsgChangePct: facts.ihsg?.change_pct ?? null,
      ihsgTrend: facts.ihsg?.trend ?? 'NEUTRAL',
      breadthPositivePct: facts.stockRegime?.breadth_positive_pct ?? null,
      topSetups: facts.stockTopSetups,
    },
  };

  const prompt = `Anda adalah Chief Investment Officer (CIO) pribadi yang sangat cerdas, komunikatif, dan berpengalaman di pasar Kripto Spot (Binance USDT) dan Saham Indonesia (BEI/IDX).
Tugas Anda: Analisis data faktual meja perdagangan di bawah ini dan buat laporan harian terpadu (Kripto + Saham IDX) dalam Bahasa Indonesia yang SANGAT MUDAH DIMENGERTI oleh pembaca (hindari jargon kaku tanpa penjelasan, gunakan bahasa yang mengalir, jelas, dan langsung memberi panduan praktis).

Data Faktual Hari Ini:
${JSON.stringify(contextPayload)}

Kembalikan HANYA objek JSON valid (tanpa markdown codefence \`\`\`json) dengan 5 kunci string berikut:
{
  "headline": "Judul ringkas 1 kalimat yang merangkum sikap terbaik hari ini untuk Kripto & Saham IDX",
  "marketWeather": "Penjelasan 2-3 kalimat tentang kondisi pasar Kripto (BTC) dan Saham Indonesia (IHSG) hari ini dengan bahasa sehari-hari yang mudah dipahami",
  "cryptoRecommendation": "Rekomendasi jelas 2-4 kalimat untuk Kripto Spot hari ini: sebutkan koin di topSetups beserta area beli/stop/target dan cara menyikapinya",
  "stockRecommendation": "Rekomendasi jelas 2-4 kalimat untuk Saham IDX hari ini: sebutkan saham di topSetups beserta level harga dan alasan mengapa menarik",
  "actionableTakeaway": "Panduan praktis pengelolaan modal dan manajemen risiko hari ini dalam 2 kalimat yang menenangkan dan tegas"
}`;

  for (const model of getSmartestGeminiModelCandidates(process.env.GEMINI_MODEL || process.env.GEMINI_MODELS || '')) {
    try {
      const isDeepReasoning = model.includes('argon') || model.includes('pro');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: isDeepReasoning ? 4096 : 2048,
              responseMimeType: 'application/json',
              ...(isDeepReasoning ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
            },
          }),
        },
      );
      if (!response.ok) continue;
      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
      };
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('')
        .trim();
      if (!text) continue;
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned) as Partial<UnifiedDailyReport['aiDigest']>;
      if (parsed.headline && parsed.marketWeather && parsed.cryptoRecommendation && parsed.stockRecommendation) {
        return {
          digest: {
            headline: parsed.headline,
            marketWeather: parsed.marketWeather,
            cryptoRecommendation: parsed.cryptoRecommendation,
            stockRecommendation: parsed.stockRecommendation,
            actionableTakeaway: parsed.actionableTakeaway || fallback.actionableTakeaway,
          },
          modelUsed: model,
        };
      }
    } catch {
      // Fall through to next model candidate
    }
  }

  return { digest: fallback, modelUsed: 'rule-based-analyst' };
}

function buildWhatsAppMessage(report: UnifiedDailyReport): string {
  const cryptoLines =
    report.cryptoSummary.topSetups.length > 0
      ? report.cryptoSummary.topSetups
          .slice(0, 3)
          .map(
            (s, idx) =>
              `${idx + 1}. *${s.pair}* (${s.agent})\n   • Area Beli: ${s.entry}\n   • Stop: ${s.stop} | Target: ${s.target}\n   • Catatan: ${s.note}`,
          )
          .join('\n')
      : '• Belum ada sinyal beli instan; tahan kas & pantau watchlist.';

  const stockLines =
    report.stockSummary.topSetups.length > 0
      ? report.stockSummary.topSetups
          .slice(0, 3)
          .map(
            (s, idx) =>
              `${idx + 1}. *${s.symbol}* (${s.name})\n   • Entry: ${s.entry} | Stop: ${s.stop} | Target: ${s.target}\n   • Catatan: ${s.note}`,
          )
          .join('\n')
      : '• Menunggu pembukaan bursa sesi berikutnya.';

  return [
    `📊 *LAPORAN HARIAN GEMINI AI-FUND*`,
    `📅 Tanggal: ${report.dateWib} (${report.session === 'US_OPEN' ? 'Edisi Sore/Malam' : 'Edisi Pagi Terpadu'})`,
    `🧠 Analis AI: *${report.modelUsed}*`,
    ``,
    `💡 *Intisari Hari Ini:*`,
    `${report.aiDigest.headline}`,
    ``,
    `🌤️ *Cuaca Pasar (Kripto & Saham IDX):*`,
    `${report.aiDigest.marketWeather}`,
    ``,
    `🪙 *Rekomendasi & Pantauan Kripto Spot:*`,
    `${report.aiDigest.cryptoRecommendation}`,
    `${cryptoLines}`,
    ``,
    `📈 *Rekomendasi & Pantauan Saham IDX (BEI):*`,
    `${report.aiDigest.stockRecommendation}`,
    `${stockLines}`,
    ``,
    `💼 *Status Portofolio Paper Trading:*`,
    `• Total Ekuitas Gabungan: *${formatIdr(report.portfolio.totalCombinedEquityIdr)}*`,
    `• Desk Kripto (6 Agen): ${formatIdr(report.portfolio.cryptoEquityIdr)} (${report.portfolio.cryptoOpenPositions} posisi aktif)`,
    `• Desk Saham IDX (5 Agen): ${formatIdr(report.portfolio.stockEquityIdr)} (${report.portfolio.stockOpenPositions} posisi aktif)`,
    ``,
    `🛡️ *Panduan Risiko:*`,
    `${report.aiDigest.actionableTakeaway}`,
  ].join('\n');
}

export async function deliverDailyReportNotifications(message: string): Promise<string[]> {
  const delivered: string[] = [];

  // Telegram Bot (Official Bot API — 100% Free & Reliable)
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHAT_ID;
  if (tgToken && tgChatId) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: message,
        }),
      });
      if (res.ok) {
        delivered.push(`Telegram Bot (chat_id: ${tgChatId})`);
      } else {
        const detail = await res.text().catch(() => '');
        console.warn(`Telegram API status ${res.status}: ${detail.slice(0, 180)}`);
      }
    } catch (err) {
      console.warn('Telegram delivery warning:', err);
    }
  }

  return delivered;
}

function buildMarkdownReport(report: UnifiedDailyReport, facts: ReturnType<typeof buildFacts>, ledger: Ledger, scan: Scan) {
  const label = report.session === 'US_OPEN' ? 'Edisi Sore/Malam' : 'Edisi Pagi Terpadu';
  const rows = facts.agentRows
    .map((r) => `| ${r.agent} | ${formatIdr(r.cash)} | ${formatIdr(r.exposure)} | ${r.positions} | ${r.pending} |`)
    .join('\n');
  const cryptoCandidates =
    report.cryptoSummary.topSetups
      .map((c) => `| ${c.agent} | ${c.pair} | ${c.entry} | ${c.stop} | ${c.target} | ${c.note} |`)
      .join('\n') || '| - | - | - | - | - | - |';
  const stockCandidates =
    report.stockSummary.topSetups
      .map((s) => `| ${s.symbol} (${s.name}) | ${s.agent} | ${s.entry} | ${s.stop} | ${s.target} | ${s.note} |`)
      .join('\n') || '| - | - | - | - | - | - |';

  return `# Laporan Harian Terpadu (Kripto & Saham IDX) — ${label}

> Disusun oleh **${report.modelUsed}** berdasarkan data faktual Kripto Spot (Binance USDT) dan Saham Indonesia (BEI/IDX NusaQuant).

## 1. Intisari & Cuaca Pasar Hari Ini

**${report.aiDigest.headline}**

${report.aiDigest.marketWeather}

- **Rekomendasi Kripto Spot:** ${report.aiDigest.cryptoRecommendation}
- **Rekomendasi Saham IDX:** ${report.aiDigest.stockRecommendation}
- **Panduan Risiko & Modal:** ${report.aiDigest.actionableTakeaway}

## 2. Peluang & Watchlist Kripto Spot Terbaik

| Agen / Sumber | Pair | Area Beli (Entry) | Batas Rugi (Stop) | Target Profit | Catatan Analisis |
| --- | --- | --- | --- | --- | --- |
${cryptoCandidates}

## 3. Peluang & Watchlist Saham IDX (BEI) Terbaik

| Emiten | Strategi Agen | Area Beli (Entry) | Batas Rugi (Stop) | Target Profit | Catatan Analisis |
| --- | --- | --- | --- | --- | --- |
${stockCandidates}

## 4. Ringkasan Ekuitas & Eksposur Desk

| Kelas Aset | Total Ekuitas | Posisi Terbuka | Status Siklus |
| --- | ---: | ---: | --- |
| **Kripto Spot (6 Agen v6)** | ${formatIdr(report.portfolio.cryptoEquityIdr)} | ${report.portfolio.cryptoOpenPositions} posisi (${report.portfolio.cryptoPendingOrders} pending) | ${ledger.last_cycle ?? scan.timestamp ?? '-'} |
| **Saham IDX (5 Agen v3)** | ${formatIdr(report.portfolio.stockEquityIdr)} | ${report.portfolio.stockOpenPositions} posisi | Fase ${report.stockSummary.marketPhase} |
| **Total Portofolio Gabungan** | **${formatIdr(report.portfolio.totalCombinedEquityIdr)}** | **${report.portfolio.cryptoOpenPositions + report.portfolio.stockOpenPositions} posisi** | **Data ${facts.dataHealth}** |

### Rincian Buku 6 Agen Kripto Spot

| Agen Kripto | Kas Tersedia | Eksposur Spot | Posisi | Pending |
| --- | ---: | ---: | ---: | ---: |
${rows}
`;
}

async function main() {
  const session = getCurrentSession();
  const now = new Date().toISOString();
  const dateWib = getWibDate(now);
  const ledger = readJson<Ledger>(path.join(DESK_DIR, 'paper-ledger.json'), {});
  const scan = readJson<Scan>(path.join(DESK_DIR, 'latest-scan.json'), {});
  const stockDash = readJson<StockDashboard>(path.join(STOCK_DESK_DIR, 'dashboard.json'), {});

  const facts = buildFacts(ledger, scan, stockDash);
  const { digest, modelUsed } = await generateSmartGeminiDigest(facts, scan, stockDash);

  const report: UnifiedDailyReport = {
    generatedAt: now,
    dateWib,
    session,
    modelUsed,
    portfolio: {
      cryptoEquityIdr: facts.cryptoEquityIdr,
      cryptoCashIdr: facts.totalCash,
      cryptoOpenPositions: facts.openPositions,
      cryptoPendingOrders: facts.pendingOrders,
      stockEquityIdr: facts.stockEquityIdr,
      stockOpenPositions: facts.stockOpenPositions,
      totalCombinedEquityIdr: facts.cryptoEquityIdr + facts.stockEquityIdr,
    },
    cryptoSummary: {
      posture: facts.posture,
      regimeReason: scan.marketRegime?.reason ?? 'Menunggu sinyal konfirmasi multi-timeframe',
      btcPriceUsdt: scan.marketRegime?.close ?? null,
      btcChange24hPct: scan.marketRegime?.btcReturn24h ?? null,
      pairsScanned: scan.pairsScanned ?? 0,
      uptrendCount: facts.uptrendCount,
      topSetups: facts.cryptoTopSetups,
    },
    stockSummary: {
      marketPhase: stockDash.market_phase ?? 'CLOSED',
      ihsgTrend: facts.ihsg?.trend ?? 'NEUTRAL',
      ihsgClose: facts.ihsg?.close ?? null,
      ihsgChangePct: facts.ihsg?.change_pct ?? null,
      regimeLabel: facts.stockRegime?.label ?? 'SELECTIVE',
      topSetups: facts.stockTopSetups,
    },
    aiDigest: digest,
    whatsappText: '',
  };
  report.whatsappText = buildWhatsAppMessage(report);

  fs.mkdirSync(BRIEFINGS_DIR, { recursive: true });
  fs.writeFileSync(UNIFIED_REPORT_FILE, JSON.stringify(report, null, 2) + '\n', 'utf8');

  const filename = `session-review-${dateWib}-${session.toLowerCase()}.md`;
  const markdownOutput = `---\ndate: "${dateWib}"\ntime: "${now}"\nsession: "${session}"\nreport_version: "unified-v6"\nmodel: "${modelUsed}"\n---\n\n${buildMarkdownReport(report, facts, ledger, scan)}`;
  fs.writeFileSync(path.join(BRIEFINGS_DIR, filename), markdownOutput, 'utf8');

  const delivered = await deliverDailyReportNotifications(report.whatsappText);
  console.log(`✓ Unified daily report written: ${UNIFIED_REPORT_FILE} (model: ${modelUsed})`);
  console.log(`✓ Session briefing written: ${path.join(BRIEFINGS_DIR, filename)}`);
  if (delivered.length > 0) {
    console.log(`✓ Daily report delivered to: ${delivered.join(', ')}`);
  } else {
    console.log('ℹ No external WhatsApp/Telegram credentials configured in env; saved to web dashboard.');
  }
}

main().catch((error) => {
  console.error('✗ Evaluation failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
