'use client';

import { ClipboardList, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button, LinkButton } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FormActions } from '@/components/ui/form-field';
import { TextField } from '@/components/ui/input';
import { StatusPill } from '@/components/ui/status-pill';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { EditorLesson } from '@/lib/api/types';

/** The lesson's quiz: open it, or add one in a small dialog (FR-QUIZ-001). */
export function LessonQuizCard({
  lessonId,
  quiz,
}: {
  lessonId: string;
  quiz: EditorLesson['quiz'];
}) {
  const t = useTranslations('lessonEditor');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(t('quizNameDefault'));
  const [isFinal, setIsFinal] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (title.trim().length < 3) {
      setError(t('quizNameDefault'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const created = await api<{ id: string }>(`/teach/lessons/${lessonId}/quiz`, {
        method: 'POST',
        json: { title: title.trim(), isFinal },
      });
      toast.success(t('quizCreated'));
      router.push(`/teach/quizzes/${created.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" aria-hidden /> {t('quizTitle')}
        </CardTitle>
        {!quiz ? <CardDescription>{t('quizAddHint')}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {quiz ? (
          <>
            <p className="font-semibold">{quiz.title}</p>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={`content.${quiz.status}`} size="sm" />
              <span className="text-sm text-muted">
                {t('quizQuestions', { count: quiz.questionCount })}
              </span>
            </div>
            <LinkButton href={`/teach/quizzes/${quiz.id}`} variant="secondary">
              {t('quizOpen')}
            </LinkButton>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Plus aria-hidden /> {t('quizAdd')}
          </Button>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t('quizAdd')}</DialogTitle>
          <DialogDescription>{t('quizAddHint')}</DialogDescription>
          <form onSubmit={create} noValidate className="mt-4 flex flex-col gap-5">
            <TextField
              label={t('quizName')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={error}
              maxLength={120}
              autoFocus
            />
            <Switch label={t('quizFinalChoice')} checked={isFinal} onCheckedChange={setIsFinal} />
            <FormActions>
              <Button type="submit" loading={busy}>
                {t('quizAdd')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tc('cancel')}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
