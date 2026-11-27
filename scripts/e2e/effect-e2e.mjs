#!/usr/bin/env node
/**
 * Effect quality gate: end-to-end flows, a performance budget and targeted accessibility
 * checks, all with a mocked AI (no network, no keys).
 *
 *   npm run build:static && npm run build:artifact && npm run test:e2e   (in this order)
 *
 * Site: the static export is served together with the real api/effect.mjs handler, whose
 * Anthropic and OpenRouter clients are fakes. Artifact: dist/artifact/test.html with a fake
 * `window.claude` (sample + downloads). Needs Playwright with Chromium installed.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const SITE = resolve(ROOT, 'dist/client');
const ARTIFACT = resolve(ROOT, 'dist/artifact/test.html');
const SIZES = [
  [390, 844],
  [768, 1024],
  [1440, 900],
];
/** Budgets. Measured on the build this gate was written for, with headroom. */
const BUDGET = {
  landingPhoneBytes: 1_250_000, // everything /effect loads on a phone, images included
  landingDesktopBytes: 2_000_000, // desktop adds three.js for the 3D prism, loaded after the page
  studioBytes: 1_250_000,
  artifactBytes: 700_000, // the single artifact page
  minFps: 45, // landing on a phone after load (photo hero), headless Chromium
  // Desktop runs the WebGL prism. Headless Chromium renders it in software (SwiftShader), so
  // the gate only guards against a collapse there; a real GPU is expected at 60.
  minFpsSoftwareGl: 30,
  longTaskMs: 250, // longest main-thread task while the studio runs a generation
};

let chromium;
try {
  ({ chromium } = await import('playwright').catch(() => createRequire(resolve(ROOT, 'package.json'))('playwright')));
} catch {
  console.error('Playwright is not installed. Install it (npm i -D playwright && npx playwright install chromium) and run again.');
  process.exit(2);
}
for (const f of [resolve(SITE, 'effect.html'), ARTIFACT]) {
  if (!(await stat(f).catch(() => null))) {
    console.error(`Missing ${f}. Run npm run build:static, then npm run build:artifact (build:static clears dist/).`);
    process.exit(2);
  }
}
const { createEffectHandler } = await import(resolve(ROOT, 'api/effect.mjs'));

// ───────────── Fake AI ─────────────
const page = (h1, bg) =>
  `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Колос — пекарня</title><style>body{margin:0;font-family:sans-serif;background:${bg};color:${bg === '#111' ? '#eee' : '#222'}}main{padding:40px}</style></head><body><main><h1>${h1}</h1><p>Хлеб каждое утро.</p></main></body></html>`;
const answer = (system, user) => {
  if (/ARCHITECT/.test(system)) return '{"name":"Колос","summary":"сайт пекарни","pages":[{"id":"home"}],"features":["заказ"]}';
  if (/DESIGNER/.test(system)) return '{"direction":"Тёплый минимализм","rationale":"утро и хлеб"}';
  if (/TESTER|REVIEWER/.test(system)) return '{"verdict":"pass","summary":"ok","issues":[]}';
  if (/answering/.test(system)) return 'Шрифт задан в style.';
  if (/Classify/.test(system)) return '{"intent":"edit","kind":"website"}';
  return /тёмн/i.test(user) ? page('Колос ночью', '#111') : page('Колос', '#fffaf3');
};
const fakeClient = () => ({
  beta: {
    messages: {
      stream(params) {
        const text = answer(String(params.system), params.messages.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n'));
        return {
          async *[Symbol.asyncIterator]() {
            for (let i = 0; i < text.length; i += 200) {
              await new Promise((r) => setTimeout(r, 10));
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: text.slice(i, i + 200) } };
            }
          },
          finalMessage: async () => ({ stop_reason: 'end_turn', usage: { input_tokens: 1200, output_tokens: 800 } }),
        };
      },
    },
  },
});
const fetchImpl = async (url) => {
  if (String(url).endsWith('/models')) return Response.json({ data: [{ id: 'openai/gpt-5', name: 'OpenAI: GPT-5', context_length: 400000, pricing: { prompt: '0.00000125', completion: '0.00001' } }] });
  return new Response('not used', { status: 500 });
};

