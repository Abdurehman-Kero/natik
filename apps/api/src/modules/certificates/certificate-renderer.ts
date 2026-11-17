import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { TIME_ZONE } from '@natik/shared';
import { chromium } from 'playwright-core';
import QRCode from 'qrcode';
import { LOGO_PNG_BASE64 } from './certificate-logo';
import { MARK_PNG_BASE64 } from './certificate-mark';

export interface CertificateData {
  number: string;
  studentName: string;
  courseTitle: string;
  /** The course's language and level, printed under the course name ("Arabic · Beginner"). */
  languageName?: string | null;
  levelName?: string | null;
  /** The date printed at the bottom: when the certificate was approved and issued. */
  issuedAt: Date;
  /** When the course was finished, for the citation. Defaults to the issue date. */
  completedAt?: Date;
  signatoryName: string;
  signatoryTitle: string;
  /** A `data:` URL of the signature picture, if one was uploaded. */
  signatureDataUrl: string | null;
  /** Where the QR code points: the public verify page with the number filled in. */
  verifyUrl: string;
}

/* Natik brand colours (DESIGN.md): deep navy and the logo's gold, on warm ivory paper. */
const NAVY = '#123B5A';
const NAVY_DEEP = '#0B2A42';
const GOLD = '#B69A4A';
const INK = '#202A32';

const require_ = createRequire(__filename);

/** One font file as a data URL, so the PDF looks the same on every server (FR-CERT-003). */
function fontFace(pkg: string, file: string, family: string, weight: number): string {
  try {
    const dir = path.dirname(require_.resolve(`${pkg}/package.json`));
    const data = readFileSync(path.join(dir, 'files', file)).toString('base64');
    return `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${data}) format('woff2');}`;
  } catch {
    // A missing font only means the system font is used instead.
    return '';
  }
}

const esc = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

let fonts: string | undefined;
function fontCss(): string {
  const montserrat = (w: number) =>
    fontFace('@fontsource/montserrat', `montserrat-latin-${w}-normal.woff2`, 'Montserrat', w);
  fonts ??= [
    montserrat(400),
    montserrat(500),
    montserrat(600),
    montserrat(700),
    montserrat(800),
    fontFace('@fontsource/great-vibes', 'great-vibes-latin-400-normal.woff2', 'Great Vibes', 400),
    fontFace(
      '@fontsource/great-vibes',
      'great-vibes-latin-ext-400-normal.woff2',
      'Great Vibes',
      400,
    ),
    fontFace(
      '@fontsource/noto-naskh-arabic',
      'noto-naskh-arabic-arabic-400-normal.woff2',
      'Noto Naskh Arabic',
      400,
    ),
    fontFace(
      '@fontsource/noto-naskh-arabic',
      'noto-naskh-arabic-arabic-600-normal.woff2',
      'Noto Naskh Arabic',
      600,
    ),
    fontFace(
      '@fontsource/noto-sans-ethiopic',
      'noto-sans-ethiopic-ethiopic-400-normal.woff2',
      'Noto Sans Ethiopic',
      400,
    ),
    fontFace(
      '@fontsource/noto-sans-ethiopic',
      'noto-sans-ethiopic-ethiopic-600-normal.woff2',
      'Noto Sans Ethiopic',
      600,
    ),
  ].join('\n');
  return fonts;
}

/** "17 November 2026", in Ethiopian time like every other date in Natik. */
function longDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(date);
}

