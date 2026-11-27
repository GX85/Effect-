/**
 * Real-time 3D prism for the landing hero. Three.js is injected (site: dynamic import,
 * artifact: cdnjs module), so this file never bundles it. A faceted glass prism with
 * transmission/dispersion/iridescence under a hand-built studio environment; a white beam
 * enters, a spectrum fan leaves, faint internal bounces; additive sprites fake bloom.
 * Performance: DPR capped (1.5 desktop / 1.25 phones), renders only while visible and the
 * tab is shown, adaptive quality (heavy glass → light glass → give up and keep the photo).
 */
import type * as T from 'three';

export type Prism3D = { dispose(): void };
export type Prism3DOptions = { phone: boolean; onReady?: () => void; onFail?: (reason: string) => void };

const SPECTRUM = [0xff375f, 0xff9f0a, 0xffd60a, 0x30d158, 0x64d2ff, 0x0a84ff, 0xbf5af2];

function glowTexture(THREE: typeof T, inner: string): T.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, inner);
  r.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A soft additive ray: a quad from `a` to `b`, `w0` wide at the start, `w1` at the end. */
function ray(THREE: typeof T, a: T.Vector2, b: T.Vector2, w0: number, w1: number, color: number, opacity: number, time: { value: number }, speed: number) {
  const dir = b.clone().sub(a).normalize();
  const n = new THREE.Vector2(-dir.y, dir.x);
  const p = [a.clone().addScaledVector(n, w0 / 2), a.clone().addScaledVector(n, -w0 / 2), b.clone().addScaledVector(n, w1 / 2), b.clone().addScaledVector(n, -w1 / 2)];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([p[0].x, p[0].y, 0, p[1].x, p[1].y, 0, p[2].x, p[2].y, 0, p[3].x, p[3].y, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 1, 1, 0], 2));
  geo.setIndex([0, 1, 2, 2, 1, 3]);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uTime: time, uSpeed: { value: speed } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform vec3 uColor; uniform float uOpacity; uniform float uTime; uniform float uSpeed; varying vec2 vUv;' +
      'void main(){ float edge = 1.0 - abs(vUv.y - 0.5) * 2.0; edge = pow(edge, 1.6);' +
      ' float fade = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.55, 1.0, vUv.x) * 0.85);' +
      ' float pulse = exp(-pow((fract(vUv.x - uTime * uSpeed) - 0.5) * 9.0, 2.0)) * 0.6;' +
      ' gl_FragColor = vec4(uColor * (1.0 + pulse), edge * fade * uOpacity); }',
  });
  return new THREE.Mesh(geo, mat);
}

