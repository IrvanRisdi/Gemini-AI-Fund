import { NextResponse } from 'next/server';
import { idxGate } from '@/lib/idx-market';
import { dispatchWorkflow, isCronAuthorized } from '@/lib/workflow-dispatch';

export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const gate = await idxGate();
  if (!gate.open) {
    return NextResponse.json({ ok: true, dispatched: false, reason: 'idx_closed', gate });
  }
  const workflow = process.env.GH_STOCK_WORKFLOW_FILE || 'stock-trading-loop.yml';
  const result = await dispatchWorkflow(workflow);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.body, gate }, { status: result.status });
  }
  return NextResponse.json({ ok: true, dispatched: true, workflow, gate, dispatchedAt: new Date().toISOString() });
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
