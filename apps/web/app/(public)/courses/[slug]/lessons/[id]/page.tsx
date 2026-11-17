import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from '@/components/ui/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LessonView } from '@/components/lesson/lesson-view';
import { FreeLessonCta } from '@/components/public/free-lesson-cta';
import { Container } from '@/components/ui/layout';
import { Card } from '@/components/ui/card';
import { publicFetch } from '@/lib/api/public';
import type { LessonViewModel } from '@/lib/api/types';

type Props = { params: Promise<{ slug: string; id: string }> };

interface FreeLessonResponse {
  lesson: LessonViewModel;
  course: { slug: string; title: string };
}

const load = (id: string) =>
  publicFetch<FreeLessonResponse | null>(`/public/lessons/${encodeURIComponent(id)}`, null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).id);
  return data ? { title: data.lesson.title, description: data.course.title } : {};
}

/** A free-preview lesson for anyone, no sign-in (FR-CAT-005). Anything that is not a free preview is "not found". */
export default async function FreeLessonPage({ params }: Props) {
  const { slug, id } = await params;
  const data = await load(id);
  // The address must match the lesson's own course; anything else is not found.
  if (!data || data.course.slug !== slug) notFound();

  const t = await getTranslations('freeLessons');

  return (
    <Container size="reading" className="flex flex-col gap-8 py-8 md:py-12">
      <Link
        href={`/courses/${slug}`}
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-muted hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {data.course.title}
      </Link>
      <LessonView lesson={data.lesson} />
      <Card className="flex flex-col items-start gap-3 bg-primary-soft p-6">
        <h2 className="text-xl font-semibold">{t('enjoyedTitle')}</h2>
        <p className="text-ink/80">{t('enjoyedText')}</p>
        <FreeLessonCta slug={slug} />
      </Card>
    </Container>
  );
}
