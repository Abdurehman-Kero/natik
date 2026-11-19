import { CalendarDays, Compass, UserCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { TourButton } from '@/components/public/site-tool-links';
import { LinkButton } from '@/components/ui/button';

const ICONS = [Compass, UserCheck, CalendarDays];

/**
 * What a new student sees before they have any course: three plain steps and one big button, so
 * nobody has to guess where to begin. "Show me around" starts the guided tour.
 */
export async function GettingStarted() {
  const t = await getTranslations('studentHome.start');
  const steps = t.raw('steps') as { title: string; text: string; cta?: string }[];
  return (
    <section
      aria-labelledby="start-heading"
      className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card"
    >
      <div className="on-dark bg-linear-to-br from-primary via-primary to-[#0b2a42] p-6 text-white md:p-8">
        <h2 id="start-heading" className="text-2xl font-bold text-white md:text-3xl">
          {t('title')}
        </h2>
        <p className="mt-1 text-white/85 md:text-lg">{t('text')}</p>
      </div>
      <ol className="flex flex-col divide-y divide-border">
        {steps.map((step, index) => {
          const Icon = ICONS[index] ?? Compass;
          return (
            <li key={step.title} className="flex items-start gap-4 p-5 md:p-6">
              <span className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Icon className="size-6" aria-hidden />
                <span className="absolute -top-2 -left-2 flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-ink">
                  {index + 1}
                </span>
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h3 className="font-sans text-lg font-semibold">{step.title}</h3>
                <p className="text-muted">{step.text}</p>
                {step.cta ? (
                  <LinkButton href="/browse" size="lg" className="mt-3 w-full sm:w-auto">
                    {step.cta}
                  </LinkButton>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-border bg-canvas px-5 py-3 text-center md:px-6">
        <TourButton
          plain
          className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
        >
          {t('tour')}
        </TourButton>
      </div>
    </section>
  );
}
