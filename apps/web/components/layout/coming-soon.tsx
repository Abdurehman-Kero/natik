import { Hourglass } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Container, PageHeader } from '@/components/ui/layout';

export type PageKey =
  | 'myCourses'
  | 'certificates'
  | 'profile'
  | 'announcements'
  | 'teachCourses'
  | 'marking'
  | 'users'
  | 'enrolments'
  | 'adminCourses'
  | 'payments'
  | 'messages'
  | 'website'
  | 'reports'
  | 'activity'
  | 'settings';

export async function pageTitle(key: PageKey): Promise<string> {
  const t = await getTranslations('pages');
  return t(key);
}

/**
 * A real, working page for a feature that is built in a later milestone: correct layout,
 * title, and a clear way back. Replaced one by one as each milestone ships.
 */
export async function ComingSoon({
  pageKey,
  area,
}: {
  pageKey: PageKey;
  area: 'public' | 'student' | 'teacher' | 'admin';
}) {
  const t = await getTranslations('pages');
  const home = { public: '/', student: '/dashboard', teacher: '/teach', admin: '/admin' }[area];
  const action = (
    <LinkButton href={home} variant="secondary">
      {area === 'public' ? t('backHome') : t('backDashboard')}
    </LinkButton>
  );

  if (area === 'public') {
    return (
      <Container className="py-10 md:py-16">
        <h1 className="mb-6 text-[1.625rem] leading-tight font-bold md:text-4xl">{t(pageKey)}</h1>
        <Card>
          <EmptyState icon={Hourglass} title={t('soonText')} action={action} />
        </Card>
      </Container>
    );
  }
  return (
    <>
      <PageHeader title={t(pageKey)} />
      <Card>
        <EmptyState icon={Hourglass} title={t('soonText')} action={action} />
      </Card>
    </>
  );
}
