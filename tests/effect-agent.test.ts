import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, complexityOf, detectKind, route } from '../lib/effect/agent/router.ts';
import { runPipeline } from '../lib/effect/agent/pipeline.ts';
import { buildMessages } from '../lib/effect/agent/prompts.ts';
import { extractHtml, parseJson, staticChecks, stitch, titleOf, defaultSyntaxCheck } from '../lib/effect/agent/html.ts';
import { MODELS, modelName, parseModel } from '../lib/effect/agent/models.ts';
import { AgentError, type AgentEvent, type CallFn, type Msg } from '../lib/effect/agent/types.ts';
import { withMotionKit, hasMotionKit } from '../lib/effect/motion-kit.ts';

const KIT = (h: string) => withMotionKit(h);

const PAGE = (body = '<h1>Луна</h1>') =>
  `<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Луна — кофейня</title></head><body>${body}<script>let a=1;</script></body></html>`;

const LINES = (n: number) => Array.from({ length: n }, (_, i) => `<p>Пункт ${i}</p>`).join('');

/** Fake model: answers by role, records every call. */
function fake(answers: Partial<Record<string, string | string[] | ((m: Msg[]) => string)>>, log: { model: string; role: string; messages: Msg[] }[] = []) {
  const queues: Record<string, string[]> = {};
  const call: CallFn = async (model, messages, opts) => {
    log.push({ model, role: opts.role, messages });
    const a = answers[opts.role];
    let text: string;
    if (typeof a === 'function') text = a(messages);
    else if (Array.isArray(a)) {
      queues[opts.role] ??= [...a];
      text = queues[opts.role].length > 1 ? queues[opts.role].shift()! : queues[opts.role][0];
    } else text = a ?? '';
    const truncated = text.endsWith('…CUT');
    if (truncated) text = text.slice(0, -4);
    opts.onText?.(text.slice(0, Math.ceil(text.length / 2)));
    opts.onText?.(text);
    return { text, truncated, usage: { input: 10, output: 20 } };
  };
  return { call, log };
}

const collect = () => {
  const events: AgentEvent[] = [];
  return { events, onEvent: (e: AgentEvent) => events.push(e) };
};

test('router detects kinds in Russian and English', () => {
  assert.equal(detectKind('Сделай игру змейка'), 'game');
  assert.equal(detectKind('Лендинг для онлайн-школы'), 'landing');
  assert.equal(detectKind('Презентация для инвесторов'), 'presentation');
  assert.equal(detectKind('Дашборд продаж с графиками'), 'dashboard');
  assert.equal(detectKind('Калькулятор ипотеки'), 'app');
  assert.equal(detectKind('Сайт кофейни'), 'website');
  assert.equal(detectKind('a space shooter game'), 'game');
  assert.equal(detectKind('привет'), null);
});

test('router tells new projects, edits and questions apart', () => {
  assert.equal(classify('Сайт для кофейни «Луна»').intent, 'new');
  assert.equal(classify('Сделай кнопку синей', 'website').intent, 'edit');
  assert.equal(classify('Добавь раздел с тарифами', 'landing').intent, 'edit');
  assert.equal(classify('Как поменять шрифт?', 'website').intent, 'question');
  assert.equal(classify('Что ты умеешь?').intent, 'question');
  const g = classify('Сделай игру про космос', 'website');
  assert.equal(g.intent, 'new');
  assert.equal(g.kind, 'game');
  assert.equal(classify('Создай новый сайт для пекарни', 'website').intent, 'new');
  assert.equal(classify('Добавь на сайт игру-викторину', 'website').intent, 'edit');
});

