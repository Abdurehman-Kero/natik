'use client';

import { bytesToMb, changePasswordSchema, UPLOAD_LIMITS, updateProfileSchema } from '@natik/shared';
import { Camera, KeyRound, LogOut, Pencil, Wallet } from 'lucide-react';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormActions } from '@/components/ui/form-field';
import { TextField } from '@/components/ui/input';
import { KeyValue } from '@/components/ui/key-value';
import { PasswordField } from '@/components/ui/password-field';
import { SelectField } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { UserView } from '@/lib/api/types';
import { flagOf } from '@/lib/countries';
import { useCountryName, useCountryOptions } from '@/lib/use-country-options';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

export function ProfileView({ user }: { user: UserView }) {
  const t = useTranslations('profile');
  const te = useTranslations('errors');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const locale = useLocale();
  const nameOfCountry = useCountryName(locale);
  const ta = useTranslations('auth');
  const fileInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    const limit = UPLOAD_LIMITS.image;
    if (file.size > limit.maxBytes) {
      toast.error(
        te('FILE_TOO_LARGE', { size: bytesToMb(file.size), max: bytesToMb(limit.maxBytes) }),
      );
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('photo', file);
      await api('/me/photo', { method: 'POST', body });
      toast.success(t('photoSaved'));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <>
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <h1 className="text-[1.625rem] leading-tight font-bold md:text-4xl">{t('title')}</h1>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <Avatar
              name={user.fullName}
              src={user.photoUrl}
              size="lg"
              className="size-24 text-2xl"
            />
            <div className="flex flex-col items-center gap-1.5">
              <h2 className="text-xl font-semibold">{user.fullName}</h2>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge>{t(`roles.${user.role}`)}</Badge>
                {user.isOwner ? <Badge tone="accent">Owner</Badge> : null}
              </div>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-label={t('changePhoto')}
              onChange={(e) => uploadPhoto(e.target.files?.[0])}
            />
            <Button
              variant="secondary"
              size="sm"
              loading={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <Camera aria-hidden /> {t('changePhoto')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-5">
            <KeyValue
              items={[
                { label: t('phone'), value: user.phone },
                { label: 'Email', value: user.email },
                {
                  label: t('country'),
                  value: user.country
                    ? `${flagOf(user.country)} ${nameOfCountry(user.country)}`
                    : null,
                },
                { label: t('city'), value: user.city },
                {
                  label: t('gender'),
                  value: user.gender ? ta(user.gender === 'MALE' ? 'male' : 'female') : null,
                },
              ]}
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="secondary"
                className="w-full sm:w-auto sm:flex-1"
                onClick={() => setEditing(true)}
              >
                <Pencil aria-hidden /> {t('edit')}
              </Button>
              <Button
                variant="secondary"
                className="w-full sm:w-auto sm:flex-1"
                onClick={() => setChangingPassword(true)}
              >
                <KeyRound aria-hidden /> {t('changePassword')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {user.role === 'STUDENT' ? (
          <Button asChild variant="secondary" size="lg" fullWidth>
            <Link href="/profile/payments">
              <Wallet aria-hidden /> {t('paymentHistory')}
            </Link>
          </Button>
        ) : null}

        <Button asChild variant="ghost" size="lg" fullWidth>
          <Link href="/sign-out">
            <LogOut aria-hidden /> {t('signOut')}
          </Link>
        </Button>
      </div>

      <EditDetailsDialog user={user} open={editing} onOpenChange={setEditing} />
      <ChangePasswordDialog open={changingPassword} onOpenChange={setChangingPassword} />
    </>
  );
}

function EditDetailsDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('profile');
  const ta = useTranslations('auth');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const locale = useLocale();
  const countries = useCountryOptions(locale, user.country ?? undefined);
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email ?? '');
  const [gender, setGender] = useState<string>(user.gender ?? '');
  const [country, setCountry] = useState(user.country ?? '');
  const [city, setCity] = useState(user.city ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const { data, errors: found } = validate(updateProfileSchema, {
      fullName,
      email: email || undefined,
      gender: gender || null,
      country: country || null,
      city: city.trim() || null,
    });
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      await api('/me', { method: 'PATCH', json: data });
      toast.success(t('saved'));
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setFullName(user.fullName);
          setEmail(user.email ?? '');
          setGender(user.gender ?? '');
          setCountry(user.country ?? '');
          setCity(user.city ?? '');
          setErrors({});
          setFormError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>{t('editTitle')}</DialogTitle>
        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-5">
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <TextField
            label={ta('fullName')}
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
          />
          <TextField
            label={ta('email')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <SelectField
            key={countries.length}
            label={ta('country')}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder={ta('chooseCountry')}
            options={countries}
            error={errors.country}
          />
          <TextField
            label={ta('city')}
            optional
            autoComplete="address-level2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            error={errors.city}
            maxLength={80}
          />
          <SelectField
            label={ta('gender')}
            optional
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            placeholder={ta('chooseOne')}
            options={[
              { value: 'MALE', label: ta('male') },
              { value: 'FEMALE', label: ta('female') },
            ]}
            error={errors.gender}
          />
          <FormActions>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                {tc('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              {t('save')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('profile');
  const ta = useTranslations('auth');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const { data, errors: found } = validate(changePasswordSchema, {
      currentPassword,
      newPassword,
    });
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      await api('/me/password', { method: 'POST', json: data });
      toast.success(t('passwordSaved'));
      onOpenChange(false);
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setCurrent('');
          setNew('');
          setErrors({});
          setFormError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>{t('changeTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('changeTitle')}</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-5">
          {formError && !errors.currentPassword ? <Alert tone="danger">{formError}</Alert> : null}
          <PasswordField
            label={t('current')}
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            error={errors.currentPassword}
          />
          <PasswordField
            label={ta('newPassword')}
            autoComplete="new-password"
            hint={ta('passwordHint')}
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            error={errors.newPassword}
          />
          <FormActions>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                {tc('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              {t('save')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
