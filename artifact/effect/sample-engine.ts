/**
 * Artifact transport: every agent call goes through the runtime `sample` capability, so
 * Effect runs on the viewer's own Claude plan with no keys. Tiers: Spyglass → quick,
 * Compass → default, Astrolabe → complex. Efforts low / medium / high (Ultra = high plus
 * a review round in the pipeline). OpenRouter needs the network and works on the site only.
 */
import { defaultSyntaxCheck } from '../../lib/effect/agent/html.ts';
import { MODELS, parseModel } from '../../lib/effect/agent/models.ts';
import { AgentError, type CallFn, type Msg } from '../../lib/effect/agent/types.ts';
import type { Engine, SaveResult } from '../../components/effect/studio/engine.ts';

type SampleResult = { text: string; truncated: boolean; modelTierApplied?: string };
type SampleFn = (
  input: string | { role: 'user' | 'assistant'; content: string }[],
  opts?: Record<string, unknown>,
) => Promise<SampleResult>;
type Downloads = { save(req: { filename: string; data: string | Blob }): Promise<{ status: string }> };
type Permissions = { manage(): Promise<void> };
type ClaudeRuntime = { use(name: string): Promise<unknown> };

const runtime = (): ClaudeRuntime | null => (window as unknown as { claude?: ClaudeRuntime }).claude ?? null;
const memo = new Map<string, Promise<unknown>>();
function use<T>(name: string): Promise<T | null> {
  if (!memo.has(name)) {
    const c = runtime();
    memo.set(name, c?.use ? c.use(name).catch(() => null) : Promise.resolve(null));
  }
  return memo.get(name) as Promise<T | null>;
}

const COPY: Record<string, string> = {
  not_granted: 'Effect не получил разрешение использовать Claude.',
  sampling_disabled: 'Claude недоступен для этого аккаунта или организации.',
  not_declared: 'Эта версия страницы не может обращаться к Claude.',
  capability_disabled: 'Обращение к Claude недоступно в этом окне.',
  capability_removed: 'Обращение к Claude недоступно в этом окне.',
  rate_limited: 'Слишком много запросов к Claude подряд. Подождите немного и отправьте снова.',
  session_expired: 'Сессия Claude истекла — войдите снова и повторите.',
  refused: 'Claude отказался выполнять этот запрос. Попробуйте сформулировать иначе.',
  empty_completion: 'Модель вернула пустой ответ. Попробуйте ещё раз или упростите запрос.',
  prompt_too_large: 'Проект слишком большой для одного запроса. Попросите изменить меньшую часть.',
  upstream_error: 'Связь с Claude прервалась. Попробуйте ещё раз.',
  invalid_request: 'Некорректный запрос к Claude.',
  queue_overflow: 'Слишком много запросов. Обновите страницу.',
  cancelled: 'Остановлено.',
};
const MAX_BYTES = 250_000;

/** `sample` has no system role: instructions become the leading user turn. */
export function toSampleInput(messages: Msg[]): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content = m.role === 'system' ? 'Instructions for this task (follow them exactly):\n' + m.content : m.content;
    if (content.trim()) out.push({ role, content });
  }
  if (!out.length || out[0].role !== 'user') out.unshift({ role: 'user', content: 'Continue.' });
  if (out[out.length - 1].role !== 'user') out.push({ role: 'user', content: 'Continue.' });
  return out;
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

const call: CallFn = async (model, messages, opts) => {
  const ref = parseModel(model);
  if (ref?.provider === 'openrouter') throw new AgentError('unavailable', 'Модели OpenRouter работают на сайте Effect. Здесь выберите модель Effect или «Авто».');
  const sample = await use<SampleFn>('sample');
  if (!sample) throw new AgentError('unavailable', 'В этом окне ИИ недоступен. Откройте Effect в Claude.');
  const tier = ref?.provider === 'effect' ? MODELS.find((m) => m.id === ref.id)!.tier : 'default';
  const input = toSampleInput(messages);
  if (bytes(input.map((m) => m.content).join('')) > MAX_BYTES) throw new AgentError('prompt_too_large', COPY.prompt_too_large);
  try {
    const r = await sample(input, {
      modelTier: tier,
      effort: opts.effort === 'max' ? 'high' : opts.effort,
      cache: false,
      signal: opts.signal,
      onText: opts.onText ? ({ text }: { text: string }) => opts.onText!(text) : undefined,
    });
    return { text: r.text, truncated: Boolean(r.truncated), model: r.modelTierApplied };
  } catch (e) {
    const err = (e ?? {}) as { code?: string; message?: string; text?: string; reason?: string };
    const code = typeof err.code === 'string' ? err.code : 'upstream_error';
    const message =
      code === 'rate_limited' && err.reason === 'usage_limit'
        ? 'Исчерпан лимит вашего тарифа Claude. Попробуйте позже.'
        : (COPY[code] ?? COPY.upstream_error);
    throw new AgentError(code, message, code === 'refused' ? undefined : err.text);
  }
};

export const sampleEngine: Engine = {
  surface: 'artifact',
  call,
  syntax: defaultSyntaxCheck(),
  async status() {
    const s = await use<SampleFn>('sample');
    return s ? { state: 'ready', effect: true, openrouter: false } : { state: 'no-sample' };
  },
  async save(filename: string, data: string): Promise<SaveResult> {
    const d = await use<Downloads>('downloads');
    if (!d) return 'unavailable';
    try {
      await d.save({ filename, data });
      return 'saved';
    } catch (e) {
      const code = (e as { code?: string })?.code;
      return code === 'declined' || code === 'rate_limited' ? 'declined' : 'unavailable';
    }
  },
  async manage() {
    const p = await use<Permissions>('permissions');
    if (p) await p.manage();
  },
};
