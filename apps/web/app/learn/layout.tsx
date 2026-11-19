import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/client-messages';
import { PageFade } from '@/components/brand/page-fade';
import { Container } from '@/components/ui/layout';

/**
 * The learning screens (course outline and lessons) use the whole phone screen: no bottom tabs, just
 * the lesson and its own sticky bar. Each page checks that the visitor is a signed-in student.
 */
export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <ClientMessages area="learn">
      <div className="min-h-dvh bg-canvas">
        <Container
          as="main"
          id="main"
          tabIndex={-1}
          size="reading"
          className="py-4 pb-32 focus:outline-none md:py-8"
        >
          <PageFade>{children}</PageFade>
        </Container>
      </div>
    </ClientMessages>
  );
}
