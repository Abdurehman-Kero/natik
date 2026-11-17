import { Clock, ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { SocialLinks } from '@/components/ui/social-links';
import { Card } from '@/components/ui/card';
import { hasContactDetails } from '@/lib/site-config';
import { getLiveSiteConfig } from '@/lib/site-config-live';

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
        aria-hidden
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm text-muted">{label}</span>
        <span className="font-medium break-words text-ink">{children}</span>
      </div>
    </li>
  );
}

/** Phone, email, address, hours and social links. Shows only what Natik has filled in. */
export async function ContactDetails() {
  const t = await getTranslations('contact');
  const site = await getLiveSiteConfig();
  if (!hasContactDetails(site) && site.socials.length === 0) return null;

  return (
    <Card className="flex flex-col gap-5 rounded-2xl p-6 md:p-7">
      <h2 className="text-xl font-semibold">{t('detailsTitle')}</h2>
      <ul className="flex flex-col gap-4">
        {site.phone ? (
          <Row icon={<Phone className="size-5" />} label={t('phone')}>
            <a href={`tel:${site.phoneDial}`} className="hover:underline">
              {site.phone}
            </a>
          </Row>
        ) : null}
        {site.email ? (
          <Row icon={<Mail className="size-5" />} label={t('email')}>
            <a href={`mailto:${site.email}`} className="hover:underline">
              {site.email}
            </a>
          </Row>
        ) : null}
        {site.address ? (
          <Row icon={<MapPin className="size-5" />} label={t('address')}>
            {site.address}
          </Row>
        ) : null}
        {site.hours ? (
          <Row icon={<Clock className="size-5" />} label={t('hours')}>
            {site.hours}
          </Row>
        ) : null}
      </ul>
      {site.mapUrl ? (
        <a
          href={site.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-primary hover:underline"
        >
          <ExternalLink className="size-4" aria-hidden />
          {t('openMap')}
        </a>
      ) : null}
      {site.socials.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <h3 className="font-sans text-sm font-semibold tracking-wider text-muted uppercase">
            {t('followTitle')}
          </h3>
          <SocialLinks socials={site.socials} />
        </div>
      ) : null}
    </Card>
  );
}
