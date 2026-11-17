import type { ReactNode } from 'react';
import { StaffShell } from '@/components/layout/shells';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

const count = (path: string) =>
  apiFetch<{ count: number }>(path)
    .then((r) => r.count)
    .catch(() => 0);

/** Admin area: admins only. The menu shows how many messages, payments and certificates need attention. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(['ADMIN'], '/admin');
  const [messages, payments, marking, chat, certificates] = await Promise.all([
    count('/admin/messages/count'),
    count('/admin/payments/count'),
    count('/teach/marking/count'),
    count('/chat/unread-count'),
    count('/admin/certificate-requests/count'),
  ]);
  return (
    <StaffShell
      area="admin"
      user={{ name: user.fullName, photoUrl: user.photoUrl }}
      badges={{ messages, payments, marking, chat, certificates }}
    >
      {children}
    </StaffShell>
  );
}
