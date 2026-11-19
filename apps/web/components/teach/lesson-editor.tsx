'use client';

import { bytesToMb, UPLOAD_LIMITS } from '@natik/shared';
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  Check,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Image as ImageIcon,
  ImagePlus,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  Presentation,
  RotateCcw,
  TriangleAlert,
  Type,
  Video,
  X,
} from 'lucide-react';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CaptionsControl } from '@/components/teach/captions-control';
import { LessonIntroCard } from '@/components/teach/lesson-intro-card';
import { SlidesEditor } from '@/components/teach/slides-editor';
import { StageSelect } from '@/components/teach/stage-select';
import { VideoLinkDialog } from '@/components/teach/video-link-dialog';
import { RichTextEditor } from '@/components/editor/lazy-rich-text-editor';
import { LessonQuizCard } from '@/components/teach/lesson-quiz-card';
import { Alert } from '@/components/ui/alert';
import { Button, IconButton, LinkButton } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/input';
import { StickyActionBar } from '@/components/ui/layout';
import { ProgressBar } from '@/components/ui/progress';
import { StatusPill } from '@/components/ui/status-pill';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type {
  BlockKind,
  EditorBlock,
  EditorLesson,
  RichTextDoc,
  UploadedFile,
  VideoPlayback,
  VideoUpload,
  VideoStatusValue,
} from '@/lib/api/types';
import { uploadFile } from '@/lib/api/upload';
import { savePosterFrom } from '@/lib/video-frame';
import { cn } from '@/lib/cn';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

interface Pending {
  key: string;
  kind: 'PDF' | 'AUDIO' | 'IMAGE' | 'FILE' | 'VIDEO';
  file: File;
  progress: number;
  error?: string;
  /** Videos: the block already exists while the file is still travelling. */
  videoId?: string;
  abort?: () => void;
}

const BLOCK_ICON: Record<BlockKind, typeof Type> = {
  TEXT: Type,
  VIDEO: Video,
  PDF: FileText,
  AUDIO: AudioLines,
  IMAGE: ImageIcon,
  SLIDES: Presentation,
  FILE: Paperclip,
};

const FILE_RULES = {
  PDF: { purpose: 'LESSON_PDF', limit: UPLOAD_LIMITS.pdf, accept: 'application/pdf,.pdf' },
  AUDIO: {
    purpose: 'LESSON_AUDIO',
    limit: UPLOAD_LIMITS.audio,
    accept: 'audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav',
  },
  IMAGE: {
    purpose: 'LESSON_IMAGE',
    limit: UPLOAD_LIMITS.image,
    accept: 'image/jpeg,image/png,image/webp',
  },
  /** PowerPoint, Word and Excel: students download them. */
  FILE: {
    purpose: 'LESSON_FILE',
    limit: UPLOAD_LIMITS.document,
    accept: [...UPLOAD_LIMITS.document.extensions, ...UPLOAD_LIMITS.document.mimeTypes].join(','),
  },
} as const;

/** "2026-11-20" for a date field, from what the API sends. */
const toDateInput = (value: string | null) => (value ? value.slice(0, 10) : '');

const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm';

const TEXT_SAVE_DELAY = 1500;

let counter = 0;
const nextKey = () => `u${++counter}`;

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The lesson editor (FR-TEACH-003/004). A lesson is a stack of blocks: text, video, PDF, audio,
 * pictures. Text saves itself a moment after typing stops, files upload in the background with a
 * progress bar, and nothing is lost when leaving the page.
 */
