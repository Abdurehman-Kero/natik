'use client';

import { useTranslations } from 'next-intl';
import { LinkButton } from '@/components/ui/button';
import { useSession } from '@/lib/use-session';

/** "Enjoyed it? Create a free account": shown under a free lesson (signed-in people go to the course). */
export function FreeLessonCta({ slug }: { slug: string }) {
  const t = useTranslations('freeLessons');
  const { user, ready } = useSession();
  const next = encodeURIComponent(`/courses/${slug}`);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {ready && user ? (
        <LinkButton href={`/courses/${slug}`}>{t('seeCourse')}</LinkButton>
      ) : (
        <>
          <LinkButton href={`/register?next=${next}`}>{t('register')}</LinkButton>
          <LinkButton href={`/sign-in?next=${next}`} variant="secondary">
            {t('signIn')}
          </LinkButton>
        </>
      )}
    </div>
  );
}
