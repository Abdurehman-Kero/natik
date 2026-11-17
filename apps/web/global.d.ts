import type messages from './messages/en.json';

// Type-safe translation keys: a missing or misspelled key fails `pnpm typecheck`.
declare module 'next-intl' {
  interface AppConfig {
    Locale: import('./i18n/config').Locale;
    Messages: typeof messages;
  }
}
