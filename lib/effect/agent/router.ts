/**
 * Intent router: decides whether a message starts a new project, changes the current one
 * or asks a question; detects the project kind and complexity; resolves "Авто" into a
 * concrete effort and a per-step model plan. Pure and instant — the pipeline asks a model
 * only when `confidence` is low.
 */
import { effortName, KIND_LABELS, levelFor, modelName, parseModel } from './models.ts';
import type { Choice, EffortId, Intent, Kind, Route, StepPlan } from './types.ts';

const KIND_WORDS: [Kind, RegExp][] = [
  ['game', /(игр[аыуеой]|игрушк|аркад|шутер|раннер|платформер|змейк|тетрис|арканоид|головоломк|пазл|квест|\bgame\b|arcade|shooter|platformer|runner|snake|tetris|puzzle|breakout)/iu],
  ['presentation', /(презентац|слайд|питч|pitch|deck|slides|доклад|выступлени)/iu],
  ['dashboard', /(дашборд|панел[ьи] (управлени|метрик|аналитик)|аналитик|метрик|dashboard|kpi|отч[её]т[ыа]? по|admin panel|админк)/iu],
  ['app', /(приложени|калькулятор|трекер|планировщик|органайзер|туду|to-?do|конвертер|генератор|редактор|таймер|квиз|викторин|crm|чек-?лист|\bapp\b|tool|calculator|tracker|planner|converter|editor|timer|quiz)/iu],
  ['landing', /(лендинг|посадочн|одностранич|landing|промо-?страниц)/iu],
  ['website', /(сайт|портфолио|блог|магазин|каталог|визитк|website|site|portfolio|blog|shop|store)/iu],
];

const ACTION = /(^|\s)(сделай|сделать|добавь|добавить|измени|изменить|убери|убрать|удали|удалить|поменяй|замени|перепиши|исправь|почини|переделай|увеличь|уменьши|сдвинь|перекрась|покрась|верни|вставь|поставь|настрой|улучши|ускорь|переведи|make|add|change|remove|delete|replace|rewrite|fix|update|improve|move|set|turn)(?=\s|$|[,.!])/iu;
const CREATE = /(^|\s)(сделай|создай|создать|сгенерируй|собери|нужен|нужна|нужно|хочу|придумай|напиши|разработай|build|make|create|generate|design|write)(?=\s|$|[,.!:])/iu;
const FRESH = /(нов(ый|ую|ое|ая)|друг(ой|ую|ое)|с нуля|ещ[её] (один|одн[ау])|отдельн(ый|ую)|another|new|from scratch|separate)/iu;
const QUESTION_START = /^(как|что|почему|зачем|сколько|где|когда|какой|какая|какие|каким|можно ли|можешь ли|умеешь|ты можешь|расскажи|объясни|подскажи|what|how|why|can you|could you|is it|does|do you|explain|tell me)(\s|$|[,?])/iu;
const BIG = /(многостранич|несколько страниц|страниц[аы]? (о нас|услуг|контакт)|уровн|физик|мультиплеер|3d|трёхмерн|трехмерн|crm|личн(ый|ого) кабинет|авторизац|графики|диаграмм|база|каталог|корзин|фильтр|босс|прокачк|инвентар|карта мира|level|physics|multiplayer|dashboard|charts|catalog|cart|filters|inventory)/giu;

/** Kind named in a text, or null. */
export function detectKind(text: string): Kind | null {
  for (const [kind, re] of KIND_WORDS) if (re.test(text)) return kind;
  return null;
}

/** 1 — tiny, 2 — normal, 3 — big. */
export function complexityOf(text: string, intent: Intent, kind: Kind): 1 | 2 | 3 {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  const lists = (t.match(/[,;\n]|\sи\s|\sand\s/giu) || []).length;
  const big = (t.match(BIG) || []).length;
  if (intent === 'question') return 1;
  if (intent === 'edit') {
    if (words <= 12 && lists <= 1 && big === 0) return 1;
    return words > 40 || big >= 2 ? 3 : 2;
  }
  let score = 0;
  if (words > 18) score++;
  if (words > 45) score++;
  if (lists >= 3) score++;
  score += Math.min(2, big);
  if (kind === 'game' || kind === 'app' || kind === 'dashboard' || kind === 'website') score++;
  return score >= 3 ? 3 : score >= 1 ? 2 : 1;
}

export type Classified = { intent: Intent; kind: Kind; confidence: number };

/** Heuristic classification. `current` is the kind of the open project, if any. */
export function classify(text: string, current?: Kind | null): Classified {
  const t = text.trim();
  const named = detectKind(t);
  if (!current) {
    const q = isQuestion(t) && !named;
    return { intent: q ? 'question' : 'new', kind: named ?? 'website', confidence: q ? 0.7 : named ? 0.95 : 0.75 };
  }
  if (isQuestion(t)) return { intent: 'question', kind: current, confidence: 0.85 };
  const create = CREATE.test(t);
  const fresh = FRESH.test(t);
  if (create && named && (fresh || named !== current) && !/\s(на|в|во|для) (сайт|страниц|игр|лендинг|презентац)/iu.test(t))
    return { intent: 'new', kind: named, confidence: fresh ? 0.95 : 0.8 };
  if (fresh && named) return { intent: 'new', kind: named, confidence: 0.85 };
  if (create && named && named === current && !ACTION.test(t.replace(CREATE, ' ')))
    return { intent: 'edit', kind: current, confidence: 0.5 };
  const words = t.split(/\s+/).filter(Boolean).length;
  return { intent: 'edit', kind: current, confidence: ACTION.test(t) || words > 3 ? 0.85 : 0.55 };
}

