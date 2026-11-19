/**
 * Stable error codes returned by the API in `{ error: { code, message } }`.
 * The web app shows `messages/en.json → errors.<CODE>` and falls back to `message`.
 */
export const ErrorCode = {
  // Generic
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  // SRS §10 situations
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  COURSE_ACCESS_DENIED: 'COURSE_ACCESS_DENIED',
  ACCESS_EXPIRED: 'ACCESS_EXPIRED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED: 'FILE_TYPE_NOT_ALLOWED',
  MEDIA_UNAVAILABLE: 'MEDIA_UNAVAILABLE',
  QUIZ_TIME_UP: 'QUIZ_TIME_UP',
  PAYMENT_REFERENCE_DUPLICATE: 'PAYMENT_REFERENCE_DUPLICATE',
  // Accounts (M2)
  PHONE_ALREADY_REGISTERED: 'PHONE_ALREADY_REGISTERED',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  GOOGLE_SIGN_UP_EXPIRED: 'GOOGLE_SIGN_UP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_TOO_SOON: 'OTP_TOO_SOON',
  PASSWORD_LINK_INVALID: 'PASSWORD_LINK_INVALID',
  CURRENT_PASSWORD_WRONG: 'CURRENT_PASSWORD_WRONG',
  LAST_OWNER: 'LAST_OWNER',
  OWNER_REQUIRED: 'OWNER_REQUIRED',
  // Course builder (M3)
  SLUG_TAKEN: 'SLUG_TAKEN',
  NOT_READY_TO_PUBLISH: 'NOT_READY_TO_PUBLISH',
  CANNOT_DELETE_PUBLISHED: 'CANNOT_DELETE_PUBLISHED',
  IN_USE: 'IN_USE',
  // Enrolment and payments (M5)
  ALREADY_ENROLLED: 'ALREADY_ENROLLED',
  PAYMENT_ALREADY_CHECKED: 'PAYMENT_ALREADY_CHECKED',
  ENROLMENT_NOT_ALLOWED: 'ENROLMENT_NOT_ALLOWED',
  COURSE_NOT_OPEN: 'COURSE_NOT_OPEN',
  // Quizzes and certificates (M6)
  NO_ATTEMPTS_LEFT: 'NO_ATTEMPTS_LEFT',
  QUIZ_NOT_READY: 'QUIZ_NOT_READY',
  ATTEMPT_CLOSED: 'ATTEMPT_CLOSED',
  CERTIFICATE_NOT_READY: 'CERTIFICATE_NOT_READY',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** The one error shape used by every API response (ARCHITECTURE §7). */
export interface ApiErrorBody {
  error: {
    code: ErrorCode | (string & {});
    message: string;
    /** Field name → messages, for form validation errors. */
    fields?: Record<string, string[]>;
    /** Values for messages with placeholders, e.g. `{ size: 32, max: 25 }`. */
    params?: Record<string, string | number>;
    requestId?: string;
  };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}
