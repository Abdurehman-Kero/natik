'use client';

import { ArrowDown, ArrowUp, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, type ReactNode, useState } from 'react';
import { UPLOAD_LIMITS } from '@natik/shared';
import { Avatar } from '@/components/ui/avatar';
import { FileDrop } from '@/components/ui/file-drop';
import { uploadFile } from '@/lib/api/upload';
import type { ZodType } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { TextareaField, TextField } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { saveSite } from '@/lib/admin-save';
import { useErrorMessage } from '@/lib/api/client';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

export interface FieldConfig {
  name: string;
  label: string;
  hint?: string;
  multiline?: boolean;
  optional?: boolean;
  maxLength?: number;
}

export interface ItemsTabProps<T extends { id: string; published: boolean }> {
  /** API path, e.g. "/admin/faq". */
  base: string;
  items: T[];
  onItems: (items: T[]) => void;
  fields: FieldConfig[];
  schema: ZodType;
  /** Heading and one-line summary of an item in the list. */
  titleOf: (item: T) => string;
  summaryOf: (item: T) => ReactNode;
  copy: {
    add: string;
    empty: string;
    emptyText: string;
    addTitle: string;
    editTitle: string;
    deleteTitle: string;
    deleteText: string;
    hidden: string;
    published: string;
    publishedHint: string;
    save: string;
    saved: string;
  };
  /** Also applies `published` so the item can be hidden without deleting it. */
  blank: Record<string, string>;
  /** Items with a picture (testimonials): adds an upload field and shows the picture in the list. */
  photo?: { label: string; hint: string; add: string; replace: string; remove: string };
}

type WithPhoto = { photoFileId?: string | null; photoUrl?: string | null };

/**
 * A list of items an admin adds, edits, reorders, hides and deletes (FAQ, testimonials).
 * Every change is saved at once and the public pages refresh (FR-WEB-005).
 */
