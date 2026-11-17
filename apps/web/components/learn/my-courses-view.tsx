'use client';

import { BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MyCourseCard } from '@/components/learn/my-course-card';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MyCourseItem } from '@/lib/api/learn-types';

/** All of a student's courses in three groups: Active, Completed, and everything else. */
export function MyCoursesView({ items }: { items: MyCourseItem[] }) {
  const t = useTranslations('myCourses');
  const lapsed = (i: MyCourseItem) => !!i.endAt && new Date(i.endAt) < new Date();
  const groups = {
    active: items.filter((i) => i.status === 'ACTIVE' && !lapsed(i)),
    completed: items.filter((i) => i.status === 'COMPLETED'),
    other: items.filter(
      (i) => !['COMPLETED'].includes(i.status) && !(i.status === 'ACTIVE' && !lapsed(i)),
    ),
  };
  const empty = {
    active: t('emptyActive'),
    completed: t('emptyCompleted'),
    other: t('emptyOther'),
  };

  return (
    <Tabs
      defaultValue={
        groups.active.length > 0 || items.length === 0
          ? 'active'
          : groups.other.length > 0
            ? 'other'
            : 'completed'
      }
    >
      <TabsList aria-label={t('title')}>
        {(['active', 'completed', 'other'] as const).map((key) => (
          <TabsTrigger key={key} value={key}>
            {t(key)} ({groups[key].length})
          </TabsTrigger>
        ))}
      </TabsList>
      {(['active', 'completed', 'other'] as const).map((key) => (
        <TabsContent key={key} value={key}>
          {groups[key].length === 0 ? (
            <Card>
              <EmptyState
                icon={BookOpen}
                title={empty[key]}
                description={t('emptyText')}
                action={
                  <LinkButton href="/courses" size="lg">
                    {t('browse')}
                  </LinkButton>
                }
              />
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups[key].map((item) => (
                <li key={item.enrolmentId}>
                  <MyCourseCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
