import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route } from '../lib/effect/agent/router.ts';
import { runPipeline } from '../lib/effect/agent/pipeline.ts';
import { costOf, estimateRoute, formatUsd, priceOf } from '../lib/effect/agent/models.ts';
import type { CallFn } from '../lib/effect/agent/types.ts';

const PAGE = '<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Луна</title></head><body><h1>Луна</h1></body></html>';

test('per-step models from the hub win over the composer model and Авто', () => {
  const r = route('Сайт для кофейни с меню', { choice: { model: 'compass', effort: 'thoughtful', roles: { architect: 'astrolabe', tester: 'or:openai/gpt-5-mini' } } });
  const by = Object.fromEntries(r.steps.map((s) => [s.role, s.model]));
  assert.equal(by.architect, 'astrolabe');
  assert.equal(by.designer, 'compass');
  assert.equal(by.developer, 'compass');
  assert.equal(by.tester, 'or:openai/gpt-5-mini');
  // Invalid references are ignored.
  const bad = route('Сайт для кофейни', { choice: { effort: 'thoughtful', roles: { developer: 'nope' } } });
  assert.notEqual(bad.steps.find((s) => s.role === 'developer')!.model, 'nope');
});

test('prices come from the Effect line-up or the OpenRouter catalog', () => {
  assert.deepEqual(priceOf('spyglass'), { input: 0.1, output: 0.5 });
  const cat = [{ id: 'openai/gpt-5-mini', prompt: 0.25, completion: 2 }];
  assert.deepEqual(priceOf('or:openai/gpt-5-mini', cat), { input: 0.25, output: 2 });
  assert.equal(priceOf('or:x/unknown', cat), null);
  const c = costOf({ input: 3e6, output: 1e6, byModel: { compass: { input: 1e6, output: 1e6 }, 'or:openai/gpt-5-mini': { input: 2e6, output: 0 }, 'or:x/y': { input: 1, output: 1 } } }, cat);
  assert.ok(c);
  assert.equal(c!.usd, 2 + 10 + 0.5);
  assert.equal(c!.partial, true);
  assert.equal(costOf({ input: 1, output: 1 }), null);
});

test('estimates rank models sensibly and format compactly', () => {
  const cheap = estimateRoute(route('Сайт для кофейни', { choice: { model: 'spyglass', effort: 'thoughtful' } }));
  const strong = estimateRoute(route('Сайт для кофейни', { choice: { model: 'astrolabe', effort: 'thoughtful' } }));
  assert.ok(cheap.usd > 0 && strong.usd > cheap.usd * 10);
  assert.equal(formatUsd(0.0004), '<$0.001');
  assert.equal(formatUsd(0.0421), '$0.042');
  assert.equal(formatUsd(1.2), '$1.20');
});

test('the pipeline reports usage per model', async () => {
  const call: CallFn = async (_m, _msgs, o) => ({
    text: o.role === 'architect' ? '{"name":"Луна"}' : o.role === 'designer' ? '{}' : o.role === 'tester' ? '{"verdict":"pass","issues":[]}' : PAGE,
    truncated: false,
    usage: { input: 100, output: 10 },
  });
  const done = await runPipeline({ request: 'Сайт для кофейни', call, onEvent: () => {}, choice: { effort: 'thoughtful', model: 'compass', roles: { developer: 'astrolabe' } } });
  assert.equal(done!.usage!.input, 400);
  assert.deepEqual(done!.usage!.byModel, { compass: { input: 300, output: 30 }, astrolabe: { input: 100, output: 10 } });
});
