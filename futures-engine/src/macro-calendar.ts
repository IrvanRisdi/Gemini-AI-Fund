import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MacroEvent, MacroWindowStatus } from './types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CALENDAR_PATH = path.resolve(HERE, '..', 'data', 'macro-calendar-2026-2027.json');

interface CalendarFile {
  version: string;
  events: MacroEvent[];
}

let cachedEvents: MacroEvent[] | null = null;

export function loadMacroEvents(): MacroEvent[] {
  if (cachedEvents) return cachedEvents;
  try {
    const raw = JSON.parse(fs.readFileSync(CALENDAR_PATH, 'utf8')) as CalendarFile;
    cachedEvents = Array.isArray(raw.events) ? raw.events : [];
  } catch {
    cachedEvents = [];
  }
  return cachedEvents;
}

export function evaluateMacroWindow(
  nowMs = Date.now(),
  events: MacroEvent[] = loadMacroEvents(),
): MacroWindowStatus {
  const upcoming: Array<MacroEvent & { hoursUntil: number }> = [];

  for (const event of events) {
    const eventMs = Date.parse(event.utc);
    if (!Number.isFinite(eventMs)) continue;
    const hoursUntil = (eventMs - nowMs) / 3_600_000;
    // Track from 1 hour AFTER release (post-release whip) up to 24 hours BEFORE release
    if (hoursUntil >= -1 && hoursUntil <= 24) {
      upcoming.push({ ...event, hoursUntil: Number(hoursUntil.toFixed(2)) });
    }
  }

  upcoming.sort((a, b) => Math.abs(a.hoursUntil) - Math.abs(b.hoursUntil));
  const nearest = upcoming[0] ?? null;

  const hardBlackout = upcoming.some(
    (e) => e.hoursUntil >= -0.5 && e.hoursUntil <= e.vetoHoursBefore,
  );
  const cautionActive = upcoming.some(
    (e) => e.hoursUntil >= -1 && e.hoursUntil <= e.cautionHoursBefore,
  );

  return {
    hardBlackout,
    cautionActive,
    nearestEvent: nearest,
    upcomingWithin24h: upcoming,
  };
}
