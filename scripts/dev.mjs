/**
 * `pnpm dev`: starts the services (Docker) and both apps, and keeps the terminal clean.
 *
 *   - While things start you see one line.
 *   - When the site and the API answer, the screen is cleared and only the addresses stay.
 *   - Afterwards only problems are printed (errors and crashes), never every request.
 *
 * Want the full noisy output? Run `pnpm dev:verbose`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';
const web = process.env.PORT ?? '3000';

function apiPort() {
  if (process.env.API_PORT) return process.env.API_PORT;
  try {
    const text = readFileSync(path.join(root, 'apps/api/.env'), 'utf8');
    return text.match(/^API_PORT=(\d+)/m)?.[1] ?? '4000';
  } catch {
    return '4000';
  }
}
const api = apiPort();

const dim = (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[22m` : s);
const bold = (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[22m` : s);
const gold = (s) => (process.stdout.isTTY ? `\x1b[38;5;178m${s}\x1b[39m` : s);
const clear = () => {
  if (process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
};

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (isWindows)
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
}

async function up(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(2500) })).ok;
  } catch {
    return false;
  }
}

const bothUp = async () =>
  (await up(`http://localhost:${web}/api/v1/health`)) &&
  (await up(`http://localhost:${api}/api/v1/health`));

function showReady(already = false) {
  clear();
  console.log(`
  ${gold(bold('Natik is ready'))}

  Website     ${bold(`http://localhost:${web}`)}
  API docs    http://localhost:${api}/api/docs
  Test email  http://localhost:8026

  ${dim(already ? 'Already running in another terminal.' : 'Press Ctrl+C to stop. Only problems are shown here.')}
`);
}

// Already running (for example from another terminal): just show where it is.
if (await bothUp()) {
  showReady(true);
  // Let the finished requests close before leaving (Windows can abort on an immediate exit).
  setTimeout(() => process.exit(0), 100);
  await new Promise(() => {});
}

console.log(`\n  ${gold('Natik')} ${dim('starting…')}`);

// 1. Docker services (database, cache, storage, mailbox), silently.
const services = spawnSync(`${pnpm} services:up`, {
  cwd: root,
  shell: true,
  encoding: 'utf8',
});
if (services.status !== 0) {
  console.error(`\n  Could not start the services. Is Docker running?\n`);
  console.error(`${services.stdout ?? ''}${services.stderr ?? ''}`);
  process.exit(services.status ?? 1);
}

// 2. Both apps. Their output is read here and only problems are let through.
const turbo = spawn(`${pnpm} exec turbo run dev --ui=stream --env-mode=loose`, {
  cwd: root,
  shell: true,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
});

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const PROBLEM =
  /(^|\s)(error|fatal)\b|⨯|unhandled|uncaught|EADDRINUSE|ECONNREFUSED|failed to|crash/i;
const NOISE =
  /^\s*(>|•|Packages in scope|Running dev|Remote caching|cache bypass)|ExperimentalWarning|DeprecationWarning|trace-warnings/i;

let ready = false;
const early = []; // kept so a slow start can show what happened
let printing = false; // inside a multi-line error (stack trace)

function handle(raw) {
  const line = raw.replace(ANSI, '').trimEnd();
  if (!line) {
    printing = false;
    return;
  }
  if (!ready) {
    early.push(line);
    if (early.length > 60) early.shift();
    return;
  }
  if (NOISE.test(line)) return;
  const continuation = /^\s/.test(line) || /^\s*at\s/.test(line);
  if (PROBLEM.test(line)) printing = true;
  else if (!continuation) printing = false;
  if (printing) console.error(`  ${line.replace(/^[^|]*\|\s?/, '')}`);
}

for (const stream of [turbo.stdout, turbo.stderr]) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    lines.forEach(handle);
  });
}

turbo.on('exit', (code) => {
  if (!ready) {
    console.error(`\n  Natik stopped while starting. Last messages:\n`);
    for (const line of early.slice(-25)) console.error(`  ${line}`);
  }
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    killTree(turbo);
    process.exit(0);
  });
}
process.on('exit', () => killTree(turbo));

// 3. Wait until the site (and through it the API) answers, then show the addresses.
const started = Date.now();
while (turbo.exitCode === null) {
  if (await bothUp()) {
    break;
  }
  if (Date.now() - started > 240_000) {
    console.error(`\n  Still starting after 4 minutes. Last messages:\n`);
    for (const line of early.slice(-25)) console.error(`  ${line}`);
    break;
  }
  await new Promise((r) => setTimeout(r, 1500));
}

if (turbo.exitCode === null) {
  ready = true;
  showReady();
}
