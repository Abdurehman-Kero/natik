'use client';

import { ArrowRight, Crown, Gift, GraduationCap } from 'lucide-react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import Link from '@/components/ui/link';
import { cn } from '@/lib/cn';

export interface ShowcaseGroup {
  value: 'free' | 'premium' | 'teachers';
  label: string;
  /** Rendered on the server: the cards. */
  content: ReactNode;
  seeAll: { href: string; label: string };
}

const ICONS = { free: Gift, premium: Crown, teachers: GraduationCap } as const;

/**
 * "See what you can do": pill tabs (free courses, premium courses, teachers) over one soft panel with
 * a row of compact cards and a "see all" link. With only one tab, the pills are not shown.
 */
export function CoursesShowcase({ groups }: { groups: ShowcaseGroup[] }) {
  const panel = (group: ShowcaseGroup) => (
    <div className="flex w-full flex-col gap-6 rounded-3xl border border-border bg-surface/70 p-4 shadow-card md:p-6">
      {group.content}
      <Link
        href={group.seeAll.href}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 self-center font-semibold text-primary hover:underline"
      >
        {group.seeAll.label}
        <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
      </Link>
    </div>
  );

  if (groups.length === 1) return panel(groups[0]!);

  return (
    <TabsPrimitive.Root
      defaultValue={groups[0]!.value}
      className="flex flex-col items-center gap-8"
    >
      <TabsPrimitive.List className="flex max-w-full [scrollbar-width:none] gap-1 overflow-x-auto rounded-full bg-primary-soft/70 p-1.5 [&::-webkit-scrollbar]:hidden">
        {groups.map((group) => {
          const Icon = ICONS[group.value];
          return (
            <TabsPrimitive.Trigger
              key={group.value}
              value={group.value}
              className={cn(
                'flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 font-semibold text-muted transition-colors hover:text-primary sm:px-5',
                'data-[state=active]:bg-surface data-[state=active]:text-primary data-[state=active]:shadow-card',
              )}
            >
              <Icon className="size-4.5" aria-hidden />
              {group.label}
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>
      {groups.map((group) => (
        <TabsPrimitive.Content
          key={group.value}
          value={group.value}
          className="w-full data-[state=inactive]:hidden"
        >
          {panel(group)}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
