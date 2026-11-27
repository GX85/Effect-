'use client';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { bindParallax } from '@/lib/effect/parallax';
import { mountPrism3D, prism3DBlocked, type Prism3D } from '@/lib/effect/prism3d';

/**
 * Photoreal prism render with live light on top. Every light layer is a plain HTML
 * element inside a 1536:864 box (the render's own coordinate system), so it always
 * sits on the glass. Only `transform` and `opacity` animate; the glowing rim is a
 * rotating conic gradient under a pre-baked mask (`prism-rim.webp`) instead of SVG
 * blur filters, and nothing uses blend modes.
 *
 * Parallax has no perpetual rAF loop: it recalculates on `scroll` / `pointermove`
 * only while the hero is on screen, at most once per frame. Pointer parallax runs on
 * mouse devices only; touch devices get a lighter scroll parallax.
 */
export default function PrismHero() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    return bindParallax(el, reduce);
  }, [reduce]);

  // Real-time 3D prism, loaded after first paint; the photo stays as the fallback.
  useEffect(() => {
    const el = stage.current;
    const host = el?.querySelector<HTMLElement>('.fx-prism-gl');
    // Phones keep the photo with CSS light: it looks better there than a lighter 3D tier.
    if (!el || !host || reduce || prism3DBlocked() || window.matchMedia('(max-width: 760px), (pointer: coarse)').matches) return;
    let handle: Prism3D | null = null;
    let cancelled = false;
    el.classList.add('is-loading3d');
    const start = () =>
      import('three')
        .then((THREE) => {
          if (cancelled) return;
          handle = mountPrism3D(host, THREE, {
            phone: window.matchMedia('(max-width: 760px)').matches,
            onReady: () => el.classList.replace('is-loading3d', 'is-3d'),
            onFail: (r) => {
              el.classList.remove('is-loading3d', 'is-3d');
              el.dataset.fx3d = r;
            },
          });
          if (!handle) el.classList.remove('is-loading3d');
        })
        .catch(() => el.classList.remove('is-loading3d'));
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: object) => number }).requestIdleCallback;
    const t = idle ? idle(start, { timeout: 1500 }) : window.setTimeout(start, 700);
    return () => {
      cancelled = true;
      if (!idle) window.clearTimeout(t);
      handle?.dispose();
      el.classList.remove('is-loading3d', 'is-3d');
    };
  }, [reduce]);

  return (
    <div className="fx-prism" ref={stage} aria-hidden="true">
      <div className="fx-prism-far" data-depth="-1.2" />
      <div className="fx-prism-layer" data-depth="0.8" data-zoom="1">
        <div className="fx-prism-tilt" data-depth="0.6" data-turn="1">
          <div className="fx-prism-art">
            <picture>
              <source media="(max-width: 700px)" srcSet="/effect/prism-hero-960.webp" width={960} height={540} />
              <img
                className="fx-prism-img"
                src="/effect/prism-hero.webp"
                width={1536}
                height={864}
                alt=""
                decoding="async"
                fetchPriority="high"
              />
            </picture>
            <div className="fx-prism-fan">
              <i className="fx-prism-tint" />
              <i className="fx-prism-sweep" />
            </div>
            <div className="fx-prism-beam">
              <i className="fx-prism-halo" />
              <i className="fx-prism-pulse" />
            </div>
            <i className="fx-prism-inner" />
            <i className="fx-prism-flare" />
            <div className="fx-prism-rim" />
          </div>
        </div>
      </div>
      {/* Near sparks: tiny separate layers, so the closest depth costs almost nothing to move. */}
      {[
        [20, 72, 1.7],
        [82, 24, 1.9],
        [64, 80, 1.5],
        [8, 30, 1.8],
        [44, 14, 1.6],
      ].map(([x, y, d], i) => (
        <i key={i} className={'fx-prism-spark s' + i} data-depth={d} style={{ left: x + '%', top: y + '%' }} />
      ))}
      <div className="fx-prism-gl" />
      <div className="fx-prism-vignette" />
    </div>
  );
}

/** Preload hints for the hero render: phones get the 960px file, wider screens 1536px. */
export function PrismPreload() {
  return (
    <>
      <link rel="preload" as="image" href="/effect/prism-hero-960.webp" media="(max-width: 700px)" fetchPriority="high" />
      <link rel="preload" as="image" href="/effect/prism-hero.webp" media="(min-width: 701px)" fetchPriority="high" />
    </>
  );
}
