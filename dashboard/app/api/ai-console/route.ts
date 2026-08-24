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
Anda adalah Gemini AI Console — asisten riset dan analis trading AI interaktif untuk platform "Gemini AI-Fund".
Anda memiliki akses ke status portofolio paper trading real-time berikut:

=== DATA PORTOFOLIO DESK ===
* Last Cycle: ${snapshot?.lastCycle || 'N/A'}
* Mode: ${snapshot?.deskMode || 'paper'}
* Total Equity (Mark-to-Market): Rp${Math.round(snapshot?.totalEquity || 0).toLocaleString('id-ID')}
* Total Kas: Rp${Math.round(snapshot?.totalCash || 0).toLocaleString('id-ID')}
* Total Floating PnL: Rp${Math.round(snapshot?.totalUnrealizedPnl || 0).toLocaleString('id-ID')}
* Total Agen Aktif: ${snapshot?.agents?.length || 0}
* Sinyal Terakhir Terdeteksi: ${JSON.stringify(snapshot?.latestScanCandidates || [], null, 2)}

=== STATUS AGEN & POSISI TERBUKA ===
${(snapshot?.agents || [])
  .map(
    (a: any) =>
      `• ${a.slug} (${a.status}): Ekuitas Rp${Math.round(a.equity || a.balance || 0).toLocaleString('id-ID')}, Kas Rp${Math.round(a.cash || 0).toLocaleString('id-ID')}, Posisi: ${
        a.openPositions && a.openPositions.length > 0
          ? a.openPositions.map((p: any) => `${p.side?.toUpperCase()} @ Rp${p.entryPrice?.toLocaleString('id-ID')}`).join(', ')
          : 'FLAT (Tidak ada posisi)'
      }, Aksi Terakhir: ${a.lastAction}`
  )
  .join('\n')}

=== PANDUAN MENJAWAB ===
1. Jawab pertanyaan pengguna secara cerdas, ramah, dan profesional dalam Bahasa Indonesia.
2. Gunakan data angka dan posisi di atas sebagai fakta dasar yang akurat.
3. Jelaskan alasan teknikal atau status portofolio dengan format Markdown yang rapi.
`;

    // Coba endpoint resmi Google AI Studio dengan header x-goog-api-key dan parameter ?key=
    const endpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    ];

    let answer = '';
    let apiErrorMessage = '';

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
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
              temperature: 0.3,
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
          apiErrorMessage = errJson?.error?.message || `HTTP ${res.status} (${res.statusText})`;
        }
      } catch (e: any) {
        apiErrorMessage = e?.message || 'Network fetch error';
      }
    }

    if (!answer) {
      return NextResponse.json({
        response: `⚠️ **Kendala Google AI API:** ${apiErrorMessage}\n\n**Saran Perbaikan:**\n1. Pastikan Anda menyalin API Key dari situs resmi: **[https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)** (Klik *Create API Key*).\n2. Di Vercel: Masuk ke **Settings -> Environment Variables** -> Pastikan key \`GEMINI_API_KEY\` terpasang tanpa spasi tambahan.`,
      });
    }

    return NextResponse.json({ response: answer });
  } catch (err: any) {
    return NextResponse.json({
      response: `Terjadi kesalahan internal: ${err?.message || 'Unknown error'}`,
    });
  }
}
