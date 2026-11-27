/**
 * Effect Game Studio. A small runtime every generated game is built on (`window.FXGame`),
 * so loops, input, audio and saving are robust by default, and a playtest harness that
 * plays the game for a few seconds in a sandboxed frame and reports crashes, freezes and FPS.
 */
import type { Check } from './agent/types.ts';

export const GAME_KIT = `<script id="fx-game-kit">(function(){
var G={};var keys={},pressed={};
G.canvas=function(sel){var c=typeof sel==='string'?document.querySelector(sel):sel;if(!c){c=document.createElement('canvas');document.body.appendChild(c)}var ctx=c.getContext('2d');function fit(){var d=Math.min(window.devicePixelRatio||1,2),w=c.clientWidth||innerWidth,h=c.clientHeight||innerHeight;c.width=Math.round(w*d);c.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);G.w=w;G.h=h}fit();addEventListener('resize',fit);G.ctx=ctx;return ctx};
G.loop=function(update,render){var last=0,acc=0,step=1/120,paused=false;G.pause=function(v){paused=v===undefined?!paused:v;return paused};document.addEventListener('visibilitychange',function(){if(document.hidden)paused=true});function f(t){var dt=last?Math.min((t-last)/1000,1/30):0;last=t;if(!paused){acc+=dt;while(acc>=step){update(step);acc-=step;for(var k in pressed)pressed[k]=false}}render(paused);G._frames=(G._frames||0)+1;requestAnimationFrame(f)}requestAnimationFrame(f)};
addEventListener('keydown',function(e){if(!keys[e.code])pressed[e.code]=true;keys[e.code]=true;if(/Arrow|Space/.test(e.code))e.preventDefault();G.unlock()});addEventListener('keyup',function(e){keys[e.code]=false});
G.key=function(c){return !!keys[c]};G.pressed=function(c){return !!pressed[c]};
G.pointer={x:0,y:0,down:false};function pt(e){var r=e.target.getBoundingClientRect?e.target.getBoundingClientRect():{left:0,top:0};G.pointer.x=e.clientX-r.left;G.pointer.y=e.clientY-r.top}
addEventListener('pointerdown',function(e){G.pointer.down=true;pt(e);G.unlock()});addEventListener('pointerup',function(){G.pointer.down=false});addEventListener('pointermove',pt);
G.joystick=function(opt){opt=opt||{};var j={x:0,y:0,active:false,id:null,ox:0,oy:0,r:opt.radius||56};addEventListener('pointerdown',function(e){if(e.pointerType==='mouse'||j.active)return;if(opt.left!==false&&e.clientX>innerWidth/2)return;j.active=true;j.id=e.pointerId;j.ox=e.clientX;j.oy=e.clientY});addEventListener('pointermove',function(e){if(!j.active||e.pointerId!==j.id)return;var dx=e.clientX-j.ox,dy=e.clientY-j.oy,l=Math.hypot(dx,dy)||1,k=Math.min(1,l/j.r);j.x=dx/l*k;j.y=dy/l*k});addEventListener('pointerup',function(e){if(e.pointerId===j.id){j.active=false;j.x=j.y=0}});j.draw=function(ctx){if(!j.active)return;ctx.save();ctx.globalAlpha=.35;ctx.beginPath();ctx.arc(j.ox,j.oy,j.r,0,7);ctx.fillStyle='#fff';ctx.fill();ctx.globalAlpha=.6;ctx.beginPath();ctx.arc(j.ox+j.x*j.r,j.oy+j.y*j.r,j.r*.4,0,7);ctx.fill();ctx.restore()};return j};
G.button=function(label,x,y,r){var b={label:label,x:x,y:y,r:r||34,down:false};addEventListener('pointerdown',function(e){if(Math.hypot(e.clientX-b.x(),e.clientY-b.y())<b.r)b.down=true});addEventListener('pointerup',function(){b.down=false});b.draw=function(ctx){ctx.save();ctx.globalAlpha=b.down?.55:.3;ctx.beginPath();ctx.arc(b.x(),b.y(),b.r,0,7);ctx.fillStyle='#fff';ctx.fill();ctx.globalAlpha=.9;ctx.fillStyle='#000';ctx.font='600 14px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(b.label,b.x(),b.y());ctx.restore()};return b};
G.hit=function(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y};G.hitCircle=function(a,b){return Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r};
var parts=[];G.burst=function(x,y,color,n,speed){for(var i=0;i<(n||16);i++){var a=Math.random()*6.283,s=(speed||160)*(.3+Math.random());parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.6+Math.random()*.4,c:color||'#fff'})}};
G.particles=function(ctx,dt){for(var i=parts.length-1;i>=0;i--){var p=parts[i];p.life-=dt;if(p.life<=0){parts.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=240*dt;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.c;ctx.fillRect(p.x-2,p.y-2,4,4)}ctx.globalAlpha=1};
var shakeT=0,shakeA=0;G.shake=function(a,t){shakeA=a||8;shakeT=t||.25};G.applyShake=function(ctx,dt){if(shakeT>0){shakeT-=dt;ctx.translate((Math.random()-.5)*shakeA,(Math.random()-.5)*shakeA)}};
var ac=null,muted=false;try{muted=localStorage.getItem('fx-muted')==='1'}catch(e){}
G.unlock=function(){if(ac||muted)return;try{ac=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}};
G.sound=function(freq,dur,type,vol){if(!ac||muted)return;try{var o=ac.createOscillator(),g=ac.createGain();o.type=type||'square';o.frequency.value=freq||440;g.gain.value=vol||.06;g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+(dur||.12));o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+(dur||.12))}catch(e){}};
G.mute=function(v){muted=v===undefined?!muted:v;try{localStorage.setItem('fx-muted',muted?'1':'0')}catch(e){}return muted};G.muted=function(){return muted};
G.save=function(k,v){try{localStorage.setItem('fx-'+k,JSON.stringify(v))}catch(e){}};G.load=function(k,d){try{var v=localStorage.getItem('fx-'+k);return v==null?d:JSON.parse(v)}catch(e){return d}};
var scenes={},cur=null;G.scene=function(name,s){scenes[name]=s};G.go=function(name,arg){cur=scenes[name];if(cur&&cur.enter)cur.enter(arg);G.current=name};G.update=function(dt){if(cur&&cur.update)cur.update(dt)};G.render=function(ctx,p){if(cur&&cur.render)cur.render(ctx,p)};
window.FXGame=G;})();</script>`;