test('auto mode picks effort and per-step models from complexity', () => {
  const small = route('Сделай заголовок крупнее', { current: 'website' });
  assert.equal(small.intent, 'edit');
  assert.equal(small.effort, 'quick');
  assert.deepEqual(small.steps.map((s) => s.role), ['developer']);
  assert.equal(small.fixRounds, 0);

  const game = route('Сделай платформер с уровнями, боссами и прокачкой');
  assert.equal(game.kind, 'game');
  assert.equal(game.effort, 'deep');
  assert.deepEqual(game.steps.map((s) => s.role), ['architect', 'designer', 'developer', 'tester']);
  assert.equal(game.steps.find((s) => s.role === 'developer')!.model, 'astrolabe');
  assert.equal(game.fixRounds, 2);
  assert.match(game.reason, /Effect Astrolabe/);

  const q = route('Что ты умеешь?');
  assert.deepEqual(q.steps.map((s) => s.role), ['answer']);
  assert.equal(q.steps[0].model, 'spyglass');

  assert.ok(complexityOf('Многостраничный сайт агентства с каталогом, фильтрами, корзиной и личным кабинетом', 'new', 'website') >= 2);
});

test('manual model and effort override every step; Ultra adds a review round', () => {
  const r = route('Сайт кофейни', { choice: { model: 'spyglass', effort: 'ultra' } });
  assert.ok(r.steps.every((s) => s.model === 'spyglass'));
  assert.equal(r.effort, 'ultra');
  assert.ok(r.steps.some((s) => s.role === 'reviewer'));
  const quick = route('Сайт кофейни', { choice: { effort: 'quick' } });
  assert.deepEqual(quick.steps.map((s) => s.role), ['architect', 'developer']);
  const or = route('Сайт кофейни', { choice: { model: 'or:openai/gpt-5' } });
  assert.ok(or.steps.every((s) => s.model === 'or:openai/gpt-5'));
  assert.equal(route('Сайт', { choice: { model: 'bogus' } }).steps[0].model !== 'bogus', true);
});

test('model references and names use the Effect brand', () => {
  assert.deepEqual(MODELS.map((m) => m.name), ['Effect Astrolabe', 'Effect Compass', 'Effect Spyglass']);
  assert.deepEqual(parseModel('compass'), { provider: 'effect', id: 'compass' });
  assert.deepEqual(parseModel('or:anthropic/claude-x'), { provider: 'openrouter', id: 'anthropic/claude-x' });
  assert.equal(parseModel('or:../../etc'), null);
  assert.equal(parseModel('Focus Astrolabe'), null);
  assert.equal(modelName('or:google/gemini-pro', [{ id: 'google/gemini-pro', name: 'Gemini Pro' }]), 'Gemini Pro');
});

test('html helpers extract, stitch continuations and parse JSON tolerantly', () => {
  assert.equal(extractHtml('Вот код:\n```html\n' + PAGE() + '\n```'), PAGE());
  assert.equal(stitch('<div>abc</div><p>hello wonderful world', '<p>hello wonderful world</p></body></html>'), '<div>abc</div><p>hello wonderful world</p></body></html>');
  assert.equal(stitch('<div></div>', '<div></div>'), '<div></div><div></div>');
  assert.equal(stitch('<a>', '```html\n</a>```'), '<a></a>');
  assert.deepEqual(parseJson('Ответ: ```json\n{"a": [1, 2,],}\n```'), { a: [1, 2] });
  assert.equal(parseJson('нет json'), null);
  assert.equal(titleOf(PAGE()), 'Луна');
});

test('static checks flag sandbox and quality problems', () => {
  const ok = staticChecks(PAGE(), 'website', defaultSyntaxCheck());
  assert.ok(ok.every((c) => c.ok), JSON.stringify(ok.filter((c) => !c.ok)));
  const bad = staticChecks('<html><body><img src="https://x/y.png"><script>alert(1); localStorage.x=1; function(</script>', 'game', defaultSyntaxCheck());
  const ids = bad.filter((c) => !c.ok).map((c) => c.id);
  for (const id of ['complete', 'viewport', 'dialogs', 'external-images', 'storage-guard', 'raf', 'touch', 'syntax-0']) assert.ok(ids.includes(id), id);
});

