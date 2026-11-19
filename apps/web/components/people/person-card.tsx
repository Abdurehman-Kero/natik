'use client';

import { Mail, MapPin, MessageCircle, Phone, UserPen } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button, LinkButton } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { countryName, flagOf } from '@/lib/countries';
import type { PersonCard } from '@/lib/people/types';

interface PersonCardApi {
  /** Opens the profile card of this person (chat and group screens call this). */
  open: (id: string) => void;
}

const PersonCardContext = createContext<PersonCardApi | null>(null);

/** Tap a name or a picture in a chat to see who that is, like Telegram. Does nothing outside a provider. */
export function usePersonCard(): PersonCardApi {
  return useContext(PersonCardContext) ?? { open: () => undefined };
}

/** Wrap a chat or group screen with this; it holds the one profile dialog they all share. */
export function PersonCardProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const open = useCallback((next: string) => setId(next), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <PersonCardContext.Provider value={value}>
      {children}
      <PersonCardDialog id={id} onClose={() => setId(null)} />
    </PersonCardContext.Provider>
  );
}

/**
 * A name or picture that opens the person's card when tapped. Without an id (for example the Natik
 * team in a student's chat) it is drawn as plain content.
 */
export function PersonButton({
  id,
  name,
  children,
  className,
  decorative,
}: {
  id: string | null | undefined;
  name: string;
  children: ReactNode;
  className?: string;
  /** A picture next to a name that is already a button: tapping it works, but it is not a second control for keyboards and screen readers. */
  decorative?: boolean;
}) {
  const t = useTranslations('people');
  const card = usePersonCard();
  if (!id) return <span className={className}>{children}</span>;
  return (
    <button
      type="button"
      onClick={() => card.open(id)}
      title={t('openProfile', { name })}
      aria-haspopup="dialog"
      {...(decorative ? { 'aria-hidden': true, tabIndex: -1 } : {})}
      className={cn(
        'rounded-lg text-start focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Where the chat screen is for the signed-in person, worked out from the page they are on. */
function chatPathFor(pathname: string): string {
  if (pathname.startsWith('/admin')) return '/admin/chat';
  if (pathname.startsWith('/teach')) return '/teach/chat';
  return '/chat';
}

function PersonCardDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations('people');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [card, setCard] = useState<PersonCard | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let live = true;
    api<PersonCard>(`/people/${encodeURIComponent(id)}/card`, { quiet: true })
      .then((result) => {
        if (live) setCard(result);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      setCard(null);
      setFailed(false);
    };
  }, [id]);

  async function message(target: string) {
    setBusy(true);
    try {
      const chat = await api<{ id: string }>('/chat/conversations', {
        method: 'POST',
        json: { with: target },
      });
      onClose();
      router.push(`${chatPathFor(pathname)}?c=${encodeURIComponent(chat.id)}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const since =
    card &&
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      new Date(card.memberSince),
    );

  return (
    <Dialog open={id !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="sr-only">{card ? card.name : t('title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('title')}</DialogDescription>

        {failed ? (
          <p role="alert" className="py-8 text-center text-muted">
            {t('loadFailed')}
          </p>
        ) : !card ? (
          <div className="flex flex-col items-center gap-3 py-4" aria-busy>
            <Skeleton className="size-24 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <Avatar name={card.name} src={card.avatarUrl} size="xl" decorative />
              <h2 className="font-heading text-xl font-bold" aria-hidden>
                {card.name}
              </h2>
              <p className="inline-flex items-center rounded-full bg-primary-soft px-3 py-0.5 text-sm font-semibold text-primary">
                {t(`role.${card.role}`)}
              </p>
              <p className="text-sm text-muted">{t('memberSince', { date: since ?? '' })}</p>
            </div>

            {card.bio ? <Section title={t('about')}>{card.bio}</Section> : null}

            {card.teaches.length > 0 ? (
              <Section title={t('teaches')}>
                <ul className="flex flex-col gap-1">
                  {card.teaches.map((c) => (
                    <li key={c.slug}>
                      {c.title} <span className="text-muted">· {c.language}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {card.sharedCourses.length > 0 && !card.isMe ? (
              <Section title={t('sharedCourses')}>
                <ul className="flex flex-col gap-1">
                  {card.sharedCourses.map((c) => (
                    <li key={c.id}>{c.title}</li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {card.location ? (
              <Section title={t('from')}>
                <p className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-muted" aria-hidden />
                  {[
                    card.location.country
                      ? `${flagOf(card.location.country)} ${countryName(card.location.country, locale)}`
                      : null,
                    card.location.city,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </Section>
            ) : null}

            {card.contact && (card.contact.phone || card.contact.email) ? (
              <Section title={t('contact')} hint={t('contactHint')}>
                <ul className="flex flex-col gap-1">
                  {card.contact.phone ? (
                    <li>
                      <a
                        href={`tel:${card.contact.phone.replace(/\s/g, '')}`}
                        dir="ltr"
                        className="inline-flex min-h-11 items-center gap-2 text-primary hover:underline"
                      >
                        <Phone className="size-4" aria-hidden /> {card.contact.phone}
                      </a>
                    </li>
                  ) : null}
                  {card.contact.email ? (
                    <li>
                      <a
                        href={`mailto:${card.contact.email}`}
                        className="inline-flex min-h-11 items-center gap-2 break-all text-primary hover:underline"
                      >
                        <Mail className="size-4 shrink-0" aria-hidden /> {card.contact.email}
                      </a>
                    </li>
                  ) : null}
                </ul>
              </Section>
            ) : null}

            {card.isMe ? (
              <LinkButton href="/profile" variant="secondary" fullWidth onClick={onClose}>
                <UserPen aria-hidden /> {t('editMine')}
              </LinkButton>
            ) : card.messageWith ? (
              <Button
                size="lg"
                fullWidth
                loading={busy}
                onClick={() => void message(card.messageWith!)}
              >
                <MessageCircle aria-hidden /> {t('message')}
              </Button>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 border-t border-border pt-4">
      <h3 className="font-sans text-xs font-bold tracking-wider text-muted uppercase">{title}</h3>
      <div className="text-ink">{children}</div>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </section>
  );
}
