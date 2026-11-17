'use client';

import { questionInputSchema } from '@natik/shared';
import { ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, IconButton } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FormActions, FormField } from '@/components/ui/form-field';
import { TextareaField, TextField } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { BuilderQuestion, QuestionType } from '@/lib/api/quiz-types';
import { uploadFile } from '@/lib/api/upload';
import type { UploadedFile } from '@/lib/api/types';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';
import { cn } from '@/lib/cn';

export interface QuestionDialogProps {
  quizId: string;
  courseId: string;
  /** Text direction and language of the course, so Arabic questions are typed right to left. */
  dir: 'ltr' | 'rtl';
  lang: string;
  /** Editing this question, or adding one of this type. */
  target: { question: BuilderQuestion } | { type: QuestionType } | null;
  onClose: () => void;
  onSaved: (question: BuilderQuestion) => void;
}

export function QuestionDialog(props: QuestionDialogProps) {
  const { target, onClose } = props;
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {target ? <QuestionForm {...props} target={target} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function QuestionForm({
  quizId,
  courseId,
  dir,
  lang,
  target,
  onClose,
  onSaved,
}: QuestionDialogProps & { target: NonNullable<QuestionDialogProps['target']> }) {
  const t = useTranslations('quizBuilder');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const existing = 'question' in target ? target.question : null;
  const type: QuestionType = existing ? existing.type : (target as { type: QuestionType }).type;

  const [text, setText] = useState(existing?.text ?? '');
  const [marks, setMarks] = useState(String(existing?.marks ?? 1));
  const [explanation, setExplanation] = useState(existing?.explanation ?? '');
  const [options, setOptions] = useState<string[]>(
    existing?.options?.map((o) => o.text) ?? ['', '', ''],
  );
  const [correctIndex, setCorrectIndex] = useState(existing?.correctIndex ?? 0);
  const [correctValue, setCorrectValue] = useState<boolean>(existing?.correctValue ?? true);
  const [accepted, setAccepted] = useState<string[]>(
    existing?.acceptedAnswers?.length ? existing.acceptedAnswers : [''],
  );
  const [modelAnswer, setModelAnswer] = useState(existing?.modelAnswer ?? '');
  const [media, setMedia] = useState<{ id: string; url: string } | null>(
    existing?.mediaFileId && existing.mediaUrl
      ? { id: existing.mediaFileId, url: existing.mediaUrl }
      : null,
  );
  const [uploading, setUploading] = useState<number | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickPicture(file: File | undefined) {
    if (!file) return;
    setUploading(0);
    try {
      const uploaded = await uploadFile<UploadedFile>(
        '/files',
        file,
        { purpose: 'QUESTION_MEDIA', courseId },
        (percent) => setUploading(percent),
      ).promise;
      setMedia({ id: uploaded.id, url: uploaded.url });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function build(): unknown {
    const base = {
      type,
      text,
      marks,
      explanation,
      mediaFileId: media?.id ?? null,
    };
    switch (type) {
      case 'MULTIPLE_CHOICE':
        return { ...base, options: options.map((o) => ({ text: o })), correctIndex };
      case 'TRUE_FALSE':
        return { ...base, correctValue };
      case 'FILL_BLANK':
        return { ...base, acceptedAnswers: accepted.map((a) => a.trim()).filter(Boolean) };
      default:
        return { ...base, modelAnswer };
    }
  }

  /** The schema reports "options.1.text"; show it on that option's field. */
  function fieldErrors(found: FieldErrors): FieldErrors {
    return found;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const payload = build();
    const { errors: found } = validate(questionInputSchema, payload);
    if (Object.keys(found).length > 0) {
      setErrors(fieldErrors(found));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = await api<BuilderQuestion>(
        existing
          ? `/teach/quizzes/${quizId}/questions/${existing.id}`
          : `/teach/quizzes/${quizId}/questions`,
        { method: existing ? 'PUT' : 'POST', json: payload },
      );
      toast.success(t('saved'));
      onSaved(saved);
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <>
      <DialogTitle>{existing ? t('editTitle') : t('addTitle')}</DialogTitle>
      <DialogDescription>{t(`type.${type}`)}</DialogDescription>
      <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-5">
        {formError && Object.keys(errors).length === 0 ? (
          <Alert tone="danger">{formError}</Alert>
        ) : null}

        <TextareaField
          label={t('questionText')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          error={errors.text}
          rows={3}
          maxLength={1000}
          dir={dir}
          lang={lang}
          autoFocus
        />

        {type === 'MULTIPLE_CHOICE' ? (
          <FormField label={t('options')} group error={errors.options ?? errors.correctIndex}>
            <ul className="flex flex-col gap-3">
              {options.map((option, index) => (
                <li key={index} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIndex === index}
                    onChange={() => setCorrectIndex(index)}
                    aria-label={t('correctOption', { n: index + 1 })}
                    className="mt-3.5 size-5 shrink-0 accent-[var(--color-primary)]"
                  />
                  <div className="min-w-0 flex-1">
                    <TextField
                      label={t('optionN', { n: index + 1 })}
                      hideLabel
                      placeholder={t('optionN', { n: index + 1 })}
                      value={option}
                      onChange={(e) =>
                        setOptions((list) => list.map((o, i) => (i === index ? e.target.value : o)))
                      }
                      error={errors[`options.${index}.text`]}
                      maxLength={200}
                      dir={dir}
                      lang={lang}
                    />
                  </div>
                  {options.length > 2 ? (
                    <IconButton
                      label={t('removeOption', { n: index + 1 })}
                      onClick={() => {
                        setOptions((list) => list.filter((_, i) => i !== index));
                        setCorrectIndex((c) => (c === index ? 0 : c > index ? c - 1 : c));
                      }}
                    >
                      <X />
                    </IconButton>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">{t('correctGroup')}</p>
            {options.length < 6 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setOptions((list) => [...list, ''])}
              >
                <Plus aria-hidden /> {t('addOption')}
              </Button>
            ) : null}
          </FormField>
        ) : null}

        {type === 'TRUE_FALSE' ? (
          <FormField label={t('answerIs')} group error={errors.correctValue}>
            <div className="flex gap-3">
              {[true, false].map((value) => (
                <label
                  key={String(value)}
                  className={cn(
                    'flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border px-4 font-semibold',
                    correctValue === value
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border bg-surface',
                  )}
                >
                  <input
                    type="radio"
                    name="tf"
                    className="sr-only"
                    checked={correctValue === value}
                    onChange={() => setCorrectValue(value)}
                  />
                  {value ? t('true') : t('false')}
                </label>
              ))}
            </div>
          </FormField>
        ) : null}

        {type === 'FILL_BLANK' ? (
          <FormField
            label={t('acceptedAnswers')}
            hint={t('acceptedHint')}
            group
            error={errors.acceptedAnswers}
          >
            <ul className="flex flex-col gap-3">
              {accepted.map((answer, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <TextField
                      label={t('answerN', { n: index + 1 })}
                      hideLabel
                      placeholder={t('answerN', { n: index + 1 })}
                      value={answer}
                      onChange={(e) =>
                        setAccepted((list) =>
                          list.map((a, i) => (i === index ? e.target.value : a)),
                        )
                      }
                      error={errors[`acceptedAnswers.${index}`]}
                      maxLength={200}
                      dir={dir}
                      lang={lang}
                    />
                  </div>
                  {accepted.length > 1 ? (
                    <IconButton
                      label={t('removeAnswer', { n: index + 1 })}
                      onClick={() => setAccepted((list) => list.filter((_, i) => i !== index))}
                    >
                      <X />
                    </IconButton>
                  ) : null}
                </li>
              ))}
            </ul>
            {accepted.length < 10 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setAccepted((list) => [...list, ''])}
              >
                <Plus aria-hidden /> {t('addAnswer')}
              </Button>
            ) : null}
          </FormField>
        ) : null}

        {type === 'SHORT_ANSWER' ? (
          <TextareaField
            label={t('modelAnswer')}
            hint={t('modelHint')}
            optional
            value={modelAnswer}
            onChange={(e) => setModelAnswer(e.target.value)}
            error={errors.modelAnswer}
            rows={2}
            maxLength={2000}
            dir={dir}
            lang={lang}
          />
        ) : null}

        <TextField
          label={t('marks')}
          hint={t('marksHint')}
          value={marks}
          onChange={(e) => setMarks(e.target.value)}
          error={errors.marks}
          inputMode="decimal"
          autoComplete="off"
        />

        <FormField label={t('picture')} hint={t('pictureHint')} optional group>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label={t('addPicture')}
            onChange={(e) => void pickPicture(e.target.files?.[0])}
          />
          {media ? (
            <div className="flex items-center gap-3 rounded-xl border border-border p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={media.url} alt="" className="size-16 rounded-lg object-cover" />
              <span className="flex-1" />
              <IconButton label={t('removePicture')} onClick={() => setMedia(null)}>
                <Trash2 />
              </IconButton>
            </div>
          ) : null}
          {uploading !== null ? (
            <ProgressBar value={uploading} size="sm" label={t('uploading')} />
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus aria-hidden /> {t('addPicture')}
            </Button>
          )}
        </FormField>

        <TextareaField
          label={t('explanation')}
          hint={t('explanationHint')}
          optional
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          error={errors.explanation}
          rows={2}
          maxLength={1000}
          dir={dir}
          lang={lang}
        />

        <FormActions>
          <Button type="submit" loading={busy}>
            {t('save')}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
        </FormActions>
      </form>
    </>
  );
}
