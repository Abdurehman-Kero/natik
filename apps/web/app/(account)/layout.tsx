import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/client-messages';
import { AccountShell } from '@/components/layout/shells';

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <ClientMessages area="account">
      <AccountShell>{children}</AccountShell>
    </ClientMessages>
  );
}
