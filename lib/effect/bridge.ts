/**
 * Text-editing bridge for the preview iframe. Injected only while "Текст" mode is on:
 * it makes text nodes editable and posts the cleaned document back to the parent.
 * The bridge removes itself from what it posts; `cleanEditedHtml` is a second guard
 * so it can never reach saved HTML.
 */
export const BRIDGE = `<script id="fx-bridge">(function(){var sel='h1,h2,h3,h4,p,li,a,button,span,summary,blockquote,figcaption,b,small,label';
function on(){document.querySelectorAll(sel).forEach(function(el){if(el.closest('script,style,svg'))return;if([].some.call(el.childNodes,function(n){return n.nodeType===3&&n.textContent.trim()})){el.setAttribute('contenteditable','true');el.setAttribute('data-fx-edit','')}})}
var st=document.createElement('style');st.id='fx-bridge-style';st.textContent='[data-fx-edit]{outline:1.5px dashed transparent;outline-offset:3px;border-radius:4px;cursor:text;transition:outline-color .2s}[data-fx-edit]:hover{outline-color:rgba(0,113,227,.55)}[data-fx-edit]:focus{outline:2px solid #0071e3;background:rgba(0,113,227,.06)}';document.head.appendChild(st);
document.addEventListener('click',function(e){var a=e.target.closest('a,button');if(a){e.preventDefault()}},true);
var t;document.addEventListener('input',function(){clearTimeout(t);t=setTimeout(send,350)});
function send(){var c=document.documentElement.cloneNode(true);c.querySelectorAll('#fx-bridge,#fx-bridge-style').forEach(function(n){n.remove()});c.querySelectorAll('[data-fx-edit]').forEach(function(n){n.removeAttribute('contenteditable');n.removeAttribute('data-fx-edit')});c.querySelectorAll('.fx-in').forEach(function(n){n.classList.remove('fx-in')});parent.postMessage({fx:'html',html:'<!doctype html>'+c.outerHTML},'*')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',on);else on()})();</script>`;

/** Returns the document with the editing bridge injected before `</body>`. */
export function withBridge(html: string): string {
  const i = html.toLowerCase().lastIndexOf('</body>');
  return i < 0 ? html + BRIDGE : html.slice(0, i) + BRIDGE + html.slice(i);
}

/** Strips every trace of the bridge from HTML received from the preview. */
export function cleanEditedHtml(html: string): string {
  return html
    .replace(/<script id="fx-bridge">[\s\S]*?<\/script>/g, '')
    .replace(/<style id="fx-bridge-style">[\s\S]*?<\/style>/g, '')
    .replace(/\s(?:contenteditable="true"|data-fx-edit="")/g, '');
}

/** Largest HTML the studio accepts back from the preview. */
export const MAX_EDIT_HTML = 2_000_000;
