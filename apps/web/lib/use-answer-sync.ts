'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

export type Response = string | boolean;
export type SaveState = 'saved' | 'saving' | 'offline' | 'error';

const key = (attemptId: string) => `natik:quiz:${attemptId}`;

/** Answers that were not sent yet, kept on the device so a reload or a lost connection loses nothing. */
function readPending(attemptId: string): Record<string, Response> {
  try {
    const raw = window.localStorage.getItem(key(attemptId));
    return raw ? (JSON.parse(raw) as Record<string, Response>) : {};
  } catch {
    return {};
  }
}

function writePending(attemptId: string, pending: Record<string, Response>) {
  try {
    if (Object.keys(pending).length === 0) window.localStorage.removeItem(key(attemptId));
    else window.localStorage.setItem(key(attemptId), JSON.stringify(pending));
  } catch {
    // Private mode or full storage: the answers still go to the server, there is just no backup.
  }
}

export function clearPending(attemptId: string) {
  try {
    window.localStorage.removeItem(key(attemptId));
  } catch {
    // nothing to clear
  }
}

/**
 * Saves each answer as it is given (FR-QUIZ-006). Choices are sent at once, typed text a moment after
 * the last key. If the connection drops, answers wait on the device and are sent when it returns.
 * In preview nothing is sent or stored.
 */
export function useAnswerSync({
  attemptId,
  initial,
  preview,
  onClosed,
}: {
  attemptId: string;
  initial: Record<string, Response>;
  preview: boolean;
  /** The server says the attempt is closed (time ran out), so the page should go to the result. */
  onClosed: () => void;
}) {
  // Answers left over from before a reload, read once when the page opens.
  const [stored] = useState<Record<string, Response>>(() =>
    preview ? {} : readPending(attemptId),
  );
  const pending = useRef<Record<string, Response>>({});
  const [answers, setAnswers] = useState<Record<string, Response>>(() => ({
    ...initial,
    ...stored,
  }));
  const [state, setState] = useState<SaveState>(
    Object.keys(stored).length > 0 ? 'saving' : 'saved',
  );
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busy = useRef(false);
  const closed = useRef(onClosed);
  useEffect(() => {
    closed.current = onClosed;
  });

  const flush = useCallback(async () => {
    if (preview || busy.current) return;
    busy.current = true;
    try {
      while (Object.keys(pending.current).length > 0) {
        const [questionId, response] = Object.entries(pending.current)[0]!;
        setState('saving');
        try {
          await api(`/learn/attempts/${attemptId}/answers/${questionId}`, {
            method: 'PUT',
            quiet: true,
            json: { response },
          });
          // If the answer changed while it was being sent, the newer one stays queued.
          if (pending.current[questionId] === response) delete pending.current[questionId];
          writePending(attemptId, pending.current);
        } catch (error) {
          if (
            error instanceof ApiError &&
            (error.code === 'QUIZ_TIME_UP' || error.code === 'ATTEMPT_CLOSED')
          ) {
            closed.current();
          } else if (error instanceof ApiError && error.status === 0) {
            setState('offline');
          } else {
            setState('error');
          }
          return;
        }
      }
      setState('saved');
    } finally {
      busy.current = false;
    }
  }, [attemptId, preview]);

  const setAnswer = useCallback(
    (questionId: string, response: Response, delayMs = 0) => {
      setAnswers((current) => ({ ...current, [questionId]: response }));
      if (preview) return;
      pending.current[questionId] = response;
      writePending(attemptId, pending.current);
      setState((s) => (s === 'offline' ? s : 'saving'));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delayMs);
    },
    [attemptId, flush, preview],
  );

  useEffect(() => {
    if (preview) return;
    const retry = () => void flush();
    window.addEventListener('online', retry);
    // Anything left over from before a reload goes out now, and failures are tried again.
    pending.current = { ...stored, ...pending.current };
    retry();
    const id = setInterval(() => {
      if (Object.keys(pending.current).length > 0) retry();
    }, 8000);
    return () => {
      window.removeEventListener('online', retry);
      clearInterval(id);
      clearTimeout(timer.current);
    };
  }, [flush, preview, stored]);

  return {
    answers,
    setAnswer,
    state,
    flush,
    hasPending: () => Object.keys(pending.current).length > 0,
  };
}
