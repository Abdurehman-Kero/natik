import { formatDate } from '@natik/shared';
import { getTranslations } from 'next-intl/server';
import type { PublicAnnouncement } from '@/lib/api/public';

/** Announcements, newest first: date, title and a short preview, as centred-column cards. */
export async function NewsList({
  items,
  preview = false,
}: {
  items: PublicAnnouncement[];
  preview?: boolean;
}) {
  const t = await getTranslations('news');
  return (
    <ul className="mx-auto flex max-w-3xl flex-col gap-4">
      {items.map((item) => (
        <li key={item.id}>
          <article className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-6 shadow-card">
            <p className="text-sm font-semibold tracking-wide text-accent-strong uppercase">
              {t('published', { date: formatDate(item.publishedAt) })}
            </p>
            <h3 className="font-sans text-xl font-semibold">{item.title}</h3>
            <p className={preview ? 'line-clamp-2 text-muted' : 'text-muted'}>{item.text}</p>
          </article>
        </li>
      ))}
    </ul>
  );
}