test('prompts carry role instructions, the kind guide and the context', () => {
  const m = buildMessages('developer', { request: 'Игра змейка', kind: 'game', intent: 'new', spec: { name: 'Змейка' } });
  assert.equal(m[0].role, 'system');
  assert.match(m[0].content, /DEVELOPER/);
  assert.match(m[1].content, /requestAnimationFrame/);
  assert.match(m[1].content, /Змейка/);
  const edit = buildMessages('developer', { request: 'Сделай фон тёмным', kind: 'website', intent: 'edit', html: PAGE() });
  assert.match(edit[1].content, /FULL updated HTML/);
  assert.match(edit[1].content, /<h1>Луна<\/h1>/);
  const t = buildMessages('tester', { request: 'x', kind: 'website', intent: 'new', html: PAGE(), checks: [{ id: 'a', ok: false, severity: 'major', message: 'No viewport' }] });
  assert.match(t[1].content, /No viewport/);
});

test('new project runs architect → designer → developer → tester and stops when tests pass', async () => {
  const { call, log } = fake({
    architect: '{"name":"Луна","kind":"website","summary":"сайт кофейни с меню и бронированием","pages":[{"id":"home"},{"id":"menu"}],"features":["бронь"]}',
    designer: '{"direction":"Тёплый минимализм","rationale":"кофе и утро","palette":{"bg":"#fff"}}',
    developer: PAGE(),
    tester: '{"verdict":"pass","summary":"ok","issues":[]}',
  });
  const { events, onEvent } = collect();
  const done = await runPipeline({ request: 'Сайт для кофейни «Луна» с меню и бронированием', call, onEvent, choice: {} });
  assert.ok(done);
  assert.equal(done!.intent, 'new');
  assert.equal(done!.html, KIT(PAGE()));
  assert.ok(hasMotionKit(done!.html!));
  assert.equal(done!.name, 'Луна');
  assert.equal(done!.spec?.name, 'Луна');
  assert.equal(done!.design?.direction, 'Тёплый минимализм');
  assert.deepEqual(log.map((l) => l.role), ['architect', 'designer', 'developer', 'tester']);
  const starts = events.filter((e) => e.type === 'step' && e.status === 'start').map((e) => (e as { id: string }).id);
  assert.deepEqual(starts, ['architect', 'designer', 'developer', 'tester']);
  assert.ok(events.some((e) => e.type === 'step' && e.status === 'done' && e.id === 'architect' && /2 страницы/.test(e.summary)));
  assert.ok(events.some((e) => e.type === 'text'));
  assert.equal(events[0].type, 'route');
  assert.equal(events.at(-1)!.type, 'done');
  assert.equal(done!.usage!.input, 40);
  assert.equal(done!.usage!.output, 80);
  // The developer saw the architect's spec and the designer's system.
  assert.match(log[2].messages[1].content, /Тёплый минимализм/);
  assert.match(log[2].messages[1].content, /бронь/);
});

test('a cut-off developer answer is continued and stitched', async () => {
  const full = PAGE('<main>' + LINES(160) + '</main>');
  const cut = 1800;
  const { call, log } = fake({
    architect: '{"name":"A"}',
    designer: '{}',
    developer: (m) => (m.at(-1)!.content.includes('cut off') ? full.slice(cut - 30) : full.slice(0, cut) + '…CUT'),
    tester: '{"verdict":"pass","issues":[]}',
  });
  const { onEvent } = collect();
  const done = await runPipeline({ request: 'Сайт', call, onEvent, choice: { effort: 'thoughtful' } });
  assert.equal(done!.html, KIT(full));
  const dev = log.filter((l) => l.role === 'developer');
  assert.equal(dev.length, 2);
  assert.equal(dev[1].messages.at(-2)!.role, 'assistant');
});

