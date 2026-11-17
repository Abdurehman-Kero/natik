'use client';

import { faqInputSchema, testimonialInputSchema } from '@natik/shared';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { LinkButton } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ItemsTab } from './items-tab';
import { type PolicyState, PoliciesTab } from './policies-tab';
import { AboutTab, ContactTab, FeaturedTab, HomeTab } from './text-tabs';

interface FaqRow {
  id: string;
  question: string;
  answer: string;
  published: boolean;
}
interface TestimonialRow {
  id: string;
  name: string;
  quote: string;
  courseLabel: string | null;
  published: boolean;
}

export interface WebsiteEditorProps {
  home: Record<string, string | undefined>;
  about: Record<string, string | undefined>;
  contact: Record<string, string | undefined>;
  faq: FaqRow[];
  testimonials: TestimonialRow[];
  policies: Record<'privacy' | 'terms', PolicyState>;
  featured: { id: string; title: string }[];
  choices: { id: string; title: string }[];
  defaults: { eyebrow: string; title: string; subtitle: string; mission: string };
}

const PAGE_FOR_TAB: Record<string, string> = {
  home: '/',
  about: '/about',
  faq: '/faq',
  testimonials: '/',
  policies: '/privacy',
  contact: '/contact',
};

/** Admin › Website: every public text and list, edited without a developer (FR-WEB-005). */
export function WebsiteEditor(props: WebsiteEditorProps) {
  const t = useTranslations('websiteEditor');
  const [tab, setTab] = useState('home');
  const [faq, setFaq] = useState(props.faq);
  const [testimonials, setTestimonials] = useState(props.testimonials);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <LinkButton href={PAGE_FOR_TAB[tab] ?? '/'} variant="secondary">
            <ExternalLink aria-hidden /> {t('viewPage')}
          </LinkButton>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="home">{t('tabs.home')}</TabsTrigger>
          <TabsTrigger value="about">{t('tabs.about')}</TabsTrigger>
          <TabsTrigger value="faq">{t('tabs.faq')}</TabsTrigger>
          <TabsTrigger value="testimonials">{t('tabs.testimonials')}</TabsTrigger>
          <TabsTrigger value="policies">{t('tabs.policies')}</TabsTrigger>
          <TabsTrigger value="contact">{t('tabs.contact')}</TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="flex flex-col gap-6">
          <HomeTab
            initial={props.home}
            defaults={{
              eyebrow: props.defaults.eyebrow,
              title: props.defaults.title,
              subtitle: props.defaults.subtitle,
            }}
          />
          <FeaturedTab initialFeatured={props.featured} choices={props.choices} />
        </TabsContent>

        <TabsContent value="about">
          <AboutTab initial={props.about} defaultMission={props.defaults.mission} />
        </TabsContent>

        <TabsContent value="faq">
          <ItemsTab
            base="/admin/faq"
            items={faq}
            onItems={setFaq}
            schema={faqInputSchema}
            fields={[
              { name: 'question', label: t('question'), maxLength: 200 },
              { name: 'answer', label: t('answer'), multiline: true, maxLength: 1500 },
            ]}
            blank={{ question: '', answer: '' }}
            titleOf={(item) => item.question}
            summaryOf={(item) => item.answer}
            copy={{
              add: t('faqAdd'),
              empty: t('faqEmpty'),
              emptyText: t('faqEmptyText'),
              addTitle: t('faqAddTitle'),
              editTitle: t('faqEditTitle'),
              deleteTitle: t('faqDeleteTitle'),
              deleteText: t('faqDeleteText'),
              hidden: t('hidden'),
              published: t('showOnSite'),
              publishedHint: t('showOnSiteHint'),
              save: t('save'),
              saved: t('saved'),
            }}
          />
        </TabsContent>

        <TabsContent value="testimonials">
          <ItemsTab
            base="/admin/testimonials"
            items={testimonials}
            onItems={setTestimonials}
            schema={testimonialInputSchema}
            fields={[
              { name: 'name', label: t('studentName'), maxLength: 80 },
              { name: 'quote', label: t('quote'), multiline: true, maxLength: 400 },
              { name: 'courseLabel', label: t('courseLabel'), optional: true, maxLength: 80 },
            ]}
            blank={{ name: '', quote: '', courseLabel: '' }}
            titleOf={(item) => item.name}
            summaryOf={(item) => `“${item.quote}”`}
            copy={{
              add: t('testimonialAdd'),
              empty: t('testimonialEmpty'),
              emptyText: t('testimonialEmptyText'),
              addTitle: t('testimonialAddTitle'),
              editTitle: t('testimonialEditTitle'),
              deleteTitle: t('testimonialDeleteTitle'),
              deleteText: t('testimonialDeleteText'),
              hidden: t('hidden'),
              published: t('showOnSite'),
              publishedHint: t('testimonialShowHint'),
              save: t('save'),
              saved: t('saved'),
            }}
          />
        </TabsContent>

        <TabsContent value="policies">
          <PoliciesTab initial={props.policies} />
        </TabsContent>

        <TabsContent value="contact">
          <ContactTab initial={props.contact} />
        </TabsContent>
      </Tabs>
    </>
  );
}
