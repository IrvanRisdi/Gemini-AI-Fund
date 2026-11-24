import { NextResponse } from 'next/server';
import { dispatchWorkflow, isCronAuthorized } from '@/lib/workflow-dispatch';

// Dipanggil oleh cron-job.org setiap 30 menit (menit :02 dan :32) untuk men-dispatch
// workflow `futures-paper-loop.yml` secara stabil tanpa bergantung pada schedule bawaan GitHub.
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const workflow = process.env.GH_FUTURES_LOOP_WORKFLOW_FILE || 'futures-paper-loop.yml';
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
