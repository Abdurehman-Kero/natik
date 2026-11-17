'use client';

import { certificateSettingsSchema } from '@natik/shared';
import { Eye, ImagePlus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormActions, FormField } from '@/components/ui/form-field';
import { TextField } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/layout';
import { ProgressBar } from '@/components/ui/progress';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { CertificateSettings } from '@/lib/api/quiz-types';
import type { UploadedFile } from '@/lib/api/types';
import { uploadFile } from '@/lib/api/upload';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

/** Who signs certificates: name, title and an optional signature picture (FR-CERT-003). */
export function CertificateSettingsForm({ initial }: { initial: CertificateSettings }) {
  const t = useTranslations('certSettings');
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(initial.signatoryName);
  const [role, setRole] = useState(initial.signatoryTitle);
  const [signature, setSignature] = useState<{ id: string; url: string } | null>(
    initial.signatureFileId && initial.signatureUrl
      ? { id: initial.signatureFileId, url: initial.signatureUrl }
      : null,
  );
  const [uploading, setUploading] = useState<number | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(0);
    try {
      const uploaded = await uploadFile<UploadedFile>(
        '/files',
        file,
        { purpose: 'SIGNATURE' },
        (p) => setUploading(p),
      ).promise;
      setSignature({ id: uploaded.id, url: uploaded.url });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const values = {
      signatoryName: name,
      signatoryTitle: role,
      signatureFileId: signature?.id ?? null,
    };
    const { data, errors: found } = validate(certificateSettingsSchema, values);
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      await api('/admin/settings/certificate', { method: 'PUT', json: data });
      toast.success(t('saved'));
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        back={{ href: '/admin/settings', label: t('back') }}
      />
      <Card className="max-w-xl">
        <CardContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            {formError && Object.keys(errors).length === 0 ? (
              <Alert tone="danger">{formError}</Alert>
            ) : null}
            <TextField
              label={t('name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.signatoryName}
              maxLength={100}
            />
            <TextField
              label={t('role')}
              hint={t('roleHint')}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              error={errors.signatoryTitle}
              maxLength={100}
            />
            <FormField label={t('signature')} hint={t('signatureHint')} optional group>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                aria-label={t('upload')}
                onChange={(e) => void pick(e.target.files?.[0])}
              />
              {signature ? (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signature.url} alt="" className="max-h-20 max-w-48 object-contain" />
                </div>
              ) : null}
              {uploading !== null ? (
                <ProgressBar value={uploading} size="sm" label={t('uploading')} />
              ) : (
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInput.current?.click()}
                  >
                    <ImagePlus aria-hidden /> {signature ? t('replace') : t('upload')}
                  </Button>
                  {signature ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSignature(null)}
                    >
                      <Trash2 aria-hidden /> {t('remove')}
                    </Button>
                  ) : null}
                </div>
              )}
            </FormField>
            <p className="text-sm text-muted">{t('note')}</p>
            <FormActions>
              <Button type="submit" loading={busy}>
                {t('save')}
              </Button>
              <Button asChild variant="secondary">
                <a href="/api/v1/admin/settings/certificate/preview" target="_blank" rel="noopener">
                  <Eye aria-hidden /> {t('preview')}
                </a>
              </Button>
            </FormActions>
            <p className="text-sm text-muted">{t('previewHint')}</p>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
