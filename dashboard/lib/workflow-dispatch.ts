export function isCronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  if (request.headers.get('authorization') === `Bearer ${expected}`) return true;
  if (request.headers.get('x-cron-secret') === expected) return true;
  return new URL(request.url).searchParams.get('secret') === expected;
}

export async function dispatchWorkflow(workflowFile: string) {
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) {
    return { ok: false, status: 500, body: 'GH_DISPATCH_TOKEN belum diset di Vercel.' };
  }
  const owner = process.env.GH_OWNER || 'IrvanRisdi';
  const repo = process.env.GH_REPO || 'Gemini-AI-Fund';
  const ref = process.env.GH_REF || 'main';
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref }),
  });
  if (response.status === 204) return { ok: true, status: 204, body: 'dispatched' };
  const body = await response.text().catch(() => '');
  return { ok: false, status: response.status, body: body || `GitHub HTTP ${response.status}` };
}
