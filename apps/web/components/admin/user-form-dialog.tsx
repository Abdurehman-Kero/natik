'use client';

import { adminCreateUserSchema, adminUpdateUserSchema, type Role } from '@natik/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormActions } from '@/components/ui/form-field';
import { Textarea, TextField } from '@/components/ui/input';
import { PhoneField } from '@/components/ui/phone-field';
import { RadioCards } from '@/components/ui/radio-cards';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { UserView } from '@/lib/api/types';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

export interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new user. */
  user: UserView | null;
  /** The person using the dialog (decides which roles they may assign). */
  actor: { id: string; isOwner: boolean };
}

/** Create or edit a user in a modal (short form, reached from the list). */
export function UserFormDialog({ open, onOpenChange, user, actor }: UserFormDialogProps) {
  const t = useTranslations('users');
  const ta = useTranslations('auth');
  const tp = useTranslations('profile');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const editing = user !== null;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('STUDENT');
  const [bio, setBio] = useState('');
  const [showOnWebsite, setShowOnWebsite] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Only the Owner assigns the Admin role; nobody changes their own role (BR-ROLE-004).
  const isSelf = user?.id === actor.id;
  const roleLocked = isSelf;
  const roleOptions = (['STUDENT', 'TEACHER', 'ADMIN'] as const).map((value) => ({
    value,
    label: tp(`roles.${value}`),
    disabled: roleLocked || (value === 'ADMIN' && !actor.isOwner),
  }));

  function reset() {
    setFullName(user?.fullName ?? '');
    setPhone('');
    setEmail(user?.email ?? '');
    setRole(user?.role ?? 'STUDENT');
    setBio(user?.bio ?? '');
    setShowOnWebsite(user?.showOnWebsite ?? false);
    setErrors({});
    setFormError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const schema = editing ? adminUpdateUserSchema : adminCreateUserSchema;
    const payload = editing
      ? {
          fullName,
          email: email || undefined,
          ...(roleLocked ? {} : { role }),
          ...(role === 'TEACHER' ? { bio, showOnWebsite } : {}),
        }
      : { fullName, phone, email: email || undefined, role };
    const { data, errors: found } = validate(schema, payload);
    setErrors(found);
    if (!data) return;

    setBusy(true);
    try {
      if (editing) {
        await api(`/admin/users/${user.id}`, { method: 'PATCH', json: data });
        toast.success(t('saved'));
      } else {
        await api('/admin/users', { method: 'POST', json: data });
        toast.success(t('created'));
      }
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PHONE_ALREADY_REGISTERED') {
        setErrors({ phone: errorMessage(error) });
      } else {
        setErrors(apiFieldErrors(error));
        setFormError(errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
        <DialogDescription className={editing ? 'sr-only' : undefined}>
          {editing ? t('editTitle') : t('createHint')}
        </DialogDescription>

        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-5">
          {formError && Object.keys(errors).length === 0 ? (
            <Alert tone="danger">{formError}</Alert>
          ) : null}

          <TextField
            label={ta('fullName')}
            autoComplete="off"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
            autoFocus
          />
          {!editing ? (
            <PhoneField
              label={ta('phone')}
              value={phone}
              onValueChange={setPhone}
              error={errors.phone}
            />
          ) : null}
          <TextField
            label={ta('email')}
            optional
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />

          <RadioCards
            label={t('role')}
            value={role}
            onValueChange={(value) => setRole(value as Role)}
            options={roleOptions}
            error={errors.role}
            hint={!actor.isOwner ? t('onlyOwnerAdmin') : undefined}
          />

          {editing && role === 'TEACHER' ? (
            <>
              <FormField label={t('bio')} optional error={errors.bio}>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={300}
                />
              </FormField>
              <Switch
                label={t('showOnWebsite')}
                description={t('showOnWebsiteHint')}
                checked={showOnWebsite}
                onCheckedChange={setShowOnWebsite}
              />
            </>
          ) : null}

          <FormActions>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                {tc('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              {editing ? tp('save') : t('createCta')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
