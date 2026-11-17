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

/** Largest page size any list endpoint accepts. */
export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 20;
