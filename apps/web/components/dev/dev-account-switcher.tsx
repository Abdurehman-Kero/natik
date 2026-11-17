'use client';

import { useState } from 'react';
import { api } from '@/lib/api/client';

/**
 * DEVELOPMENT ONLY. A dropdown at the top of the sign-in form: pick a practice account and you are
 * signed in at once. It is only rendered when NODE_ENV is "development" (see sign-in-form.tsx), so it
 * never reaches a production build. To remove it: delete this folder and its line in sign-in-form.tsx.
 */
const ACCOUNTS = [
  { id: 'admin', label: 'Admin (owner)', phone: '+251911000000', password: 'ChangeMe2026' },
  { id: 'teacher', label: 'Teacher', phone: '+251911000001', password: 'Teacher2026' },
  { id: 'student', label: 'Student', phone: '+251911000002', password: 'Student2026' },
] as const;

export function DevAccountSwitcher({ next }: { next: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: string) {
    const account = ACCOUNTS.find((a) => a.id === id);
    if (!account) return;
    setError(null);
    setBusy(true);
    try {
      const result = await api<{ home: string }>('/auth/sign-in', {
        method: 'POST',
        json: { phone: account.phone, password: account.password, keepSignedIn: false },
      });
      // A full page load, so nothing from before stays on screen.
      window.location.href = next ?? result.home;
    } catch {
      setError('Could not sign in. Is the database seeded?');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-dashed border-accent bg-accent/10 p-3">
      <label htmlFor="dev-account" className="text-xs font-semibold tracking-wide uppercase">
        Development only · quick sign-in
      </label>
      <select
        id="dev-account"
        defaultValue=""
        disabled={busy}
        onChange={(e) => void choose(e.target.value)}
        className="min-h-11 rounded-lg border border-border bg-surface px-3"
      >
        <option value="" disabled>
          Sign in as…
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
