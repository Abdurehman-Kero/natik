import { getTranslations } from 'next-intl/server';
import { WebsiteEditor } from '@/components/admin/website/website-editor';
import type { PolicyState } from '@/components/admin/website/policies-tab';
import { apiFetch } from '@/lib/api/server';
import type { RichTextDoc } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('website') };
}

type SiteValue = { value: Record<string, string | undefined> | null };
interface PolicyResponse {
  title: string;
  body: RichTextDoc;
}

/** The built-in plain-language draft, as an editable document. */
function draftDoc(sections: { h: string; p: string[] }[]): RichTextDoc {
  return {
    type: 'doc',
    content: sections.flatMap((section) => [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: section.h }] },
      ...section.p.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
    ]),
  };
}

export default async function AdminWebsitePage() {
  await requireRole(['ADMIN'], '/admin/website');
  const th = await getTranslations('home');
  const ta = await getTranslations('about');
  const tp = await getTranslations('privacy');
  const tt = await getTranslations('terms');

  const [home, about, contact, faq, testimonials, privacy, terms, featured] = await Promise.all([
    apiFetch<SiteValue>('/admin/site/home'),
    apiFetch<SiteValue>('/admin/site/about'),
    apiFetch<SiteValue>('/admin/site/contact'),
    apiFetch<{ items: { id: string; question: string; answer: string; published: boolean }[] }>(
      '/admin/faq',
    ),
    apiFetch<{
      items: {
        id: string;
        name: string;
        quote: string;
        courseLabel: string | null;
        published: boolean;
      }[];
    }>('/admin/testimonials'),
    apiFetch<PolicyResponse | null>('/admin/policies/privacy'),
    apiFetch<PolicyResponse | null>('/admin/policies/terms'),
    apiFetch<{
      featured: { id: string; title: string }[];
      choices: { id: string; title: string }[];
    }>('/admin/featured-courses'),
  ]);

  const policy = (
    saved: PolicyResponse | null,
    fallbackTitle: string,
    sections: { h: string; p: string[] }[],
  ): PolicyState =>
    saved
      ? { title: saved.title, body: saved.body, saved: true }
      : { title: fallbackTitle, body: draftDoc(sections), saved: false };

  return (
    <WebsiteEditor
      home={home.value ?? {}}
      about={about.value ?? {}}
      contact={contact.value ?? {}}
      faq={faq.items}
      testimonials={testimonials.items}
      policies={{
        privacy: policy(privacy, tp('title'), tp.raw('sections') as { h: string; p: string[] }[]),
        terms: policy(terms, tt('title'), tt.raw('sections') as { h: string; p: string[] }[]),
      }}
      featured={featured.featured}
      choices={featured.choices}
      defaults={{
        eyebrow: th('heroEyebrow'),
        title: th('heroTitle'),
        subtitle: th('heroSubtitle'),
        mission: ta('missionText'),
      }}
    />
  );
}
