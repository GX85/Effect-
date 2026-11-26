/** HTML helpers for agent output: extraction, continuation stitching and static checks. */
import type { Check } from './types.ts';

/** Pulls an HTML document out of a model reply, dropping fences and notes around it. */
export function extractHtml(text: string): string | null {
  const start = text.search(/<!doctype html|<html[\s>]/i);
  if (start < 0) return null;
  const end = text.toLowerCase().lastIndexOf('</html>');
  return end > start ? text.slice(start, end + 7) : text.slice(start);
}

/** True when the document is closed. */
export const isComplete = (html: string) => /<\/html>\s*$/i.test(html.trim());

/**
 * Joins a continuation to the text so far. Models sometimes repeat the last few lines or
 * wrap the continuation in a fence: both are removed. The overlap search is bounded.
 */
export function stitch(prev: string, next: string): string {
  let more = next.replace(/^\s*```[a-z]*\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  if (/^\s*<!doctype html/i.test(more) && prev.length > 200) {
    // The model restarted the document: keep whichever is longer and complete.
    return more.length > prev.length ? more : prev;
  }
  const max = Math.min(600, prev.length, more.length);
  for (let n = max; n >= 24; n--) {
    if (prev.endsWith(more.slice(0, n))) {
      more = more.slice(n);
      break;
    }
  }
  return prev + more;
}

/** Document title, without a trailing "— brand" part. */
export function titleOf(html: string): string {
  const t = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i)?.[1]?.trim() ?? '';
  return t.split(/\s[—|–-]\s/)[0].trim().slice(0, 60);
}

/** Returns the text between the first `{` and the last `}` parsed as JSON, or null. */
export function parseJson<T = unknown>(text: string): T | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const a = body.indexOf('{');
  const b = body.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  const raw = body.slice(a, b + 1);
  try {
    return JSON.parse(raw) as T;
  } catch {
    try {
      // Trailing commas are the most common slip.
      return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1')) as T;
    } catch {
      return null;
    }
  }
}

/** Optional JS syntax checker (Function constructor). Absent where eval is blocked. */
export type SyntaxCheck = (code: string) => string | null;

export function defaultSyntaxCheck(): SyntaxCheck | null {
  try {
    // Probe once: a CSP without unsafe-eval throws here. Code is only parsed, never run.
    // oxlint-disable-next-line typescript/no-implied-eval
    new Function('return 1');
  } catch {
    return null;
  }
  return (code) => {
    try {
      // oxlint-disable-next-line typescript/no-implied-eval
      new Function(code);
      return null;
    } catch (e) {
      return e instanceof SyntaxError ? e.message : null;
    }
  };
}

/** Fast deterministic checks the tester gets alongside the code. */
export function staticChecks(html: string, kind?: string, syntax: SyntaxCheck | null = null): Check[] {
  const lower = html.toLowerCase();
  const out: Check[] = [];
  const add = (id: string, ok: boolean, severity: Check['severity'], message: string) => out.push({ id, ok, severity, message });
  add('complete', isComplete(html), 'critical', 'The document does not end with </html> (it may be cut off).');
  add('viewport', /<meta[^>]+name=["']?viewport/i.test(html), 'major', 'No <meta name="viewport"> — the page will not scale on phones.');
  add('title', /<title[^>]*>[^<]+<\/title>/i.test(html), 'minor', 'No <title>.');
  add('lang', /<html[^>]+lang=/i.test(html), 'minor', 'No lang attribute on <html>.');
  add('dialogs', !/\b(alert|confirm|prompt)\s*\(/.test(html.replace(/<style[\s\S]*?<\/style>/gi, '')), 'major', 'Uses alert()/confirm()/prompt(), which are blocked in the sandbox.');
  const imgs = [...html.matchAll(/<img[^>]+src=["'](https?:)?\/\//gi)].length;
  add('external-images', imgs === 0, 'major', `Loads ${imgs} external image(s); only inline SVG/CSS/canvas visuals are allowed.`);
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  const badScripts = scripts.filter((s) => !/^https:\/\/cdnjs\.cloudflare\.com\//i.test(s));
  add('script-hosts', badScripts.length === 0, 'major', 'Scripts from hosts other than cdnjs: ' + badScripts.slice(0, 3).join(', '));
  const storage = /localStorage/.test(html);
  add('storage-guard', !storage || /try\s*\{[\s\S]{0,400}localStorage/.test(html), 'major', 'localStorage is used without try/catch.');
  const imgNoAlt = [...html.matchAll(/<img(?![^>]*\salt=)[^>]*>/gi)].length;
  add('alt', imgNoAlt === 0, 'minor', `${imgNoAlt} <img> without alt.`);
  add('lorem', !/lorem ipsum/i.test(html), 'major', 'Contains lorem ipsum placeholder text.');
  if (kind === 'game') {
    add('raf', /requestAnimationFrame/.test(html), 'critical', 'Game has no requestAnimationFrame loop.');
    add('touch', /touchstart|pointerdown|pointermove/.test(lower), 'major', 'Game has no touch / pointer controls for phones.');
    add('visibility', /visibilitychange/.test(lower), 'minor', 'Game does not pause when the tab is hidden.');
  }
  if (syntax) {
    const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type=["'](?:module|application\/(?:ld\+)?json|text\/(?:template|plain)))[^>]*>([\s\S]*?)<\/script>/gi)];
    blocks.forEach((m, i) => {
      const err = syntax(m[1]);
      if (err) add('syntax-' + i, false, 'critical', `JavaScript syntax error in <script> #${i + 1}: ${err}`);
    });
  }
  return out;
}

export const failedChecks = (checks: Check[]) => checks.filter((c) => !c.ok);
