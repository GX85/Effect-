/**
 * Behaviour for the static landing markup inside the artifact (the site hydrates the same
 * markup with React): menu sheet, reveals, live mini scenes, tilt, prism parallax and the
 * hero composer. Everything pauses off screen and respects reduced motion.
 */
import { bindParallax } from '../../lib/effect/parallax.ts';

type Open = (prompt?: string, send?: boolean) => void;

const $ = <T extends Element = HTMLElement>(s: string, r: Element | Document = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: Element | Document = document) => Array.from(r.querySelectorAll<T>(s));

export function initLanding(open: Open) {
  const land = $('.fxh');
  if (!land) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Menu sheet
  const btn = $('.fxh-menu-btn');
  const menu = $('#fxh-menu');
  const bar = $('.fxh-nav');
  if (btn && menu && bar) {
    const set = (v: boolean) => {
      btn.setAttribute('aria-expanded', String(v));
      menu.hidden = !v;
    };
    btn.addEventListener('click', () => set(menu.hidden));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => set(false)));
    addEventListener('keydown', (e) => e.key === 'Escape' && set(false));
    addEventListener('pointerdown', (e) => !menu.hidden && !bar.contains(e.target as Node) && set(false));
  }

  // Reveals and live scenes
  const io = 'IntersectionObserver' in window;
  const rev = io
    ? new IntersectionObserver(
        (es) =>
          es.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in');
              rev!.unobserve(e.target);
            }
          }),
        { rootMargin: '0px 0px -8% 0px' },
      )
    : null;
  $$('.fxh-reveal').forEach((n) => (rev ? rev.observe(n) : n.classList.add('in')));
  const live = io ? new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('is-live', e.isIntersecting))) : null;
  $$('.fxh-mock, .fxh-scene, .fxh-agents').forEach((n) => (live ? live.observe(n) : n.classList.add('is-live')));
  const vis = () => land.classList.toggle('is-hidden', document.hidden);
  document.addEventListener('visibilitychange', vis);
  vis();

  // Tilt on mouse devices, one layout read per frame
  $$('.fxh-world, .fxh-model').forEach((card) => {
    let frame = 0;
    let px = 0;
    let py = 0;
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || reduce) return;
      px = e.clientX;
      py = e.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = card.getBoundingClientRect();
        const x = (px - r.left) / r.width - 0.5;
        const y = (py - r.top) / r.height - 0.5;
        card.style.transform = `perspective(1000px) rotateX(${-y * 9}deg) rotateY(${x * 11}deg)`;
        card.style.setProperty('--mx', (x + 0.5) * 100 + '%');
        card.style.setProperty('--my', (y + 0.5) * 100 + '%');
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      frame = 0;
      card.style.transform = '';
    });
  });

  // Prism parallax (shared with the site)
  const stage = $('.fx-prism');
  if (stage && 'IntersectionObserver' in window && 'ResizeObserver' in window) bindParallax(stage, reduce);

  // Hero composer: Enter / send opens the studio and starts the agents
  const form = $<HTMLFormElement>('.fxh-composer');
  const ta = form ? $<HTMLTextAreaElement>('textarea', form) : null;
  if (form && ta) {
    const go = () => {
      const q = ta.value.trim();
      ta.value = '';
      open(q || undefined, Boolean(q));
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      go();
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        go();
      }
    });
  }

  // Every "#studio" link opens the studio
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.('a[href="#studio"]');
    if (!a) return;
    e.preventDefault();
    open();
  });
}
