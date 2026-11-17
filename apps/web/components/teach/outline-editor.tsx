'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatPrice } from '@natik/shared';
import {
  AudioLines,
  BookOpen,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Lock,
  MoreHorizontal,
  MoveVertical,
  Pencil,
  Plus,
  Presentation,
  UsersRound,
  Trash2,
  Type,
  Video,
} from 'lucide-react';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton, LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { FormActions } from '@/components/ui/form-field';
import { PageHeader } from '@/components/ui/layout';
import { SelectField } from '@/components/ui/select';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { BlockKind, Outline, OutlineLesson, OutlineUnit } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { contentLang } from '@/lib/script';
import { TitleDialog } from './title-dialog';

const BLOCK_ICON: Record<BlockKind, typeof Type> = {
  TEXT: Type,
  VIDEO: Video,
  PDF: FileText,
  AUDIO: AudioLines,
  IMAGE: ImageIcon,
  SLIDES: Presentation,
};

type Dialogs =
  | { kind: 'addUnit' }
  | { kind: 'renameUnit'; unit: OutlineUnit }
  | { kind: 'addLesson'; unit: OutlineUnit }
  | { kind: 'moveLesson'; lesson: OutlineLesson; fromUnitId: string }
  | { kind: 'deleteUnit'; unit: OutlineUnit }
  | { kind: 'deleteLesson'; lesson: OutlineLesson };

/**
 * The course content tree: units and the lessons inside them (FR-TEACH-002). Drag the handle to
 * reorder, or use "Move up / Move down" in the menu (keyboard and touch friendly, FR-TEACH-008).
 * Published items can only be hidden, never deleted, so student results are kept.
 */
