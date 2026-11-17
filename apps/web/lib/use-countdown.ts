'use client';

import { useCallback, useEffect, useState } from 'react';

/** Counts down once per second, e.g. the 60 seconds before a new SMS code can be requested. */
export function useCountdown(initial = 0): [seconds: number, restart: (from?: number) => void] {
  const [seconds, setSeconds] = useState(initial);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const restart = useCallback((from = 60) => setSeconds(from), []);
  return [seconds, restart];
}

/** 65 → "1:05" */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, '0')}`;
}
