/** Effect's model line-up, effort levels and model references. Shared by every surface. */
import type { EffortId, Kind, Level, ModelId, Route, Usage } from './types.ts';

export type EffectModel = {
  id: ModelId;
  name: string;
  short: string;
  tag: string;
  blurb: string;
  /** `sample` tier used inside the artifact. */
  tier: 'quick' | 'default' | 'complex';
  /** Site price of the default backing model, USD per million tokens (input / output). */
  price: { input: number; output: number };
  /** Context window, tokens. */
  context: number;
};

export const MODELS: EffectModel[] = [
  {
    id: 'astrolabe',
    name: 'Effect Astrolabe',
    short: 'Astrolabe',
    tag: 'Самая мощная',
    blurb: 'Большие многостраничные сайты, приложения и игры с уровнями, физикой и звуком.',
    tier: 'complex',
    price: { input: 4, output: 20 },
    context: 1_000_000,
  },
  {
    id: 'compass',
    name: 'Effect Compass',
    short: 'Compass',
    tag: 'Баланс',
    blurb: 'Сайты, лендинги и презентации: быстро и с вниманием к деталям.',
    tier: 'default',
    price: { input: 2, output: 10 },
    context: 1_000_000,
  },
  {
    id: 'spyglass',
    name: 'Effect Spyglass',
    short: 'Spyglass',
    tag: 'Самая быстрая',
    blurb: 'Ответы, быстрые правки и черновики за секунды.',
    tier: 'quick',
    price: { input: 0.1, output: 0.5 },
    context: 1_000_000,
  },
];

export const EFFORTS: { id: EffortId; name: string; hint: string }[] = [
  { id: 'auto', name: 'Авто', hint: 'Effect сам выбирает глубину под задачу' },
  { id: 'quick', name: 'Быстро', hint: 'Меньше шагов и размышлений — максимум скорости' },
  { id: 'thoughtful', name: 'Вдумчиво', hint: 'Полная команда агентов, один раунд исправлений' },
  { id: 'deep', name: 'Глубоко', hint: 'Больше размышлений на каждом шаге, до двух раундов исправлений' },
  { id: 'ultra', name: 'Ultra', hint: 'Глубоко + отдельный раунд ревью. Медленнее, но заметно сильнее' },
];

export const KIND_LABELS: Record<Kind, string> = {
  website: 'Сайт',
  landing: 'Лендинг',
  presentation: 'Презентация',
  game: 'Игра',
  app: 'Приложение',
  dashboard: 'Дашборд',
  other: 'Проект',
};

export const isModelId = (v: unknown): v is ModelId => MODELS.some((m) => m.id === v);
export const isEffort = (v: unknown): v is EffortId => EFFORTS.some((e) => e.id === v);
export const isKind = (v: unknown): v is Kind => typeof v === 'string' && Object.hasOwn(KIND_LABELS, v);

/** Provider-level effort for a composer effort. */
export function levelFor(effort: Exclude<EffortId, 'auto'>): Level {
  return effort === 'quick' ? 'low' : effort === 'thoughtful' ? 'medium' : effort === 'deep' ? 'high' : 'max';
}

export type ModelRef = { provider: 'effect'; id: ModelId } | { provider: 'openrouter'; id: string };

const OR_ID = /^[a-z0-9][\w.-]*\/[\w.:@-]+$/i;

/** Parses "astrolabe" or "or:vendor/model". Returns null for anything else. */
export function parseModel(ref: unknown): ModelRef | null {
  if (typeof ref !== 'string') return null;
  if (isModelId(ref)) return { provider: 'effect', id: ref };
  if (ref.startsWith('or:') && OR_ID.test(ref.slice(3)) && ref.length < 140) return { provider: 'openrouter', id: ref.slice(3) };
  return null;
}

/** Human name of a model reference: "Effect Compass", "openai/gpt-5" → "gpt-5". */
export function modelName(ref: string, catalog?: { id: string; name: string }[]): string {
  const m = parseModel(ref);
  if (!m) return 'Effect';
  if (m.provider === 'effect') return MODELS.find((x) => x.id === m.id)!.name;
  const hit = catalog?.find((c) => c.id === m.id);
  return hit?.name || m.id.split('/')[1] || m.id;
}

export const effortName = (e: EffortId) => EFFORTS.find((x) => x.id === e)?.name ?? 'Авто';

// ───────────── Cost ─────────────

/** Prices of OpenRouter models, USD per million tokens. */
export type PriceList = { id: string; prompt?: number; completion?: number }[];

/** USD per million tokens of a model reference, or null when unknown. */
export function priceOf(ref: string, catalog?: PriceList): { input: number; output: number } | null {
  const m = parseModel(ref);
  if (!m) return null;
  if (m.provider === 'effect') return MODELS.find((x) => x.id === m.id)!.price;
  const hit = catalog?.find((c) => c.id === m.id);
  return hit && hit.prompt != null && hit.completion != null ? { input: hit.prompt, output: hit.completion } : null;
}

/** Cost of a finished run. `partial` when some model's price is unknown. */
export function costOf(usage: Usage | undefined, catalog?: PriceList): { usd: number; partial: boolean } | null {
  if (!usage?.byModel) return null;
  let usd = 0;
  let partial = false;
  let any = false;
  for (const [ref, u] of Object.entries(usage.byModel)) {
    const p = priceOf(ref, catalog);
    if (!p) {
      partial = true;
      continue;
    }
    any = true;
    usd += (u.input * p.input + u.output * p.output) / 1e6;
  }
  return any ? { usd, partial } : null;
}

/** Typical tokens per step (input, output), measured on ordinary sites. */
const TYPICAL: Record<string, [number, number]> = {
  architect: [2500, 1500],
  designer: [3500, 1800],
  developer: [7000, 16000],
  tester: [18000, 1200],
  reviewer: [18000, 1500],
  answer: [3000, 900],
};

/** Rough cost of a planned route: typical tokens per step, plus one fix round when planned. */
export function estimateRoute(route: Pick<Route, 'steps' | 'fixRounds'>, catalog?: PriceList): { usd: number; partial: boolean } {
  let usd = 0;
  let partial = false;
  const add = (role: string, model: string, share = 1) => {
    const p = priceOf(model, catalog);
    const t = TYPICAL[role];
    if (!t) return;
    if (!p) return void (partial = true);
    usd += ((t[0] * p.input + t[1] * p.output) / 1e6) * share;
  };
  for (const s of route.steps) add(s.role, s.model);
  const dev = route.steps.find((s) => s.role === 'developer');
  // A fix round is a patch most of the time: about a third of a developer step.
  if (dev && route.fixRounds > 0) add('developer', dev.model, 0.35);
  return { usd, partial };
}

/** "$0.042", "<$0.001", "$1.20". */
export function formatUsd(usd: number): string {
  if (usd < 0.001) return '<$0.001';
  if (usd < 0.1) return '$' + usd.toFixed(3);
  if (usd < 10) return '$' + usd.toFixed(2);
  return '$' + Math.round(usd);
}
