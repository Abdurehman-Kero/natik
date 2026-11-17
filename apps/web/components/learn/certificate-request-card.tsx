'use client';

import { certificateNameSchema, formatDate } from '@natik/shared';
import { Clock, GraduationCap, PencilLine, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { MyCertificateRequest } from '@/lib/api/quiz-types';
import { validate } from '@/lib/forms';

/** The name box and its button. Used on the card and in the "Change name" dialog. */
function NameForm({
  request,
  onSent,
  autoFocus,
}: {
  request: MyCertificateRequest;
  onSent: () => void;
  autoFocus?: boolean;
}) {
  const t = useTranslations('certs');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [name, setName] = useState(request.suggestedName);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { data, errors } = validate(certificateNameSchema, { nameOnCertificate: name });
    setError(errors.nameOnCertificate);
    if (!data) return;
    setBusy(true);
    try {
      await api(`/me/certificates/requests/${request.id}/name`, { method: 'PUT', json: data });
      toast.success(t('nameSent'));
      onSent();
      router.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <TextField
        label={t('nameLabel')}
        hint={t('nameHint')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error}
        autoComplete="name"
        maxLength={80}
        autoFocus={autoFocus}
      />
      <Button type="submit" loading={busy} className="self-start">
        <Send aria-hidden /> {t('sendName')}
      </Button>
    </form>
  );
}

/**
 * A finished course whose certificate is on its way: the student writes the name exactly as it should
 * be printed and sends it; the Natik team checks it and sends the certificate. While it waits, the
 * name can still be changed.
 */
export function CertificateRequestCard({ request }: { request: MyCertificateRequest }) {
  const t = useTranslations('certs');
  const [editing, setEditing] = useState(false);
  const waiting = request.status === 'AWAITING_APPROVAL';

  return (
    <Card className={waiting ? undefined : 'border-accent'}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong"
            aria-hidden
          >
            {waiting ? <Clock className="size-6" /> : <GraduationCap className="size-6" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg leading-snug font-semibold">{request.courseTitle}</h2>
            <p className="text-sm text-muted">
              {request.completedAt
                ? t('finished', { date: formatDate(request.completedAt) })
                : t('finishedNoDate')}
            </p>
          </div>
          <Badge tone={waiting ? 'warning' : request.status === 'RETURNED' ? 'danger' : 'accent'}>
            {waiting
              ? t('statusWaiting')
              : request.status === 'RETURNED'
                ? t('statusReturned')
                : t('statusConfirm')}
          </Badge>
        </div>

        {waiting ? (
          <>
            <div className="rounded-xl bg-canvas px-4 py-3">
              <p className="text-sm text-muted">{t('nameOnIt')}</p>
              <p className="text-xl font-semibold break-words text-ink">
                {request.nameOnCertificate}
              </p>
            </div>
            <p className="text-sm text-muted">{t('waitingText')}</p>
            <Button variant="secondary" className="self-start" onClick={() => setEditing(true)}>
              <PencilLine aria-hidden /> {t('changeName')}
            </Button>
            <Dialog open={editing} onOpenChange={setEditing}>
              <DialogContent>
                <DialogTitle>{t('changeNameTitle')}</DialogTitle>
                <DialogDescription>{t('changeNameText')}</DialogDescription>
                <div className="mt-4">
                  <NameForm request={request} onSent={() => setEditing(false)} autoFocus />
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <>
            {request.status === 'RETURNED' && request.adminNote ? (
              <Alert tone="danger">{t('returnedNote', { note: request.adminNote })}</Alert>
            ) : (
              <p className="text-muted">{t('confirmText')}</p>
            )}
            <NameForm request={request} onSent={() => undefined} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
