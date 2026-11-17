'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

/** The text editor is loaded only on the screens that need it, so other pages stay light. */
export const RichTextEditor = dynamic(() => import('./rich-text-editor'), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full rounded-xl" />,
});

export type { RichTextEditorProps } from './rich-text-editor';
