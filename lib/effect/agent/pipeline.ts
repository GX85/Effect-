/**
 * The Effect agent pipeline. Runs anywhere: it only needs a `call` function.
 *   new project:  Architect → Designer → Developer → Tester → fixes (≤ 2) [→ Reviewer → fix]
 *   edit:         Developer → Tester → fix (≤ 1) [→ Reviewer → fix]
 *   question:     Answer
 * Steps are skipped when the route says so (quick effort, tiny edits, clean test reports).
 */
import { CONTINUE, buildMessages } from './prompts.ts';
import { extractHtml, failedChecks, isComplete, parseJson, staticChecks, stitch, titleOf, type SyntaxCheck } from './html.ts';
import { KIND_LABELS, isKind } from './models.ts';
import { classify, route as makeRoute, stepTitle } from './router.ts';
import { auditChecks, auditOutput, auditSummary, type AuditReport } from '../audit.ts';
import { withMotionKit } from '../motion-kit.ts';
import {
  AgentError,
  type AgentEvent,
  type CallFn,
  type Check,
  type Choice,
  type Design,
  type Intent,
  type Kind,
  type Msg,
  type ProjectInput,
  type Report,
  type Route,
  type Spec,
  type StepContext,
  type StepPlan,
  type Usage,
} from './types.ts';

export type DoneEvent = Extract<AgentEvent, { type: 'done' }>;

export type PipelineInput = {
  request: string;
  project?: ProjectInput | null;
  choice?: Choice;
  call: CallFn;
  onEvent: (e: AgentEvent) => void;
  signal?: AbortSignal;
  syntax?: SyntaxCheck | null;
  now?: () => number;
  /** How many times a cut-off developer answer is continued. */
  maxContinuations?: number;
  /** Ask a quick model when the heuristic router is unsure (default true). */
  routerModel?: boolean;
  /** Minimum gap between partial preview events, ms. */
  previewEvery?: number;
  /** Runs the page in a real browser (sandboxed preview) and reports runtime facts. */
  diagnose?: (html: string, kind: Kind) => Promise<AuditReport[]>;
};

/** Codes after which nothing else should be attempted in this run. */
const FATAL = new Set([
  'cancelled',
  'not_granted',
  'sampling_disabled',
  'not_declared',
  'capability_disabled',
  'capability_removed',
  'rate_limited',
  'session_expired',
  'no_key',
  'unavailable',
  'prompt_too_large',
]);

const isAbort = (e: unknown) =>
  (e instanceof AgentError && e.code === 'cancelled') || (e as { name?: string })?.name === 'AbortError';

function toAgentError(e: unknown): AgentError {
  if (e instanceof AgentError) return e;
  if (isAbort(e)) return new AgentError('cancelled', 'Остановлено.');
  const o = e as { code?: string; message?: string; text?: string };
  if (o && typeof o.code === 'string') return new AgentError(o.code, o.message || o.code, o.text);
  return new AgentError('failed', (e as Error)?.message || 'Не удалось выполнить шаг.');
}

const plural = (n: number, one: string, few: string, many: string) => {
  const a = n % 10;
  const b = n % 100;
  return n + ' ' + (a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many);
};

function specSummary(spec: Spec | null): string {
  if (!spec) return 'Спецификация готова';
  if (spec.game && typeof spec.game === 'object') {
    const g = spec.game as { genre?: string };
    return 'Гейм-дизайн' + (g.genre ? ': ' + String(g.genre).slice(0, 60) : '');
  }
  const pages = Array.isArray(spec.pages) ? spec.pages.length : 0;
  const feats = Array.isArray(spec.features) ? spec.features.length : 0;
  return [pages ? plural(pages, 'страница', 'страницы', 'страниц') : '', feats ? plural(feats, 'функция', 'функции', 'функций') : '']
    .filter(Boolean)
    .join(' · ') || (spec.summary ? String(spec.summary).slice(0, 80) : 'Спецификация готова');
}

