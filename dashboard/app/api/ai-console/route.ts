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

    // 1. Ambil dan bersihkan API Key
    const rawApiKey = process.env.GEMINI_API_KEY;
    const apiKey = rawApiKey ? rawApiKey.trim().replace(/^["']|["']$/g, '') : '';

    if (!apiKey) {
      return NextResponse.json({
        response: `⚠️ **GEMINI_API_KEY belum terdeteksi di server Vercel.**\n\nCara mengaktifkan:\n1. Buka Vercel -> Settings -> Environment Variables.\n2. Tambahkan key \`GEMINI_API_KEY\` dengan API Key dari Google AI Studio.\n3. Masuk ke tab Deployments -> Klik titik tiga (...) -> Pilih **Redeploy** agar kunci aktif.`,
      });
    }

    const systemPrompt = `
Anda adalah Gemini AI Console — asisten riset dan analis trading AI interaktif untuk platform "Gemini AI-Fund".
Berikut adalah status portofolio paper trading real-time:

=== DATA PORTOFOLIO DESK ===
* Last Cycle: ${snapshot?.lastCycle || 'N/A'}
* Mode: ${snapshot?.deskMode || 'paper'}
* Total Equity (Mark-to-Market): Rp${Math.round(snapshot?.totalEquity || 0).toLocaleString('id-ID')}
* Total Kas: Rp${Math.round(snapshot?.totalCash || 0).toLocaleString('id-ID')}
* Total Floating PnL: Rp${Math.round(snapshot?.totalUnrealizedPnl || 0).toLocaleString('id-ID')}
* Total Agen Aktif: ${snapshot?.agents?.length || 0}
* Sinyal Terakhir: ${JSON.stringify(snapshot?.latestScanCandidates || [], null, 2)}

=== STATUS AGEN & POSISI ===
${(snapshot?.agents || [])
  .map(
    (a: any) =>
      `• ${a.slug} (${a.status}): Ekuitas Rp${Math.round(a.equity || a.balance || 0).toLocaleString('id-ID')}, Kas Rp${Math.round(a.cash || 0).toLocaleString('id-ID')}, Posisi: ${
        a.openPositions && a.openPositions.length > 0
          ? a.openPositions.map((p: any) => `${p.side?.toUpperCase()} @ Rp${p.entryPrice?.toLocaleString('id-ID')}`).join(', ')
          : 'FLAT'
      }, Aksi: ${a.lastAction}`
  )
  .join('\n')}

=== PANDUAN MENJAWAB ===
Jawab pertanyaan pengguna secara cerdas, ringkas, ramah, dan profesional dalam Bahasa Indonesia menggunakan format Markdown yang rapi.
`;

    // Coba model resmi Google AI Studio
    const models = ['gemini-3.5-flash-lite'];
    let answer = '';
    let lastError = '';

    for (const model of models) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          const errBody = await res.text();
          lastError = `HTTP ${res.status} on ${model}: ${errBody}`;
        }
      } catch (e: any) {
        lastError = e?.message || 'Network fetch error';
      }
    }

    if (!answer) {
      return NextResponse.json({
        response: `⚠️ Terjadi kendala saat menghubungi Google Gemini API.\n\nDetail: \`${lastError}\`\n\nPastikan API Key di [Google AI Studio](https://aistudio.google.com/) aktif.`,
      });
    }

    return NextResponse.json({ response: answer });
  } catch (err: any) {
    return NextResponse.json({
      response: `Terjadi kesalahan internal: ${err?.message || 'Unknown error'}`,
    });
  }
}
