'use client';

import { courseInputSchema, etbToSantim, santimToEtb, slugify, UPLOAD_LIMITS } from '@natik/shared';
import { Eye, EyeOff, Globe, Trash2, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { RichTextEditor } from '@/components/editor/lazy-rich-text-editor';
import { Alert } from '@/components/ui/alert';
import { Button, LinkButton } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FileDrop } from '@/components/ui/file-drop';
import { FormActions, FormField } from '@/components/ui/form-field';
import { MoneyField, TextareaField, TextField } from '@/components/ui/input';
import { PageHeader, StickyActionBar } from '@/components/ui/layout';
import { RadioCards } from '@/components/ui/radio-cards';
import { SelectField } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type {
  AdminCourseDetail,
  LanguageItem,
  LevelItem,
  RichTextDoc,
  UploadedFile,
} from '@/lib/api/types';
import { uploadFile } from '@/lib/api/upload';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

interface CourseEditorProps {
  course: AdminCourseDetail | null;
  languages: LanguageItem[];
  levels: LevelItem[];
  teachers: { id: string; fullName: string }[];
}

interface ImageState {
  fileId: string | null;
  url: string | null;
}

/** Parses "1,500" or "1500.50" into santim, or null if it isn't a number. */
function parseEtb(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return etbToSantim(Number(cleaned));
}

