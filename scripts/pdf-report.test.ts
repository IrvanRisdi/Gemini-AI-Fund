import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateDailyReportPdf,
  getIdxTickSize,
  roundToIdxTick,
  sanitizePdfText,
} from './pdf-report.js';

test('getIdxTickSize and roundToIdxTick enforce official BEI/IDX stock tick rules across all 5 price tiers', () => {
  // Tier 1: < Rp 200 -> tick Rp 1 (min Rp 50)
  assert.equal(getIdxTickSize(150), 1);
  assert.equal(roundToIdxTick(42, 'down'), 50);
  assert.equal(roundToIdxTick(185.7, 'down'), 185);
  assert.equal(roundToIdxTick(185.2, 'up'), 186);

  // Tier 2: Rp 200 - < Rp 500 -> tick Rp 2
  assert.equal(getIdxTickSize(200), 2);
  assert.equal(getIdxTickSize(450), 2);
  assert.equal(roundToIdxTick(450 * 0.96, 'down'), 432);
  assert.equal(roundToIdxTick(450 * 1.08, 'up'), 486);
  assert.equal(roundToIdxTick(311, 'down'), 310);
  assert.equal(roundToIdxTick(311, 'up'), 312);

  // Tier 3: Rp 500 - < Rp 2.000 -> tick Rp 5
  assert.equal(getIdxTickSize(500), 5);
  assert.equal(getIdxTickSize(840), 5);
  assert.equal(getIdxTickSize(1065), 5);
  // SGER @ Rp 840: 840 * 0.96 = 806.4 -> floor tick Rp 5 = 805; 840 * 1.08 = 907.2 -> ceil tick Rp 5 = 910
  assert.equal(roundToIdxTick(840 * 0.96, 'down'), 805);
  assert.equal(roundToIdxTick(840 * 1.08, 'up'), 910);
  // INPS @ Rp 1.065: 1065 * 0.96 = 1022.4 -> floor tick Rp 5 = 1020; 1065 * 1.08 = 1150.2 -> ceil tick Rp 5 = 1155
  assert.equal(roundToIdxTick(1065 * 0.96, 'down'), 1020);
  assert.equal(roundToIdxTick(1065 * 1.08, 'up'), 1155);

  // Tier 4: Rp 2.000 - < Rp 5.000 -> tick Rp 10
  assert.equal(getIdxTickSize(2000), 10);
  assert.equal(getIdxTickSize(2250), 10);
  assert.equal(roundToIdxTick(2250 * 0.96, 'down'), 2160);
  assert.equal(roundToIdxTick(2250 * 1.08, 'up'), 2430);
  assert.equal(roundToIdxTick(3424, 'down'), 3420);
  assert.equal(roundToIdxTick(3424, 'up'), 3430);

  // Tier 5: >= Rp 5.000 -> tick Rp 25
  assert.equal(getIdxTickSize(5000), 25);
  assert.equal(getIdxTickSize(9625), 25);
  // AALI @ Rp 9.625: 9625 * 0.96 = 9240 -> floor tick Rp 25 = 9225; 9625 * 1.08 = 10395 -> ceil tick Rp 25 = 10400
  assert.equal(roundToIdxTick(9625 * 0.96, 'down'), 9225);
  assert.equal(roundToIdxTick(9625 * 1.08, 'up'), 10400);
});

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
          stop: 'Rp 9.225',
          target: 'Rp 10.400',
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
