import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const question = body.question;
    const snapshot = body.snapshot;

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Pertanyaan tidak valid' }, { status: 400 });
    }

    // 1. Ambil dan bersihkan API Key dari Vercel Environment Variables
    const rawApiKey = process.env.GEMINI_API_KEY || '';
    const apiKey = rawApiKey.trim().replace(/^["']|["']$/g, '');

    if (!apiKey) {
      return NextResponse.json({
        response: `⚠️ **GEMINI_API_KEY belum disetel di Vercel.**\n\nSilakan buka Vercel -> Settings -> Environment Variables -> Tambahkan \`GEMINI_API_KEY\`, lalu klik Redeploy.`,
      });
    }

    const systemPrompt = `
Anda adalah Gemini Desk Analyst (Chief AI Investment Officer) untuk platform kuantitatif "Gemini AI-Fund".
Anda mengawasi 50 persona agen multi-strategi di pasar kripto IDR Indodax.

=== DATA PORTOFOLIO DESK REAL-TIME ===
* Last Cycle: ${snapshot?.lastCycle || 'N/A'}
* Mode: ${snapshot?.deskMode || 'paper (local-simulation)'}
* Total Equity (Mark-to-Market): Rp${Math.round(snapshot?.totalEquity || 0).toLocaleString('id-ID')}
* Total Saldo Kas: Rp${Math.round(snapshot?.totalCash || 0).toLocaleString('id-ID')}
* Total Floating PnL: Rp${Math.round(snapshot?.totalUnrealizedPnl || 0).toLocaleString('id-ID')}
* Total Agen Aktif: ${snapshot?.agents?.length || 0} Agen
* Sinyal Terakhir Terdeteksi: ${JSON.stringify(snapshot?.latestScanCandidates || [], null, 2)}

=== STATUS BUKU & POSISI AGEN ===
${(snapshot?.agents || [])
  .map(
    (a: any) =>
      `• ${a.slug} (${a.status}): Ekuitas Rp${Math.round(a.equity || a.balance || 0).toLocaleString('id-ID')}, Kas Rp${Math.round(a.cash || 0).toLocaleString('id-ID')}, Posisi: ${
        a.openPositions && a.openPositions.length > 0
          ? a.openPositions.map((p: any) => `${p.side?.toUpperCase()} @ Rp${p.entryPrice?.toLocaleString('id-ID')}`).join(', ')
          : 'FLAT (Tidak ada posisi)'
      }, Aksi: ${a.lastAction}`
  )
  .join('\n')}

=== PANDUAN ANALISIS (SKILL GEMINI ANALYST) ===
1. Gunakan Bahasa Indonesia yang lugas, presisi, berwibawa, dan profesional.
2. Langsung jawab inti pertanyaan tanpa basa-basi pembuka ("Halo saya Gemini...", "Tentu saya akan bantu...").
3. Jika ditanya tentang posisi terbuka, sebutkan nama koin, jenis posisi (LONG/SHORT), harga masuk, dan alasan strategi secara singkat.
4. Jika ditanya tentang sinyal pasar, analisis konfluensi multi-agen (misal: konfirmasi breakout volume + liquidity sweep SMC).
5. Format jawaban secara bersih: gunakan poin nomor (1. 2. 3.) atau bullet sederhana (- ), dan tebal (**teks**) pada angka kunci. Hindari simbol pagar bertumpuk.
`;

    // Daftar Model Resmi Google AI Studio Sesuai Dokumentasi
    const modelCandidates = [
      // 1. Model Generasi Terbaru (Prioritas Utama)
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      // 2. Seri Gemini 2.5 (High Performance & Low Latency)
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      // 3. Seri Gemini 2.0 & Flash Baselines
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro',
    ];

    let answer = '';
    let apiErrorMessage = '';

    for (const model of modelCandidates) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nUser Question: ${question}` }],
              },
            ],
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 1000,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (answer) break;
        } else {
          const errJson = await res.json().catch(() => null);
          apiErrorMessage = errJson?.error?.message || `HTTP ${res.status} on ${model}`;
        }
      } catch (e: any) {
        apiErrorMessage = e?.message || 'Network fetch error';
      }
    }

    if (!answer) {
      return NextResponse.json({
        response: `⚠️ **Kendala Google AI API:** ${apiErrorMessage}\n\nPastikan API Key di [Google AI Studio](https://aistudio.google.com/) aktif dan valid.`,
      });
    }

    return NextResponse.json({ response: answer });
  } catch (err: any) {
    return NextResponse.json({
      response: `Terjadi kesalahan internal: ${err?.message || 'Unknown error'}`,
    });
  }
}
