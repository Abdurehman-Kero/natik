import type { ReactNode } from 'react';
import { StudentShell } from '@/components/layout/shells';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

/** Student area: signed-in students only. Teachers and admins are sent to their own area. */
export default async function StudentLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(['STUDENT'], '/dashboard');
  const unread = await apiFetch<{ count: number }>('/me/announcements/unread-count')
    .then((r) => r.count)
    .catch(() => 0);
  const chatUnread = await apiFetch<{ count: number }>('/chat/unread-count')
    .then((r) => r.count)
    .catch(() => 0);
  return (
    <StudentShell
      user={{ name: user.fullName, photoUrl: user.photoUrl }}
      unread={unread}
      chatUnread={chatUnread}
    >
      {children}
    </StudentShell>
  );
}
