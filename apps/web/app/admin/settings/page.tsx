import {
  Award,
  ChartColumn,
  Languages,
  MessageSquareWarning,
  ScrollText,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/layout';
import { apiFetch } from '@/lib/api/server';
import type { Paged, UserView } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('settings') };
}

/** The settings hub: everything an admin sets up in one place, with a hint of what needs attention. */
export default async function AdminSettingsPage() {
  await requireRole(['ADMIN'], '/admin/settings');
  const t = await getTranslations('settingsHub');
  const [accounts, failedSms, admins] = await Promise.all([
    apiFetch<{ items: unknown[] }>('/admin/payment-accounts')
      .then((r) => r.items.length)
      .catch(() => null),
    apiFetch<{ count: number }>('/admin/sms/count')
      .then((r) => r.count)
      .catch(() => 0),
    apiFetch<Paged<UserView>>('/admin/users?role=ADMIN&pageSize=1')
      .then((r) => r.total)
      .catch(() => null),
  ]);

  const cards: {
    href: string;
    icon: LucideIcon;
    title: string;
    text: string;
    note?: string;
    warn?: boolean;
  }[] = [
    {
      href: '/admin/settings/payments',
      icon: Wallet,
      title: t('payments'),
      text: t('paymentsText'),
      note: accounts === null ? undefined : String(accounts),
    },
    {
      href: '/admin/settings/catalogue',
      icon: Languages,
      title: t('catalogue'),
      text: t('catalogueText'),
    },
    {
      href: '/admin/settings/certificate',
      icon: Award,
      title: t('certificate'),
      text: t('certificateText'),
    },
    {
      href: '/admin/settings/sms',
      icon: MessageSquareWarning,
      title: t('sms'),
      text: t('smsText'),
      note: failedSms > 0 ? t('smsFailed', { count: failedSms }) : undefined,
      warn: failedSms > 0,
    },
    {
      href: '/admin/users?role=ADMIN',
      icon: ShieldCheck,
      title: t('admins'),
      text: t('adminsText'),
      note: admins === null ? undefined : String(admins),
    },
    { href: '/admin/reports', icon: ChartColumn, title: t('reports'), text: t('reportsText') },
    { href: '/admin/activity', icon: ScrollText, title: t('activity'), text: t('activityText') },
  ];

  return (
    <>
      <PageHeader title={t('title')} />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ href, icon: Icon, title, text, note, warn }) => (
          <li key={href}>
            <Link href={href} className="block h-full">
              <Card
                className={`flex h-full card-hover items-start gap-4 ${warn ? 'border-l-4 border-l-accent' : ''}`}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-semibold text-ink">
                    {title}
                    {note ? (
                      <span
                        className={`ml-2 text-sm font-semibold ${warn ? 'text-warning' : 'text-muted'}`}
                      >
                        {note}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm text-muted">{text}</span>
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
