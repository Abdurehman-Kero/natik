/** The player address for a YouTube or Vimeo link, or null when it is neither. */
export function toEmbedUrl(link: string | undefined | null): string | null {
  if (!link) return null;
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = /^\/(embed|shorts|live|v)\/([\w-]{11})/.exec(url.pathname);
      id = m?.[2] ?? null;
    }
  }
  if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = /(\d{6,})/.exec(url.pathname);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }
  return null;
}
