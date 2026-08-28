import { NextResponse } from 'next/server';

// Endpoint ini dipanggil oleh scheduler eksternal (cron-job.org, EasyCron, dll)
// setiap 15 menit sebagai pengganti/pendukung `schedule:` di GitHub Actions,
// yang terbukti berhenti trigger sendiri setelah beberapa waktu berjalan.
//
// Cara kerja: endpoint ini memanggil GitHub REST API untuk men-dispatch
// workflow `trading-loop.yml` (event workflow_dispatch), bukan menjalankan
// scan/eksekusi paper trading secara langsung di sini.

export const dynamic = 'force-dynamic';

const GH_OWNER = process.env.GH_OWNER || 'IrvanRisdi';
const GH_REPO = process.env.GH_REPO || 'Gemini-AI-Fund';
const GH_WORKFLOW_FILE = process.env.GH_WORKFLOW_FILE || 'trading-loop.yml';
const GH_REF = process.env.GH_REF || 'main';

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // Fail closed: kalau CRON_SECRET belum diset di environment variables,
  // endpoint ini menolak semua permintaan (bukan malah terbuka untuk umum).
  if (!expected) return false;

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${expected}`) return true;

  const headerSecret = request.headers.get('x-cron-secret');
  if (headerSecret === expected) return true;

  // Fallback query param untuk layanan cron gratis yang tidak bisa
  // mengirim custom header.
  const url = new URL(request.url);
  if (url.searchParams.get('secret') === expected) return true;

  return false;
}

async function dispatchTradingLoop(): Promise<{ ok: boolean; status: number; body: string }> {
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) {
    return { ok: false, status: 500, body: 'GH_DISPATCH_TOKEN belum diset di environment variables Vercel.' };
  }

  const apiUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${GH_WORKFLOW_FILE}/dispatches`;

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: GH_REF }),
  });

  // GitHub membalas 204 No Content jika dispatch berhasil diterima.
  if (res.status === 204) {
    return { ok: true, status: 204, body: 'dispatched' };
  }

  const text = await res.text().catch(() => '');
  return { ok: false, status: res.status, body: text || `GitHub API mengembalikan status ${res.status}` };
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const result = await dispatchTradingLoop();

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.body },
      { status: result.status >= 400 ? result.status : 502 }
    );
  }

  return NextResponse.json({ ok: true, dispatchedWorkflow: GH_WORKFLOW_FILE, dispatchedAt: new Date().toISOString() });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
