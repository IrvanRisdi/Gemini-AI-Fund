export const WIB_TIME_ZONE = 'Asia/Jakarta';

function toDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatWibDateTime(value: string | number | Date): string {
  const date = toDate(value);
  if (!date) return '—';

  return `${date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: WIB_TIME_ZONE,
  })} WIB`;
}

export function formatWibTime(value: string | number | Date): string {
  const date = toDate(value);
  if (!date) return '—';

  return `${date.toLocaleString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: WIB_TIME_ZONE,
  })} WIB`;
}

export function formatWibDate(value: string | number | Date): string {
  const date = toDate(value);
  if (!date) return '—';

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: WIB_TIME_ZONE,
  });
}

/** Converts timestamp labels in historical briefing text without changing the source data. */
export function localizeUtcLabels(text: string): string {
  return text.replace(
    /(\d{4}-\d{2}-\d{2})(?:T|\s)(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?\s*(?:Z|UTC)\b/g,
    (_match, date: string, time: string) => formatWibDateTime(`${date}T${time}:00Z`),
  );
}
