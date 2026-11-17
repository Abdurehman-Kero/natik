import { MessageCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ExternalLinkButton, LinkButton } from '@/components/ui/button';
import { SocialIcon } from '@/components/ui/social-icon';
import { cn } from '@/lib/cn';
import { whatsappUrl } from '@/lib/site-config';
import { getLiveSiteConfig } from '@/lib/site-config-live';

/**
 * Three ways to reach Natik support (WhatsApp, Telegram and the in-site chat), used wherever a
 * visitor might have a question about payment. Payment details are never shown on the public site:
 * the team answers them personally. Shows only the channels Natik has set up.
 */
export async function SupportButtons({
  className,
  compact = false,
}: {
  className?: string;
  /** Smaller buttons for tight places such as the course card. */
  compact?: boolean;
}) {
  const t = await getTranslations('support');
  const site = await getLiveSiteConfig();
  const whatsapp = whatsappUrl(site);
  const telegram = site.socials.find((s) => s.name === 'Telegram chat')?.href ?? null;
  const size = compact ? 'sm' : 'md';
  return (
    <div className={cn('flex flex-wrap justify-center gap-2', className)}>
      {whatsapp ? (
        <ExternalLinkButton href={whatsapp} size={size} variant="secondary">
          <SocialIcon name="WhatsApp" className="size-4.5 text-[#1fa855]" /> {t('whatsapp')}
        </ExternalLinkButton>
      ) : null}
      {telegram ? (
        <ExternalLinkButton href={telegram} size={size} variant="secondary">
          <SocialIcon name="Telegram" className="size-4.5 text-[#1b7fa8]" /> {t('telegram')}
        </ExternalLinkButton>
      ) : null}
      <LinkButton href="/chat" size={size} variant="secondary">
        <MessageCircle aria-hidden /> {t('chat')}
      </LinkButton>
    </div>
  );
}

/** A framed note: "Questions about payment? Ask Natik support" with the three buttons. */
export async function PaymentSupport({
  title,
  text,
  className,
}: {
  title?: string;
  text?: string;
  className?: string;
}) {
  const t = await getTranslations('support');
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-5 text-center md:p-6',
        className,
      )}
    >
      <p className="font-semibold text-primary">{title ?? t('title')}</p>
      <p className="max-w-md text-ink/80">{text ?? t('text')}</p>
      <SupportButtons />
    </div>
  );
}
