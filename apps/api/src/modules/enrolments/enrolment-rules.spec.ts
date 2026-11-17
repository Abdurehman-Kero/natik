import { describe, expect, it } from 'vitest';
import {
  accessEnd,
  ALLOWED_TRANSITIONS,
  canTransition,
  type EnrolmentState,
  progressPercent,
} from './enrolment-rules';

const ALL: EnrolmentState[] = [
  'NEW',
  'AWAITING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'ACTIVE',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
];
const TARGETS = ALL.filter((s) => s !== 'NEW') as Exclude<EnrolmentState, 'NEW'>[];

describe('enrolment transitions', () => {
  const allowed: [EnrolmentState, string][] = [
    ['NEW', 'ACTIVE'],
    ['NEW', 'AWAITING_PAYMENT'],
    ['AWAITING_PAYMENT', 'PAYMENT_SUBMITTED'],
    ['AWAITING_PAYMENT', 'CANCELLED'],
    ['AWAITING_PAYMENT', 'ACTIVE'],
    ['PAYMENT_SUBMITTED', 'ACTIVE'],
    ['PAYMENT_SUBMITTED', 'AWAITING_PAYMENT'],
    ['PAYMENT_SUBMITTED', 'CANCELLED'],
    ['ACTIVE', 'COMPLETED'],
    ['ACTIVE', 'EXPIRED'],
    ['ACTIVE', 'CANCELLED'],
    ['EXPIRED', 'ACTIVE'],
    ['EXPIRED', 'CANCELLED'],
  ];

  it.each(allowed)('%s → %s is allowed', (from, to) => {
    expect(canTransition(from, to as never)).toBe(true);
  });

  it('refuses every other move', () => {
    const permitted = new Set(allowed.map(([f, t]) => `${f}>${t}`));
    for (const from of ALL) {
      for (const to of TARGETS) {
        if (!permitted.has(`${from}>${to}`)) {
          expect(canTransition(from, to), `${from} → ${to}`).toBe(false);
        }
      }
    }
  });

  it('never leaves a finished enrolment (completed, cancelled)', () => {
    expect(ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe('access dates', () => {
  it('adds the access days, or never ends when unlimited', () => {
    const start = new Date('2026-11-01T00:00:00Z');
    expect(accessEnd(start, 90)?.toISOString()).toBe('2027-01-30T00:00:00.000Z');
    expect(accessEnd(start, null)).toBeNull();
    expect(accessEnd(start, 0)).toBeNull();
  });
});

describe('progress', () => {
  it('rounds down and handles empty courses', () => {
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(2, 3)).toBe(66);
    expect(progressPercent(3, 3)).toBe(100);
    expect(progressPercent(0, 0)).toBe(0);
  });
});
