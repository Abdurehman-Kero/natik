const EVENTS = [
  'pointermove',
  'pointerdown',
  'touchstart',
  'keydown',
  'scroll',
  'focusin',
] as const;

/**
 * Runs `callback` once, the first time the visitor does anything on the page (moves the pointer,
 * touches, scrolls or presses a key). Used to fetch code for things that can only be used after an
 * action (dialogs), so it never competes with the page loading, yet is usually there before the click.
 * Returns a function that cancels it.
 */
export function onFirstInteraction(callback: () => void): () => void {
  const run = () => {
    stop();
    callback();
  };
  const stop = () => {
    for (const name of EVENTS) window.removeEventListener(name, run, true);
  };
  for (const name of EVENTS) window.addEventListener(name, run, { capture: true, passive: true });
  return stop;
}
