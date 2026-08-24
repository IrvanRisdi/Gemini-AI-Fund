import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { question, snapshot } = await req.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Pertanyaan tidak valid' }, { status: 400 });
    }

    // Bersihkan API Key dari spasi/tanda kutip tak terlihat
    const rawApiKey = process.env.GEMINI_API_KEY;
    const apiKey = rawApiKey ? rawApiKey.trim().replace(/^["']|["']$/g, '') : '';

    if (!apiKey) {
      return NextResponse.json({
        response: `⚠️ GEMINI_API_KEY belum disetel di Vercel Environment Variables.\n\nUntuk mengaktifkan AI interaktif:\n1. Buka Vercel Settings -> Environment Variables\n2. Tambahkan GEMINI_API_KEY dengan API Key Anda dari Google AI Studio.`,
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
1. Jawab pertanyaan pengguna secara ringkas, jelas, ramah, dan profesional dalam Bahasa Indonesia.
2. Gunakan data angka dan posisi di atas sebagai fakta kebenaran dasar (*ground truth*).
3. Jika ditanya mengenai sinyal atau posisi, jelaskan koin, strategi, dan alasannya.
4. Gunakan format Markdown yang rapi.
`;

    // Coba model resmi Google AI Studio secara berurutan
    const modelCandidates = [
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro',
    ];

    let answer = '';
    let lastError = '';

    for (const model of modelCandidates) {
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
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            answer = text;
            break;
          }
        } else {
          lastError = `Status ${res.status} on ${model}`;
        }
      } catch (e: any) {
        lastError = e?.message || 'Fetch error';
      }
    }

    if (!answer) {
      return NextResponse.json({
        response: `Maaf, terjadi kendala koneksi ke Gemini (${lastError}). Pastikan Google Generative Language API aktif pada API Key Anda.`,
      });
    }

    return NextResponse.json({ response: answer });
  } catch (err: any) {
    console.error('[Gemini AI Console] Catch Error:', err);
    return NextResponse.json({
      response: `Terjadi kesalahan internal: ${err?.message || 'Unknown error'}`,
    });
  }
}
