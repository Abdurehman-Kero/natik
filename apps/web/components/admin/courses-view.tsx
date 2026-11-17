'use client';

import { formatPrice } from '@natik/shared';
import { BookOpen, Plus, Users } from 'lucide-react';
import Image from 'next/image';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button, LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import type { AdminCourseListItem, Paged } from '@/lib/api/types';
import { contentLang } from '@/lib/script';

export interface CoursesQuery {
  q: string;
  status: string;
  page: number;
}

function hrefFor(query: CoursesQuery, overrides: Partial<CoursesQuery>): string {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set('q', merged.q);
  if (merged.status) params.set('status', merged.status);
  if (merged.page > 1) params.set('page', String(merged.page));
  const text = params.toString();
  return text ? `/admin/courses?${text}` : '/admin/courses';
}

/** Admin course list: a card per course with picture, language, status and students (FR-ADMIN-003). */
export function CoursesView({
  data,
  query,
}: {
  data: Paged<AdminCourseListItem>;
  query: CoursesQuery;
}) {
  const t = useTranslations('adminCourses');
  const ts = useTranslations('status.content');
  const router = useRouter();
  const [search, setSearch] = useState(query.q);
  const filtered = Boolean(query.q || query.status);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const go = (overrides: Partial<CoursesQuery>) =>
    router.push(hrefFor(query, { page: 1, ...overrides }));

  return (
    <>
      <PageHeader
        title={t('title')}
        action={
          <LinkButton href="/admin/courses/new">
            <Plus aria-hidden /> {t('newCourse')}
          </LinkButton>
        }
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end">
        <form
          className="min-w-0 flex-1"
          role="search"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            go({ q: search.trim() });
          }}
        >
          <SearchField
            label={t('search')}
            placeholder={t('search')}
            value={search}
            onValueChange={(value) => {
              setSearch(value);
              if (value === '' && query.q) go({ q: '' });
            }}
          />
        </form>
        <div className="md:w-56">
          <Select
            aria-label={t('status')}
            value={query.status}
            onChange={(e) => go({ status: e.target.value })}
            options={[
              { value: '', label: t('allStatuses') },
              { value: 'DRAFT', label: ts('DRAFT') },
              { value: 'PUBLISHED', label: ts('PUBLISHED') },
              { value: 'HIDDEN', label: ts('HIDDEN') },
            ]}
          />
        </div>
      </div>

      {data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={filtered ? t('noMatches') : t('empty')}
            description={filtered ? undefined : t('emptyText')}
            action={
              filtered ? (
                <Button variant="secondary" onClick={() => router.push('/admin/courses')}>
                  {t('clear')}
                </Button>
              ) : (
                <LinkButton href="/admin/courses/new">
                  <Plus aria-hidden /> {t('newCourse')}
                </LinkButton>
              )
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((course) => (
            <li key={course.id}>
              <Link
                href={`/admin/courses/${course.id}`}
                className="group flex h-full card-hover flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
              >
                <div className="relative aspect-[3/2] w-full bg-primary-soft">
                  {course.imageUrl ? (
                    <Image
                      src={course.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
                      className="card-hover-image object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-primary/40">
                      <BookOpen className="size-10" aria-hidden />
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2
                      className="text-lg leading-snug font-semibold text-ink group-hover:text-primary"
                      {...contentLang(course.title)}
                    >
                      {course.title}
                    </h2>
                    <StatusPill status={`content.${course.status}`} size="sm" />
                  </div>
                  <p className="text-sm text-muted">
                    {course.language.name} · {course.level.name}
                  </p>
                  <p className="mt-auto flex items-center justify-between gap-3 pt-2 text-sm">
                    <span className="font-semibold text-ink">
                      {formatPrice(course.access, course.priceSantim, t('free'))}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <Users className="size-4" aria-hidden />
                      {t('students', { count: course.studentCount })}
                    </span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        className="mt-6"
        page={query.page}
        totalPages={totalPages}
        hrefFor={(page) => hrefFor(query, { page })}
      />
    </>
  );
}
