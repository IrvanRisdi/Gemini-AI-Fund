import Link from 'next/link';
import { PAIRS } from '@/lib/pairs';

export function NavBar() {
  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto px-6 py-3">
        <Link href="/" className="shrink-0 font-sans text-sm font-semibold text-ink hover:text-accent">
          AI Fund
        </Link>
        <div className="flex shrink-0 items-center gap-1">
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
        </div>
      </div>
    </nav>
  );
}
