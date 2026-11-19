import { Mail, MapPin, Phone } from 'lucide-react';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { AuthLink } from '@/components/auth/auth-dialog';
import { Logo } from '@/components/brand/logo';
import { ToolButton, TourButton } from '@/components/public/site-tool-links';
import { Container } from '@/components/ui/layout';
import { SocialLinks } from '@/components/ui/social-links';
import { hasContactDetails } from '@/lib/site-config';
import { getLiveSiteConfig } from '@/lib/site-config-live';
import { LanguageList } from './language-switcher';

type FooterLink =
  | { href: string; label: string; auth?: 'sign-in' | 'register' }
  | { tool: 'contact' | 'verify' | 'level' | 'tour'; label: string };

const linkClass =
  'flex min-h-11 items-center text-white/80 transition-colors hover:text-white hover:underline';

function LinkList({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div className="flex flex-col">
      <h2 className="mb-2 font-sans text-base font-semibold text-white">{title}</h2>
      <ul className="flex flex-col">
        {links.map((link) => (
          <li key={link.label}>
            {'tool' in link ? (
              link.tool === 'tour' ? (
                <TourButton plain className={linkClass}>
                  {link.label}
                </TourButton>
              ) : (
                <ToolButton tool={link.tool} plain className={linkClass}>
                  {link.label}
                </ToolButton>
              )
            ) : link.auth ? (
              <AuthLink mode={link.auth} className={linkClass}>
                {link.label}
              </AuthLink>
            ) : (
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The page footer, in Natik's navy: the brand and its languages, a sitemap, the legal pages, the
 * contact details, the social links and the language choice (FR-WEB-002). White text on navy, with
 * gold only for the small accents.
 */
export async function Footer() {
  const t = await getTranslations('footer');
  const tb = await getTranslations('brand');
  const ts = await getTranslations('site.footer');
  const site = await getLiveSiteConfig();
  const year = new Date().getFullYear();

  const sitemap: FooterLink[] = [
    { href: '/courses', label: t('courses') },
    { href: '/teachers', label: t('teachers') },
    { href: '/about', label: t('about') },
    { href: '/news', label: t('news') },
    { href: '/faq', label: t('faq') },
    { href: '/help', label: t('help') },
    { tool: 'level', label: ts('level') },
  ];
  const legal: FooterLink[] = [
    { href: '/privacy', label: t('privacy') },
    { href: '/terms', label: t('terms') },
    { tool: 'verify', label: t('verify') },
    { href: '/register', label: t('register'), auth: 'register' },
    { href: '/sign-in', label: t('signIn'), auth: 'sign-in' },
    { tool: 'tour', label: ts('tour') },
  ];

  const contactClass = 'flex min-h-11 items-center gap-3 text-white/80 hover:text-white';

  return (
    <footer className="on-dark relative mt-auto bg-[#0b2a42] text-white">
      <span
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-accent to-transparent"
        aria-hidden
      />
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.3fr] lg:py-14">
        <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
          <span className="inline-flex self-start rounded-xl bg-white px-3 py-2">
            <Logo height={40} />
          </span>
          <p className="max-w-xs text-white/80">{t('tagline')}</p>
          <p className="text-sm font-semibold text-accent">{tb('languages')}</p>
        </div>

        <LinkList title={ts('sitemap')} links={sitemap} />
        <LinkList title={ts('legal')} links={legal} />

        <div className="flex flex-col">
          <h2 className="mb-2 font-sans text-base font-semibold text-white">
            {t('contactHeading')}
          </h2>
          {hasContactDetails(site) ? (
            <ul className="flex flex-col">
              {site.address ? (
                <li className="flex min-h-11 items-center gap-3 text-white/80">
                  <MapPin className="size-5 shrink-0 text-accent" aria-hidden />
                  {site.address}
                </li>
              ) : null}
              {site.phone ? (
                <li>
                  <a href={`tel:${site.phoneDial}`} className={contactClass}>
                    <Phone className="size-5 shrink-0 text-accent" aria-hidden />
                    {site.phone}
                  </a>
                </li>
              ) : null}
              {site.email ? (
                <li>
                  <a href={`mailto:${site.email}`} className={`${contactClass} break-all`}>
                    <Mail className="size-5 shrink-0 text-accent" aria-hidden />
                    {site.email}
                  </a>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-white/80">{t('noDetails')}</p>
          )}
          <Link
            href="/contact"
            className="mt-1 inline-flex min-h-11 items-center font-semibold text-accent hover:underline"
          >
            {t('contact')}
          </Link>
          <ToolButton
            tool="contact"
            plain
            className="inline-flex min-h-11 items-center text-white/80 hover:text-white hover:underline"
          >
            {ts('message')}
          </ToolButton>
          {site.socials.length > 0 ? (
            <>
              <h2 className="mt-4 mb-2 font-sans text-base font-semibold text-white">
                {t('followHeading')}
              </h2>
              <SocialLinks socials={site.socials} tone="onDark" className="flex flex-wrap gap-2" />
            </>
          ) : null}
        </div>
      </Container>

      <div className="border-t border-white/15">
        <Container className="flex flex-col items-center justify-between gap-3 py-5 text-center text-sm text-white/75 sm:flex-row sm:text-start">
          <span>{t('copyright', { year })}</span>
          <LanguageList tone="onDark" className="sm:justify-end" />
        </Container>
      </div>
    </footer>
  );
}
