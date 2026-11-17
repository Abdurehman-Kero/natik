import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { VideoStatus } from '@natik/shared';
import type {
  ProviderVideoState,
  VideoPlayback,
  VideoProvider,
  VideoUpload,
} from './video-provider';

export interface BunnyOptions {
  libraryId: string;
  apiKey: string;
  tokenKey: string;
  apiUrl: string;
  tusUrl: string;
  embedUrl: string;
  /** The library's CDN host (e.g. vz-abc123.b-cdn.net), where Bunny keeps each video's thumbnail. */
  cdnHost?: string;
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** Bunny Stream statuses: 0 created · 1 uploaded · 2 processing · 3 transcoding · 4 finished · 5 error · 6 upload failed. */
export function mapBunnyStatus(code: number): VideoStatus {
  if (code === 4) return 'READY';
  if (code === 5 || code === 6) return 'FAILED';
  if (code === 0) return 'UPLOADING';
  // 1 uploaded, 2 processing, 3 transcoding, 7/8 just-in-time packaging: playable soon.
  return code >= 7 ? 'READY' : 'PROCESSING';
}

/**
 * Bunny Stream adapter (SRS D8): resumable (TUS) uploads straight from the browser, token-signed
 * embed links, and a library locked to Natik's domain (FR-LEARN-007).
 * The library API key stays on the server. The browser only gets a signature that works for one
 * video and expires after a few hours.
 */
export class BunnyVideoProvider implements VideoProvider {
  readonly name = 'bunny' as const;

  thumbnailUrl(providerVideoId: string): string | null {
    const host = this.options.cdnHost?.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return host ? `https://${host}/${providerVideoId}/thumbnail.jpg` : null;
  }
  private readonly logger = new Logger('Bunny');

  constructor(private readonly options: BunnyOptions) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.options.apiUrl}/library/${this.options.libraryId}${path}`, {
      ...init,
      headers: {
        AccessKey: this.options.apiKey,
        accept: 'application/json',
        'content-type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      this.logger.warn(`Bunny ${init.method ?? 'GET'} ${path} → ${res.status}`);
      throw new Error(`Bunny request failed (${res.status})`);
    }
    return (await res.json()) as T;
  }

  async create(input: { title: string }) {
    const created = await this.call<{ guid: string }>('/videos', {
      method: 'POST',
      body: JSON.stringify({ title: input.title }),
    });
    return { providerVideoId: created.guid };
  }

  uploadFor(providerVideoId: string): VideoUpload {
    // Signature = SHA256(libraryId + apiKey + expire + videoId); valid for 6 hours.
    const expire = Math.floor(Date.now() / 1000) + 6 * 3600;
    return {
      kind: 'tus',
      endpoint: this.options.tusUrl,
      headers: {
        AuthorizationSignature: sha256(
          `${this.options.libraryId}${this.options.apiKey}${expire}${providerVideoId}`,
        ),
        AuthorizationExpire: String(expire),
        VideoId: providerVideoId,
        LibraryId: this.options.libraryId,
      },
    };
  }

  async state(providerVideoId: string): Promise<ProviderVideoState> {
    const video = await this.call<{ status: number; length?: number }>(
      `/videos/${providerVideoId}`,
    );
    return {
      status: mapBunnyStatus(video.status),
      durationSec: video.length && video.length > 0 ? Math.round(video.length) : null,
    };
  }

  playback(providerVideoId: string): VideoPlayback {
    // Token = SHA256(tokenKey + videoId + expires). Autoplay and preload are off (FR-LEARN-006).
    const expires = Math.floor(Date.now() / 1000) + 4 * 3600;
    const token = sha256(`${this.options.tokenKey}${providerVideoId}${expires}`);
    const url =
      `${this.options.embedUrl}/${this.options.libraryId}/${providerVideoId}` +
      `?token=${token}&expires=${expires}&autoplay=false&preload=false&responsive=true`;
    return { kind: 'iframe', url, expiresAt: expires * 1000 };
  }

  async remove(providerVideoId: string): Promise<void> {
    await this.call(`/videos/${providerVideoId}`, { method: 'DELETE' });
  }
}
