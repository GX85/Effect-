/**
 * Effect Motion Kit: the polish every generated project ships with, so quality does not
 * depend on the model remembering it. Injected by the pipeline into every page:
 *   - a brief branded intro (gone by ~600 ms, never blocks input),
 *   - press feedback on buttons and cards, hover lift, visible focus,
 *   - scroll reveal with stagger (`data-reveal`, `data-stagger`), smooth anchor scrolling,
 *   - animated counters (`data-count-to`) and progress bars (`data-progress`),
 *   - View Transitions for hash-router pages (`#/page`) and between real pages,
 *   - `FXMotion.toast(text)` for form feedback, `FXMotion.go(fn)` for custom page swaps.
 * Transform and opacity only; everything is off under prefers-reduced-motion.
 */

export const MOTION_CSS = `<style id="fx-motion-css">
:root{--fx-spring:cubic-bezier(.2,.9,.25,1.12);--fx-out:cubic-bezier(.2,.8,.2,1)}
@view-transition{navigation:auto}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
:where(button,[role=button],.btn,.button,input[type=submit],input[type=button],[data-press]){transition:transform .38s var(--fx-spring),box-shadow .38s var(--fx-out),background-color .2s,color .2s,opacity .2s;-webkit-tap-highlight-color:transparent}
:where(button,[role=button],.btn,.button,input[type=submit],input[type=button],[data-press]):active:not(:disabled){transform:scale(.96);transition-duration:.08s}
:where(.card,[data-lift]){transition:transform .5s var(--fx-spring),box-shadow .5s var(--fx-out)}
:where(a.card,.card[onclick],[data-lift]):active{transform:scale(.985);transition-duration:.1s}
@media (hover:hover) and (pointer:fine){:where(.card,[data-lift]):hover{transform:translateY(-4px);box-shadow:0 22px 50px rgba(0,0,0,.14)}}
:where(a,button,input,select,textarea,summary,[tabindex]):focus-visible{outline:2px solid var(--fx-accent,var(--accent,currentColor));outline-offset:3px}
html.fx-js [data-reveal]{opacity:0;transform:translateY(26px);transition:opacity .7s var(--fx-out),transform .95s var(--fx-spring);transition-delay:calc(var(--fx-i,0) * 70ms)}
html.fx-js [data-reveal].fx-in{opacity:1;transform:none}
#fx-intro{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:var(--fx-bg,var(--bg,#fff));pointer-events:none;animation:fx-intro-out .34s var(--fx-out) .26s forwards}
#fx-intro i{width:34px;height:34px;border-radius:50%;border:3px solid rgba(127,127,127,.22);border-top-color:var(--fx-accent,var(--accent,#0a84ff));animation:fx-spin .7s linear infinite}
@keyframes fx-intro-out{to{opacity:0;visibility:hidden}}
@keyframes fx-spin{to{transform:rotate(1turn)}}
.fx-toasts{position:fixed;left:50%;bottom:max(20px,env(safe-area-inset-bottom));z-index:2147483001;display:grid;gap:8px;justify-items:center;transform:translateX(-50%);pointer-events:none}
.fx-toast{max-width:min(440px,calc(100vw - 32px));padding:12px 18px;border-radius:16px;background:rgba(22,22,26,.94);color:#fff;font:500 15px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.28);animation:fx-toast-in .5s var(--fx-spring) both}
.fx-toast.out{animation:fx-toast-out .3s var(--fx-out) forwards}
@keyframes fx-toast-in{from{opacity:0;transform:translateY(14px) scale(.94)}}
@keyframes fx-toast-out{to{opacity:0;transform:translateY(8px) scale(.97)}}
::view-transition-old(root),::view-transition-new(root){animation-duration:.34s;animation-timing-function:var(--fx-out)}
@media (prefers-reduced-motion:reduce){#fx-intro{display:none}html.fx-js [data-reveal]{opacity:1;transform:none;transition:none}*,*::before,*::after{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important;scroll-behavior:auto!important}}
</style>`;

export const MOTION_INTRO = '<div id="fx-intro" aria-hidden="true"><i></i></div>';

