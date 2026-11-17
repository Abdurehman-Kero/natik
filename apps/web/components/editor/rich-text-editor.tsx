'use client';

import Image from '@tiptap/extension-image';
import { type Content, EditorContent, Extension, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  PilcrowLeft,
  PilcrowRight,
  Unlink,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormActions } from '@/components/ui/form-field';
import { TextField } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { useErrorMessage } from '@/lib/api/client';
import type { RichTextDoc, UploadedFile } from '@/lib/api/types';
import { uploadFile } from '@/lib/api/upload';
import { cn } from '@/lib/cn';

/** Lets each paragraph and heading be right-to-left or left-to-right on its own (FR-TEACH-003). */
const Direction = Extension.create({
  name: 'direction',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          dir: {
            default: null,
            parseHTML: (element) => {
              const dir = element.getAttribute('dir');
              return dir === 'rtl' || dir === 'ltr' ? dir : null;
            },
            renderHTML: (attributes) => (attributes.dir ? { dir: attributes.dir } : {}),
          },
        },
      },
    ];
  },
});

export interface RichTextEditorProps {
  value: RichTextDoc | null;
  onChange: (doc: RichTextDoc) => void;
  /** Direction and language of the course; new paragraphs start this way. */
  dir: 'ltr' | 'rtl';
  lang?: string;
  label: string;
  /** Needed to add pictures inside the text. Without it the picture button is hidden. */
  imageCourseId?: string;
  minHeightClass?: string;
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-lg text-ink transition-colors hover:bg-primary-soft disabled:opacity-40 [&_svg]:size-5',
        active && 'bg-primary-soft text-primary',
      )}
    >
      {children}
    </button>
  );
}

/**
 * The text editor teachers use for lesson text and course descriptions. A small toolbar on purpose:
 * bold, italic, two heading sizes, lists, links, pictures, and the direction of each paragraph.
 * Loaded on demand (it is the heaviest part of the editor screens).
 */
export default function RichTextEditor({
  value,
  onChange,
  dir,
  lang,
  label,
  imageCourseId,
  minHeightClass = 'min-h-40',
}: RichTextEditorProps) {
  const t = useTranslations('editor');
  const errorMessage = useErrorMessage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
        },
        // Only what lessons can show (the server renders the same list, rich-text.ts).
        code: false,
        codeBlock: false,
        strike: false,
        horizontalRule: false,
      }),
      Image.configure({ inline: false }),
      Direction,
    ],
    content: (value ?? undefined) as Content | undefined,
    editorProps: {
      attributes: {
        class: cn('lesson-prose px-4 py-3 focus:outline-none', minHeightClass),
        dir,
        ...(lang ? { lang } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as RichTextDoc),
  });

  const editorState = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      h2: e?.isActive('heading', { level: 2 }) ?? false,
      h3: e?.isActive('heading', { level: 3 }) ?? false,
      bullet: e?.isActive('bulletList') ?? false,
      ordered: e?.isActive('orderedList') ?? false,
      link: e?.isActive('link') ?? false,
      rtl: (e?.getAttributes('paragraph').dir ?? e?.getAttributes('heading').dir ?? dir) === 'rtl',
    }),
  });

  const state = editorState ?? {
    bold: false,
    italic: false,
    h2: false,
    h3: false,
    bullet: false,
    ordered: false,
    link: false,
    rtl: dir === 'rtl',
  };

  if (!editor) {
    return (
      <div className={cn('rounded-xl border border-border-strong bg-surface', minHeightClass)} />
    );
  }

  const setDirection = (next: 'ltr' | 'rtl') =>
    editor
      .chain()
      .focus()
      .updateAttributes('paragraph', { dir: next })
      .updateAttributes('heading', { dir: next })
      .run();

  function openLink() {
    setLinkUrl((editor?.getAttributes('link').href as string | undefined) ?? 'https://');
    setLinkError(undefined);
    setLinkOpen(true);
  }

  function applyLink(event: FormEvent) {
    event.preventDefault();
    const url = linkUrl.trim();
    if (!/^(https?:\/\/|mailto:|tel:)\S+$/i.test(url)) {
      setLinkError(t('linkInvalid'));
      return;
    }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setLinkOpen(false);
  }

  async function addImage(file: File) {
    if (!imageCourseId) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile<UploadedFile>(
        '/files',
        file,
        { purpose: 'LESSON_IMAGE', courseId: imageCourseId },
        () => undefined,
      ).promise;
      editor?.chain().focus().setImage({ src: uploaded.url, alt: '' }).run();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-strong bg-surface focus-within:outline-2 focus-within:outline-primary">
      <div
        role="toolbar"
        aria-label={t('toolbar')}
        className="flex flex-wrap gap-0.5 border-b border-border bg-canvas px-1.5 py-1"
      >
        <ToolButton
          label={t('bold')}
          active={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold aria-hidden />
        </ToolButton>
        <ToolButton
          label={t('italic')}
          active={state.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic aria-hidden />
        </ToolButton>
        <ToolButton
          label={t('heading2')}
          active={state.h2}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 aria-hidden />
        </ToolButton>
        <ToolButton
          label={t('heading3')}
          active={state.h3}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 aria-hidden />
        </ToolButton>
        <ToolButton
          label={t('bulletList')}
          active={state.bullet}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List aria-hidden />
        </ToolButton>
        <ToolButton
          label={t('numberedList')}
          active={state.ordered}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden />
        </ToolButton>
        <ToolButton
          label={state.link ? t('editLink') : t('link')}
          active={state.link}
          onClick={openLink}
        >
          <Link2 aria-hidden />
        </ToolButton>
        {state.link ? (
          <ToolButton
            label={t('removeLink')}
            onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
          >
            <Unlink aria-hidden />
          </ToolButton>
        ) : null}
        {imageCourseId ? (
          <ToolButton
            label={t('image')}
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus aria-hidden />
          </ToolButton>
        ) : null}
        <span className="mx-1 my-2 w-px bg-border" aria-hidden />
        <ToolButton label={t('rtl')} active={state.rtl} onClick={() => setDirection('rtl')}>
          <PilcrowLeft aria-hidden />
        </ToolButton>
        <ToolButton label={t('ltr')} active={!state.rtl} onClick={() => setDirection('ltr')}>
          <PilcrowRight aria-hidden />
        </ToolButton>
      </div>

      <EditorContent editor={editor} />

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void addImage(file);
        }}
      />

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogTitle>{t('linkTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('linkTitle')}</DialogDescription>
          <form onSubmit={applyLink} noValidate className="mt-5 flex flex-col gap-5">
            <TextField
              label={t('linkAddress')}
              type="url"
              inputMode="url"
              autoComplete="off"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              error={linkError}
              autoFocus
            />
            <FormActions>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  {t('cancel')}
                </Button>
              </DialogClose>
              <Button type="submit">{t('apply')}</Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
