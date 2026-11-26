/**
 * Runtime audit of a generated page. The script is injected into a sandboxed preview
 * (allow-scripts only) and reports real facts through postMessage: console errors,
 * uncaught exceptions, horizontal overflow, broken anchors, low-contrast text, images
 * without alt, controls without a label and long tasks. The helpers turn reports into
 * checks the tester and the fix round use.
 */
import type { Check } from './agent/types.ts';

export type AuditReport = {
  width: number;
  errors: string[];
  overflow: { px: number; offenders: string[] };
  brokenAnchors: string[];
  lowContrast: { el: string; ratio: number; fg: string; bg: string }[];
  missingAlt: number;
  unlabeled: string[];
  longTasks: { count: number; ms: number };
  /** Text elements in the first screen that are still invisible after load. */
  hidden?: string[];
  /** The intro loader still covers the page. */
  intro?: boolean;
  /** Effect Motion Kit is running. */
  motion?: boolean;
  title?: string;
  timeout?: boolean;
};

/** The injected script. Plain ES5, every probe in try/catch, one message at the end. */
export const AUDIT_SCRIPT = `<script id="fx-audit">(function(){
var R={errors:[],overflow:{px:0,offenders:[]},brokenAnchors:[],lowContrast:[],missingAlt:0,unlabeled:[],longTasks:{count:0,ms:0}};
function s(v){try{return String(v&&v.message||v).slice(0,240)}catch(e){return 'error'}}
var ce=console.error;console.error=function(){try{R.errors.length<12&&R.errors.push('console.error: '+[].map.call(arguments,s).join(' '))}catch(e){}return ce&&ce.apply(console,arguments)};
addEventListener('error',function(e){if(R.errors.length<12)R.errors.push('Uncaught '+s(e.error||e.message)+(e.lineno?' (line '+e.lineno+')':''))});
addEventListener('unhandledrejection',function(e){if(R.errors.length<12)R.errors.push('Unhandled rejection: '+s(e.reason))});
try{new PerformanceObserver(function(l){l.getEntries().forEach(function(x){R.longTasks.count++;R.longTasks.ms+=Math.round(x.duration)})}).observe({type:'longtask',buffered:true})}catch(e){}
function d(el){if(!el||!el.tagName)return '';var t=el.tagName.toLowerCase();if(el.id)return t+'#'+el.id;var c=(el.getAttribute('class')||'').trim().split(/\\s+/).filter(Boolean).slice(0,2).join('.');var tx=(el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,30);return t+(c?'.'+c:'')+(tx?' «'+tx+'»':'')}
function rgb(c){var m=c&&c.match(/rgba?\\(([^)]+)\\)/);if(!m)return null;var p=m[1].split(/[ ,\\/]+/).filter(Boolean).map(parseFloat);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}}
function lum(c){function f(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)}
function bgOf(el){for(var n=el;n&&n.nodeType===1;n=n.parentElement){var cs=getComputedStyle(n);if(cs.backgroundImage&&cs.backgroundImage!=='none')return null;var b=rgb(cs.backgroundColor);if(b&&b.a>0.85)return b}return {r:255,g:255,b:255,a:1}}
function run(){
try{var W=document.documentElement.clientWidth,sw=Math.max(document.documentElement.scrollWidth,document.body?document.body.scrollWidth:0);R.overflow.px=Math.max(0,sw-W);
if(R.overflow.px>1){var all=document.body.querySelectorAll('*'),n=0;for(var i=0;i<all.length&&n<5;i++){var r=all[i].getBoundingClientRect();if(r.width&&r.right>W+1&&getComputedStyle(all[i]).position!=='fixed'){var p=all[i].parentElement;if(p&&p.getBoundingClientRect().right>W+1)continue;R.overflow.offenders.push(d(all[i])+' → '+Math.round(r.right)+'px');n++}}}}catch(e){}
try{[].forEach.call(document.querySelectorAll('a[href^="#"]'),function(a){var h=a.getAttribute('href');if(h==='#'||h.charAt(1)==='/'||h.charAt(1)==='!')return;var id=decodeURIComponent(h.slice(1));if(!document.getElementById(id)&&!document.getElementsByName(id).length&&R.brokenAnchors.length<8)R.brokenAnchors.push(h)})}catch(e){}
try{var seen=0,els=document.body.querySelectorAll('h1,h2,h3,h4,p,li,a,button,span,label,td,th,small,strong,em,blockquote,figcaption,dd,dt');for(var j=0;j<els.length&&seen<500;j++){var el=els[j];var own=[].some.call(el.childNodes,function(x){return x.nodeType===3&&x.textContent.trim().length>1});if(!own)continue;var rc=el.getBoundingClientRect();if(!rc.width||!rc.height)continue;var cs=getComputedStyle(el);if(cs.visibility==='hidden'||+cs.opacity<0.3)continue;seen++;var fg=rgb(cs.color);var bg=bgOf(el);if(!fg||!bg||fg.a<0.5)continue;var L1=lum(fg),L2=lum(bg),ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);var fs=parseFloat(cs.fontSize),bold=+cs.fontWeight>=700;var need=(fs>=24||(bold&&fs>=18.66))?3:4.5;if(ratio<need&&R.lowContrast.length<8)R.lowContrast.push({el:d(el),ratio:Math.round(ratio*100)/100,fg:cs.color,bg:'rgb('+bg.r+','+bg.g+','+bg.b+')'})}}catch(e){}
try{R.missingAlt=document.querySelectorAll('img:not([alt])').length}catch(e){}
try{[].forEach.call(document.querySelectorAll('input,select,textarea,button,a[href]'),function(el){if(R.unlabeled.length>=8)return;var t=el.tagName.toLowerCase(),ty=(el.getAttribute('type')||'').toLowerCase();if(ty==='hidden'||el.closest('[aria-hidden="true"]'))return;if(el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')||el.getAttribute('title'))return;if(t==='button'||t==='a'){if((el.textContent||'').trim()||el.querySelector('img[alt],svg title'))return;R.unlabeled.push(d(el)||t);return}if(ty==='submit'||ty==='button'||ty==='reset'){if(el.value)return}if(el.id&&document.querySelector('label[for="'+el.id+'"]'))return;if(el.closest('label'))return;R.unlabeled.push(d(el)||t)})}catch(e){}
try{R.hidden=[];var vh=innerHeight;[].forEach.call(document.body.querySelectorAll('h1,h2,h3,p,a,button,li,img,[data-reveal]'),function(el){if(R.hidden.length>=6||el.closest('#fx-intro,[aria-hidden="true"],[hidden],dialog:not([open])'))return;var r=el.getBoundingClientRect();if(!r.width||!r.height||r.top>vh||r.bottom<0)return;var o=1,n=el;while(n&&n.nodeType===1){o*=+getComputedStyle(n).opacity;n=n.parentElement}if(o<0.05&&(el.textContent||'').trim())R.hidden.push(d(el))})}catch(e){}
try{var it=document.getElementById('fx-intro');if(it){var cs2=getComputedStyle(it);R.intro=cs2.display!=='none'&&cs2.visibility!=='hidden'&&+cs2.opacity>0.05}}catch(e){}
R.motion=!!window.FXMotion;
R.title=document.title;
try{parent.postMessage({fx:'audit',report:R},'*')}catch(e){}
}
function later(){setTimeout(run,2000)}
if(document.readyState==='complete')later();else addEventListener('load',later);
})();</script>`;

