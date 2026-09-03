import { NextResponse } from 'next/server';
import { idxDailyGate } from '@/lib/idx-market';
import { dispatchWorkflow, isCronAuthorized } from '@/lib/workflow-dispatch';

export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const gate = await idxDailyGate();
  if (!gate.open) {
    return NextResponse.json({ ok: true, dispatched: false, reason: 'outside_daily_window', gate });
  }
  const workflow = process.env.GH_STOCK_DAILY_WORKFLOW_FILE || 'stock-daily-maintenance.yml';
  const result = await dispatchWorkflow(workflow);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.body, gate }, { status: result.status });
  }
  return NextResponse.json({ ok: true, dispatched: true, workflow, gate, dispatchedAt: new Date().toISOString() });
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