test('tester issues trigger a developer fix round, at most the planned number', async () => {
  const fixed = PAGE('<h1>Исправлено</h1>');
  const { call, log } = fake({
    architect: '{"name":"Школа"}',
    designer: '{}',
    developer: (m) => (/problems/.test(m[1].content) ? fixed : PAGE()),
    tester: [
      '{"verdict":"fix","summary":"нет тача","issues":[{"severity":"critical","problem":"no touch controls","fix":"add buttons"}]}',
      '{"verdict":"pass","issues":[]}',
    ],
  });
  const { events, onEvent } = collect();
  const done = await runPipeline({ request: 'Лендинг онлайн-школы', call, onEvent, choice: { effort: 'deep' } });
  assert.equal(done!.html, KIT(fixed));
  assert.deepEqual(log.map((l) => l.role), ['architect', 'designer', 'developer', 'tester', 'developer', 'tester']);
  assert.match(log[4].messages[1].content, /no touch controls/);
  assert.ok(events.some((e) => e.type === 'step' && e.status === 'start' && e.id === 'fix-1'));
  assert.equal(done!.report?.verdict, 'pass');
});

test('edits run developer → tester with the current code; questions only answer', async () => {
  const project = { name: 'Луна', kind: 'website' as const, html: PAGE(), spec: { name: 'Луна' }, design: { direction: 'Минимализм' } };
  const { call, log } = fake({ developer: PAGE('<h1>Тёмная</h1>'), tester: '{"verdict":"pass","issues":[]}', answer: 'Шрифт меняется в стилях.' });
  const done = await runPipeline({ request: 'Сделай тёмную тему для всех страниц и добавь футер', project, call, onEvent: () => {}, choice: { effort: 'thoughtful' } });
  assert.equal(done!.intent, 'edit');
  assert.deepEqual(log.map((l) => l.role), ['developer', 'tester']);
  assert.match(log[0].messages[1].content, /<h1>Луна<\/h1>/);
  assert.match(log[0].messages[1].content, /Минимализм/);
  const q = await runPipeline({ request: 'Как поменять шрифт?', project, call, onEvent: () => {} });
  assert.equal(q!.intent, 'question');
  assert.equal(q!.reply, 'Шрифт меняется в стилях.');
  assert.equal(q!.html, undefined);
});

test('the router model settles unsure messages', async () => {
  const project = { name: 'Луна', kind: 'website' as const, html: PAGE() };
  const { call, log } = fake({ router: '{"intent":"question","kind":"website"}', answer: 'Да.' });
  const done = await runPipeline({ request: 'тарифы', project, call, onEvent: () => {} });
  assert.equal(log[0].role, 'router');
  assert.equal(log[0].model, 'spyglass');
  assert.equal(done!.intent, 'question');
});

test('fatal transport errors stop the run with a coded error; partial HTML is continued', async () => {
  const { onEvent, events } = collect();
  const denied: CallFn = async () => {
    throw new AgentError('not_granted', 'Нет разрешения');
  };
  assert.equal(await runPipeline({ request: 'Сайт', call: denied, onEvent }), null);
  const err = events.at(-1) as Extract<AgentEvent, { type: 'error' }>;
  assert.equal(err.type, 'error');
  assert.equal(err.code, 'not_granted');

  const full = PAGE('<div>' + LINES(220) + '</div>');
  let n = 0;
  const flaky: CallFn = async (_m, messages, opts) => {
    if (opts.role !== 'developer') return { text: opts.role === 'tester' ? '{"verdict":"pass","issues":[]}' : '{}', truncated: false };
    n++;
    if (n === 1) throw { code: 'upstream_error', message: 'drop', text: full.slice(0, 2500) };
    assert.match(messages.at(-1)!.content, /cut off/);
    return { text: full.slice(2500), truncated: false };
  };
  const done = await runPipeline({ request: 'Сайт', call: flaky, onEvent: () => {}, choice: { effort: 'thoughtful' } });
  assert.equal(done!.html, KIT(full));
});

test('aborting stops the pipeline as cancelled', async () => {
  const ctl = new AbortController();
  const { events, onEvent } = collect();
  const call: CallFn = async (_m, _msg, opts) => {
    ctl.abort();
    if (opts.signal?.aborted) throw new AgentError('cancelled', 'stop');
    return { text: '{}', truncated: false };
  };
  assert.equal(await runPipeline({ request: 'Сайт', call, onEvent, signal: ctl.signal }), null);
  assert.equal((events.at(-1) as { code: string }).code, 'cancelled');
});
