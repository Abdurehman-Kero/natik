'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** The two sub-tabs of the Help page: the video and the written guide. The panels come from the server. */
export function HelpTabs({
  tabs,
  label,
}: {
  tabs: { id: string; label: string; icon: ReactNode; content: ReactNode }[];
  label: string;
}) {
  return (
    <Tabs defaultValue={tabs[0]!.id}>
      <TabsList aria-label={label} className="grid grid-cols-2 gap-0">
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
        <TabsContent key={tab.id} value={tab.id} className="pt-6">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
