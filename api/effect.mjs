import Anthropic from '@anthropic-ai/sdk';
import { AgentError, MODELS as EFFECT_MODELS, buildMessages, defaultSyntaxCheck, isEffort, isKind, parseModel, runPipeline } from './_agent.mjs';

/**
 * Effect agent endpoint (Vercel function).
 *   GET  /api/effect                      → providers and Effect models
 *   GET  /api/effect?catalog=openrouter   → OpenRouter model catalog (cached for an hour)
 *   POST {op: 'step', role, model, effort, ctx}  → one agent step, NDJSON: start / text / done | error
 *   POST {op: 'run', request, project?, model?, effort?} → the whole pipeline, NDJSON pipeline events
 * Prompts are rebuilt here from the structured context (shared buildMessages), so clients
 * never send raw system prompts. Keys stay on the server.
 */

// Model configuration: which provider model each Effect model runs on.
export const PROVIDER_MODELS = {
  astrolabe: { model: process.env.EFFECT_MODEL_ASTROLABE || 'claude-opus-5-5', fallback: true },
  compass: { model: process.env.EFFECT_MODEL_COMPASS || 'claude-sonnet-5-5', fallback: true },
  spyglass: { model: process.env.EFFECT_MODEL_SPYGLASS || 'claude-haiku-5-5', fallback: false },
};
const OPENROUTER = 'https://openrouter.ai/api/v1';
const SITE = 'https://focus-nine-chi.vercel.app/effect';
const ROLES = new Set(['router', 'architect', 'designer', 'developer', 'tester', 'reviewer', 'answer']);
const LEVELS = new Set(['low', 'medium', 'high', 'max']);
const INTENTS = new Set(['new', 'edit', 'question']);
const ENV_KEYS = ['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY'];
const MAX_BODY = 700_000;
const MAX_HTML = 400_000;
const MAX_JSON = 60_000;
/** Stop streaming a little before the platform's 300 s limit; the client continues. */
const TIME_BUDGET_MS = Number(process.env.EFFECT_TIME_BUDGET_MS) || 280_000;
const WINDOW_MS = 10 * 60_000;
const PER_WINDOW = Number(process.env.EFFECT_RATE_LIMIT) || 80;
const CATALOG_TTL = 60 * 60_000;
const hits = new Map();
let catalogCache = { at: 0, models: null };

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (status, body) => Response.json(body, { status, headers });

function clientIp(request) {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
}

function limited(ip, now = Date.now()) {
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= PER_WINDOW) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5_000) hits.clear();
  return false;
}

/** Test hook: forget rate-limit state and the catalog cache. */
export function resetState() {
  hits.clear();
  catalogCache = { at: 0, models: null };
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : undefined);
function obj(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  try {
    return JSON.stringify(v).length <= MAX_JSON ? v : null;
  } catch {
    return null;
  }
}

/** Validates the step context a client sends. Returns null when it is unusable. */
export function cleanContext(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const request = str(raw.request, 6000)?.trim();
  if (!request || !isKind(raw.kind) || !INTENTS.has(raw.intent)) return null;
  if (typeof raw.html === 'string' && raw.html.length > MAX_HTML) return null;
  const history = Array.isArray(raw.history)
    ? raw.history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
        .slice(-8)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 800) }))
    : undefined;
  const checks = Array.isArray(raw.checks)
    ? raw.checks
        .filter((c) => c && typeof c.message === 'string')
        .slice(0, 30)
        .map((c) => ({ id: String(c.id || '').slice(0, 40), ok: Boolean(c.ok), severity: ['critical', 'major', 'minor'].includes(c.severity) ? c.severity : 'minor', message: c.message.slice(0, 300) }))
    : undefined;
  const report = obj(raw.report);
  return {
    request,
    kind: raw.kind,
    intent: raw.intent,
    html: typeof raw.html === 'string' ? raw.html : undefined,
    spec: obj(raw.spec),
    design: obj(raw.design),
    report: report && Array.isArray(report.issues) ? report : null,
    checks,
    history,
    projectName: str(raw.projectName, 80),
    ultra: Boolean(raw.ultra),
    round: Number.isInteger(raw.round) ? Math.min(5, Math.max(1, raw.round)) : undefined,
  };
}

