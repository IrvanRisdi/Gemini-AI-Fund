'use client';

import { useState } from 'react';
import { CodeBlock } from './CodeBlock';
import type { DeskSnapshot } from '@/lib/desk-data';

export function AiConsole({ snapshot }: { snapshot: DeskSnapshot }) {
  const [question, setQuestion] = useState('');
  const [displayed, setDisplayed] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSend() {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setDisplayed(`> ${trimmed}\n\n[Sedang menganalisis portofolio dengan Gemini AI...]`);

    try {
      const res = await fetch('/api/ai-console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          snapshot,
        }),
      });

      const data = await res.json();
      if (data.response) {
        setDisplayed(`> ${trimmed}\n\n${data.response}`);
      } else {
        setDisplayed(`> ${trimmed}\n\n⚠️ Tidak dapat memuat respon dari server.`);
      }
    } catch (err: any) {
      setDisplayed(`> ${trimmed}\n\n⚠️ Gagal terhubung ke Gemini API: ${err?.message || 'Network error'}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-lg font-semibold text-ink flex items-center gap-2">
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent font-bold">
            Gemini
          </span>{' '}
          Console
        </h3>
        <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide text-blue-400 border border-blue-500/20 uppercase">
          AI LIVE
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
          placeholder="Tanya apa saja tentang desk, mis. 'Jelaskan mengapa SHIB, LTC, dan ETH dibuka?'"
          rows={2}
          disabled={isLoading}
          className="flex-1 resize-none rounded-lg border border-border bg-bg/60 px-3 py-2 font-sans text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading || !question.trim()}
          className="rounded-lg bg-accent px-5 py-2 font-sans text-sm font-semibold text-bg transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center min-w-[75px]"
        >
          {isLoading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent"></span>
          ) : (
            'Kirim'
          )}
        </button>
      </div>

      {displayed && <CodeBlock filename="gemini-ai.md" language="markdown" code={displayed} />}
    </div>
  );
}