function normReport(raw: unknown): Report | null {
  const r = raw as Partial<Report> | null;
  if (!r || typeof r !== 'object') return null;
  const issues = Array.isArray(r.issues)
    ? r.issues
        .filter((i) => i && typeof i.problem === 'string')
        .slice(0, 12)
        .map((i) => ({
          severity: (['critical', 'major', 'minor'].includes(i.severity) ? i.severity : 'minor') as Report['issues'][number]['severity'],
          area: typeof i.area === 'string' ? i.area.slice(0, 80) : undefined,
          problem: i.problem.slice(0, 400),
          fix: typeof i.fix === 'string' ? i.fix.slice(0, 400) : undefined,
        }))
    : [];
  const serious = issues.some((i) => i.severity !== 'minor');
  return { verdict: r.verdict === 'fix' && serious ? 'fix' : serious ? 'fix' : 'pass', summary: typeof r.summary === 'string' ? r.summary.slice(0, 240) : '', issues };
}

/** Merges automatic check failures into a report so the developer fixes them too. */
function withChecks(report: Report | null, checks: Check[]): Report | null {
  const bad = failedChecks(checks).filter((c) => c.severity !== 'minor');
  if (!bad.length) return report;
  const base: Report = report ?? { verdict: 'fix', summary: 'Автоматические проверки нашли проблемы.', issues: [] };
  return { ...base, verdict: 'fix', issues: [...bad.map((c) => ({ severity: c.severity, area: 'автопроверка', problem: c.message })), ...base.issues].slice(0, 14) };
}

function reportSummary(r: Report | null): string {
  if (!r) return 'Проверено';
  const crit = r.issues.filter((i) => i.severity === 'critical').length;
  const major = r.issues.filter((i) => i.severity === 'major').length;
  if (r.verdict === 'pass') return r.issues.length ? 'Готово к выпуску · ' + plural(r.issues.length, 'мелкое замечание', 'мелких замечания', 'мелких замечаний') : 'Проблем не найдено';
  return 'Нашёл ' + plural(crit + major, 'проблему', 'проблемы', 'проблем') + (crit ? ' (критичных: ' + crit + ')' : '');
}

const reportOutput = (r: Report | null) =>
  r ? (r.summary ? r.summary + '\n' : '') + r.issues.map((i) => `• [${i.severity}] ${i.area ? i.area + ': ' : ''}${i.problem}${i.fix ? ' → ' + i.fix : ''}`).join('\n') : '';

