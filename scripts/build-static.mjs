import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The serverless function imports the agent core as plain JavaScript.
const agent = spawnSync(process.execPath, [resolve(project, 'scripts/build-agent.mjs')], { cwd: project, stdio: 'inherit' });
if (agent.status !== 0) process.exit(agent.status ?? 1);
const result = spawnSync(
  process.execPath,
  [
    resolve(project, 'node_modules/vinext/dist/cli.js'),
    'build',
    '--prerender-concurrency',
    '1',
  ],
  {
    cwd: project,
    env: { ...process.env, FOCUS_STATIC_EXPORT: '1' },
    stdio: 'inherit',
  },
);
if (result.status !== 0) process.exit(result.status ?? 1);
const routes = JSON.parse(
  readFileSync(resolve(project, 'dist/server/vinext-prerender.json'), 'utf8'),
).routes;
const expected = [
  '/',
  '/start',
  '/work',
  '/work/envoid',
  '/work/opal-coffee',
  '/work/rapid',
  '/work/rapid/howitworks',
  '/work/rapid/iknowhow',
  '/work/rapid/imapro',
  '/effect',
  '/effect/studio',
];
for (const route of expected) {
  if (
    !routes.some((item) => item.route === route && item.status === 'rendered')
  ) {
    throw new Error('Static export is missing route: ' + route);
  }
  if (route === '/') continue;
  const html = resolve(project, 'dist/client', route.slice(1) + '.html');
  if (!existsSync(html)) throw new Error('Missing HTML: ' + html);
  const folder = resolve(project, 'dist/client', route.slice(1));
  mkdirSync(folder, { recursive: true });
  copyFileSync(html, resolve(folder, 'index.html'));
}
console.log('Static hosting package ready: dist/client (11 complete pages).');
copyFileSync(resolve(project, 'HOSTING-RU.txt'), resolve(project, 'dist/client/READ-ME.txt'));