function serve(handler) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/effect') {
      const request = new Request(url, { method: req.method, headers: req.headers, ...(req.method === 'POST' ? { body: req, duplex: 'half' } : {}) });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(response.body).pipe(res);
      else res.end();
      return;
    }
    // The artifact page and its images are served under /artifact/ (as on the host, over http).
    const art = url.pathname.startsWith('/artifact/');
    const dir = art ? resolve(ARTIFACT, '..') : SITE;
    let path = resolve(dir, '.' + decodeURIComponent(art ? url.pathname.slice('/artifact'.length) : url.pathname));
    if (!path.startsWith(dir + sep) && path !== dir) return res.writeHead(403).end();
    if ((await stat(path).catch(() => null))?.isDirectory()) path = resolve(path, 'index.html');
    if (!(await stat(path).catch(() => null))?.isFile() && !extname(path)) path += '.html';
    const data = await readFile(path).catch(() => null);
    if (!data) return res.writeHead(404).end('404');
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(data);
  });
}

// ───────────── Harness ─────────────
const results = [];
let failed = 0;
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};
const watch = (p, label, errors) => {
  p.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`${label}: ${m.text()}`));
};
const frameH1 = (p) => p.frameLocator('.fxs-frames iframe.front').locator('h1').textContent({ timeout: 10000 });
const waitIdle = (p, ai) =>
  p.waitForFunction((n) => document.querySelectorAll('.fxs-msg.ai').length >= n && !document.querySelector('.fxs-live'), ai, { timeout: 30000 });
const showStage = async (p, w) => {
  if (w <= 760) await p.click('.fxs-tabs button:nth-child(2)');
};
const showChat = async (p, w) => {
  if (w <= 760) await p.click('.fxs-tabs button:nth-child(1)');
};

/** create → agents → preview → edit → restore → export. */
async function flow(p, w, label, opts) {
  try {
    await flowSteps(p, w, label, opts);
  } catch (e) {
    check(`${label} ${w}: flow completes`, false, String(e.message || e).split('\n')[0]);
  }
}
async function flowSteps(p, w, label, { onDownload }) {
  await p.fill('#fxs-input', 'Сайт пекарни «Колос» с меню и заказом');
  await p.press('#fxs-input', 'Enter');
  await waitIdle(p, 1);
  const steps = await p.$$eval('.fxs-step', (els) => els.map((e) => e.getAttribute('data-status')));
  check(`${label} ${w}: agent steps finish`, steps.length >= 4 && steps.every((s) => s === 'done' || s === 'skipped'), steps.join(','));
  await showStage(p, w);
  check(`${label} ${w}: preview shows the page`, (await frameH1(p)) === 'Колос');
  await showChat(p, w);
  await p.fill('#fxs-input', 'Сделай тёмную тему');
  await p.press('#fxs-input', 'Enter');
  await waitIdle(p, 2);
  await showStage(p, w);
  await p.waitForTimeout(500);
  check(`${label} ${w}: edit updates the preview`, (await frameH1(p)) === 'Колос ночью');
  await p.click('.fxs-stage-bar .fxs-seg button:nth-of-type(3)');
  await p.waitForSelector('.fxs-versions li:not(.current)');
  await p.click('.fxs-versions li:not(.current) .fxs-btn:last-child');
  await p.waitForTimeout(600);
  check(`${label} ${w}: version restore`, (await frameH1(p)) === 'Колос');
  const file = await onDownload(() => p.click('button[title^="Скачать"]'));
  check(`${label} ${w}: export contains the restored page`, /<h1>Колос<\/h1>/.test(file) && /fx-motion|FXMotion/.test(file), `${file.length} bytes`);
}

