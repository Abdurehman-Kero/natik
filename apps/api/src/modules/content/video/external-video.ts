/**
 * Turns a YouTube or Vimeo link into the address of its embeddable player. Only these two sites are
 * accepted, and only their player pages are ever put in a frame, so a pasted link cannot show anything else.
 */
export interface ExternalVideo {
  site: 'youtube' | 'vimeo';
  id: string;
  embedUrl: string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{5,12}$/;

export function parseExternalVideo(link: string): ExternalVideo | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/^m\./, '');
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    const id = parts[0] ?? '';
    return YOUTUBE_ID.test(id) ? youtube(id) : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id =
      parts[0] === 'watch'
        ? (url.searchParams.get('v') ?? '')
        : ['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')
          ? (parts[1] ?? '')
          : '';
    return YOUTUBE_ID.test(id) ? youtube(id) : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = parts.find((part) => VIMEO_ID.test(part)) ?? '';
    return VIMEO_ID.test(id)
      ? { site: 'vimeo', id, embedUrl: `https://player.vimeo.com/video/${id}?dnt=1` }
      : null;
  }
  return null;
}

function youtube(id: string): ExternalVideo {
  return {
    site: 'youtube',
    id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
  };
}
