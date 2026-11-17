'use client';

import { approveCertificateSchema, formatDate } from '@natik/shared';
import { Award, CheckCircle2, Clock, Phone, Undo2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { TextField } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { AdminCertificateRequest, CertificateRequestPage } from '@/lib/api/quiz-types';
import { validate } from '@/lib/forms';
import { refreshCounts } from '@/lib/use-live-counts';

/** Approve: the admin checks the name (and can correct it), then the certificate is numbered and sent. */
function ApproveDialog({
  request,
  onClose,
}: {
  request: AdminCertificateRequest | null;
  onClose: () => void;
}) {
  const t = useTranslations('adminCerts');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (request && shownFor !== request.id) {
    setShownFor(request.id);
    setName(request.nameOnCertificate ?? '');
    setError(undefined);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!request) return;
    const corrected = name.trim() === (request.nameOnCertificate ?? '') ? undefined : name;
    const { data, errors } = validate(approveCertificateSchema, { nameOnCertificate: corrected });
    setError(errors.nameOnCertificate);
    if (!data) return;
    setBusy(true);
    try {
      const done = await api<{ certificate: { number: string } }>(
        `/admin/certificate-requests/${request.id}/approve`,
        { method: 'POST', json: data },
      );
      toast.success(t('approvedToast', { number: done.certificate.number }));
      onClose();
      refreshCounts();
      router.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{t('approveTitle')}</DialogTitle>
        <DialogDescription>
          {request ? t('approveText', { course: request.courseTitle }) : null}
        </DialogDescription>
        <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
          <TextField
            label={t('nameOnCertificate')}
            hint={t('approveHint')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error}
            maxLength={80}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('keep')}
            </Button>
            <Button type="submit" loading={busy}>
              <CheckCircle2 aria-hidden /> {t('approveConfirm')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Certificates on their way (FR-CERT): the ones a student has confirmed wait here for an admin, who
 * approves and sends them, or returns them with a note. The other tabs show who still has to confirm
 * the name and what was sent back.
 */
export function CertificateRequestsView({
  data,
  status,
}: {
  data: CertificateRequestPage;
  status: 'AWAITING_APPROVAL' | 'AWAITING_NAME' | 'RETURNED';
}) {
  const t = useTranslations('adminCerts');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [approving, setApproving] = useState<AdminCertificateRequest | null>(null);
  const [returning, setReturning] = useState<AdminCertificateRequest | null>(null);

  async function sendBack(note?: string) {
    if (!returning) return;
    try {
      await api(`/admin/certificate-requests/${returning.id}/return`, {
        method: 'POST',
        json: { note },
      });
      toast.success(t('returnedToast'));
      refreshCounts();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hrefFor = (page: number) => {
    const next = new URLSearchParams(search.toString());
    next.set('page', String(page));
    return `${pathname}?${next}`;
  };
  const empty = {
    AWAITING_APPROVAL: [t('emptyApproveTitle'), t('emptyApproveText')],
    AWAITING_NAME: [t('emptyWaitingTitle'), t('emptyWaitingText')],
    RETURNED: [t('emptyReturnedTitle'), t('emptyReturnedText')],
  }[status];

  return (
    <>
      {data.items.length === 0 ? (
        <Card>
          <EmptyState icon={Award} title={empty[0]!} description={empty[1]!} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((r) => {
            const differs =
              r.nameOnCertificate !== null &&
              r.nameOnCertificate.trim().toLowerCase() !== r.profileName.trim().toLowerCase();
            return (
              <li key={r.id}>
                <Card>
                  <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <p className="text-sm text-muted">{r.courseTitle}</p>
                      {r.nameOnCertificate ? (
                        <p className="text-xl font-semibold break-words text-ink">
                          {r.nameOnCertificate}
                        </p>
                      ) : (
                        <p className="flex items-center gap-2 font-semibold text-ink">
                          <Clock className="size-4 text-warning" aria-hidden /> {t('noNameYet')}
                        </p>
                      )}
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                        <span>{t('profileName', { name: r.profileName })}</span>
                        {differs ? <Badge tone="warning">{t('differs')}</Badge> : null}
                        {r.studentPhone ? (
                          <span className="inline-flex items-center gap-1" dir="ltr">
                            <Phone className="size-3.5" aria-hidden /> {r.studentPhone}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-muted">
                        {r.completedAt ? t('finished', { date: formatDate(r.completedAt) }) : null}
                        {r.submittedAt
                          ? ` · ${t('sent', { date: formatDate(r.submittedAt) })}`
                          : ''}
                      </p>
                      {r.status === 'RETURNED' && r.adminNote ? (
                        <p className="mt-1 rounded-lg bg-danger-soft px-3 py-1.5 text-sm text-danger">
                          {t('noteShown', { note: r.adminNote })}
                        </p>
                      ) : null}
                    </div>
                    {r.status === 'AWAITING_APPROVAL' ? (
                      <div className="flex flex-wrap gap-2 lg:shrink-0">
                        <Button variant="secondary" onClick={() => setReturning(r)}>
                          <Undo2 aria-hidden /> {t('return')}
                        </Button>
                        <Button onClick={() => setApproving(r)}>
                          <CheckCircle2 aria-hidden /> {t('approve')}
                        </Button>
                      </div>
                    ) : (
                      <Badge tone="muted" className="self-start lg:self-center">
                        {t('waitingForStudent')}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination className="mt-6" page={data.page} totalPages={totalPages} hrefFor={hrefFor} />

      <ApproveDialog request={approving} onClose={() => setApproving(null)} />
      <ConfirmDialog
        open={returning !== null}
        onOpenChange={(open) => !open && setReturning(null)}
        title={t('returnTitle')}
        description={returning ? t('returnText', { name: returning.profileName }) : ''}
        confirmLabel={t('returnConfirm')}
        tone="primary"
        requireReason
        reasonLabel={t('returnNote')}
        onConfirm={sendBack}
      />
    </>
  );
}