/** Anthropic messages: system text separate, alternating turns starting with the user. */
function toAnthropic(messages) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const turns = [];
  for (const m of messages) {
    if (m.role === 'system' || !m.content) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + m.content;
    else turns.push({ role: m.role, content: m.content });
  }
  if (!turns.length || turns[0].role !== 'user') turns.unshift({ role: 'user', content: 'Continue.' });
  if (turns[turns.length - 1].role !== 'user') turns.push({ role: 'user', content: 'Continue.' });
  return { system, turns };
}

const maxTokensFor = (role) => (role === 'developer' ? 64_000 : role === 'answer' ? 4_000 : role === 'router' ? 400 : 12_000);

/** One provider call. `onDelta` receives text as it streams. */
export function makeProviders({ env, makeClient, fetchImpl }) {
  async function anthropic(id, messages, { role, effort, signal, onDelta }) {
    const cfg = PROVIDER_MODELS[id];
    const { system, turns } = toAnthropic(messages);
    const client = makeClient(env);
    try {
      const stream = client.beta.messages.stream(
        {
          model: cfg.model,
          max_tokens: maxTokensFor(role),
          ...(cfg.fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
          output_config: { effort },
          system,
          messages: turns,
        },
        { signal },
      );
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') onDelta(event.delta.text);
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') throw new AgentError('refused', 'The model declined this request.');
      return {
        truncated: final.stop_reason === 'max_tokens',
        stop: final.stop_reason,
        usage: { input: final.usage?.input_tokens ?? 0, output: final.usage?.output_tokens ?? 0 },
      };
    } catch (error) {
      if (error instanceof AgentError) throw error;
      if (signal?.aborted) throw new AgentError('cancelled', 'Stopped.');
      const status = error instanceof Anthropic.APIError ? error.status : 0;
      throw new AgentError(status === 429 || status === 529 ? 'busy' : status === 400 ? 'bad_request' : 'failed', 'Anthropic request failed' + (status ? ' (' + status + ')' : '') + '.');
    }
  }

  async function openrouter(id, messages, { effort, role, signal, onDelta }) {
    const res = await fetchImpl(OPENROUTER + '/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.OPENROUTER_API_KEY,
        'Content-Type': 'application/json',
        'HTTP-Referer': SITE,
        'X-Title': 'Effect',
      },
      body: JSON.stringify({
        model: id,
        stream: true,
        max_tokens: maxTokensFor(role),
        reasoning: { effort: effort === 'max' ? 'high' : effort },
        usage: { include: true },
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal,
    }).catch((e) => {
      throw signal?.aborted ? new AgentError('cancelled', 'Stopped.') : new AgentError('failed', 'OpenRouter is unreachable: ' + (e?.message || 'network error'));
    });
    if (!res.ok || !res.body) {
      const code = res.status === 429 ? 'busy' : res.status === 401 || res.status === 403 ? 'no_key' : res.status === 402 ? 'busy' : res.status === 400 || res.status === 404 ? 'bad_request' : 'failed';
      throw new AgentError(code, 'OpenRouter request failed (' + res.status + ').');
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let truncated = false;
    let stop = 'stop';
    let usage = { input: 0, output: 0 };
    const line = (l) => {
      if (!l.startsWith('data:')) return;
      const data = l.slice(5).trim();
      if (!data || data === '[DONE]') return;
      let chunk;
      try {
        chunk = JSON.parse(data);
      } catch {
        return;
      }
      if (chunk.error) throw new AgentError('failed', 'OpenRouter: ' + String(chunk.error.message || 'error').slice(0, 200));
      const choice = chunk.choices?.[0];
      const text = choice?.delta?.content;
      if (typeof text === 'string' && text) onDelta(text);
      if (choice?.finish_reason) {
        stop = choice.finish_reason;
        if (stop === 'length') truncated = true;
      }
      if (chunk.usage) usage = { input: chunk.usage.prompt_tokens ?? 0, output: chunk.usage.completion_tokens ?? 0, cost: chunk.usage.cost };
    };
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          line(buf.slice(0, i).trim());
          buf = buf.slice(i + 1);
        }
      }
      line(buf.trim());
    } catch (e) {
      if (e instanceof AgentError) throw e;
      if (signal?.aborted) throw new AgentError('cancelled', 'Stopped.');
      throw new AgentError('failed', 'OpenRouter stream broke.');
    }
    return { truncated, stop, usage };
  }

  /** Dispatches a model reference to its provider. */
  return async function provide(model, messages, opts) {
    const ref = parseModel(model);
    if (!ref) throw new AgentError('bad_request', 'Unknown model.');
    if (ref.provider === 'effect') {
      if (!env.ANTHROPIC_API_KEY) throw new AgentError('no_key', 'ANTHROPIC_API_KEY is not set.');
      return anthropic(ref.id, messages, opts);
    }
    if (!env.OPENROUTER_API_KEY) throw new AgentError('no_key', 'OPENROUTER_API_KEY is not set.');
    return openrouter(ref.id, messages, opts);
  };
}

