'use client';

import { useRef, useState } from 'react';
import { CodeBlock } from './CodeBlock';
import type { DeskSnapshot } from '@/lib/desk-data';

const LINE_DELAY_MS = 90;

/**
 * Placeholder response generator. No LLM is wired up yet — this only
 * reflects real desk numbers back at the user so the console isn't
 * pure fiction. Swap this for a real `fetch('/api/ai-console', ...)`
 * call once a backend (e.g. the Claude API) is connected.
 */
function buildMockResponse(question: string, snapshot: DeskSnapshot): string {
  const active = snapshot.agents.filter((a) => a.status === 'active');
  const withPositions = active.filter((a) => a.openPairs.length > 0);
  const pnl = snapshot.totalEquity - snapshot.startingTotal;

  const lines = [
    `> ${question}`,
    '',
    `desk.lastCycle       = "${snapshot.lastCycle}"`,
    `desk.mode            = "${snapshot.deskMode}"`,
    `desk.totalEquityIdr  = ${Math.round(snapshot.totalEquity).toLocaleString('en-US')}`,
    `desk.pnlIdr          = ${pnl >= 0 ? '+' : ''}${Math.round(pnl).toLocaleString('en-US')}`,
    `desk.activeAgents    = ${active.length}`,
    `desk.openPositions   = ${withPositions.length}`,
    '',
    withPositions.length > 0
      ? `Open books: ${withPositions.map((a) => `${a.slug} (${a.openPairs.join(', ')})`).join(', ')}`
      : 'No open positions right now — every book is flat.',
    '',
    '// This is a placeholder response reading real .desk/ state directly —',
    '// no LLM is connected yet. Wire /api/ai-console to Claude to make this live.',
  ];

  return lines.join('\n');
}

export function AiConsole({ snapshot }: { snapshot: DeskSnapshot }) {
  const [question, setQuestion] = useState('');
  const [displayed, setDisplayed] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function handleSend() {
    const trimmed = question.trim();
    if (!trimmed || isStreaming) return;

    if (timerRef.current) clearInterval(timerRef.current);

    const fullResponse = buildMockResponse(trimmed, snapshot);
    const lines = fullResponse.split('\n');
    let i = 0;
    setDisplayed('');
    setIsStreaming(true);

    timerRef.current = setInterval(() => {
      i += 1;
      setDisplayed(lines.slice(0, i).join('\n'));
      if (i >= lines.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsStreaming(false);
      }
    }, LINE_DELAY_MS);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-lg font-semibold text-ink">AI Console</h3>
        <span className="rounded-full bg-accent-bg px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide text-accent uppercase">
          preview
        </span>
      </div>

      <div className="flex gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Tanya tentang posisi desk, mis. 'siapa yang punya posisi terbuka?'"
          rows={2}
          className="flex-1 resize-none rounded-lg border border-border bg-bg/60 px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isStreaming || !question.trim()}
          className="rounded-lg bg-accent px-4 py-2 font-sans text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isStreaming ? '...' : 'Kirim'}
        </button>
      </div>

      {displayed && <CodeBlock filename="ai-console.log" language="text" code={displayed} />}
    </div>
  );
}
