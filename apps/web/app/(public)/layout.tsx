import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/client-messages';
import { PublicShell } from '@/components/layout/shells';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <ClientMessages area="public">
      <PublicShell>{children}</PublicShell>
    </ClientMessages>
  );
}
