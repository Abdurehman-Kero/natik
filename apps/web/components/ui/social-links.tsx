import { SocialIcon } from '@/components/ui/social-icon';

const pill =
  'flex min-h-11 items-center justify-center rounded-full border border-border-strong text-primary hover:border-primary hover:bg-primary-soft';
const pillOnDark =
  'flex min-h-11 items-center justify-center rounded-full border border-white/40 text-white transition-colors hover:border-white hover:bg-white/10';

/** "https://t.me/Natikfluency" → "@Natikfluency". */
function handle(href: string): string {
  const name = href.replace(/^https?:\/\/(www\.)?t\.me\//, '').replace(/[/?#].*$/, '');
  return name ? `@${name}` : href;
}

/**
 * Social links as round brand icons. The direct Telegram chat shows the @username as text instead,
 * so it is not mistaken for the Telegram channel, which has the same icon.
 */
export function SocialLinks({
  socials,
  className,
  tone = 'light',
}: {
  socials: { name: string; href: string }[];
  className?: string;
  /** "onDark" for the navy footer. */
  tone?: 'light' | 'onDark';
}) {
  const look = tone === 'onDark' ? pillOnDark : pill;
  return (
    <ul className={className ?? 'flex flex-wrap gap-2'}>
      {socials.map((social) => {
        const direct = social.name === 'Telegram chat';
        return (
          <li key={social.name}>
            <a
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={direct ? undefined : social.name}
              title={direct ? 'Telegram' : social.name}
              className={direct ? `${look} px-4 text-sm font-semibold` : `${look} size-11`}
            >
              {direct ? handle(social.href) : <SocialIcon name={social.name} className="size-5" />}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
