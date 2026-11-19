import { ErrorCode } from '@natik/shared';

/**
 * Default English messages sent with each error code. The web app shows its own
 * translated text from messages/en.json (errors.<CODE>) and falls back to these.
 * Wording follows SRS §10: plain language, says what to do next.
 */
export const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Some details need fixing. Check the highlighted fields.',
  BAD_REQUEST: "We couldn't understand that request.",
  UNAUTHENTICATED: 'Please sign in to continue.',
  FORBIDDEN: "You don't have access to this.",
  NOT_FOUND: "We couldn't find that.",
  CONFLICT: 'This was changed by someone else. Refresh and try again.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  PAYLOAD_TOO_LARGE: 'This is too large to upload.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
  SERVICE_UNAVAILABLE: 'This service is temporarily unavailable. Please try again soon.',
  INVALID_CREDENTIALS: 'Phone number or password is incorrect.',
  ACCOUNT_LOCKED: 'Too many attempts. Try again in 15 minutes or reset your password.',
  COURSE_ACCESS_DENIED: "You don't have access to this course yet.",
  ACCESS_EXPIRED: 'Your access to this course has ended. Contact us to renew.',
  FILE_TOO_LARGE: 'This file is too large.',
  FILE_TYPE_NOT_ALLOWED: "This type of file isn't allowed here.",
  MEDIA_UNAVAILABLE: "This can't load right now. Try again or report a problem.",
  QUIZ_TIME_UP: 'Time is up. Your saved answers were submitted.',
  PAYMENT_REFERENCE_DUPLICATE:
    'This reference was already submitted. Contact us if this is a mistake.',
  PHONE_ALREADY_REGISTERED: 'This number already has an account. Sign in or reset your password.',
  EMAIL_ALREADY_REGISTERED: 'This email already has an account. Sign in or reset your password.',
  OTP_INVALID: "That code isn't right or has expired. Request a new one.",
  OTP_TOO_SOON: 'Please wait a minute before asking for another code.',
  PASSWORD_LINK_INVALID: 'This link has expired or was already used. Ask for a new one.',
  CURRENT_PASSWORD_WRONG: 'Your current password is incorrect.',
  LAST_OWNER: 'At least one owner is required.',
  OWNER_REQUIRED: 'Only the owner can do this.',
  SLUG_TAKEN: 'That web address is already used by another course. Choose a different one.',
  NOT_READY_TO_PUBLISH: 'Some details are missing before this can be published.',
  CANNOT_DELETE_PUBLISHED:
    'This has been published, so it can only be hidden. Hiding keeps student results.',
  IN_USE: 'This is in use, so it cannot be removed. You can deactivate it instead.',
  ALREADY_ENROLLED: 'This student is already enrolled in this course.',
  PAYMENT_ALREADY_CHECKED: 'This payment was already checked by someone else. Refresh the list.',
  ENROLMENT_NOT_ALLOWED: "This can't be done in the enrolment's current state.",
  COURSE_NOT_OPEN: "This course isn't open for enrolment right now.",
  NO_ATTEMPTS_LEFT: 'You have used all your attempts for this quiz.',
  QUIZ_NOT_READY: 'Some details are missing before this quiz can be published.',
  ATTEMPT_CLOSED: 'This attempt has already been submitted.',
  CERTIFICATE_NOT_READY: 'Your certificate is being prepared. Try again in a minute.',
};
