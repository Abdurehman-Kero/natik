'use client';

import { externalVideoSchema } from '@natik/shared';
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
import { TextField } from '@/components/ui/input';
import { useErrorMessage } from '@/lib/api/client';
import { apiFieldErrors, validate } from '@/lib/forms';

/** Add a video that is on YouTube or Vimeo, by its link. Nothing is uploaded. */
export function VideoLinkDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (input: { title: string; url: string }) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations('lessonEditor');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { data, errors: found } = validate(externalVideoSchema, { title, url });
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      await onSubmit(data);
      onClose();
    } catch (error) {
      const fields = apiFieldErrors(error);
      setErrors({ url: fields.url ?? errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{t('videoLink.title')}</DialogTitle>
        <DialogDescription>{t('videoLink.text')}</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4">
          <TextField
            label={t('videoLink.urlLabel')}
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={errors.url}
            autoFocus
          />
          <TextField
            label={t('videoLink.titleLabel')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            maxLength={120}
          />
          <Alert tone="info">{t('videoLink.warning')}</Alert>
          <FormActions>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                {tc('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              {t('videoLink.add')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
