import { randomUUID } from 'node:crypto';

/** Unique, unguessable id for file names. */
export const createId = (): string => randomUUID();
