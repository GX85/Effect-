/** Effect's model line-up, effort levels and model references. Shared by every surface. */
import type { EffortId, Kind, Level, ModelId } from './types.ts';

export type EffectModel = {
  id: ModelId;
  name: string;
  short: string;
  tag: string;
  blurb: string;
  /** `sample` tier used inside the artifact. */
  tier: 'quick' | 'default' | 'complex';
};

export const MODELS: EffectModel[] = [
  {
    id: 'astrolabe',
    name: 'Effect Astrolabe',
    short: 'Astrolabe',
    tag: 'Самая мощная',
    blurb: 'Большие многостраничные сайты, приложения и игры с уровнями, физикой и звуком.',
    tier: 'complex',
  },
  {
    id: 'compass',
    name: 'Effect Compass',
    short: 'Compass',
    tag: 'Баланс',
    blurb: 'Сайты, лендинги и презентации: быстро и с вниманием к деталям.',
    tier: 'default',
  },
  {
    id: 'spyglass',
    name: 'Effect Spyglass',
    short: 'Spyglass',
    tag: 'Самая быстрая',
    blurb: 'Ответы, быстрые правки и черновики за секунды.',
    tier: 'quick',
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
