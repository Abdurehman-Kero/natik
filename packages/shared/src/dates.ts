/**
 * Dates are stored in UTC and always shown in East Africa Time (SRS §2.4).
 * Display format: "4 Nov 2026" and "4 Nov 2026, 10:42".
 */
import { MISSING_VALUE } from './money.js';

export const TIME_ZONE = 'Africa/Addis_Ababa';

type DateInput = Date | string | number | null | undefined;

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === '') return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parts(date: Date) {
  const map: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(date)) map[p.type] = p.value;
  return {
    day: map.day ?? '',
    month: map.month ?? '',
    year: map.year ?? '',
    hour: map.hour ?? '',
    minute: map.minute ?? '',
  };
}

/** `"4 Nov 2026"` (EAT). Missing → `"—"`. */
export function formatDate(input: DateInput): string {
  const date = toDate(input);
  if (!date) return MISSING_VALUE;
  const p = parts(date);
  return `${p.day} ${p.month} ${p.year}`;
}

/** `"4 Nov 2026, 10:42"` (EAT, 24-hour). Missing → `"—"`. */
export function formatDateTime(input: DateInput): string {
  const date = toDate(input);
  if (!date) return MISSING_VALUE;
  const p = parts(date);
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

/** `"10:42"` (EAT, 24-hour). Missing → `"—"`. */
export function formatTime(input: DateInput): string {
  const date = toDate(input);
  if (!date) return MISSING_VALUE;
  const p = parts(date);
  return `${p.hour}:${p.minute}`;
}

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `"2026-11-04"`: the calendar date in EAT (used in CSV exports). Missing → `"—"`. */
export function formatIsoDate(input: DateInput): string {
  const date = toDate(input);
  return date ? isoDateFormatter.format(date) : MISSING_VALUE;
}
