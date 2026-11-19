'use client';

import type { ReactNode } from 'react';
import { type SiteTool, useSiteTools } from '@/components/public/site-tools';
import { useTour } from '@/components/tour/site-tour';
import { type buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { buttonVariants as variants } from '@/components/ui/button';
import type { VariantProps } from 'class-variance-authority';

type Look = {
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
};

/** A button that opens one of the quick dialogs (search, message the team, verify, find your level). */
export function ToolButton({
  tool,
  children,
  className,
  plain,
  ...look
}: {
  tool: SiteTool;
  children: ReactNode;
  className?: string;
  /** Unstyled, for lists of links such as the footer. */
  plain?: boolean;
} & Look) {
  const tools = useSiteTools();
  return (
    <button
      type="button"
      onClick={() => tools.open(tool)}
      className={cn(plain ? '' : variants(look), className)}
    >
      {children}
    </button>
  );
}

/** A button that starts the guided tour. */
export function TourButton({
  children,
  className,
  plain,
  ...look
}: { children: ReactNode; className?: string; plain?: boolean } & Look) {
  const tour = useTour();
  return (
    <button
      type="button"
      onClick={tour.start}
      className={cn(plain ? '' : variants(look), className)}
    >
      {children}
    </button>
  );
}
