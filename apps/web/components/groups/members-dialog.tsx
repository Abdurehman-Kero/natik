'use client';

import { useTranslations } from 'next-intl';
import { usePersonCard } from '@/components/people/person-card';
import { Avatar } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { GroupInfo, GroupMember } from '@/lib/groups/types';

function Section({
  title,
  members,
  onPick,
}: {
  title: string;
  members: GroupMember[];
  onPick: (id: string) => void;
}) {
  if (members.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h3 className="px-1 font-sans text-xs font-bold tracking-wider text-muted uppercase">
        {title} · {members.length}
      </h3>
      <ul className="flex flex-col">
        {members.map((m) => (
          <li key={`${m.role}-${m.id}`}>
            {/* Tap a person to see their profile. */}
            <button
              type="button"
              onClick={() => onPick(m.id)}
              className="flex min-h-12 w-full items-center gap-3 rounded-lg px-1 text-start hover:bg-primary-soft/60"
            >
              <Avatar name={m.name} src={m.avatarUrl} size="sm" decorative />
              <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Who is in the group, as a list: the teachers, the Natik team, then the students. */
export function MembersDialog({
  open,
  onOpenChange,
  info,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  info: GroupInfo;
}) {
  const t = useTranslations('groups');
  const card = usePersonCard();
  // The list closes, then the person's card opens (so only one dialog is on screen).
  const pick = (id: string) => {
    onOpenChange(false);
    card.open(id);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('members')}</DialogTitle>
        <DialogDescription>{t('membersText')}</DialogDescription>
        <div className="mt-4 flex max-h-[60dvh] flex-col gap-4 overflow-y-auto">
          <Section
            title={t('teachers')}
            members={info.members.filter((m) => m.role === 'TEACHER')}
            onPick={pick}
          />
          <Section
            title={t('team')}
            members={info.members.filter((m) => m.role === 'ADMIN')}
            onPick={pick}
          />
          <Section
            title={t('students')}
            members={info.members.filter((m) => m.role === 'STUDENT')}
            onPick={pick}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
