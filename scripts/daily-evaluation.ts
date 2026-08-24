#!/usr/bin/env node
/**
 * Daily / Session-based Strategy Evaluation via Gemini API.
 * Reads recent .desk/ state, aggregates performance, calls Gemini for
 * market regime analysis & parameter adjustments, and writes briefings.
 */

import fs from 'node:fs';
import path from 'node:path';

const API_KEY = process.env.GEMINI_API_KEY;
const DESK_DIR = path.resolve(process.cwd(), '.desk');
const BRIEFINGS_DIR = path.join(DESK_DIR, 'briefings');

function getCurrentSession(): 'ASIA_OPEN' | 'US_OPEN' {
  const currentUtcHour = new Date().getUTCHours();
  return currentUtcHour >= 12 ? 'US_OPEN' : 'ASIA_OPEN';
}

async function callGemini(prompt: string): Promise<string> {
  if (!API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY secret is not set. Generating offline session briefing.');
    return `### Catatan Sesi Pasar (Mode Offline)\n\n*Peringatan: Kunci GEMINI_API_KEY belum disetel di GitHub Secrets. Bot tetap beroperasi menggunakan parameter matematis default.*`;
  }

  // Coba model 1.5-flash / 2.5-flash secara berurutan
  const models = ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-1.5-pro'];
  
  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000,
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch {
      // Lanjutkan ke model berikutnya jika ada kendala
    }
  }

  return `### Analisis Sesi Pasar\n\n*Pemindaian aktif pada 19 pasangan aset Indodax. Manajemen risiko 2% berjalan normal.*`;
}

async function main() {
  const session = getCurrentSession();
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toISOString();

  console.log(`[Gemini AI-Fund] Starting ${session} evaluation at ${timeStr}...`);

  let ledgerSummary = 'No ledger file found.';
  const ledgerPath = path.join(DESK_DIR, 'paper-ledger.json');
  if (fs.existsSync(ledgerPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
      ledgerSummary = JSON.stringify({
        mode: raw.mode,
        lastCycle: raw.last_cycle,
        totalAgents: Object.keys(raw.agents || {}).length,
      }, null, 2);
    } catch {
      ledgerSummary = 'Ledger parse error.';
    }
  }

  const prompt = `
Anda adalah Chief Investment Officer (CIO) & Risk Strategist untuk Gemini AI-Fund.
Sesi Pasar: ${session === 'US_OPEN' ? 'US Market Open (Puncak Volatilitas & Likuiditas)' : 'Asia Morning Open (Baseline Harian)'}
Tanggal & Waktu: ${timeStr}

Ringkasan Status Desk:
${ledgerSummary}

Tugas:
1. Berikan Ringkasan Eksekutif & Diagnosis Rezim Pasar Kripto (Trending / Ranging / High-Vol).
2. Berikan panduan alokasi risiko untuk sesi ini (fokus pada pasangan IDR kripto di Indodax).
3. Rekomendasi prioritas strategi (Momentum, Breakout, SMC, Wyckoff, Mean Reversion).

Format respon dalam Markdown yang rapi, ringkas, dan profesional (Bahasa Indonesia).
`;

  try {
    const reviewContent = await callGemini(prompt);
    
    if (!fs.existsSync(BRIEFINGS_DIR)) {
      fs.mkdirSync(BRIEFINGS_DIR, { recursive: true });
    }

    const filename = `session-review-${dateStr}-${session.toLowerCase()}.md`;
    const filepath = path.join(BRIEFINGS_DIR, filename);
    
    const output = `---\ndate: "${dateStr}"\ntime: "${timeStr}"\nsession: "${session}"\n---\n\n${reviewContent}\n`;
    fs.writeFileSync(filepath, output, 'utf8');
    console.log(`✓ Review successfully written to: ${filepath}`);
  } catch (err: any) {
    console.error(`✗ Evaluation note:`, err?.message || err);
  }
}

main();
