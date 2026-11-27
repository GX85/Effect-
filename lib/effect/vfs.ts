/**
 * Project files. `index.html` is the entry; extra pages (*.html), styles (*.css), scripts
 * (*.js) and small assets (data URIs) live alongside. The preview and the single-file
 * export bundle everything into one document; the site export writes a ZIP.
 */
export type Files = Record<string, string>;

const SAFE = /^[a-z0-9][a-z0-9._/-]{0,80}$/i;
export const isSafePath = (p: string) => SAFE.test(p) && !p.includes('..') && !p.startsWith('/');

/** Reads `<file path="...">…</file>` blocks from a model answer. Empty when there are none. */
export function parseFiles(text: string): Files {
  const out: Files = {};
  for (const m of text.matchAll(/<file\s+path=["']([^"']+)["']\s*>\r?\n?([\s\S]*?)\r?\n?<\/file>/g)) {
    const path = m[1].trim();
    if (isSafePath(path)) out[path] = m[2];
  }
  return out;
}

export const extraFiles = (files: Files | undefined) => Object.keys(files ?? {}).filter((p) => p !== 'index.html');

/** Inlines local stylesheets and scripts of one page and routes links between pages. */
function inlinePage(html: string, files: Files): string {
  let out = html.replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi, (tag) => {
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    return href && files[href] != null ? `<style data-file="${href}">\n${files[href]}\n</style>` : tag;
  });
  out = out.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi, (tag, a, src, b) =>
    files[src] != null ? `<script${(a + b).trimEnd()} data-file="${src}">\n${files[src].replace(/<\/script/gi, '<\\/script')}\n</script>` : tag,
  );
  return out;
}

/**
 * One self-contained document. Extra pages become hidden templates; clicks on links to
 * them swap the document body in place (with a View Transition when available).
 */
export function bundle(files: Files): string {
  const entry = files['index.html'] ?? '';
  const pages = Object.keys(files).filter((p) => p !== 'index.html' && /\.html?$/i.test(p));
  const html = inlinePage(entry, files);
  if (!pages.length) return html;
  const data = JSON.stringify(Object.fromEntries(pages.map((p) => [p, inlinePage(files[p], files)]))).replace(/</g, '\\u003c');
  const router = `<script id="fx-pages" type="application/json">${data}</script><script id="fx-router">(function(){var P=JSON.parse(document.getElementById('fx-pages').textContent),home=document.documentElement.innerHTML;
function show(name){var src=name==='index.html'?null:P[name];var doc=src?new DOMParser().parseFromString(src,'text/html'):null;var swap=function(){if(doc){document.title=doc.title;document.body.innerHTML=doc.body.innerHTML;[].forEach.call(doc.querySelectorAll('style'),function(s){if(!document.querySelector('style[data-file="'+s.getAttribute('data-file')+'"]')||!s.getAttribute('data-file'))document.head.appendChild(s.cloneNode(true))});[].forEach.call(document.body.querySelectorAll('script'),function(o){var n=document.createElement('script');n.textContent=o.textContent;o.replaceWith(n)})}else{document.documentElement.innerHTML=home}scrollTo(0,0)};if(document.startViewTransition)document.startViewTransition(swap);else swap()}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href').split('#')[0];if(h==='index.html'||P[h]){e.preventDefault();show(h)}});})();</script>`;
  const i = html.toLowerCase().lastIndexOf('</body>');
  return i < 0 ? html + router : html.slice(0, i) + router + html.slice(i);
}

// ───────────── ZIP (store only, no dependencies) ─────────────

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A valid ZIP archive (method 0, UTF-8 names) of the given text files. */
export function zip(files: Files): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const entries = Object.entries(files).filter(([p]) => isSafePath(p));
  for (const [path, text] of entries) {
    const name = enc.encode(path);
    const data = enc.encode(text);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x0800, true);
    v.setUint16(8, 0, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, data.length, true);
    v.setUint32(22, data.length, true);
    v.setUint16(26, name.length, true);
    local.set(name, 30);
    const cen = new Uint8Array(46 + name.length);
    const c = new DataView(cen.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    cen.set(name, 46);
    parts.push(local, data);
    central.push(cen);
    offset += local.length + data.length;
  }
  const cenSize = central.reduce((n, x) => n + x.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, cenSize, true);
  e.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, x) => n + x.length, 0));
  let at = 0;
  for (const x of all) {
    out.set(x, at);
    at += x.length;
  }
  return out;
}
