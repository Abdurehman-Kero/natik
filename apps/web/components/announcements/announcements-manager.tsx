'use client';

import { announcementInputSchema, formatDateTime } from '@natik/shared';
import { CalendarClock, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormActions } from '@/components/ui/form-field';
import { Input, TextareaField, TextField } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { PageHeader } from '@/components/ui/layout';
import { RadioCards } from '@/components/ui/radio-cards';
import { SelectField } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { saveSite } from '@/lib/admin-save';
import { api, useErrorMessage } from '@/lib/api/client';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

export type Audience = 'PUBLIC' | 'ALL_STUDENTS' | 'COURSE';

export interface AnnouncementRow {
  id: string;
  title: string;
  text: string;
  audience: Audience;
  course: { id: string; title: string } | null;
  author: string;
  publishAt: string;
  scheduled: boolean;
}

export interface AnnouncementsData {
  items: AnnouncementRow[];
  courses: { id: string; title: string }[];
}

/** `datetime-local` input value (local time) from an ISO time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Admin changes also refresh the public News page at once; teachers' course posts are not public. */
function sender(mode: 'admin' | 'teacher') {
  return <T,>(path: string, init: { method: 'POST' | 'PATCH' | 'DELETE'; json?: unknown }) =>
    mode === 'admin' ? saveSite<T>(path, init) : api<T>(path, init);
}

/**
 * Post and manage announcements (FR-NOTIF-001). Admins choose Public, All students or One course.
 * Teachers can only post to one of their own courses.
 */
export function AnnouncementsManager({
  data,
  mode,
}: {
  data: AnnouncementsData;
  mode: 'admin' | 'teacher';
}) {
  const t = useTranslations('announcements');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const base = mode === 'admin' ? '/admin/announcements' : '/teach/announcements';
  const send = sender(mode);
  const [editing, setEditing] = useState<AnnouncementRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<AnnouncementRow | null>(null);

  const audienceLabel = (row: AnnouncementRow) =>
    row.audience === 'COURSE'
      ? (row.course?.title ?? t('audience.COURSE'))
      : t(`audience.${row.audience}`);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={mode === 'teacher' ? t('teacherHint') : undefined}
        action={
          <Button
            onClick={() => setEditing('new')}
            disabled={data.courses.length === 0 && mode === 'teacher'}
          >
            <Plus aria-hidden /> {t('new')}
          </Button>
        }
      />

      {data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title={mode === 'teacher' && data.courses.length === 0 ? t('noCourses') : t('empty')}
            description={
              mode === 'teacher' && data.courses.length === 0 ? t('noCoursesText') : t('emptyText')
            }
          />
        </Card>
      ) : (
        <ul className="flex max-w-3xl flex-col gap-3">
          {data.items.map((row) => (
            <li key={row.id}>
              <Card className="flex items-start gap-2 p-4 md:p-5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    <span className="break-words">{row.title}</span>
                    <Badge tone={row.audience === 'PUBLIC' ? 'success' : 'primary'}>
                      {audienceLabel(row)}
                    </Badge>
                    {row.scheduled ? (
                      <Badge tone="warning">
                        <CalendarClock className="size-3" aria-hidden /> {t('scheduled')}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-1 line-clamp-3 break-words whitespace-pre-line text-ink/80">
                    {row.text}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {formatDateTime(row.publishAt)} · {row.author}
                  </p>
                </div>
                <div className="flex shrink-0">
                  <IconButton
                    label={t('edit', { title: row.title })}
                    onClick={() => setEditing(row)}
                  >
                    <Pencil />
                  </IconButton>
                  <IconButton
                    label={t('delete', { title: row.title })}
                    onClick={() => setRemoving(row)}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <AnnouncementDialog
          key={editing === 'new' ? 'new' : editing.id}
          mode={mode}
          base={base}
          courses={data.courses}
          row={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('deleteTitle')}
        description={t('deleteText')}
        confirmLabel={t('deleteCta')}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await send(`${base}/${removing.id}`, { method: 'DELETE' });
            toast.success(t('deleted'));
            router.refresh();
          } catch (error) {
            toast.error(errorMessage(error));
            throw error;
          }
        }}
      />
    </>
  );
}

function AnnouncementDialog({
  mode,
  base,
  courses,
  row,
  onClose,
}: {
  mode: 'admin' | 'teacher';
  base: string;
  courses: { id: string; title: string }[];
  row: AnnouncementRow | null;
  onClose: () => void;
}) {
  const t = useTranslations('announcements');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const send = sender(mode);
  const [title, setTitle] = useState(row?.title ?? '');
  const [text, setText] = useState(row?.text ?? '');
  const [audience, setAudience] = useState<Audience>(
    mode === 'teacher' ? 'COURSE' : (row?.audience ?? 'PUBLIC'),
  );
  const [courseId, setCourseId] = useState(
    row?.course?.id ?? (courses.length === 1 ? courses[0]!.id : ''),
  );
  const [publishAt, setPublishAt] = useState(row ? toLocalInput(row.publishAt) : '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const body = {
      title,
      text,
      audience,
      courseId: audience === 'COURSE' ? courseId || undefined : undefined,
      publishAt: publishAt ? new Date(publishAt).toISOString() : undefined,
    };
    const { data, errors: found } = validate(announcementInputSchema, body);
    if (audience === 'COURSE' && !courseId) found.courseId = t('chooseCourse');
    setErrors(found);
    if (!data || Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      if (row) await send(`${base}/${row.id}`, { method: 'PATCH', json: data });
      else await send(base, { method: 'POST', json: data });
      toast.success(row ? t('saved') : t('posted'));
      onClose();
      router.refresh();
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{row ? t('editTitle') : t('newTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('newTitle')}</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-5">
          {formError && Object.keys(errors).length === 0 ? (
            <Alert tone="danger">{formError}</Alert>
          ) : null}
          <TextField
            label={t('titleField')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            maxLength={120}
            autoComplete="off"
            autoFocus
          />
          <TextareaField
            label={t('textField')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={errors.text}
            rows={5}
            maxLength={2000}
          />
          {mode === 'admin' ? (
            <RadioCards
              label={t('audienceField')}
              value={audience}
              onValueChange={(v) => setAudience(v as Audience)}
              options={[
                { value: 'PUBLIC', label: t('audience.PUBLIC') },
                { value: 'ALL_STUDENTS', label: t('audience.ALL_STUDENTS') },
                { value: 'COURSE', label: t('audience.COURSE') },
              ]}
              hint={t(`audienceHint.${audience}`)}
            />
          ) : null}
          {audience === 'COURSE' ? (
            <SelectField
              label={t('courseField')}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              placeholder={t('chooseCourse')}
              options={courses.map((c) => ({ value: c.id, label: c.title }))}
              error={errors.courseId}
            />
          ) : null}
          <FormField
            label={t('publishAtField')}
            optional
            hint={t('publishAtHint')}
            error={errors.publishAt}
          >
            <Input
              type="datetime-local"
              value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)}
            />
          </FormField>
          <FormActions>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                {tc('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              {row ? t('save') : t('post')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
