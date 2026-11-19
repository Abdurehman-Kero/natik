import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/client-messages';
import { StudentShell } from '@/components/layout/shells';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

const count = (path: string) =>
  apiFetch<{ count: number }>(path)
    .then((r) => r.count)
    .catch(() => 0);

/** Student area: signed-in students only. Teachers and admins are sent to their own area. */
export default async function StudentLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(['STUDENT'], '/dashboard');
  const [unread, chatUnread, groupsUnread] = await Promise.all([
    count('/me/announcements/unread-count'),
    count('/chat/unread-count'),
    count('/groups/unread-count'),
  ]);
  return (
    <ClientMessages area="student">
      <StudentShell
        user={{ name: user.fullName, photoUrl: user.photoUrl }}
        unread={unread}
        chatUnread={chatUnread}
        groupsUnread={groupsUnread}
      >
        {children}
      </StudentShell>
    </ClientMessages>
  );
}
