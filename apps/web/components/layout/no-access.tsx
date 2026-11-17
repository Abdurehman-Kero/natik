import { Lock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

/** A friendly page for "this isn't yours" or "this doesn't exist", instead of an error screen. */
export async function NoAccess({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  const t = await getTranslations('noAccess');
  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        icon={Lock}
        title={t('title')}
        description={t('text')}
        action={<LinkButton href={backHref}>{backLabel}</LinkButton>}
      />
    </Card>
  );
}