export function mountPrism3D(host: HTMLElement, THREE: typeof T, opts: Prism3DOptions): Prism3D | null {
  let renderer: T.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !opts.phone, alpha: true, powerPreference: 'high-performance' });
  } catch {
    opts.onFail?.('webgl');
    return null;
  }
  const maxDpr = opts.phone ? 1.25 : 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'fx-prism-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.15, opts.phone ? 12 : 9.5);

  // Studio environment built from emissive panels (no addons, no HDR download).
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), new THREE.MeshBasicMaterial({ color: 0x050506, side: THREE.BackSide })));
  const panel = (w: number, h: number, color: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    envScene.add(m);
  };
  panel(12, 3, 0xffffff, 0, 9, 2);
  panel(3, 10, 0xd8c6a0, -10, 1, 3);
  panel(3, 10, 0x9fb7ff, 10, 0, -2);
  panel(8, 2, 0xffffff, 0, -6, 6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = envMap;

  // Prism: a rounded triangle extruded with a bevel, apex up, facing the camera.
  const R = 1.55;
  const shape = new THREE.Shape();
  const pts = [0, 1, 2].map((i) => new THREE.Vector2(Math.cos(Math.PI / 2 + (i * 2 * Math.PI) / 3) * R, Math.sin(Math.PI / 2 + (i * 2 * Math.PI) / 3) * R));
  const round = 0.16;
  pts.forEach((p, i) => {
    const prev = pts[(i + 2) % 3];
    const next = pts[(i + 1) % 3];
    const a = p.clone().lerp(prev, round);
    const b = p.clone().lerp(next, round);
    if (i === 0) shape.moveTo(a.x, a.y);
    else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(p.x, p.y, b.x, b.y);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4, curveSegments: 10 });
  geo.center();
  const heavy = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.04,
    transmission: 1,
    thickness: 1.4,
    ior: 1.52,
    iridescence: 0.5,
    iridescenceIOR: 1.3,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.5,
    attenuationColor: new THREE.Color(0xf2ead8),
    attenuationDistance: 7,
  });
  if ('dispersion' in heavy) (heavy as unknown as { dispersion: number }).dispersion = 5;
  const light = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.06, transparent: true, opacity: 0.2, clearcoat: 1, envMapIntensity: 2.2, iridescence: 0.35 });
  const prism = new THREE.Mesh(geo, opts.phone ? light : heavy);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: 0xe9dcc2, transparent: true, opacity: 0.35 }));
  prism.add(edges);

  const group = new THREE.Group();
  group.add(prism);
  scene.add(group);

  // Light: beam in, refracted path inside, spectrum out, faint internal bounces.
  const time = { value: 0 };
  const entry = new THREE.Vector2(-0.62, 0.22);
  const exit = new THREE.Vector2(0.58, -0.02);
  const rays = new THREE.Group();
  rays.add(ray(THREE, new THREE.Vector2(-7.5, 1.05), entry, 0.06, 0.07, 0xffffff, 0.95, time, 0.35));
  rays.add(ray(THREE, entry, exit, 0.07, 0.12, 0xfff4e0, 0.55, time, 0.35));
  SPECTRUM.forEach((c, i) => {
    const angle = 0.28 - i * 0.075;
    const end = new THREE.Vector2(exit.x + Math.cos(-angle) * 9, exit.y + Math.sin(-angle) * 9 + 0.6);
    rays.add(ray(THREE, exit, end, 0.03, 0.55, c, 0.55, time, 0.22));
  });
  rays.add(ray(THREE, exit, new THREE.Vector2(-0.1, -0.78), 0.03, 0.05, 0xd4b97f, 0.18, time, 0.5));
  rays.add(ray(THREE, new THREE.Vector2(-0.1, -0.78), new THREE.Vector2(-3.8, -2.6), 0.04, 0.3, 0x9fb7ff, 0.1, time, 0.3));
  rays.position.z = 0.02;
  group.add(rays);

  const spriteMat = (inner: string, opacity: number) =>
    new THREE.SpriteMaterial({ map: glowTexture(THREE, inner), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const flare = new THREE.Sprite(spriteMat('rgba(255,255,255,1)', 0.9));
  flare.position.set(entry.x, entry.y, 0.3);
  flare.scale.set(1.3, 1.3, 1);
  const exitGlow = new THREE.Sprite(spriteMat('rgba(255,244,224,1)', 0.45));
  exitGlow.position.set(exit.x, exit.y, 0.3);
  exitGlow.scale.set(1.1, 1.1, 1);
  group.add(flare, exitGlow);
  group.rotation.y = -0.18;

  // Sizing, visibility, pointer and scroll.
  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = (opts.phone ? 12 : 9.5) * Math.max(1, 1.6 / camera.aspect);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  let px = 0;
  let py = 0;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX / window.innerWidth - 0.5;
    py = e.clientY / window.innerHeight - 0.5;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  let visible = true;
  let frame = 0;
  let last = 0;
  let started = 0;
  let samples: number[] = [];
  let windowStart = 1.2;
  let judged = false;
  let tier: 'heavy' | 'light' = opts.phone ? 'light' : 'heavy';
  let ready = false;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    schedule();
  });
  io.observe(host);
  const onVis = () => schedule();
  document.addEventListener('visibilitychange', onVis);

  function schedule() {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function tick(t: number) {
    frame = 0;
    if (!started) started = t;
    const dt = last ? t - last : 16;
    last = t;
    time.value = (t - started) / 1000;
    const s = Math.max(0, Math.min(1, window.scrollY / Math.max(1, host.getBoundingClientRect().height)));
    group.rotation.y += (-0.18 + Math.sin(time.value * 0.25) * 0.1 + px * 0.35 - group.rotation.y) * 0.06;
    group.rotation.x += (py * 0.18 - group.rotation.x) * 0.06;
    group.position.y = s * 0.9;
    (flare.material as T.SpriteMaterial).opacity = 0.75 + Math.sin(time.value * 2.4) * 0.15;
    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      opts.onReady?.();
    }
    // Adaptive quality: judge 1.5 s of frames, step down (heavy glass → light glass → photo).
    if (time.value > 1.2 && !judged) {
      samples.push(dt);
      if (time.value - windowStart > 1.5 || samples.length >= 90) {
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        samples = [];
        windowStart = time.value;
        if (avg > 45) {
          api.dispose();
          opts.onFail?.('slow');
          return;
        }
        if (avg > 24 && tier === 'heavy') {
          tier = 'light';
          prism.material = light;
          renderer.setPixelRatio(1);
          resize();
        } else if (avg > 30) {
          api.dispose();
          opts.onFail?.('slow');
          return;
        } else judged = true;
      }
    }
    schedule();
  }
  schedule();

  const api: Prism3D = {
    dispose() {
      cancelAnimationFrame(frame);
      frame = 0;
      visible = false;
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      scene.traverse((o) => {
        const m = o as T.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => x.dispose());
      });
      heavy.dispose();
      light.dispose();
      envMap.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
  return api;
}

/** True when the 3D hero should not run (reduced motion or no WebGL). */
export function prism3DBlocked(): boolean {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    const c = document.createElement('canvas');
    return !(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return true;
  }
}
