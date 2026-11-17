import type { ReactNode } from 'react';
import { Container } from '@/components/ui/layout';

/** Closing call to action at the bottom of a page: one message, one main button. */
export function CtaBand({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children: ReactNode;
}) {
  return (
    <section className="on-dark relative overflow-hidden bg-linear-to-br from-primary via-primary to-[#0b2a42] text-white">
      <Container className="flex flex-col items-start gap-3 py-12 md:items-center md:py-16 md:text-center">
        <span className="h-[3px] w-8 rounded-full bg-accent" aria-hidden />
        <h2 className="max-w-2xl text-2xl font-bold text-white md:text-4xl">{title}</h2>
        {text ? <p className="max-w-xl text-base text-white/85 md:text-lg">{text}</p> : null}
        <div className="mt-3 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
          {children}
        </div>
      </Container>
    </section>
  );
}
