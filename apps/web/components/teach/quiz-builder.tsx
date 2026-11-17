'use client';

import { quizSettingsSchema } from '@natik/shared';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CircleHelp,
  Eye,
  ListChecks,
  Pencil,
  Plus,
  SquarePen,
  ToggleLeft,
  Trash2,
  Underline,
} from 'lucide-react';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { QuestionDialog } from '@/components/teach/question-dialog';
import { Alert } from '@/components/ui/alert';
import { Button, IconButton, LinkButton } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormActions } from '@/components/ui/form-field';
import { TextareaField, TextField } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { BuilderQuestion, BuilderQuiz, QuestionType } from '@/lib/api/quiz-types';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

const TYPE_ICON = {
  MULTIPLE_CHOICE: ListChecks,
  TRUE_FALSE: ToggleLeft,
  FILL_BLANK: Underline,
  SHORT_ANSWER: SquarePen,
} as const;
const TYPES: QuestionType[] = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'];

const ATTEMPT_CHOICES = ['', '1', '2', '3', '5', '10'];
const TIME_CHOICES = ['', '5', '10', '15', '20', '30', '45', '60', '90', '120'];

/**
 * The quiz builder: questions on one side, settings on the other (stacked on a phone). Questions can
 * be edited after publishing; students who already started keep the version they began with.
 */
