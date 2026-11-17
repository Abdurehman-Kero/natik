'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { LessonStageName } from '@/lib/api/types';

const STAGES: LessonStageName[] = ['PREPARE', 'WATCH', 'REVISE', 'EXAMPLES'];

/** Which step of the guided lesson a block belongs to. "Lesson" keeps it in the plain lesson part. */
export function StageSelect({
  blockId,
  value,
  onChange,
}: {
  blockId: string;
  value: LessonStageName | null;
  onChange: (stage: LessonStageName | null) => void;
}) {
  const t = useTranslations('lessonEditor');
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    const stage = (next || null) as LessonStageName | null;
    setBusy(true);
    try {
      await api(`/teach/blocks/${blockId}`, { method: 'PATCH', json: { stage } });
      onChange(stage);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex items-center gap-1.5 text-sm text-muted">
      <span className="sr-only sm:not-sr-only">{t('stage.label')}</span>
      <select
        value={value ?? ''}
        disabled={busy}
        onChange={(e) => void change(e.target.value)}
        className="h-11 max-w-36 rounded-lg border border-border-strong bg-surface px-2 font-medium text-ink"
        aria-label={t('stage.label')}
      >
        <option value="">{t('stage.MAIN')}</option>
        {STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {t(`stage.${stage}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