export const GAME_DOC = `Effect Game Kit is injected before your scripts as window.FXGame (G). Build on it instead of re-writing the plumbing:
- const ctx = G.canvas('#game') sizes the canvas to its box and devicePixelRatio (G.w, G.h in CSS pixels).
- G.loop(update(dt), render(paused)) runs a fixed-step loop and pauses when the tab is hidden; G.pause() toggles pause.
- Input: G.key('ArrowLeft'), G.pressed('Space') (once per press), G.pointer {x, y, down}; touch: const stick = G.joystick() and const jump = G.button('↑', () => G.w - 70, () => G.h - 90) — draw them with stick.draw(ctx), jump.draw(ctx).
- Collisions: G.hit(a, b) for {x, y, w, h}, G.hitCircle(a, b) for {x, y, r}.
- Juice: G.burst(x, y, color), G.particles(ctx, dt) every frame, G.shake(8, 0.25) and G.applyShake(ctx, dt) inside ctx.save()/restore().
- Audio: G.sound(freq, seconds, 'square'|'sine'|'sawtooth'|'triangle'); it starts after the first input; G.mute() toggles and remembers.
- Saving: G.save('best', 1200), G.load('best', 0).
- Scenes: G.scene('title', {enter, update, render}), G.go('title'), then call G.update(dt) / G.render(ctx) from the loop.`;

/** Injects (or refreshes) the kit as the first script in <head>. */
export function withGameKit(html: string): string {
  const out = html.replace(/<script id="fx-game-kit">[\s\S]*?<\/script>/g, '');
  const m = out.match(/<head[^>]*>/i);
  if (m && m.index != null) return out.slice(0, m.index + m[0].length) + GAME_KIT + out.slice(m.index + m[0].length);
  return GAME_KIT + out;
}

export type PlayReport = {
  width: number;
  frames: number;
  fps: number;
  errors: string[];
  canvas: boolean;
  /** The picture did not change at all while being played. */
  frozen: boolean;
  /** Distinct frames sampled while playing. */
  changes: number;
  inputs: number;
  timeout?: boolean;
};

