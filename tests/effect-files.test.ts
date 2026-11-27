import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPatches, hasPatches, parsePatches } from '../lib/effect/patch.ts';
import { bundle, crc32, parseFiles, zip } from '../lib/effect/vfs.ts';
import { runPipeline } from '../lib/effect/agent/pipeline.ts';
import type { CallFn, Msg } from '../lib/effect/agent/types.ts';

const BIG = '<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width"><title>Луна</title></head><body><h1>Луна</h1>' + Array.from({ length: 700 }, (_, i) => `<p>Пункт ${i}</p>`).join('\n') + '<footer>© Луна</footer></body></html>';

test('patches: parse, apply exactly or ignoring whitespace, refuse ambiguity', () => {
  const text = 'Готово:\n<<<<<<< SEARCH path=index.html\n<h1>Луна</h1>\n=======\n<h1>Луна — кофейня</h1>\n>>>>>>> REPLACE\n<<<<<<< SEARCH\n<footer>©   Луна</footer>\n=======\n<footer>© 2026 Луна</footer>\n>>>>>>> REPLACE';
  assert.ok(hasPatches(text));
  const ps = parsePatches(text);
  assert.equal(ps.length, 2);
  assert.equal(ps[1].path, 'index.html');
  const r = applyPatches({ 'index.html': BIG }, ps);
  assert.ok(r.ok);
  assert.match(r.files['index.html'], /<h1>Луна — кофейня<\/h1>/);
  assert.match(r.files['index.html'], /© 2026 Луна/);
  const amb = applyPatches({ 'index.html': '<p>a</p><p>a</p>' }, [{ path: 'index.html', search: '<p>a</p>', replace: 'x' }]);
  assert.equal(amb.ok, false);
  assert.equal(amb.failed[0].reason, 'matches more than once');
  assert.equal(applyPatches({ 'index.html': 'x' }, [{ path: 'index.html', search: 'nope', replace: '' }]).failed[0].reason, 'not found');
  assert.equal(applyPatches({}, [{ path: 'styles.css', search: '', replace: 'body{}' }]).files['styles.css'], 'body{}');
});

test('files: parse blocks, bundle styles, scripts and pages, write a valid zip', () => {
  const files = parseFiles('<file path="index.html">\n<html><head><link rel="stylesheet" href="styles.css"></head><body><a href="about.html">О нас</a><script src="app.js"></script></body></html>\n</file>\n<file path="styles.css">\nbody{color:red}\n</file>\n<file path="app.js">\nwindow.x=1\n</file>\n<file path="about.html">\n<html><body><h1>О нас</h1></body></html>\n</file>\n<file path="../evil">x</file>');
  assert.deepEqual(Object.keys(files).sort(), ['about.html', 'app.js', 'index.html', 'styles.css']);
  const one = bundle(files);
  assert.match(one, /<style data-file="styles.css">\nbody\{color:red\}/);
  assert.match(one, /<script data-file="app.js">\nwindow.x=1/);
  assert.match(one, /id="fx-pages"/);
  assert.ok(!one.includes('href="styles.css"'));
  const z = zip(files);
  const v = new DataView(z.buffer);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  assert.equal(v.getUint32(z.length - 22, true), 0x06054b50);
  assert.equal(v.getUint16(z.length - 22 + 10, true), 4);
  assert.equal(crc32(new TextEncoder().encode('hello')), 0x3610a686);
});

test('large edits go out as targeted patches, with a full rewrite when a block misses', async () => {
  const seen: Msg[][] = [];
  let mode = 'ok';
  const call: CallFn = async (_m, messages, opts) => {
    seen.push(messages);
    if (opts.role !== 'developer') return { text: '{"verdict":"pass","issues":[]}', truncated: false };
    if (/TARGETED EDIT/.test(messages[0].content)) {
      return { text: mode === 'ok' ? '<<<<<<< SEARCH path=index.html\n<h1>Луна</h1>\n=======\n<h1>Луна ночью</h1>\n>>>>>>> REPLACE' : '<<<<<<< SEARCH\n<h1>Нет такого</h1>\n=======\nx\n>>>>>>> REPLACE', truncated: false };
    }
    return { text: BIG.replace('<h1>Луна</h1>', '<h1>Переписано</h1>'), truncated: false };
  };
  const project = { name: 'Луна', kind: 'website' as const, html: BIG };
  const done = await runPipeline({ request: 'Измени заголовок на «Луна ночью»', project, call, onEvent: () => {}, choice: { effort: 'quick' } });
  assert.match(done!.html!, /<h1>Луна ночью<\/h1>/);
  assert.match(done!.html!, /Пункт 699/);
  assert.equal(seen.length, 1, 'one patch call, no full rewrite');
  assert.ok(seen[0][1].content.length < BIG.length + 4000);
  mode = 'miss';
  seen.length = 0;
  const events: { id?: string; summary?: string }[] = [];
  const again = await runPipeline({ request: 'Измени заголовок', project, call, onEvent: (e) => events.push(e as never), choice: { effort: 'quick' } });
  assert.match(again!.html!, /<h1>Переписано<\/h1>/);
  assert.ok(events.some((e) => e.id === 'developer-full'));
  assert.ok(events.some((e) => /не совпал/.test(e.summary ?? '')));
});
