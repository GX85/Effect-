// Assembles the standalone Effect page published as a claude.ai artifact.
//   landing markup <- dist/client/effect.html (server-rendered EffectHome; run `npm run build:static` first)
//   landing styles <- app/effect-home.css, studio styles <- app/effect.css
//   app            <- React studio + `sample` transport + landing glue, bundled from artifact/effect/entry.tsx
// Output (default dist/artifact): effect.html (the page body the artifact skeleton wraps),
// test.html (the same page with a doctype and viewport meta for local checks) and the images.
// Usage: node artifact/effect/build.mjs [outDir]
import { buildSync } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const out = resolve(process.argv[2] || resolve(repo, 'dist/artifact'));
const SITE = 'https://focus-nine-chi.vercel.app';
mkdirSync(out, { recursive: true });

// 1) App bundle. `</script` inside strings must not end the inline <script>.
const bundle = buildSync({
  entryPoints: [resolve(here, 'entry.tsx')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2020',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  tsconfig: resolve(repo, 'tsconfig.json'),
  legalComments: 'none',
  write: false,
  logLevel: 'warning',
});
const app = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

// 2) Landing markup from the static build.
const built = readFileSync(resolve(repo, 'dist/client/effect.html'), 'utf8');
const start = built.indexOf('<div class="fxh"');
if (start < 0) throw new Error('Landing markup not found: run `npm run build:static` first.');
let depth = 0;
let end = -1;
const tags = /<div[\s>]|<\/div>/g;
tags.lastIndex = start;
for (let m; (m = tags.exec(built)); ) {
  depth += m[0] === '</div>' ? -1 : 1;
  if (depth === 0) {
    end = m.index + 6;
    break;
  }
}
const landing = built
  .slice(start, end)
  .replace(/<!--\$?\/?-->|<!-- -->/g, '')
  .replace(/href="\/effect\/studio(\?[^"]*)?"/g, 'href="#studio"')
  .replace(/href="\/effect"/g, 'href="#top"')
  .replace(/href="\/(#\w+|start)?"/g, (_, rest) => `href="${SITE}/${rest || ''}" target="_blank" rel="noopener"`)
  .replace(/"\/effect\/(prism-[\w-]+\.webp)"/g, '"$1"')
  .replace(/srcSet=/g, 'srcset=')
  .replace(/fetchPriority=/g, 'fetchpriority=')
  .replace('<main>', '<main id="top">');
if (/href="\/(?!\/)/.test(landing)) throw new Error('Unrewritten local link: ' + landing.match(/href="\/[^"]*"/)[0]);

// 3) Styles with page-relative image URLs.
const landingCss = readFileSync(resolve(repo, 'app/effect-home.css'), 'utf8')
  .replace(/url\('\/effect\/(prism-[\w-]+\.webp)'\)/g, "url('$1')")
  .replace(/var\(--font-geist-sans\)/g, "'Inter'");
const studioCss = readFileSync(resolve(repo, 'app/effect.css'), 'utf8');

// 4) Template.
let page = readFileSync(resolve(here, 'template.html'), 'utf8');
for (const [key, value] of [
  ['/*LANDING_CSS*/', landingCss],
  ['/*STUDIO_CSS*/', studioCss],
  ['<!--LANDING-->', landing],
  ['/*APP*/', app],
]) {
  if (!page.includes(key)) throw new Error('Placeholder missing: ' + key);
  page = page.split(key).join(value);
}
writeFileSync(resolve(out, 'effect.html'), page);
writeFileSync(
  resolve(out, 'test.html'),
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' + page,
);
for (const img of ['prism-hero.webp', 'prism-hero-960.webp', 'prism-rim.webp'])
  copyFileSync(resolve(repo, 'public/effect', img), resolve(out, img));
console.log(`Artifact page: ${resolve(out, 'effect.html')} (${Math.round(page.length / 1024)} KB, app ${Math.round(app.length / 1024)} KB)`);
