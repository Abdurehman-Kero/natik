'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  type ComponentProps,
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import dynamic from 'next/dynamic';
import Link from '@/components/ui/link';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { onFirstInteraction } from '@/lib/on-first-interaction';
import type { LanguageOption } from '@/lib/api/types';

import type { AuthMode } from './auth-dialog-view';

export type { AuthMode };

// The dialog (forms and their validation) is the heaviest part of the public chrome and is only
// needed after a tap, so it loads separately. It is fetched as soon as the visitor first touches or
// moves anything, and earlier still when a sign-in link is touched, so opening it feels instant.
const loadDialog = () => import('./auth-dialog-view');
const AuthDialogView = dynamic(loadDialog, { ssr: false });

interface OpenOptions {
  /** Where to go afterwards. Without it, the person's own home page. */
  next?: string;
}

interface AuthDialogApi {
  open: (mode: AuthMode, options?: OpenOptions) => void;
}

const AuthContext = createContext<AuthDialogApi | null>(null);

/** Open the sign-in / register dialog from anywhere on the public site. */
export function useAuthDialog(): AuthDialogApi {
  const router = useRouter();
  const context = useContext(AuthContext);
  // Outside the public shell there is no dialog: fall back to the full pages.
  return (
    context ?? {
      open: (mode, options) =>
        router.push(`/${mode}${options?.next ? `?next=${encodeURIComponent(options.next)}` : ''}`),
    }
  );
}

/**
 * A link to /sign-in or /register that opens the dialog instead, so the visitor never leaves the
 * page they were reading. Middle-click, "open in new tab" and no-JavaScript still reach the real page.
 */
export function AuthLink({
  mode,
  next,
  onClick,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, 'href'> & { mode: AuthMode; next?: string }) {
  const auth = useAuthDialog();
  const href = `/${mode}${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onMouseEnter={(event) => {
        void loadDialog();
        props.onMouseEnter?.(event);
      }}
      onTouchStart={(event) => {
        void loadDialog();
        props.onTouchStart?.(event);
      }}
      onFocus={(event) => {
        void loadDialog();
        props.onFocus?.(event);
      }}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        auth.open(mode, next ? { next } : undefined);
      }}
    >
      {children}
    </Link>
  );
}

/** One dialog for sign-in and registration, switchable in place, shared by the whole public site. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('site.auth');
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<{ mode: AuthMode; next: string | null } | null>(null);
  const [languages, setLanguages] = useState<LanguageOption[] | null>(null);
  // The dialog code is fetched as soon as the visitor does anything on the page (or taps a sign-in link).
  const [loaded, setLoaded] = useState(false);
  useEffect(() => onFirstInteraction(() => void loadDialog().then(() => setLoaded(true))), []);

  const open = useCallback(
    (mode: AuthMode, options?: OpenOptions) => {
      setState({ mode, next: options?.next ?? null });
      setLoaded(true);
      if (languages === null) {
        setLanguages([]);
        api<{ items: LanguageOption[] }>('/public/languages')
          .then((r) => setLanguages(r.items))
          .catch(() => undefined);
      }
    },
    [languages],
  );
  const value = useMemo(() => ({ open }), [open]);

  function finished(home: string) {
    const next = state?.next ?? null;
    setState(null);
    toast.success(state?.mode === 'register' ? t('welcomeNew') : t('welcomeBack'));
    if (next && next !== pathname) router.push(next);
    else if (!next) router.push(home);
    router.refresh();
  }

  const mode = state?.mode ?? 'sign-in';
  const switchTo = (next: AuthMode) => setState((s) => (s ? { ...s, mode: next } : s));

  return (
    <AuthContext.Provider value={value}>
      {children}
      {loaded ? (
        <AuthDialogView
          state={state}
          mode={mode}
          languages={languages}
          onClose={() => setState(null)}
          onSwitch={switchTo}
          onDone={finished}
        />
      ) : null}
    </AuthContext.Provider>
  );
}