/** OpenRouter catalog, trimmed and cached. Prices are USD per million tokens. */
async function catalog(env, fetchImpl, now) {
  if (catalogCache.models && now - catalogCache.at < CATALOG_TTL) return catalogCache.models;
  const res = await fetchImpl(OPENROUTER + '/models', { headers: { Authorization: 'Bearer ' + env.OPENROUTER_API_KEY } });
  if (!res.ok) throw new Error('catalog ' + res.status);
  const data = await res.json();
  const per = (v) => (v == null || v === '' || isNaN(Number(v)) ? undefined : Math.round(Number(v) * 1e6 * 1000) / 1000);
  const models = (Array.isArray(data?.data) ? data.data : [])
    .filter((m) => typeof m?.id === 'string' && m.id.includes('/') && (!m.architecture?.output_modalities || m.architecture.output_modalities.includes('text')))
    .map((m) => ({
      id: m.id,
      name: String(m.name || m.id).replace(/^[^:]+:\s*/, '').slice(0, 80),
      provider: m.id.split('/')[0],
      context: Number(m.context_length) || undefined,
      prompt: per(m.pricing?.prompt),
      completion: per(m.pricing?.completion),
    }))
    .filter((m) => parseModel('or:' + m.id))
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name))
    .slice(0, 600);
  catalogCache = { at: now, models };
  return models;
}

const enc = new TextEncoder();
const line = (o) => enc.encode(JSON.stringify(o) + '\n');
const ndjson = (stream) =>
  new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', ...headers } });

