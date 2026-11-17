import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/cn';

export type CertificateView = 'approve' | 'waiting' | 'returned' | 'issued';

/** The four lists on the certificates page, with how many are in each. */
export async function CertificateTabs({
  view,
  counts,
}: {
  view: CertificateView;
  counts: { AWAITING_APPROVAL: number; AWAITING_NAME: number; RETURNED: number };
}) {
  const t = await getTranslations('adminCerts');
  const tabs: [CertificateView, string, number | null][] = [
    ['approve', t('tabApprove'), counts.AWAITING_APPROVAL],
    ['waiting', t('tabWaiting'), counts.AWAITING_NAME],
    ['returned', t('tabReturned'), counts.RETURNED],
    ['issued', t('tabIssued'), null],
  ];
  return (
    <nav
      aria-label={t('views')}
      className="mb-5 flex [scrollbar-width:none] gap-1 overflow-x-auto border-b border-border"
    >
      {tabs.map(([value, label, count]) => (
        <Link
          key={value}
          href={value === 'approve' ? '/admin/certificates' : `/admin/certificates?view=${value}`}
          aria-current={value === view ? 'page' : undefined}
          className={cn(
            'relative flex min-h-11 shrink-0 items-center gap-1.5 px-3 font-semibold whitespace-nowrap transition-colors hover:text-primary',
            'after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-full',
            value === view ? 'text-primary after:bg-accent' : 'text-muted after:bg-transparent',
          )}
        >
          {label}
          {count ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs',
                value === 'approve' ? 'bg-accent text-white' : 'bg-subtle text-muted',
              )}
            >
              {count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
