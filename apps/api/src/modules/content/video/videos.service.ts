import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { bytesToMb, type VideoStatus } from '@natik/shared';
import { AccessPolicy, type Actor } from '../../../common/access/access-policy';
import { AppException } from '../../../common/errors/app.exception';
import { createId } from '../../../common/security/ids';
import { StorageService } from '../../../common/storage/storage.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { detectFile } from '../file-types';
import { MediaAccessService } from '../media-access.service';
import { parseExternalVideo } from './external-video';
import { localVideoKey } from './local.provider';
import {
  VIDEO_PROVIDER,
  type VideoPlayback,
  type VideoProvider,
  type VideoUpload,
} from './video-provider';
import { videoPosterUrl } from './video-poster';
import { ImageService } from '../../../common/storage/image.service';

/** Videos sent to our own storage (development provider) are capped so they fit in memory. */
export const LOCAL_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

export interface VideoView {
  id: string;
  title: string;
  status: VideoStatus;
  durationSec: number | null;
  external: boolean;
  hasCaptions: boolean;
  posterUrl: string | null;
}

const MAX_CAPTION_BYTES = 512 * 1024;

@Injectable()
export class VideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: AccessPolicy,
    private readonly media: MediaAccessService,
    private readonly images: ImageService,
    @Inject(VIDEO_PROVIDER) private readonly provider: VideoProvider,
  ) {}

  private view(video: {
    id: string;
    title: string;
    status: VideoStatus;
    durationSec: number | null;
    provider: string;
    providerVideoId: string;
    externalUrl: string | null;
    captionFileId: string | null;
    posterFileId: string | null;
  }): VideoView {
    return {
      id: video.id,
      title: video.title,
      status: video.status,
      durationSec: video.durationSec,
      external: video.provider === 'external',
      hasCaptions: video.captionFileId !== null,
      posterUrl: videoPosterUrl(video, this.provider),
    };
  }

  /**
   * The still picture shown before the video plays. The lesson editor sends a frame of the video
   * (captured in the teacher's browser when they upload it), or the teacher picks a picture.
   */
  async setPoster(
    actor: Actor,
    id: string,
    file: { buffer: Buffer; originalname: string },
  ): Promise<VideoView> {
    const video = await this.load(id);
    await this.assertCanSeeStatus(actor, video);
    const detected = detectFile(file.buffer);
    if (detected?.kind !== 'image') {
      throw new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    const body = await this.images.toVideoPoster(file.buffer);
    const key = `videos/posters/${video.id}-${createId()}.webp`;
    await this.storage.put(key, body, 'image/webp');
    const asset = await this.prisma.fileAsset.create({
      data: {
        purpose: 'VIDEO_POSTER',
        storageKey: key,
        mime: 'image/webp',
        sizeBytes: body.length,
        originalName: `${video.title.slice(0, 100)}.webp`,
        uploadedById: actor.id,
      },
    });
    const old = video.posterFileId;
    const updated = await this.prisma.videoAsset.update({
      where: { id },
      data: { posterFileId: asset.id },
    });
    if (old) await this.dropFile(old);
    return this.view(updated);
  }

  /** A video that stays on YouTube or Vimeo: nothing is uploaded, the page just shows their player. */
  async createExternal(actor: Actor, input: { title: string; url: string }): Promise<VideoView> {
    const parsed = parseExternalVideo(input.url);
    if (!parsed) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, {
        fields: { url: ['Use a YouTube or Vimeo link.'] },
      });
    }
    const video = await this.prisma.videoAsset.create({
      data: {
        provider: 'external',
        providerVideoId: `${parsed.site}:${parsed.id}:${createId()}`,
        title: input.title,
        status: 'READY',
        externalUrl: parsed.embedUrl,
        createdById: actor.id,
      },
    });
    return this.view(video);
  }

  /** Captions for a video we host: a WebVTT (.vtt) file, shown by the player. */
  async setCaptions(
    actor: Actor,
    id: string,
    file: { buffer: Buffer; originalname: string },
  ): Promise<VideoView> {
    const video = await this.load(id);
    await this.assertCanSeeStatus(actor, video);
    if (video.provider === 'external') {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, {
        message: 'Captions for YouTube and Vimeo videos are added on their site.',
      });
    }
    if (file.buffer.length > MAX_CAPTION_BYTES) {
      throw new AppException('FILE_TOO_LARGE', HttpStatus.PAYLOAD_TOO_LARGE);
    }
    const text = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    if (!text.startsWith('WEBVTT')) {
      throw new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.UNSUPPORTED_MEDIA_TYPE, {
        message: 'Use a WebVTT captions file (.vtt). It starts with the word WEBVTT.',
      });
    }
    const key = `captions/${video.id}-${createId()}.vtt`;
    await this.storage.put(key, Buffer.from(text, 'utf8'), 'text/vtt');
    const asset = await this.prisma.fileAsset.create({
      data: {
        purpose: 'CAPTION',
        storageKey: key,
        mime: 'text/vtt',
        sizeBytes: Buffer.byteLength(text),
        originalName: file.originalname.slice(0, 120),
        uploadedById: actor.id,
      },
    });
    const old = video.captionFileId;
    const updated = await this.prisma.videoAsset.update({
      where: { id },
      data: { captionFileId: asset.id },
    });
    if (old) await this.dropFile(old);
    return this.view(updated);
  }

  async removeCaptions(actor: Actor, id: string): Promise<VideoView> {
    const video = await this.load(id);
    await this.assertCanSeeStatus(actor, video);
    const old = video.captionFileId;
    const updated = await this.prisma.videoAsset.update({
      where: { id },
      data: { captionFileId: null },
    });
    if (old) await this.dropFile(old);
    return this.view(updated);
  }

  private async dropFile(fileId: string) {
    const file = await this.prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!file) return;
    await this.prisma.fileAsset.delete({ where: { id: fileId } });
    await this.storage.remove(file.storageKey).catch(() => undefined);
  }

  /** The captions text, after the same access check as the video itself. */
  async openCaptions(actor: Actor | undefined, id: string): Promise<Buffer> {
    const video = await this.load(id);
    await this.media.assertCanOpenVideo(actor, video);
    if (!video.captionFileId) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const file = await this.prisma.fileAsset.findUniqueOrThrow({
      where: { id: video.captionFileId },
    });
    return (await this.storage.read(file.storageKey)).body;
  }

  /** Teachers and admins create a video, then upload the file straight to the provider. */
  async create(
    actor: Actor,
    input: { title: string },
  ): Promise<VideoView & { upload: VideoUpload }> {
    const { providerVideoId } = await this.provider.create({ title: input.title });
    const video = await this.prisma.videoAsset.create({
      data: {
        provider: this.provider.name,
        providerVideoId,
        title: input.title,
        status: 'UPLOADING',
        createdById: actor.id,
      },
    });
    return { ...this.view(video), upload: this.provider.uploadFor(providerVideoId, video.id) };
  }

  private async load(id: string) {
    const video = await this.prisma.videoAsset.findUnique({ where: { id } });
    if (!video) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return video;
  }

  /** Who may see a video's progress: its creator, admins, and teachers of a course that uses it. */
  private async assertCanSeeStatus(
    actor: Actor,
    video: { id: string; createdById: string | null },
  ) {
    if (actor.role === 'ADMIN' || video.createdById === actor.id) return;
    const lessonIds = await this.media.lessonsUsingVideo(video.id);
    for (const lessonId of lessonIds) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { courseId: true },
      });
      if (lesson && (await this.access.canEditCourseContent(actor, lesson.courseId))) return;
    }
    throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
  }

  /** Current status. While the provider is still working, it is asked and the answer is saved. */
  async status(actor: Actor, id: string): Promise<VideoView & { upload?: VideoUpload }> {
    const video = await this.load(id);
    await this.assertCanSeeStatus(actor, video);
    if (video.status === 'READY' || video.status === 'FAILED') return this.view(video);
    try {
      const state = await this.provider.state(video.providerVideoId);
      if (state.status !== video.status || state.durationSec !== video.durationSec) {
        const updated = await this.prisma.videoAsset.update({
          where: { id },
          data: { status: state.status, durationSec: state.durationSec },
        });
        return this.view(updated);
      }
    } catch {
      // The provider is briefly unreachable: keep the last known status and try again on the next poll.
    }
    // Still uploading: hand back fresh upload instructions so a reload can continue.
    return {
      ...this.view(video),
      upload:
        video.status === 'UPLOADING'
          ? this.provider.uploadFor(video.providerVideoId, video.id)
          : undefined,
    };
  }

  /** Development provider only: receives the whole file in one request. */
  async receiveLocalUpload(actor: Actor, id: string, buffer: Buffer): Promise<VideoView> {
    const video = await this.load(id);
    if (this.provider.name !== 'local' || video.provider !== 'local') {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (video.createdById !== actor.id && actor.role !== 'ADMIN') {
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    if (buffer.length > LOCAL_VIDEO_MAX_BYTES) {
      throw new AppException('FILE_TOO_LARGE', HttpStatus.PAYLOAD_TOO_LARGE, {
        message: `This file is ${bytesToMb(buffer.length)} MB. The maximum is ${bytesToMb(LOCAL_VIDEO_MAX_BYTES)} MB.`,
        params: { size: bytesToMb(buffer.length), max: bytesToMb(LOCAL_VIDEO_MAX_BYTES) },
      });
    }
    const detected = detectFile(buffer);
    if (detected?.kind !== 'video') {
      throw new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    await this.storage.put(localVideoKey(video.providerVideoId), buffer, detected.mime);
    const updated = await this.prisma.videoAsset.update({
      where: { id },
      data: { status: 'READY' },
    });
    return this.view(updated);
  }

  /** The signed player link. Always checks access first (FR-LEARN-007, AT-07). */
  async playback(actor: Actor | undefined, id: string): Promise<VideoPlayback> {
    const video = await this.load(id);
    await this.media.assertCanOpenVideo(actor, video);
    if (video.status !== 'READY') throw new AppException('MEDIA_UNAVAILABLE', HttpStatus.CONFLICT);
    if (video.provider === 'external' && video.externalUrl) {
      return { kind: 'iframe', url: video.externalUrl, expiresAt: Date.now() + 6 * 3600_000 };
    }
    const playback = this.provider.playback(video.providerVideoId, video.id);
    return playback.kind === 'file' && video.captionFileId
      ? { ...playback, captionsUrl: `/api/v1/videos/${video.id}/captions` }
      : playback;
  }

  /** Development provider only: the video bytes, after the same access check. */
  async openLocalStream(actor: Actor | undefined, id: string, range?: string) {
    const video = await this.load(id);
    if (video.provider !== 'local') throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    await this.media.assertCanOpenVideo(actor, video);
    if (video.status !== 'READY') throw new AppException('MEDIA_UNAVAILABLE', HttpStatus.CONFLICT);
    return this.storage.stream(localVideoKey(video.providerVideoId), range);
  }
}
