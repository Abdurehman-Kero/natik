import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import type { StoredStream } from '../../common/storage/storage.service';

/** Sends a stored file, honouring byte ranges so audio and video can skip ahead. */
export async function pipeStored(
  res: Response,
  stored: StoredStream,
  options: { contentType: string; disposition?: string; cache: string },
): Promise<void> {
  res.status(stored.partial ? 206 : 200);
  res.setHeader('Content-Type', options.contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', options.cache);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (options.disposition) res.setHeader('Content-Disposition', options.disposition);
  if (stored.contentLength !== undefined) res.setHeader('Content-Length', stored.contentLength);
  if (stored.contentRange) res.setHeader('Content-Range', stored.contentRange);
  try {
    await pipeline(stored.body, res);
  } catch {
    // The viewer closed the page or lost the connection; nothing to report.
    res.destroy();
  }
}