export function ItemsTab<T extends { id: string; published: boolean }>(props: ItemsTabProps<T>) {
  const { base, items, onItems, titleOf, summaryOf, copy } = props;
  const t = useTranslations('websiteEditor');
  const errorMessage = useErrorMessage();
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [removing, setRemoving] = useState<T | null>(null);

  async function move(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    const previous = items;
    onItems(next);
    try {
      await saveSite(`${base}/reorder`, { method: 'POST', json: { ids: next.map((i) => i.id) } });
    } catch (error) {
      onItems(previous);
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <Button onClick={() => setEditing('new')}>
          <Plus aria-hidden /> {copy.add}
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState icon={Plus} title={copy.empty} description={copy.emptyText} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => (
            <li key={item.id}>
              <Card className="flex items-start gap-2 p-4">
                {props.photo ? (
                  <Avatar
                    name={titleOf(item)}
                    src={(item as WithPhoto).photoUrl}
                    size="md"
                    decorative
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    <span className="break-words">{titleOf(item)}</span>
                    {!item.published ? (
                      <Badge tone="muted">
                        <EyeOff className="size-3" aria-hidden /> {copy.hidden}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{summaryOf(item)}</p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end">
                  <IconButton
                    label={t('moveUp')}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp />
                  </IconButton>
                  <IconButton
                    label={t('moveDown')}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </IconButton>
                  <IconButton label={t('edit')} onClick={() => setEditing(item)}>
                    <Pencil />
                  </IconButton>
                  <IconButton label={t('delete')} onClick={() => setRemoving(item)}>
                    <Trash2 />
                  </IconButton>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <ItemDialog
          key={editing === 'new' ? 'new' : editing.id}
          {...props}
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={copy.deleteTitle}
        description={copy.deleteText}
        confirmLabel={t('delete')}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await saveSite(`${base}/${removing.id}`, { method: 'DELETE' });
            onItems(items.filter((i) => i.id !== removing.id));
            toast.success(t('deleted'));
          } catch (error) {
            toast.error(errorMessage(error));
            throw error;
          }
        }}
      />
    </div>
  );
}

function ItemDialog<T extends { id: string; published: boolean }>({
  base,
  items,
  onItems,
  fields,
  schema,
  copy,
  blank,
  photo: photoCopy,
  item,
  onClose,
}: ItemsTabProps<T> & { item: T | null; onClose: () => void }) {
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const [values, setValues] = useState<Record<string, string>>(
    item
      ? Object.fromEntries(
          fields.map((f) => [f.name, String((item as Record<string, unknown>)[f.name] ?? '')]),
        )
      : blank,
  );
  const [published, setPublished] = useState(item?.published ?? true);
  const [photo, setPhoto] = useState<{ fileId: string | null; url: string | null }>({
    fileId: (item as WithPhoto | null)?.photoFileId ?? null,
    url: (item as WithPhoto | null)?.photoUrl ?? null,
  });
  const [photoProgress, setPhotoProgress] = useState<number | undefined>();
  const [photoError, setPhotoError] = useState<string | undefined>();

  async function choosePhoto(files: File[]) {
    const file = files[0];
    if (!file) return;
    setPhotoError(undefined);
    setPhotoProgress(0);
    try {
      const uploaded = await uploadFile<{ id: string; url: string }>(
        '/files',
        file,
        { purpose: 'SITE_IMAGE' },
        setPhotoProgress,
      ).promise;
      setPhoto({ fileId: uploaded.id, url: uploaded.url });
    } catch (error) {
      setPhotoError(errorMessage(error));
    } finally {
      setPhotoProgress(undefined);
    }
  }
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const body = {
      ...values,
      published,
      ...(photoCopy ? { photoFileId: photo.fileId } : {}),
    };
    const { data, errors: found } = validate(schema, body);
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      if (item) {
        const saved = await saveSite<T>(`${base}/${item.id}`, { method: 'PUT', json: data });
        onItems(items.map((i) => (i.id === item.id ? saved : i)));
      } else {
        const created = await saveSite<T>(base, { method: 'POST', json: data });
        onItems([...items, created]);
      }
      toast.success(copy.saved);
      onClose();
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{item ? copy.editTitle : copy.addTitle}</DialogTitle>
        <DialogDescription className="sr-only">
          {item ? copy.editTitle : copy.addTitle}
        </DialogDescription>
        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-5">
          {formError && Object.keys(errors).length === 0 ? (
            <Alert tone="danger">{formError}</Alert>
          ) : null}
          {fields.map((field, index) =>
            field.multiline ? (
              <TextareaField
                key={field.name}
                label={field.label}
                hint={field.hint}
                optional={field.optional}
                value={values[field.name] ?? ''}
                onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                error={errors[field.name]}
                maxLength={field.maxLength}
                rows={5}
                autoFocus={index === 0}
              />
            ) : (
              <TextField
                key={field.name}
                label={field.label}
                hint={field.hint}
                optional={field.optional}
                value={values[field.name] ?? ''}
                onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                error={errors[field.name]}
                maxLength={field.maxLength}
                autoComplete="off"
                autoFocus={index === 0}
              />
            ),
          )}
          {photoCopy ? (
            <FormField label={photoCopy.label} hint={photoCopy.hint} error={photoError} optional>
              <div className="flex flex-col gap-3">
                {photo.url ? (
                  <div className="flex items-center gap-4">
                    <Avatar name={values.name ?? ''} src={photo.url} size="lg" decorative />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPhoto({ fileId: null, url: null })}
                    >
                      <Trash2 aria-hidden /> {photoCopy.remove}
                    </Button>
                  </div>
                ) : null}
                <FileDrop
                  label={photo.url ? photoCopy.replace : photoCopy.add}
                  hideLabel
                  accept={UPLOAD_LIMITS.image.mimeTypes.join(',')}
                  typesLabel="JPG, PNG, WebP"
                  maxBytes={UPLOAD_LIMITS.image.maxBytes}
                  progress={photoProgress}
                  files={[]}
                  onFilesChange={choosePhoto}
                />
              </div>
            </FormField>
          ) : null}
          <Switch
            label={copy.published}
            description={copy.publishedHint}
            checked={published}
            onCheckedChange={setPublished}
          />
          <FormActions>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                {tc('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              {copy.save}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
