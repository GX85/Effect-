/**
 * Effect inside a claude.ai artifact: the static landing plus the React studio. All AI goes
 * through the runtime `sample` capability (the viewer's Claude plan), downloads through
 * `downloads`. The studio is mounted on first open and lives at #studio.
 */
import { createRoot, type Root } from 'react-dom/client';
import Studio from '../../components/effect/studio/Studio';
import { initLanding } from './landing';
import { sampleEngine } from './sample-engine';

const SITE = 'https://focus-nine-chi.vercel.app/effect';
const host = document.getElementById('studio')!;
const land = document.querySelector<HTMLElement>('.fxh');
let root: Root | null = null;
let landScroll = 0;

function show(on: boolean) {
  if (on === !host.hidden) return;
  if (on) {
    landScroll = scrollY;
    host.hidden = false;
    if (land) land.hidden = true;
    document.documentElement.classList.add('fx-studio-on', 'fxs-root');
  } else {
    host.hidden = true;
    if (land) land.hidden = false;
    document.documentElement.classList.remove('fx-studio-on', 'fxs-root');
    scrollTo(0, landScroll);
  }
}

function close() {
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    location.hash = '';
  }
  show(false);
}

function open(prompt?: string, send = false) {
  if (location.hash !== '#studio') {
    try {
      history.pushState(null, '', '#studio');
    } catch {
      /* sandboxed history: the studio still opens */
    }
  }
  show(true);
  if (!root) {
    root = createRoot(host);
    root.render(<Studio engine={sampleEngine} onExit={close} siteUrl={SITE} initialPrompt={send ? prompt : undefined} />);
    if (prompt && !send) setTimeout(() => window.dispatchEvent(new CustomEvent('effect:prompt', { detail: { text: prompt } })), 50);
  } else if (prompt) {
    window.dispatchEvent(new CustomEvent('effect:prompt', { detail: { text: prompt, send } }));
  }
}

addEventListener('hashchange', () => (location.hash === '#studio' ? open() : show(false)));
addEventListener('popstate', () => (location.hash === '#studio' ? open() : show(false)));
initLanding(open);
if (location.hash === '#studio') open();
