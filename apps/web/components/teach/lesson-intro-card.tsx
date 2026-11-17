'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextareaField, TextField } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { EditorLesson } from '@/lib/api/types';

/**
 * The lesson's introduction: what it is about, what the student will learn and how long it takes
 * (the first step of a guided lesson), plus "always open" for courses that open lessons in order.
 * Each field saves itself when the teacher leaves it.
 */
export function LessonIntroCard({ lesson }: { lesson: EditorLesson }) {
  const t = useTranslations('lessonEditor');
  const errorMessage = useErrorMessage();
  const [description, setDescription] = useState(lesson.description ?? '');
  const [objectives, setObjectives] = useState(lesson.objectives.join('\n'));
  const [minutes, setMinutes] = useState(lesson.estimatedMinutes?.toString() ?? '');
  const [alwaysOpen, setAlwaysOpen] = useState(lesson.alwaysOpen);
  const [error, setError] = useState<string | undefined>();

  async function save(body: Record<string, unknown>) {
    try {
      await api(`/teach/lessons/${lesson.id}`, { method: 'PATCH', json: body });
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
      toast.error(errorMessage(e));
    }
  }

  const lines = (text: string) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('intro.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <TextareaField
          label={t('intro.description')}
          hint={t('intro.descriptionHint')}
          optional
          rows={3}
          maxLength={400}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => void save({ description: description.trim() || null })}
        />
        <TextareaField
          label={t('intro.objectives')}
          hint={t('intro.objectivesHint')}
          optional
          rows={4}
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          onBlur={() => {
            const list = lines(objectives).slice(0, 6);
            void save({ objectives: list });
          }}
        />
        <TextField
          label={t('intro.minutes')}
          optional
          type="number"
          inputMode="numeric"
          min={1}
          max={600}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          onBlur={() => {
            const n = Number(minutes);
            void save({
              estimatedMinutes: minutes && n >= 1 ? Math.min(600, Math.round(n)) : null,
            });
          }}
          error={error}
        />
        <Switch
          label={t('intro.alwaysOpen')}
          description={t('intro.alwaysOpenHint')}
          checked={alwaysOpen}
          onCheckedChange={(value) => {
            setAlwaysOpen(value);
            void save({ alwaysOpen: value });
          }}
        />
      </CardContent>
    </Card>
  );
}