/** Create and edit a course (FR-ADMIN-003/004). Grouped into cards: Basics, Content, Access, Visibility. */
export function CourseEditor({ course, languages, levels, teachers }: CourseEditorProps) {
  const t = useTranslations('adminCourses');
  const tc = useTranslations('common');
  const ts = useTranslations('status.content');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const editing = course !== null;

  const [title, setTitle] = useState(course?.title ?? '');
  const [slug, setSlug] = useState(course?.slug ?? '');
  const [languageId, setLanguageId] = useState(course?.languageId ?? '');
  const [levelId, setLevelId] = useState(course?.levelId ?? '');
  const [summary, setSummary] = useState(course?.summary ?? '');
  const [description, setDescription] = useState<RichTextDoc | null>(course?.description ?? null);
  const [outcomes, setOutcomes] = useState((course?.outcomes ?? []).join('\n'));
  const [durationText, setDurationText] = useState(course?.durationText ?? '');
  const [access, setAccess] = useState<'FREE' | 'PAID'>(course?.access ?? 'FREE');
  const [price, setPrice] = useState(
    course?.priceSantim ? String(santimToEtb(course.priceSantim)) : '',
  );
  const [accessDays, setAccessDays] = useState(course?.accessDays ? String(course.accessDays) : '');
  const [unlimited, setUnlimited] = useState(course ? course.accessDays === null : false);
  const [featured, setFeatured] = useState(course?.featured ?? false);
  const [showPrice, setShowPrice] = useState(course?.showPrice ?? true);
  const [lessonOrder, setLessonOrder] = useState<'OPEN' | 'IN_ORDER'>(
    course?.lessonOrder ?? 'OPEN',
  );
  const [trailerUrl, setTrailerUrl] = useState(course?.trailerUrl ?? '');
  const [image, setImage] = useState<ImageState>({
    fileId: course?.imageFileId ?? null,
    url: course?.imageUrl ?? null,
  });
  const [imageProgress, setImageProgress] = useState<number | undefined>();
  const [imageError, setImageError] = useState<string | undefined>();

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [teacherIds, setTeacherIds] = useState<string[]>(course?.teachers.map((x) => x.id) ?? []);
  const [teachersBusy, setTeachersBusy] = useState(false);
  const [confirm, setConfirm] = useState<'publish' | 'hide' | 'delete' | null>(null);
  const slugTouched = useRef(editing);
  // Set once the form can take input (until then a pick or a keystroke can be lost); tests wait for it.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => formRef.current?.setAttribute('data-ready', ''), []);

  const language = languages.find((l) => l.id === languageId);

  function onTitle(value: string) {
    setTitle(value);
    if (!slugTouched.current) setSlug(slugify(value));
  }

  async function chooseImage(files: File[]) {
    const file = files[0];
    if (!file) return;
    setImageError(undefined);
    setImageProgress(0);
    try {
      const uploaded = await uploadFile<UploadedFile>(
        '/files',
        file,
        { purpose: 'COURSE_IMAGE' },
        setImageProgress,
      ).promise;
      setImage({ fileId: uploaded.id, url: uploaded.url });
    } catch (error) {
      setImageError(errorMessage(error));
    } finally {
      setImageProgress(undefined);
    }
  }

  function payload() {
    const paid = access === 'PAID';
    return {
      title,
      slug: slug || undefined,
      languageId,
      levelId,
      summary,
      description,
      outcomes: outcomes
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      durationText: durationText.trim() || null,
      access,
      priceSantim: paid ? parseEtb(price) : null,
      accessDays: unlimited || !accessDays.trim() ? null : Number(accessDays),
      featured,
      imageFileId: image.fileId,
      lessonOrder,
      showPrice,
      trailerUrl: trailerUrl.trim() || null,
    };
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setProblems([]);
    const body = payload();
    const found: FieldErrors = {};
    if (access === 'PAID' && body.priceSantim === null) found.priceSantim = t('priceInvalid');
    if (!unlimited && accessDays.trim() && !/^\d+$/.test(accessDays.trim())) {
      found.accessDays = t('daysInvalid');
    }
    const { data, errors: schemaErrors } = validate(courseInputSchema, body);
    const all = { ...schemaErrors, ...found };
    setErrors(all);
    if (!data || Object.keys(all).length > 0) {
      setFormError(t('fixFields'));
      return;
    }

    setBusy(true);
    try {
      if (editing) {
        await api(`/admin/courses/${course.id}`, { method: 'PATCH', json: data });
        toast.success(t('saved'));
        router.refresh();
      } else {
        const created = await api<AdminCourseDetail>('/admin/courses', {
          method: 'POST',
          json: data,
        });
        toast.success(t('created'));
        router.replace(`/admin/courses/${created.id}`);
      }
    } catch (error) {
      handleFailure(error);
    } finally {
      setBusy(false);
    }
  }

  function handleFailure(error: unknown) {
    const fields = apiFieldErrors(error);
    setErrors(fields);
    if (error instanceof ApiError && error.code === 'NOT_READY_TO_PUBLISH') {
      setProblems(Object.values(error.fields ?? {}).flat());
    } else {
      setFormError(errorMessage(error));
    }
  }

  async function transition(kind: 'publish' | 'hide') {
    if (!course) return;
    try {
      await api(`/admin/courses/${course.id}/${kind}`, { method: 'POST' });
      toast.success(kind === 'publish' ? t('publishedToast') : t('hiddenToast'));
      setProblems([]);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NOT_READY_TO_PUBLISH') {
        setProblems(Object.values(error.fields ?? {}).flat());
        setConfirm(null);
        return;
      }
      toast.error(errorMessage(error));
      throw error;
    }
  }

  async function remove() {
    if (!course) return;
    try {
      await api(`/admin/courses/${course.id}`, { method: 'DELETE' });
      toast.success(t('deletedToast'));
      router.replace('/admin/courses');
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  async function saveTeachers() {
    if (!course) return;
    setTeachersBusy(true);
    try {
      await api(`/admin/courses/${course.id}/teachers`, { method: 'PUT', json: { teacherIds } });
      toast.success(t('teachersSaved'));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setTeachersBusy(false);
    }
  }

  const details = (
    <form onSubmit={save} noValidate ref={formRef} className="flex flex-col gap-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('basics')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <TextField
            label={t('courseTitle')}
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            error={errors.title}
            autoComplete="off"
            maxLength={120}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label={t('language')}
              value={languageId}
              onChange={(e) => setLanguageId(e.target.value)}
              placeholder={t('choose')}
              error={errors.languageId}
              options={languages
                .filter((l) => l.active || l.id === course?.languageId)
                .map((l) => ({ value: l.id, label: l.name }))}
            />
            <SelectField
              label={t('level')}
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
              placeholder={t('choose')}
              error={errors.levelId}
              options={levels
                .filter((l) => l.active || l.id === course?.levelId)
                .map((l) => ({ value: l.id, label: l.name }))}
            />
          </div>

          <FormField
            label={t('picture')}
            hint={t('pictureHint')}
            error={imageError ?? errors.imageFileId}
          >
            <div className="flex flex-col gap-3">
              {image.url ? (
                <div className="relative aspect-[3/2] w-full max-w-sm overflow-hidden rounded-xl border border-border bg-primary-soft">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" className="size-full object-cover" />
                </div>
              ) : null}
              <FileDrop
                label={image.url ? t('replacePicture') : t('addPicture')}
                hideLabel
                accept={UPLOAD_LIMITS.image.mimeTypes.join(',')}
                typesLabel="JPG, PNG, WebP"
                maxBytes={UPLOAD_LIMITS.image.maxBytes}
                progress={imageProgress}
                files={[]}
                onFilesChange={chooseImage}
              />
            </div>
          </FormField>

          <TextareaField
            label={t('summary')}
            hint={t('summaryHint')}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            error={errors.summary}
            rows={3}
            maxLength={300}
          />
          {editing ? (
            <TextField
              label={t('slug')}
              hint={t('slugHint')}
              value={slug}
              onChange={(e) => {
                slugTouched.current = true;
                setSlug(e.target.value.toLowerCase());
              }}
              error={errors.slug}
              autoComplete="off"
              spellCheck={false}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('content')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FormField label={t('description')} optional error={errors.description}>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              dir={language?.direction === 'RTL' ? 'rtl' : 'ltr'}
              lang={language?.code}
              label={t('description')}
            />
          </FormField>
          <TextareaField
            label={t('outcomes')}
            hint={t('outcomesHint')}
            optional
            value={outcomes}
            onChange={(e) => setOutcomes(e.target.value)}
            rows={4}
          />
          <TextField
            label={t('duration')}
            hint={t('durationHint')}
            optional
            value={durationText}
            onChange={(e) => setDurationText(e.target.value)}
            maxLength={60}
          />
          <TextField
            label={t('trailer')}
            hint={t('trailerHint')}
            optional
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={trailerUrl}
            onChange={(e) => setTrailerUrl(e.target.value)}
            error={errors.trailerUrl}
          />
          <RadioCards
            label={t('lessonOrder')}
            value={lessonOrder}
            onValueChange={(value) => setLessonOrder(value as 'OPEN' | 'IN_ORDER')}
            options={[
              { value: 'OPEN', label: t('orderOpen') },
              { value: 'IN_ORDER', label: t('orderInOrder') },
            ]}
          />
          <p className="-mt-3 text-sm text-muted">{t('lessonOrderHint')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('accessCard')}</CardTitle>
          <CardDescription>{t('accessHint')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <RadioCards
            label={t('accessType')}
            value={access}
            onValueChange={(value) => setAccess(value as 'FREE' | 'PAID')}
            options={[
              { value: 'FREE', label: tc('free') },
              { value: 'PAID', label: t('paid') },
            ]}
          />
          {access === 'PAID' ? (
            <MoneyField
              label={t('price')}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              error={errors.priceSantim}
            />
          ) : null}
          {access === 'PAID' ? (
            <Switch
              label={t('showPrice')}
              description={t('showPriceHint')}
              checked={showPrice}
              onCheckedChange={setShowPrice}
            />
          ) : null}
          <div className="flex flex-col gap-3">
            <TextField
              label={t('accessDays')}
              hint={t('accessDaysHint')}
              type="text"
              inputMode="numeric"
              value={unlimited ? '' : accessDays}
              onChange={(e) => setAccessDays(e.target.value)}
              disabled={unlimited}
              error={errors.accessDays}
              placeholder={unlimited ? t('unlimited') : '90'}
            />
            <Switch label={t('unlimited')} checked={unlimited} onCheckedChange={setUnlimited} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('visibility')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Switch
            label={t('featured')}
            description={t('featuredHint')}
            checked={featured}
            onCheckedChange={setFeatured}
          />
          {editing ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              {t('currentStatus')} <StatusPill status={`content.${course.status}`} size="sm" />
            </p>
          ) : (
            <p className="text-sm text-muted">{t('newIsDraft', { status: ts('DRAFT') })}</p>
          )}
        </CardContent>
      </Card>

      <StickyActionBar>
        <Button type="submit" loading={busy}>
          {editing ? t('save') : t('create')}
        </Button>
        <LinkButton href="/admin/courses" variant="secondary">
          {tc('cancel')}
        </LinkButton>
      </StickyActionBar>
    </form>
  );

  if (!course) {
    return (
      <>
        <PageHeader title={t('newCourse')} back={{ href: '/admin/courses', label: t('title') }} />
        <div className="max-w-3xl">{details}</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={course.title}
        back={{ href: '/admin/courses', label: t('title') }}
        action={
          <>
            {course.status === 'PUBLISHED' ? (
              <LinkButton href={`/courses/${course.slug}`} variant="secondary">
                <Eye aria-hidden /> {t('viewOnSite')}
              </LinkButton>
            ) : null}
            {course.status === 'PUBLISHED' ? (
              <Button variant="secondary" onClick={() => setConfirm('hide')}>
                <EyeOff aria-hidden /> {t('hide')}
              </Button>
            ) : (
              <Button onClick={() => setConfirm('publish')}>
                <Globe aria-hidden />{' '}
                {course.status === 'HIDDEN' ? t('publishAgain') : t('publish')}
              </Button>
            )}
          </>
        }
      />
      <p className="-mt-3 mb-5 flex flex-wrap items-center gap-3 text-sm text-muted">
        <StatusPill status={`content.${course.status}`} />
        <span>{t('students', { count: course.studentCount })}</span>
      </p>

      {problems.length > 0 ? (
        <Alert tone="warning" className="mb-5">
          <p className="font-semibold">{t('notReady')}</p>
          <ul className="mt-1 list-disc ps-5 font-normal">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t('tabs.details')}</TabsTrigger>
          <TabsTrigger value="content">{t('tabs.content')}</TabsTrigger>
          <TabsTrigger value="teachers">{t('tabs.teachers')}</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="max-w-3xl">{details}</div>
        </TabsContent>

        <TabsContent value="content">
          <Card className="max-w-3xl">
            <CardContent className="flex flex-col gap-4">
              <p className="text-ink">
                {t('contentCounts', { units: course.unitCount, lessons: course.lessonCount })}
              </p>
              <p className="text-muted">{t('contentHint')}</p>
              <div>
                <LinkButton href={`/teach/courses/${course.id}`}>
                  <Wrench aria-hidden /> {t('openContentEditor')}
                </LinkButton>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teachers">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>{t('assignTeachers')}</CardTitle>
              <CardDescription>{t('assignHint')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {teachers.length === 0 ? (
                <EmptyState
                  icon={Wrench}
                  title={t('noTeachers')}
                  description={t('noTeachersText')}
                  action={
                    <LinkButton href="/admin/users" variant="secondary">
                      {t('goToUsers')}
                    </LinkButton>
                  }
                />
              ) : (
                <>
                  <ul className="flex flex-col gap-1">
                    {teachers.map((teacher) => (
                      <li key={teacher.id}>
                        <Checkbox
                          label={teacher.fullName}
                          checked={teacherIds.includes(teacher.id)}
                          onCheckedChange={(checked) =>
                            setTeacherIds((ids) =>
                              checked === true
                                ? [...ids, teacher.id]
                                : ids.filter((id) => id !== teacher.id),
                            )
                          }
                        />
                      </li>
                    ))}
                  </ul>
                  <FormActions>
                    <Button type="button" onClick={saveTeachers} loading={teachersBusy}>
                      {t('saveTeachers')}
                    </Button>
                  </FormActions>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {course.status === 'DRAFT' ? (
        <div className="mt-8 max-w-3xl">
          <Button
            variant="ghost"
            className="text-danger hover:bg-danger-soft"
            onClick={() => setConfirm('delete')}
          >
            <Trash2 aria-hidden /> {t('delete')}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm === 'publish'}
        onOpenChange={(open) => !open && setConfirm(null)}
        tone="primary"
        title={t('publishTitle')}
        description={t('publishText')}
        confirmLabel={t('publish')}
        onConfirm={() => transition('publish')}
      />
      <ConfirmDialog
        open={confirm === 'hide'}
        onOpenChange={(open) => !open && setConfirm(null)}
        tone="primary"
        title={t('hideTitle')}
        description={t('hideText')}
        confirmLabel={t('hide')}
        onConfirm={() => transition('hide')}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('deleteTitle')}
        description={t('deleteText')}
        confirmLabel={t('delete')}
        onConfirm={remove}
      />
    </>
  );
}
