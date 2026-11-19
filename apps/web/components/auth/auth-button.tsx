'use client';

import type { VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { AuthLink, type AuthMode } from '@/components/auth/auth-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/** A button that opens the sign-in or register dialog (and still works as a link without JavaScript). */
export function AuthButton({
  mode,
  next,
  variant,
  size,
  fullWidth,
  className,
  children,
}: {
  mode: AuthMode;
  next?: string;
  className?: string;
  children: ReactNode;
} & VariantProps<typeof buttonVariants>) {
  return (
    <AuthLink
      mode={mode}
      next={next}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
    >
      {children}
    </AuthLink>
  );
}
