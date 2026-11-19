import {
  ClipboardCheck,
  GraduationCap,
  type LucideIcon,
  MessageSquareText,
  Search,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AuthLink } from '@/components/auth/auth-dialog';
import { Container } from '@/components/ui/layout';
import { cn } from '@/lib/cn';
import { TourButton, ToolButton } from '@/components/public/site-tool-links';
import Link from '@/components/ui/link';

export type NextStep = 'level' | 'courses' | 'join' | 'message' | 'tour' | 'teachers';

const ICONS: Record<NextStep, LucideIcon> = {
  level: ClipboardCheck,
  courses: Search,
  join: UserPlus,
  message: MessageSquareText,
  tour: Sparkles,
  teachers: GraduationCap,
};

const card =
  'group flex h-full w-full items-start gap-4 rounded-2xl border border-border bg-surface p-5 text-start shadow-card transition hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-raised';

/**
 * "What next?" at the bottom of a page: two or three doors to the natural next step (a level check,
 * the courses, a free account, a message to the team), so no page is a dead end. The quick ones open
 * in a dialog; the rest go to the page.
 */
export function NextSteps({
  items,
  tone = 'white',
}: {
  items: NextStep[];
  tone?: 'white' | 'canvas';
}) {
  const t = useTranslations('site.next');
  return (
    <section className={cn('py-12 md:py-16', tone === 'white' && 'bg-surface')}>
      <Container>
        <h2 className="mb-6 text-center text-xl font-bold md:mb-8 md:text-2xl">{t('title')}</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:[&:has(>li:nth-child(2):last-child)]:grid-cols-2">
          {items.map((item) => {
            const Icon = ICONS[item];
            const body = (
              <>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-lg font-semibold text-ink group-hover:text-primary">
                    {t(`${item}.title`)}
                  </span>
                  <span className="text-muted">{t(`${item}.text`)}</span>
                </span>
              </>
            );
            return (
              <li key={item}>
                {item === 'level' ? (
                  <ToolButton tool="level" plain className={card}>
                    {body}
                  </ToolButton>
                ) : item === 'message' ? (
                  <ToolButton tool="contact" plain className={card}>
                    {body}
                  </ToolButton>
                ) : item === 'tour' ? (
                  <TourButton plain className={card}>
                    {body}
                  </TourButton>
                ) : item === 'join' ? (
                  <AuthLink mode="register" className={card}>
                    {body}
                  </AuthLink>
                ) : (
                  <Link href={item === 'courses' ? '/courses' : '/teachers'} className={card}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
