'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { UnifiedDailyReportData } from '@/lib/desk-data';

const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function pairSlug(pair: string): string {
  return pair
    .replace('/', '')
    .replace('_', '')
    .replace(/(?:idr|usdt)$/i, '')
    .toLowerCase();
}

export function UnifiedDailyReportCard({ report }: { report: UnifiedDailyReportData }) {
  const [copied, setCopied] = useState(false);

  async function handleCopyTelegram() {
    try {
      await navigator.clipboard.writeText(report.whatsappText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback if clipboard permission denied
    }
  }

  const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://github.com/IrvanRisdi/Gemini-AI-Fund')}&text=${encodeURIComponent(report.whatsappText)}`;

  return (
    <section className="mb-8 rounded-2xl border border-blue-500/30 bg-surface p-5 sm:p-6 shadow-lg shadow-black/20">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-blue-300">
              🪙 Kripto + 📈 Saham IDX
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
              🧠 AI Model: {report.modelUsed}
            </span>
            {report.telegramDelivery ? (
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                  report.telegramDelivery.delivered
                    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                    : 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                }`}
              >
                {report.telegramDelivery.delivered
                  ? `✈️ Telegram Terkirim (${report.telegramDelivery.botUsername ?? 'Bot'})`
                  : `⚠️ Telegram: ${report.telegramDelivery.diagnostic}`}
              </span>
            ) : null}
            <span className="font-mono text-xs text-ink-faint">
              {report.dateWib} · {report.session === 'US_OPEN' ? 'Edisi Sore/Malam' : 'Edisi Pagi Terpadu'}
            </span>
          </div>
          <h2 className="mt-2 font-sans text-xl sm:text-2xl font-semibold text-ink">
            {report.aiDigest.headline}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={tgShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/15 px-3.5 py-2 font-mono text-xs font-semibold text-blue-300 hover:bg-blue-500/25 transition-colors"
          >
            ✈️ Bagikan ke Telegram
          </a>
          <button
            type="button"
            onClick={handleCopyTelegram}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-3.5 py-2 font-mono text-xs text-ink hover:border-blue-500/50 transition-colors"
          >
            {copied ? '✓ Tersalin untuk Telegram!' : '📋 Salin Pesan Telegram'}
          </button>
        </div>
      </div>

      {/* Combined Portfolio Strip */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-bg/70 p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Total Portofolio Gabungan (11 Agen)</p>
          <p className="mt-1 font-mono text-lg font-semibold text-ink">
            {idr.format(report.portfolio.totalCombinedEquityIdr)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
            {report.portfolio.cryptoOpenPositions + report.portfolio.stockOpenPositions} posisi aktif berjalan
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg/70 p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-blue-400">Desk Kripto Spot (6 Agen v6)</p>
          <p className="mt-1 font-mono text-lg font-semibold text-ink">
            {idr.format(report.portfolio.cryptoEquityIdr)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
            {report.cryptoSummary.pairsScanned} pair dipindai · {report.cryptoSummary.uptrendCount} uptrend 4H
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg/70 p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-emerald-400">Desk Saham IDX (5 Agen v3)</p>
          <p className="mt-1 font-mono text-lg font-semibold text-ink">
            {idr.format(report.portfolio.stockEquityIdr)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
            IHSG {report.stockSummary.ihsgTrend} · Fase {report.stockSummary.marketPhase}
          </p>
        </div>
      </div>

      {/* Easy-to-Understand Narrative */}
      <div className="mt-5 rounded-xl border border-border bg-bg/50 p-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-blue-400">🌤️ Analisis Cuaca Pasar Hari Ini</p>
        <p className="mt-1.5 font-sans text-sm leading-relaxed text-ink">
          {report.aiDigest.marketWeather}
        </p>
        <p className="mt-3 border-t border-border/60 pt-2.5 font-sans text-xs leading-relaxed text-ink-muted">
          <strong className="text-ink">🛡️ Panduan Risiko:</strong> {report.aiDigest.actionableTakeaway}
        </p>
      </div>

      {/* Side-by-Side Crypto & Stock Recommendations */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Crypto Column */}
        <div className="rounded-xl border border-blue-500/25 bg-bg/60 p-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <h3 className="font-sans text-base font-semibold text-blue-300">🪙 Rekomendasi &amp; Pantauan Kripto Spot</h3>
            <Link href="/explore" className="font-mono text-[11px] text-accent hover:underline">
              Buka Scanner →
            </Link>
          </div>
          <p className="mt-2.5 font-sans text-xs leading-relaxed text-ink-muted">
            {report.aiDigest.cryptoRecommendation}
          </p>
          <div className="mt-3 space-y-2.5">
            {report.cryptoSummary.topSetups.map((setup) => (
              <div key={`${setup.pair}-${setup.agent}`} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/pair/${pairSlug(setup.pair)}`}
                    className="font-mono text-sm font-semibold text-accent hover:underline"
                  >
                    {setup.pair}
                  </Link>
                  <span className="font-mono text-[10px] text-ink-muted">{setup.agent}</span>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="block text-[9px] uppercase text-ink-faint">Area Beli</span>
                    <span className="text-ink">{setup.entry}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-ink-faint">Stop Loss</span>
                    <span className="text-negative">{setup.stop}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-ink-faint">Target</span>
                    <span className="text-positive">{setup.target}</span>
                  </div>
                </div>
                <p className="mt-1.5 font-sans text-[11px] text-ink-muted">{setup.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* IDX Stock Column */}
        <div className="rounded-xl border border-emerald-500/25 bg-bg/60 p-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <h3 className="font-sans text-base font-semibold text-emerald-300">📈 Rekomendasi &amp; Pantauan Saham IDX</h3>
            <Link href="/saham#screener" className="font-mono text-[11px] text-accent hover:underline">
              Buka Screener BEI →
            </Link>
          </div>
          <p className="mt-2.5 font-sans text-xs leading-relaxed text-ink-muted">
            {report.aiDigest.stockRecommendation}
          </p>
          <div className="mt-3 space-y-2.5">
            {report.stockSummary.topSetups.map((setup) => (
              <div key={`${setup.symbol}-${setup.agent}`} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/saham/stocks/${setup.symbol}`}
                    className="font-mono text-sm font-semibold text-accent hover:underline"
                  >
                    {setup.symbol} <span className="font-sans text-xs font-normal text-ink-muted">· {setup.name}</span>
                  </Link>
                  <span className="font-mono text-[10px] text-emerald-300">{setup.agent}</span>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="block text-[9px] uppercase text-ink-faint">Area Beli</span>
                    <span className="text-ink">{setup.entry}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-ink-faint">Stop Loss</span>
                    <span className="text-negative">{setup.stop}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-ink-faint">Target</span>
                    <span className="text-positive">{setup.target}</span>
                  </div>
                </div>
                <p className="mt-1.5 font-sans text-[11px] text-ink-muted">{setup.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
