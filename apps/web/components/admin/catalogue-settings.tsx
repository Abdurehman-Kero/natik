'use client';

import { languageInputSchema, levelInputSchema } from '@natik/shared';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormActions } from '@/components/ui/form-field';
import { TextField } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/layout';
import { RadioCards } from '@/components/ui/radio-cards';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { LanguageItem, LevelItem } from '@/lib/api/types';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';
import { contentLang } from '@/lib/script';

type Kind = 'languages' | 'levels';

interface Editing {
  kind: Kind;
  item: LanguageItem | LevelItem | null;
}

/** Languages and levels shown in filters and on course forms: add, rename, reorder, hide (FR-CAT-001). */
export function CatalogueSettings({
  languages,
  levels,
}: {
  languages: LanguageItem[];
  levels: LevelItem[];
}) {
  const t = useTranslations('catalogue');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<{ kind: Kind; id: string; name: string } | null>(null);

  async function run(action: () => Promise<unknown>, success?: string) {
    try {
      await action();
      if (success) toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const move = (kind: Kind, ids: string[], index: number, by: -1 | 1) => {
    const next = [...ids];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    return run(() => api(`/admin/${kind}/reorder`, { method: 'POST', json: { ids: next } }));
  };

  function renderList<T extends LanguageItem | LevelItem>(kind: Kind, items: T[]) {
    const ids = items.map((i) => i.id);
    return (
      <ul className="divide-y divide-border">
        {items.map((item, index) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
            <div className="flex min-w-0 flex-1 basis-48 flex-col">
              <span className="truncate font-semibold text-ink" {...contentLang(item.name)}>
                {item.name}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                {'code' in item ? (
                  <>
                    <span>{item.code}</span>
                    <span aria-hidden>·</span>
                    <span>{item.direction === 'RTL' ? t('rtl') : t('ltr')}</span>
                    <span aria-hidden>·</span>
                  </>
                ) : null}
                <span>{t('courses', { count: item.courseCount })}</span>
                {!item.active ? <Badge tone="muted">{t('hidden')}</Badge> : null}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <IconButton
                label={t('moveUp', { name: item.name })}
                disabled={index === 0}
                onClick={() => move(kind, ids, index, -1)}
              >
                <ArrowUp />
              </IconButton>
              <IconButton
                label={t('moveDown', { name: item.name })}
                disabled={index === items.length - 1}
                onClick={() => move(kind, ids, index, 1)}
              >
                <ArrowDown />
              </IconButton>
              <IconButton
                label={t('edit', { name: item.name })}
                onClick={() => setEditing({ kind, item })}
              >
                <Pencil />
              </IconButton>
              {item.courseCount === 0 ? (
                <IconButton
                  label={t('remove', { name: item.name })}
                  onClick={() => setRemoving({ kind, id: item.id, name: item.name })}
                >
                  <Trash2 />
                </IconButton>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        back={{ href: '/admin/settings', label: t('settings') }}
      />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('languagesTitle')}</CardTitle>
            <CardDescription>{t('languagesHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderList('languages', languages)}
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => setEditing({ kind: 'languages', item: null })}
            >
              <Plus aria-hidden /> {t('addLanguage')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('levelsTitle')}</CardTitle>
            <CardDescription>{t('levelsHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderList('levels', levels)}
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => setEditing({ kind: 'levels', item: null })}
            >
              <Plus aria-hidden /> {t('addLevel')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {editing ? (
        <ItemDialog
          key={`${editing.kind}-${editing.item?.id ?? 'new'}`}
          editing={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('removeTitle')}
        description={removing ? t('removeText', { name: removing.name }) : undefined}
        confirmLabel={t('removeCta')}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api(`/admin/${removing.kind}/${removing.id}`, { method: 'DELETE' });
            toast.success(t('removed'));
            router.refresh();
          } catch (error) {
            toast.error(errorMessage(error));
            throw error;
          }
        }}
      />
    </>
  );
}

/** Add or edit one language or level in a small dialog. */
function ItemDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const t = useTranslations('catalogue');
  const tc = useTranslations('common');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const kind = editing.kind;
  const item = editing.item;
  const isLanguage = kind === 'languages';

  const language = item && 'code' in item ? item : null;
  const [name, setName] = useState(item?.name ?? '');
  const [code, setCode] = useState(language?.code ?? '');
  const [direction, setDirection] = useState<'LTR' | 'RTL'>(language?.direction ?? 'LTR');
  const [active, setActive] = useState(item?.active ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const body = isLanguage ? { name, code, direction, active } : { name, active };
    const { data, errors: found } = validate(
      isLanguage ? languageInputSchema : levelInputSchema,
      body,
    );
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      if (item) {
        await api(`/admin/${kind}/${item.id}`, { method: 'PATCH', json: data });
      } else {
        await api(`/admin/${kind}`, { method: 'POST', json: data });
      }
      toast.success(t('saved'));
      onClose();
      router.refresh();
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogTitle>
          {item
            ? isLanguage
              ? t('editLanguageTitle')
              : t('editLevelTitle')
            : isLanguage
              ? t('addLanguageTitle')
              : t('addLevelTitle')}
        </DialogTitle>
        <DialogDescription className="sr-only">{t('subtitle')}</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-5">
          {formError && Object.keys(errors).length === 0 ? (
            <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
              {formError}
            </p>
          ) : null}
          <TextField
            label={t('name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            autoComplete="off"
            autoFocus
          />
          {isLanguage ? (
            <>
              <TextField
                label={t('code')}
                hint={t('codeHint')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={errors.code}
                autoComplete="off"
                spellCheck={false}
              />
              <RadioCards
                label={t('direction')}
                value={direction}
                onValueChange={(v) => setDirection(v as 'LTR' | 'RTL')}
                options={[
                  { value: 'LTR', label: t('ltrLong') },
                  { value: 'RTL', label: t('rtlLong') },
                ]}
              />
            </>
          ) : null}
          <Switch
            label={t('showInLists')}
            description={t('showInListsHint')}
            checked={active}
            onCheckedChange={setActive}
          />
          <FormActions>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                {tc('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              {t('save')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
