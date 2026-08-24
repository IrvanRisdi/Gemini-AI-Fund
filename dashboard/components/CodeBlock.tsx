'use client';

import { useState } from 'react';

function highlightJson(source: string): string {
  const escaped = source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        return /:$/.test(match)
          ? `<span class="text-accent">${match}</span>`
          : `<span class="text-positive">${match}</span>`;
      }
      if (/true|false/.test(match)) return `<span class="text-warning">${match}</span>`;
      if (/null/.test(match)) return `<span class="text-ink-faint">${match}</span>`;
      return `<span class="text-negative">${match}</span>`;
    }
  );
}

export function CodeBlock({
  filename,
  language = 'json',
  code,
  className = '',
}: {
  filename: string;
  language?: string;
  code: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  const html = language === 'json' ? highlightJson(code) : code.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-surface ${className}`}>
      <div className="flex items-center justify-between border-b border-border bg-bg/60 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-negative/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-positive/70" />
          </div>
          <span className="font-mono text-xs text-ink-muted">{filename}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md border border-border bg-surface-hover px-2 py-0.5 font-mono text-[10px] uppercase text-ink-muted">
            {language}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="font-mono text-[11px] text-ink-muted transition-colors hover:text-accent"
          >
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
      </div>
      <pre className="max-h-[32rem] overflow-auto p-4 font-mono text-[13px] leading-relaxed">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
