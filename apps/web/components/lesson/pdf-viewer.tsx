'use client';

import { ChevronLeft, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

type PdfDocument = import('pdfjs-dist').PDFDocumentProxy;

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reads a PDF inside the page, one page at a time, so it works on every phone (many mobile browsers
 * cannot show a PDF in a frame). The reader code only downloads when the learner presses Open.
 */
export function PdfViewer({
  src,
  name,
  sizeBytes,
  downloadUrl,
}: {
  src: string;
  name: string;
  sizeBytes: number;
  downloadUrl?: string | null;
}) {
  const t = useTranslations('lessonView');
  const [open, setOpen] = useState(false);
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);

  // Load the document once, when opened.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        const loading = pdfjs.getDocument({ url: src, withCredentials: true });
        task = loading;
        const doc = await loading.promise;
        if (cancelled) return;
        setPdf(doc);
        setPage(1);
        setState('ready');
      } catch {
        if (!cancelled) setState('failed');
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [open, src]);

  // Draw the current page at the width of the box.
  useEffect(() => {
    if (!pdf || !canvas.current || !box.current) return;
    let task: { cancel: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const pdfPage = await pdf.getPage(page);
      if (cancelled || !canvas.current || !box.current) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (box.current.clientWidth / base.width) * ratio;
      const viewport = pdfPage.getViewport({ scale });
      const el = canvas.current;
      el.width = Math.floor(viewport.width);
      el.height = Math.floor(viewport.height);
      el.style.width = '100%';
      el.style.height = 'auto';
      const context = el.getContext('2d');
      if (!context) return;
      const render = pdfPage.render({ canvasContext: context, canvas: el, viewport });
      task = render;
      try {
        await render.promise;
      } catch {
        // A newer page was requested before this one finished drawing.
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{name}</p>
          <p className="text-sm text-muted">PDF · {formatSize(sizeBytes)}</p>
        </div>
        <Button
          type="button"
          variant={open ? 'ghost' : 'secondary'}
          size="sm"
          onClick={() => {
            if (!open) setState('loading');
            setOpen((v) => !v);
          }}
          aria-expanded={open}
        >
          {open ? t('closePdf') : t('openPdf')}
        </Button>
      </div>

      {open ? (
        <div className="mt-4">
          <div ref={box} className="overflow-hidden rounded-lg border border-border bg-canvas">
            {state === 'loading' ? (
              <p className="flex items-center justify-center gap-2 p-10 text-muted" role="status">
                <Loader2 className="size-5 animate-spin" aria-hidden /> {t('pdfLoading')}
              </p>
            ) : null}
            {state === 'failed' ? (
              <p className="p-6 text-center text-danger" role="alert">
                {t('pdfFailed')}
              </p>
            ) : null}
            <canvas
              ref={canvas}
              className={state === 'ready' ? 'block' : 'hidden'}
              role="img"
              aria-label={t('pdfPageLabel', { name, page })}
            />
          </div>
          {state === 'ready' && pdf ? (
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft aria-hidden /> {t('previousPage')}
              </Button>
              <p className="text-sm text-muted tabular-nums" aria-live="polite">
                {t('pageOf', { page, total: pdf.numPages })}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(pdf.numPages, p + 1))}
                disabled={page >= pdf.numPages}
              >
                {t('nextPage')} <ChevronRight aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {downloadUrl ? (
        <a
          href={downloadUrl}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
        >
          {t('download')}
        </a>
      ) : null}
    </div>
  );
}
