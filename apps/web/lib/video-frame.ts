/**
 * Takes a still picture from a video in the browser: no server tool needed, and the teacher sees it
 * at once. Picks a moment a little way in (the very first frame is often black), and gives back a JPEG,
 * or null when the browser can't read this video.
 */
export function captureVideoFrame(src: string, maxWidth = 1280): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let finished = false;
    const done = (blob: Blob | null) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(blob);
    };
    const timer = window.setTimeout(() => done(null), 20_000);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadedmetadata = () => {
      const length = Number.isFinite(video.duration) ? video.duration : 0;
      video.currentTime = length > 0 ? Math.min(2, length * 0.1) : 0.1;
    };
    video.onseeked = () => {
      if (!video.videoWidth || !video.videoHeight) return done(null);
      const scale = Math.min(1, maxWidth / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) return done(null);
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => done(blob), 'image/jpeg', 0.85);
      } catch {
        done(null);
      }
    };
    video.onerror = () => done(null);
    video.src = src;
  });
}

/** Captures a frame and saves it as the video's still picture. Returns the new picture address. */
export async function savePosterFrom(
  videoId: string,
  src: string,
  send: (form: FormData) => Promise<{ posterUrl: string | null }>,
): Promise<string | null> {
  const blob = await captureVideoFrame(src);
  if (!blob) return null;
  const form = new FormData();
  form.set('file', blob, 'frame.jpg');
  return (await send(form)).posterUrl;
}
