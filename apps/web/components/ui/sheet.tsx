'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

const sideClass = {
  right: 'inset-y-0 right-0 h-full w-[min(20rem,88vw)] data-[state=open]:animate-slide-in-right',
  left: 'inset-y-0 left-0 h-full w-[min(20rem,88vw)] data-[state=open]:animate-slide-in-left',
  bottom: 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl data-[state=open]:animate-slide-in-up',
} as const;

/** Side panel for mobile menus and filters. Focus is trapped; Esc and tapping outside close it. */
export function SheetContent({
  side = 'right',
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { side?: keyof typeof sideClass }) {
  const t = useTranslations('nav');
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/50 data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col overflow-y-auto bg-surface pb-safe shadow-overlay',
          sideClass[side],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
          aria-label={t('closeMenu')}
        >
          <X className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
