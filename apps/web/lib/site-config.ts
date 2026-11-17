/**
 * Natik's public contact details, read from the environment (SITE_* settings) so the same build
 * works for staging and production. Anything that isn't filled in is simply not shown: the site
 * never displays made-up phone numbers or addresses. Admin editing arrives with M4's website editor.
 */
const read = (key: string): string | null => process.env[key]?.trim() || null;

export interface SiteConfig {
  /** Display text, e.g. "+251 11 123 4567". */
  phone: string | null;
  /** Dial link, e.g. "+251111234567". Derived from `phone` when not set. */
  phoneDial: string | null;
  email: string | null;
  address: string | null;
  hours: string | null;
  /** Link to the location on a map (Google Maps, OpenStreetMap…). */
  mapUrl: string | null;
  socials: { name: string; href: string }[];
}

export function getSiteConfig(): SiteConfig {
  const phone = read('SITE_PHONE');
  const socials = (
    [
      ['Telegram', read('SITE_TELEGRAM')],
      ['Facebook', read('SITE_FACEBOOK')],
      ['Instagram', read('SITE_INSTAGRAM')],
      ['TikTok', read('SITE_TIKTOK')],
      ['YouTube', read('SITE_YOUTUBE')],
    ] as const
  ).flatMap(([name, href]) => (href ? [{ name, href }] : []));

  return {
    phone,
    phoneDial: read('SITE_PHONE_DIAL') ?? (phone ? phone.replace(/[^\d+]/g, '') : null),
    email: read('SITE_EMAIL'),
    address: read('SITE_ADDRESS'),
    hours: read('SITE_HOURS'),
    mapUrl: read('SITE_MAP_URL'),
    socials,
  };
}

/** True when at least one way to reach the centre is configured. */
export function hasContactDetails(config: SiteConfig): boolean {
  return Boolean(config.phone || config.email || config.address);
}

/** The public address of the site, for sitemap, metadata and structured data. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

/** APP_ENV decides environment-specific behaviour (styleguide, indexing). */
export function appEnv(): 'local' | 'staging' | 'production' {
  const env = process.env.APP_ENV;
  return env === 'production' || env === 'staging' ? env : 'local';
}

/** Link that opens a WhatsApp chat with the centre's phone number, or null when there is none. */
export function whatsappUrl(site: Pick<SiteConfig, 'phoneDial'>): string | null {
  const digits = site.phoneDial?.replace(/\D/g, '') ?? '';
  return digits.length >= 9 ? `https://wa.me/${digits}` : null;
}
