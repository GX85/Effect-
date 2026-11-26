/**
 * Site transport: every agent step is one POST to /api/effect ({op: 'step'}). The server
 * rebuilds the role prompt from the structured context, calls Anthropic or OpenRouter and
 * streams NDJSON events back. A stream that ends without `done` (function time limit,
 * dropped connection) is reported as truncated so the pipeline continues where it stopped.
 */
import { defaultSyntaxCheck } from '@/lib/effect/agent/html';
import { AgentError, type CallFn } from '@/lib/effect/agent/types';
import type { CatalogModel, Engine, EngineStatus } from './engine';

const ENDPOINT = '/api/effect';

type StepEvent =
  | { type: 'start'; model?: string }
  | { type: 'text'; delta: string }
  | { type: 'done'; truncated?: boolean; usage?: { input: number; output: number } }
  | { type: 'error'; code: string; message: string };

const ERRORS: Record<string, string> = {
  busy: 'Модель сейчас перегружена. Попробуйте через минуту или выберите другую.',
  refused: 'Модель отказалась выполнять этот запрос. Попробуйте сформулировать иначе.',
  no_key: 'На этом сайте не подключён ключ для выбранного провайдера.',
  rate_limited: 'Слишком много генераций подряд. Подождите несколько минут.',
  bad_request: 'Запрос слишком большой или некорректный.',
  failed: 'Генерация прервалась. Попробуйте ещё раз.',
};

const call: CallFn = async (model, _messages, opts) => {
  if (!opts.ctx) throw new AgentError('bad_request', 'Нет контекста шага.');
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'step', role: opts.role, model, effort: opts.effort, ctx: opts.ctx }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new AgentError('cancelled', 'Остановлено.');
    throw new AgentError(navigator.onLine ? 'failed' : 'offline', navigator.onLine ? ERRORS.failed : 'Нет сети. Проверьте подключение.');
  }
  if (!res.ok || !res.body) {
    const err = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
    const code = err.code || (res.status === 429 ? 'rate_limited' : res.status === 503 ? 'no_key' : 'failed');
    throw new AgentError(code, ERRORS[code] || err.error || ERRORS.failed);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let text = '';
  let done: Extract<StepEvent, { type: 'done' }> | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    let ev: StepEvent;
    try {
      ev = JSON.parse(line) as StepEvent;
    } catch {
      return;
    }
    if (ev.type === 'text') {
      text += ev.delta;
      opts.onText?.(text);
    } else if (ev.type === 'done') done = ev;
    else if (ev.type === 'error') throw new AgentError(ev.code, ERRORS[ev.code] || ev.message, text || undefined);
  };
  try {
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n')) >= 0) {
        handle(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    }
    handle(buf);
  } catch (e) {
    if (e instanceof AgentError) throw e;
    if ((e as Error).name === 'AbortError') throw new AgentError('cancelled', 'Остановлено.', text || undefined);
    // The connection dropped mid-answer: keep what arrived and let the pipeline continue.
    if (text) return { text, truncated: true };
    throw new AgentError('failed', ERRORS.failed);
  }
  const d = done as Extract<StepEvent, { type: 'done' }> | null;
  if (!d) {
    if (!text) throw new AgentError('failed', ERRORS.failed);
    return { text, truncated: true };
  }
  return { text, truncated: Boolean(d.truncated), usage: d.usage };
};

let catalogCache: Promise<CatalogModel[]> | null = null;

export const siteEngine: Engine = {
  surface: 'site',
  call,
  syntax: typeof window === 'undefined' ? null : defaultSyntaxCheck(),
  async status(): Promise<EngineStatus> {
    try {
      const r = await fetch(ENDPOINT, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!r.ok) return { state: 'no-key', env: ['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY'] };
      const d = (await r.json()) as { providers?: { anthropic?: boolean; openrouter?: boolean }; env?: string[] };
      const effect = Boolean(d.providers?.anthropic);
      const openrouter = Boolean(d.providers?.openrouter);
      if (!effect && !openrouter) return { state: 'no-key', env: d.env ?? ['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY'] };
      return { state: 'ready', effect, openrouter };
    } catch {
      return { state: 'no-key', env: ['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY'] };
    }
  },
  catalog() {
    catalogCache ??= fetch(ENDPOINT + '?catalog=openrouter')
      .then((r) => (r.ok ? (r.json() as Promise<{ models?: CatalogModel[] }>) : { models: [] }))
      .then((d) => d.models ?? [])
      .catch(() => {
        catalogCache = null;
        return [];
      });
    return catalogCache;
  },
};
