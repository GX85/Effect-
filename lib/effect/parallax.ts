/**
 * Multi-depth parallax for the prism hero, shared by the site (React) and the artifact.
 * Each `[data-depth]` layer moves at its own speed with the pointer (mouse only) and with
 * scroll; `data-zoom` layers also grow as the hero scrolls away, `data-turn` layers tilt.
 * No perpetual loop: work happens on scroll / pointermove, at most once per frame, and
 * only while the hero is on screen. Returns a cleanup function.
 */
export function bindParallax(stage: HTMLElement, reduce: boolean): () => void {
  const layers = Array.from(stage.querySelectorAll<HTMLElement>('[data-depth]'));
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const amp = fine ? 1 : 0.55;
  let top = 0;
  let height = 1;
  let frame = 0;
  let px = 0;
  let py = 0;
  let on = false;
  const measure = () => {
    const r = stage.getBoundingClientRect();
    top = r.top + window.scrollY;
    height = Math.max(1, r.height);
  };
  const apply = () => {
    frame = 0;
    const s = Math.max(0, Math.min(1, window.scrollY / (top + height)));
    stage.style.setProperty('--pscroll', s.toFixed(3));
    for (const l of layers) {
      const d = Number(l.dataset.depth) || 0;
      const tx = fine ? px * d * 34 : 0;
      const ty = (fine ? py * d * 24 : 0) + s * d * 110 * amp;
      const zoom = l.dataset.zoom ? ` scale(${(1.03 + s * 0.08 * amp).toFixed(4)})` : '';
      const turn = l.dataset.turn && fine ? ` rotate(${(px * 0.7).toFixed(3)}deg)` : '';
      l.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)${zoom}${turn}`;
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(apply);
  };
  const move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX / window.innerWidth - 0.5;
    py = e.clientY / window.innerHeight - 0.5;
    schedule();
  };
  const listen = (v: boolean) => {
    if (v === on || reduce) return;
    on = v;
    if (v) {
      window.addEventListener('scroll', schedule, { passive: true });
      if (fine) window.addEventListener('pointermove', move, { passive: true });
    } else {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('pointermove', move);
    }
  };
  const io = new IntersectionObserver(
    ([e]) => {
      stage.classList.toggle('is-off', !e.isIntersecting);
      listen(e.isIntersecting);
      if (e.isIntersecting && !reduce) schedule();
    },
    { rootMargin: '80px 0px' },
  );
  io.observe(stage);
  const ro = new ResizeObserver(() => {
    measure();
    if (!reduce) schedule();
  });
  ro.observe(stage);
  measure();
  if (reduce) layers.forEach((l) => (l.style.transform = ''));
  return () => {
    io.disconnect();
    ro.disconnect();
    listen(false);
    if (frame) cancelAnimationFrame(frame);
  };
}
