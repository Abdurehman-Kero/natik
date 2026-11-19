import { LifeBuoy, PlayCircle, ScrollText, Video } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { HelpTabs } from '@/components/help/help-tabs';
import { LinkButton } from '@/components/ui/button';
import { TrailerPlayer } from '@/components/public/trailer-player';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getSiteContent } from '@/lib/site-config-live';
import { toEmbedUrl } from '@/lib/video-embed';

/**
 * The Help tab: a video on one sub-tab (set by the admin in Website › Help) and a written, step by
 * step guide on the other, for students (`role="student"`) and teachers (`role="teacher"`).
 */
export async function HelpGuide({ role }: { role: 'student' | 'teacher' }) {
  const t = await getTranslations('guide');
  const content = await getSiteContent();
  const link = role === 'student' ? content.help?.studentVideoUrl : content.help?.teacherVideoUrl;
  const embed = toEmbedUrl(link);
  const chatHref = role === 'student' ? '/chat' : '/teach/chat';
  const steps = t.raw(`${role}.steps`) as { title: string; text: string }[];

  const video = embed ? (
    <div className="flex flex-col gap-4">
      <TrailerPlayer embedUrl={embed} title={t(`${role}.videoTitle`)} />
      <p className="text-muted">{t(`${role}.videoText`)}</p>
    </div>
  ) : (
    <Card>
      <EmptyState
        icon={PlayCircle}
        title={t('noVideoTitle')}
        description={t('noVideoText')}
        action={
          <LinkButton href={chatHref} variant="secondary">
            {t('askTeam')}
          </LinkButton>
        }
      />
    </Card>
  );

  const written = (
    <ol className="flex flex-col gap-4">
      {steps.map((step, index) => (
        <li key={step.title}>
          <Card className="flex gap-4 p-5">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-lg font-bold text-white"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <h2 className="font-sans text-lg font-bold">{step.title}</h2>
              <p className="mt-1 text-muted">{step.text}</p>
            </div>
          </Card>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <LifeBuoy className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-[1.625rem] leading-tight font-bold md:text-4xl">{t('title')}</h1>
          <p className="mt-1 text-muted md:text-lg">{t(`${role}.subtitle`)}</p>
        </div>
      </header>

      <HelpTabs
        tabs={[
          { id: 'video', label: t('tabVideo'), icon: <Video aria-hidden />, content: video },
          {
            id: 'written',
            label: t('tabWritten'),
            icon: <ScrollText aria-hidden />,
            content: written,
          },
        ]}
        label={t('title')}
      />

      <Card className="flex flex-col items-start gap-3 bg-primary-soft p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{t('stuckTitle')}</p>
          <p className="text-muted">{t('stuckText')}</p>
        </div>
        <LinkButton href={chatHref}>{t('askTeam')}</LinkButton>
      </Card>
    </div>
  );
}
