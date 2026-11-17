import type { ReactNode } from 'react';
import { StaffShell } from '@/components/layout/shells';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

const count = (path: string) =>
  apiFetch<{ count: number }>(path)
    .then((r) => r.count)
    .catch(() => 0);

/**
 * Teacher area: teachers, and admins (who have every teacher tool, FR-ADMIN-005). Admins who open a
 * teacher page (Marking, a course editor) keep their own admin menu, so they never lose their place.
 */
export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(['TEACHER', 'ADMIN'], '/teach');
  const shellUser = { name: user.fullName, photoUrl: user.photoUrl };
  if (user.role === 'ADMIN') {
    const [messages, payments, marking, chat] = await Promise.all([
      count('/admin/messages/count'),
      count('/admin/payments/count'),
      count('/teach/marking/count'),
      count('/chat/unread-count'),
    ]);
    return (
      <StaffShell area="admin" user={shellUser} badges={{ messages, payments, marking, chat }}>
        {children}
      </StaffShell>
    );
  }
  const [marking, chat] = await Promise.all([
    count('/teach/marking/count'),
    count('/chat/unread-count'),
  ]);
  return (
    <StaffShell area="teacher" user={shellUser} badges={{ marking, chat }}>
      {children}
    </StaffShell>
  );
}
