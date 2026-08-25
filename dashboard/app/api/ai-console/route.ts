import { NextResponse } from 'next/server';
import { getDeskSnapshot } from '@/lib/desk-data';
import { formatWibDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const;
const MAX_QUESTION_LENGTH = 2_000;
const MAX_OUTPUT_TOKENS = 1_600;

function formatIdr(value: number): string {
  return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}

function getModelCandidates(): string[] {
  const configured = (process.env.GEMINI_MODELS || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : [...DEFAULT_MODELS];
}

function buildDeskContext(snapshot: Awaited<ReturnType<typeof getDeskSnapshot>>): string {
  const signals = snapshot.latestScanCandidates?.length
    ? snapshot.latestScanCandidates
        .map((signal) => `- ${signal.pair.toUpperCase()} | ${signal.agent} | ${signal.reason}`)
        .join('\n')
    : '- Tidak ada sinyal pada siklus terakhir.';

  const agents = snapshot.agents
    .map((agent) => {
      const positions = agent.openPositions.length
        ? agent.openPositions
            .map((position, index) => {
              const pair = agent.openPairs[index] ?? 'PAIR TIDAK DIKETAHUI';
              return `${position.side.toUpperCase()} ${pair}, entry ${formatIdr(position.entryPrice)}, stop ${formatIdr(position.stopPrice)}${position.targetPrice ? `, target ${formatIdr(position.targetPrice)}` : ''}`;
            })
            .join('; ')
        : 'FLAT';
      return `- ${agent.slug}: ekuitas ${formatIdr(agent.equity)}, kas ${formatIdr(agent.cash)}, floating ${formatIdr(agent.unrealizedPnlIdr)}, posisi ${positions}. Aksi/data terakhir: ${agent.lastAction}`;
    })
    .join('\n');

  return `
Waktu data: ${formatWibDateTime(snapshot.lastCycle)}
Mode: ${snapshot.deskMode} (paper trading, bukan eksekusi uang riil)
Total equity: ${formatIdr(snapshot.totalEquity)}
Total kas: ${formatIdr(snapshot.totalCash)}
Total floating P&L: ${formatIdr(snapshot.totalUnrealizedPnl)}
Jumlah strategi aktif: ${snapshot.agents.length}

SINYAL TERBARU
${signals}

BOOK STRATEGI AKTIF
${agents}
`.trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === 'string' ? body.question.trim() : '';

    if (!question || question.length > MAX_QUESTION_LENGTH) {
      return NextResponse.json({ error: 'Pertanyaan harus berisi 1–2.000 karakter.' }, { status: 400 });
    }

    const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
    if (!apiKey) {
      return NextResponse.json({
        response: '⚠️ **GEMINI_API_KEY belum disetel di Vercel.** Tambahkan environment variable tersebut, lalu redeploy.',
      });
    }

    // The server is the source of truth: never let a browser-provided portfolio snapshot influence analysis.
    const snapshot = await getDeskSnapshot();
    const modelCandidates = getModelCandidates();
    const systemInstruction = `
Anda adalah Gemini Desk Analyst untuk Gemini AI-Fund, sebuah dashboard paper-trading kripto IDR.
Jawab hanya berdasarkan konteks desk di bawah. Jangan mengarang harga terkini, berita, posisi, performa, atau konfirmasi agent yang tidak ada di data.
Jika informasi tidak tersedia atau stale, katakan dengan eksplisit dan jelaskan data tambahan yang diperlukan.
Semua waktu harus ditulis dalam WIB. Selalu bedakan fakta desk, inferensi, dan asumsi.

Gunakan Bahasa Indonesia profesional dan langsung. Untuk pertanyaan analitis, gunakan format Markdown berikut (hilangkan bagian yang tidak relevan):
### Jawaban Singkat
Ringkasan langsung 2–4 kalimat.
### Bukti dari Desk
- Angka, sinyal, posisi, atau timestamp yang mendukung jawaban.
### Analisis
1. Penalaran utama.
2. Konfluensi atau konflik antar-sinyal.
### Risiko & Batasan
- Risiko posisi, kualitas data, dan fakta bahwa ini paper trading.
### Langkah Pemantauan
- Kondisi spesifik yang perlu dipantau; jangan memberi instruksi beli/jual yang pasti.

Untuk pertanyaan sederhana, tetap jawab lengkap tetapi ringkas. Jangan menyebut jumlah 50 agent; gunakan hanya strategi aktif pada konteks.

KONTEKS DESK TERPERCAYA
${buildDeskContext(snapshot)}
`.trim();

    let answer = '';
    let selectedModel = '';
    let lastError = '';

    for (const model of modelCandidates) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(25_000),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: question }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: MAX_OUTPUT_TOKENS },
          }),
        });

        if (!res.ok) {
          const error = await res.json().catch(() => null);
          lastError = error?.error?.message || `HTTP ${res.status} pada ${model}`;
          continue;
        }

        const data = await res.json();
        answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        if (answer) {
          selectedModel = model;
          break;
        }
        lastError = `Respons kosong dari ${model}`;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : `Koneksi ke ${model} gagal`;
      }
    }

    if (!answer) {
      return NextResponse.json({
        response: `⚠️ Gemini tidak dapat memproses permintaan: ${lastError}\n\nModel yang dicoba: ${modelCandidates.map((model) => `\`${model}\``).join(', ')}. Periksa API key atau kuota di Google AI Studio.`,
      });
    }

    return NextResponse.json({ response: answer, model: selectedModel, generatedAt: new Date().toISOString() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ response: `⚠️ Terjadi kesalahan internal: ${message}` }, { status: 500 });
  }
}
