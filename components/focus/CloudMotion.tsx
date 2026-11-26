'use client';
import { useEffect, useRef, useState } from 'react';
import {
  WEATHER_ASSETS,
  WEATHER_FADE_MS,
  smoothWeatherBlend,
  weatherWeights,
  type Weather,
} from '@/lib/weather';

// Photographic cloud textures are advected at different depths, behind the live volume fog.
const fragment = `precision mediump float;
uniform sampler2D storm; uniform sampler2D rain; uniform sampler2D sun;
uniform vec3 weights; uniform vec2 resolution; uniform float time; uniform float reduced;
varying vec2 uv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
vec2 flow(vec2 p){float a=noise(p*3.+vec2(time*.018,0.));float b=noise(p*7.+vec2(-time*.009,time*.006));return vec2(a-.5,b-.5);}
void main(){
float aspect=resolution.x/resolution.y;float sourceAspect=1.7768;
vec2 crop=vec2(min(aspect/sourceAspect,1.),min(sourceAspect/aspect,1.));
vec2 p=(uv-.5)*crop+vec2(0.5+(aspect < 1.0 ? (1.0-crop.x)*0.14 : 0.0),0.5);
float depth=smoothstep(.05,.9,p.y);
vec2 movement=(flow(p)*vec2(.028,.018)+vec2(sin(time*.035)*.006,cos(time*.021)*.002))*depth*(1.-reduced);
vec2 nearUv=clamp(p+movement,vec2(.002),vec2(.998));
vec3 col=texture2D(storm,nearUv).rgb*weights.x+texture2D(rain,nearUv+movement*.25).rgb*weights.y+texture2D(sun,nearUv-movement*.2).rgb*weights.z;
gl_FragColor=vec4(col,1.);
}`;
export default function CloudMotion({
  weather,
  paused,
  reducedMotion,
}: {
  weather: Weather;
  paused: boolean;
  reducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(weather),
    pausedRef = useRef(paused),
    reducedRef = useRef(reducedMotion);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    targetRef.current = weather;
    pausedRef.current = paused;
    reducedRef.current = reducedMotion;
  }, [weather, paused, reducedMotion]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      powerPreference: 'low-power',
    });
    if (!gl) return;
    let cancelled = false,
      frame = 0,
      visible = true,
      last = 0,
      elapsed = 0,
      loaded = 0;
    const compile = (kind: number, source: string) => {
      const shader = gl.createShader(kind);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };
    const vertex = compile(
      gl.VERTEX_SHADER,
      'attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0,1);}',
    );
    const pixel = compile(gl.FRAGMENT_SHADER, fragment);
    if (!vertex || !pixel) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, pixel);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    // WebGL API method, not a React hook.
    // oxlint-disable-next-line react/react-compiler
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const attr = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(attr);
    gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
    const uniforms = {
      resolution: gl.getUniformLocation(program, 'resolution'),
      time: gl.getUniformLocation(program, 'time'),
      weights: gl.getUniformLocation(program, 'weights'),
      reduced: gl.getUniformLocation(program, 'reduced'),
    };
    const resize = () => {
      const limit = Math.min(
        window.innerWidth < 760 ? 0.75 : 0.8,
        1200 / canvas.clientWidth,
        900 / canvas.clientHeight,
      );
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * limit));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * limit));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    let current = weatherWeights(targetRef.current),
      from = [...current],
      to = [...current],
      active = targetRef.current,
      blendTime = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden) {
        last = now;
        return;
      }
      if (now - last < 33) return;
      const dt = Math.min((now - last) / 1000, 0.07);
      last = now;
      if (!pausedRef.current) elapsed += dt;
      if (active !== targetRef.current) {
        active = targetRef.current;
        from = [...current];
        to = weatherWeights(active);
        blendTime = 0;
      }
      blendTime += dt * 1000;
      current = smoothWeatherBlend(
        from,
        to,
        reducedRef.current ? 1 : blendTime / WEATHER_FADE_MS,
      ) as [number, number, number];
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, elapsed);
      gl.uniform3fv(uniforms.weights, current);
      gl.uniform1f(uniforms.reduced, reducedRef.current ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    const textures: WebGLTexture[] = [];
    const images = Object.entries(WEATHER_ASSETS).map(([key, src], i) => {
      const texture = gl.createTexture()!;
      textures.push(texture);
      const img = new window.Image();
      img.onload = () => {
        if (cancelled) return;
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.uniform1i(gl.getUniformLocation(program, key), i);
        loaded++;
        if (loaded === 3) {
          frame = requestAnimationFrame(draw);
          setReady(true);
        }
      };
      img.src = src;
      return img;
    });
    const observer = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    observer.observe(canvas);
    window.addEventListener('resize', resize);
    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(frame);
      setReady(false);
    };
    canvas.addEventListener('webglcontextlost', lost);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', lost);
      images.forEach((img) => {
        img.onload = null;
      });
      textures.forEach((t) => gl.deleteTexture(t));
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(pixel);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      className={'cloud-motion ' + (ready ? 'is-ready' : '')}
      aria-hidden="true"
    />
  );
}
