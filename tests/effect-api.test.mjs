import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEffectHandler, cleanContext, resetState } from '../api/effect.mjs';
import { bundleAgent } from '../scripts/build-agent.mjs';

beforeEach(() => resetState());

const KEYS = { ANTHROPIC_API_KEY: 'test', OPENROUTER_API_KEY: 'or-test' };
const PAGE = '<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width"><title>Луна</title></head><body><h1>Луна</h1></body></html>';
const ctx = (extra = {}) => ({ request: 'Сайт кофейни «Луна»', kind: 'website', intent: 'new', ...extra });

const post = (body, ip = '1.1.1.1') =>
  new Request('http://local/api/effect', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });

async function events(res) {
  const text = await res.text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/** Fake Anthropic client: answers by the role named in the system prompt. */
function fakeClient(answer = () => PAGE, { stop = 'end_turn', seen = [], hang = false } = {}) {
  return () => ({
    beta: {
      messages: {
        stream(params, opts) {
          seen.push(params);
          const text = answer(params);
          const chunks = [text.slice(0, Math.ceil(text.length / 2)), text.slice(Math.ceil(text.length / 2))];
          return {
            async *[Symbol.asyncIterator]() {
              for (const c of chunks) {
                if (hang) {
                  yield { type: 'content_block_delta', delta: { type: 'text_delta', text: c } };
                  await new Promise((resolve, reject) => opts?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
                }
                yield { type: 'content_block_delta', delta: { type: 'text_delta', text: c } };
              }
            },
            finalMessage: async () => ({ stop_reason: stop, usage: { input_tokens: 100, output_tokens: 50 } }),
          };
        },
      },
    },
  });
}

const byRole = (params) => {
  const s = params.system;
  if (/ARCHITECT/.test(s)) return '{"name":"Луна","summary":"кофейня","pages":[{"id":"home"}],"features":["бронь"]}';
  if (/DESIGNER/.test(s)) return '{"direction":"Тёплый минимализм"}';
  if (/TESTER/.test(s)) return '{"verdict":"pass","issues":[]}';
  return PAGE;
};

function sse(chunks) {
  const body = chunks.map((c) => 'data: ' + (typeof c === 'string' ? c : JSON.stringify(c)) + '\n\n').join('') + ': keep-alive\n\ndata: [DONE]\n\n';
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

test('GET reports providers, the Effect models and the env vars to set', async () => {
  const off = await (await createEffectHandler({ env: {} })(new Request('http://local/api/effect'))).json();
  assert.equal(off.ai, false);
  assert.deepEqual(off.providers, { anthropic: false, openrouter: false });
  assert.deepEqual(off.env, ['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY']);
  assert.deepEqual(off.models.map((m) => m.name), ['Effect Astrolabe', 'Effect Compass', 'Effect Spyglass']);
  const on = await (await createEffectHandler({ env: { ANTHROPIC_API_KEY: 'x' } })(new Request('http://local/api/effect'))).json();
  assert.deepEqual(on.providers, { anthropic: true, openrouter: false });
  assert.equal(on.ai, true);
});

test('POST without keys says which variables are missing', async () => {
  const res = await createEffectHandler({ env: {} })(post({ op: 'step', role: 'developer', model: 'compass', effort: 'low', ctx: ctx() }));
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.code, 'no_key');
  assert.deepEqual(body.env, ['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY']);
});

test('a step streams NDJSON and the server builds the role prompt itself', async () => {
  const seen = [];
  const handle = createEffectHandler({ env: KEYS, makeClient: fakeClient(byRole, { seen }) });
  const res = await handle(post({ op: 'step', role: 'developer', model: 'astrolabe', effort: 'max', ctx: ctx({ spec: { name: 'Луна' } }) }));
  assert.equal(res.headers.get('content-type'), 'application/x-ndjson; charset=utf-8');
  const ev = await events(res);
  assert.deepEqual(ev[0], { type: 'start', model: 'Effect Astrolabe' });
  assert.equal(ev.filter((e) => e.type === 'text').map((e) => e.delta).join(''), PAGE);
  const done = ev.at(-1);
  assert.equal(done.type, 'done');
  assert.equal(done.truncated, false);
  assert.deepEqual(done.usage, { input: 100, output: 50 });
  const p = seen[0];
  assert.equal(p.model, 'claude-opus-5-5');
  assert.deepEqual(p.output_config, { effort: 'max' });
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(p.fallbacks, 'default');
  assert.equal(p.max_tokens, 64000);
  assert.match(p.system, /DEVELOPER/);
  assert.equal(p.messages[0].role, 'user');
  assert.match(p.messages[0].content, /Луна/);

  await events(await handle(post({ op: 'step', role: 'tester', model: 'spyglass', effort: 'low', ctx: ctx({ html: PAGE }) })));
  assert.equal(seen[1].model, 'claude-haiku-5-5');
  assert.equal(seen[1].fallbacks, undefined, 'the fastest model has no server-side fallback');
  assert.match(seen[1].system, /TESTER/);
});

test('cut-off, refused and timed-out steps are reported so the client can continue', async () => {
  const cut = await events(await createEffectHandler({ env: KEYS, makeClient: fakeClient(byRole, { stop: 'max_tokens' }) })(post({ op: 'step', role: 'developer', model: 'compass', effort: 'medium', ctx: ctx() })));
  assert.equal(cut.at(-1).truncated, true);
  const refused = await events(await createEffectHandler({ env: KEYS, makeClient: fakeClient(byRole, { stop: 'refusal' }) })(post({ op: 'step', role: 'developer', model: 'compass', effort: 'medium', ctx: ctx() })));
  assert.deepEqual([refused.at(-1).type, refused.at(-1).code], ['error', 'refused']);
  const slow = await events(
    await createEffectHandler({ env: KEYS, makeClient: fakeClient(byRole, { hang: true }), timeBudgetMs: 30 })(post({ op: 'step', role: 'developer', model: 'compass', effort: 'medium', ctx: ctx() })),
  );
  assert.equal(slow.at(-1).type, 'done');
  assert.equal(slow.at(-1).truncated, true);
  assert.equal(slow.at(-1).stop, 'time');
});

test('invalid steps and contexts are refused', async () => {
  const handle = createEffectHandler({ env: KEYS, makeClient: fakeClient() });
  for (const body of [
    { op: 'step', role: 'hacker', model: 'compass', effort: 'low', ctx: ctx() },
    { op: 'step', role: 'developer', model: 'Focus Astrolabe', effort: 'low', ctx: ctx() },
    { op: 'step', role: 'developer', model: 'compass', effort: 'extreme', ctx: ctx() },
    { op: 'step', role: 'developer', model: 'compass', effort: 'low', ctx: { request: '', kind: 'website', intent: 'new' } },
    { op: 'step', role: 'developer', model: 'compass', effort: 'low', ctx: ctx({ kind: 'spaceship' }) },
    { op: 'nope' },
  ]) {
    const res = await handle(post(body));
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const bad = await handle(new Request('http://local/api/effect', { method: 'POST', body: '{oops' }));
  assert.equal(bad.status, 400);
  assert.equal((await handle(new Request('http://local/api/effect', { method: 'PUT' }))).status, 405);
  assert.equal(cleanContext(ctx({ html: 'x'.repeat(500_000) })), null);
  const clean = cleanContext(ctx({ history: Array.from({ length: 20 }, () => ({ role: 'user', text: 'x'.repeat(2000) })), spec: { a: 1 } }));
  assert.equal(clean.history.length, 8);
  assert.equal(clean.history[0].text.length, 800);
});

test('OpenRouter steps stream through the chat completions API with the server key', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return sse([
      { choices: [{ delta: { content: '<!doctype html><html>' } }] },
      { choices: [{ delta: { content: '</html>' }, finish_reason: 'length' }] },
      { choices: [], usage: { prompt_tokens: 12, completion_tokens: 34, cost: 0.001 } },
    ]);
  };
  const handle = createEffectHandler({ env: KEYS, fetchImpl, makeClient: fakeClient() });
  const ev = await events(await handle(post({ op: 'step', role: 'developer', model: 'or:openai/gpt-5', effort: 'max', ctx: ctx() })));
  assert.equal(ev[0].model, 'openai/gpt-5');
  assert.equal(ev.filter((e) => e.type === 'text').map((e) => e.delta).join(''), '<!doctype html><html></html>');
  assert.equal(ev.at(-1).truncated, true);
  assert.equal(ev.at(-1).usage.output, 34);
  assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer or-test');
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.model, 'openai/gpt-5');
  assert.equal(sent.stream, true);
  assert.deepEqual(sent.reasoning, { effort: 'high' });
  assert.equal(sent.messages[0].role, 'system');

  const noKey = createEffectHandler({ env: { ANTHROPIC_API_KEY: 'x' }, fetchImpl });
  assert.equal((await noKey(post({ op: 'step', role: 'developer', model: 'or:openai/gpt-5', effort: 'low', ctx: ctx() }))).status, 503);
  const failing = createEffectHandler({ env: KEYS, fetchImpl: async () => new Response('no', { status: 429 }) });
  const err = (await events(await failing(post({ op: 'step', role: 'developer', model: 'or:openai/gpt-5', effort: 'low', ctx: ctx() })))).at(-1);
  assert.deepEqual([err.type, err.code], ['error', 'busy']);
});

