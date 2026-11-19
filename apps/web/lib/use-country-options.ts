'use client';

import { useSyncExternalStore } from 'react';
import { countryName, countryOptions } from '@/lib/countries';

const EMPTY: { value: string; label: string }[] = [];
const cache = new Map<string, { value: string; label: string }[]>();
const subscribe = () => () => undefined;

/**
 * The country list for a picker. The names come from the browser's own language data, which can
 * differ a little from the server's, so the list is only filled in once the page is in the browser
 * (the server and the first browser paint both show it empty, which keeps them identical).
 */
export function useCountryOptions(locale: string, selected?: string) {
  const list = useSyncExternalStore(
    subscribe,
    () => {
      let list = cache.get(locale);
      if (!list) {
        list = countryOptions(locale);
        cache.set(locale, list);
      }
      return list;
    },
    () => EMPTY,
  );
  // Until the names are there, the chosen country is the only option (shown as its code), so the
  // picker already holds the right value and does not mistake the empty list for "nothing chosen".
  if (list.length === 0 && selected) return [{ value: selected, label: selected }];
  return list;
}

const subscribeNothing = () => () => undefined;

/**
 * Turns a country code into its name in the page language, for text on pages that are drawn on the
 * server first. The server and the browser can know a country by slightly different names, so until
 * the page is in the browser the two-letter code is shown (identical on both sides), then the name.
 */
export function useCountryName(locale: string): (code: string | null | undefined) => string {
  const inBrowser = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  return (code) => {
    if (!code) return '';
    return inBrowser ? countryName(code, locale) : code;
  };
}
