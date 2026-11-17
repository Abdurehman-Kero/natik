/**
 * Finds out what a file really is from its first bytes, ignoring the file name and whatever the
 * browser claimed. A renamed program or a script saved as ".pdf" is refused (NFR-SEC-004).
 */

export type DetectedKind = 'pdf' | 'audio' | 'video' | 'image';

export interface DetectedFile {
  kind: DetectedKind;
  mime: string;
  ext: string;
}

const startsWith = (buf: Buffer, text: string, offset = 0) =>
  buf.length >= offset + text.length &&
  buf.toString('latin1', offset, offset + text.length) === text;

export function detectFile(buf: Buffer): DetectedFile | null {
  if (buf.length < 12) return null;

  if (startsWith(buf, '%PDF-')) return { kind: 'pdf', mime: 'application/pdf', ext: 'pdf' };

  // Images (re-encoded later; this only decides the kind)
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(buf, '\x89PNG\r\n\x1a\n')) return { kind: 'image', mime: 'image/png', ext: 'png' };
  if (startsWith(buf, 'RIFF') && startsWith(buf, 'WEBP', 8))
    return { kind: 'image', mime: 'image/webp', ext: 'webp' };

  // Audio
  if (startsWith(buf, 'RIFF') && startsWith(buf, 'WAVE', 8))
    return { kind: 'audio', mime: 'audio/wav', ext: 'wav' };
  if (startsWith(buf, 'OggS')) return { kind: 'audio', mime: 'audio/ogg', ext: 'ogg' };
  if (
    startsWith(buf, 'ID3') ||
    (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0 && (buf[1]! & 0x06) !== 0)
  )
    return { kind: 'audio', mime: 'audio/mpeg', ext: 'mp3' };

  // MP4 family: "ftyp" at byte 4. The brand tells audio (M4A) from video.
  if (startsWith(buf, 'ftyp', 4)) {
    const brand = buf.toString('latin1', 8, 12);
    if (brand === 'M4A ' || brand === 'M4B ')
      return { kind: 'audio', mime: 'audio/mp4', ext: 'm4a' };
    if (brand === 'qt  ') return { kind: 'video', mime: 'video/quicktime', ext: 'mov' };
    return { kind: 'video', mime: 'video/mp4', ext: 'mp4' };
  }
  // WebM / Matroska
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3)
    return { kind: 'video', mime: 'video/webm', ext: 'webm' };

  return null;
}
