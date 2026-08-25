'use client';

import { useState } from 'react';
import type { DeskSnapshot } from '@/lib/desk-data';

function formatInline(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold (**teks**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>');
  // Italic (*teks*)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em class="text-ink-muted italic">$1</em>');
  // Code (`teks`)
  html = html.replace(/`(.+?)`/g, '<code class="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[11px] text-blue-300">$1</code>');

  return html;
}

function renderFormattedText(text: string) {
  if (!text) return null;

  const isUserQuestion = text.startsWith('> ');
  let questionPart = '';
  let answerPart = text;

  if (isUserQuestion) {
    const firstNewline = text.indexOf('\n');
    if (firstNewline !== -1) {
      questionPart = text.slice(2, firstNewline).trim();
      answerPart = text.slice(firstNewline).trim();
    } else {
      questionPart = text.slice(2).trim();
      answerPart = '';
    }
  }

  const lines = answerPart.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Header: Ubah ### menjadi sub-judul biru rapi
    if (line.startsWith('### ') || line.startsWith('#### ')) {
      const title = line.replace(/^#{3,4}\s+/, '').replace(/\*\*/g, '');
      elements.push(
        <h4 key={i} className="mt-3.5 mb-1.5 font-sans text-sm font-semibold text-blue-300 flex items-center gap-1.5 border-b border-border/40 pb-1">
          {title}
        </h4>
      );
      continue;
    }

    // Pemisah horizontal ---
    if (line === '---') {
      elements.push(<hr key={i} className="my-2.5 border-border/40" />);
      continue;
    }

    // Poin bernomor: 1. 2. 3.
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      const numStr = numMatch;
      const contentStr = numMatch || '';
      elements.push(
        <div key={i} className="mt-2 mb-1 flex items-start gap-2 text-xs sm:text-sm font-medium text-ink">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 font-mono text-[11px] text-blue-400 font-semibold">
            {numStr}
          </span>
          <div className="flex-1 pt-0.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(contentStr) }} />
        </div>
      );
      continue;
    }

    // Poin bullet: * atau -
    if (line.startsWith('* ') || line.startsWith('- ')) {
      const contentStr = line.slice(2);
      elements.push(
        <div key={i} className="ml-2 sm:ml-4 my-1 flex items-start gap-2 text-xs sm:text-sm text-ink-muted">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/70" />
          <div className="flex-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(contentStr) }} />
        </div>
      );
      continue;
    }

    // Paragraf biasa
    elements.push(
      <p key={i} className="my-1 text-xs sm:text-sm leading-relaxed text-ink-muted" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
    );
  }

  return (
    <div className="space-y-1">
      {questionPart && (
        <div className="mb-3 rounded-lg border border-accent/20 bg-accent/5 p-2.5 font-sans text-xs sm:text-sm text-ink">
          <span className="font-semibold text-accent mr-1.5">Pertanyaan:</span>
          {questionPart}
        </div>
      )}
      <div className="space-y-0.5 text-xs sm:text-sm leading-relaxed">
        {elements}
      </div>
    </div>
  );
}

export function AiConsole({ snapshot }: { snapshot: DeskSnapshot }) {
  const [question, setQuestion] = useState('');
  const [displayed, setDisplayed] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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

  async function handleCopy() {
    if (!displayed) return;
    try {
      await navigator.clipboard.writeText(displayed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-4 sm:p-5 w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-base sm:text-lg font-semibold text-ink flex items-center gap-2">
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent font-bold">
            Gemini
          </span>{' '}
          Console
        </h3>
        <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 font-mono text-[10px] sm:text-[11px] font-medium tracking-wide text-blue-400 border border-blue-500/20 uppercase flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          AI LIVE
        </span>
      </div>

      {/* Input Form */}
      <div className="flex flex-col sm:flex-row gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
