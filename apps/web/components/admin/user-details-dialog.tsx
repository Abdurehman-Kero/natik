'use client';

import { formatDate, formatDateTime } from '@natik/shared';
import { MapPin } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { KeyValue } from '@/components/ui/key-value';
import type { UserView } from '@/lib/api/types';
import { countryName, flagOf } from '@/lib/countries';

/** One person at a glance: who they are, how to reach them and where they are. */
export function UserDetailsDialog({
  user,
  onClose,
}: {
  user: UserView | null;
  onClose: () => void;
}) {
  const t = useTranslations('users');
  const tp = useTranslations('profile');
  const ta = useTranslations('auth');
  const locale = useLocale();

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby="user-details-text">
        {user ? (
          <>
            <div className="flex items-center gap-4 pe-8">
              <Avatar name={user.fullName} src={user.photoUrl} size="lg" decorative />
              <div className="min-w-0">
                <DialogTitle className="truncate text-xl">{user.fullName}</DialogTitle>
                <DialogDescription id="user-details-text" className="mt-1 flex flex-wrap gap-2">
                  <Badge>{tp(`roles.${user.role}`)}</Badge>
                  <Badge tone={user.status === 'ACTIVE' ? 'success' : 'muted'}>
                    {user.status === 'ACTIVE' ? t('active') : t('disabled')}
                  </Badge>
                </DialogDescription>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-xl bg-primary-soft p-4">
              <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm text-muted">{t('location')}</p>
                <p className="font-semibold text-ink">
                  {user.country
                    ? `${flagOf(user.country)} ${countryName(user.country, locale)}${user.city ? ` · ${user.city}` : ''}`
                    : t('notSet')}
                </p>
              </div>
            </div>

            <KeyValue
              className="mt-5"
              columns={2}
              items={[
                { label: t('phone'), value: user.phone },
                { label: t('email'), value: user.email },
                {
                  label: t('gender'),
                  value: user.gender ? ta(user.gender === 'MALE' ? 'male' : 'female') : null,
                },
                { label: t('joined'), value: formatDate(user.createdAt) },
                {
                  label: t('lastSeen'),
                  value: user.lastSignInAt ? formatDateTime(user.lastSignInAt) : t('never'),
                },
              ]}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