// ───────────── Accessibility (targeted) ─────────────
/** Names, labels, alt text, unique ids, lang and text contrast of what is on screen. */
async function a11y(p) {
  return p.evaluate(() => {
    const out = [];
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[aria-hidden="true"],[inert]');
    };
    const name = (el) =>
      (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim() ||
      (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join('').trim() ||
      [...el.querySelectorAll('img[alt]')].map((i) => i.alt).join('').trim();
    const tag = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '');
    if (!document.documentElement.lang) out.push('html has no lang');
    for (const el of document.querySelectorAll('button, a[href], [role="button"]')) if (visible(el) && !name(el)) out.push('no name: ' + tag(el));
    for (const el of document.querySelectorAll('img')) if (visible(el) && !el.hasAttribute('alt')) out.push('no alt: ' + tag(el));
    for (const el of document.querySelectorAll('input:not([type=hidden]), textarea, select')) {
      if (!visible(el)) continue;
      const labelled = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`));
      if (!labelled) out.push('no label: ' + tag(el));
    }
    const ids = {};
    for (const el of document.querySelectorAll('[id]')) ids[el.id] = (ids[el.id] || 0) + 1;
    for (const [id, n] of Object.entries(ids)) if (n > 1) out.push(`duplicate id: ${id} ×${n}`);
    // Contrast of direct text against the first opaque background up the tree.
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage !== 'none') return null; // images and gradients: not judged here
        const c = rgb(cs.backgroundColor);
        if (c.length >= 3 && (c[3] ?? 1) >= 0.95) return c;
      }
      return [255, 255, 255];
    };
    let low = 0;
    const lows = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || el.closest('iframe, svg, canvas, [disabled], .fx-sr')) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (Number(cs.opacity) < 1) continue;
      const bg = bgOf(el);
      if (!bg) continue;
      const fg = rgb(cs.color);
      const a = fg[3] ?? 1;
      const mix = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
      const [l1, l2] = [lum(mix), lum(bg)].sort((x, y) => y - x);
      const ratio = (l1 + 0.05) / (l2 + 0.05);
      const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) {
        low++;
        if (lows.length < 6) lows.push(`${tag(el)} «${el.textContent.trim().slice(0, 24)}» ${ratio.toFixed(2)}`);
      }
    }
    if (low) out.push(`low contrast ×${low}: ${lows.join('; ')}`);
    return out;
  });
}

/** Tab through the first controls; each focused one must show a focus indicator. */
async function focusRing(p, tabs = 12) {
  const bad = [];
  for (let i = 0; i < tabs; i++) {
    await p.keyboard.press('Tab');
    const r = await p.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const host = el.closest('.fxs-composer, .fxs-search, .fxh-composer, label');
      const hostCs = host ? getComputedStyle(host) : null;
      const shown = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' || (hostCs && (hostCs.boxShadow !== 'none' || hostCs.outlineStyle !== 'none'));
      return { shown: !!shown || !!host, el: el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] };
    });
    if (r && !r.shown) bad.push(r.el);
  }
  return bad;
}

// ───────────── Run ─────────────
const on = serve(createEffectHandler({ env: { ANTHROPIC_API_KEY: 'test', OPENROUTER_API_KEY: 'test' }, makeClient: fakeClient, fetchImpl }));
await new Promise((r) => on.listen(0, r));
const base = `http://127.0.0.1:${on.address().port}`;
const browser = await chromium.launch();

try {
  // Site flows.
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
    const p = await ctx.newPage();
    const errors = [];
    watch(p, 'site', errors);
    await p.goto(base + '/effect/studio', { waitUntil: 'networkidle' });
    await flow(p, w, 'site', {
      onDownload: async (click) => {
        const [d] = await Promise.all([p.waitForEvent('download'), click()]);
        return readFile(await d.path(), 'utf8');
      },
    });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`site ${w}: no horizontal overflow`, overflow <= 0, overflow + 'px');
    check(`site ${w}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // Artifact flows.
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    const errors = [];
    watch(p, 'artifact', errors);
    await p.addInitScript(() => {
      const page = (h1, bg) =>
        `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Колос</title><style>body{margin:0;background:${bg}}</style></head><body><main><h1>${h1}</h1><p>Хлеб.</p></main></body></html>`;
      const ans = (t) =>
        /ARCHITECT/.test(t) ? '{"name":"Колос"}' : /DESIGNER/.test(t) ? '{}' : /TESTER|REVIEWER/.test(t) ? '{"verdict":"pass","issues":[]}' : /тёмн/i.test(t) ? page('Колос ночью', '#111') : page('Колос', '#fffaf3');
      const sample = (msgs, o = {}) =>
        new Promise((r) =>
          setTimeout(() => {
            const t = ans(msgs.map((m) => m.content).join('\n'));
            o.onText?.({ text: t, delta: t });
            r({ text: t, truncated: false });
          }, 40),
        );
      window.__saved = [];
      const downloads = { save: async (f) => void window.__saved.push(f) };
      window.claude = { use: (n) => Promise.resolve(n === 'sample' ? sample : n === 'downloads' ? downloads : null) };
    });
    await p.goto(base + '/artifact/test.html#studio');
    await flow(p, w, 'artifact', {
      onDownload: async (click) => {
        await click();
        await p.waitForFunction(() => window.__saved.length > 0, null, { timeout: 5000 });
        return p.evaluate(() => window.__saved.at(-1).data);
      },
    });
    check(`artifact ${w}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // Performance budget.
  for (const [w, h] of [SIZES[0], SIZES[2]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    let bytes = 0;
    p.on('response', async (r) => {
      const b = await r.body().catch(() => null);
      if (b) bytes += b.length;
    });
    await p.goto(base + '/effect', { waitUntil: 'networkidle' });
    // Let the 3D prism settle on its quality tier (it adapts after about 1.2 s).
    await p.waitForTimeout(4000);
    const fps = await p.evaluate(
      () =>
        new Promise((done) => {
          let n = 0;
          const t0 = performance.now();
          const tick = () => (performance.now() - t0 < 2000 ? (n++, requestAnimationFrame(tick)) : done((n * 1000) / (performance.now() - t0)));
          requestAnimationFrame(tick);
        }),
    );
    const maxBytes = w < 760 ? BUDGET.landingPhoneBytes : BUDGET.landingDesktopBytes;
    const minFps = w < 760 ? BUDGET.minFps : BUDGET.minFpsSoftwareGl;
    const gl = await p.evaluate(() => !!document.querySelector('.fx-prism-gl canvas'));
    check(`perf ${w}: landing weight`, bytes <= maxBytes, `${Math.round(bytes / 1024)} KB of ${Math.round(maxBytes / 1024)} KB`);
    check(`perf ${w}: landing frame rate`, fps >= minFps, `${fps.toFixed(0)} FPS (minimum ${minFps}${gl ? ', WebGL prism on' : ', photo hero'})`);
    const errors = await a11y(p);
    check(`a11y ${w}: landing`, errors.length === 0, errors.join(' | '));
    if (w === 1440) {
      const ring = await focusRing(p);
      check('a11y 1440: landing focus indicator', ring.length === 0, ring.join(', '));
    }

    let studioBytes = 0;
    const q = await ctx.newPage();
    q.on('response', async (r) => {
      const b = await r.body().catch(() => null);
      if (b) studioBytes += b.length;
    });
    await q.goto(base + '/effect/studio', { waitUntil: 'networkidle' });
    check(`perf ${w}: studio weight`, studioBytes <= BUDGET.studioBytes, `${Math.round(studioBytes / 1024)} KB of ${Math.round(BUDGET.studioBytes / 1024)} KB`);
    check(`a11y ${w}: studio start`, (await a11y(q)).length === 0, (await a11y(q)).join(' | '));
    await q.evaluate(() => {
      window.__long = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__long = Math.max(window.__long, e.duration)))).observe({ type: 'longtask', buffered: false });
    });
    await q.fill('#fxs-input', 'Сайт пекарни «Колос» с меню и заказом');
    await q.press('#fxs-input', 'Enter');
    await waitIdle(q, 1);
    const long = await q.evaluate(() => window.__long);
    check(`perf ${w}: longest task during a generation`, long <= BUDGET.longTaskMs, `${Math.round(long)} ms`);
    check(`a11y ${w}: studio with a project`, (await a11y(q)).length === 0, (await a11y(q)).join(' | '));
    await q.click('.fxs-composer .fxs-picker:first-child .fxs-pill');
    check(`a11y ${w}: model menu`, (await a11y(q)).length === 0, (await a11y(q)).join(' | '));
    await q.keyboard.press('Escape');
    await q.click('.fxs-cmdk');
    check(`a11y ${w}: command palette`, (await a11y(q)).length === 0, (await a11y(q)).join(' | '));
    await q.keyboard.press('Escape');
    if (w === 1440) {
      await q.click('body', { position: { x: 5, y: 300 } }).catch(() => {});
      const ring = await focusRing(q, 16);
      check('a11y 1440: studio focus indicator', ring.length === 0, ring.join(', '));
    }
    await ctx.close();
  }
  const art = (await stat(resolve(ROOT, 'dist/artifact/effect.html'))).size;
  check('perf: artifact page size', art <= BUDGET.artifactBytes, `${Math.round(art / 1024)} KB of ${Math.round(BUDGET.artifactBytes / 1024)} KB`);
} finally {
  await browser.close();
  on.close();
}

console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
