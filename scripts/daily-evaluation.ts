#!/usr/bin/env node
/** Session evaluation report: desk data is factual; AI adds only brief interpretation. */
import fs from 'node:fs';
import path from 'node:path';

const API_KEY = process.env.GEMINI_API_KEY;
const DESK_DIR = path.resolve(process.cwd(), '.desk');
const BRIEFINGS_DIR = path.join(DESK_DIR, 'briefings');
const PRIMARY_AGENTS = ['breakout-specialist', 'mean-reversion-trader', 'smc-trader', 'wyckoff-trader', 'aggressive-breakout-trader'];

type AgentBook = { balance?: { IDR?: number }; positions?: Record<string, { quantity?: number; entry_price?: number; current_price?: number; notional?: number }>; pendingOrders?: Array<{ pair?: string; orderType?: string; entry?: number; stop?: number; target?: number }> };
type Ledger = { mode?: string; last_cycle?: string; total_starting_capital?: number; agents?: Record<string, AgentBook> };
type Scan = { timestamp?: string; pairsScanned?: number; candidates?: Array<{ agent?: string; pair?: string; orderType?: string; entry?: number; stop?: number; target?: number }>; errors?: unknown[] };

function formatIdr(value: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }
function getCurrentSession(): 'ASIA_OPEN' | 'US_OPEN' { return new Date().getUTCHours() >= 12 ? 'US_OPEN' : 'ASIA_OPEN'; }
function readJson<T>(filename: string, fallback: T): T { try { return JSON.parse(fs.readFileSync(path.join(DESK_DIR, filename), 'utf8')) as T; } catch { return fallback; } }

function buildFacts(ledger: Ledger, scan: Scan) {
  const agents = ledger.agents ?? {};
  const agentRows = PRIMARY_AGENTS.map((agent) => {
    const book = agents[agent] ?? {};
    const positions = Object.values(book.positions ?? {});
    const pending = book.pendingOrders ?? [];
    const cash = book.balance?.IDR ?? 0;
    const exposure = positions.reduce((sum, p) => sum + (p.notional ?? ((p.quantity ?? 0) * (p.current_price ?? p.entry_price ?? 0))), 0);
    return { agent, cash, exposure, positions: positions.length, pending: pending.length };
  });
  const openPositions = agentRows.reduce((sum, row) => sum + row.positions, 0);
  const pendingOrders = agentRows.reduce((sum, row) => sum + row.pending, 0);
  const totalCash = agentRows.reduce((sum, row) => sum + row.cash, 0);
  const totalExposure = agentRows.reduce((sum, row) => sum + row.exposure, 0);
  const candidateCount = scan.candidates?.length ?? 0;
  const dataHealth = (scan.errors?.length ?? 0) === 0 ? 'NORMAL' : `PERLU DICEK (${scan.errors?.length} error)`;
  const posture = openPositions === 0 && pendingOrders === 0 ? 'WAIT — belum ada setup tervalidasi' : 'SELECTIVE — kelola order/posisi aktif';
  return { agentRows, openPositions, pendingOrders, totalCash, totalExposure, candidateCount, dataHealth, posture };
}

