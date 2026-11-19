import { Compass } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ClientMessages } from '@/components/client-messages';
import { PublicShell } from '@/components/layout/shells';
import { LinkButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export async function generateMetadata() {
  const t = await getTranslations('notFound');
  return { title: t('title') };
}

/** Friendly 404 with a way home (SRS §10). */
export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <ClientMessages area="public">
      <PublicShell>
        <div className="flex flex-1 items-center justify-center py-16">
          <EmptyState
            as="h1"
            icon={Compass}
            title={t('title')}
            description={t('text')}
            action={
              <>
                <LinkButton href="/">{t('home')}</LinkButton>
                <LinkButton href="/contact" variant="secondary">
                  {t('contact')}
                </LinkButton>
              </>
            }
          />
        </div>
      </PublicShell>
    </ClientMessages>
  );
}
