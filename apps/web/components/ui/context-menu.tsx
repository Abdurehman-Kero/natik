'use client';

import { ContextMenu as Menu } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** A menu that opens on right-click (and on a long press on touch screens), like Telegram's. */
export const ContextMenu = Menu.Root;
export const ContextMenuTrigger = Menu.Trigger;

export function ContextMenuContent({ className, ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-overlay data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

export function ContextMenuItem({
  className,
  tone = 'default',
  ...props
}: ComponentProps<typeof Menu.Item> & { tone?: 'default' | 'danger' }) {
  return (
    <Menu.Item
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-base outline-none select-none [&_svg]:size-4.5',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        tone === 'danger'
          ? 'text-danger data-[highlighted]:bg-danger-soft'
          : 'text-ink data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary',
        className,
      )}
      {...props}
    />
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('my-1 h-px bg-border', className)} {...props} />;
}
