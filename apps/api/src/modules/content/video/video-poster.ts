import { parseExternalVideo } from './external-video';
import type { VideoProvider } from './video-provider';

/**
 * The still picture shown before a video plays: the picture saved for it (a frame captured when the
 * teacher uploaded it, or one they chose), else YouTube's or Bunny's own thumbnail. Null means the
 * player shows the Natik colours instead.
 */
export function videoPosterUrl(
  video: {
    provider: string;
    providerVideoId: string;
    externalUrl: string | null;
    posterFileId: string | null;
  },
  provider: Pick<VideoProvider, 'name' | 'thumbnailUrl'>,
): string | null {
  if (video.posterFileId) return `/api/v1/files/${video.posterFileId}`;
  if (video.provider === 'external' && video.externalUrl) {
    const external = parseExternalVideo(video.externalUrl);
    return external?.site === 'youtube'
      ? `https://i.ytimg.com/vi/${external.id}/hqdefault.jpg`
      : null;
  }
  if (video.provider === provider.name && provider.thumbnailUrl) {
    return provider.thumbnailUrl(video.providerVideoId);
  }
  return null;
}
