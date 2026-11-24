import { NextResponse } from 'next/server';
import { dispatchWorkflow, isCronAuthorized } from '@/lib/workflow-dispatch';

// Dipanggil oleh cron-job.org setiap hari Minggu pukul 21:00 WIB (14:00 UTC)
// untuk men-dispatch `futures-weekly-review.yml` (Gemini 4 Carbon + kirim Telegram).
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const workflow = process.env.GH_FUTURES_WEEKLY_WORKFLOW_FILE || 'futures-weekly-review.yml';
  const result = await dispatchWorkflow(workflow);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.body },
      { status: result.status >= 400 ? result.status : 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    dispatched: true,
    workflow,
    dispatchedAt: new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