export function QuizBuilder({ initial }: { initial: BuilderQuiz }) {
  const t = useTranslations('quizBuilder');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [quiz, setQuiz] = useState(initial);
  const [questions, setQuestions] = useState(initial.questions);
  const [dialog, setDialog] = useState<
    { question: BuilderQuestion } | { type: QuestionType } | null
  >(null);
  const [choosing, setChoosing] = useState(false);
  const [removing, setRemoving] = useState<BuilderQuestion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const live = quiz.status === 'PUBLISHED';
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  const backHref = `/teach/courses/${quiz.course.id}/lessons/${quiz.lesson.id}`;

  async function setLive(publish: boolean) {
    setBusy(true);
    try {
      const updated = await api<BuilderQuiz>(
        `/teach/quizzes/${quiz.id}/${publish ? 'publish' : 'hide'}`,
        { method: 'POST' },
      );
      setQuiz(updated);
      toast.success(publish ? t('published') : t('hidden'));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= questions.length) return;
    const previous = questions;
    const next = [...questions];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setQuestions(next);
    try {
      await api(`/teach/quizzes/${quiz.id}/questions/order`, {
        method: 'PUT',
        json: { ids: next.map((q) => q.id) },
      });
    } catch (error) {
      setQuestions(previous);
      toast.error(errorMessage(error));
    }
  }

  async function remove() {
    if (!removing) return;
    try {
      await api(`/teach/quizzes/${quiz.id}/questions/${removing.id}`, { method: 'DELETE' });
      setQuestions((list) => list.filter((q) => q.id !== removing.id));
      toast.success(t('removedToast'));
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  async function deleteQuiz() {
    try {
      await api(`/teach/quizzes/${quiz.id}`, { method: 'DELETE' });
      toast.success(t('deleted'));
      router.push(backHref);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  function saved(question: BuilderQuestion) {
    setQuestions((list) =>
      list.some((q) => q.id === question.id)
        ? list.map((q) => (q.id === question.id ? question : q))
        : [...list, question],
    );
    setDialog(null);
  }

  return (
    <>
      <div className="flex flex-col gap-3 pb-6">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-muted hover:text-primary"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t('back')}
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted">{quiz.lesson.title}</p>
            <h1 className="text-[1.625rem] leading-tight font-bold md:text-4xl">{quiz.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={`content.${quiz.status}`} />
            <LinkButton href={`/teach/quizzes/${quiz.id}/preview`} variant="secondary">
              <Eye aria-hidden /> {t('preview')}
            </LinkButton>
            <Button
              loading={busy}
              variant={live ? 'secondary' : 'primary'}
              disabled={!live && questions.length === 0}
              onClick={() => void setLive(!live)}
            >
              {live ? t('hide') : t('publish')}
            </Button>
          </div>
        </div>
        {!live && questions.length === 0 ? <Alert tone="info">{t('needQuestions')}</Alert> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="questions-heading" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="questions-heading" className="text-lg font-semibold">
              {t('questions', { count: questions.length })}
            </h2>
            <p className="text-sm text-muted">{t('totalMarks', { marks: totalMarks })}</p>
          </div>

          {questions.length === 0 ? (
            <Card>
              <EmptyState
                icon={CircleHelp}
                title={t('noQuestionsTitle')}
                description={t('noQuestionsText')}
                action={
                  <Button size="lg" onClick={() => setChoosing(true)}>
                    <Plus aria-hidden /> {t('addQuestion')}
                  </Button>
                }
              />
            </Card>
          ) : (
            <ol className="flex flex-col gap-3">
              {questions.map((q, index) => {
                const Icon = TYPE_ICON[q.type];
                return (
                  <li key={q.id}>
                    <Card>
                      <CardContent className="flex items-start gap-2 p-3 sm:gap-3 sm:p-4">
                        <span
                          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
                          aria-hidden
                        >
                          <Icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-muted">
                            {t('questionLine', {
                              n: index + 1,
                              type: t(`type.${q.type}`),
                              marks: t('marksLabel', { marks: q.marks }),
                            })}
                          </p>
                          <p
                            className="mt-0.5 font-medium break-words"
                            dir={quiz.course.dir}
                            lang={quiz.course.lang}
                          >
                            {q.text}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end">
                          <IconButton
                            label={t('moveUp', { n: index + 1 })}
                            disabled={index === 0}
                            onClick={() => void move(index, -1)}
                          >
                            <ArrowUp />
                          </IconButton>
                          <IconButton
                            label={t('moveDown', { n: index + 1 })}
                            disabled={index === questions.length - 1}
                            onClick={() => void move(index, 1)}
                          >
                            <ArrowDown />
                          </IconButton>
                          <IconButton
                            label={t('edit', { n: index + 1 })}
                            onClick={() => setDialog({ question: q })}
                          >
                            <Pencil />
                          </IconButton>
                          <IconButton
                            label={t('remove', { n: index + 1 })}
                            onClick={() => setRemoving(q)}
                          >
                            <Trash2 />
                          </IconButton>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ol>
          )}

          {questions.length > 0 ? (
            <Button
              variant="secondary"
              size="lg"
              className="self-start"
              onClick={() => setChoosing(true)}
            >
              <Plus aria-hidden /> {t('addQuestion')}
            </Button>
          ) : null}
        </section>

        <aside className="flex flex-col gap-4">
          <SettingsCard quiz={quiz} onSaved={(updated) => setQuiz((q) => ({ ...q, ...updated }))} />
          <Button
            variant="ghost"
            className="self-start text-danger"
            onClick={() => setDeleting(true)}
          >
            <Trash2 aria-hidden /> {t('deleteQuiz')}
          </Button>
        </aside>
      </div>

      <TypeChooser
        open={choosing}
        onOpenChange={setChoosing}
        onChoose={(type) => {
          setChoosing(false);
          setDialog({ type });
        }}
      />
      <QuestionDialog
        quizId={quiz.id}
        courseId={quiz.course.id}
        dir={quiz.course.dir}
        lang={quiz.course.lang}
        target={dialog}
        onClose={() => setDialog(null)}
        onSaved={saved}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('removeTitle')}
        description={t('removeText')}
        confirmLabel={t('removeConfirm')}
        tone="danger"
        onConfirm={remove}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('deleteTitle')}
        description={t('deleteText')}
        confirmLabel={t('deleteConfirm')}
        tone="danger"
        onConfirm={deleteQuiz}
      />
    </>
  );
}

/** Four big tiles, one per question type, in a small dialog (DESIGN: dialogs for short choices). */
function TypeChooser({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (type: QuestionType) => void;
}) {
  const t = useTranslations('quizBuilder');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('chooseType')}</DialogTitle>
        <DialogDescription className="sr-only">{t('addQuestion')}</DialogDescription>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {TYPES.map((type) => {
            const Icon = TYPE_ICON[type];
            return (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => onChoose(type)}
                  className="flex h-full min-h-24 w-full flex-col items-start gap-1.5 rounded-xl border border-border bg-surface p-4 text-left transition hover:border-primary hover:bg-primary-soft"
                >
                  <Icon className="size-6 text-primary" aria-hidden />
                  <span className="font-semibold">{t(`type.${type}`)}</span>
                  <span className="text-sm text-muted">{t(`typeHint.${type}`)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function SettingsCard({
  quiz,
  onSaved,
}: {
  quiz: BuilderQuiz;
  onSaved: (updated: BuilderQuiz) => void;
}) {
  const t = useTranslations('quizBuilder');
  const errorMessage = useErrorMessage();
  const [title, setTitle] = useState(quiz.title);
  const [instructions, setInstructions] = useState(quiz.instructions);
  const [isFinal, setIsFinal] = useState(quiz.isFinal);
  const [passMark, setPassMark] = useState(String(quiz.passMarkPct));
  const [attempts, setAttempts] = useState(
    quiz.maxAttempts === null ? '' : String(quiz.maxAttempts),
  );
  const [minutes, setMinutes] = useState(
    quiz.timeLimitMinutes === null ? '' : String(quiz.timeLimitMinutes),
  );
  const [showAnswers, setShowAnswers] = useState(quiz.showAnswers);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const values = {
      title,
      instructions,
      isFinal,
      passMarkPct: passMark,
      maxAttempts: attempts === '' ? null : attempts,
      timeLimitMinutes: minutes === '' ? null : minutes,
      showAnswers,
    };
    const { data, errors: found } = validate(quizSettingsSchema, values);
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      const updated = await api<BuilderQuiz>(`/teach/quizzes/${quiz.id}`, {
        method: 'PATCH',
        json: data,
      });
      onSaved(updated);
      toast.success(t('settingsSaved'));
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  // Keep a saved value (like 4 attempts) in the list even if it isn't one of the usual choices.
  const withCurrent = (choices: string[], current: string) =>
    current === '' || choices.includes(current)
      ? choices
      : [...choices, current].sort((a, b) => Number(a) - Number(b));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          {formError && Object.keys(errors).length === 0 ? (
            <Alert tone="danger">{formError}</Alert>
          ) : null}
          <TextField
            label={t('title')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            maxLength={120}
          />
          <TextareaField
            label={t('instructions')}
            hint={t('instructionsHint')}
            optional
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            error={errors.instructions}
            rows={2}
            maxLength={1000}
          />
          <Switch
            label={t('final')}
            description={t('finalHint')}
            checked={isFinal}
            onCheckedChange={(value) => {
              setIsFinal(value);
              // Switching to a final quiz suggests the stricter defaults, which can still be changed.
              if (value && !quiz.isFinal) {
                setPassMark('70');
                setAttempts('2');
              }
            }}
          />
          <TextField
            label={t('passMark')}
            value={passMark}
            onChange={(e) => setPassMark(e.target.value)}
            error={errors.passMarkPct}
            inputMode="numeric"
          />
          <SelectField
            label={t('attempts')}
            value={attempts}
            onChange={(e) => setAttempts(e.target.value)}
            options={withCurrent(ATTEMPT_CHOICES, attempts).map((value) => ({
              value,
              label:
                value === ''
                  ? t('attemptsUnlimited')
                  : t('attemptsCount', { count: Number(value) }),
            }))}
            error={errors.maxAttempts}
          />
          <SelectField
            label={t('timeLimit')}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            options={withCurrent(TIME_CHOICES, minutes).map((value) => ({
              value,
              label: value === '' ? t('timeNone') : t('timeMinutes', { count: Number(value) }),
            }))}
            error={errors.timeLimitMinutes}
          />
          <Switch
            label={t('showAnswers')}
            description={t('showAnswersHint')}
            checked={showAnswers}
            onCheckedChange={setShowAnswers}
          />
          {quiz.attemptCount > 0 ? (
            <p className="text-sm text-muted">{t('studentsTook', { count: quiz.attemptCount })}</p>
          ) : null}
          <FormActions>
            <Button type="submit" loading={busy}>
              {t('saveSettings')}
            </Button>
          </FormActions>
        </form>
      </CardContent>
    </Card>
  );
}
