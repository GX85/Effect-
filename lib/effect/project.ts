/**
 * Studio data model shared by the site studio and the artifact studio: projects,
 * conversation, agent runs and versions. Pure functions over plain objects, so both UIs
 * behave the same and the logic is testable. Storage is per browser (localStorage).
 */
import { isKind } from './agent/models.ts';
import { memoryText, type Memory } from './brain.ts';
import type { AgentEvent, Design, Kind, ProjectInput, Route, Spec, StepStatus, Usage } from './agent/types.ts';

export type Version = {
  id: string;
  html: string;
  at: number;
  label: string;
  source: 'agent' | 'text' | 'code' | 'restore' | 'import';
};

export type StepView = {
  id: string;
  role: string;
  title: string;
  model?: string;
  status: StepStatus;
  startedAt?: number;
  ms?: number;
  summary?: string;
  output?: string;
  reason?: string;
  chars?: number;
  note?: string;
};

export type RunView = {
  route?: Pick<Route, 'intent' | 'kind' | 'effort' | 'reason' | 'complexity'> & { llm?: boolean };
  steps: StepView[];
  status: 'running' | 'done' | 'error' | 'stopped';
  startedAt: number;
  finishedAt?: number;
  usage?: Usage;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  run?: RunView;
  error?: { code: string; message: string };
  /** Prompt to resend after a failure. */
  retry?: string;
  /** Version created by this message. */
  versionId?: string;
};

export type Project = {
  id: string;
  name: string;
  kind: Kind;
  html: string;
  spec?: Spec | null;
  design?: Design | null;
  messages: ChatMessage[];
  versions: Version[];
  created: number;
  updated: number;
  /** Effect Brain: brief, tokens and decisions every agent reads. */
  memory?: Memory | null;
};

export const VERSION_LIMIT = 30;
const STEP_TITLES: Record<string, string> = { architect: 'Архитектор', designer: 'Дизайнер', developer: 'Разработчик', tester: 'Тестировщик', reviewer: 'Ревьюер', answer: 'Ответ', audit: 'Диагностика', playtester: 'Плейтестер' };
const KEY = 'effect.projects.v2';
const OLD_KEY = 'effect.projects.v1';

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function newProject(now = Date.now()): Project {
  return { id: newId(), name: 'Новый проект', kind: 'website', html: '', spec: null, design: null, messages: [], versions: [], created: now, updated: now };
}

const OLD_KINDS: Record<string, Kind> = { site: 'website', landing: 'landing', slides: 'presentation', game: 'game' };

/** Upgrades a project saved by Effect 1.x (html + history) to the 2.0 shape. */
export function migrate(old: Record<string, unknown>, now = Date.now()): Project | null {
  if (!old || typeof old.html !== 'string' || typeof old.id !== 'string') return null;
  const at = typeof old.updated === 'number' ? old.updated : now;
  const history = Array.isArray(old.history) ? (old.history as { html?: string }[]) : [];
  const versions: Version[] = history
    .filter((h) => typeof h?.html === 'string' && h.html)
    .map((h, i) => ({ id: newId(), html: h.html!, at: at - (history.length - i) * 1000, label: 'Версия ' + (i + 1), source: 'import' as const }));
  if (old.html) versions.push({ id: newId(), html: old.html, at, label: 'Перенесено из Effect 1', source: 'import' });
  const messages = Array.isArray(old.messages)
    ? (old.messages as { role?: string; text?: string; at?: number }[])
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
        .map((m) => ({ id: newId(), role: m.role as 'user' | 'assistant', text: m.text!, at: m.at ?? at }))
    : [];
  return {
    id: old.id,
    name: typeof old.name === 'string' && old.name ? old.name : 'Проект',
    kind: OLD_KINDS[String(old.kind)] ?? (isKind(old.kind) ? old.kind : 'website'),
    html: old.html,
    spec: null,
    design: null,
    messages,
    versions: versions.slice(-VERSION_LIMIT),
    created: at,
    updated: at,
  };
}

function valid(p: unknown): p is Project {
  const o = p as Project;
  return !!o && typeof o.id === 'string' && typeof o.html === 'string' && Array.isArray(o.messages) && Array.isArray(o.versions);
}

export function loadProjects(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Project[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw) as unknown[];
      return Array.isArray(list) ? list.filter(valid).map(settle) : [];
    }
    const old = storage.getItem(OLD_KEY);
    if (old) {
      const list = JSON.parse(old) as Record<string, unknown>[];
      return Array.isArray(list) ? (list.map((p) => migrate(p)).filter(Boolean) as Project[]) : [];
    }
  } catch {
    /* corrupt or blocked storage */
  }
  return [];
}

