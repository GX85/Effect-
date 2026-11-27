/**
 * Runs a generated page in a real (sandboxed) browser frame at phone and desktop widths and
 * collects the runtime audit (lib/effect/audit.ts). The frames sit under the opaque studio,
 * inside the viewport, so the browser renders them normally instead of throttling them.
 */
import { withAudit, type AuditReport } from '@/lib/effect/audit';
import { withPlaytest, type PlayReport } from '@/lib/effect/game-kit';

const strings = (v: unknown, n = 12) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, n).map((x: string) => x.slice(0, 300)) : []);

function clean(raw: Record<string, unknown>, width: number): AuditReport {
  const o = (raw.overflow ?? {}) as { px?: unknown; offenders?: unknown };
  const lt = (raw.longTasks ?? {}) as { count?: unknown; ms?: unknown };
  const lc = Array.isArray(raw.lowContrast) ? raw.lowContrast.slice(0, 8) : [];
  return {
    width,
    errors: strings(raw.errors),
    overflow: { px: Math.max(0, Math.round(Number(o.px) || 0)), offenders: strings(o.offenders, 5) },
    brokenAnchors: strings(raw.brokenAnchors, 8),
    lowContrast: lc
      .filter((c): c is { el: string; ratio: number; fg: string; bg: string } => !!c && typeof c === 'object')
      .map((c) => ({ el: String(c.el).slice(0, 120), ratio: Number(c.ratio) || 0, fg: String(c.fg).slice(0, 40), bg: String(c.bg).slice(0, 40) })),
    missingAlt: Math.max(0, Number(raw.missingAlt) || 0),
    unlabeled: strings(raw.unlabeled, 8),
    longTasks: { count: Number(lt.count) || 0, ms: Number(lt.ms) || 0 },
    hidden: strings(raw.hidden, 6),
    intro: Boolean(raw.intro),
    motion: Boolean(raw.motion),
    title: typeof raw.title === 'string' ? raw.title.slice(0, 120) : undefined,
  };
}

function runAt(html: string, width: number, timeoutMs: number): Promise<AuditReport> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.title = 'Диагностика';
    frame.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:900px;border:0;z-index:-1;pointer-events:none;contain:strict`;
    let finished = false;
    const finish = (r: AuditReport) => {
      if (finished) return;
      finished = true;
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
      frame.remove();
      resolve(r);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow) return;
      const d = e.data as { fx?: string; report?: Record<string, unknown> };
      if (d?.fx === 'audit' && d.report && typeof d.report === 'object') finish(clean(d.report, width));
    };
    const timer = window.setTimeout(
      () => finish({ width, errors: [], overflow: { px: 0, offenders: [] }, brokenAnchors: [], lowContrast: [], missingAlt: 0, unlabeled: [], longTasks: { count: 0, ms: 0 }, timeout: true }),
      timeoutMs,
    );
    window.addEventListener('message', onMessage);
    frame.srcdoc = withAudit(html);
    document.body.appendChild(frame);
  });
}

/** A `diagnose` for the pipeline. Widths run one after another to keep phones responsive. */
export function makeDiagnose(widths = [390, 1440], timeoutMs = 8000) {
  return async (html: string): Promise<AuditReport[]> => {
    const out: AuditReport[] = [];
    for (const w of widths) out.push(await runAt(html, w, timeoutMs));
    return out;
  };
}

/** Plays a game for about five seconds in a sandboxed frame under the studio. */
export function makePlaytest(width = 960, height = 600, timeoutMs = 12000) {
  return (html: string): Promise<PlayReport | null> =>
    new Promise((resolve) => {
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.title = 'Плейтест';
      frame.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;border:0;z-index:-1;pointer-events:none;contain:strict`;
      let finished = false;
      const finish = (r: PlayReport) => {
        if (finished) return;
        finished = true;
        window.removeEventListener('message', onMessage);
        window.clearTimeout(timer);
        frame.remove();
        resolve(r);
      };
      const onMessage = (e: MessageEvent) => {
        if (e.source !== frame.contentWindow) return;
        const d = e.data as { fx?: string; report?: Record<string, unknown> };
        if (d?.fx !== 'playtest' || !d.report) return;
        const r = d.report;
        finish({
          width,
          frames: Number(r.frames) || 0,
          fps: Number(r.fps) || 0,
          errors: strings(r.errors, 8),
          canvas: Boolean(r.canvas),
          frozen: Boolean(r.frozen),
          changes: Number(r.changes) || 0,
          inputs: Number(r.inputs) || 0,
        });
      };
      const timer = window.setTimeout(() => finish({ width, frames: 0, fps: 0, errors: [], canvas: false, frozen: false, changes: 0, inputs: 0, timeout: true }), timeoutMs);
      window.addEventListener('message', onMessage);
      frame.srcdoc = withPlaytest(html);
      document.body.appendChild(frame);
    });
}
