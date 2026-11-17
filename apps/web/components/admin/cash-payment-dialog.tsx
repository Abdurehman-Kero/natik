'use client';

import { cashPaymentSchema } from '@natik/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';
import { StudentPicker } from '@/components/admin/student-picker';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FormActions } from '@/components/ui/form-field';
import { TextField } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { StudentChoice } from '@/lib/api/learn-types';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

interface PaidCourse {
  id: string;
  title: string;
  access: 'FREE' | 'PAID';
  priceSantim: number | null;
}

const todayInEat = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa' }).format(new Date());

/** Money received at the centre: recorded as confirmed, and the student gets access straight away. */
export function CashPaymentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <CashForm onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CashForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations('adminPayments');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [courses, setCourses] = useState<PaidCourse[] | null>(null);
  const [student, setStudent] = useState<StudentChoice | null>(null);
  const [courseId, setCourseId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(todayInEat);
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    // The public list holds every published course (up to 200), which is all cash can be taken for.
    api<{ items: PaidCourse[] }>('/public/courses')
      .then((res) => active && setCourses(res.items.filter((c) => c.access === 'PAID')))
      .catch(() => active && setCourses([]));
    return () => {
      active = false;
    };
  }, []);

  function chooseCourse(id: string) {
    setCourseId(id);
    const course = courses?.find((c) => c.id === id);
    if (course?.priceSantim) setAmount(String(course.priceSantim / 100));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const { data, errors: found } = validate(cashPaymentSchema, {
      studentId: student?.id ?? '',
      courseId,
      amount,
      paidOn,
      reference,
    });
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      await api('/admin/payments/cash', {
        method: 'POST',
        json: { studentId: data.studentId, courseId, amount, paidOn, reference },
      });
      toast.success(t('cashSaved'));
      router.refresh();
      onClose();
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <>
      <DialogTitle>{t('cashTitle')}</DialogTitle>
      <DialogDescription>{t('cashText')}</DialogDescription>
      <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
        {formError && Object.keys(errors).length === 0 ? (
          <Alert tone="danger">{formError}</Alert>
        ) : null}
        <StudentPicker value={student} onChange={setStudent} error={errors.studentId} />
        <SelectField
          label={t('course')}
          value={courseId}
          onChange={(e) => chooseCourse(e.target.value)}
          placeholder={courses && courses.length === 0 ? t('noPaidCourses') : t('chooseCourse')}
          options={(courses ?? []).map((c) => ({ value: c.id, label: c.title }))}
          error={errors.courseId}
        />
        <TextField
          label={t('amount')}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          error={errors.amount}
          autoComplete="off"
        />
        <TextField
          label={t('paidOnLabel')}
          type="date"
          value={paidOn}
          max={todayInEat()}
          onChange={(e) => setPaidOn(e.target.value)}
          error={errors.paidOn}
        />
        <TextField
          label={t('cashReference')}
          hint={t('cashReferenceHint')}
          optional
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          error={errors.reference}
          autoComplete="off"
        />
        <FormActions>
          <Button type="submit" loading={busy}>
            {t('cashSave')}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
        </FormActions>
      </form>
    </>
  );
}
