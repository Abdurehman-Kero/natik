'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface CourseTab {
  id: string;
  label: string;
  /** Name of the icon, so a server page can pass it without sending a function across. */
  icon: ReactNode;
  content: ReactNode;
}

/** Overview · Content · Instructor: the panels are built on the server, this only switches them. */
export function CourseTabs({ tabs, label }: { tabs: CourseTab[]; label: string }) {
  return (
    <Tabs defaultValue={tabs[0]!.id}>
      <TabsList aria-label={label} className="grid grid-cols-3 gap-0">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="flex items-center justify-center gap-2 px-2 [&_svg]:size-4.5"
          >
            {tab.icon}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="flex flex-col gap-5 pt-6">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export type { LucideIcon };
