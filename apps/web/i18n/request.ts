import { TIME_ZONE } from '@natik/shared';
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import en from '../messages/en.json';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './config';

type Messages = typeof en;

/**
 * Lay a translation over the English text. Anything not translated yet (an admin menu item, a new
 * sentence) shows in English instead of an empty gap or a missing-text error. Lists are merged item by
 * item so a translated list keeps the English parts it does not repeat, such as each link address.
 */
function overlay<T>(base: T, over: unknown): T {
  if (Array.isArray(base)) {
    const items = Array.isArray(over) ? over : [];
    return base.map((item, index) => overlay(item, items[index])) as T;
  }
  if (base && typeof base === 'object') {
    const source = over && typeof over === 'object' ? (over as Record<string, unknown>) : {};
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(base)) {
      out[key] = overlay((base as Record<string, unknown>)[key], source[key]);
    }
    return out as T;
  }
  return (typeof over === typeof base && over !== '' ? over : base) as T;
}

const cache = new Map<Locale, Messages>();

async function messagesFor(locale: Locale): Promise<Messages> {
  if (locale === 'en') return en;
  const cached = cache.get(locale);
  if (cached) return cached;
  const translated = (await import(`../messages/${locale}.json`)).default as unknown;
  const merged = overlay(en, translated);
  cache.set(locale, merged);
  return merged;
}

/** The language comes from the visitor's choice (a cookie); English until they pick another. */
export default getRequestConfig(async () => {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(stored) ? stored : DEFAULT_LOCALE;
  return { locale, timeZone: TIME_ZONE, messages: await messagesFor(locale) };
});