function isQuestion(t: string): boolean {
  if (ACTION.test(t) && !/^(можешь|можно)/iu.test(t)) return false;
  return /\?\s*$/.test(t) || QUESTION_START.test(t);
}

type Plan = { architect: string; designer: string; developer: string; tester: string; answer: string };

/** Per-step models for "Авто" (cost-aware: small models for structured, cheap steps). */
function autoModels(intent: Intent, kind: Kind, complexity: 1 | 2 | 3): Plan {
  if (intent === 'question') return { architect: 'spyglass', designer: 'spyglass', developer: 'compass', tester: 'spyglass', answer: 'spyglass' };
  if (intent === 'edit')
    return { architect: 'compass', designer: 'spyglass', developer: complexity === 3 ? 'astrolabe' : 'compass', tester: 'spyglass', answer: 'spyglass' };
  if (complexity === 3 || kind === 'game')
    return { architect: 'astrolabe', designer: 'compass', developer: 'astrolabe', tester: 'compass', answer: 'spyglass' };
  if (complexity === 2) return { architect: 'compass', designer: 'spyglass', developer: 'astrolabe', tester: 'compass', answer: 'spyglass' };
  return { architect: 'spyglass', designer: 'spyglass', developer: 'compass', tester: 'spyglass', answer: 'spyglass' };
}

function autoEffort(intent: Intent, kind: Kind, complexity: 1 | 2 | 3): Exclude<EffortId, 'auto'> {
  if (intent === 'question') return 'quick';
  if (intent === 'edit') return complexity === 1 ? 'quick' : 'thoughtful';
  return complexity === 3 || kind === 'game' ? 'deep' : 'thoughtful';
}

const STEP_TITLES = {
  architect: 'Архитектор',
  designer: 'Дизайнер',
  developer: 'Разработчик',
  tester: 'Тестировщик',
  reviewer: 'Ревьюер',
  answer: 'Ответ',
  router: 'Роутер',
  audit: 'Диагностика',
  playtester: 'Плейтестер',
} as const;

export const stepTitle = (role: keyof typeof STEP_TITLES) => STEP_TITLES[role];

/** Builds the full route: intent, kind, effort and the step plan. */
export function route(
  text: string,
  opts: { current?: Kind | null; choice?: Choice; classified?: Classified } = {},
): Route {
  const c = opts.classified ?? classify(text, opts.current);
  const complexity = complexityOf(text, c.intent, c.kind);
  const picked = opts.choice?.model && parseModel(opts.choice.model) ? opts.choice.model : '';
  const effort: Exclude<EffortId, 'auto'> =
    opts.choice?.effort && opts.choice.effort !== 'auto' ? opts.choice.effort : autoEffort(c.intent, c.kind, complexity);
  const auto = autoModels(c.intent, c.kind, complexity);
  // A per-role choice from the model hub wins over the composer's model, which wins over Авто.
  const roles = opts.choice?.roles ?? {};
  const m = (role: keyof Plan) => {
    const r = role === 'answer' ? undefined : roles[role];
    return (r && parseModel(r) ? r : '') || picked || auto[role];
  };
  const level = levelFor(effort);
  // Structured planning steps think less than the developer unless the user asked for more.
  const light = effort === 'quick' ? 'low' : effort === 'thoughtful' ? 'low' : level === 'max' ? 'high' : 'medium';
  const steps: StepPlan[] = [];
  const add = (id: string, role: StepPlan['role'], model: string, lvl = level) =>
    steps.push({ id, role, title: STEP_TITLES[role], model, effort: lvl });

  let fixRounds = 0;
  if (c.intent === 'question') {
    add('answer', 'answer', m('answer'), effort === 'quick' ? 'low' : level);
  } else if (c.intent === 'new') {
    add('architect', 'architect', m('architect'), light);
    if (effort !== 'quick') add('designer', 'designer', m('designer'), light);
    add('developer', 'developer', m('developer'));
    if (effort !== 'quick') add('tester', 'tester', m('tester'), light);
    if (effort === 'ultra') add('reviewer', 'reviewer', m('architect'), 'high');
    fixRounds = effort === 'quick' ? 0 : effort === 'thoughtful' ? 1 : 2;
  } else {
    add('developer', 'developer', m('developer'));
    if (!(effort === 'quick' && complexity === 1)) add('tester', 'tester', m('tester'), light);
    if (effort === 'ultra') add('reviewer', 'reviewer', m('architect'), 'high');
    fixRounds = effort === 'quick' && complexity === 1 ? 0 : 1;
  }

  const what = c.intent === 'question' ? 'Вопрос' : c.intent === 'new' ? 'Новый проект: ' + KIND_LABELS[c.kind].toLowerCase() : 'Правка';
  const main = steps.find((s) => s.role === 'developer') ?? steps[0];
  const reason = [what, modelName(main.model), effortName(effort)].join(' · ');
  return { intent: c.intent, kind: c.kind, complexity, confidence: c.confidence, effort, steps, reason, fixRounds };
}
