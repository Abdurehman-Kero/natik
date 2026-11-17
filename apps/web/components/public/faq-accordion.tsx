'use client';

import { ChevronDown } from 'lucide-react';
import { Accordion } from 'radix-ui';

export interface FaqItem {
  q: string;
  a: string;
}

/** Questions open one at a time. Large tap targets, keyboard friendly. */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <Accordion.Root
      type="single"
      collapsible
      className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
    >
      {items.map((item, index) => (
        <Accordion.Item key={item.q} value={`q-${index}`}>
          <Accordion.Header className="m-0">
            <Accordion.Trigger className="group flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-ink hover:bg-canvas md:px-7 md:text-lg">
              <span>{item.q}</span>
              <ChevronDown
                className="size-5 shrink-0 text-primary transition-transform duration-200 group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:hidden">
            <p className="px-5 pb-6 text-muted md:px-7">{item.a}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