/** Inserts the audit script as early as possible (start of <head>, else start of the document). */
export function withAudit(html: string): string {
  const m = html.match(/<head[^>]*>/i);
  if (m && m.index != null) return html.slice(0, m.index + m[0].length) + AUDIT_SCRIPT + html.slice(m.index + m[0].length);
  const h = html.match(/<html[^>]*>/i);
  if (h && h.index != null) return html.slice(0, h.index + h[0].length) + AUDIT_SCRIPT + html.slice(h.index + h[0].length);
  return AUDIT_SCRIPT + html;
}

/** Converts runtime reports into checks. Severity follows how much the problem hurts a visitor. */
export function auditChecks(reports: AuditReport[]): Check[] {
  const out: Check[] = [];
  const at = (r: AuditReport) => r.width + 'px';
  const errors = new Map<string, number[]>();
  for (const r of reports) {
    if (r.timeout) {
      out.push({ id: 'runtime-timeout-' + r.width, ok: false, severity: 'major', message: `The page did not finish loading within the audit time at ${at(r)} (an endless loop or a blocking script?).` });
      continue;
    }
    for (const e of r.errors) errors.set(e, [...(errors.get(e) ?? []), r.width]);
    if (r.overflow.px > 1)
      out.push({ id: 'runtime-overflow-' + r.width, ok: false, severity: 'major', message: `Horizontal overflow of ${r.overflow.px}px at ${at(r)}` + (r.overflow.offenders.length ? `; widest elements: ${r.overflow.offenders.join('; ')}` : '') + '.' });
    if (r.lowContrast.length)
      out.push({
        id: 'runtime-contrast-' + r.width,
        ok: false,
        severity: r.lowContrast.length >= 3 ? 'major' : 'minor',
        message: `Low-contrast text at ${at(r)}: ` + r.lowContrast.slice(0, 5).map((c) => `${c.el} ${c.ratio}:1 (${c.fg} on ${c.bg})`).join('; ') + '.',
      });
    if (r.unlabeled.length) out.push({ id: 'runtime-labels-' + r.width, ok: false, severity: 'major', message: `Controls without an accessible name at ${at(r)}: ${r.unlabeled.slice(0, 5).join('; ')}.` });
    if (r.hidden && r.hidden.length) out.push({ id: 'runtime-hidden-' + r.width, ok: false, severity: 'major', message: `Content in the first screen is still invisible after load at ${at(r)}: ${r.hidden.slice(0, 4).join('; ')} (a reveal that never fires?).` });
    if (r.intro) out.push({ id: 'runtime-intro-' + r.width, ok: false, severity: 'major', message: `The intro loader still covers the page after load at ${at(r)}.` });
    if (r.longTasks.ms > 250) out.push({ id: 'runtime-longtasks-' + r.width, ok: false, severity: 'minor', message: `${r.longTasks.count} long task(s), ${r.longTasks.ms}ms in total at ${at(r)}.` });
  }
  for (const [e, widths] of errors) out.push({ id: 'runtime-error', ok: false, severity: 'critical', message: `${e} (at ${widths.join(' and ')}px)` });
  const first = reports.find((r) => !r.timeout);
  if (first?.brokenAnchors.length) out.push({ id: 'runtime-anchors', ok: false, severity: 'major', message: `Links to missing anchors: ${first.brokenAnchors.join(', ')}.` });
  if (first && first.missingAlt) out.push({ id: 'runtime-alt', ok: false, severity: 'minor', message: `${first.missingAlt} image(s) without alt.` });
  // Same contrast or label problem at both widths is reported once.
  const dedupe = new Map<string, Check>();
  for (const c of out) {
    const key = c.id.replace(/-\d+$/, '') + '|' + c.message.replace(/at \d+px/, '');
    if (!dedupe.has(key)) dedupe.set(key, c);
  }
  return [...dedupe.values()];
}

/** One line for the agent timeline, in Russian. */
export function auditSummary(reports: AuditReport[]): string {
  if (!reports.length) return 'Диагностика недоступна';
  return reports
    .map((r) => {
      if (r.timeout) return `${r.width}px: страница не загрузилась`;
      const parts: string[] = [];
      parts.push(r.errors.length ? `ошибок ${r.errors.length}` : 'без ошибок');
      if (r.overflow.px > 1) parts.push(`переполнение ${r.overflow.px}px`);
      if (r.lowContrast.length) parts.push(`контраст ×${r.lowContrast.length}`);
      if (r.unlabeled.length) parts.push(`без подписи ×${r.unlabeled.length}`);
      return `${r.width}px: ${parts.join(', ')}`;
    })
    .join(' · ');
}

/** Readable details for the expandable output of the timeline step. */
export function auditOutput(reports: AuditReport[]): string {
  const checks = auditChecks(reports);
  if (!checks.length) return 'Ошибок, переполнения, битых якорей и проблем доступности не найдено.';
  return checks.map((c) => `• [${c.severity}] ${c.message}`).join('\n');
}
