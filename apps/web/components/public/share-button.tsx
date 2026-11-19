'use client';

import { Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

/** Opens the phone's own share sheet, or copies the link on a computer. */
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations('courses');
  const ts = useTranslations('site.course');
  async function share() {
    const url = window.location.href.split('#')[0]!;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(ts('shared'));
    } catch {
      // the person closed the share sheet: nothing to do
    }
  }
  return (
    <Button size="sm" onClick={share}>
      {t('share')}
      <Share2 aria-hidden />
    </Button>
  );
}
