import { Controls } from './_sections/controls';
import { Display } from './_sections/display';
import { Foundations } from './_sections/foundations';
import { Patterns } from './_sections/patterns';

/** Every component in every state, for review at 320 px, tablet and desktop. */
export default function StyleguidePage() {
  return (
    <>
      <header className="mb-10 flex flex-col gap-2">
        <h1 className="text-[1.625rem] font-bold md:text-4xl">Natik design system</h1>
        <p className="max-w-2xl text-muted">
          Calm, clean and light on text. Navy leads, gold marks achievement.
        </p>
      </header>
      <Foundations />
      <Controls />
      <Display />
      <Patterns />
    </>
  );
}
