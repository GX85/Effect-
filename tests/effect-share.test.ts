import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeShare, encodeShare, MAX_SHARE, SHARE_PREFIX } from '../lib/effect/share.ts';
import { filterCommands, type Command } from '../lib/effect/commands.ts';

const html = '<!doctype html><html lang="ru"><head><title>Луна</title></head><body><h1>Кофейня «Луна»</h1>' + '<p>Меню дня</p>'.repeat(200) + '</body></html>';

test('share links round-trip a project through the URL hash', async () => {
  const hash = await encodeShare({ name: 'Луна', kind: 'landing', html });
  assert.ok(hash && hash.startsWith(SHARE_PREFIX));
  assert.ok(hash!.length < html.length / 4, 'compressed');
  assert.match(hash!, /^#share=[\w-]+$/);
  assert.deepEqual(await decodeShare(hash!), { name: 'Луна', kind: 'landing', html });
});

test('share links refuse oversized pages and malformed hashes', async () => {
  const bytes = crypto.getRandomValues(new Uint8Array(65_536));
  const noise = Array.from(bytes, (b) => String.fromCharCode(48 + (b % 74))).join('');
  assert.equal(await encodeShare({ name: 'x', kind: 'website', html: '<p>' + noise + '</p>' }), null);
  assert.equal(await decodeShare('#share=' + 'a'.repeat(MAX_SHARE + 1)), null);
  assert.equal(await decodeShare('#share=not*base64'), null);
  assert.equal(await decodeShare('#share=AAAA'), null);
  assert.equal(await decodeShare('#other=1'), null);
});

test('the command palette filters by every word, label hits first', () => {
  const noop = () => {};
  const list: Command[] = [
    { id: 'a', group: 'Проекты', label: 'Телефонная книга', icon: 'app', run: noop },
    { id: 'b', group: 'Устройство', label: 'Телефон', icon: 'phone', run: noop },
    { id: 'c', group: 'Действия', label: 'Скачать HTML', icon: 'download', keywords: 'файл', run: noop },
    { id: 'd', group: 'Вид', label: 'Код', icon: 'code', run: noop },
  ];
  assert.deepEqual(filterCommands(list, 'тел').map((c) => c.id), ['a', 'b']);
  assert.deepEqual(filterCommands(list, 'устройство тел').map((c) => c.id), ['b']);
  assert.deepEqual(filterCommands(list, 'файл').map((c) => c.id), ['c']);
  assert.equal(filterCommands(list, '').length, 4);
  assert.equal(filterCommands(list, 'ёлка').length, 0);
});
