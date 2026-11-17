/**
 * Remembers that the person changed something (saved, added, approved, uploaded…) since the last page
 * change. Pages fetched ahead of a click could then be a little out of date, so the next page opens at
 * once and its data is fetched again straight after (see components/ui/link.tsx and
 * components/brand/refresh-on-arrival.tsx). Background calls (read receipts, "where you stopped") pass
 * `quiet` to the API helper and don't count.
 */
let changed = false;
let refreshOnArrival = false;

export function markDataChanged(): void {
  changed = true;
}

/** Called when a link is clicked: if something changed, the next page refreshes its data on arrival. */
export function noteNavigation(): void {
  if (!changed) return;
  changed = false;
  refreshOnArrival = true;
}

/** True once, on the first page after a change. */
export function takeRefreshOnArrival(): boolean {
  const was = refreshOnArrival;
  refreshOnArrival = false;
  return was;
}