function buildReportTemplate(session: string, ledger: Ledger, scan: Scan) {
  const facts = buildFacts(ledger, scan);
  const label = session === 'US_OPEN' ? 'US Open' : 'Asia Open';
  const rows = facts.agentRows.map((r) => `| ${r.agent} | ${formatIdr(r.cash)} | ${formatIdr(r.exposure)} | ${r.positions} | ${r.pending} |`).join('\n');
  const candidates = (scan.candidates ?? []).slice(0, 8).map((c) => `| ${c.agent ?? '-'} | ${c.pair ?? '-'} | ${c.orderType ?? 'pending'} | ${c.entry ? formatIdr(c.entry) : '-'} | ${c.stop ? formatIdr(c.stop) : '-'} | ${c.target ? formatIdr(c.target) : '-'} |`).join('\n') || '| - | - | - | - | - | - |';
  return `# Evaluasi Sesi Pasar — ${label}

> Laporan keputusan paper trading. Semua angka berasal dari ledger dan hasil scan; bukan ajakan beli atau jual.

## 1. Ringkasan keputusan

| Status | Nilai |
| --- | --- |
| Sikap desk | ${facts.posture} |
| Mode | ${ledger.mode ?? 'tidak tersedia'} |
| Kesehatan data | ${facts.dataHealth} |
| Pair dipindai | ${scan.pairsScanned ?? 0} |
| Kandidat scan | ${facts.candidateCount} |
| Posisi terbuka | ${facts.openPositions} |
| Pending order | ${facts.pendingOrders} |

**Keputusan sesi:** ${facts.openPositions === 0 && facts.pendingOrders === 0 ? 'Tidak ada eksekusi. Tetap scan dan buat pending order hanya bila seluruh aturan strategi terpenuhi.' : 'Tidak ada order baru dari laporan ini; executor hanya menjalankan pending order yang lolos batas risiko.'}

## 2. Kondisi pasar yang terukur

| Pemeriksaan | Hasil |
| --- | --- |
| Waktu scan terakhir | ${scan.timestamp ?? 'belum ada'} |
| Siklus ledger terakhir | ${ledger.last_cycle ?? 'belum ada'} |
| Error data | ${scan.errors?.length ?? 0} |
| Rezim pasar | Menunggu bukti 1H/4H dari scanner; tidak disimpulkan dari opini AI. |

## 3. Status modal dan eksposur

| Modal tunai | Eksposur spot | Nilai desk tercatat | Batas notional |
| --- | --- | --- | --- |
| ${formatIdr(facts.totalCash)} | ${formatIdr(facts.totalExposure)} | ${formatIdr(facts.totalCash + facts.totalExposure)} | Maks. 100% equity per agen |

| Agen utama | Tunai | Eksposur | Posisi | Pending |
| --- | ---: | ---: | ---: | ---: |
${rows}

## 4. Antrian setup tervalidasi

| Agen | Pair | Jenis order | Entry | Stop | Target |
| --- | --- | --- | ---: | ---: | ---: |
${candidates}

Kandidat scan belum otomatis menjadi transaksi. Executor menolak order non-long/spot, melebihi equity, melampaui risiko kampanye 5%, atau R:R di bawah 1:1.5.

## 5. Prioritas strategi sesi berikutnya

| Strategi | Peran | Syarat tindakan |
| --- | --- | --- |
| Breakout | Trend-following bertahap | Trigger 15m searah tren 4H; mulai 25%, tambah pada +0,5R/+1R/+1,5R, target bersih 2,5R. |
| Mean reversion | Pasar ranging | Hanya saat ADX 4H rendah dan reversal terkonfirmasi. |
| SMC | Struktur tren | Sweep dan CHoCH di demand zone, lalu konfirmasi Fibonacci atau candle. |
| Wyckoff | Akumulasi | Spring dan test valid di demand zone, lalu konfirmasi Fibonacci atau candle. |
| Aggressive breakout | Momentum terkonsentrasi | Entry langsung 60%/85%/hampir 100% sesuai skor dan relative volume; risiko bersih tetap maksimum 5%. |

## 6. Guardrail risiko

- Spot dan long-only; tidak ada short atau leverage.
- Satu kampanye aktif per agen/pair; breakout dapat pyramid pada +0,5R, +1R, dan +1,5R.
- Stop dirancang pada rentang 3–5% harga; risiko bersih maksimum kampanye 5% equity agen dan fee simulasi 0,3% per sisi.
- Target minimum dihitung setelah fee: 1,5R bersih untuk strategi umum dan 2,5R untuk kampanye breakout bertahap.
- Jika data scan error, tidak ada order baru sampai siklus bersih berikutnya.

## 7. Rencana sampai evaluasi berikutnya

1. Scan ${scan.pairsScanned ?? 0} pair universe dinamis dan validasi struktur 4H sebelum trigger 15m.
2. Simpan setup valid sebagai pending order lengkap dengan entry, stop, target, dan masa berlaku.
3. Batalkan order bila struktur invalid atau data bermasalah.
4. Review pada sesi berikutnya; laporan tidak mengubah parameter secara otomatis.
`;
}

async function callGemini(prompt: string): Promise<string | undefined> {
  if (!API_KEY) return undefined;
  for (const model of ['gemini-2.5-flash-lite', 'gemini-2.5-flash']) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.15, maxOutputTokens: 450 } }) });
      if (response.ok) { const data = await response.json(); const text = data.candidates?.[0]?.content?.parts?.[0]?.text; if (text) return text; }
    } catch { /* Try the economical fallback model. */ }
  }
  return undefined;
}

function cleanCommentary(text: string) { return text.replace(/[#+*`]/g, '').replace(/\n{3,}/g, '\n\n').trim(); }

async function main() {
  const session = getCurrentSession();
  const now = new Date().toISOString();
  const ledger = readJson<Ledger>('paper-ledger.json', {});
  const scan = readJson<Scan>('latest-scan.json', {});
  const facts = buildFacts(ledger, scan);
  const prompt = `Anda CIO desk paper trading spot-only. Tulis Catatan CIO dalam Bahasa Indonesia, maksimal 130 kata dan 3 paragraf, tanpa Markdown/simbol #/*, tanpa harga atau sinyal yang tidak ada pada fakta. Jelaskan sikap risiko dan konfirmasi yang diperlukan pada scan berikutnya. Fakta: ${JSON.stringify({ posture: facts.posture, positions: facts.openPositions, pending: facts.pendingOrders, candidates: facts.candidateCount, dataHealth: facts.dataHealth })}`;
  const commentary = await callGemini(prompt);
  const aiSection = commentary ? `\n## 8. Catatan CIO (interpretasi AI)\n\n${cleanCommentary(commentary)}\n` : '\n## 8. Catatan CIO (interpretasi AI)\n\nTidak tersedia pada siklus ini. Laporan operasional tetap lengkap karena dibuat dari data desk.\n';
  fs.mkdirSync(BRIEFINGS_DIR, { recursive: true });
  const filename = `session-review-${now.split('T')[0]}-${session.toLowerCase()}.md`;
  const output = `---\ndate: "${now.split('T')[0]}"\ntime: "${now}"\nsession: "${session}"\nreport_version: "spot-paper-v2"\n---\n\n${buildReportTemplate(session, ledger, scan)}${aiSection}`;
  fs.writeFileSync(path.join(BRIEFINGS_DIR, filename), output, 'utf8');
  console.log(`✓ Session review written: ${path.join(BRIEFINGS_DIR, filename)}`);
}

main().catch((error) => { console.error('✗ Evaluation failed:', error instanceof Error ? error.message : error); process.exitCode = 1; });
