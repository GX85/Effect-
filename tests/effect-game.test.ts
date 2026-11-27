import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_KIT, PLAYTEST_SCRIPT, playChecks, playSummary, withGameKit } from '../lib/effect/game-kit.ts';
import { runPipeline } from '../lib/effect/agent/pipeline.ts';
import type { CallFn } from '../lib/effect/agent/types.ts';

const GAME = (body = '') =>
  `<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width"><title>Игра</title></head><body><canvas id="game"></canvas><script>requestAnimationFrame(function f(){requestAnimationFrame(f)});addEventListener('touchstart',function(){});addEventListener('visibilitychange',function(){})</script>${body}</body></html>`;
const parses = (s: string) => {
  // oxlint-disable-next-line typescript/no-implied-eval
  new Function(s.replace(/^<script[^>]*>|<\/script>$/g, ''));
  return true;
};

test('the game kit and the playtest harness parse; the kit goes first in <head>', () => {
  assert.ok(parses(GAME_KIT));
  assert.ok(parses(PLAYTEST_SCRIPT));
  const once = withGameKit(GAME());
  assert.match(once, /<head><script id="fx-game-kit">/);
  assert.equal(withGameKit(once), once);
});

test('playtest reports become checks', () => {
  const ok = { width: 960, frames: 300, fps: 60, errors: [], canvas: true, frozen: false, changes: 9, inputs: 14 };
  assert.deepEqual(playChecks(ok), []);
  assert.match(playSummary(ok), /без ошибок · 60 FPS/);
  const bad = playChecks({ ...ok, errors: ['Uncaught TypeError: p is null'], frozen: true, fps: 18 });
  assert.deepEqual(bad.map((c) => c.id), ['play-error', 'play-frozen', 'play-fps']);
  assert.equal(bad[0].severity, 'critical');
  assert.equal(playChecks({ ...ok, frames: 0 })[0].id, 'play-loop');
});

test('games get the kit, a playtest after the build and a fix when it is stuck', async () => {
  const devs: string[] = [];
  const call: CallFn = async (_m, messages, opts) => {
    if (opts.role === 'developer') {
      devs.push(messages[1].content);
      return { text: devs.length === 1 ? GAME() : GAME('<p>FIXEDMARK</p>'), truncated: false };
    }
    if (opts.role === 'architect') return { text: '{"name":"Змейка","game":{"genre":"аркада"}}', truncated: false };
    return { text: opts.role === 'tester' ? '{"verdict":"pass","issues":[]}' : '{}', truncated: false };
  };
  let plays = 0;
  const events: { id?: string; summary?: string }[] = [];
  const done = await runPipeline({
    request: 'Сделай игру змейка',
    call,
    onEvent: (e) => events.push(e as never),
    choice: { effort: 'thoughtful' },
    playtest: async (html) => {
      plays++;
      assert.match(html, /id="fx-game-kit"/);
      return { width: 960, frames: 200, fps: 60, errors: [], canvas: true, frozen: !html.includes('FIXEDMARK'), changes: 1, inputs: 14 };
    },
  });
  assert.match(devs[0], /FXGame/, 'the developer is told about the kit');
  assert.equal(plays, 2);
  assert.match(devs[1], /picture never changed/);
  assert.ok(events.some((e) => e.id === 'playtest' && /картинка не меняется/.test(e.summary ?? '')));
  assert.match(done!.html!, /FIXEDMARK/);
  assert.ok(!done!.html!.includes('id="fx-intro"'), 'games skip the intro loader');
});
