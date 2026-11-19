'use client';

import {
  aboutContentSchema,
  contactContentSchema,
  helpContentSchema,
  homeContentSchema,
} from '@natik/shared';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import type { ZodType } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button, IconButton } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormActions } from '@/components/ui/form-field';
import { SelectField } from '@/components/ui/select';
import { TextareaField, TextField } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { saveSite } from '@/lib/admin-save';
import { useErrorMessage } from '@/lib/api/client';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

type Values = Record<string, string | undefined>;

/** One saved block of text (Home, About or Contact). Empty fields fall back to the built-in wording. */
function TextBlockForm({
  siteKey,
  schema,
  initial,
  children,
}: {
  siteKey: 'home' | 'about' | 'contact' | 'help';
  schema: ZodType;
  initial: Values;
  children: (state: {
    values: Values;
    set: (name: string, value: string) => void;
    errors: FieldErrors;
  }) => React.ReactNode;
}) {
  const t = useTranslations('websiteEditor');
  const errorMessage = useErrorMessage();
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Goes back to the built-in wording for this block. */
  async function reset() {
    setBusy(true);
    try {
      await saveSite(`/admin/site/${siteKey}`, { method: 'DELETE' });
      setValues({});
      setErrors({});
      setFormError(null);
      toast.success(t('resetDone'));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const { data, errors: found } = validate(schema, values);
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      await saveSite(`/admin/site/${siteKey}`, { method: 'PUT', json: data });
      toast.success(t('saved'));
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {formError && Object.keys(errors).length === 0 ? (
        <Alert tone="danger">{formError}</Alert>
      ) : null}
      {children({
        values,
        set: (name, value) => setValues((v) => ({ ...v, [name]: value })),
        errors,
      })}
      <FormActions>
        <Button type="submit" loading={busy}>
          {t('save')}
        </Button>
        <Button type="button" variant="ghost" onClick={reset} disabled={busy}>
          {t('reset')}
        </Button>
      </FormActions>
    </form>
  );
}

export function HomeTab({
  initial,
  defaults,
}: {
  initial: Values;
  defaults: { eyebrow: string; title: string; subtitle: string };
}) {
  const t = useTranslations('websiteEditor');
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{t('heroTitle')}</CardTitle>
        <CardDescription>{t('heroHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <TextBlockForm siteKey="home" schema={homeContentSchema} initial={initial}>
          {({ values, set, errors }) => (
            <>
              <TextField
                label={t('heroEyebrow')}
                optional
                placeholder={defaults.eyebrow}
                value={values.heroEyebrow ?? ''}
                onChange={(e) => set('heroEyebrow', e.target.value)}
                error={errors.heroEyebrow}
                maxLength={60}
              />
              <TextField
                label={t('heroHeadline')}
                placeholder={defaults.title}
                value={values.heroTitle ?? ''}
                onChange={(e) => set('heroTitle', e.target.value)}
                error={errors.heroTitle}
                maxLength={90}
              />
              <TextareaField
                label={t('heroSubtitle')}
                placeholder={defaults.subtitle}
                value={values.heroSubtitle ?? ''}
                onChange={(e) => set('heroSubtitle', e.target.value)}
                error={errors.heroSubtitle}
                rows={3}
                maxLength={200}
              />
            </>
          )}
        </TextBlockForm>
      </CardContent>
    </Card>
  );
}

export function AboutTab({ initial, defaultMission }: { initial: Values; defaultMission: string }) {
  const t = useTranslations('websiteEditor');
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{t('aboutTitle')}</CardTitle>
        <CardDescription>{t('aboutHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <TextBlockForm siteKey="about" schema={aboutContentSchema} initial={initial}>
          {({ values, set, errors }) => (
            <TextareaField
              label={t('mission')}
              value={values.mission ?? defaultMission}
              onChange={(e) => set('mission', e.target.value)}
              error={errors.mission}
              rows={6}
              maxLength={800}
            />
          )}
        </TextBlockForm>
      </CardContent>
    </Card>
  );
}

export function ContactTab({ initial }: { initial: Values }) {
  const t = useTranslations('websiteEditor');
  const field = (
    name: string,
    label: string,
    values: Values,
    set: (n: string, v: string) => void,
    errors: FieldErrors,
    extra: { hint?: string; type?: string; placeholder?: string } = {},
  ) => (
    <TextField
      key={name}
      label={label}
      optional
      hint={extra.hint}
      type={extra.type}
      placeholder={extra.placeholder}
      value={values[name] ?? ''}
      onChange={(e) => set(name, e.target.value)}
      error={errors[name]}
      autoComplete="off"
    />
  );
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{t('contactTitle')}</CardTitle>
        <CardDescription>{t('contactHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <TextBlockForm siteKey="contact" schema={contactContentSchema} initial={initial}>
          {({ values, set, errors }) => (
            <>
              {field('phone', t('phone'), values, set, errors, { placeholder: '+251 11 123 4567' })}
              {field('email', t('email'), values, set, errors, { type: 'email' })}
              {field('address', t('address'), values, set, errors)}
              {field('hours', t('hours'), values, set, errors, { placeholder: t('hoursExample') })}
              {field('mapUrl', t('mapUrl'), values, set, errors, {
                hint: t('mapHint'),
                placeholder: 'https://maps.google.com/…',
              })}
              <fieldset className="flex flex-col gap-5">
                <legend className="mb-2 font-semibold text-ink">{t('socials')}</legend>
                {field('telegram', t('telegramChannel'), values, set, errors, {
                  placeholder: 'https://t.me/…',
                })}
                {field('telegramContact', t('telegramContact'), values, set, errors, {
                  hint: t('telegramContactHint'),
                  placeholder: '@Natikfluency',
                })}
                {field('facebook', 'Facebook', values, set, errors, {
                  placeholder: 'https://facebook.com/…',
                })}
                {field('instagram', 'Instagram', values, set, errors, {
                  placeholder: 'https://instagram.com/…',
                })}
                {field('tiktok', 'TikTok', values, set, errors, {
                  placeholder: 'https://tiktok.com/@…',
                })}
                {field('youtube', 'YouTube', values, set, errors, {
                  placeholder: 'https://youtube.com/…',
                })}
              </fieldset>
            </>
          )}
        </TextBlockForm>
      </CardContent>
    </Card>
  );
}

interface Choice {
  id: string;
  title: string;
}

/** Which published courses are featured on the home page, and in what order. */
export function FeaturedTab({
  initialFeatured,
  choices,
}: {
  initialFeatured: Choice[];
  choices: Choice[];
}) {
  const t = useTranslations('websiteEditor');
  const errorMessage = useErrorMessage();
  const [featured, setFeatured] = useState(initialFeatured);
  const [toAdd, setToAdd] = useState('');
  const [busy, setBusy] = useState(false);

  const available = choices.filter((c) => !featured.some((f) => f.id === c.id));

  async function persist(next: Choice[]) {
    const previous = featured;
    setFeatured(next);
    setBusy(true);
    try {
      await saveSite('/admin/featured-courses', {
        method: 'PUT',
        json: { ids: next.map((c) => c.id) },
      });
      toast.success(t('saved'));
    } catch (error) {
      setFeatured(previous);
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= featured.length) return;
    const next = [...featured];
    [next[index], next[target]] = [next[target]!, next[index]!];
    void persist(next);
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{t('featuredTitle')}</CardTitle>
        <CardDescription>{t('featuredHint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {featured.length === 0 ? (
          <p className="text-muted">{t('featuredEmpty')}</p>
        ) : (
          <ol className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {featured.map((course, index) => (
              <li key={course.id} className="flex items-center gap-1 px-3 py-1">
                <span className="w-6 text-sm text-muted tabular-nums">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{course.title}</span>
                <IconButton
                  label={t('moveUp')}
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp />
                </IconButton>
                <IconButton
                  label={t('moveDown')}
                  disabled={busy || index === featured.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown />
                </IconButton>
                <IconButton
                  label={t('removeFeatured', { title: course.title })}
                  disabled={busy}
                  onClick={() => persist(featured.filter((f) => f.id !== course.id))}
                >
                  <X />
                </IconButton>
              </li>
            ))}
          </ol>
        )}
        {available.length > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <SelectField
                label={t('addCourse')}
                value={toAdd}
                onChange={(e) => setToAdd(e.target.value)}
                placeholder={t('chooseCourse')}
                options={available.map((c) => ({ value: c.id, label: c.title }))}
              />
            </div>
            <Button
              variant="secondary"
              disabled={!toAdd || busy}
              onClick={() => {
                const course = available.find((c) => c.id === toAdd);
                if (course) {
                  setToAdd('');
                  void persist([...featured, course]);
                }
              }}
            >
              <Plus aria-hidden /> {t('add')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** The how-to videos students and teachers see in their Help tab. */
export function HelpTab({ initial }: { initial: Values }) {
  const t = useTranslations('websiteEditor');
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{t('helpTitle')}</CardTitle>
        <CardDescription>{t('helpHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <TextBlockForm siteKey="help" schema={helpContentSchema} initial={initial}>
          {({ values, set, errors }) => (
            <>
              <TextField
                label={t('studentVideo')}
                optional
                hint={t('studentVideoHint')}
                placeholder="https://www.youtube.com/watch?v=…"
                value={values.studentVideoUrl ?? ''}
                onChange={(e) => set('studentVideoUrl', e.target.value)}
                error={errors.studentVideoUrl}
                autoComplete="off"
              />
              <TextField
                label={t('teacherVideo')}
                optional
                hint={t('teacherVideoHint')}
                placeholder="https://www.youtube.com/watch?v=…"
                value={values.teacherVideoUrl ?? ''}
                onChange={(e) => set('teacherVideoUrl', e.target.value)}
                error={errors.teacherVideoUrl}
                autoComplete="off"
              />
            </>
          )}
        </TextBlockForm>
      </CardContent>
    </Card>
  );
}
