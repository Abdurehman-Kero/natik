import { describe, expect, it } from 'vitest';
import { detectFile } from './file-types';

const pad = (head: Buffer) => Buffer.concat([head, Buffer.alloc(32)]);

describe('file type detection', () => {
  it('recognises a PDF by its content', () => {
    expect(detectFile(pad(Buffer.from('%PDF-1.7\n')))?.kind).toBe('pdf');
  });

  it('refuses a program renamed to .pdf', () => {
    expect(detectFile(pad(Buffer.from('MZ\x90\x00\x03', 'latin1')))).toBeNull();
  });

  it('refuses text and scripts', () => {
    expect(detectFile(pad(Buffer.from('<script>alert(1)</script>')))).toBeNull();
    expect(
      detectFile(pad(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))),
    ).toBeNull();
  });

  it('recognises audio formats', () => {
    expect(detectFile(pad(Buffer.from('ID3\x04\x00', 'latin1')))?.mime).toBe('audio/mpeg');
    expect(detectFile(pad(Buffer.from('OggS\x00', 'latin1')))?.mime).toBe('audio/ogg');
    expect(detectFile(pad(Buffer.from('RIFF\x00\x00\x00\x00WAVE', 'latin1')))?.mime).toBe(
      'audio/wav',
    );
    const m4a = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypM4A ', 'latin1')]);
    expect(detectFile(pad(m4a))?.mime).toBe('audio/mp4');
  });

  it('tells video from audio in the MP4 family', () => {
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom', 'latin1')]);
    expect(detectFile(pad(mp4))?.kind).toBe('video');
  });

  it('recognises images', () => {
    expect(detectFile(pad(Buffer.from([0xff, 0xd8, 0xff, 0xe0])))?.kind).toBe('image');
    expect(detectFile(pad(Buffer.from('\x89PNG\r\n\x1a\n', 'latin1')))?.kind).toBe('image');
  });
});
