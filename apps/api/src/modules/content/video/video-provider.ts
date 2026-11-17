import type { VideoStatus } from '@natik/shared';

/** How the browser should send the video file to the provider. */
export type VideoUpload =
  /** Resumable upload (TUS) straight to Bunny: a dropped connection continues where it stopped. */
  | {
      kind: 'tus';
      endpoint: string;
      headers: Record<string, string>;
    }
  /** Development only: the file goes to our own API in one request. */
  | { kind: 'direct'; url: string };

/** How a signed-in viewer plays a video. */
export type VideoPlayback =
  /** An embeddable player page (Bunny). The link is signed and expires. */
  | { kind: 'iframe'; url: string; expiresAt: number }
  /** A video file served by our API with an access check on every request (development only). */
  | { kind: 'file'; url: string; captionsUrl?: string };

export interface ProviderVideoState {
  status: VideoStatus;
  durationSec: number | null;
}

/**
 * The only place that knows which video service is used (ARCHITECTURE §10). Switching to another
 * service means writing one more class that implements this interface.
 */
export interface VideoProvider {
  readonly name: 'local' | 'bunny';
  /** Creates the empty video record at the provider. */
  create(input: { title: string }): Promise<{ providerVideoId: string }>;
  /** Fresh upload instructions for a video that already exists (e.g. after a page reload). */
  uploadFor(providerVideoId: string, internalVideoId: string): VideoUpload;
  state(providerVideoId: string): Promise<ProviderVideoState>;
  playback(providerVideoId: string, internalVideoId: string): VideoPlayback;
  remove(providerVideoId: string): Promise<void>;
  /** The provider's own still picture of the video, if it makes one (Bunny does). */
  thumbnailUrl?(providerVideoId: string): string | null;
}

export const VIDEO_PROVIDER = Symbol('VIDEO_PROVIDER');
