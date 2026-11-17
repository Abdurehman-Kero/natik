'use client';

import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const Tabs = TabsPrimitive.Root;

/** Underlined tabs; scrolls sideways on narrow screens instead of wrapping. */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex [scrollbar-width:none] gap-1 overflow-x-auto border-b border-border [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative min-h-11 shrink-0 px-3 font-semibold whitespace-nowrap text-muted transition-colors hover:text-primary',
        'data-[state=active]:text-primary',
        'after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-full after:bg-transparent',
        'data-[state=active]:after:bg-accent',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('pt-5 focus-visible:outline-offset-4', className)}
      {...props}
    />
  );
}
