import { describe, expect, it } from 'vitest';
import { ALL_ENUMS, EnrolmentStatus, Role } from './enums';

describe('enums', () => {
  it('map each value to itself', () => {
    expect(Role.ADMIN).toBe('ADMIN');
    expect(Object.values(EnrolmentStatus)).toEqual([
      'AWAITING_APPROVAL',
      'AWAITING_PAYMENT',
      'PAYMENT_SUBMITTED',
      'ACTIVE',
      'COMPLETED',
      'EXPIRED',
      'CANCELLED',
    ]);
  });

  it('are frozen', () => {
    for (const values of Object.values(ALL_ENUMS)) {
      expect(Object.isFrozen(values)).toBe(true);
    }
  });
});
