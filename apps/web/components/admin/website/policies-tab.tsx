'use client';

import { policyInputSchema } from '@natik/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { RichTextEditor } from '@/components/editor/lazy-rich-text-editor';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormActions, FormField } from '@/components/ui/form-field';
import { RadioCards } from '@/components/ui/radio-cards';
import { TextField } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { saveSite } from '@/lib/admin-save';
import { useErrorMessage } from '@/lib/api/client';
import type { RichTextDoc } from '@/lib/api/types';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

export interface PolicyState {
  title: string;
  body: RichTextDoc;
  /** True when an admin has saved this page; false while the built-in draft is shown. */
  saved: boolean;
}

/** Privacy notice and Terms. The built-in plain-language draft is the starting point for editing. */
export function PoliciesTab({ initial }: { initial: Record<'privacy' | 'terms', PolicyState> }) {
  const t = useTranslations('websiteEditor');
  const [slug, setSlug] = useState<'privacy' | 'terms'>('privacy');
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <RadioCards
        label={t('policyChoose')}
        value={slug}
        onValueChange={(v) => setSlug(v as 'privacy' | 'terms')}
        options={[
          { value: 'privacy', label: t('privacy') },
          { value: 'terms', label: t('terms') },
        ]}
      />
      <PolicyForm key={slug} slug={slug} initial={initial[slug]} />
    </div>
  );
}

function PolicyForm({ slug, initial }: { slug: 'privacy' | 'terms'; initial: PolicyState }) {
  const t = useTranslations('websiteEditor');
  const errorMessage = useErrorMessage();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState<RichTextDoc>(initial.body);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isSaved, setIsSaved] = useState(initial.saved);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const { data, errors: found } = validate(policyInputSchema, { title, body });
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      await saveSite(`/admin/policies/${slug}`, { method: 'PUT', json: data });
      setIsSaved(true);
      toast.success(t('saved'));
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{slug === 'privacy' ? t('privacy') : t('terms')}</CardTitle>
        <CardDescription>{isSaved ? t('policyEdited') : t('policyDraft')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          {formError && Object.keys(errors).length === 0 ? (
            <Alert tone="danger">{formError}</Alert>
          ) : null}
          <TextField
            label={t('policyTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            maxLength={80}
          />
          <FormField label={t('policyText')} error={errors.body}>
            <RichTextEditor
              value={body}
              onChange={setBody}
              dir="ltr"
              lang="en"
              label={t('policyText')}
              minHeightClass="min-h-80"
            />
          </FormField>
          <FormActions>
            <Button type="submit" loading={busy}>
              {t('save')}
            </Button>
          </FormActions>
        </form>
      </CardContent>
    </Card>
  );
}
