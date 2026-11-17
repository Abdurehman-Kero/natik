import 'server-only';
import { EMPTY_SITE_CONTENT, type PublicSiteContent, publicFetch } from './api/public';
import { getSiteConfig, type SiteConfig } from './site-config';

/** The text blocks edited in Admin › Website (cached for a few seconds, refreshed when an admin saves). */
export function getSiteContent(): Promise<PublicSiteContent> {
  return publicFetch<PublicSiteContent>('/public/site', EMPTY_SITE_CONTENT);
}

/**
 * Contact details: what an admin typed in Admin › Website wins; the SITE_* settings are the fallback.
 * Anything still empty is simply not shown.
 */
export async function getLiveSiteConfig(): Promise<SiteConfig> {
  const base = getSiteConfig();
  const { contact } = await getSiteContent();
  if (!contact) return base;

  const phone = contact.phone ?? base.phone;
  const socialValues: [string, string | null][] = [
    [
      'Telegram channel',
      contact.telegram ?? base.socials.find((s) => s.name === 'Telegram')?.href ?? null,
    ],
    ['Telegram chat', contact.telegramContact ?? null],
    ['Facebook', contact.facebook ?? base.socials.find((s) => s.name === 'Facebook')?.href ?? null],
    [
      'Instagram',
      contact.instagram ?? base.socials.find((s) => s.name === 'Instagram')?.href ?? null,
    ],
    ['TikTok', contact.tiktok ?? base.socials.find((s) => s.name === 'TikTok')?.href ?? null],
    ['YouTube', contact.youtube ?? base.socials.find((s) => s.name === 'YouTube')?.href ?? null],
  ];
  return {
    phone,
    phoneDial: contact.phone ? contact.phone.replace(/[^\d+]/g, '') : base.phoneDial,
    email: contact.email ?? base.email,
    address: contact.address ?? base.address,
    hours: contact.hours ?? base.hours,
    mapUrl: contact.mapUrl ?? base.mapUrl,
    socials: socialValues.flatMap(([name, href]) => (href ? [{ name, href }] : [])),
  };
}