export const MOTION_JS = `<script id="fx-motion">(function(){var d=document,h=d.documentElement;h.classList.add('fx-js');
var R=false;try{R=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
var io=null;try{io=R?null:new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;var t=e.target;t.classList.add('fx-in');if(t.hasAttribute('data-count-to'))count(t);if(t.hasAttribute('data-progress'))bar(t);io.unobserve(t)})},{rootMargin:'0px 0px -6% 0px'})}catch(e){}
function show(t){t.classList.add('fx-in');if(t.hasAttribute('data-count-to'))count(t);if(t.hasAttribute('data-progress'))bar(t)}
function count(el){if(el.__fx)return;el.__fx=1;var to=parseFloat(el.getAttribute('data-count-to'))||0,dec=(String(el.getAttribute('data-count-to')).split('.')[1]||'').length,suf=el.getAttribute('data-suffix')||'',pre=el.getAttribute('data-prefix')||'';if(R){el.textContent=pre+to.toLocaleString(d.documentElement.lang||undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec})+suf;return}var t0=0;function f(t){if(!t0)t0=t;var k=Math.min(1,(t-t0)/1400),v=to*(1-Math.pow(1-k,3));el.textContent=pre+v.toLocaleString(d.documentElement.lang||undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec})+suf;if(k<1)requestAnimationFrame(f)}requestAnimationFrame(f)}
function bar(el){var v=Math.max(0,Math.min(100,parseFloat(el.getAttribute('data-progress'))||0));el.style.transformOrigin='left center';el.style.transform='scaleX('+(R?v/100:0)+')';if(!R){el.style.transition='transform 1.2s cubic-bezier(.2,.8,.2,1)';requestAnimationFrame(function(){requestAnimationFrame(function(){el.style.transform='scaleX('+v/100+')'})})}}
function prep(){try{[].forEach.call(d.querySelectorAll('[data-stagger]'),function(g){[].forEach.call(g.children,function(c,i){if(!c.hasAttribute('data-reveal'))c.setAttribute('data-reveal','');c.style.setProperty('--fx-i',Math.min(i,12))})});
[].forEach.call(d.querySelectorAll('[data-reveal]:not(.fx-in),[data-count-to],[data-progress]'),function(el){if(el.__fxo)return;el.__fxo=1;if(io)io.observe(el);else show(el)})}catch(e){}}
function safety(){[].forEach.call(d.querySelectorAll('[data-reveal]:not(.fx-in)'),function(el){var r=el.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0)show(el)})}
var mo;try{mo=new MutationObserver(function(){clearTimeout(mo.t);mo.t=setTimeout(prep,60)});}catch(e){}
function start(){prep();if(mo)mo.observe(d.body,{childList:true,subtree:true});setTimeout(safety,1600)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start);else start();
function vt(fn){if(d.startViewTransition&&!R){try{return d.startViewTransition(fn)}catch(e){}}fn()}
d.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href^="#/"]');if(!a||e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||!d.startViewTransition||R)return;var href=a.getAttribute('href');if(location.hash===href)return;e.preventDefault();vt(function(){return new Promise(function(res){var done=0;function fin(){if(!done){done=1;requestAnimationFrame(function(){res()})}}addEventListener('hashchange',fin,{once:true});setTimeout(fin,350);location.hash=href})})});
var box;function toast(msg,ms){try{if(!box){box=d.createElement('div');box.className='fx-toasts';box.setAttribute('role','status');box.setAttribute('aria-live','polite');d.body.appendChild(box)}var t=d.createElement('div');t.className='fx-toast';t.textContent=String(msg);box.appendChild(t);setTimeout(function(){t.classList.add('out');setTimeout(function(){t.remove()},320)},ms||2600)}catch(e){}}
window.FXMotion={toast:toast,go:vt,reveal:prep,reduced:R};
})();</script>`;

/** One paragraph for the developer prompt: how to use the kit. */
export const MOTION_DOC = `Effect Motion Kit is injected into every page automatically — do not re-implement or remove it, build on it:
- Add data-reveal to sections, cards and headings so they rise in on scroll; put data-stagger on a grid/list to stagger its children.
- Buttons, [role=button], .btn and inputs of type submit get spring press feedback automatically; give clickable cards class "card" (or data-lift) for hover lift and press.
- Animated numbers: <span data-count-to="1200" data-suffix="+">0</span>; progress bars: an inner element with data-progress="72" (it animates scaleX, so give it width:100%).
- Hash-router pages: link with href="#/page" — page changes get a View Transition automatically; for custom DOM swaps call FXMotion.go(() => render()).
- After a form action call FXMotion.toast('Заявка отправлена') (plus an inline success state).
- Set --fx-accent and --fx-bg in :root so the brief intro loader and focus rings match the brand.
- Your own motion must animate only transform and opacity, and respect prefers-reduced-motion.`;

const strip = (html: string) =>
  html
    .replace(/<style id="fx-motion-css">[\s\S]*?<\/style>/g, '')
    .replace(/<script id="fx-motion">[\s\S]*?<\/script>/g, '')
    .replace(/<div id="fx-intro"[^>]*>[\s\S]*?<\/div>/g, '');

/** Injects (or refreshes) the kit: CSS at the end of <head>, intro after <body>, JS before </body>. */
export function withMotionKit(html: string, opts: { intro?: boolean } = {}): string {
  let out = strip(html);
  const headEnd = out.search(/<\/head>/i);
  out = headEnd >= 0 ? out.slice(0, headEnd) + MOTION_CSS + out.slice(headEnd) : MOTION_CSS + out;
  if (opts.intro !== false) {
    const body = out.match(/<body[^>]*>/i);
    if (body && body.index != null) out = out.slice(0, body.index + body[0].length) + MOTION_INTRO + out.slice(body.index + body[0].length);
  }
  const bodyEnd = out.toLowerCase().lastIndexOf('</body>');
  return bodyEnd >= 0 ? out.slice(0, bodyEnd) + MOTION_JS + out.slice(bodyEnd) : out + MOTION_JS;
}

export const hasMotionKit = (html: string) => html.includes('id="fx-motion"') && html.includes('id="fx-motion-css"');
