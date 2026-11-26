/**
 * Effect Brain — project memory. A short, structured record of what the project is (brief),
 * how it looks (design tokens) and what the person decided along the way. It is kept with
 * the project and given to every agent call, so later edits stay consistent.
 */
import type { Design, Intent, Spec } from './agent/types.ts';

export type Memory = {
  brief: string;
  tokens: Record<string, string>;
  decisions: string[];
  updated: number;
};

export const MAX_DECISIONS = 14;

export const emptyMemory = (now = Date.now()): Memory => ({ brief: '', tokens: {}, decisions: [], updated: now });

const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');

/** A compact brief from the architect's spec. */
export function briefFromSpec(spec: Spec | null | undefined): string {
  if (!spec) return '';
  const parts: string[] = [];
  if (spec.name) parts.push(`Название: ${clip(spec.name, 60)}.`);
  if (spec.summary) parts.push(clip(spec.summary, 240));
  if (spec.audience) parts.push(`Аудитория: ${clip(spec.audience, 140)}.`);
  if (spec.tone) parts.push(`Тон: ${clip(spec.tone, 100)}.`);
  if (Array.isArray(spec.pages) && spec.pages.length)
    parts.push('Страницы: ' + spec.pages.map((p) => clip(p?.title || p?.id, 30)).filter(Boolean).slice(0, 8).join(', ') + '.');
  if (Array.isArray(spec.features) && spec.features.length) parts.push('Функции: ' + spec.features.slice(0, 8).map((f) => clip(f, 60)).join('; ') + '.');
  return parts.join(' ').slice(0, 900);
}

/** Flat design tokens from the designer's system (colors, fonts, radius, direction). */
export function tokensFromDesign(design: Design | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!design) return out;
  if (design.direction) out.direction = clip(design.direction, 60);
  const pal = design.palette && typeof design.palette === 'object' ? design.palette : {};
  for (const [k, v] of Object.entries(pal)) if (typeof v === 'string' && /^(#|rgb|hsl|oklch)/i.test(v.trim())) out[k] = v.trim().slice(0, 40);
  const type = design.type && typeof design.type === 'object' ? design.type : {};
  if (type.display) out['font.display'] = clip(type.display, 40);
  if (type.text) out['font.text'] = clip(type.text, 40);
  const r = design.radius as Record<string, unknown> | undefined;
  if (r && (typeof r.md === 'number' || typeof r.md === 'string')) out['radius'] = String(r.md);
  if (design.scheme && typeof design.scheme === 'string') out.scheme = clip(design.scheme, 10);
  return out;
}

/** Updates memory after a finished run. New projects reset it; edits add a decision. */
export function updateMemory(
  prev: Memory | null | undefined,
  run: { intent: Intent; request: string; spec?: Spec | null; design?: Design | null },
  now = Date.now(),
): Memory {
  if (run.intent === 'question') return prev ?? emptyMemory(now);
  if (run.intent === 'new') {
    return {
      brief: briefFromSpec(run.spec) || clip(run.request, 400),
      tokens: tokensFromDesign(run.design),
      decisions: [],
      updated: now,
    };
  }
  const base = prev ?? emptyMemory(now);
  const decision = clip(run.request, 180);
  const decisions = decision ? [...base.decisions.filter((d) => d !== decision), decision].slice(-MAX_DECISIONS) : base.decisions;
  const tokens = run.design ? { ...base.tokens, ...tokensFromDesign(run.design) } : base.tokens;
  return { ...base, tokens, decisions, updated: now };
}

/** The memory block every agent reads. Empty string when there is nothing to remember. */
export function memoryText(m: Memory | null | undefined): string {
  if (!m) return '';
  const lines: string[] = [];
  if (m.brief) lines.push('Brief: ' + m.brief);
  const t = Object.entries(m.tokens);
  if (t.length) lines.push('Design tokens: ' + t.map(([k, v]) => `${k}=${v}`).join(', '));
  if (m.decisions.length) lines.push('Decisions the person made (keep them):\n' + m.decisions.map((d) => '- ' + d).join('\n'));
  return lines.join('\n');
}
