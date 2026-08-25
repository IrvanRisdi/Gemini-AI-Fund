export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
}

interface GdeltArticle {
  title?: string;
  url?: string;
  domain?: string;
  seendate?: string;
}

/**
 * Broad, no-key news discovery. Results are cached for one hour so opening a
 * pair page never causes repeated provider calls. News is intentionally kept
 * separate from a trading signal: an article is context, not a recommendation.
 */
export async function fetchCoinNews(name: string, symbol: string): Promise<NewsItem[]> {
  try {
    const query = `"${name.replace(/"/g, '')}" OR "${symbol.replace(/"/g, '')} crypto"`;
    const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    url.searchParams.set('query', query);
    url.searchParams.set('mode', 'artlist');
    url.searchParams.set('format', 'json');
    url.searchParams.set('maxrecords', '5');
    url.searchParams.set('timespan', '7d');
    url.searchParams.set('sort', 'datedesc');
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { articles?: GdeltArticle[] };
    const seen = new Set<string>();
    return (data.articles ?? [])
      .filter((article) => article.title && article.url && !seen.has(article.url) && (seen.add(article.url), true))
      .slice(0, 5)
      .map((article) => ({
        title: article.title as string,
        url: article.url as string,
        source: article.domain || 'Sumber berita',
        publishedAt: article.seendate ?? null,
      }));
  } catch {
    return [];
  }
}
