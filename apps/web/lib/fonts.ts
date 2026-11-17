import { Inter, Montserrat, Noto_Naskh_Arabic, Noto_Sans_Ethiopic } from 'next/font/google';

/** Body and interface text. */
const inter = Inter({ subsets: ['latin'], variable: '--nf-inter', display: 'swap' });

/** Headings: echoes the logo's "NATIK" wordmark. */
const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--nf-montserrat',
  display: 'swap',
});

/**
 * Content fonts. preload: false means the browser only downloads them when Arabic or
 * Ethiopic text is actually on the page (keeps public pages light, NFR-PERF-001).
 */
const naskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  variable: '--nf-naskh',
  display: 'swap',
  preload: false,
});

const ethiopic = Noto_Sans_Ethiopic({
  subsets: ['ethiopic'],
  variable: '--nf-ethiopic',
  display: 'swap',
  preload: false,
});

export const fontVariables = [inter, montserrat, naskh, ethiopic].map((f) => f.variable).join(' ');
