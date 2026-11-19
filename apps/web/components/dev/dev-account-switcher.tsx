'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';

/**
 * DEVELOPMENT ONLY. A dropdown at the top of the sign-in form: pick a practice account and its email
 * and password are filled into the form below. Nothing is sent until you press "Sign in". It is only
 * rendered when NODE_ENV is "development" (see sign-in-form.tsx), so it never reaches a production
 * build. To remove it: delete this folder and its line in sign-in-form.tsx.
 */
const ACCOUNTS = [
  { id: 'admin', label: 'Admin (owner)', phone: '+251911000000', password: 'ChangeMe2026' },
  { id: 'teacher', label: 'Teacher', phone: '+251911000001', password: 'Teacher2026' },
  { id: 'student', label: 'Student', phone: '+251911000002', password: 'Student2026' },
] as const;

export function DevAccountSwitcher({
  onPick,
}: {
  onPick: (account: { email: string; password: string }) => void;
}) {
  // The emails come from the local database (they are not written in the code).
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: { phone: string | null; email: string | null }[] }>('/dev/accounts', {
      quiet: true,
    })
      .then((result) => {
        const found: Record<string, string> = {};
        for (const item of result.items)
          if (item.phone && item.email) found[item.phone] = item.email;
        setEmails(found);
      })
      .catch(() => setError('Could not load the practice accounts. Is the database seeded?'));
  }, []);

  function choose(id: string) {
    const account = ACCOUNTS.find((a) => a.id === id);
    if (!account) return;
    setChosen(id);
    const email = emails[account.phone];
    if (!email) {
      setError(`${account.label} has no email yet. Run pnpm db:seed, or add one in Admin › Users.`);
      return;
    }
    setError(null);
    onPick({ email, password: account.password });
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-dashed border-accent bg-accent/10 p-3">
      <label htmlFor="dev-account" className="text-xs font-semibold tracking-wide uppercase">
        Development only · fill in a practice account
      </label>
      <select
        id="dev-account"
        value={chosen}
        onChange={(e) => choose(e.target.value)}
        className="min-h-11 rounded-lg border border-border bg-surface px-3"
      >
        <option value="" disabled>
          Choose an account…
        </option>
        {ACCOUNTS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
      {error ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
