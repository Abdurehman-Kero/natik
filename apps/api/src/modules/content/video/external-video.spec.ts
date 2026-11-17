import { describe, expect, it } from 'vitest';
import { parseExternalVideo } from './external-video';

describe('parseExternalVideo', () => {
  it('reads the common YouTube links', () => {
    for (const link of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      expect(parseExternalVideo(link)).toMatchObject({ site: 'youtube', id: 'dQw4w9WgXcQ' });
    }
    expect(parseExternalVideo('https://youtu.be/dQw4w9WgXcQ')?.embedUrl).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1',
    );
  });

  it('reads Vimeo links', () => {
    expect(parseExternalVideo('https://vimeo.com/76979871')).toMatchObject({
      site: 'vimeo',
      id: '76979871',
      embedUrl: 'https://player.vimeo.com/video/76979871?dnt=1',
    });
    expect(parseExternalVideo('https://player.vimeo.com/video/76979871')?.id).toBe('76979871');
  });

  it('refuses other sites, look-alike hosts and bad ids', () => {
    for (const link of [
      'https://example.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=short',
      'https://www.youtube.com/',
      'https://vimeo.com/channels/staffpicks',
      'javascript:alert(1)',
      'not a link',
    ]) {
      expect(parseExternalVideo(link)).toBeNull();
    }
  });
});
