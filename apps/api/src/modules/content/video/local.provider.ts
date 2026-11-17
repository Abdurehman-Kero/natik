import { randomUUID } from 'node:crypto';
import { StorageService } from '../../../common/storage/storage.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ProviderVideoState,
  VideoPlayback,
  VideoProvider,
  VideoUpload,
} from './video-provider';

/** Where the local provider keeps a video in storage. */
export const localVideoKey = (providerVideoId: string) => `videos/${providerVideoId}`;

/**
 * Development stand-in for Bunny Stream: the video file is kept in our own storage and played
 * through the API (which checks access on every request). It does no transcoding and no adaptive
 * quality, so it is blocked in production (see config/env.ts).
 */
export class LocalVideoProvider implements VideoProvider {
  readonly name = 'local' as const;

  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  async create() {
    return { providerVideoId: randomUUID() };
  }

  uploadFor(_providerVideoId: string, internalVideoId: string): VideoUpload {
    return { kind: 'direct', url: `/api/v1/videos/${internalVideoId}/upload` };
  }

  async state(providerVideoId: string): Promise<ProviderVideoState> {
    const video = await this.prisma.videoAsset.findFirst({
      where: { provider: 'local', providerVideoId },
      select: { status: true, durationSec: true },
    });
    return { status: video?.status ?? 'FAILED', durationSec: video?.durationSec ?? null };
  }

  playback(_providerVideoId: string, internalVideoId: string): VideoPlayback {
    return { kind: 'file', url: `/api/v1/videos/${internalVideoId}/stream` };
  }

  async remove(providerVideoId: string): Promise<void> {
    await this.storage.remove(localVideoKey(providerVideoId)).catch(() => undefined);
  }
}
