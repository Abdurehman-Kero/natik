import type { MetadataRoute } from 'next';
import { type PublicCourse, publicFetch } from '@/lib/api/public';
import { siteUrl } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

const PAGES = [
  '',
  '/courses',
  '/find-your-level',
  '/teachers',
  '/about',
  '/news',
  '/contact',
  '/faq',
  '/help',
  '/privacy',
  '/terms',
  '/verify',
];

/** Public pages and every published course, so search engines find them (FR-WEB-007). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const { items } = await publicFetch<{ items: PublicCourse[] }>('/public/courses', { items: [] });
  return [
    ...PAGES.map((path) => ({ url: `${base}${path}`, changeFrequency: 'weekly' as const })),
    ...items.map((course) => ({
      url: `${base}/courses/${course.slug}`,
      changeFrequency: 'weekly' as const,
    })),
  ];
}
