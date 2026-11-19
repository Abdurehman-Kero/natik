'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { onFirstInteraction } from '@/lib/on-first-interaction';

/** The quick dialogs the public site opens from many places, so nobody has to leave the page. */
export type SiteTool = 'search' | 'contact' | 'verify' | 'level';

interface SiteTools {
  open: (tool: SiteTool) => void;
}

const SiteToolsContext = createContext<SiteTools | null>(null);

const PAGE_FOR: Record<SiteTool, string> = {
  search: '/courses',
  contact: '/contact',
  verify: '/verify',
  level: '/find-your-level',
};

/** Open a dialog from anywhere on the public site. Outside it, go to the matching page. */
export function useSiteTools(): SiteTools {
  const router = useRouter();
  return useContext(SiteToolsContext) ?? { open: (tool) => router.push(PAGE_FOR[tool]) };
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

// The dialogs are heavy (forms, search) and only used after a tap, so they load separately: when a
// visitor first touches, moves or presses anything (so it is nearly always there before a click).
const loadDialogs = () => import('./site-tools-dialogs');
const SiteToolsDialogs = dynamic(loadDialogs, { ssr: false });

/** Starts fetching the dialogs; called when someone is about to use one. */
export function preloadSiteTools(): void {
  void loadDialogs();
}

export function SiteToolsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // A dialog that led somewhere (a course in the search results) closes once that page is open:
  // it is remembered together with the page it was opened on.
  const [opened, setOpened] = useState<{ tool: SiteTool; path: string } | null>(null);
  const tool = opened && opened.path === pathname ? opened.tool : null;
  // The dialog code is fetched as soon as the visitor does anything on the page, and stays mounted.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => onFirstInteraction(() => void loadDialogs().then(() => setLoaded(true))), []);
  const setTool = useCallback(
    (next: SiteTool | null) => {
      if (next) setLoaded(true);
      setOpened(next ? { tool: next, path: pathname } : null);
    },
    [pathname],
  );
  const open = useCallback((next: SiteTool) => setTool(next), [setTool]);
  const value = useMemo(() => ({ open }), [open]);

  // "/" or Ctrl/Cmd+K opens the search from any page, like most products people already use.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTyping(event.target)) return;
      const combo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (event.key === '/' || combo) {
        event.preventDefault();
        preloadSiteTools();
        setTool('search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTool]);

  const close = (next: boolean) => {
    if (!next) setTool(null);
  };

  return (
    <SiteToolsContext.Provider value={value}>
      {children}
      {loaded ? <SiteToolsDialogs tool={tool} onOpenChange={close} /> : null}
    </SiteToolsContext.Provider>
  );
}
