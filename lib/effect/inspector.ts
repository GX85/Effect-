/**
 * Visual inspector bridge for the preview. Injected only while the inspector is on: hover
 * outlines elements, a click selects one and reports its styles; the studio sends style or
 * text changes back, the frame applies them and posts the cleaned document, which becomes
 * the new code. Every trace of the bridge is removed from what is saved.
 */
export type Picked = {
  id: string;
  tag: string;
  label: string;
  text: string | null;
  html: string;
  styles: { color: string; background: string; fontSize: number; fontWeight: number; padding: number; radius: number; hidden: boolean };
};

export const INSPECTOR = `<script id="fx-inspect">(function(){var n=0,sel=null,hov=null;
var st=document.createElement('style');st.id='fx-inspect-style';st.textContent='[data-fx-hover]{outline:1px solid rgba(201,169,110,.7)!important;outline-offset:2px!important;cursor:pointer!important}[data-fx-sel]{outline:2px solid #c9a96e!important;outline-offset:2px!important}';document.head.appendChild(st);
function hex(c){var m=c&&c.match(/rgba?\\(([^)]+)\\)/);if(!m)return '#000000';var p=m[1].split(/[ ,\\/]+/).filter(Boolean).map(parseFloat);if(p.length>3&&p[3]===0)return 'transparent';return '#'+p.slice(0,3).map(function(v){return ('0'+Math.round(v).toString(16)).slice(-2)}).join('')}
function label(el){var t=el.tagName.toLowerCase(),tx=(el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,40);return t+(tx?' «'+tx+'»':'')}
function own(el){return el.children.length===0&&(el.textContent||'').trim()?el.textContent:null}
function report(el){var cs=getComputedStyle(el);if(!el.getAttribute('data-fx-id'))el.setAttribute('data-fx-id','e'+(++n));var c=el.cloneNode(true);c.removeAttribute('data-fx-sel');c.removeAttribute('data-fx-hover');parent.postMessage({fx:'pick',el:{id:el.getAttribute('data-fx-id'),tag:el.tagName.toLowerCase(),label:label(el),text:own(el),html:c.outerHTML.replace(/ data-fx-id="[^"]*"/g,'').slice(0,4000),styles:{color:hex(cs.color),background:hex(cs.backgroundColor),fontSize:Math.round(parseFloat(cs.fontSize)),fontWeight:parseInt(cs.fontWeight,10)||400,padding:Math.round(parseFloat(cs.paddingTop)||0),radius:Math.round(parseFloat(cs.borderTopLeftRadius)||0),hidden:cs.display==='none'}}},'*')}
document.addEventListener('mouseover',function(e){if(hov)hov.removeAttribute('data-fx-hover');hov=e.target;if(hov&&hov.setAttribute&&hov!==document.body&&hov!==document.documentElement)hov.setAttribute('data-fx-hover','')},true);
document.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var el=e.target;if(!el||el===document.documentElement)return;if(sel)sel.removeAttribute('data-fx-sel');sel=el;sel.setAttribute('data-fx-sel','');report(el)},true);
function send(){var c=document.documentElement.cloneNode(true);c.querySelectorAll('#fx-inspect,#fx-inspect-style').forEach(function(x){x.remove()});c.querySelectorAll('[data-fx-id],[data-fx-sel],[data-fx-hover]').forEach(function(x){x.removeAttribute('data-fx-id');x.removeAttribute('data-fx-sel');x.removeAttribute('data-fx-hover')});parent.postMessage({fx:'html',html:'<!doctype html>'+c.outerHTML},'*')}
addEventListener('message',function(e){var d=e.data;if(!d||d.fx!=='set')return;var el=document.querySelector('[data-fx-id="'+d.id+'"]');if(!el)return;if(d.prop==='text')el.textContent=d.value;else if(d.prop==='hidden')el.style.display=d.value?'none':'';else el.style.setProperty(d.prop,d.value);report(el);send()});
})();</script>`;

export function withInspector(html: string): string {
  const i = html.toLowerCase().lastIndexOf('</body>');
  return i < 0 ? html + INSPECTOR : html.slice(0, i) + INSPECTOR + html.slice(i);
}

/** Second guard: nothing of the inspector may reach saved HTML. */
export function cleanInspected(html: string): string {
  return html
    .replace(/<script id="fx-inspect">[\s\S]*?<\/script>/g, '')
    .replace(/<style id="fx-inspect-style">[\s\S]*?<\/style>/g, '')
    .replace(/\s(?:data-fx-id="[^"]*"|data-fx-sel=""|data-fx-hover="")/g, '');
}

/** CSS property for each inspector control. */
export const STYLE_PROPS = {
  color: 'color',
  background: 'background-color',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  padding: 'padding',
  radius: 'border-radius',
} as const;
