'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

/**
 * "Add Natik to your phone": shown only when the browser can install the site (Chrome and most
 * Android browsers). It does nothing for browsers that cannot, so nobody sees a dead button.
 */
export function InstallApp() {
  const t = useTranslations('home');
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!prompt) return null;
  return (
    <section className="bg-primary-soft">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 px-4 py-6 text-center sm:flex-row sm:justify-center sm:gap-6 sm:text-start">
        <div>
          <p className="font-semibold">{t('installTitle')}</p>
          <p className="text-muted">{t('installText')}</p>
        </div>
        <Button
          onClick={() => {
            void prompt.prompt().then(() => setPrompt(null));
          }}
        >
          <Download aria-hidden /> {t('installCta')}
        </Button>
      </div>
    </section>
  );
}