export async function runPipeline(input: PipelineInput): Promise<DoneEvent | null> {
  const now = input.now ?? Date.now;
  const emit = input.onEvent;
  const signal = input.signal;
  const project = input.project && input.project.html ? input.project : null;
  const usage: Usage = { input: 0, output: 0 };
  const maxCont = input.maxContinuations ?? 4;
  const previewEvery = input.previewEvery ?? 1200;
  let route: Route;

  const addUsage = (u?: Usage) => {
    if (!u) return;
    usage.input += u.input || 0;
    usage.output += u.output || 0;
  };

  try {
    // 1. Route.
    let classified = classify(input.request, project?.kind ?? null);
    let llm = false;
    if (project && classified.confidence < 0.6 && input.routerModel !== false && !signal?.aborted) {
      try {
        const ctx: StepContext = { request: input.request, kind: project.kind, intent: classified.intent, projectName: project.name, history: project.history };
        const r = await input.call('spyglass', buildMessages('router', ctx), { role: 'router', effort: 'low', signal, ctx });
        addUsage(r.usage);
        const j = parseJson<{ intent?: string; kind?: string }>(r.text);
        if (j && (j.intent === 'new' || j.intent === 'edit' || j.intent === 'question')) {
          classified = { intent: j.intent, kind: j.intent === 'new' && isKind(j.kind) ? j.kind : project.kind, confidence: 0.9 };
          llm = true;
        }
      } catch (e) {
        if (isAbort(e) || FATAL.has(toAgentError(e).code)) throw e;
        /* the heuristic answer stands */
      }
    }
    route = makeRoute(input.request, { current: project?.kind ?? null, choice: input.choice, classified });
    route.llm = llm;
    emit({ type: 'route', route });

    const base: StepContext = {
      request: input.request,
      kind: route.kind,
      intent: route.intent,
      projectName: project?.name,
      history: project?.history,
      ultra: route.effort === 'ultra',
      memory: route.intent === 'new' ? undefined : project?.memory,
    };
    const polish = (h: string) => withMotionKit(h, { intro: route.kind !== 'game' });

    // One model call with streaming events. `html` steps auto-continue when cut off.
    const runStep = async (plan: StepPlan, ctx: StepContext, mode: 'json' | 'html' | 'text', id = plan.id) => {
      const started = now();
      emit({ type: 'step', id, role: plan.role, status: 'start', title: plan.title, model: plan.model, at: started });
      let messages: Msg[] = buildMessages(plan.role, ctx);
      let whole = '';
      let prefix = '';
      let sent = 0;
      let lastPreview = 0;
      let continued = 0;
      const onText = (part: string) => {
        whole = prefix ? stitch(prefix, part) : part;
        if (whole.length > sent) {
          emit({ type: 'text', id, delta: whole.slice(sent) });
          sent = whole.length;
        }
        if (mode === 'html') {
          emit({ type: 'progress', id, chars: whole.length, note: continued ? 'Продолжаю код…' : 'Пишу код…' });
          const t = now();
          if (t - lastPreview >= previewEvery && /<body/i.test(whole)) {
            lastPreview = t;
            const partial = extractHtml(whole);
            if (partial) emit({ type: 'html', html: partial, final: false });
          }
        }
      };
      for (;;) {
        let truncated = false;
        try {
          const r = await input.call(plan.model, messages, { role: plan.role, effort: plan.effort, signal, onText, ctx });
          addUsage(r.usage);
          onText(r.text);
          truncated = r.truncated;
        } catch (e) {
          const err = toAgentError(e);
          if (mode === 'html' && err.partial && !FATAL.has(err.code) && err.code !== 'refused' && err.partial.length > 2000) {
            onText(err.partial);
            truncated = true;
          } else {
            emit({ type: 'step', id, status: 'error', message: err.message });
            throw err;
          }
        }
        if (mode !== 'html') break;
        const html = extractHtml(whole) ?? '';
        if (!truncated && (isComplete(html) || !html)) break;
        if (continued >= maxCont || signal?.aborted) break;
        continued++;
        prefix = whole;
        messages = [...buildMessages(plan.role, ctx), { role: 'assistant', content: whole }, { role: 'user', content: CONTINUE }];
      }
      return { text: whole, ms: now() - started, continued, id };
    };

    const plans = route.steps;
    const planOf = (role: StepPlan['role']) => plans.find((p) => p.role === role);

    // 2. Question.
    if (route.intent === 'question') {
      const plan = planOf('answer')!;
      const r = await runStep(plan, { ...base, html: project?.html, spec: project?.spec ?? null }, 'text');
      emit({ type: 'step', id: plan.id, status: 'done', ms: r.ms, summary: 'Ответ готов' });
      const done: DoneEvent = { type: 'done', intent: 'question', kind: route.kind, reply: r.text.trim(), usage };
      emit(done);
      return done;
    }

    let spec: Spec | null = project?.spec ?? null;
    let design: Design | null = project?.design ?? null;

    // 3. Architect and designer (new projects).
    if (route.intent === 'new') {
      spec = null;
      design = null;
      const a = planOf('architect');
      if (a) {
        try {
          const r = await runStep(a, base, 'json');
          spec = parseJson<Spec>(r.text);
          if (spec && isKind(spec.kind) && spec.kind !== route.kind && route.kind === 'website') route.kind = spec.kind;
          emit({ type: 'step', id: a.id, status: 'done', ms: r.ms, summary: specSummary(spec), output: spec ? JSON.stringify(spec, null, 2).slice(0, 8000) : r.text.slice(0, 4000) });
        } catch (e) {
          if (isAbort(e) || FATAL.has(toAgentError(e).code)) throw e;
        }
      }
      const d = planOf('designer');
      if (d) {
        try {
          const r = await runStep(d, { ...base, kind: route.kind, spec }, 'json');
          design = parseJson<Design>(r.text);
          emit({
            type: 'step',
            id: d.id,
            status: 'done',
            ms: r.ms,
            summary: design?.direction ? String(design.direction).slice(0, 60) + (design.rationale ? ' — ' + String(design.rationale).slice(0, 90) : '') : 'Дизайн-система готова',
            output: design ? JSON.stringify(design, null, 2).slice(0, 8000) : r.text.slice(0, 4000),
          });
        } catch (e) {
          if (isAbort(e) || FATAL.has(toAgentError(e).code)) throw e;
        }
      } else if (route.intent === 'new') {
        emit({ type: 'step', id: 'designer', status: 'skipped', reason: 'Быстрый режим: дизайн задаёт Архитектор' });
      }
    }

    // 4. Developer.
    const dev = planOf('developer')!;
    const devCtx: StepContext = { ...base, kind: route.kind, spec, design, html: route.intent === 'edit' ? project!.html : undefined };
    const built = await runStep(dev, devCtx, 'html');
    let html = extractHtml(built.text);
    if (html) html = polish(html);
    if (!html) {
      const err = new AgentError('no_html', 'Модель не вернула HTML. Попробуйте ещё раз или выберите другую модель.');
      emit({ type: 'step', id: dev.id, status: 'error', message: err.message });
      throw err;
    }
    emit({
      type: 'step',
      id: dev.id,
      status: 'done',
      ms: built.ms,
      summary: Math.max(1, Math.round(html.length / 1024)) + ' КБ кода' + (built.continued ? ' · продолжено ' + plural(built.continued, 'раз', 'раза', 'раз') : '') + (isComplete(html) ? '' : ' · не завершён'),
    });
    emit({ type: 'html', html, final: false });

    // 5. Runtime diagnostics → tester → fix rounds.
    let report: Report | null = null;
    let runtime: Check[] = [];
    let audits = 0;
    const diagnose = async () => {
      if (!input.diagnose || signal?.aborted) return [];
      const id = audits++ ? 'audit-' + audits : 'audit';
      const started = now();
      emit({ type: 'step', id, role: 'audit', status: 'start', title: 'Диагностика', model: 'browser', at: started });
      try {
        const reports = await input.diagnose(html!, route.kind);
        emit({ type: 'step', id, status: 'done', ms: now() - started, summary: auditSummary(reports), output: auditOutput(reports) });
        return auditChecks(reports);
      } catch {
        emit({ type: 'step', id, status: 'skipped', reason: 'Не удалось запустить проверку в браузере' });
        return [];
      }
    };
    runtime = await diagnose();
    let checks = [...staticChecks(html, route.kind, input.syntax ?? null), ...runtime];
    const tester = planOf('tester');
    let round = 0;
    const test = async (id: string) => {
      if (!tester) return null;
      try {
        const r = await runStep(tester, { ...base, kind: route.kind, spec, html: html!, checks }, 'json', id);
        const rep = withChecks(normReport(parseJson(r.text)), checks);
        emit({ type: 'step', id, status: 'done', ms: r.ms, summary: reportSummary(rep), output: reportOutput(rep) });
        return rep;
      } catch (e) {
        if (isAbort(e) || FATAL.has(toAgentError(e).code)) throw e;
        return withChecks(null, checks);
      }
    };
    const fix = async (rep: Report, id: string, label: string) => {
      round++;
      const plan: StepPlan = { ...dev, id, title: label };
      const r = await runStep(plan, { ...base, kind: route.kind, spec, design, html: html!, report: rep, round, intent: route.intent }, 'html', id);
      const next = extractHtml(r.text);
      if (next && (isComplete(next) || !isComplete(html!))) {
        html = polish(next);
        runtime = await diagnose();
        checks = [...staticChecks(html, route.kind, input.syntax ?? null), ...runtime];
        emit({ type: 'step', id, status: 'done', ms: r.ms, summary: 'Исправлено · ' + Math.max(1, Math.round(html.length / 1024)) + ' КБ' });
        emit({ type: 'html', html, final: false });
      } else {
        emit({ type: 'step', id, status: 'done', ms: r.ms, summary: 'Исправление не завершилось — оставил прошлую версию' });
      }
    };

    if (tester) {
      report = await test('tester');
      while (report && report.verdict === 'fix' && round < route.fixRounds && !signal?.aborted) {
        await fix(report, 'fix-' + (round + 1), 'Разработчик · исправления');
        if (round < route.fixRounds) report = await test('tester-' + (round + 1));
        else {
          const left = failedChecks(checks).filter((c) => c.severity !== 'minor');
          report = { verdict: left.length ? 'fix' : 'pass', summary: left.length ? 'Остались замечания автопроверок.' : 'Исправления применены.', issues: left.map((c) => ({ severity: c.severity, problem: c.message })) };
        }
      }
    } else {
      emit({ type: 'step', id: 'tester', status: 'skipped', reason: 'Небольшая правка — хватило автоматических проверок' });
      const bad = withChecks(null, checks);
      // A JavaScript error found in the browser is always worth one fix, even on quick edits.
      const critical = bad?.issues.some((i) => i.severity === 'critical');
      if (bad && (route.fixRounds > 0 || critical)) await fix(bad, 'fix-1', 'Разработчик · исправления');
    }

    // 6. Ultra review.
    const reviewer = planOf('reviewer');
    if (reviewer && !signal?.aborted) {
      try {
        const r = await runStep(reviewer, { ...base, kind: route.kind, spec, design, html }, 'json');
        const rev = normReport(parseJson(r.text));
        emit({ type: 'step', id: reviewer.id, status: 'done', ms: r.ms, summary: rev && rev.issues.length ? 'Предложил улучшений: ' + rev.issues.length : 'Замечаний нет', output: reportOutput(rev) });
        if (rev && rev.issues.length) await fix({ ...rev, verdict: 'fix' }, 'polish', 'Разработчик · полировка');
      } catch (e) {
        if (isAbort(e) || FATAL.has(toAgentError(e).code)) throw e;
      }
    }

    const name = (spec?.name && String(spec.name).slice(0, 60)) || titleOf(html) || project?.name || input.request.slice(0, 40);
    const reply = replyFor(route.intent, route.kind, name, spec, report);
    emit({ type: 'html', html, final: true });
    const done: DoneEvent = { type: 'done', intent: route.intent, kind: route.kind, html, reply, name, spec, design, report, usage };
    emit(done);
    return done;
  } catch (e) {
    const err = toAgentError(e);
    emit({ type: 'error', code: err.code, message: err.code === 'cancelled' ? 'Остановлено.' : err.message });
    return null;
  }
}

function replyFor(intent: Intent, kind: Kind, name: string, spec: Spec | null, report: Report | null): string {
  const tail = !report
    ? ''
    : report.verdict === 'pass'
      ? ' Тестировщик проверил проект — проблем не осталось.'
      : ' Остались замечания тестировщика — их можно поправить следующим сообщением.';
  if (intent === 'edit') return 'Готово — изменения применены.' + tail;
  const what = spec?.summary ? String(spec.summary).replace(/\.$/, '') : KIND_LABELS[kind];
  return `Собрал «${name}»: ${what}.${tail} Пишите, что изменить.`;
}

export { stepTitle };
