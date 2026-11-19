import {
  Award,
  BookOpen,
  ClipboardCheck,
  CreditCard,
  Gift,
  KeyRound,
  type LucideIcon,
  Smartphone,
  UserPlus,
} from 'lucide-react';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { FaqAccordion, type FaqItem } from '@/components/public/faq-accordion';
import { NextSteps } from '@/components/public/next-steps';
import { PageHero } from '@/components/public/page-hero';
import { PublicSection } from '@/components/public/section';
import { PaymentSupport } from '@/components/public/support-contact';

export async function generateMetadata() {
  const t = await getTranslations('help');
  return { title: t('title'), description: t('subtitle') };
}

interface Topic {
  title: string;
  text: string;
  href: string;
  cta: string;
}

const ICONS: LucideIcon[] = [
  UserPlus,
  Gift,
  BookOpen,
  ClipboardCheck,
  Award,
  KeyRound,
  CreditCard,
  Smartphone,
];

/** A help centre: where to start, step-by-step guides and a way to reach Natik support. */
export default async function HelpPage() {
  const t = await getTranslations('help');
  const topics = t.raw('topics') as Topic[];
  const guides = t.raw('guides') as FaqItem[];

  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} />

      <PublicSection eyebrow={t('startEyebrow')} title={t('startTitle')} intro={t('startText')}>
        <ul className="flex flex-wrap justify-center gap-5">
          {topics.map((topic, index) => {
            const Icon = ICONS[index] ?? BookOpen;
            return (
              <li
                key={topic.title}
                className="flex w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc(25%-0.95rem)]"
              >
                <Link
                  href={topic.href}
                  className="group flex w-full flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center shadow-card transition duration-300 hover:-translate-y-1 hover:border-accent/60 hover:shadow-raised"
                >
                  <span
                    className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-[#1f5277] text-white shadow-raised"
                    aria-hidden
                  >
                    <Icon className="size-6" />
                  </span>
                  <h3 className="font-sans text-lg font-semibold">{topic.title}</h3>
                  <p className="text-muted">{topic.text}</p>
                  <span className="mt-auto pt-1 text-sm font-semibold text-primary group-hover:underline">
                    {topic.cta}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </PublicSection>

      <PublicSection
        tone="white"
        size="reading"
        eyebrow={t('guidesEyebrow')}
        title={t('guidesTitle')}
      >
        <FaqAccordion items={guides} />
      </PublicSection>

      <PublicSection size="reading">
        <PaymentSupport title={t('supportTitle')} text={t('supportText')} />
      </PublicSection>
      <NextSteps items={['message', 'level', 'tour']} />
    </>
  );
}
