'use client';

import { slideInputSchema, UPLOAD_LIMITS, bytesToMb } from '@natik/shared';
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState } from 'react';
import { Button, IconButton } from '@/components/ui/button';
import {
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormActions } from '@/components/ui/form-field';
import { TextareaField, TextField } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { EditorBlock, EditorSlide, UploadedFile } from '@/lib/api/types';
import { uploadFile } from '@/lib/api/upload';
import { apiFieldErrors, validate } from '@/lib/forms';

/**
 * A deck of slides inside a lesson: a title, a little text, a picture and a few key words on each.
 * Students see them one at a time (Prepare and Revise steps). Each change saves at once.
 */
export function SlidesEditor({
  block,
  courseId,
  onChanged,
}: {
  block: EditorBlock;
  courseId: string;
  /** Reload the lesson from the server after a change. */
  onChanged: () => Promise<unknown>;
}) {
  const t = useTranslations('lessonEditor');
  const errorMessage = useErrorMessage();
  const [editing, setEditing] = useState<EditorSlide | 'new' | null>(null);
  const [removing, setRemoving] = useState<EditorSlide | null>(null);
  const slides = block.slides;

  async function move(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= slides.length) return;
    const ids = slides.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await api(`/teach/blocks/${block.id}/slides/reorder`, { method: 'POST', json: { ids } });
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {slides.length === 0 ? <p className="text-muted">{t('slides.empty')}</p> : null}
      <ol className="flex flex-col gap-2">
        {slides.map((slide, index) => (
          <li
            key={slide.id}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
              {index + 1}
            </span>
            {slide.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- private, authenticated picture
              <img src={slide.imageUrl} alt="" className="size-12 rounded-lg object-cover" />
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{slide.title}</span>
              {slide.body ? (
                <span className="block truncate text-sm text-muted">{slide.body}</span>
              ) : null}
            </span>
            <IconButton
              label={t('moveUp')}
              disabled={index === 0}
              onClick={() => void move(index, -1)}
            >
              <ArrowUp />
            </IconButton>
            <IconButton
              label={t('moveDown')}
              disabled={index === slides.length - 1}
              onClick={() => void move(index, 1)}
            >
              <ArrowDown />
            </IconButton>
            <IconButton label={t('slides.edit')} onClick={() => setEditing(slide)}>
              <Pencil />
            </IconButton>
            <IconButton label={t('slides.remove')} onClick={() => setRemoving(slide)}>
              <Trash2 />
            </IconButton>
          </li>
        ))}
      </ol>
      <div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setEditing('new')}>
          <Plus aria-hidden /> {t('slides.add')}
        </Button>
      </div>

      {editing ? (
        <SlideDialog
          block={block}
          courseId={courseId}
          slide={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('slides.removeTitle')}
        description={t('slides.removeText')}
        confirmLabel={t('slides.remove')}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api(`/teach/slides/${removing.id}`, { method: 'DELETE' });
            await onChanged();
          } catch (error) {
            toast.error(errorMessage(error));
            throw error;
          }
        }}
      />
    </div>
  );
}

function SlideDialog({
  block,
  courseId,
  slide,
  onClose,
  onSaved,
}: {
  block: EditorBlock;
  courseId: string;
  slide: EditorSlide | null;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const t = useTranslations('lessonEditor');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const picker = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(slide?.title ?? '');
  const [body, setBody] = useState(slide?.body ?? '');
  const [keywords, setKeywords] = useState(slide?.keywords.join(', ') ?? '');
  const [image, setImage] = useState<{ id: string; url: string } | null>(
    slide?.imageFileId && slide.imageUrl ? { id: slide.imageFileId, url: slide.imageUrl } : null,
  );
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  async function choosePicture(file: File | undefined) {
    if (picker.current) picker.current.value = '';
    if (!file) return;
    if (file.size > UPLOAD_LIMITS.image.maxBytes) {
      toast.error(t('slides.pictureTooBig', { max: bytesToMb(UPLOAD_LIMITS.image.maxBytes) }));
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadFile<UploadedFile>(
        '/files',
        file,
        { purpose: 'LESSON_IMAGE', courseId },
        () => undefined,
      ).promise;
      setImage({ id: uploaded.id, url: uploaded.url });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = {
      title,
      body: body.trim() || null,
      imageFileId: image?.id ?? null,
      keywords: keywords
        .split(/[,\n]/)
        .map((word) => word.trim())
        .filter(Boolean),
    };
    const { data, errors: found } = validate(slideInputSchema, input);
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      if (slide) {
        await api(`/teach/slides/${slide.id}`, { method: 'PATCH', json: data });
      } else {
        await api(`/teach/blocks/${block.id}/slides`, { method: 'POST', json: data });
      }
      await onSaved();
      onClose();
    } catch (error) {
      setErrors({ title: apiFieldErrors(error).title ?? errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{slide ? t('slides.editTitle') : t('slides.addTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('slides.addTitle')}</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4">
          <TextField
            label={t('slides.titleLabel')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            maxLength={120}
            autoFocus
          />
          <TextareaField
            label={t('slides.bodyLabel')}
            optional
            rows={4}
            maxLength={1200}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            error={errors.body}
          />
          <TextField
            label={t('slides.keywordsLabel')}
            hint={t('slides.keywordsHint')}
            optional
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            error={errors.keywords}
          />
          <div className="flex flex-col gap-2">
            {image ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, authenticated picture */}
                <img src={image.url} alt="" className="size-20 rounded-lg object-cover" />
                <Button type="button" variant="ghost" size="sm" onClick={() => setImage(null)}>
                  <X aria-hidden /> {t('slides.removePicture')}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={uploading}
                className="self-start"
                onClick={() => picker.current?.click()}
              >
                <ImagePlus aria-hidden /> {t('slides.addPicture')}
              </Button>
            )}
            <input
              ref={picker}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => void choosePicture(e.target.files?.[0])}
            />
          </div>
          <FormActions>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                {tc('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy} disabled={uploading}>
              {t('slides.save')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
