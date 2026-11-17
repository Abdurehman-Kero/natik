import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const tones = {
  danger: { box: 'bg-danger-soft text-danger', icon: CircleAlert, role: 'alert' as const },
  warning: { box: 'bg-warning-soft text-warning', icon: TriangleAlert, role: 'status' as const },
  success: { box: 'bg-success-soft text-success', icon: CircleCheck, role: 'status' as const },
  info: { box: 'bg-primary-soft text-primary', icon: Info, role: 'status' as const },
};

/** A short message inside a page or form: what happened, and (optionally) what to do next. */
export function Alert({
  tone = 'info',
  children,
  action,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon, role } = tones[tone];
  return (
    <div
      role={role}
      className={cn('flex flex-col gap-2 rounded-lg px-4 py-3 text-sm font-medium', box, className)}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {action ? <div className="pl-6.5">{action}</div> : null}
    </div>
  );
}
