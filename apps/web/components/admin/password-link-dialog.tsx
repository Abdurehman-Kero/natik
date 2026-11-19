'use client';

import { Copy, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';

/** What the API says about a password link it just made. */
export interface PasswordLinkResult {
  name: string;
  email: string | null;
  /** Set only when nothing really went out (email and SMS are not set up, or both failed). */
  link: string | null;
  sentTo: 'email' | 'sms' | null;
}

/**
 * Shown when no email or text message could be sent: the admin passes the link on by hand (WhatsApp,
 * Telegram…). When an email did go out, the screen only shows a short message instead (see users-view).
 */
export function PasswordLinkDialog({
  result,
  onClose,
}: {
  result: PasswordLinkResult | null;
  onClose: () => void;
}) {
  const t = useTranslations('users');

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('linkCopyFailed'));
    }
  }

  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {result ? (
          <>
            <DialogTitle>{t('linkTitle', { name: result.name })}</DialogTitle>
            <DialogDescription>{t('linkText')}</DialogDescription>
            <div className="mt-5 flex flex-col gap-4">
              {result.email ? (
                <p className="flex items-center gap-2 text-sm">
                  <Mail className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="text-muted">{t('linkSignInEmail')}</span>
                  <span className="min-w-0 truncate font-semibold">{result.email}</span>
                </p>
              ) : null}
              {result.link ? (
                <div className="flex flex-col gap-2">
                  <label htmlFor="password-link" className="text-sm font-semibold">
                    {t('linkLabel')}
                  </label>
                  <Input
                    id="password-link"
                    readOnly
                    dir="ltr"
                    value={result.link}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <Button onClick={() => void copy(result.link!)}>
                    <Copy aria-hidden /> {t('linkCopy')}
                  </Button>
                </div>
              ) : (
                <p className="text-muted">{t('linkNobody')}</p>
              )}
              <Button variant="secondary" onClick={onClose}>
                {t('linkDone')}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