export function OutlineEditor({ initial }: { initial: Outline }) {
  const t = useTranslations('outline');
  const ts = useTranslations('teachStudents');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [outline, setOutline] = useState(initial);
  const [dialog, setDialog] = useState<Dialogs | null>(null);
  const course = outline.course;
  const units = outline.units;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function reload() {
    setOutline(await api<Outline>(`/teach/courses/${course.id}/outline`));
  }

  /** Runs a change on the server, then refreshes the tree. Failures show a plain message. */
  async function act(action: () => Promise<unknown>, success?: string): Promise<boolean> {
    try {
      await action();
      await reload();
      if (success) toast.success(success);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  async function persistUnitOrder(next: OutlineUnit[]) {
    const previous = outline;
    setOutline({ ...outline, units: next });
    try {
      await api(`/teach/courses/${course.id}/units/reorder`, {
        method: 'POST',
        json: { ids: next.map((u) => u.id) },
      });
    } catch (error) {
      setOutline(previous);
      toast.error(errorMessage(error));
    }
  }

  async function persistLessonOrder(next: OutlineUnit[], changedUnitIds: string[]) {
    const previous = outline;
    setOutline({ ...outline, units: next });
    try {
      await api(`/teach/courses/${course.id}/lessons/reorder`, {
        method: 'POST',
        json: {
          units: next
            .filter((u) => changedUnitIds.includes(u.id))
            .map((u) => ({ unitId: u.id, lessonIds: u.lessons.map((l) => l.id) })),
        },
      });
    } catch (error) {
      setOutline(previous);
      toast.error(errorMessage(error));
    }
  }

  function onUnitDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = units.findIndex((u) => u.id === active.id);
    const to = units.findIndex((u) => u.id === over.id);
    if (from < 0 || to < 0) return;
    void persistUnitOrder(arrayMove(units, from, to));
  }

  function moveUnit(index: number, by: -1 | 1) {
    const to = index + by;
    if (to < 0 || to >= units.length) return;
    void persistUnitOrder(arrayMove(units, index, to));
  }

  function onLessonDragEnd(unitId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = units.map((u) => {
      if (u.id !== unitId) return u;
      const from = u.lessons.findIndex((l) => l.id === active.id);
      const to = u.lessons.findIndex((l) => l.id === over.id);
      return from < 0 || to < 0 ? u : { ...u, lessons: arrayMove(u.lessons, from, to) };
    });
    void persistLessonOrder(next, [unitId]);
  }

  function moveLesson(unitId: string, index: number, by: -1 | 1) {
    const next = units.map((u) => {
      if (u.id !== unitId) return u;
      const to = index + by;
      return to < 0 || to >= u.lessons.length
        ? u
        : { ...u, lessons: arrayMove(u.lessons, index, to) };
    });
    void persistLessonOrder(next, [unitId]);
  }

  const setUnitStatus = (unit: OutlineUnit, to: 'publish' | 'hide') =>
    act(
      () => api(`/teach/units/${unit.id}/${to}`, { method: 'POST' }),
      to === 'publish' ? t('unitPublished') : t('unitHidden'),
    );

  const setLessonStatus = (lesson: OutlineLesson, to: 'publish' | 'hide') =>
    act(
      () => api(`/teach/lessons/${lesson.id}/${to}`, { method: 'POST' }),
      to === 'publish' ? t('lessonPublished') : t('lessonHidden'),
    );

  const settingsLine = [
    course.language.name,
    course.level,
    formatPrice(course.access, course.priceSantim, t('free')),
  ].join(' · ');

  return (
    <>
      <PageHeader
        title={course.title}
        back={{ href: '/teach/courses', label: t('myCourses') }}
        action={
          <>
            <LinkButton href={`/teach/courses/${course.id}/students`} variant="secondary">
              <UsersRound aria-hidden /> {ts('title')}
            </LinkButton>
            <Button onClick={() => setDialog({ kind: 'addUnit' })}>
              <Plus aria-hidden /> {t('addUnit')}
            </Button>
          </>
        }
      />
      <p className="-mt-3 mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
        <StatusPill status={`content.${course.status}`} />
        <span>{settingsLine}</span>
        <span className="inline-flex items-center gap-1.5">
          <Lock className="size-3.5" aria-hidden />
          {course.canEditSettings ? (
            <Link
              href={`/admin/courses/${course.id}`}
              className="font-semibold text-primary underline underline-offset-4"
            >
              {t('editSettings')}
            </Link>
          ) : (
            t('settingsByAdmin')
          )}
        </span>
      </p>

      {units.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={t('empty')}
            description={t('emptyText')}
            action={
              <Button onClick={() => setDialog({ kind: 'addUnit' })}>
                <Plus aria-hidden /> {t('addUnit')}
              </Button>
            }
          />
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onUnitDragEnd}>
          <SortableContext items={units.map((u) => u.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-4">
              {units.map((unit, unitIndex) => (
                <SortableCard key={unit.id} id={unit.id} as="li">
                  {(handle) => (
                    <Card className="overflow-hidden p-0">
                      <div className="flex items-center gap-1 border-b border-border bg-canvas px-2 py-2">
                        {handle}
                        <h2
                          className="min-w-0 flex-1 truncate text-base font-semibold"
                          {...contentLang(unit.title)}
                        >
                          <span className="text-muted">
                            {t('unit', { number: unitIndex + 1 })} ·{' '}
                          </span>
                          {unit.title}
                        </h2>
                        <StatusPill status={`content.${unit.status}`} size="sm" />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton label={t('unitActions', { title: unit.title })}>
                              <MoreHorizontal />
                            </IconButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onSelect={() => setDialog({ kind: 'renameUnit', unit })}
                            >
                              <Pencil aria-hidden /> {t('rename')}
                            </DropdownMenuItem>
                            {unit.status === 'PUBLISHED' ? (
                              <DropdownMenuItem onSelect={() => setUnitStatus(unit, 'hide')}>
                                <EyeOff aria-hidden /> {t('hide')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => setUnitStatus(unit, 'publish')}>
                                <Eye aria-hidden />{' '}
                                {unit.status === 'HIDDEN' ? t('publishAgain') : t('publish')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              disabled={unitIndex === 0}
                              onSelect={() => moveUnit(unitIndex, -1)}
                            >
                              <MoveVertical aria-hidden /> {t('moveUp')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={unitIndex === units.length - 1}
                              onSelect={() => moveUnit(unitIndex, 1)}
                            >
                              <MoveVertical aria-hidden /> {t('moveDown')}
                            </DropdownMenuItem>
                            {unit.status === 'DRAFT' ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  tone="danger"
                                  onSelect={() => setDialog({ kind: 'deleteUnit', unit })}
                                >
                                  <Trash2 aria-hidden /> {t('delete')}
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => onLessonDragEnd(unit.id, event)}
                      >
                        <SortableContext
                          items={unit.lessons.map((l) => l.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <ol className="divide-y divide-border">
                            {unit.lessons.map((lesson, lessonIndex) => (
                              <SortableCard key={lesson.id} id={lesson.id} as="li">
                                {(lessonHandle) => (
                                  <div className="flex items-center gap-1 px-2 py-1.5">
                                    {lessonHandle}
                                    <Link
                                      href={`/teach/courses/${course.id}/lessons/${lesson.id}`}
                                      className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 hover:bg-primary-soft"
                                    >
                                      <span className="w-5 shrink-0 text-sm text-muted tabular-nums">
                                        {lessonIndex + 1}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span
                                          className="block truncate font-medium text-ink"
                                          {...contentLang(lesson.title)}
                                        >
                                          {lesson.title}
                                        </span>
                                        <span className="mt-0.5 flex items-center gap-2 text-muted">
                                          {lesson.blockTypes.slice(0, 5).map((type, i) => {
                                            const Icon = BLOCK_ICON[type];
                                            return (
                                              <Icon
                                                key={`${type}-${i}`}
                                                className="size-3.5"
                                                aria-hidden
                                              />
                                            );
                                          })}
                                          {lesson.blockTypes.length === 0 ? (
                                            <span className="text-xs">{t('noBlocks')}</span>
                                          ) : null}
                                          {lesson.isFreePreview ? (
                                            <Badge tone="accent">{t('freePreview')}</Badge>
                                          ) : null}
                                        </span>
                                      </span>
                                    </Link>
                                    <StatusPill status={`content.${lesson.status}`} size="sm" />
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <IconButton
                                          label={t('lessonActions', { title: lesson.title })}
                                        >
                                          <MoreHorizontal />
                                        </IconButton>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent>
                                        <DropdownMenuItem asChild>
                                          <Link
                                            href={`/teach/courses/${course.id}/lessons/${lesson.id}`}
                                          >
                                            <Pencil aria-hidden /> {t('edit')}
                                          </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                          <Link
                                            href={`/teach/courses/${course.id}/lessons/${lesson.id}/preview`}
                                          >
                                            <Eye aria-hidden /> {t('preview')}
                                          </Link>
                                        </DropdownMenuItem>
                                        {lesson.status === 'PUBLISHED' ? (
                                          <DropdownMenuItem
                                            onSelect={() => setLessonStatus(lesson, 'hide')}
                                          >
                                            <EyeOff aria-hidden /> {t('hide')}
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem
                                            onSelect={() => setLessonStatus(lesson, 'publish')}
                                          >
                                            <Eye aria-hidden />{' '}
                                            {lesson.status === 'HIDDEN'
                                              ? t('publishAgain')
                                              : t('publish')}
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          disabled={lessonIndex === 0}
                                          onSelect={() => moveLesson(unit.id, lessonIndex, -1)}
                                        >
                                          <MoveVertical aria-hidden /> {t('moveUp')}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          disabled={lessonIndex === unit.lessons.length - 1}
                                          onSelect={() => moveLesson(unit.id, lessonIndex, 1)}
                                        >
                                          <MoveVertical aria-hidden /> {t('moveDown')}
                                        </DropdownMenuItem>
                                        {units.length > 1 ? (
                                          <DropdownMenuItem
                                            onSelect={() =>
                                              setDialog({
                                                kind: 'moveLesson',
                                                lesson,
                                                fromUnitId: unit.id,
                                              })
                                            }
                                          >
                                            <MoveVertical aria-hidden /> {t('moveToUnit')}
                                          </DropdownMenuItem>
                                        ) : null}
                                        {lesson.status === 'DRAFT' ? (
                                          <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              tone="danger"
                                              onSelect={() =>
                                                setDialog({ kind: 'deleteLesson', lesson })
                                              }
                                            >
                                              <Trash2 aria-hidden /> {t('delete')}
                                            </DropdownMenuItem>
                                          </>
                                        ) : null}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                )}
                              </SortableCard>
                            ))}
                          </ol>
                        </SortableContext>
                      </DndContext>

                      <div className="border-t border-border px-3 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDialog({ kind: 'addLesson', unit })}
                        >
                          <Plus aria-hidden /> {t('addLesson')}
                        </Button>
                      </div>
                    </Card>
                  )}
                </SortableCard>
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {dialog?.kind === 'addUnit' ? (
        <TitleDialog
          title={t('addUnit')}
          label={t('unitTitle')}
          submitLabel={t('add')}
          onClose={() => setDialog(null)}
          onSubmit={async (title) => {
            await api(`/teach/courses/${course.id}/units`, { method: 'POST', json: { title } });
            await reload();
            toast.success(t('unitAdded'));
          }}
        />
      ) : null}
      {dialog?.kind === 'renameUnit' ? (
        <TitleDialog
          title={t('rename')}
          label={t('unitTitle')}
          initial={dialog.unit.title}
          submitLabel={t('save')}
          onClose={() => setDialog(null)}
          onSubmit={async (title) => {
            await api(`/teach/units/${dialog.unit.id}`, { method: 'PATCH', json: { title } });
            await reload();
          }}
        />
      ) : null}
      {dialog?.kind === 'addLesson' ? (
        <TitleDialog
          title={t('addLesson')}
          label={t('lessonTitle')}
          submitLabel={t('add')}
          onClose={() => setDialog(null)}
          onSubmit={async (title) => {
            const created = await api<{ id: string }>(`/teach/units/${dialog.unit.id}/lessons`, {
              method: 'POST',
              json: { title },
            });
            router.push(`/teach/courses/${course.id}/lessons/${created.id}`);
            // We are leaving this page; keep the dialog busy until we have.
            await new Promise(() => undefined);
          }}
        />
      ) : null}
      {dialog?.kind === 'moveLesson' ? (
        <MoveLessonDialog
          lesson={dialog.lesson}
          units={units.filter((u) => u.id !== dialog.fromUnitId)}
          onClose={() => setDialog(null)}
          onMove={async (toUnitId) => {
            const next = units.map((u) => {
              if (u.id === dialog.fromUnitId)
                return { ...u, lessons: u.lessons.filter((l) => l.id !== dialog.lesson.id) };
              if (u.id === toUnitId) return { ...u, lessons: [...u.lessons, dialog.lesson] };
              return u;
            });
            await api(`/teach/courses/${course.id}/lessons/reorder`, {
              method: 'POST',
              json: {
                units: next
                  .filter((u) => u.id === dialog.fromUnitId || u.id === toUnitId)
                  .map((u) => ({ unitId: u.id, lessonIds: u.lessons.map((l) => l.id) })),
              },
            });
            await reload();
            toast.success(t('lessonMoved'));
          }}
        />
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === 'deleteUnit'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t('deleteUnitTitle')}
        description={t('deleteUnitText')}
        confirmLabel={t('delete')}
        onConfirm={async () => {
          if (dialog?.kind !== 'deleteUnit') return;
          const ok = await act(
            () => api(`/teach/units/${dialog.unit.id}`, { method: 'DELETE' }),
            t('deleted'),
          );
          if (!ok) throw new Error('failed');
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === 'deleteLesson'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t('deleteLessonTitle')}
        description={t('deleteLessonText')}
        confirmLabel={t('delete')}
        onConfirm={async () => {
          if (dialog?.kind !== 'deleteLesson') return;
          const ok = await act(
            () => api(`/teach/lessons/${dialog.lesson.id}`, { method: 'DELETE' }),
            t('deleted'),
          );
          if (!ok) throw new Error('failed');
        }}
      />

      <p className="mt-6 text-sm text-muted">{t('rulesNote')}</p>
      <div className="mt-4">
        <LinkButton href="/teach/courses" variant="secondary">
          {t('myCourses')}
        </LinkButton>
      </div>
    </>
  );
}

/** A list item that can be dragged by its handle. */
function SortableCard({
  id,
  as: Tag = 'div',
  children,
}: {
  id: string;
  as?: 'li' | 'div';
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const t = useTranslations('outline');
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label={t('dragHandle')}
      className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted hover:bg-primary-soft hover:text-primary active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-5" aria-hidden />
    </button>
  );
  return (
    <Tag
      ref={setNodeRef as never}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative bg-surface', isDragging && 'z-10 opacity-90 shadow-overlay')}
    >
      {children(handle)}
    </Tag>
  );
}

function MoveLessonDialog({
  lesson,
  units,
  onClose,
  onMove,
}: {
  lesson: OutlineLesson;
  units: OutlineUnit[];
  onClose: () => void;
  onMove: (unitId: string) => Promise<void>;
}) {
  const t = useTranslations('outline');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const [unitId, setUnitId] = useState(units[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{t('moveToUnit')}</DialogTitle>
        <DialogDescription>{lesson.title}</DialogDescription>
        <form
          className="mt-5 flex flex-col gap-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await onMove(unitId);
              onClose();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <SelectField
            label={t('chooseUnit')}
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            options={units.map((u) => ({ value: u.id, label: u.title }))}
            error={error}
          />
          <FormActions>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                {tc('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              {t('move')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
