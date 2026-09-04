'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PAIRS } from '@/lib/pairs';

export function NavBar() {
  const pathname = usePathname();
  const isStock = pathname === '/saham' || pathname.startsWith('/saham/');

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 overflow-x-auto px-6 py-3">
        {/* Brand Title: Gemini AI-Fund */}
        <Link href="/" className="shrink-0 flex items-center gap-1.5 font-sans text-sm font-semibold text-ink hover:opacity-90 transition-opacity">
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent font-bold">
            Gemini
          </span>
          <span className="text-ink">AI-Fund</span>
          <span className="ml-1 rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-blue-400 border border-blue-500/20">
            v2.5
          </span>
        </Link>
        <div className="flex shrink-0 items-center rounded-lg border border-border bg-bg p-1" aria-label="Pilih kelas aset">
          <Link
            href="/"
            aria-current={isStock ? undefined : 'page'}
            className={`rounded-md px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              isStock
                ? 'text-ink-muted hover:bg-surface hover:text-ink'
                : 'bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/25'
            }`}
          >
            Coin
          </Link>
          <Link
            href="/saham"
            aria-current={isStock ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              isStock
                ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/25'
                : 'text-ink-muted hover:bg-surface hover:text-ink'
            }`}
          >
            Saham
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isStock ? (
            <>
              <Link href="/saham" className="rounded-md px-2.5 py-1 font-mono text-xs text-ink-muted hover:bg-surface hover:text-ink">
                Overview
              </Link>
              <Link href="/saham#agents" className="rounded-md px-2.5 py-1 font-mono text-xs text-ink-muted hover:bg-surface hover:text-ink">Agents</Link>
              <Link href="/saham#screener" className="rounded-md px-2.5 py-1 font-mono text-xs text-ink-muted hover:bg-surface hover:text-ink">Screener</Link>
              <Link href="/saham/reports" className="rounded-md px-2.5 py-1 font-mono text-xs text-ink-muted hover:bg-surface hover:text-ink">Daily Report</Link>
            </>
          ) : (
            <>
          <Link href="/" className="rounded-md px-2.5 py-1 font-mono text-xs text-ink-muted hover:bg-surface hover:text-ink">
            Desk
          </Link>
          <Link href="/explore" className="rounded-md px-2.5 py-1 font-mono text-xs text-ink-muted hover:bg-surface hover:text-ink">
            Explore
          </Link>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          {PAIRS.map((p) => (
            <Link
              key={p.symbol}
              href={`/pair/${p.symbol}`}
              className="rounded-md px-2.5 py-1 font-mono text-xs text-ink-muted hover:bg-surface hover:text-ink"
            >
              {p.symbol.toUpperCase()}
            </Link>
          ))}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
