'use client';

import { Crown, Gift } from 'lucide-react';
import Link from '@/components/ui/link';
import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Group {
  value: 'free' | 'premium';
  label: string;
  /** Rendered on the server: the course cards. */
  content: ReactNode;
  seeAll: { href: string; label: string };
}

/**
 * Free and premium courses side by side as two tabs, so a visitor picks what suits them without
 * scrolling through one long mixed list. With only one kind of course, the tabs are not shown.
 */
export function CoursesShowcase({ groups }: { groups: Group[] }) {
  if (groups.length === 1) {
    const only = groups[0]!;
    return (
      <div className="flex flex-col items-center gap-8">
        {only.content}
        <Link href={only.seeAll.href} className="font-semibold text-primary hover:underline">
          {only.seeAll.label}
        </Link>
      </div>
    );
  }
  return (
    <TabsPrimitive.Root
      defaultValue={groups[0]!.value}
      className="flex flex-col items-center gap-8"
    >
      <TabsPrimitive.List className="flex w-full max-w-sm rounded-full border border-border bg-surface p-1.5 shadow-card">
        {groups.map((group) => (
          <TabsPrimitive.Trigger
            key={group.value}
            value={group.value}
            className={cn(
              'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 font-semibold text-ink transition-colors hover:text-primary',
              'data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-raised',
            )}
          >
            {group.value === 'free' ? (
              <Gift className="size-4.5" aria-hidden />
            ) : (
              <Crown className="size-4.5" aria-hidden />
            )}
            {group.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {groups.map((group) => (
        <TabsPrimitive.Content
          key={group.value}
          value={group.value}
          className="flex w-full flex-col items-center gap-8 data-[state=inactive]:hidden"
        >
          {group.content}
          <Link
            href={group.seeAll.href}
            className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
          >
            {group.seeAll.label}
          </Link>
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
