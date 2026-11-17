/** Every background queue (ARCHITECTURE §11). Processors are added by later milestones. */
export const QUEUES = {
  /** Outgoing SMS with retries (M2). */
  SMS: 'sms',
  /** Cancel unpaid, expire, remind before expiry (M5). */
  ENROLMENT: 'enrolment',
  /** Recalculate course progress after publish/hide (M3/M5). */
  PROGRESS: 'progress',
  /** Auto-submit timed-out quiz attempts (M6). */
  QUIZ: 'quiz',
  /** Render certificate PDFs (M6). */
  CERTIFICATE: 'certificate',
  /** Data-keeping clean-up (M7). */
  RETENTION: 'retention',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const QUEUE_NAMES: QueueName[] = Object.values(QUEUES);
