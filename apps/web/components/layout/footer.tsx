import { Mail, MapPin, Phone } from 'lucide-react';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { SocialLinks } from '@/components/ui/social-links';
import { Container } from '@/components/ui/layout';
import { LanguageList } from './language-switcher';
import { hasContactDetails } from '@/lib/site-config';
import { getLiveSiteConfig } from '@/lib/site-config-live';

function LinkList({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col items-center text-center sm:items-start sm:text-start">
      <h2 className="mb-2 font-sans text-sm font-semibold tracking-wider text-muted uppercase">
        {title}
      </h2>
      <ul className="flex flex-col items-center sm:items-start">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex min-h-11 items-center text-ink hover:text-primary hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Brand, links, contact details and policies on every public page (FR-WEB-002). */
export async function Footer() {
  const t = await getTranslations('footer');
  const tb = await getTranslations('brand');
  const site = await getLiveSiteConfig();
  const year = new Date().getFullYear();

  const explore = [
    { href: '/courses', label: t('courses') },
    { href: '/free-lessons', label: t('freeLessons') },
    { href: '/find-your-level', label: t('findLevel') },
    { href: '/teachers', label: t('teachers') },
    { href: '/about', label: t('about') },
    { href: '/news', label: t('news') },
    { href: '/faq', label: t('faq') },
    { href: '/help', label: t('help') },
  ];
  const helpful = [
    { href: '/register', label: t('register') },
    { href: '/sign-in', label: t('signIn') },
    { href: '/verify', label: t('verify') },
    { href: '/privacy', label: t('privacy') },
    { href: '/terms', label: t('terms') },
  ];

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <Container className="grid gap-8 py-10 text-center sm:grid-cols-2 sm:text-start lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:py-14">
        <div className="flex flex-col items-center gap-3 sm:col-span-2 sm:items-start lg:col-span-1">
          <Logo height={48} />
          <p className="max-w-xs text-muted">{t('tagline')}</p>
          <p className="text-sm font-medium text-primary">{tb('languages')}</p>
        </div>

        <LinkList title={t('linksHeading')} links={explore} />
        <LinkList title={t('legalHeading')} links={helpful} />

        <div className="flex flex-col items-center sm:items-start">
          <h2 className="mb-2 font-sans text-sm font-semibold tracking-wider text-muted uppercase">
            {t('contactHeading')}
          </h2>
          {hasContactDetails(site) ? (
            <ul className="flex flex-col items-center text-ink sm:items-start">
              {site.phone ? (
                <li>
                  <a
                    href={`tel:${site.phoneDial}`}
                    className="flex min-h-11 items-center justify-center gap-2 hover:text-primary hover:underline"
                  >
                    <Phone className="size-5 shrink-0 text-primary" aria-hidden />
                    {site.phone}
                  </a>
                </li>
              ) : null}
              {site.email ? (
                <li>
                  <a
                    href={`mailto:${site.email}`}
                    className="flex min-h-11 items-center justify-center gap-2 break-all hover:text-primary hover:underline"
                  >
                    <Mail className="size-5 shrink-0 text-primary" aria-hidden />
                    {site.email}
                  </a>
                </li>
              ) : null}
              {site.address ? (
                <li className="flex min-h-11 items-center justify-center gap-2">
                  <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
                  {site.address}
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mb-1 text-muted">{t('noDetails')}</p>
          )}
          <Link
            href="/contact"
            className="mt-1 inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
          >
            {t('contact')}
          </Link>
          {site.socials.length > 0 ? (
            <SocialLinks
              socials={site.socials}
              className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start"
            />
          ) : null}
        </div>
      </Container>
      <div className="border-t border-border">
        <Container className="flex flex-col items-center justify-between gap-3 py-5 text-center text-sm text-muted sm:flex-row sm:text-start">
          <span>{t('copyright', { year })}</span>
          <LanguageList className="sm:justify-end" />
        </Container>
      </div>
    </footer>
  );
}