export function createEffectHandler({
  env = process.env,
  makeClient = (e) => new Anthropic({ apiKey: e.ANTHROPIC_API_KEY }),
  fetchImpl = (...a) => fetch(...a),
  now = Date.now,
  timeBudgetMs = TIME_BUDGET_MS,
} = {}) {
  const provide = makeProviders({ env, makeClient, fetchImpl });
  const syntax = defaultSyntaxCheck();

  return async function handle(request) {
    const anthropicOn = Boolean(env.ANTHROPIC_API_KEY);
    const openrouterOn = Boolean(env.OPENROUTER_API_KEY);
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.searchParams.get('catalog') === 'openrouter') {
        if (!openrouterOn) return json(200, { models: [] });
        try {
          return json(200, { models: await catalog(env, fetchImpl, now()) });
        } catch {
          return json(502, { models: [], error: 'OpenRouter catalog is unavailable.' });
        }
      }
      return json(200, {
        ai: anthropicOn || openrouterOn,
        providers: { anthropic: anthropicOn, openrouter: openrouterOn },
        models: EFFECT_MODELS.map((m) => ({ id: m.id, name: m.name, available: anthropicOn })),
        env: ENV_KEYS,
      });
    }
    if (request.method !== 'POST') {
      const res = json(405, { error: 'Use GET or POST.' });
      res.headers.set('Allow', 'GET, POST');
      return res;
    }
    if (!anthropicOn && !openrouterOn) return json(503, { code: 'no_key', error: 'No AI provider is configured on this deployment.', env: ENV_KEYS });

    let body;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY) throw new Error('large');
      body = JSON.parse(text);
    } catch {
      return json(400, { code: 'bad_request', error: 'Invalid request.' });
    }
    if (limited(clientIp(request), now())) return json(429, { code: 'rate_limited', error: 'Too many requests. Try again in a few minutes.' });

    if (body?.op === 'step') {
      const ctx = cleanContext(body.ctx);
      const ref = parseModel(body.model);
      if (!ctx || !ROLES.has(body.role) || !ref || !LEVELS.has(body.effort)) return json(400, { code: 'bad_request', error: 'Invalid step.' });
      if (ref.provider === 'effect' && !anthropicOn) return json(503, { code: 'no_key', error: 'ANTHROPIC_API_KEY is not set.' });
      if (ref.provider === 'openrouter' && !openrouterOn) return json(503, { code: 'no_key', error: 'OPENROUTER_API_KEY is not set.' });
      const messages = buildMessages(body.role, ctx);
      const upstream = new AbortController();
      request.signal?.addEventListener('abort', () => upstream.abort());
      const started = now();
      return ndjson(
        new ReadableStream({
          async start(controller) {
            const timer = setTimeout(() => upstream.abort('time'), timeBudgetMs);
            let sent = 0;
            try {
              controller.enqueue(line({ type: 'start', model: ref.provider === 'effect' ? EFFECT_MODELS.find((m) => m.id === ref.id).name : ref.id }));
              const r = await provide(body.model, messages, {
                role: body.role,
                effort: body.effort,
                signal: upstream.signal,
                onDelta: (delta) => {
                  sent += delta.length;
                  controller.enqueue(line({ type: 'text', delta }));
                },
              });
              controller.enqueue(line({ type: 'done', truncated: r.truncated, stop: r.stop, usage: r.usage, ms: now() - started }));
            } catch (e) {
              if (upstream.signal.aborted && upstream.signal.reason === 'time' && sent > 0) {
                controller.enqueue(line({ type: 'done', truncated: true, stop: 'time', ms: now() - started }));
              } else {
                const err = e instanceof AgentError ? e : new AgentError('failed', 'Generation failed.');
                controller.enqueue(line({ type: 'error', code: err.code, message: err.message }));
              }
            } finally {
              clearTimeout(timer);
              controller.close();
            }
          },
        }),
      );
    }

    if (body?.op === 'run') {
      const requestText = str(body.request, 6000)?.trim();
      const project =
        body.project && typeof body.project === 'object' && typeof body.project.html === 'string' && body.project.html.length <= MAX_HTML && isKind(body.project.kind)
          ? { name: str(body.project.name, 80) || 'Проект', kind: body.project.kind, html: body.project.html, spec: obj(body.project.spec), design: obj(body.project.design) }
          : null;
      const model = body.model && body.model !== 'auto' ? body.model : undefined;
      if (!requestText || (model && !parseModel(model))) return json(400, { code: 'bad_request', error: 'Invalid run.' });
      const upstream = new AbortController();
      request.signal?.addEventListener('abort', () => upstream.abort());
      return ndjson(
        new ReadableStream({
          async start(controller) {
            const call = async (m, messages, opts) => {
              let whole = '';
              const r = await provide(m, messages, {
                role: opts.role,
                effort: opts.effort,
                signal: opts.signal,
                onDelta: (d) => {
                  whole += d;
                  opts.onText?.(whole);
                },
              });
              return { text: whole, truncated: r.truncated, usage: r.usage };
            };
            try {
              await runPipeline({
                request: requestText,
                project,
                choice: { model, effort: isEffort(body.effort) ? body.effort : 'auto' },
                call,
                signal: upstream.signal,
                syntax,
                previewEvery: 4000,
                onEvent: (e) => controller.enqueue(line(e)),
              });
            } finally {
              controller.close();
            }
          },
        }),
      );
    }

    return json(400, { code: 'bad_request', error: 'Unknown op.' });
  };
}

export default { fetch: createEffectHandler() };
