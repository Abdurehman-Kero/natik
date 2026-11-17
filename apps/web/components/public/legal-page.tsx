import { PageHero } from './page-hero';
import { PublicSection } from './section';

export interface LegalSection {
  h: string;
  p: string[];
}

/** Privacy and Terms: a readable column, short numbered sections. */
export function LegalPage({
  title,
  subtitle,
  updated,
  sections,
}: {
  title: string;
  subtitle: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <PageHero title={title} subtitle={subtitle} />
      <PublicSection size="reading">
        <p className="mb-8 text-sm font-medium text-muted">{updated}</p>
        <div className="flex flex-col gap-8">
          {sections.map((section, index) => (
            <section key={section.h} className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">
                <span className="mr-2 text-accent-strong">{index + 1}.</span>
                {section.h}
              </h2>
              {section.p.map((paragraph) => (
                <p key={paragraph} className="text-ink/90">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </PublicSection>
    </>
  );
}
