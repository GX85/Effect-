import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSPECTOR, cleanInspected, withInspector } from '../lib/effect/inspector.ts';
import { runPipeline } from '../lib/effect/agent/pipeline.ts';
import type { CallFn, Msg } from '../lib/effect/agent/types.ts';

const PAGE = '<!doctype html><html lang="ru"><head><title>A</title></head><body><h1>Луна</h1></body></html>';

test('the inspector bridge parses, is injected before </body> and never saved', () => {
  // oxlint-disable-next-line typescript/no-implied-eval
  new Function(INSPECTOR.replace(/^<script[^>]*>|<\/script>$/g, ''));
  const doc = withInspector(PAGE);
  assert.match(doc, /<script id="fx-inspect">[\s\S]*<\/script><\/body>/);
  const posted = '<!doctype html><html><head><style id="fx-inspect-style">x</style></head><body><h1 data-fx-id="e1" data-fx-sel="" style="font-size: 40px">Луна</h1></body></html>';
  assert.equal(cleanInspected(posted), '<!doctype html><html><head></head><body><h1 style="font-size: 40px">Луна</h1></body></html>');
});

test('a picked element goes to the agents as the focus of the request', async () => {
  const seen: Msg[][] = [];
  const call: CallFn = async (_m, messages, opts) => {
    seen.push(messages);
    return { text: opts.role === 'developer' ? PAGE.replace('Луна', 'Луна!') : '{"verdict":"pass","issues":[]}', truncated: false };
  };
  await runPipeline({ request: 'Сделай его крупнее и золотым', project: { name: 'A', kind: 'website', html: PAGE }, focus: '<h1>Луна</h1>', call, onEvent: () => {}, choice: { effort: 'quick' } });
  assert.match(seen[0][1].content, /picked in the preview[\s\S]*<h1>Луна<\/h1>/);
});
