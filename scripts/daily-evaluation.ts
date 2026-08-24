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
const CONFIG_PATH = path.resolve(process.cwd(), 'config', 'strategies.json');

function getCurrentSession(): 'ASIA_OPEN' | 'US_OPEN' {
  const currentUtcHour = new Date().getUTCHours();
  return currentUtcHour >= 12 ? 'US_OPEN' : 'ASIA_OPEN';
}

async function callGemini(prompt: string): Promise<string> {
  if (!API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY is not set. Generating fallback evaluation.');
    return `# Gemini Session Review (Offline Mode)\n\n*Note: GEMINI_API_KEY secret was not provided. Paper desk continues with default deterministic parameters.*`;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
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

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response generated.';
}

async function main() {
  const session = getCurrentSession();
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toISOString();

  console.log(`[Gemini AI-Fund] Starting ${session} evaluation at ${timeStr}...`);

  // 1. Read ledger & state if available
  let ledgerSummary = 'No ledger file found.';
  const ledgerPath = path.join(DESK_DIR, 'paper-ledger.json');
  if (fs.existsSync(ledgerPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
      ledgerSummary = JSON.stringify({
        mode: raw.mode,
        lastCycle: raw.last_cycle,
        activeBooks: raw.roster_change_2026_08_21 || 'Standard active books',
      }, null, 2);
    } catch {
      ledgerSummary = 'Ledger parse error.';
    }
  }

  const prompt = `
Anda adalah Chief Investment Officer (CIO) & Risk Strategist untuk Gemini AI-Fund.
Sesi Pasar: ${session === 'US_OPEN' ? 'US Market Open (High Volatility Prep)' : 'Asia Morning Open (Daily Baseline)'}
Tanggal/Waktu: ${timeStr}

Ringkasan Status Desk:
${ledgerSummary}

Tugas:
1. Berikan Ringkasan Eksekutif & Diagnosis Rezim Pasar (Trending / Ranging / High-Vol).
2. Berikan panduan alokasi risiko untuk sesi ini (fokus pada pasangan IDR kripto di Indodax).
3. Rekomendasi prioritas strategi (misal: Momentum, Breakout, SMC, Wyckoff, Mean Reversion).

Format respon dalam Markdown yang ringkas dan profesional.
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
    console.error(`✗ Evaluation failed:`, err?.message || err);
  }
}

main();
