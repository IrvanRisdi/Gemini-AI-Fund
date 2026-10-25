import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDailyReportPdf, sanitizePdfText } from './pdf-report.js';

test('sanitizePdfText removes markdown asterisks and normalizes unicode punctuation', () => {
  const cleaned = sanitizePdfText('📊 *LAPORAN* **HARIAN** Rp\u00A0800.000.000 — Area ≤ 100');
  assert.ok(!cleaned.includes('*'));
  assert.ok(cleaned.includes('LAPORAN HARIAN'));
  assert.ok(cleaned.includes('Rp 800.000.000 - Area <= 100'));
});

test('generateDailyReportPdf builds a valid multi-section A4 PDF buffer', () => {
  const buf = generateDailyReportPdf({
    dateWib: '2026-10-25',
    sessionLabel: 'Edisi Pagi Terpadu',
    modelUsed: 'gemini-4-argon',
    generatedAtWib: '2026-10-25 WIB',
    portfolio: {
      totalCombinedEquity: 'Rp 800.000.000',
      cryptoEquity: 'Rp 300.000.000',
      cryptoOpenPositions: 1,
      cryptoPendingOrders: 2,
      stockEquity: 'Rp 500.000.000',
      stockOpenPositions: 2,
    },
    cryptoSummary: {
      posture: 'AKTIF SELEKTIF',
      btcPrice: '80,500 USDT',
      pairsScanned: 41,
      uptrendCount: 5,
      topSetups: [
        {
          pair: 'TON/USDT',
          agent: 'breakout-specialist',
          entry: '5.10 USDT - 5.20 USDT',
          stop: '4.90 USDT',
          target: '5.80 USDT',
          note: 'Breakout struktur 4H dengan volume 3.2x.',
        },
      ],
    },
    stockSummary: {
      marketPhase: 'OPEN',
      ihsgTrend: 'BULLISH',
      regimeLabel: 'CONSTRUCTIVE',
      topSetups: [
        {
          symbol: 'AALI',
          name: 'Astra Agro Lestari Tbk.',
          agent: 'Swing Momentum',
          entry: 'Rp 9.625',
          stop: 'Rp 9.240',
          target: 'Rp 10.395',
          score: 100,
          note: 'Skor teknikal & likuiditas 100/100.',
        },
      ],
    },
    aiDigest: {
      headline: 'Fokus Selektif pada TON/USDT dan AALI dengan Stop Loss Ketat',
      marketWeather: 'Pasar Kripto dan Saham IDX berada dalam kondisi konstruktif.',
      cryptoRecommendation: 'Pantau area beli TON/USDT dengan manajemen risiko 3,5%.',
      stockRecommendation: 'AALI memimpin screener BEI dengan skor 100/100.',
      actionableTakeaway: 'Gunakan maksimal 1-2% risiko per transaksi.',
    },
  });

  assert.ok(buf.length > 1500);
  const str = buf.toString('latin1');
  assert.ok(str.startsWith('%PDF-1.4'));
  assert.ok(str.trimEnd().endsWith('%%EOF'));
  assert.ok(str.includes('GEMINI AI-FUND'));
  assert.ok(str.includes('gemini-4-argon'));
});
