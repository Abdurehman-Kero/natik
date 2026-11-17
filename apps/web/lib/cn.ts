import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge about the custom shadow tokens so they override each other correctly.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ['card', 'raised', 'overlay'],
    },
  },
});

/** Merge class names; later Tailwind classes win over earlier conflicting ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
