'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderError = 'denied' | 'unsupported' | null;

/** The first recording format this browser can make: WebM in Chrome and Firefox, MP4 in Safari. */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
}

/** Records a voice message from the microphone. `stop()` gives the file; `cancel()` throws it away. */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<RecorderError>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const release = useCallback(() => {
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    recorder.current = null;
    setRecording(false);
    setSeconds(0);
  }, []);

  useEffect(() => release, [release]);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('unsupported');
      return false;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('denied');
      return false;
    }
    const mimeType = pickMime();
    const rec = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    rec.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data);
    };
    rec.start();
    recorder.current = rec;
    startedAt.current = Date.now();
    setRecording(true);
    timer.current = window.setInterval(
      () => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)),
      250,
    );
    return true;
  }, []);

  const stop = useCallback((): Promise<{ file: File; durationSec: number } | null> => {
    const rec = recorder.current;
    if (!rec) return Promise.resolve(null);
    const durationSec = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    return new Promise((resolve) => {
      rec.onstop = () => {
        const type = rec.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunks.current, { type });
        release();
        resolve(
          blob.size > 0 ? { file: new File([blob], `voice.${ext}`, { type }), durationSec } : null,
        );
      };
      rec.stop();
    });
  }, [release]);

  const cancel = useCallback(() => {
    const rec = recorder.current;
    if (rec) rec.onstop = null;
    if (rec && rec.state !== 'inactive') rec.stop();
    release();
  }, [release]);

  return { recording, seconds, error, start, stop, cancel };
}
