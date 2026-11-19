/**
 * Works out which translation namespaces the browser needs on each part of the site, so a page sends
 * only its own texts instead of the whole language file (about 100 kB of the page before this).
 *
 *   node scripts/client-messages.mjs          writes i18n/client-namespaces.ts
 *   node scripts/client-messages.mjs --check  fails when that file is out of date (part of `pnpm lint`)
 *
 * How: for every part of the site (an "area": public pages, the student area, admin…) it follows the
 * imports from the files of that area, finds the files that run in the browser ("use client" and
 * everything they import), and collects the namespaces they pass to useTranslations('…').
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'i18n', 'client-namespaces.ts');

/** area → where its files are (a directory, or single files for the root). */
const AREAS = {
  root: ['app/layout.tsx', 'app/error.tsx', 'components/providers.tsx'],
  public: ['app/(public)', 'app/not-found.tsx'],
  account: ['app/(account)'],
  student: ['app/(student)'],
  teacher: ['app/teach'],
  admin: ['app/admin'],
  learn: ['app/learn'],
  profile: ['app/profile'],
  tools: ['app/styleguide', 'app/dev'],
};

const EXT = ['.tsx', '.ts'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.includes(path.extname(name)) && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const sources = new Map();
for (const dir of ['app', 'components', 'lib', 'i18n']) {
  for (const file of walk(path.join(root, dir))) sources.set(file, readFileSync(file, 'utf8'));
}

function resolveImport(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(root, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null; // a package
  for (const candidate of [
    base,
    ...EXT.map((e) => base + e),
    ...EXT.map((e) => path.join(base, 'index' + e)),
  ]) {
    if (sources.has(candidate)) return candidate;
  }
  return null;
}

const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const importsCache = new Map();
function importsOf(file) {
  if (importsCache.has(file)) return importsCache.get(file);
  const text = sources.get(file);
  const found = new Set();
  for (const m of text.matchAll(IMPORT_RE)) {
    const target = resolveImport(file, m[1] ?? m[2]);
    if (target) found.add(target);
  }
  importsCache.set(file, [...found]);
  return importsCache.get(file);
}

const isClient = (file) =>
  /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(sources.get(file));

function closure(seeds) {
  const seen = new Set();
  const stack = [...seeds];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    stack.push(...importsOf(file));
  }
  return seen;
}

const warnings = [];
function namespacesIn(file) {
  const text = sources.get(file);
  const out = new Set();
  for (const m of text.matchAll(/useTranslations\(\s*(?:'([^']*)'|"([^"]*)")?\s*\)/g)) {
    const ns = m[1] ?? m[2];
    if (ns === undefined) warnings.push(`${rel(file)}: useTranslations() without a namespace`);
    else out.add(ns.split('.')[0]);
  }
  // useTranslations(config.namespace): take every `namespace: '…'` written in the same file
  if (/useTranslations\(\s*[A-Za-z_]/.test(text)) {
    for (const m of text.matchAll(/namespace:\s*['"]([^'"]+)['"]/g)) out.add(m[1].split('.')[0]);
  }
  return out;
}
const rel = (file) => path.relative(root, file).replaceAll('\\', '/');

function filesOf(entries) {
  const files = [];
  for (const entry of entries) {
    const full = path.join(root, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const result = {};
for (const [area, entries] of Object.entries(AREAS)) {
  const inArea = closure(filesOf(entries));
  const clientRoots = [...inArea].filter(isClient);
  const inBrowser = closure(clientRoots);
  const ns = new Set();
  for (const file of inBrowser) for (const n of namespacesIn(file)) ns.add(n);
  result[area] = [...ns].sort();
}

const lines = [
  '// Written by scripts/client-messages.mjs: do not edit. Run `node scripts/client-messages.mjs` after',
  '// using a new translation namespace in a component that runs in the browser.',
  '',
  'export const CLIENT_NAMESPACES = {',
  ...Object.entries(result).map(
    ([area, ns]) => `  ${area}: [${ns.map((n) => `'${n}'`).join(', ')}],`,
  ),
  '} as const;',
  '',
  'export type MessageArea = keyof typeof CLIENT_NAMESPACES;',
  '',
];
const next = lines.join('\n');

if (warnings.length) console.warn([...new Set(warnings)].join('\n'));

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUT, 'utf8').replaceAll('\r\n', '\n');
  } catch {
    // missing
  }
  // Formatting (prettier) may re-wrap the file, so compare the data, not the text.
  const strip = (s) => s.replace(/\s+/g, '').replace(/,(\]|\})/g, '$1');
  if (strip(current) !== strip(next)) {
    console.error(
      'i18n/client-namespaces.ts is out of date. Run: node scripts/client-messages.mjs',
    );
    process.exit(1);
  }
  console.log('client message namespaces are up to date');
} else {
  writeFileSync(OUT, next);
  for (const [area, ns] of Object.entries(result))
    console.log(area.padEnd(8), ns.length, 'namespaces');
}
