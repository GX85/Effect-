'use client';
import { useEffect, useRef } from 'react';
export type Weather = 'storm' | 'rain' | 'sun';
// The fog is integrated through a 3D density field at a capped resolution and frame rate.
const frag = `precision mediump float;
uniform float time;uniform vec2 resolution;uniform float sunny;uniform float flash;
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float density(vec3 p){return noise(p)*.6+noise(p*2.03)*.28+noise(p*4.01)*.12;}
void main(){vec2 uv=gl_FragCoord.xy/resolution;vec3 ray=normalize(vec3((uv-.5)*vec2(2.4,1.1),1.));float fog=0.;float trans=1.;for(int i=0;i<22;i++){float depth=float(i)*.16;vec3 p=ray*depth+vec3(time*.025,-.25,time*.012);float d=max(0.,density(p*2.)-.42)*.14;d*=(1.0-smoothstep(.05,.85,uv.y));fog+=trans*d;trans*=exp(-d*.85);}vec3 col=mix(vec3(.55,.62,.64),vec3(.88,.78,.56),sunny);col+=flash*.7;gl_FragColor=vec4(col,min(.38,fog)*(1.-sunny*.6));}`;
export default function Scene3D({
  weather,
  paused,
}: {
  weather: Weather;
  paused: boolean;
}) {
  const fogRef = useRef<HTMLCanvasElement>(null),
    rainRef = useRef<HTMLCanvasElement>(null);
  const weatherRef = useRef(weather);
  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);
  useEffect(() => {
    const canvas = fogRef.current;
    if (
      !canvas ||
      paused ||
      window.matchMedia('(max-width: 760px), (prefers-reduced-motion: reduce)')
        .matches
    )
      return;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      powerPreference: 'low-power',
    });
    if (!gl) return;
    const make = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      return s;
    };
    const vs = make(
        gl.VERTEX_SHADER,
        'attribute vec2 position;void main(){gl_Position=vec4(position,0,1);}',
      ),
      fs = make(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    // WebGL's useProgram is not a React Hook.
    // oxlint-disable-next-line react/react-compiler
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const t = gl.getUniformLocation(program, 'time'),
      r = gl.getUniformLocation(program, 'resolution'),
      s = gl.getUniformLocation(program, 'sunny'),
      f = gl.getUniformLocation(program, 'flash');
    let visible = true,
      frame = 0,
      last = 0;
    let sunValue = weatherRef.current === 'sun' ? 1 : 0;
    const resize = () => {
      canvas.width = Math.min(640, canvas.clientWidth * 0.45);
      canvas.height = Math.min(420, canvas.clientHeight * 0.45);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    const observer = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    observer.observe(canvas);
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden || now - last < 50) return;
      last = now;
      gl.uniform1f(t, now * 0.001);
      gl.uniform2f(r, canvas.width, canvas.height);
      sunValue += ((weatherRef.current === 'sun' ? 1 : 0) - sunValue) * 0.05;
      gl.uniform1f(s, sunValue);
      gl.uniform1f(f, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    frame = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [paused]);
  useEffect(() => {
    const canvas = rainRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return;
    let visible = true,
      frame = 0,
      last = 0;
    let intensity = weatherRef.current === 'sun' ? 0 : 1;
    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resize();
    const drops = Array.from(
      { length: window.innerWidth < 760 ? 34 : 85 },
      () => ({
        x: Math.random(),
        y: Math.random(),
        z: 0.3 + Math.random() * 0.7,
      }),
    );
    const observer = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    observer.observe(canvas);
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden || now - last < 40) return;
      const dt = Math.min(60, now - last) / 1000;
      last = now;
      intensity +=
        ((weatherRef.current === 'sun' ? 0 : 1) - intensity) *
        Math.min(1, dt * 1.3);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const drop of drops) {
        drop.y = (drop.y + dt * (0.22 + drop.z * 0.3)) % 1;
        drop.x = (drop.x + dt * 0.018) % 1;
        ctx.strokeStyle = 'rgba(208,226,231,' + drop.z * 0.2 * intensity + ')';
        ctx.lineWidth = drop.z;
        ctx.beginPath();
        ctx.moveTo(drop.x * canvas.width, drop.y * canvas.height);
        ctx.lineTo(
          drop.x * canvas.width + 2,
          drop.y * canvas.height + drop.z * 24,
        );
        ctx.stroke();
      }
    };
    frame = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [paused]);
  return (
    <div className="scene-layers" aria-hidden="true">
      <canvas ref={fogRef} className="fog-canvas" />
      <canvas ref={rainRef} />
      <div className={'sunlight ' + (weather === 'sun' ? 'is-sunny' : '')} />
    </div>
  );
}
