'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { RegisterForm } from '@/components/auth/register-form';
import { SignInForm } from '@/components/auth/sign-in-form';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { LanguageOption } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import mark from '@/public/brand/natik-mark.png';

export type AuthMode = 'sign-in' | 'register';

/**
 * The sign-in / register dialog itself. It is a separate file so that the forms (and the validation
 * code behind them) load after the page is ready, not before; see `AuthProvider`.
 */
export default function AuthDialogView({
  state,
  mode,
  languages,
  onClose,
  onSwitch,
  onDone,
}: {
  state: { mode: AuthMode; next: string | null } | null;
  mode: AuthMode;
  languages: LanguageOption[] | null;
  onClose: () => void;
  onSwitch: (mode: AuthMode) => void;
  onDone: (home: string) => void;
}) {
  const t = useTranslations('site.auth');
  const switchTo = onSwitch;
  const finished = onDone;
  return (
    <Dialog open={state !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        aria-describedby="auth-dialog-text"
        className={cn('max-w-md', mode === 'register' && 'sm:max-w-3xl')}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
            <Image src={mark} alt="" className="h-7 w-auto" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="leading-tight">
              {mode === 'sign-in' ? t('signInTitle') : t('registerTitle')}
            </DialogTitle>
            <DialogDescription id="auth-dialog-text" className="mt-0.5 text-sm">
              {mode === 'sign-in' ? t('signInText') : t('registerText')}
            </DialogDescription>
          </div>
        </div>

        <div
          role="group"
          aria-label={t('switchLabel')}
          className="mt-5 grid grid-cols-2 rounded-xl bg-canvas p-1"
        >
          {(['sign-in', 'register'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => switchTo(item)}
              className={cn(
                'min-h-11 rounded-lg px-3 font-semibold transition',
                mode === item
                  ? 'bg-surface text-primary shadow-card'
                  : 'text-muted hover:text-primary',
              )}
            >
              {item === 'sign-in' ? t('signInTab') : t('registerTab')}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {state ? (
            mode === 'sign-in' ? (
              <SignInForm
                key="sign-in"
                embedded
                next={state.next}
                onDone={finished}
                onSwitch={() => switchTo('register')}
              />
            ) : (
              <RegisterForm
                key="register"
                embedded
                languages={languages ?? []}
                next={state.next}
                onDone={finished}
                onSwitch={() => switchTo('sign-in')}
              />
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