/** Runs left "running" by a closed tab are shown as stopped. */
function settle(p: Project): Project {
  if (!p.messages.some((m) => m.run?.status === 'running')) return p;
  return { ...p, messages: p.messages.map((m) => (m.run?.status === 'running' ? { ...m, run: stopRun(m.run, m.run.startedAt) } : m)) };
}

/** Saves, dropping old versions when the quota is exceeded. Returns false when nothing could be saved. */
export function saveProjects(list: Project[], storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  if (!storage) return false;
  const sorted = [...list].sort((a, b) => b.updated - a.updated);
  for (const keep of [VERSION_LIMIT, 10, 4, 1, 0]) {
    try {
      const trimmed = sorted.map((p, i) => ({
        ...p,
        versions: p.versions.slice(-(i < 3 ? keep : Math.min(keep, 3))),
        messages: p.messages.slice(-60).map((m) => (m.run ? { ...m, run: { ...m.run, steps: m.run.steps.map((s) => ({ ...s, output: s.output?.slice(0, keep ? 6000 : 800) })) } } : m)),
      }));
      storage.setItem(KEY, JSON.stringify(trimmed));
      return true;
    } catch {
      /* quota exceeded: retry with less */
    }
  }
  return false;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

// ───────────── Runs (agent timeline) ─────────────

export function startRun(now = Date.now()): RunView {
  return { steps: [], status: 'running', startedAt: now };
}

/** Folds one pipeline event into the timeline. Pure. */
export function applyEvent(run: RunView, e: AgentEvent, now = Date.now()): RunView {
  switch (e.type) {
    case 'route':
      return {
        ...run,
        route: { intent: e.route.intent, kind: e.route.kind, effort: e.route.effort, reason: e.route.reason, complexity: e.route.complexity, llm: e.route.llm },
        steps: e.route.steps.map((s) => ({ id: s.id, role: s.role, title: s.title, model: s.model, status: 'pending' as StepStatus })),
      };
    case 'step': {
      const has = run.steps.some((s) => s.id === e.id);
      const role = 'role' in e ? e.role : (e.id.split('-')[0] === 'fix' || e.id === 'polish' ? 'developer' : e.id.split('-')[0]);
      const added: StepView = { id: e.id, role, title: 'title' in e ? e.title : (STEP_TITLES[role] ?? e.id), status: 'pending' };
      // Unplanned steps (diagnostics, fixes) go where they ran: before the first step still waiting.
      const at = run.steps.findIndex((s) => s.status === 'pending');
      const steps = has ? run.steps : at < 0 ? [...run.steps, added] : [...run.steps.slice(0, at), added, ...run.steps.slice(at)];
      // A fix step is inserted after the step that triggered it.
      return {
        ...run,
        steps: steps.map((s) => {
          if (s.id !== e.id) return s;
          if (e.status === 'start') return { ...s, role: e.role, title: e.title, model: e.model, status: 'running', startedAt: e.at, output: '' };
          if (e.status === 'done') return { ...s, status: 'done', ms: e.ms, summary: e.summary, output: e.output ?? s.output, note: undefined };
          if (e.status === 'skipped') return { ...s, status: 'skipped', reason: e.reason };
          return { ...s, status: 'error', reason: e.message };
        }),
      };
    }
    case 'text':
      return { ...run, steps: run.steps.map((s) => (s.id === e.id && (s.role === 'architect' || s.role === 'designer' || s.role === 'tester' || s.role === 'reviewer') ? { ...s, output: ((s.output || '') + e.delta).slice(-12000) } : s)) };
    case 'progress':
      return { ...run, steps: run.steps.map((s) => (s.id === e.id ? { ...s, chars: e.chars, note: e.note } : s)) };
    case 'done':
      return { ...run, status: 'done', finishedAt: now, usage: e.usage, steps: run.steps.map((s) => (s.status === 'pending' ? { ...s, status: 'skipped', reason: s.reason ?? 'Не понадобилось' } : s)) };
    case 'error':
      return e.code === 'cancelled' ? stopRun(run, now) : { ...run, status: 'error', finishedAt: now, steps: run.steps.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s.status === 'pending' ? { ...s, status: 'skipped', reason: 'Не выполнялся' } : s)) };
    default:
      return run;
  }
}

