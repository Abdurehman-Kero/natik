import { Download, FileSpreadsheet, FileText, Presentation } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Each kind of document gets the colour people know it by. */
const KINDS = {
  slides: { icon: Presentation, tone: 'bg-[#fdebe4] text-[#c4471b]' },
  sheet: { icon: FileSpreadsheet, tone: 'bg-[#e3f4ea] text-[#1d7a45]' },
  doc: { icon: FileText, tone: 'bg-[#e4ecfb] text-[#2456b5]' },
} as const;

function kindOf(name: string): keyof typeof KINDS {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'ppt' || ext === 'pptx') return 'slides';
  if (ext === 'xls' || ext === 'xlsx') return 'sheet';
  return 'doc';
}

/** A PowerPoint, Word or Excel file of the session: its name, size and a clear Download button. */
export function DocumentCard({
  url,
  name,
  sizeBytes,
  caption,
}: {
  url: string;
  name: string;
  sizeBytes: number;
  caption: string | null;
}) {
  const t = useTranslations('lessonView');
  const kind = KINDS[kindOf(name)];
  const Icon = kind.icon;
  return (
    <figure className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card">
      <span
        className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl', kind.tone)}
        aria-hidden
      >
        <Icon className="size-6" />
      </span>
      <figcaption className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{name}</span>
        <span className="block text-sm text-muted">
          {caption ? `${caption} · ` : ''}
          {formatSize(sizeBytes)}
        </span>
      </figcaption>
      <a
        href={url}
        download
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border-strong px-3.5 font-semibold text-primary transition-colors hover:border-primary hover:bg-primary-soft"
        aria-label={t('downloadFile', { name })}
      >
        <Download className="size-4.5" aria-hidden />
        <span className="hidden sm:inline">{t('download')}</span>
      </a>
    </figure>
  );
}
