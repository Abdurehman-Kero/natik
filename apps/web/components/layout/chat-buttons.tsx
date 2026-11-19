import { getTranslations } from 'next-intl/server';
import { SocialIcon } from '@/components/ui/social-icon';
import { whatsappUrl } from '@/lib/site-config';
import { getLiveSiteConfig } from '@/lib/site-config-live';

/** Floating WhatsApp and Telegram buttons, bottom-right, so visitors can talk to the team at once. */
export async function ChatButtons() {
  const t = await getTranslations('chat');
  const site = await getLiveSiteConfig();
  const whatsapp = whatsappUrl(site);
  const telegram = site.socials.find((s) => s.name === 'Telegram chat')?.href ?? null;
  if (!whatsapp && !telegram) return null;

  const items = [
    whatsapp
      ? { name: 'WhatsApp', href: whatsapp, label: t('whatsapp'), color: 'bg-[#25D366]' }
      : null,
    telegram
      ? { name: 'Telegram', href: telegram, label: t('telegram'), color: 'bg-[#229ED9]' }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <ul className="fixed right-4 bottom-4 z-40 flex flex-col gap-3 max-lg:bottom-20 sm:right-6 sm:bottom-6 max-lg:sm:bottom-20">
      {items.map((item) => (
        <li key={item.name}>
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
            title={item.label}
            className={`flex size-12 items-center justify-center rounded-full text-white shadow-raised transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:size-14 ${item.color}`}
          >
            <SocialIcon name={item.name} className="size-7" />
          </a>
        </li>
      ))}
    </ul>
  );
}