export function stopRun(run: RunView, now = Date.now()): RunView {
  return {
    ...run,
    status: 'stopped',
    finishedAt: now,
    steps: run.steps.map((s) => (s.status === 'running' ? { ...s, status: 'error', reason: 'Остановлено' } : s.status === 'pending' ? { ...s, status: 'skipped', reason: 'Остановлено' } : s)),
  };
}

// ───────────── Versions ─────────────

/** Sets new HTML and records it as a version. */
export function commitHtml(project: Project, html: string, label: string, source: Version['source'], now = Date.now()): Project {
  if (html === project.html && project.versions.length) return project;
  const v: Version = { id: newId(), html, at: now, label: label.slice(0, 80), source };
  return { ...project, html, versions: [...project.versions, v].slice(-VERSION_LIMIT), updated: now };
}

/** Replaces the HTML of the latest version (continuous text / code editing). */
export function amendHtml(project: Project, html: string, source: Version['source'], now = Date.now()): Project {
  const last = project.versions.at(-1);
  if (!last || last.source !== source) return commitHtml(project, html, source === 'text' ? 'Правка текста в превью' : 'Правка кода', source, now);
  return { ...project, html, versions: [...project.versions.slice(0, -1), { ...last, html, at: now }], updated: now };
}

export function restoreVersion(project: Project, id: string, now = Date.now()): Project {
  const i = project.versions.findIndex((v) => v.id === id);
  if (i < 0) return project;
  return commitHtml(project, project.versions[i].html, 'Восстановлена версия ' + (i + 1), 'restore', now);
}

/** The version before the current one, for "undo". */
export function previousVersion(project: Project): Version | null {
  return project.versions.length > 1 ? project.versions[project.versions.length - 2] : null;
}

// ───────────── Project operations ─────────────

export function renameProject(project: Project, name: string, now = Date.now()): Project {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 60);
  return clean ? { ...project, name: clean, updated: now } : project;
}

export function duplicateProject(project: Project, now = Date.now()): Project {
  return { ...project, id: newId(), name: (project.name + ' — копия').slice(0, 60), created: now, updated: now, messages: project.messages.filter((m) => m.run?.status !== 'running') };
}

export function searchProjects(list: Project[], q: string): Project[] {
  const t = q.trim().toLowerCase();
  const sorted = [...list].sort((a, b) => b.updated - a.updated);
  if (!t) return sorted;
  return sorted.filter((p) => p.name.toLowerCase().includes(t) || p.messages.some((m) => m.role === 'user' && m.text.toLowerCase().includes(t)));
}

/** What the pipeline needs to know about a project. */
export function projectInput(p: Project | null): ProjectInput | null {
  if (!p || !p.html) return null;
  return {
    name: p.name,
    kind: p.kind,
    html: p.html,
    spec: p.spec ?? null,
    design: p.design ?? null,
    memory: memoryText(p.memory) || undefined,
    history: p.messages
      .filter((m) => !m.error && m.text)
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 500) })),
  };
}

// ───────────── Formatting ─────────────

export function fileName(name: string, ext = 'html'): string {
  return (
    (name
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\d]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'effect-project') +
    '.' +
    ext
  );
}

/** "только что", "5 мин назад", "3 ч назад" or a date. */
export function timeAgo(t: number, now = Date.now()): string {
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return m + ' мин назад';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' ч назад';
  return new Date(t).toLocaleDateString('ru-RU');
}

/** "14:05" today, "24 нояб., 14:05" otherwise. */
export function clock(t: number, now = Date.now()): string {
  const d = new Date(t);
  const hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return new Date(now).toDateString() === d.toDateString() ? hm : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + hm;
}

/** "8,4 с", "1 мин 12 с". */
export function duration(ms: number): string {
  if (ms < 1000) return '<1 с';
  const s = ms / 1000;
  if (s < 60) return (s < 10 ? s.toFixed(1).replace('.', ',') : Math.round(s)) + ' с';
  const m = Math.floor(s / 60);
  return m + ' мин ' + Math.round(s - m * 60) + ' с';
}

/** Freezes animations after a moment so a thumbnail iframe stops working. */
export function thumbnailHtml(html: string, freezeAfterMs = 1200): string {
  const tag =
    '<script>(function(){setTimeout(function(){var s=document.createElement("style");s.textContent="*,*::before,*::after{animation-play-state:paused!important;transition:none!important}";document.head.appendChild(s);window.requestAnimationFrame=function(){return 0}},' +
    freezeAfterMs +
    ')})()</script>';
  const i = html.toLowerCase().lastIndexOf('</body>');
  return i < 0 ? html + tag : html.slice(0, i) + tag + html.slice(i);
}
