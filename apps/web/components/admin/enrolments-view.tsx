'use client';

import { formatDate } from '@natik/shared';
import {
  CalendarPlus,
  Ban,
  EllipsisVertical,
  RotateCcw,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { StudentPicker } from '@/components/admin/student-picker';
import { Alert } from '@/components/ui/alert';
import { Button, IconButton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { FormActions } from '@/components/ui/form-field';
import { TextField } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { ProgressBar } from '@/components/ui/progress';
import { Select, SelectField } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { adminEnrolSchema, extendEnrolmentSchema } from '@natik/shared';
import { api, useErrorMessage } from '@/lib/api/client';
import type { AdminEnrolment, StudentChoice } from '@/lib/api/learn-types';
import type { Paged } from '@/lib/api/types';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

export interface EnrolmentFilters {
  courseId: string;
  status: string;
  studentId: string;
  studentName: string;
}

const STATUSES = [
  'AWAITING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'ACTIVE',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
] as const;

/** Enrolments by course or by student, with the actions an admin needs (FR-ADMIN-006, FR-ADMIN-008). */
export function EnrolmentsView({
  data,
  filters,
  courses,
}: {
  data: Paged<AdminEnrolment>;
  filters: EnrolmentFilters;
  courses: { id: string; title: string }[];
}) {
  const t = useTranslations('adminEnrolments');
  const ts = useTranslations('status.enrolment');
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const errorMessage = useErrorMessage();
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [studentOpen, setStudentOpen] = useState(false);
  const [extending, setExtending] = useState<AdminEnrolment | null>(null);
  const [cancelling, setCancelling] = useState<AdminEnrolment | null>(null);

  function go(changes: Record<string, string>) {
    const next = new URLSearchParams(search.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  async function renew(item: AdminEnrolment) {
    try {
      await api(`/admin/enrolments/${item.id}/renew`, { method: 'POST' });
      toast.success(t('renewed'));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function cancel(reason?: string) {
    if (!cancelling) return;
    try {
      await api(`/admin/enrolments/${cancelling.id}/cancel`, { method: 'POST', json: { reason } });
      toast.success(t('cancelled'));
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

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button onClick={() => setEnrolOpen(true)}>
            <UserPlus aria-hidden /> {t('enrol')}
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          aria-label={t('course')}
          value={filters.courseId}
          onChange={(e) => go({ courseId: e.target.value })}
          placeholder={t('allCourses')}
          options={courses.map((c) => ({ value: c.id, label: c.title }))}
        />
        <Select
          aria-label={t('status')}
          value={filters.status}
          onChange={(e) => go({ status: e.target.value })}
          placeholder={t('allStatuses')}
          options={STATUSES.map((s) => ({ value: s, label: ts(s) }))}
        />
        {filters.studentId ? (
          <Button
            variant="secondary"
            onClick={() => go({ studentId: '', studentName: '' })}
            aria-label={t('clearStudent')}
            className="justify-between"
          >
            <span className="truncate">{filters.studentName || t('student')}</span>
            <X aria-hidden />
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setStudentOpen(true)}>
            <UsersRound aria-hidden /> {t('filterStudent')}
          </Button>
        )}
        <p className="flex items-center text-sm text-muted">{t('total', { count: data.total })}</p>
      </div>

      {data.items.length === 0 ? (
        <Card>
          <EmptyState icon={UsersRound} title={t('emptyTitle')} description={t('emptyText')} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((item) => {
            const lapsed = !!item.endAt && new Date(item.endAt) < new Date();
            const canExtend =
              (item.status === 'ACTIVE' || item.status === 'COMPLETED') && !!item.endAt;
            const canRenew = item.status === 'EXPIRED' || (item.status === 'COMPLETED' && lapsed);
            const canCancel = item.status !== 'COMPLETED' && item.status !== 'CANCELLED';
            return (
              <li key={item.id}>
                <Card>
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{item.student.fullName}</p>
                      <p className="truncate text-sm text-muted">
                        {item.course.title}
                        {item.student.phone ? ` · ${item.student.phone}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
                      <StatusPill status={`enrolment.${item.status}`} size="sm" />
                      {item.status === 'ACTIVE' || item.status === 'COMPLETED' ? (
                        <ProgressBar
                          value={item.progressPct}
                          size="sm"
                          showValue
                          className="w-36"
                        />
                      ) : null}
                      <p className="text-sm text-muted">
                        {item.startAt ? t('from', { date: formatDate(item.startAt) }) : ''}
                        {item.startAt ? ' · ' : ''}
                        {item.endAt ? t('until', { date: formatDate(item.endAt) }) : t('unlimited')}
                      </p>
                      {canExtend || canRenew || canCancel ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton label={t('actions', { name: item.student.fullName })}>
                              <EllipsisVertical />
                            </IconButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canExtend ? (
                              <DropdownMenuItem onSelect={() => setExtending(item)}>
                                <CalendarPlus aria-hidden /> {t('extend')}
                              </DropdownMenuItem>
                            ) : null}
                            {canRenew ? (
                              <DropdownMenuItem onSelect={() => void renew(item)}>
                                <RotateCcw aria-hidden /> {t('renew')}
                              </DropdownMenuItem>
                            ) : null}
                            {canCancel ? (
                              <DropdownMenuItem onSelect={() => setCancelling(item)}>
                                <Ban aria-hidden /> {t('cancel')}
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination className="mt-6" page={data.page} totalPages={totalPages} hrefFor={hrefFor} />

      <EnrolDialog open={enrolOpen} onOpenChange={setEnrolOpen} courses={courses} />
      <StudentFilterDialog
        open={studentOpen}
        onOpenChange={setStudentOpen}
        onPick={(s) => {
          setStudentOpen(false);
          go({ studentId: s.id, studentName: s.fullName });
        }}
      />
      <ExtendDialog item={extending} onClose={() => setExtending(null)} />
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={t('cancelTitle')}
        description={t('cancelText')}
        confirmLabel={t('cancelConfirm')}
        tone="danger"
        requireReason
        reasonLabel={t('cancelReason')}
        onConfirm={cancel}
      />
    </>
  );
}

function StudentFilterDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (student: StudentChoice) => void;
}) {
  const t = useTranslations('adminEnrolments');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('filterStudent')}</DialogTitle>
        <div className="mt-4">
          {open ? <StudentPicker value={null} onChange={(s) => s && onPick(s)} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Enrol a student in a course without payment. */
function EnrolDialog({
  open,
  onOpenChange,
  courses,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: { id: string; title: string }[];
}) {
  const t = useTranslations('adminEnrolments');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [student, setStudent] = useState<StudentChoice | null>(null);
  const [courseId, setCourseId] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const { data, errors: found } = validate(adminEnrolSchema, {
      studentId: student?.id ?? '',
      courseId,
    });
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      await api('/admin/enrolments', { method: 'POST', json: data });
      toast.success(t('enrolled'));
      setStudent(null);
      setCourseId('');
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('enrolTitle')}</DialogTitle>
        <DialogDescription>{t('enrolText')}</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
          {formError && Object.keys(errors).length === 0 ? (
            <Alert tone="danger">{formError}</Alert>
          ) : null}
          <StudentPicker value={student} onChange={setStudent} error={errors.studentId} />
          <SelectField
            label={t('course')}
            hint={t('publishedOnly')}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            placeholder={t('chooseCourse')}
            options={courses.map((c) => ({ value: c.id, label: c.title }))}
            error={errors.courseId}
          />
          <FormActions>
            <Button type="submit" loading={busy}>
              {t('enrolSave')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExtendDialog({ item, onClose }: { item: AdminEnrolment | null; onClose: () => void }) {
  const t = useTranslations('adminEnrolments');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [days, setDays] = useState('30');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!item) return;
    const { data, errors } = validate(extendEnrolmentSchema, { days });
    setError(errors.days);
    if (!data) return;
    setBusy(true);
    try {
      await api(`/admin/enrolments/${item.id}/extend`, { method: 'POST', json: data });
      toast.success(t('extended'));
      onClose();
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{t('extendTitle')}</DialogTitle>
        <DialogDescription>
          {item ? `${item.student.fullName} · ${item.course.title}` : t('extendText')}
        </DialogDescription>
        <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
          <TextField
            label={t('days')}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            inputMode="numeric"
            error={error}
            autoFocus
          />
          <FormActions>
            <Button type="submit" loading={busy}>
              {t('extendSave')}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              {tc('cancel')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
