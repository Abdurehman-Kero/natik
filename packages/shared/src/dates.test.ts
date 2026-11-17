import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatIsoDate, formatTime } from './dates';
import { MISSING_VALUE } from './money';

describe('dates are shown in East Africa Time (UTC+3)', () => {
  // 21:30 UTC on 3 Nov = 00:30 EAT on 4 Nov
  const lateUtc = '2026-11-03T21:30:00.000Z';

  it('formatDate uses the EAT calendar day', () => {
    expect(formatDate(lateUtc)).toBe('4 Nov 2026');
    expect(formatDate(new Date('2026-11-30T09:00:00Z'))).toBe('30 Nov 2026');
  });

  it('uses short English month names consistently (Sep, not Sept)', () => {
    expect(formatDate('2026-09-15T09:00:00Z')).toBe('15 Sep 2026');
  });

  it('formatDateTime uses a 24-hour clock', () => {
    expect(formatDateTime(lateUtc)).toBe('4 Nov 2026, 00:30');
    expect(formatDateTime('2026-11-04T07:42:00Z')).toBe('4 Nov 2026, 10:42');
  });

  it('formatTime returns HH:mm in EAT', () => {
    expect(formatTime('2026-11-04T12:05:00Z')).toBe('15:05');
  });

  it('formatIsoDate returns the EAT calendar date', () => {
    expect(formatIsoDate(lateUtc)).toBe('2026-11-04');
  });

  it('returns a dash for missing or invalid input', () => {
    expect(formatDate(null)).toBe(MISSING_VALUE);
    expect(formatDate('not a date')).toBe(MISSING_VALUE);
    expect(formatDateTime(undefined)).toBe(MISSING_VALUE);
    expect(formatIsoDate('')).toBe(MISSING_VALUE);
  });
});
