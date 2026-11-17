// Builds the shared package twice: CommonJS for the API, and ES modules for the website, where the
// bundler can then include only the functions a page really uses (keeps public pages small).
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const watch = process.argv.includes('--watch');
const projects = ['tsconfig.build.json', 'tsconfig.esm.json'];
const args = (project) => [
  tsc,
  '-p',
  project,
  ...(watch ? ['--watch', '--preserveWatchOutput'] : []),
];

// The ES module output needs this marker so Node and bundlers treat it as modules.
mkdirSync('dist/esm', { recursive: true });
// "sideEffects": false is read from the nearest package.json, so it must be repeated here.
writeFileSync('dist/esm/package.json', '{"type":"module","sideEffects":false}\n');

if (watch) {
  for (const project of projects) spawn(process.execPath, args(project), { stdio: 'inherit' });
} else {
  for (const project of projects) {
    const result = spawnSync(process.execPath, args(project), { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
