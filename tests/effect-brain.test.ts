import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIT_SCRIPT, auditChecks, auditSummary, withAudit, type AuditReport } from '../lib/effect/audit.ts';
import { hasMotionKit, MOTION_JS, withMotionKit } from '../lib/effect/motion-kit.ts';
import { memoryText, updateMemory, emptyMemory } from '../lib/effect/brain.ts';
import { runPipeline } from '../lib/effect/agent/pipeline.ts';
import { staticChecks } from '../lib/effect/agent/html.ts';
import type { CallFn, Msg } from '../lib/effect/agent/types.ts';

const PAGE = (body = '<h1>Луна</h1>') =>
  `<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Луна</title></head><body>${body}</body></html>`;
const report = (over: Partial<AuditReport> = {}): AuditReport => ({
  width: 390,
  errors: [],
  overflow: { px: 0, offenders: [] },
  brokenAnchors: [],
  lowContrast: [],
  missingAlt: 0,
  unlabeled: [],
  longTasks: { count: 0, ms: 0 },
  hidden: [],
  intro: false,
  motion: true,
  ...over,
});
const parses = (code: string) => {
  // oxlint-disable-next-line typescript/no-implied-eval
  new Function(code);
  return true;
};

test('the motion kit is injected once, refreshed on re-injection and parses', () => {
  const once = withMotionKit(PAGE());
  assert.ok(hasMotionKit(once));
  assert.match(once, /<\/style><\/head><body><div id="fx-intro"/);
  assert.match(once, /<script id="fx-motion">[\s\S]*<\/script><\/body>/);
  assert.equal(withMotionKit(once), once, 'idempotent');
  assert.ok(!withMotionKit(PAGE(), { intro: false }).includes('fx-intro"'));
  assert.ok(parses(MOTION_JS.replace(/^<script[^>]*>|<\/script>$/g, '')));
  assert.match(once, /prefers-reduced-motion:reduce/);
});

test('the audit script parses and is injected first in <head>', () => {
  assert.ok(parses(AUDIT_SCRIPT.replace(/^<script[^>]*>|<\/script>$/g, '')));
  assert.match(withAudit(PAGE()), /<head><script id="fx-audit">/);
  assert.match(withAudit('<p>x</p>'), /^<script id="fx-audit">/);
});

test('runtime reports become checks with severities, deduplicated across widths', () => {
  const checks = auditChecks([
    report({ errors: ['Uncaught TypeError: x is undefined (line 3)'], overflow: { px: 120, offenders: ['div.hero → 510px'] }, unlabeled: ['input'] }),
    report({ width: 1440, errors: ['Uncaught TypeError: x is undefined (line 3)'], unlabeled: ['input'], brokenAnchors: ['#price'], hidden: ['h1 «Луна»'] }),
  ]);
  const by = (id: string) => checks.filter((c) => c.id.startsWith(id));
  assert.equal(by('runtime-error').length, 1);
  assert.equal(by('runtime-error')[0].severity, 'critical');
  assert.match(by('runtime-error')[0].message, /390 and 1440px/);
  assert.equal(by('runtime-overflow')[0].severity, 'major');
  assert.equal(by('runtime-labels').length, 1);
  assert.equal(by('runtime-hidden').length, 1);
  assert.deepEqual(auditChecks([report(), report({ width: 1440 })]), []);
  assert.match(auditSummary([report({ errors: ['x'] }), report({ width: 1440, timeout: true })]), /390px: ошибок 1 · 1440px: страница не загрузилась/);
});

test('static checks flag layout-property animations', () => {
  const bad = staticChecks(PAGE('<style>.a{transition: width .3s}</style>'), 'website');
  assert.equal(bad.find((c) => c.id === 'layout-animation')!.ok, false);
  assert.equal(staticChecks(PAGE('<style>.a{transition: transform .3s}</style>'), 'website').find((c) => c.id === 'layout-animation')!.ok, true);
});

test('project memory: new projects reset it, edits add decisions, every agent reads it', async () => {
  const fresh = updateMemory(null, { intent: 'new', request: 'Сайт', spec: { name: 'Луна', summary: 'кофейня', features: ['бронь'] }, design: { direction: 'Тёплый', palette: { accent: '#c8642d', bg: '#fffaf3' }, type: { display: 'Fraunces' } } }, 1);
  assert.match(fresh.brief, /Луна.*кофейня.*бронь/);
  assert.equal(fresh.tokens.accent, '#c8642d');
  assert.equal(fresh.tokens['font.display'], 'Fraunces');
  const edited = updateMemory(fresh, { intent: 'edit', request: 'Сделай тёмную тему' }, 2);
  assert.deepEqual(edited.decisions, ['Сделай тёмную тему']);
  assert.equal(updateMemory(edited, { intent: 'question', request: 'как?' }).decisions.length, 1);
  assert.match(memoryText(edited), /Decisions the person made[\s\S]*тёмную тему/);
  assert.equal(memoryText(emptyMemory()), '');

  const seen: Msg[][] = [];
  const call: CallFn = async (_m, messages, opts) => {
    seen.push(messages);
    return { text: opts.role === 'developer' ? PAGE('<h1>Тёмная</h1>') : '{"verdict":"pass","issues":[]}', truncated: false };
  };
  await runPipeline({ request: 'Добавь футер с контактами и картой проезда', project: { name: 'Луна', kind: 'website', html: PAGE(), memory: memoryText(edited) }, call, onEvent: () => {}, choice: { effort: 'thoughtful' } });
  assert.match(seen[0][1].content, /Project memory[\s\S]*тёмную тему/);
});

test('runtime diagnostics run after the developer and force a fix for a JavaScript error', async () => {
  const roles: string[] = [];
  const events: { id?: string; status?: string; summary?: string }[] = [];
  let devCalls = 0;
  const call: CallFn = async (_m, messages, opts) => {
    roles.push(opts.role);
    if (opts.role === 'developer') {
      devCalls++;
      if (devCalls > 1) assert.match(messages[1].content, /Uncaught ReferenceError/);
      return { text: devCalls === 1 ? PAGE('<script>boom()</script>') : PAGE('<h1>OK</h1>'), truncated: false };
    }
    return { text: '{"verdict":"pass","issues":[]}', truncated: false };
  };
  let diag = 0;
  const diagnose = async (html: string) => {
    diag++;
    assert.ok(hasMotionKit(html), 'the audit sees the polished page');
    return html.includes('boom()') ? [report({ errors: ['Uncaught ReferenceError: boom is not defined'] })] : [report()];
  };
  const done = await runPipeline({
    request: 'Сделай заголовок крупнее',
    project: { name: 'Луна', kind: 'website', html: PAGE() },
    call,
    diagnose,
    onEvent: (e) => events.push(e as never),
    choice: { effort: 'quick' },
  });
  assert.deepEqual(roles, ['developer', 'developer'], 'quick edit: no tester, but the runtime error still gets one fix');
  assert.equal(diag, 2);
  assert.ok(events.some((e) => e.id === 'audit' && e.status === 'done' && /ошибок 1/.test(e.summary ?? '')));
  assert.ok(events.some((e) => e.id === 'audit-2' && e.status === 'done'));
  assert.match(done!.html!, /<h1>OK<\/h1>/);
});
