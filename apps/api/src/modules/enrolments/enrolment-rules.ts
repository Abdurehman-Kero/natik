import type { EnrolmentStatus } from '../../generated/prisma/client';

/** Where an enrolment starts, before it has a status. */
export type EnrolmentState = EnrolmentStatus | 'NEW';

/**
 * Every allowed change of an enrolment's status (ARCHITECTURE §6). Anything not listed here is refused.
 * Two moves go slightly beyond the SRS table so real situations don't dead-end, and are marked (+):
 * an admin can take cash for a student who has not submitted a reference yet, and can cancel an
 * enrolment that is under review or expired.
 */
export const ALLOWED_TRANSITIONS: Record<EnrolmentState, readonly EnrolmentStatus[]> = {
  NEW: ['ACTIVE', 'AWAITING_PAYMENT', 'AWAITING_APPROVAL'],
  // A free course: an admin accepts the student, or turns the request down.
  AWAITING_APPROVAL: ['ACTIVE', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAYMENT_SUBMITTED', 'CANCELLED', 'ACTIVE' /* + cash at the centre */],
  PAYMENT_SUBMITTED: ['ACTIVE', 'AWAITING_PAYMENT', 'CANCELLED' /* + */],
  ACTIVE: ['COMPLETED', 'EXPIRED', 'CANCELLED'],
  EXPIRED: ['ACTIVE', 'CANCELLED' /* + */],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: EnrolmentState, to: EnrolmentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** A new access period starting at `start`. `null` days = unlimited, so no end date. */
export function accessEnd(start: Date, accessDays: number | null | undefined): Date | null {
  if (!accessDays || accessDays <= 0) return null;
  return new Date(start.getTime() + accessDays * 86_400_000);
}

/** Percentage done, rounded down so nobody sees 100% before they truly finish (FR-LEARN-004). */
export function progressPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.floor((completed / total) * 100));
}

/** Waiting for payment longer than this and the enrolment is cancelled (Q5). */
export const UNPAID_DAYS = 7;
/** Students are reminded this many days before access ends (FR-ENR-008). */
export const REMINDER_DAYS = 3;
