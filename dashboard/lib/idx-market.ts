export type IdxGate = {
  tradingDate: string;
  localTime: string;
  weekday: number;
  holiday: boolean;
  session: 'SESSION_1' | 'SESSION_2' | 'CLOSED';
  open: boolean;
  calendarStatus: 'VALIDATED' | 'UNAVAILABLE';
};

const HOLIDAY_URL =
  'https://raw.githubusercontent.com/IrvanRisdi/Gemini-AI-Fund/main/stocks-engine/data/idx_holidays.json';

function jakartaClock(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  return {
    tradingDate: `${value('year')}-${value('month')}-${value('day')}`,
    localTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    weekday: weekdays[value('weekday')] ?? -1,
    minuteOfDay: hour * 60 + minute,
  };
}

async function holidays(): Promise<{ dates: Set<string>; status: 'VALIDATED' | 'UNAVAILABLE' }> {
  try {
    const response = await fetch(HOLIDAY_URL, { next: { revalidate: 86_400 } });
    if (!response.ok) throw new Error(`holiday calendar HTTP ${response.status}`);
    const payload = (await response.json()) as { status?: string; holidays?: string[] };
    if (payload.status !== 'VALIDATED' || !Array.isArray(payload.holidays)) {
      throw new Error('holiday calendar is not validated');
    }
    return { dates: new Set(payload.holidays), status: 'VALIDATED' };
  } catch {
    return { dates: new Set(), status: 'UNAVAILABLE' };
  }
}

export async function idxGate(now = new Date()): Promise<IdxGate> {
  const clock = jakartaClock(now);
  const calendar = await holidays();
  const holiday = calendar.dates.has(clock.tradingDate);
  const weekdayOpen = clock.weekday >= 1 && clock.weekday <= 5;
  const friday = clock.weekday === 5;
  const session1End = friday ? 11 * 60 + 30 : 12 * 60;
  const session2Start = friday ? 14 * 60 : 13 * 60 + 30;
  let session: IdxGate['session'] = 'CLOSED';
  if (clock.minuteOfDay >= 9 * 60 && clock.minuteOfDay < session1End) session = 'SESSION_1';
  if (clock.minuteOfDay >= session2Start && clock.minuteOfDay < 15 * 60 + 50) session = 'SESSION_2';
  const open = weekdayOpen && !holiday && calendar.status === 'VALIDATED' && session !== 'CLOSED';
  return { ...clock, holiday, session, open, calendarStatus: calendar.status };
}

export async function idxDailyGate(now = new Date()) {
  const gate = await idxGate(now);
  const [hour, minute] = gate.localTime.split(':').map(Number);
  const inDispatchWindow = hour === 16 && minute >= 30 && minute < 35;
  return {
    ...gate,
    open: gate.weekday >= 1 && gate.weekday <= 5 && !gate.holiday &&
      gate.calendarStatus === 'VALIDATED' && inDispatchWindow,
    session: 'CLOSED' as const,
  };
}
