import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  amendHtml,
  applyEvent,
  commitHtml,
  duplicateProject,
  duration,
  fileName,
  loadProjects,
  migrate,
  newProject,
  previousVersion,
  projectInput,
  renameProject,
  restoreVersion,
  saveProjects,
  searchProjects,
  startRun,
  stopRun,
  thumbnailHtml,
  timeAgo,
  VERSION_LIMIT,
} from '../lib/effect/project.ts';
import { cleanEditedHtml, withBridge } from '../lib/effect/bridge.ts';
import { highlightHtml } from '../lib/effect/highlight.ts';
import { route } from '../lib/effect/agent/router.ts';
import { logoSvg } from '../lib/effect/logo.ts';

const DOC = '<!doctype html><html><head><title>A</title></head><body><h1>Привет</h1></body></html>';

function memoryStorage(quota = Infinity) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > quota) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
  };
}

test('the agent timeline folds pipeline events', () => {
  let run = startRun(0);
  run = applyEvent(run, { type: 'route', route: route('Сделай игру змейка', {}) });
  assert.deepEqual(run.steps.map((s) => s.status), ['pending', 'pending', 'pending', 'pending']);
  run = applyEvent(run, { type: 'step', id: 'architect', role: 'architect', status: 'start', title: 'Архитектор', model: 'compass', at: 10 });
  run = applyEvent(run, { type: 'text', id: 'architect', delta: '{"name":' });
  run = applyEvent(run, { type: 'step', id: 'architect', status: 'done', ms: 900, summary: 'Гейм-дизайн' });
  run = applyEvent(run, { type: 'progress', id: 'developer', chars: 2048, note: 'Пишу код…' });
  run = applyEvent(run, { type: 'step', id: 'fix-1', role: 'developer', status: 'start', title: 'Разработчик · исправления', model: 'compass', at: 20 });
  run = applyEvent(run, { type: 'step', id: 'designer', status: 'skipped', reason: 'Быстро' });
  assert.equal(run.steps[0].status, 'done');
  assert.equal(run.steps[0].output, '{"name":');
  assert.equal(run.steps.find((s) => s.id === 'developer')!.chars, 2048);
  assert.equal(run.steps.find((s) => s.id === 'fix-1')!.title, 'Разработчик · исправления');
  assert.ok(run.steps.findIndex((s) => s.id === 'fix-1') < run.steps.findIndex((s) => s.id === 'developer'), 'unplanned steps are shown where they ran');
  assert.equal(run.steps.find((s) => s.id === 'designer')!.status, 'skipped');
  const done = applyEvent(run, { type: 'done', intent: 'new', kind: 'game', reply: 'ok', usage: { input: 1, output: 2 } }, 99);
  assert.equal(done.status, 'done');
  assert.equal(done.finishedAt, 99);
  assert.ok(done.steps.every((s) => s.status !== 'pending'));
  const stopped = applyEvent(run, { type: 'error', code: 'cancelled', message: 'stop' });
  assert.equal(stopped.status, 'stopped');
  const failed = applyEvent(run, { type: 'error', code: 'rate_limited', message: 'busy' });
  assert.equal(failed.status, 'error');
  assert.equal(stopRun(run).steps.find((s) => s.id === 'fix-1')!.status, 'error');
  // A skipped step the route did not plan gets a proper title.
  const t = applyEvent(startRun(0), { type: 'step', id: 'tester', status: 'skipped', reason: 'x' });
  assert.equal(t.steps[0].title, 'Тестировщик');
});

test('versions: commit, amend while editing, restore and undo target', () => {
  let p = newProject(0);
  p = commitHtml(p, DOC, 'Создано', 'agent', 1);
  p = commitHtml(p, DOC.replace('Привет', 'Пока'), 'Правка', 'agent', 2);
  assert.equal(p.versions.length, 2);
  p = amendHtml(p, DOC.replace('Привет', 'Текст 1'), 'text', 3);
  p = amendHtml(p, DOC.replace('Привет', 'Текст 2'), 'text', 4);
  assert.equal(p.versions.length, 3, 'continuous text edits share one version');
  assert.match(p.html, /Текст 2/);
  assert.equal(previousVersion(p)!.label, 'Правка');
  p = restoreVersion(p, p.versions[0].id, 5);
  assert.equal(p.html, DOC);
  assert.equal(p.versions.at(-1)!.source, 'restore');
  for (let i = 0; i < 40; i++) p = commitHtml(p, DOC + i, 'v' + i, 'agent', 10 + i);
  assert.equal(p.versions.length, VERSION_LIMIT);
});

