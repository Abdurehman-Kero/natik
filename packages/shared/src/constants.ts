/** Brand palette (SRS D9). The web app defines the same values as CSS tokens. */
export const BRAND = {
  navy: '#123B5A',
  gold: '#B69A4A',
  goldStrong: '#8A7232',
  offWhite: '#F7F6F2',
  text: '#202A32',
  white: '#FFFFFF',
} as const;

const MB = 1024 * 1024;

/** Upload limits by kind (ARCHITECTURE §10). */
export const UPLOAD_LIMITS = {
  pdf: { maxBytes: 25 * MB, mimeTypes: ['application/pdf'] },
  audio: {
    maxBytes: 25 * MB,
    mimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/wav', 'audio/x-wav'],
  },
  image: { maxBytes: 5 * MB, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  /** PowerPoint, Word and Excel attached to a session (downloaded by students). */
  document: {
    maxBytes: 50 * MB,
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
    extensions: ['.pptx', '.ppt', '.docx', '.doc', '.xlsx', '.xls'],
  },
  receipt: {
    maxBytes: 5 * MB,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
} as const;

export type UploadKind = keyof typeof UPLOAD_LIMITS;

/** Bytes → whole megabytes for messages like "This file is 32 MB. The maximum is 25 MB." */
export function bytesToMb(bytes: number): number {
  return Math.ceil(bytes / MB);
}

/** Courses run week by week, with up to this many sessions in a week. */
export const MAX_SESSIONS_PER_WEEK = 3;

/** A session stays marked "New" for students this long after it is added (unless opened). */
export const NEW_SESSION_DAYS = 7;

/** The reactions a course group offers, as in Telegram. */
export const GROUP_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '👏'] as const;

/** Largest page size any list endpoint accepts. */
export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 20;
