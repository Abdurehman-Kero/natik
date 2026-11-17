/** The languages the website's menus, buttons and public pages can be shown in. */
export const LOCALES = ['en', 'am', 'om', 'so'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Each language written in itself, so people can find theirs whatever the page is showing. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  am: 'አማርኛ',
  om: 'Afaan Oromoo',
  so: 'Soomaali',
};

/** Short badge shown on the switcher button. */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: 'EN',
  am: 'አማ',
  om: 'OM',
  so: 'SO',
};

export const OPEN_GRAPH_LOCALE: Record<Locale, string> = {
  en: 'en_GB',
  am: 'am_ET',
  om: 'om_ET',
  so: 'so_SO',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
