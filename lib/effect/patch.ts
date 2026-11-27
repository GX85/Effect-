/**
 * Targeted edits: the developer answers an edit with SEARCH/REPLACE blocks instead of the
 * whole document. Each block must match exactly once (first exactly, then ignoring
 * differences in whitespace); if any block fails, the caller falls back to a full rewrite.
 *
 *   <<<<<<< SEARCH path=index.html
 *   old text
 *   =======
 *   new text
 *   >>>>>>> REPLACE
 */
export type Patch = { path: string; search: string; replace: string };
export type PatchResult = { ok: boolean; files: Record<string, string>; applied: number; failed: { patch: Patch; reason: string }[] };

const BLOCK = /<{5,9} ?SEARCH(?:[ \t]+(?:path=)?["']?([^\s"'>]+)["']?)?[ \t]*\r?\n([\s\S]*?)\r?\n={5,9}[ \t]*\r?\n([\s\S]*?)\r?\n?>{5,9} ?REPLACE/g;

export function parsePatches(text: string, defaultPath = 'index.html'): Patch[] {
  const out: Patch[] = [];
  for (const m of text.matchAll(BLOCK)) out.push({ path: m[1] || defaultPath, search: m[2], replace: m[3] });
  return out;
}

export const hasPatches = (text: string) => /<{5,9} ?SEARCH/.test(text) && />{5,9} ?REPLACE/.test(text);

/** Finds `needle` in `hay` ignoring runs of whitespace. Returns [start, end] or null; -1 when ambiguous. */
function fuzzyFind(hay: string, needle: string): [number, number] | null | -1 {
  const tokens = needle.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(tokens.map(esc).join('\\s+'), 'g');
  const hits = [...hay.matchAll(re)];
  if (hits.length === 0) return null;
  if (hits.length > 1) return -1;
  return [hits[0].index!, hits[0].index! + hits[0][0].length];
}

export function applyPatches(files: Record<string, string>, patches: Patch[]): PatchResult {
  const next = { ...files };
  const failed: PatchResult['failed'] = [];
  let applied = 0;
  for (const p of patches) {
    // A new file: an empty SEARCH creates (or replaces) it.
    if (!p.search.trim()) {
      next[p.path] = p.replace;
      applied++;
      continue;
    }
    const src = next[p.path];
    if (src == null) {
      failed.push({ patch: p, reason: 'no such file' });
      continue;
    }
    const first = src.indexOf(p.search);
    if (first >= 0) {
      if (src.indexOf(p.search, first + 1) >= 0) {
        failed.push({ patch: p, reason: 'matches more than once' });
        continue;
      }
      next[p.path] = src.slice(0, first) + p.replace + src.slice(first + p.search.length);
      applied++;
      continue;
    }
    const f = fuzzyFind(src, p.search);
    if (f === null) failed.push({ patch: p, reason: 'not found' });
    else if (f === -1) failed.push({ patch: p, reason: 'matches more than once' });
    else {
      next[p.path] = src.slice(0, f[0]) + p.replace + src.slice(f[1]);
      applied++;
    }
  }
  return { ok: failed.length === 0 && applied > 0, files: next, applied, failed };
}
