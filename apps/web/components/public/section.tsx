import type { ReactNode } from 'react';
import { Container, SectionHeading, type SectionHeadingProps } from '@/components/ui/layout';
import { cn } from '@/lib/cn';

export interface PublicSectionProps {
  title?: string;
  /** One line under the heading. */
  intro?: string;
  /** Small label above the title. */
  eyebrow?: string;
  link?: SectionHeadingProps['link'];
  /** "white" bands alternate with the off-white page for rhythm on long pages. */
  tone?: 'canvas' | 'white' | 'soft';
  size?: 'page' | 'reading';
  id?: string;
  className?: string;
  children: ReactNode;
}

/** One block of a public page: consistent spacing, heading with the gold bar, alternating background. */
export function PublicSection({
  title,
  intro,
  eyebrow,
  link,
  tone = 'canvas',
  size = 'page',
  id,
  className,
  children,
}: PublicSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        // Not drawn until near the screen, so long pages open and scroll quickly.
        'py-14 [contain-intrinsic-size:auto_720px] [content-visibility:auto] md:py-24',
        tone === 'white' && 'bg-surface',
        tone === 'soft' && 'bg-linear-to-b from-primary-soft/70 to-canvas',
      )}
    >
      <Container size={size} className={className}>
        {title ? (
          <SectionHeading
            title={title}
            eyebrow={eyebrow}
            link={link}
            large
            className={intro ? 'mb-3 md:mb-3' : 'mb-8 md:mb-12'}
          />
        ) : null}
        {intro ? (
          <p className="mx-auto mb-8 max-w-2xl text-center text-base text-muted md:mb-12 md:text-lg">
            {intro}
          </p>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