/** The script font only has Latin letters; Arabic and Ethiopic names are set in their own fonts. */
const isLatin = (text: string) => /^[\p{Script=Latin}\p{N}\s'’.,-]*$/u.test(text);

/**
 * The fine engraved pattern behind the text, like on banknotes: a rosette of rotated ellipses in the
 * middle and gentle waves across the page. Very light, so it never competes with the words.
 */
function guilloche(): string {
  const rosette: string[] = [];
  for (let i = 0; i < 90; i++) {
    rosette.push(
      `<ellipse cx="148.5" cy="104" rx="132" ry="34" transform="rotate(${i * 2} 148.5 104)"/>`,
    );
  }
  const waves: string[] = [];
  for (let row = 0; row < 44; row++) {
    const y = 6 + row * 4.6;
    let d = `M -5 ${y.toFixed(2)}`;
    for (let x = -5; x <= 302; x += 11) {
      d += ` q 2.75 ${row % 2 ? -1.4 : 1.4} 5.5 0 t 5.5 0`;
    }
    waves.push(`<path d="${d}"/>`);
  }
  return `<svg class="pattern" viewBox="0 0 297 210" preserveAspectRatio="none" aria-hidden="true">
  <g fill="none" stroke="${NAVY}" stroke-width="0.12" opacity="0.07">${waves.join('')}</g>
  <g fill="none" stroke="${GOLD}" stroke-width="0.16" opacity="0.13">${rosette.join('')}</g>
</svg>`;
}

/** The gold seal in the middle of the footer: a serrated rosette, the centre's name, and the Natik mark. */
function seal(): string {
  const points: string[] = [];
  const spikes = 64;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 99 : 92;
    const a = (Math.PI * i) / spikes;
    points.push(`${(100 + r * Math.sin(a)).toFixed(2)},${(100 - r * Math.cos(a)).toFixed(2)}`);
  }
  return `<svg class="seal" viewBox="0 0 200 200" aria-hidden="true">
  <defs>
    <linearGradient id="sealGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#EBD999"/><stop offset="0.45" stop-color="#C8A954"/>
      <stop offset="0.7" stop-color="#A88A3C"/><stop offset="1" stop-color="#DCC47A"/>
    </linearGradient>
    <path id="sealTop" d="M 34 100 A 66 66 0 0 1 166 100"/>
    <path id="sealBottom" d="M 24 100 A 76 76 0 0 0 176 100"/>
  </defs>
  <polygon points="${points.join(' ')}" fill="url(#sealGold)"/>
  <circle cx="100" cy="100" r="86" fill="${NAVY}"/>
  <circle cx="100" cy="100" r="81" fill="none" stroke="#D9BF6E" stroke-width="1.4"/>
  <circle cx="100" cy="100" r="53" fill="none" stroke="#D9BF6E" stroke-width="1.4"/>
  <text font-family="Montserrat" font-weight="700" font-size="10.2" letter-spacing="1.3" fill="#EBD999" text-anchor="middle">
    <textPath href="#sealTop" startOffset="50%">NATIK LANGUAGE CENTRE</textPath>
  </text>
  <text font-family="Montserrat" font-weight="700" font-size="11.6" letter-spacing="3.2" fill="#EBD999" text-anchor="middle">
    <textPath href="#sealBottom" startOffset="50%">CERTIFIED</textPath>
  </text>
  <path d="M 29 96 l 4 4 l -4 4 l -4 -4 z M 171 96 l 4 4 l -4 4 l -4 -4 z" fill="#EBD999"/>
  <circle cx="100" cy="100" r="49" fill="#FBF8EF"/>
  <image href="data:image/png;base64,${MARK_PNG_BASE64}" x="75" y="68" width="50" height="64" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
}

/**
 * The certificate page, A4 landscape: navy bands edged in gold, an engraved ivory background, a large
 * "Certificate" with a gold ribbon, the student's name in script, a short citation, and the date, the
 * Natik seal and the signature. The QR code in the corner opens the public check (FR-CERT-003/004).
 */
export async function certificateHtml(data: CertificateData): Promise<string> {
  const qr = await QRCode.toDataURL(data.verifyUrl, {
    margin: 0,
    width: 240,
    color: { dark: NAVY, light: '#00000000' },
  });
  const signature = data.signatureDataUrl
    ? `<img class="sig" src="${data.signatureDataUrl}" alt="" />`
    : '';
  const name = data.studentName.trim();
  const detail = [data.levelName, data.languageName].filter(Boolean).join(' · ');
  const verifyHost = data.verifyUrl.replace(/^https?:\/\//, '').split('?')[0]!;
  const date = longDate(data.issuedAt);
  const completed = longDate(data.completedAt ?? data.issuedAt);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<style>
${fontCss()}
@page { size: 297mm 210mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 297mm; height: 210mm; overflow: hidden; }
body {
  position: relative;
  background: radial-gradient(ellipse at 50% 45%, #FFFEFA 0%, #FBF8EF 55%, #F4EFE0 100%);
  color: ${INK};
  font-family: 'Montserrat', 'Noto Naskh Arabic', 'Noto Sans Ethiopic', 'Segoe UI', Arial, sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.pattern { position: absolute; inset: 0; width: 297mm; height: 210mm; }

/* Navy bands top and bottom, each edged with a gold line. */
.band { position: absolute; left: 0; right: 0; height: 11mm;
  background: linear-gradient(90deg, ${NAVY_DEEP} 0%, ${NAVY} 50%, ${NAVY_DEEP} 100%); }
.band.top { top: 0; }
.band.bottom { bottom: 0; }
.rule { position: absolute; left: 0; right: 0; height: 1.6mm;
  background: linear-gradient(90deg, #A88A3C 0%, #E6D08A 50%, #A88A3C 100%); }
.rule.top { top: 11mm; }
.rule.bottom { bottom: 11mm; }

/* A thin gold frame with small diamonds at the corners. */
.frame { position: absolute; top: 17mm; bottom: 17mm; left: 9mm; right: 9mm;
  border: 0.3mm solid rgba(182, 154, 74, 0.6); }
.frame i { position: absolute; width: 2.6mm; height: 2.6mm; background: ${GOLD}; transform: rotate(45deg); }
.frame i:nth-child(1) { top: -1.3mm; left: -1.3mm; }
.frame i:nth-child(2) { top: -1.3mm; right: -1.3mm; }
.frame i:nth-child(3) { bottom: -1.3mm; left: -1.3mm; }
.frame i:nth-child(4) { bottom: -1.3mm; right: -1.3mm; }

/* Corners: the logo on the left, the check on the right. */
.logo { position: absolute; top: 19.5mm; left: 15mm; height: 31mm; width: auto; }
.check { position: absolute; top: 20mm; right: 14mm; width: 30mm; text-align: center; }
.check img { width: 19mm; height: 19mm; display: block; margin: 0 auto 1.4mm; }
.check .num { font-size: 7.6pt; font-weight: 700; color: ${NAVY}; letter-spacing: 0.04em; }
.check .hint { font-size: 6.4pt; color: #5b6670; margin-top: 0.4mm; }

.content { position: absolute; top: 22mm; left: 46mm; right: 46mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
h1 { font-size: 58pt; font-weight: 800; letter-spacing: 0.06em; line-height: 1; color: ${NAVY};
  text-shadow: 0 0.35mm 0 rgba(11, 42, 66, 0.12); }

/* The gold ribbon with folded tails, as on the sample. */
.ribbon { position: relative; margin-top: 4mm; height: 11.5mm; }
.ribbon .tail { position: absolute; top: 3.2mm; width: 17mm; height: 11.5mm; background: linear-gradient(180deg, #C9AC58, #9C7F35); }
.ribbon .tail.l { left: -11mm; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 4.5mm 50%); }
.ribbon .tail.r { right: -11mm; clip-path: polygon(0 0, 100% 0, calc(100% - 4.5mm) 50%, 100% 100%, 0 100%); }
.ribbon .fold { position: absolute; top: 11.5mm; width: 6mm; height: 3.2mm; background: #6F5A22; }
.ribbon .fold.l { left: 0; clip-path: polygon(0 0, 100% 0, 100% 100%); }
.ribbon .fold.r { right: 0; clip-path: polygon(0 0, 100% 0, 0 100%); }
.ribbon .face { position: relative; z-index: 2; height: 11.5mm; padding: 0 17mm; display: flex; align-items: center;
  background: linear-gradient(180deg, #F1E3AE 0%, #D8BD6A 38%, #BFA04C 62%, #D9C072 100%);
  color: ${NAVY_DEEP}; font-size: 15pt; font-weight: 700; letter-spacing: 0.2em;
  box-shadow: 0 0.5mm 1mm rgba(60, 45, 10, 0.25); }

.presented { margin-top: 7mm; font-size: 10.5pt; font-weight: 700; letter-spacing: 0.28em; color: ${INK}; }
.name { margin-top: 2mm; min-width: 150mm; max-width: 205mm; padding: 0 6mm 1.5mm; border-bottom: 0.35mm solid #5f6a73;
  font-family: 'Great Vibes', 'Noto Naskh Arabic', 'Noto Sans Ethiopic', serif; font-size: 50pt; line-height: 1.25; color: ${NAVY_DEEP}; }
.name.plain { font-family: 'Noto Naskh Arabic', 'Noto Sans Ethiopic', 'Montserrat', serif; font-size: 30pt; font-weight: 600; padding-top: 2mm; padding-bottom: 2.5mm; }
.citation { margin-top: 6mm; max-width: 200mm; font-size: 11pt; line-height: 1.6; color: #2f3a44; }
.citation + .citation { margin-top: 3.2mm; }
.citation b { color: ${INK}; font-weight: 700; }
.citation bdi { unicode-bidi: isolate; }
.nowrap { white-space: nowrap; }

/* Footer: date, seal and signature. Both lines sit at the same height, labels underneath. */
.foot { position: absolute; left: 34mm; right: 34mm; bottom: 21mm; display: flex; justify-content: space-between; align-items: center; }
.col { width: 68mm; text-align: center; }
.col .above { height: 17mm; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 1.4mm; }
.col .v { font-size: 12.5pt; color: ${INK}; font-weight: 600; }
.col .rule-line { border-top: 0.35mm solid #5f6a73; }
.col .label { padding-top: 1.8mm; font-size: 8.6pt; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; color: ${NAVY}; }
.col .role { font-size: 8.6pt; color: #4a5560; margin-top: 0.5mm; min-height: 4mm; }
.sig { max-height: 16mm; max-width: 60mm; display: block; object-fit: contain; mix-blend-mode: multiply; }
.seal { width: 40mm; height: 40mm; filter: drop-shadow(0 0.6mm 0.8mm rgba(40, 30, 5, 0.25)); }
</style></head>
<body>
${guilloche()}
<div class="band top"></div><div class="rule top"></div>
<div class="band bottom"></div><div class="rule bottom"></div>
<div class="frame"><i></i><i></i><i></i><i></i></div>

<img class="logo" src="data:image/png;base64,${LOGO_PNG_BASE64}" alt="Natik Language Centre" />
<div class="check">
  <img src="${qr}" alt="" />
  <div class="num">${esc(data.number)}</div>
  <div class="hint">Scan to verify<br />${esc(verifyHost)}</div>
</div>

<div class="content">
  <h1>CERTIFICATE</h1>
  <div class="ribbon">
    <div class="tail l"></div><div class="tail r"></div>
    <div class="fold l"></div><div class="fold r"></div>
    <div class="face">OF COMPLETION</div>
  </div>
  <div class="presented">PROUDLY PRESENTED TO</div>
  <div class="name${isLatin(name) ? '' : ' plain'}" dir="auto">${esc(name)}</div>
  <p class="citation">This certificate is awarded to <b><bdi>${esc(name)}</bdi></b> in recognition of the successful
    completion of the <b><bdi>${esc(data.courseTitle)}</bdi></b> course${detail ? ` <span class="nowrap">(${esc(detail)})</span>` : ''} at
    <b>Natik Language Centre</b>, completed on <b class="nowrap">${esc(completed)}</b>.</p>
  <p class="citation">This achievement reflects dedication and a strong commitment to learning. We wish
    <bdi>${esc(name)}</bdi> continued success in all future studies and endeavours.</p>
</div>

<div class="foot">
  <div class="col">
    <div class="above"><div class="v">${esc(date)}</div></div>
    <div class="rule-line"></div>
    <div class="label">Date</div>
    <div class="role">&nbsp;</div>
  </div>
  ${seal()}
  <div class="col">
    <div class="above">${signature}</div>
    <div class="rule-line"></div>
    <div class="label">${esc(data.signatoryName)}</div>
    <div class="role">${esc(data.signatoryTitle)}</div>
  </div>
</div>
</body></html>`;
}

/** Prints the certificate to PDF with a headless Chromium (FR-CERT-003). Tries twice: a browser can fail to start when the machine is busy. */
export async function renderCertificatePdf(data: CertificateData): Promise<Buffer> {
  try {
    return await printOnce(data);
  } catch {
    return await printOnce(data);
  }
}

async function printOnce(data: CertificateData): Promise<Buffer> {
  const html = await certificateHtml(data);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate('document.fonts.ready');
    return await page.pdf({
      width: '297mm',
      height: '210mm',
      printBackground: true,
      pageRanges: '1',
    });
  } finally {
    await browser.close();
  }
}
