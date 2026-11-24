#!/usr/bin/env node
/**
 * Weekly Forensic Review powered by Gemini 4 Carbon (Primary) -> Neon -> Argon.
 * Audits closed trades, MFE/MAE distribution, and Shadow A/B veto calibration,
 * updates distilled 3-layer memory (.futures-desk/memory/lessons.json),
 * and delivers a formatted Weekly Report to Telegram (matching Daily Report style).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWeeklyForensicWithCarbon, type WeeklyForensicResult } from './gemini-evaluator.js';
import { computeVetoCalibration, loadLessons, saveLessons } from './memory.js';
import { checkAlphaDecay } from './risk-guard.js';
import { deliverTelegramMessage, escapeTelegramHtml } from './telegram.js';
import type { FuturesLedger } from './types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = path.resolve(HERE, '..');
const DESK_DIR = path.join(ENGINE_ROOT, '.futures-desk');
const BRIEFINGS_DIR = path.join(DESK_DIR, 'briefings');
const LEDGER_PATH = path.join(DESK_DIR, 'ledger.json');
const LESSONS_PATH = path.join(DESK_DIR, 'memory', 'lessons.json');
const REPORT_PATH = path.join(DESK_DIR, 'weekly-report.json');

interface AgentWeeklyStats {
  agent: string;
  label: string;
  allocationPct: number;
  equityUsd: number;
  startEquityUsd: number;
  pnlPct: number;
  weeklyTrades: number;
  totalTrades: number;
  winRatePct: number;
  profitFactor: number;
  avgMfeR: number;
  avgMaeR: number;
  quantOnlyPnlUsd: number;
  geminiPnlUsd: number;
  vetoSummary: string;
  alphaDecay: boolean;
}

function getWibDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function fmtUsd(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtSignedPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function buildWeeklyTelegramHtml(params: {
  dateWib: string;
  review: WeeklyForensicResult;
  totalEquityUsd: number;
  totalPnlPct: number;
  btcClose: number | null;
  btcMacroBull: boolean | null;
  agentStats: AgentWeeklyStats[];
}): string {
  const { dateWib, review, totalEquityUsd, totalPnlPct, btcClose, btcMacroBull, agentStats } = params;
  const e = escapeTelegramHtml;

  const regimeText =
    btcClose != null
      ? `BTC $${btcClose.toLocaleString('en-US', { maximumFractionDigits: 0 })} · Rezim 4H EMA200: <b>${btcMacroBull ? 'BULL (Core Wyckoff)' : 'BEAR (Core + SMC-1H Aktif)'}</b>`
      : 'Data BTC belum tersedia';

  const agentLines = agentStats.map((a) => {
    const delta = a.geminiPnlUsd - a.quantOnlyPnlUsd;
    const deltaSign = delta >= 0 ? '+' : '';
    return [
      `• <b>${e(a.label)}</b> (${a.allocationPct}%): <b>${e(fmtUsd(a.equityUsd))}</b> (${e(fmtSignedPct(a.pnlPct))})`,
      `   ↳ Minggu ini: ${a.weeklyTrades} trade · Total: ${a.totalTrades} (WR ${a.winRatePct}% · PF ${a.profitFactor})`,
      `   ↳ MFE/MAE: +${a.avgMfeR}R / -${a.avgMaeR}R · A/B Gemini vs Quant: ${deltaSign}${e(fmtUsd(delta))}`,
    ].join('\n');
  });

  const findingsLines =
    review.keyFindings.length > 0
      ? review.keyFindings.slice(0, 4).map((f, i) => `${i + 1}. ${e(f)}`).join('\n')
      : '• Belum cukup closed trade minggu ini untuk ekstraksi pola statistik baru.';

  const lessonsLines =
    review.recommendedLessons.slice(0, 5).map((l, i) => `${i + 1}. ${e(l.lesson)}`).join('\n') ||
    '• Belum ada pembaruan memori pelajaran.';

  return [
    `📊 <b>LAPORAN MINGGUAN FUTURES ENGINE</b>`,
    `📅 Tanggal: <b>${e(dateWib)} WIB</b>  |  🧠 Audit AI: <code>${e(review.modelUsed)}</code>`,
    ``,
    `💡 <b>Intisari Audit Minggu Ini:</b>`,
    `${e(review.headline)}`,
    ``,
    `💼 <b>Portofolio Paper Futures (Isolated 1x–3x):</b>`,
    `• Total Ekuitas: <b>${e(fmtUsd(totalEquityUsd))}</b> (${e(fmtSignedPct(totalPnlPct))})`,
    `• Kompas Pasar: ${regimeText}`,
    ``,
    `🤖 <b>Kinerja 2 Agen &amp; Kalibrasi Shadow A/B:</b>`,
    ...agentLines,
    ``,
    `🔍 <b>Temuan Forensik (Gemini 4 Carbon):</b>`,
    findingsLines,
    ``,
    `🛡️ <b>Evaluasi Veto &amp; Conviction:</b>`,
    `${e(review.vetoAssessment || 'Menunggu sampel veto cukup.')}`,
    ``,
    `🧠 <b>Memori Terdistilasi (lessons.json — Aktif Minggu Depan):</b>`,
    lessonsLines,
  ].join('\n');
}

export function buildWeeklyPlainText(params: {
  dateWib: string;
  review: WeeklyForensicResult;
  totalEquityUsd: number;
  totalPnlPct: number;
  agentStats: AgentWeeklyStats[];
}): string {
  const { dateWib, review, totalEquityUsd, totalPnlPct, agentStats } = params;
  return [
    `LAPORAN MINGGUAN FUTURES ENGINE — ${dateWib} WIB`,
    `Model Audit: ${review.modelUsed}`,
    `Intisari: ${review.headline}`,
    `Total Ekuitas: ${fmtUsd(totalEquityUsd)} (${fmtSignedPct(totalPnlPct)})`,
    '',
    'Kinerja Agen:',
    ...agentStats.map(
      (a) =>
        `- ${a.label}: ${fmtUsd(a.equityUsd)} (${fmtSignedPct(a.pnlPct)}) | ${a.totalTrades} trade | WR ${a.winRatePct}% | PF ${a.profitFactor}`,
    ),
    '',
    'Temuan Forensik:',
    ...review.keyFindings.map((f, i) => `${i + 1}. ${f}`),
    '',
    `Evaluasi Veto: ${review.vetoAssessment}`,
    '',
    'Lessons Aktif:',
    ...review.recommendedLessons.slice(0, 5).map((l, i) => `${i + 1}. ${l.lesson}`),
  ].join('\n');
}

async function main() {
  const nowIso = new Date().toISOString();
  const dateWib = getWibDate(nowIso);

  if (!fs.existsSync(LEDGER_PATH)) {
    console.log('[Weekly Review] Ledger belum ada — jalankan paper-runner terlebih dahulu.');
    return;
  }

  const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')) as FuturesLedger;
  const existingLessons = loadLessons(LESSONS_PATH);
  const weekAgoMs = Date.now() - 7 * 86_400_000;

  const agentStats: AgentWeeklyStats[] = Object.values(ledger.books).map((book) => {
    const startEq = ledger.startingCapitalUsd * book.allocationShare;
    const eq = book.freeCashUsd + book.positions.reduce((s, p) => s + p.marginUsd, 0);
    const weeklyTrades = book.closedTrades.filter((t) => Date.parse(t.closedAt) >= weekAgoMs);
    const total = book.closedTrades.length;
    const wins = book.closedTrades.filter((t) => t.pnlUsd > 0).length;
    const gw = book.closedTrades.filter((t) => t.pnlUsd > 0).reduce((s, t) => s + t.pnlUsd, 0);
    const gl = Math.abs(book.closedTrades.filter((t) => t.pnlUsd <= 0).reduce((s, t) => s + t.pnlUsd, 0));
    const avgMfeR = total ? book.closedTrades.reduce((s, t) => s + t.mfeR, 0) / total : 0;
    const avgMaeR = total ? book.closedTrades.reduce((s, t) => s + t.maeR, 0) / total : 0;
    const quantOnlyPnlUsd = book.closedTrades.reduce((s, t) => s + t.quantOnlyPnlUsd, 0);
    const geminiPnlUsd = book.closedTrades.reduce((s, t) => s + t.pnlUsd, 0);
    const cal = computeVetoCalibration(book);
    const decay = checkAlphaDecay(book);

    return {
      agent: book.agent,
      label: book.agent === 'wyckoff-4h' ? 'Wyckoff-4H (Core)' : 'SMC-1H-Bear (Booster)',
      allocationPct: Math.round(book.allocationShare * 100),
      equityUsd: Number(eq.toFixed(2)),
      startEquityUsd: Number(startEq.toFixed(2)),
      pnlPct: Number((((eq - startEq) / startEq) * 100).toFixed(2)),
      weeklyTrades: weeklyTrades.length,
      totalTrades: total,
      winRatePct: total ? Number(((wins / total) * 100).toFixed(1)) : 0,
      profitFactor: gl > 0 ? Number((gw / gl).toFixed(2)) : gw > 0 ? 99 : 0,
      avgMfeR: Number(avgMfeR.toFixed(2)),
      avgMaeR: Number(avgMaeR.toFixed(2)),
      quantOnlyPnlUsd: Number(quantOnlyPnlUsd.toFixed(2)),
      geminiPnlUsd: Number(geminiPnlUsd.toFixed(2)),
      vetoSummary: cal.summary,
      alphaDecay: decay.decayed,
    };
  });

  const totalEquityUsd = agentStats.reduce((s, a) => s + a.equityUsd, 0);
  const totalPnlPct =
    ledger.startingCapitalUsd > 0
      ? ((totalEquityUsd - ledger.startingCapitalUsd) / ledger.startingCapitalUsd) * 100
      : 0;

  const summaryPayload = {
    generatedAt: nowIso,
    dateWib,
    btcRegime: ledger.btcRegime,
    totalEquityUsd: Number(totalEquityUsd.toFixed(2)),
    totalPnlPct: Number(totalPnlPct.toFixed(2)),
    agents: Object.values(ledger.books).map((book, idx) => ({
      ...agentStats[idx],
      vetoCalibration: computeVetoCalibration(book),
      recentTradesSample: book.closedTrades.slice(-25).map((t) => ({
        symbol: t.symbol,
        side: t.side,
        holdHours: t.holdHours,
        leverage: t.leverage,
        tp1Hit: t.tp1Hit,
        rMultiple: t.rMultiple,
        quantOnlyRMultiple: t.quantOnlyRMultiple,
        geminiAction: t.geminiAction,
        mfeR: t.mfeR,
        maeR: t.maeR,
        closeReason: t.closeReason,
      })),
    })),
  };

  const review = await runWeeklyForensicWithCarbon({
    summaryPayload,
    existingLessons,
  });

  saveLessons(LESSONS_PATH, review.recommendedLessons);

  const telegramHtml = buildWeeklyTelegramHtml({
    dateWib,
    review,
    totalEquityUsd,
    totalPnlPct,
    btcClose: ledger.btcRegime?.close ?? null,
    btcMacroBull: ledger.btcRegime?.macroBull ?? null,
    agentStats,
  });
  const plainText = buildWeeklyPlainText({
    dateWib,
    review,
    totalEquityUsd,
    totalPnlPct,
    agentStats,
  });

  const telegramDelivery = await deliverTelegramMessage(telegramHtml, plainText);

  const reportPayload = {
    generatedAt: nowIso,
    dateWib,
    totalEquityUsd: Number(totalEquityUsd.toFixed(2)),
    totalPnlPct: Number(totalPnlPct.toFixed(2)),
    agentStats,
    ...review,
    telegramHtml,
    plainText,
    telegramDelivery,
  };

  fs.mkdirSync(BRIEFINGS_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(reportPayload, null, 2) + '\n');
  fs.writeFileSync(
    path.join(BRIEFINGS_DIR, `weekly-review-${dateWib}.md`),
    `# Laporan Mingguan Futures Engine — ${dateWib} WIB\n\n> Audit oleh **${review.modelUsed}**\n\n${plainText}\n`,
  );

  console.log(
    `[Weekly Review] Selesai (${review.modelUsed}) | Headline: ${review.headline} | Lessons: ${review.recommendedLessons.length}`,
  );
  console.log(`[Weekly Review] Telegram: ${telegramDelivery.diagnostic}`);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