test('projects: rename, duplicate, search and the pipeline input', () => {
  let p = commitHtml({ ...newProject(0), name: 'Колос' }, DOC, 'x', 'agent', 1);
  p = { ...p, messages: [{ id: 'm', role: 'user', text: 'Сайт пекарни', at: 1 }] };
  assert.equal(renameProject(p, '   ').name, 'Колос');
  assert.equal(renameProject(p, '  Новое   имя ').name, 'Новое имя');
  const copy = duplicateProject(p, 5);
  assert.notEqual(copy.id, p.id);
  assert.match(copy.name, /копия/);
  const other = { ...newProject(2), name: 'Игра' };
  assert.deepEqual(searchProjects([p, other], 'пекар').map((x) => x.id), [p.id]);
  assert.equal(searchProjects([p, other], '').length, 2);
  const input = projectInput(p)!;
  assert.equal(input.html, DOC);
  assert.deepEqual(input.history, [{ role: 'user', text: 'Сайт пекарни' }]);
  assert.equal(projectInput(newProject()), null);
});

test('storage: save, load, quota fallback and migration from Effect 1', () => {
  const st = memoryStorage();
  const p = commitHtml(newProject(0), DOC, 'x', 'agent', 1);
  const running = { ...p, messages: [{ id: 'a', role: 'assistant' as const, text: '', at: 1, run: startRun(1) }] };
  assert.ok(saveProjects([running], st));
  const back = loadProjects(st);
  assert.equal(back.length, 1);
  assert.equal(back[0].messages[0].run!.status, 'stopped', 'a run left by a closed tab is shown as stopped');

  let big = p;
  for (let i = 0; i < 25; i++) big = commitHtml(big, DOC + 'x'.repeat(2000) + i, 'v', 'agent', i + 2);
  const small = memoryStorage(12_000);
  assert.ok(saveProjects([big], small), 'drops versions until it fits');
  assert.ok(loadProjects(small)[0].versions.length < 25);

  const old = memoryStorage();
  old.setItem('effect.projects.v1', JSON.stringify([{ id: 'o1', name: 'Луна', kind: 'slides', html: DOC, history: [{ html: '<p>v0</p>', spec: null }], messages: [{ role: 'user', text: 'привет', at: 5 }], updated: 9 }]));
  const migrated = loadProjects(old);
  assert.equal(migrated[0].kind, 'presentation');
  assert.equal(migrated[0].versions.length, 2);
  assert.equal(migrated[0].messages[0].text, 'привет');
  assert.equal(migrate({ nope: true }), null);
  assert.deepEqual(loadProjects(null), []);
});

test('formatting helpers', () => {
  assert.equal(fileName('Кофейня «Луна»!'), 'кофейня-луна.html');
  assert.equal(fileName('***'), 'effect-project.html');
  assert.equal(timeAgo(0, 30_000), 'только что');
  assert.equal(timeAgo(0, 5 * 60_000), '5 мин назад');
  assert.equal(duration(8400), '8,4 с');
  assert.equal(duration(72_000), '1 мин 12 с');
  assert.match(thumbnailHtml(DOC), /requestAnimationFrame=function\(\)\{return 0\}\}.*<\/script><\/body>/);
});

test('text-edit bridge is injected and never saved', () => {
  const bridged = withBridge(DOC);
  assert.match(bridged, /id="fx-bridge"/);
  const posted = bridged.replace('<h1>', '<h1 contenteditable="true" data-fx-edit="">');
  assert.equal(cleanEditedHtml(posted), DOC);
});

test('code highlighting escapes markup and marks tags, strings and keywords', () => {
  const out = highlightHtml('<div class="a">x &amp; <b></b></div><script>const s = "<\\/b>"; go();</script><style>a{color:#fff}</style>');
  assert.match(out, /<span class="hl-t">&lt;div<\/span>/);
  assert.match(out, /<span class="hl-a">class<\/span>/);
  assert.match(out, /<span class="hl-k">const<\/span>/);
  assert.match(out, /<span class="hl-f">go<\/span>/);
  assert.match(out, /<span class="hl-n">#fff<\/span>/);
  assert.ok(!/<div|<script|<b>/.test(out.replace(/<span class="hl-\w+">|<\/span>/g, '')));
});

test('the logo is only a rainbow-outline triangle, with unique ids per copy', () => {
  const a = logoSvg(64, { title: 'Effect' });
  const b = logoSvg(32);
  assert.match(a, /^<svg[^>]+viewBox="0 0 64 64"[^>]+width="64"[^>]+aria-label="Effect"/);
  assert.equal((a.match(/<path /g) || []).length, 2, 'glow copy and outline, nothing else');
  assert.match(a, /d="M32 9.5 55.5 51.5H8.5Z"/);
  assert.ok(!/fill="#/.test(a), 'no fill and no tile');
  const ids = (s: string) => [...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids(a).filter((x) => ids(b).includes(x)).length, 0);
});
