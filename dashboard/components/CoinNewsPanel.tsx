import type { NewsItem } from '@/lib/news';
import { formatWibDateTime } from '@/lib/time';

export function CoinNewsPanel({ news }: { news: NewsItem[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <div>
        <h3 className="font-sans text-lg font-semibold text-ink">Berita Terkini</h3>
        <p className="mt-1 font-sans text-xs text-ink-muted">Konteks berita, bukan sinyal beli atau jual. Diperbarui maksimal sekali per jam.</p>
      </div>
      {news.length ? (
        <div className="divide-y divide-border">
          {news.map((item) => (
            <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="block py-3 first:pt-0 last:pb-0 hover:opacity-80">
              <p className="font-sans text-sm font-medium leading-snug text-ink">{item.title}</p>
              <p className="mt-1 font-mono text-[10px] text-ink-muted">{item.source} · {item.publishedAt ? formatWibDateTime(item.publishedAt) : 'Waktu tidak tersedia'}</p>
            </a>
          ))}
        </div>
      ) : (
        <p className="font-sans text-sm text-ink-muted">Belum ada berita relevan yang dapat ditampilkan saat ini.</p>
      )}
    </div>
  );
}
