import { Demo, Section } from './section';

const COLOURS = [
  { name: 'primary', hex: '#123B5A', use: 'Buttons, links, headings', className: 'bg-primary' },
  {
    name: 'primary-soft',
    hex: '#E8EEF3',
    use: 'Selected rows, soft pills',
    className: 'bg-primary-soft',
  },
  { name: 'accent', hex: '#B69A4A', use: 'Gold accents only', className: 'bg-accent' },
  {
    name: 'accent-strong',
    hex: '#7A6428',
    use: 'Gold text (5.7:1)',
    className: 'bg-accent-strong',
  },
  {
    name: 'accent-soft',
    hex: '#F4EFE1',
    use: 'Completed, certificates',
    className: 'bg-accent-soft',
  },
  { name: 'canvas', hex: '#F7F6F2', use: 'Page background', className: 'bg-canvas' },
  { name: 'surface', hex: '#FFFFFF', use: 'Cards, inputs', className: 'bg-surface' },
  { name: 'ink', hex: '#202A32', use: 'Body text', className: 'bg-ink' },
  { name: 'muted', hex: '#5B6670', use: 'Secondary text', className: 'bg-muted' },
  { name: 'border', hex: '#E5E1D6', use: 'Card borders', className: 'bg-border' },
  { name: 'border-strong', hex: '#8A9096', use: 'Input borders', className: 'bg-border-strong' },
  { name: 'success', hex: '#276B43', use: 'Confirmed, published', className: 'bg-success' },
  { name: 'warning', hex: '#8A5A00', use: 'Under review', className: 'bg-warning' },
  { name: 'danger', hex: '#B42318', use: 'Errors, destructive', className: 'bg-danger' },
];

export function Foundations() {
  return (
    <>
      <Section
        id="colours"
        title="Colours"
        note="Brand palette from SRS D9 and the logo. Gold is for accents, never body text."
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {COLOURS.map((c) => (
            <li key={c.name} className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className={`${c.className} h-20 border-b border-border`} aria-hidden />
              <div className="p-3">
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="font-mono text-sm text-ink">{c.hex}</p>
                <p className="text-sm text-muted">{c.use}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="type"
        title="Type"
        note="Montserrat for headings (echoes the logo), Inter for reading. Body never below 16 px on phones."
      >
        <Demo title="Scale" className="flex flex-col gap-4">
          <p className="font-heading text-[2rem] leading-[1.15] font-bold text-primary md:text-5xl">
            Display · Learn with Natik
          </p>
          <p className="font-heading text-[1.625rem] font-bold text-primary md:text-4xl">
            H1 · Page title
          </p>
          <p className="font-heading text-[1.375rem] font-semibold text-primary md:text-[1.75rem]">
            H2 · Section heading
          </p>
          <p className="font-heading text-lg font-semibold text-primary md:text-xl">
            H3 · Card title
          </p>
          <p className="text-base">Body · Short, friendly sentences. One idea per line.</p>
          <p className="text-sm text-muted">Small · Meta text like dates and counts</p>
        </Demo>
        <Demo title="Content languages" className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="mb-1 text-sm text-muted">Arabic (RTL, Noto Naskh)</p>
            <p lang="ar" dir="rtl" className="content-arabic">
              الْعَرَبِيَّةُ لُغَةٌ جَمِيلَةٌ
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm text-muted">Amharic (Noto Sans Ethiopic)</p>
            <p lang="am" className="text-lg">
              የቋንቋ ማዕከል
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm text-muted">Afaan Oromo (Latin)</p>
            <p lang="om" className="text-lg">
              Akkam jirta? Barumsa gaarii!
            </p>
          </div>
        </Demo>
      </Section>
    </>
  );
}