export function LessonEditor({ initial }: { initial: EditorLesson }) {
  const t = useTranslations('lessonEditor');
  const tf = useTranslations('fields.file');
  const errorMessage = useErrorMessage();
  const router = useRouter();

  const [title, setTitle] = useState(initial.title);
  const [sessionDate, setSessionDate] = useState(toDateInput(initial.sessionDate));
  const [downloadsAllowed, setDownloadsAllowed] = useState(initial.downloadsAllowed);
  const [status, setStatus] = useState(initial.status);
  const [blocks, setBlocks] = useState<EditorBlock[]>(initial.blocks);
  const [pending, setPending] = useState<Pending[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [problems, setProblems] = useState<string[]>([]);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [removing, setRemoving] = useState<EditorBlock | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [linkingVideo, setLinkingVideo] = useState(false);

  const lessonId = initial.id;
  const courseId = initial.course.id;
  const live = status === 'PUBLISHED';

  // What still needs saving, and the timers that will save it.
  const metaDirty = useRef(false);
  const textDrafts = useRef(new Map<string, RichTextDoc>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // The newest values for saving; handlers update it (reading state in a timer would see old values).
  const latest = useRef({
    title: initial.title,
    sessionDate: toDateInput(initial.sessionDate),
    downloadsAllowed: initial.downloadsAllowed,
  });

  const uploading = pending.some((p) => p.progress < 100 && !p.error);

  const patchPending = useCallback((key: string, change: Partial<Pending>) => {
    setPending((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));
  }, []);

  const reloadBlocks = useCallback(async () => {
    const fresh = await api<EditorLesson>(`/teach/lessons/${lessonId}`);
    // Keep text being typed right now: it is newer than what the server has.
    setBlocks(
      fresh.blocks.map((b) => {
        const draft = textDrafts.current.get(b.id);
        return draft ? { ...b, textJson: draft } : b;
      }),
    );
    setStatus(fresh.status);
    return fresh;
  }, [lessonId]);

  // ── Saving ───────────────────────────────────────────────────────────

  const settle = useCallback(() => {
    setSaveState(metaDirty.current || textDrafts.current.size > 0 ? 'dirty' : 'saved');
  }, []);

  const saveMeta = useCallback(async () => {
    if (!metaDirty.current) return;
    metaDirty.current = false;
    const body = latest.current;
    if (body.title.trim().length < 2) {
      metaDirty.current = true;
      setTitleError(t('titleRequired'));
      throw new Error('title');
    }
    await api(`/teach/lessons/${lessonId}`, {
      method: 'PATCH',
      json: {
        title: body.title.trim(),
        // Noon in Addis Ababa, so the date never shifts a day whatever the device's time zone.
        sessionDate: body.sessionDate ? `${body.sessionDate}T12:00:00+03:00` : null,
        downloadsAllowed: body.downloadsAllowed,
      },
    });
    setTitleError(undefined);
  }, [lessonId, t]);

  const saveText = useCallback(async (blockId: string) => {
    const doc = textDrafts.current.get(blockId);
    if (!doc) return;
    const timer = timers.current.get(blockId);
    if (timer) clearTimeout(timer);
    timers.current.delete(blockId);
    await api(`/teach/blocks/${blockId}`, { method: 'PATCH', json: { textJson: doc } });
    // Only forget the draft if nothing newer arrived while saving.
    if (textDrafts.current.get(blockId) === doc) textDrafts.current.delete(blockId);
  }, []);

  /** Saves everything that is waiting. Resolves when done; throws if something could not be saved. */
  const flush = useCallback(async () => {
    setSaveState('saving');
    try {
      await saveMeta();
      await Promise.all([...textDrafts.current.keys()].map((id) => saveText(id)));
      settle();
    } catch (error) {
      setSaveState('error');
      throw error;
    }
  }, [saveMeta, saveText, settle]);

  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markMetaDirty = () => {
    metaDirty.current = true;
    setSaveState('dirty');
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(() => void flush().catch(() => undefined), 800);
  };

  const onText = (blockId: string, doc: RichTextDoc) => {
    textDrafts.current.set(blockId, doc);
    setSaveState('dirty');
    const existing = timers.current.get(blockId);
    if (existing) clearTimeout(existing);
    timers.current.set(
      blockId,
      setTimeout(() => void flush().catch(() => undefined), TEXT_SAVE_DELAY),
    );
  };

  // Clear timers when leaving; ask before closing the tab with unsaved work or uploads running.
  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      pendingTimers.forEach((timer) => clearTimeout(timer));
      if (metaTimer.current) clearTimeout(metaTimer.current);
    };
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (metaDirty.current || textDrafts.current.size > 0 || uploading) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uploading]);

  /** Save first, then go: used by the Back and Preview links. */
  async function leave(href: string) {
    try {
      await flush();
    } catch {
      toast.error(t('saveFailed'));
      return;
    }
    router.push(href);
  }

  // ── Blocks ───────────────────────────────────────────────────────────

  async function addBlock(type: 'TEXT' | 'SLIDES') {
    try {
      await api(`/teach/lessons/${lessonId}/blocks`, {
        method: 'POST',
        // A new deck starts in the Prepare step; the teacher can move it.
        json: type === 'SLIDES' ? { type, stage: 'PREPARE' } : { type },
      });
      await reloadBlocks();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  /** A video that stays on YouTube or Vimeo: nothing to upload. */
  async function addVideoLink(input: { title: string; url: string }) {
    const video = await api<{ id: string }>('/videos/external', { method: 'POST', json: input });
    await api(`/teach/lessons/${lessonId}/blocks`, {
      method: 'POST',
      json: { type: 'VIDEO', videoId: video.id },
    });
    await reloadBlocks();
  }

  async function moveBlock(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target]!, next[index]!];
    const previous = blocks;
    setBlocks(next);
    try {
      await api(`/teach/lessons/${lessonId}/blocks/reorder`, {
        method: 'POST',
        json: { ids: next.map((b) => b.id) },
      });
    } catch (error) {
      setBlocks(previous);
      toast.error(errorMessage(error));
    }
  }

  async function removeBlock(block: EditorBlock) {
    try {
      textDrafts.current.delete(block.id);
      await api(`/teach/blocks/${block.id}`, { method: 'DELETE' });
      setBlocks((list) => list.filter((b) => b.id !== block.id));
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  async function saveCaption(block: EditorBlock, caption: string) {
    try {
      await api(`/teach/blocks/${block.id}`, {
        method: 'PATCH',
        json: { caption: caption.trim() || null },
      });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  // ── Uploads ──────────────────────────────────────────────────────────

  function checkFile(kind: 'PDF' | 'AUDIO' | 'IMAGE' | 'FILE', file: File): string | null {
    const rule = FILE_RULES[kind];
    if (file.size > rule.limit.maxBytes) {
      return tf('tooLarge', { size: bytesToMb(file.size), max: bytesToMb(rule.limit.maxBytes) });
    }
    return null;
  }

  async function runFileUpload(item: Pending) {
    const kind = item.kind as 'PDF' | 'AUDIO' | 'IMAGE' | 'FILE';
    patchPending(item.key, { error: undefined, progress: 0 });
    const handle = uploadFile<UploadedFile>(
      '/files',
      item.file,
      { purpose: FILE_RULES[kind].purpose, courseId },
      (progress) => patchPending(item.key, { progress }),
    );
    patchPending(item.key, { abort: handle.abort });
    try {
      const uploaded = await handle.promise;
      await api(`/teach/lessons/${lessonId}/blocks`, {
        method: 'POST',
        json: { type: kind, fileId: uploaded.id },
      });
      await reloadBlocks();
      setPending((list) => list.filter((p) => p.key !== item.key));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ABORTED') {
        setPending((list) => list.filter((p) => p.key !== item.key));
        return;
      }
      patchPending(item.key, { error: errorMessage(error), progress: 0 });
    }
  }

  function addFile(kind: 'PDF' | 'AUDIO' | 'IMAGE' | 'FILE', file: File) {
    const problem = checkFile(kind, file);
    if (problem) {
      toast.error(problem);
      return;
    }
    const item: Pending = { key: nextKey(), kind, file, progress: 0 };
    setPending((list) => [...list, item]);
    void runFileUpload(item);
  }

  async function sendVideo(item: Pending, upload: VideoUpload, videoId: string) {
    patchPending(item.key, { error: undefined, progress: 0 });
    try {
      if (upload.kind === 'direct') {
        const handle = uploadFile(upload.url.replace(/^\/api\/v1/, ''), item.file, {}, (progress) =>
          patchPending(item.key, { progress }),
        );
        patchPending(item.key, { abort: handle.abort });
        await handle.promise;
      } else {
        const tus = await import('tus-js-client');
        await new Promise<void>((resolve, reject) => {
          const job = new tus.Upload(item.file, {
            endpoint: upload.endpoint,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            headers: upload.headers,
            metadata: { filetype: item.file.type, title: item.file.name },
            onProgress: (sent, total) =>
              patchPending(item.key, { progress: Math.round((sent / total) * 100) }),
            onError: reject,
            onSuccess: () => resolve(),
          });
          patchPending(item.key, { abort: () => void job.abort() });
          void job.findPreviousUploads().then((previous) => {
            if (previous[0]) job.resumeFromPreviousUpload(previous[0]);
            job.start();
          });
        });
      }
      setPending((list) => list.filter((p) => p.key !== item.key));
      setBlocks((list) =>
        list.map((b) =>
          b.video?.id === videoId
            ? { ...b, video: { ...b.video, status: 'PROCESSING' as VideoStatusValue } }
            : b,
        ),
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ABORTED') {
        setPending((list) => list.filter((p) => p.key !== item.key));
        return;
      }
      patchPending(item.key, {
        error: error instanceof ApiError ? errorMessage(error) : t('videoUploadFailed'),
        progress: 0,
      });
    }
  }

  /** Shows the video's new still picture in its row. */
  function showPoster(videoId: string, posterUrl: string) {
    setBlocks((list) =>
      list.map((b) => (b.video?.id === videoId ? { ...b, video: { ...b.video, posterUrl } } : b)),
    );
  }

  /** Saves a frame of the video as its still picture. A video works without one, so failures are quiet. */
  async function attachFrame(videoId: string, src: string) {
    try {
      const url = await savePosterFrom(videoId, src, (form) =>
        api<{ posterUrl: string | null }>(`/videos/${videoId}/poster`, {
          method: 'POST',
          body: form,
        }),
      );
      if (url) showPoster(videoId, url);
    } catch {
      // No picture: students see the Natik colours instead.
    }
  }

  /** The teacher chose a picture for the video. */
  async function choosePoster(videoId: string, file: File) {
    try {
      const form = new FormData();
      form.set('file', file);
      const saved = await api<{ posterUrl: string | null }>(`/videos/${videoId}/poster`, {
        method: 'POST',
        body: form,
      });
      if (saved.posterUrl) showPoster(videoId, saved.posterUrl);
      toast.success(t('posterSaved'));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  // Videos uploaded before pictures existed: take a frame once, the first time the lesson is opened.
  const triedPosters = useRef(new Set<string>());
  const missingPosters = blocks
    .filter((b) => b.video && !b.video.external && b.video.status === 'READY' && !b.video.posterUrl)
    .map((b) => b.video!.id)
    .join(',');
  useEffect(() => {
    if (!missingPosters) return;
    for (const id of missingPosters.split(',')) {
      if (triedPosters.current.has(id)) continue;
      triedPosters.current.add(id);
      void api<VideoPlayback>(`/videos/${id}/embed`)
        .then((playback) => (playback.kind === 'file' ? attachFrame(id, playback.url) : undefined))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- attachFrame only uses setters
  }, [missingPosters]);

  async function addVideo(file: File) {
    const item: Pending = { key: nextKey(), kind: 'VIDEO', file, progress: 0 };
    setPending((list) => [...list, item]);
    try {
      const created = await api<{ id: string; upload: VideoUpload }>('/videos', {
        method: 'POST',
        json: { title: file.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Video' },
      });
      patchPending(item.key, { videoId: created.id });
      await api(`/teach/lessons/${lessonId}/blocks`, {
        method: 'POST',
        json: { type: 'VIDEO', videoId: created.id },
      });
      await reloadBlocks();
      // The still picture comes from the file on this device, while the video itself is sending.
      const local = URL.createObjectURL(file);
      void attachFrame(created.id, local).finally(() => URL.revokeObjectURL(local));
      void sendVideo({ ...item, videoId: created.id }, created.upload, created.id);
    } catch (error) {
      patchPending(item.key, { error: errorMessage(error), progress: 0 });
    }
  }

  async function retryVideo(item: Pending) {
    if (!item.videoId) return;
    try {
      const status = await api<{ upload?: VideoUpload }>(`/videos/${item.videoId}`);
      if (status.upload) void sendVideo(item, status.upload, item.videoId);
    } catch (error) {
      patchPending(item.key, { error: errorMessage(error) });
    }
  }

  // Videos that are still being prepared: ask now and then until they are ready.
  const waitingVideos = blocks
    .filter((b) => b.video && (b.video.status === 'UPLOADING' || b.video.status === 'PROCESSING'))
    .filter((b) => !pending.some((p) => p.videoId === b.video?.id && !p.error))
    .map((b) => b.video!.id)
    .join(',');
  useEffect(() => {
    if (!waitingVideos) return;
    let stopped = false;
    const poll = async () => {
      for (const id of waitingVideos.split(',')) {
        try {
          const state = await api<{ status: VideoStatusValue; durationSec: number | null }>(
            `/videos/${id}`,
          );
          if (stopped) return;
          setBlocks((list) =>
            list.map((b) =>
              b.video?.id === id
                ? {
                    ...b,
                    video: { ...b.video, status: state.status, durationSec: state.durationSec },
                  }
                : b,
            ),
          );
        } catch {
          // Try again on the next round.
        }
      }
    };
    const interval = setInterval(() => void poll(), 4000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [waitingVideos]);

  // ── Publish ──────────────────────────────────────────────────────────

  async function setLive(next: 'publish' | 'hide') {
    setPublishing(true);
    setProblems([]);
    try {
      await flush();
      const updated = await api<EditorLesson>(`/teach/lessons/${lessonId}/${next}`, {
        method: 'POST',
      });
      setStatus(updated.status);
      toast.success(next === 'publish' ? t('publishedToast') : t('hiddenToast'));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NOT_READY_TO_PUBLISH') {
        setProblems(Object.values(error.fields ?? {}).flat());
      } else if (!(error instanceof Error && error.message === 'title')) {
        toast.error(errorMessage(error));
      }
    } finally {
      setPublishing(false);
    }
  }

  // ── View ─────────────────────────────────────────────────────────────

  const previewHref = `/teach/courses/${courseId}/lessons/${lessonId}/preview`;
  const backHref = `/teach/courses/${courseId}`;
  const course = initial.course;

  const stateLabel =
    saveState === 'saving'
      ? t('saving')
      : saveState === 'dirty'
        ? t('unsaved')
        : saveState === 'error'
          ? t('saveFailed')
          : t('saved');

  return (
    <>
      <h1 className="sr-only">{t('pageTitle')}</h1>
      <div className="flex flex-col gap-3 pb-5">
        <Link
          href={backHref}
          onClick={(event) => {
            event.preventDefault();
            void leave(backHref);
          }}
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-muted hover:text-primary"
        >
          <ArrowUp className="size-4 -rotate-90" aria-hidden />
          {initial.unit.title}
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 flex-1 md:max-w-2xl">
            <TextField
              label={t('lessonTitle')}
              hideLabel
              value={title}
              onChange={(e) => {
                latest.current = { ...latest.current, title: e.target.value };
                setTitle(e.target.value);
                setTitleError(undefined);
                markMetaDirty();
              }}
              error={titleError}
              maxLength={120}
              autoComplete="off"
              className="[&_input]:text-lg [&_input]:font-semibold"
              lang={course.lang}
              dir={course.dir}
            />
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <StatusPill status={`content.${status}`} />
            <SaveIndicator state={saveState} label={stateLabel} />
            <LinkButton
              href={previewHref}
              variant="secondary"
              onClick={(event) => {
                event.preventDefault();
                void leave(previewHref);
              }}
            >
              <Eye aria-hidden /> {t('preview')}
            </LinkButton>
            <PublishButton
              live={live}
              hidden={status === 'HIDDEN'}
              busy={publishing}
              onClick={() => setLive(live ? 'hide' : 'publish')}
              t={t}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 md:hidden">
          <StatusPill status={`content.${status}`} />
          <SaveIndicator state={saveState} label={stateLabel} />
        </div>
      </div>

      {live ? (
        <Alert tone="info" className="mb-4">
          {t('liveNotice')}
        </Alert>
      ) : null}
      {problems.length > 0 ? (
        <Alert tone="warning" className="mb-4">
          <p className="font-semibold">{t('notReady')}</p>
          <ul className="mt-1 list-disc ps-5 font-normal">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {blocks.length === 0 && pending.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center text-muted">
              <p className="font-semibold text-ink">{t('emptyTitle')}</p>
              <p className="mt-1">{t('emptyText')}</p>
            </div>
          ) : null}

          {blocks.map((block, index) => {
            const Icon = BLOCK_ICON[block.type];
            const upload = pending.find((p) => p.videoId && p.videoId === block.video?.id);
            return (
              <Card key={block.id} className="overflow-hidden p-0">
                <div className="flex items-center gap-1 border-b border-border bg-canvas px-3 py-1">
                  <Icon className="size-4.5 text-primary" aria-hidden />
                  <h2 className="flex-1 text-sm font-semibold text-ink">
                    {t(`block.${block.type}`)}
                  </h2>
                  <StageSelect
                    blockId={block.id}
                    value={block.stage}
                    onChange={(stage) =>
                      setBlocks((list) =>
                        list.map((b) => (b.id === block.id ? { ...b, stage } : b)),
                      )
                    }
                  />
                  <IconButton
                    label={t('moveUp')}
                    disabled={index === 0}
                    onClick={() => moveBlock(index, -1)}
                  >
                    <ArrowUp />
                  </IconButton>
                  <IconButton
                    label={t('moveDown')}
                    disabled={index === blocks.length - 1}
                    onClick={() => moveBlock(index, 1)}
                  >
                    <ArrowDown />
                  </IconButton>
                  <IconButton label={t('removeBlock')} onClick={() => setRemoving(block)}>
                    <X />
                  </IconButton>
                </div>
                <div className="p-3 sm:p-4">
                  {block.type === 'TEXT' ? (
                    <RichTextEditor
                      value={block.textJson}
                      onChange={(doc) => onText(block.id, doc)}
                      dir={course.dir}
                      lang={course.lang}
                      label={t('textLabel')}
                      imageCourseId={courseId}
                    />
                  ) : null}

                  {block.type === 'IMAGE' && block.file ? (
                    <div className="flex flex-col gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={block.file.url}
                        alt=""
                        className="max-h-72 w-full rounded-xl border border-border object-contain"
                      />
                      <TextField
                        label={t('imageCaption')}
                        hint={t('imageCaptionHint')}
                        optional
                        defaultValue={block.caption ?? ''}
                        maxLength={200}
                        onBlur={(e) => {
                          if ((block.caption ?? '') !== e.target.value.trim()) {
                            void saveCaption(block, e.target.value);
                          }
                        }}
                      />
                    </div>
                  ) : null}

                  {(block.type === 'PDF' || block.type === 'AUDIO' || block.type === 'FILE') &&
                  block.file ? (
                    <p className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">
                        {block.file.name}
                      </span>
                      <span className="shrink-0 text-sm text-muted">
                        {formatSize(block.file.sizeBytes)}
                      </span>
                    </p>
                  ) : null}

                  {block.type === 'SLIDES' ? (
                    <SlidesEditor block={block} courseId={courseId} onChanged={reloadBlocks} />
                  ) : null}

                  {block.type === 'VIDEO' && block.video ? (
                    <VideoRow
                      title={block.video.title}
                      status={block.video.status}
                      durationSec={block.video.durationSec}
                      posterUrl={block.video.posterUrl}
                      onPoster={
                        block.video.external
                          ? undefined
                          : (file) => void choosePoster(block.video!.id, file)
                      }
                      upload={upload}
                      onRetry={() => upload && retryVideo(upload)}
                      t={t}
                    />
                  ) : null}
                  {block.type === 'VIDEO' && block.video?.external ? (
                    <p className="mt-2 text-sm text-muted">{t('videoLink.external')}</p>
                  ) : null}
                  {block.type === 'VIDEO' &&
                  block.video &&
                  !block.video.external &&
                  block.video.status === 'READY' ? (
                    <div className="mt-3 border-t border-border pt-3">
                      <CaptionsControl
                        videoId={block.video.id}
                        hasCaptions={block.video.hasCaptions}
                        onChange={(has) =>
                          setBlocks((list) =>
                            list.map((b) =>
                              b.id === block.id && b.video
                                ? { ...b, video: { ...b.video, hasCaptions: has } }
                                : b,
                            ),
                          )
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}

          {pending
            .filter((p) => p.kind !== 'VIDEO')
            .map((item) => (
              <Card key={item.key}>
                <CardContent className="flex flex-col gap-2">
                  <p className="flex items-center gap-2 text-sm">
                    {item.error ? (
                      <TriangleAlert className="size-4 shrink-0 text-danger" aria-hidden />
                    ) : (
                      <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">
                      {item.file.name}
                    </span>
                    {item.error ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => runFileUpload(item)}>
                          <RotateCcw aria-hidden /> {tf('retry')}
                        </Button>
                        <IconButton
                          label={t('cancelUpload')}
                          onClick={() => setPending((l) => l.filter((p) => p.key !== item.key))}
                        >
                          <X />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton label={t('cancelUpload')} onClick={() => item.abort?.()}>
                        <X />
                      </IconButton>
                    )}
                  </p>
                  {item.error ? (
                    <p className="text-sm text-danger" role="alert">
                      {item.error}
                    </p>
                  ) : (
                    <ProgressBar
                      value={item.progress}
                      size="sm"
                      label={tf('uploading', { progress: item.progress })}
                    />
                  )}
                </CardContent>
              </Card>
            ))}

          {pending
            .filter((p) => p.kind === 'VIDEO' && !p.videoId)
            .map((item) => (
              <Card key={item.key}>
                <CardContent className="flex items-center gap-3">
                  {item.error ? (
                    <>
                      <TriangleAlert className="size-4 shrink-0 text-danger" aria-hidden />
                      <p className="min-w-0 flex-1 text-sm text-danger" role="alert">
                        {item.error}
                      </p>
                      <IconButton
                        label={t('cancelUpload')}
                        onClick={() => setPending((l) => l.filter((p) => p.key !== item.key))}
                      >
                        <X />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {item.file.name}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}

          <AddBlockBar
            onText={() => addBlock('TEXT')}
            onSlides={() => addBlock('SLIDES')}
            onVideoLink={() => setLinkingVideo(true)}
            onFile={addFile}
            onVideo={addVideo}
            t={t}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <TextField
                type="date"
                label={t('sessionDate')}
                hint={t('sessionDateHint')}
                optional
                value={sessionDate}
                onChange={(e) => {
                  setSessionDate(e.target.value);
                  latest.current = { ...latest.current, sessionDate: e.target.value };
                  markMetaDirty();
                }}
              />
              <Switch
                label={t('allowDownloads')}
                description={t('allowDownloadsHint')}
                checked={downloadsAllowed}
                onCheckedChange={(value) => {
                  setDownloadsAllowed(value);
                  latest.current = { ...latest.current, downloadsAllowed: value };
                  markMetaDirty();
                }}
              />
            </CardContent>
          </Card>
          <LessonIntroCard lesson={initial} />
          <LessonQuizCard lessonId={lessonId} quiz={initial.quiz} />
        </aside>
      </div>

      <div className="md:hidden">
        <StickyActionBar>
          <LinkButton
            href={previewHref}
            variant="secondary"
            onClick={(event) => {
              event.preventDefault();
              void leave(previewHref);
            }}
          >
            <Eye aria-hidden /> {t('preview')}
          </LinkButton>
          <PublishButton
            live={live}
            hidden={status === 'HIDDEN'}
            busy={publishing}
            onClick={() => setLive(live ? 'hide' : 'publish')}
            t={t}
          />
        </StickyActionBar>
      </div>

      {linkingVideo ? (
        <VideoLinkDialog onSubmit={addVideoLink} onClose={() => setLinkingVideo(false)} />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('removeTitle')}
        description={t('removeText')}
        confirmLabel={t('removeBlock')}
        onConfirm={async () => {
          if (removing) await removeBlock(removing);
        }}
      />
    </>
  );
}

function SaveIndicator({ state, label }: { state: SaveState; label: string }) {
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 text-sm',
        state === 'error' ? 'font-semibold text-danger' : 'text-muted',
      )}
    >
      {state === 'saving' ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : state === 'saved' ? (
        <Check className="size-4 text-success" aria-hidden />
      ) : state === 'error' ? (
        <TriangleAlert className="size-4" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}

function PublishButton({
  live,
  hidden,
  busy,
  onClick,
  t,
}: {
  live: boolean;
  hidden: boolean;
  busy: boolean;
  onClick: () => void;
  t: ReturnType<typeof useTranslations<'lessonEditor'>>;
}) {
  return live ? (
    <Button type="button" variant="secondary" loading={busy} onClick={onClick}>
      <EyeOff aria-hidden /> {t('hide')}
    </Button>
  ) : (
    <Button type="button" loading={busy} onClick={onClick}>
      <Globe aria-hidden /> {hidden ? t('publishAgain') : t('publish')}
    </Button>
  );
}

function VideoRow({
  title,
  status,
  durationSec,
  posterUrl,
  onPoster,
  upload,
  onRetry,
  t,
}: {
  title: string;
  status: VideoStatusValue;
  durationSec: number | null;
  posterUrl: string | null;
  /** Videos we host can have a chosen picture; YouTube and Vimeo use their own. */
  onPoster?: (file: File) => void;
  upload?: Pending;
  onRetry: () => void;
  t: ReturnType<typeof useTranslations<'lessonEditor'>>;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const sending = upload && !upload.error;
  const minutes = durationSec
    ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`
    : null;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-linear-to-br from-primary to-[#0b2a42] sm:w-44">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the video's own picture
          <img src={posterUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-white/80">
            <Video className="size-7" aria-hidden />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{title}</span>
          {minutes ? <span className="text-sm text-muted tabular-nums">{minutes}</span> : null}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-semibold',
              status === 'READY'
                ? 'text-success'
                : status === 'FAILED'
                  ? 'text-danger'
                  : 'text-muted',
            )}
          >
            {status === 'READY' ? (
              <Check className="size-4" aria-hidden />
            ) : status === 'FAILED' ? (
              <TriangleAlert className="size-4" aria-hidden />
            ) : (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            {sending ? t('videoSending') : t(`videoStatus.${status}`)}
          </span>
        </p>
        {sending ? (
          <ProgressBar value={upload.progress} size="sm" label={`${upload.progress}%`} />
        ) : null}
        {upload?.error ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-danger" role="alert">
            {upload.error}
            <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
              <RotateCcw aria-hidden /> {t('retry')}
            </Button>
          </p>
        ) : null}
        {!upload && status === 'UPLOADING' ? (
          <p className="text-sm text-muted">{t('videoIncomplete')}</p>
        ) : null}
        {onPoster ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{posterUrl ? t('posterHas') : t('posterNone')}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => picker.current?.click()}>
              <ImagePlus aria-hidden /> {t('posterChange')}
            </Button>
            <input
              ref={picker}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-label={t('posterChange')}
              data-testid="video-poster"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onPoster(file);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AddBlockBar({
  onText,
  onSlides,
  onVideoLink,
  onFile,
  onVideo,
  t,
}: {
  onText: () => void;
  onSlides: () => void;
  onVideoLink: () => void;
  onFile: (kind: 'PDF' | 'AUDIO' | 'IMAGE' | 'FILE', file: File) => void;
  onVideo: (file: File) => void;
  t: ReturnType<typeof useTranslations<'lessonEditor'>>;
}) {
  const refs = {
    PDF: useRef<HTMLInputElement>(null),
    AUDIO: useRef<HTMLInputElement>(null),
    IMAGE: useRef<HTMLInputElement>(null),
    FILE: useRef<HTMLInputElement>(null),
    VIDEO: useRef<HTMLInputElement>(null),
  };
  const chips: { key: BlockKind; icon: typeof Type; onClick: () => void }[] = [
    { key: 'TEXT', icon: Type, onClick: onText },
    { key: 'VIDEO', icon: Video, onClick: () => refs.VIDEO.current?.click() },
    { key: 'PDF', icon: FileText, onClick: () => refs.PDF.current?.click() },
    { key: 'FILE', icon: Paperclip, onClick: () => refs.FILE.current?.click() },
    { key: 'AUDIO', icon: AudioLines, onClick: () => refs.AUDIO.current?.click() },
    { key: 'IMAGE', icon: ImageIcon, onClick: () => refs.IMAGE.current?.click() },
    { key: 'SLIDES', icon: Presentation, onClick: onSlides },
  ];
  const input = (kind: 'PDF' | 'AUDIO' | 'IMAGE' | 'FILE' | 'VIDEO', accept: string) => (
    <input
      ref={refs[kind]}
      type="file"
      accept={accept}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      data-testid={`file-${kind.toLowerCase()}`}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (kind === 'VIDEO') onVideo(file);
        else onFile(kind, file);
      }}
    />
  );
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-3">
      <p className="mb-2 px-1 text-sm font-semibold text-muted">{t('addBlock')}</p>
      <div className="flex flex-wrap gap-2">
        {chips.map(({ key, icon: Icon, onClick }) => (
          <Button key={key} type="button" variant="secondary" size="sm" onClick={onClick}>
            <Plus aria-hidden className="!size-4" />
            <Icon aria-hidden className="!size-4" />
            {t(`block.${key}`)}
          </Button>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={onVideoLink}>
          <Plus aria-hidden className="!size-4" />
          <Link2 aria-hidden className="!size-4" />
          {t('videoLink.chip')}
        </Button>
      </div>
      {input('PDF', FILE_RULES.PDF.accept)}
      {input('AUDIO', FILE_RULES.AUDIO.accept)}
      {input('IMAGE', FILE_RULES.IMAGE.accept)}
      {input('FILE', FILE_RULES.FILE.accept)}
      {input('VIDEO', VIDEO_ACCEPT)}
    </div>
  );
}
