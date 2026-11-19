import { BookOpenCheck, ClipboardCheck, Clock3 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ContactDetails } from '@/components/public/contact-details';
import { CtaBand } from '@/components/public/cta-band';
import { FeatureGrid } from '@/components/public/feature-grid';
import { PageHero } from '@/components/public/page-hero';
import { PublicSection } from '@/components/public/section';
import { Avatar } from '@/components/ui/avatar';
import { AuthButton } from '@/components/auth/auth-button';
import { LinkButton } from '@/components/ui/button';
import { publicFetch } from '@/lib/api/public';
import { getSiteContent } from '@/lib/site-config-live';

export async function generateMetadata() {
  const t = await getTranslations('about');
  return { title: t('title'), description: t('subtitle') };
}

interface Teacher {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
}

export default async function AboutPage() {
  const t = await getTranslations('about');
  const th = await getTranslations('home');
  const content = await getSiteContent();
  const { items: teachers } = await publicFetch<{ items: Teacher[] }>('/public/teachers', {
    items: [],
  });
  const approach = (t.raw('approach') as { title: string; text: string }[]).map((item, i) => ({
    ...item,
    icon: [BookOpenCheck, ClipboardCheck, Clock3][i] ?? BookOpenCheck,
  }));

  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} />

      <PublicSection size="reading" eyebrow={t('eyebrowStory')} title={t('missionTitle')}>
        <p className="text-center text-xl leading-relaxed text-ink/90 md:text-2xl">
          {content.about?.mission || t('missionText')}
        </p>
        <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-accent/40 bg-accent-soft p-6 text-center">
          <h3 className="mb-1 font-sans text-lg font-semibold text-primary">{t('nameTitle')}</h3>
          <p className="text-ink/80">{t('nameText')}</p>
        </div>
      </PublicSection>

      <PublicSection tone="white" eyebrow={t('eyebrowApproach')} title={t('approachTitle')}>
        <FeatureGrid items={approach} columns={3} />
      </PublicSection>

      {teachers.length > 0 ? (
        <PublicSection eyebrow={t('eyebrowTeam')} title={t('teachersTitle')}>
          <ul className="flex flex-wrap justify-center gap-5">
            {teachers.map((teacher) => (
              <li
                key={teacher.id}
                className="flex w-full flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-7 text-center shadow-card sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.85rem)]"
              >
                <Avatar name={teacher.name} src={teacher.photoUrl} size="lg" />
                <h3 className="font-sans text-lg font-semibold">{teacher.name}</h3>
                {teacher.bio ? <p className="text-muted">{teacher.bio}</p> : null}
              </li>
            ))}
          </ul>
        </PublicSection>
      ) : null}

      <PublicSection
        tone={teachers.length > 0 ? 'white' : 'canvas'}
        eyebrow={t('eyebrowVisit')}
        title={t('visitTitle')}
        intro={t('visitText')}
      >
        <div className="mx-auto max-w-xl">
          <ContactDetails />
        </div>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton href="/contact" size="lg">
            {t('contactCta')}
          </LinkButton>
          <LinkButton href="/courses" variant="secondary" size="lg">
            {t('coursesCta')}
          </LinkButton>
        </div>
      </PublicSection>

      <CtaBand title={th('ctaTitle')} text={th('ctaText')}>
        <AuthButton mode="register" variant="onDark" size="lg">
          {th('ctaRegister')}
        </AuthButton>
      </CtaBand>
    </>
  );
}