test('the OpenRouter catalog is trimmed, priced per million tokens and cached', async () => {
  let n = 0;
  const fetchImpl = async () => {
    n++;
    return Response.json({
      data: [
        { id: 'openai/gpt-5', name: 'OpenAI: GPT-5', context_length: 400000, pricing: { prompt: '0.00000125', completion: '0.00001' }, architecture: { output_modalities: ['text'] } },
        { id: 'google/imagen', name: 'Imagen', architecture: { output_modalities: ['image'] } },
        { id: 'bad id', name: 'x' },
      ],
    });
  };
  const handle = createEffectHandler({ env: KEYS, fetchImpl });
  const a = await (await handle(new Request('http://local/api/effect?catalog=openrouter'))).json();
  assert.deepEqual(a.models, [{ id: 'openai/gpt-5', name: 'GPT-5', provider: 'openai', context: 400000, prompt: 1.25, completion: 10 }]);
  await handle(new Request('http://local/api/effect?catalog=openrouter'));
  assert.equal(n, 1);
  const none = await (await createEffectHandler({ env: {} })(new Request('http://local/api/effect?catalog=openrouter'))).json();
  assert.deepEqual(none.models, []);
});

test('op run streams the whole agent pipeline as events', async () => {
  const handle = createEffectHandler({ env: KEYS, makeClient: fakeClient(byRole) });
  const ev = await events(await handle(post({ op: 'run', request: 'Сайт кофейни «Луна» с бронированием', effort: 'thoughtful' })));
  assert.equal(ev[0].type, 'route');
  const starts = ev.filter((e) => e.type === 'step' && e.status === 'start').map((e) => e.role);
  assert.deepEqual(starts, ['architect', 'designer', 'developer', 'tester']);
  const done = ev.at(-1);
  assert.equal(done.type, 'done');
  assert.ok(done.html.includes('<h1>Луна</h1>') && done.html.includes('id="fx-motion"'));
  assert.equal(done.name, 'Луна');
});

test('steps are rate-limited per client', async () => {
  const handle = createEffectHandler({ env: KEYS, makeClient: fakeClient() });
  let last;
  for (let i = 0; i < 90; i++) last = await handle(post({ op: 'step', role: 'router', model: 'spyglass', effort: 'low', ctx: ctx() }, '9.9.9.9'));
  assert.equal(last.status, 429);
  assert.equal((await last.json()).code, 'rate_limited');
});

test('the committed agent bundle matches lib/effect/agent', () => {
  assert.equal(readFileSync(new URL('../api/_agent.mjs', import.meta.url), 'utf8'), bundleAgent(), 'run `npm run build:agent`');
});
