import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/client-messages';
import { StaffShell, StudentShell } from '@/components/layout/shells';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

/** Everyone has a profile; it opens inside the shell of their own area. */
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(['STUDENT', 'TEACHER', 'ADMIN'], '/profile');
  const shellUser = { name: user.fullName, photoUrl: user.photoUrl };
  if (user.role === 'STUDENT') {
    const unread = await apiFetch<{ count: number }>('/me/announcements/unread-count')
      .then((r) => r.count)
      .catch(() => 0);
    return (
      <ClientMessages area="profile">
        <StudentShell user={shellUser} unread={unread}>
          {children}
        </StudentShell>
      </ClientMessages>
    );
  }
  return (
    <ClientMessages area="profile">
      <StaffShell area={user.role === 'ADMIN' ? 'admin' : 'teacher'} user={shellUser}>
        {children}
      </StaffShell>
    </ClientMessages>
  );
}