/** The harness: counts frames, catches errors, plays with keys and taps, samples the canvas. */
export const PLAYTEST_SCRIPT = `<script id="fx-playtest">(function(){
var R={frames:0,fps:0,errors:[],canvas:false,frozen:false,changes:0,inputs:0};var raf=window.requestAnimationFrame.bind(window);
window.requestAnimationFrame=function(cb){return raf(function(t){R.frames++;cb(t)})};
addEventListener('error',function(e){if(R.errors.length<8)R.errors.push('Uncaught '+String(e.error&&e.error.message||e.message).slice(0,200))});
addEventListener('unhandledrejection',function(e){if(R.errors.length<8)R.errors.push('Unhandled rejection: '+String(e.reason).slice(0,200))});
var ce=console.error;console.error=function(){if(R.errors.length<8)R.errors.push('console.error: '+[].map.call(arguments,String).join(' ').slice(0,200));return ce&&ce.apply(console,arguments)};
function big(){var cs=[].slice.call(document.querySelectorAll('canvas'));cs.sort(function(a,b){return b.width*b.height-a.width*a.height});return cs[0]}
function hash(){var c=big();if(!c)return '';R.canvas=true;try{var t=document.createElement('canvas');t.width=24;t.height=16;var x=t.getContext('2d');x.drawImage(c,0,0,24,16);var d=x.getImageData(0,0,24,16).data,h=0;for(var i=0;i<d.length;i+=4)h=(h*31+d[i]+d[i+1]*3+d[i+2]*7)>>>0;return String(h)}catch(e){return 'x'}}
function key(type,code,k){var e=new KeyboardEvent(type,{code:code,key:k||code,bubbles:true});(document.activeElement||document.body).dispatchEvent(e);window.dispatchEvent(new KeyboardEvent(type,{code:code,key:k||code}));R.inputs++}
function tap(x,y){var c=big()||document.body;var o={clientX:x,clientY:y,bubbles:true,pointerId:1,pointerType:'touch',isPrimary:true};['pointerdown','pointerup'].forEach(function(t){try{c.dispatchEvent(new PointerEvent(t,o))}catch(e){}});['mousedown','mouseup','click'].forEach(function(t){c.dispatchEvent(new MouseEvent(t,o))});try{c.dispatchEvent(new TouchEvent('touchstart',{bubbles:true}))}catch(e){};R.inputs++}
var seq=[['Enter','Enter'],['Space',' '],['ArrowRight','ArrowRight'],['ArrowUp','ArrowUp'],['ArrowLeft','ArrowLeft'],['Space',' '],['KeyW','w'],['KeyD','d'],['ArrowDown','ArrowDown'],['Space',' ']];
var hashes=[],i=0;
function play(){var s=seq[i%seq.length];key('keydown',s[0],s[1]);setTimeout(function(){key('keyup',s[0],s[1])},90);if(i%2===0)tap(innerWidth*(.3+(i%3)*.2),innerHeight*.6);i++;var h=hash();if(h&&hashes.indexOf(h)<0)hashes.push(h)}
function start(){var f0=R.frames,t0=performance.now();var id=setInterval(play,320);setTimeout(function(){clearInterval(id);var h=hash();if(h&&hashes.indexOf(h)<0)hashes.push(h);R.changes=hashes.length;R.frozen=R.canvas&&hashes.length<2;R.fps=Math.round((R.frames-f0)/((performance.now()-t0)/1000));try{parent.postMessage({fx:'playtest',report:R},'*')}catch(e){}},4200)}
if(document.readyState==='complete')setTimeout(start,500);else addEventListener('load',function(){setTimeout(start,500)});
})();</script>`;

export function withPlaytest(html: string): string {
  const m = html.match(/<head[^>]*>/i);
  if (m && m.index != null) return html.slice(0, m.index + m[0].length) + PLAYTEST_SCRIPT + html.slice(m.index + m[0].length);
  return PLAYTEST_SCRIPT + html;
}

export function playChecks(r: PlayReport | null): Check[] {
  if (!r) return [];
  const out: Check[] = [];
  if (r.timeout) out.push({ id: 'play-timeout', ok: false, severity: 'critical', message: 'The game did not respond to the playtest (it may hang on load).' });
  for (const e of r.errors) out.push({ id: 'play-error', ok: false, severity: 'critical', message: `While playing: ${e}` });
  if (!r.timeout && r.frames < 10) out.push({ id: 'play-loop', ok: false, severity: 'critical', message: 'No animation loop ran while playing (requestAnimationFrame never ticked).' });
  if (!r.timeout && !r.canvas) out.push({ id: 'play-canvas', ok: false, severity: 'major', message: 'No canvas found; the game should draw on a <canvas>.' });
  if (r.frozen) out.push({ id: 'play-frozen', ok: false, severity: 'major', message: `The picture never changed during ${r.inputs} simulated key presses and taps (stuck on a screen, or input is ignored). Make Enter/Space/tap start the game and arrows/touch move the player.` });
  if (!r.timeout && r.fps > 0 && r.fps < 30) out.push({ id: 'play-fps', ok: false, severity: 'major', message: `Low frame rate while playing: ${r.fps} FPS. Reduce per-frame work (no shadowBlur, fewer particles, no allocations in the loop).` });
  return out;
}

export function playSummary(r: PlayReport | null): string {
  if (!r) return 'Плейтест недоступен';
  if (r.timeout) return 'Игра не ответила';
  const parts = [r.errors.length ? `ошибок ${r.errors.length}` : 'без ошибок', `${r.fps} FPS`, r.frozen ? 'картинка не меняется' : `кадров с изменениями: ${r.changes}`];
  return parts.join(' · ');
}
