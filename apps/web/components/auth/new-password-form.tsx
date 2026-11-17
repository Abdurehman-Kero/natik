'use client';

import { setPasswordSchema } from '@natik/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/ui/password-field';
import { api, useErrorMessage } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

/** Choose a new password using a single-use token (from the reset flow or an SMS link). */
export function NewPasswordForm({
  token,
  onDone,
  onInvalidToken,
  saveLabel,
}: {
  token: string;
  onDone: () => void;
  onInvalidToken?: () => void;
  saveLabel: string;
}) {
  const t = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const { data, errors: found } = validate(setPasswordSchema, { token, newPassword: password });
    setErrors({ newPassword: found.newPassword ?? '' });
    if (!data) return;
    setBusy(true);
    try {
      await api('/auth/password/set', { method: 'POST', json: data });
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PASSWORD_LINK_INVALID' && onInvalidToken) {
        onInvalidToken();
        return;
      }
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <PasswordField
        label={t('newPassword')}
        autoComplete="new-password"
        hint={t('passwordHint')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.newPassword || undefined}
        autoFocus
      />
      <Button type="submit" size="lg" fullWidth loading={busy}>
        {saveLabel}
      </Button>
    </form>
  );
}
