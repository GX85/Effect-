'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  RotateCcw,
  Pause,
  Play,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Box,
} from 'lucide-react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import type {
  Color,
  BufferGeometry,
  Material,
  Texture,
  MeshStandardMaterial,
} from 'three';
export type Inspection = 'whole' | 'frame' | 'drivetrain' | 'cockpit';
type Commands = {
  reset: () => void;
  zoom: (amount: number) => void;
  turn: (amount: number) => void;
};
export default function RapidProductStudio({
  color,
  inspection,
  mode,
  onModeChange,
  onResetView,
}: {
  color: string;
  inspection: Inspection;
  mode: 'photo' | '3d';
  onModeChange: (mode: 'photo' | '3d') => void;
  onResetView: () => void;
}) {
  const host = useRef<HTMLElement>(null),
    latest = useRef({ color, inspection, rotate: false }),
    commands = useRef<Commands | null>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [rotate, setRotate] = useState(false),
    [progress, setProgress] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    latest.current = { color, inspection, rotate: rotate && !reduced };
  }, [color, inspection, rotate, reduced]);
  useEffect(() => {
    const el = host.current;
    if (!el || mode !== '3d') return;
    let cancelled = false,
      cleanup = () => {};
    Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/environments/RoomEnvironment.js'),
    ])
      .then(
        async ([T, { GLTFLoader }, { OrbitControls }, { RoomEnvironment }]) => {
          if (cancelled) return;
          const gltf = await new GLTFLoader().loadAsync(
            '/models/rapid-racing-bike.glb',
            (e) => {
              if (!cancelled && e.total)
                setProgress(Math.round((e.loaded / e.total) * 100));
            },
          );
          const model = gltf.scene;
          const disposeModel = () => {
            const geos = new Set<BufferGeometry>(),
              mats = new Set<Material>(),
              textures = new Set<Texture>();
            model.traverse((o) => {
              if (o instanceof T.Mesh) {
                geos.add(o.geometry);
                for (const m of Array.isArray(o.material)
                  ? o.material
                  : [o.material]) {
                  mats.add(m);
                  Object.values(m).forEach((v) => {
                    if (v instanceof T.Texture) textures.add(v);
                  });
                }
              }
            });
            geos.forEach((g) => g.dispose());
            mats.forEach((m) => m.dispose());
            textures.forEach((t) => {
              const source = t.source.data;
              t.dispose();
              if (
                typeof ImageBitmap !== 'undefined' &&
                source instanceof ImageBitmap
              )
                source.close();
            });
          };
          if (cancelled) {
            disposeModel();
            return;
          }
          let renderer;
          try {
            renderer = new T.WebGLRenderer({
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance',
            });
          } catch {
            disposeModel();
            setFailed(true);
            return;
          }
          renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = T.PCFSoftShadowMap;
          renderer.toneMapping = T.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.08;
          renderer.outputColorSpace = T.SRGBColorSpace;
          el.appendChild(renderer.domElement);
          const scene = new T.Scene(),
            camera = new T.PerspectiveCamera(31, 1, 0.03, 30);
          const controls = new OrbitControls(camera, renderer.domElement);
          controls.enableDamping = true;
          controls.dampingFactor = 0.09;
          controls.enablePan = false;
          controls.enableZoom = false;
          controls.minDistance = 0.6;
          controls.maxDistance = 6;
          controls.minPolarAngle = 0.25;
          controls.maxPolarAngle = Math.PI * 0.52;
          controls.autoRotateSpeed = 0.42;
          model.rotation.y = Math.PI / 2;
          model.updateMatrixWorld(true);
          const rawBox = new T.Box3().setFromObject(model),
            rawSize = rawBox.getSize(new T.Vector3());
          model.scale.setScalar(1.8 / rawSize.x);
          model.updateMatrixWorld(true);
          const box = new T.Box3().setFromObject(model),
            center = box.getCenter(new T.Vector3());
          model.position.sub(new T.Vector3(center.x, box.min.y, center.z));
          scene.add(model);
          const paint = { value: new T.Color(latest.current.color) };
          const materials = new Set<MeshStandardMaterial>();
          model.traverse((o) => {
            if (o instanceof T.Mesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              for (const m of Array.isArray(o.material)
                ? o.material
                : [o.material])
                if (m instanceof T.MeshStandardMaterial) {
                  materials.add(m);
                  m.emissiveIntensity = 0;
                  m.envMapIntensity = 1.15;
                  if (m.map)
                    m.map.anisotropy = Math.min(
                      8,
                      renderer.capabilities.getMaxAnisotropy(),
                    );
                }
            }
          });
          // Recolour the red-painted frame regions only. Metal, rubber, chain and baked surface detail retain their maps.
          materials.forEach((m) => {
            m.onBeforeCompile = (shader) => {
              shader.uniforms.rapidPaint = paint;
              shader.fragmentShader =
                'uniform vec3 rapidPaint;\n' + shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `#include <map_fragment>\nfloat painted = smoothstep(1.15,1.7,diffuseColor.r/max(diffuseColor.g,0.005))*smoothstep(1.3,1.8,diffuseColor.r/max(diffuseColor.b,0.005));\nfloat surfaceShade = clamp(diffuseColor.r * 2.0,0.28,1.0);\ndiffuseColor.rgb = mix(diffuseColor.rgb, rapidPaint * surfaceShade, painted);`,
              );
            };
            m.customProgramCacheKey = () => 'rapid-finish-v1';
            m.needsUpdate = true;
          });
          const pmrem = new T.PMREMGenerator(renderer),
            room = new RoomEnvironment(),
            environment = pmrem.fromScene(room, 0.035);
          scene.environment = environment.texture;
          room.dispose();
          pmrem.dispose();
          scene.add(new T.HemisphereLight('#e6f0f4', '#303735', 0.9));
          const key = new T.DirectionalLight('#fff8eb', 3.2);
          key.position.set(-1, 3, 3);
          key.castShadow = true;
          key.shadow.mapSize.set(2048, 2048);
          key.shadow.camera.left = -2;
          key.shadow.camera.right = 2;
          key.shadow.camera.top = 2;
          key.shadow.camera.bottom = -2;
          key.shadow.normalBias = 0.008;
          key.shadow.bias = -0.00015;
          key.shadow.radius = 3;
          scene.add(key);
          const rim = new T.DirectionalLight('#c4dfeb', 2.6);
          rim.position.set(2, 2, -2);
          scene.add(rim);
          const fill = new T.DirectionalLight('#f3e8ce', 0.7);
          fill.position.set(-3, 1, -1);
          scene.add(fill);
          const floor = new T.Mesh(
            new T.PlaneGeometry(20, 20),
            new T.ShadowMaterial({ opacity: 0.38 }),
          );
          floor.rotation.x = -Math.PI / 2;
          floor.position.y = -0.005;
          floor.receiveShadow = true;
          scene.add(floor);
          const target = new T.Vector3(0, 0.57, 0),
            position = new T.Vector3();
          let activeInspection: Inspection = 'whole';
          const chooseView = (view: Inspection, instant = false) => {
            const fit = Math.max(1, 1.35 / camera.aspect);
            if (view === 'frame') {
              target.set(0, 0.7, 0);
              position.set(0.45, 0.82, 1.28);
            } else if (view === 'drivetrain') {
              target.set(0.17, 0.32, 0.06);
              position.set(0.55, 0.48, 1.15);
            } else if (view === 'cockpit') {
              target.set(-0.47, 0.96, 0);
              position.set(-1.0, 1.18, 1.0);
            } else {
              target.set(0, 0.57, 0);
              position.set(0.5, 0.84, 3.05);
              position.sub(target).multiplyScalar(fit).add(target);
            }
            if (instant) {
              controls.target.copy(target);
              camera.position.copy(position);
              controls.update();
            }
          };
          const resize = () => {
            if (!el.clientWidth || !el.clientHeight) return;
            renderer.setSize(el.clientWidth, el.clientHeight);
            camera.aspect = el.clientWidth / el.clientHeight;
            camera.updateProjectionMatrix();
            chooseView(latest.current.inspection, true);
          };
          const resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(el);
          resize();
          let frame = 0,
            last = 0,
            visible = true,
            settling = 0;
          const observer = new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
          });
          observer.observe(el);
          commands.current = {
            reset: () => {
              chooseView('whole', true);
            },
            turn: (a) => {
              const v = camera.position.clone().sub(controls.target);
              v.applyAxisAngle(new T.Vector3(0, 1, 0), a);
              camera.position.copy(controls.target).add(v);
              controls.update();
            },
            zoom: (a) => {
              const v = camera.position.clone().sub(controls.target);
              v.setLength(T.MathUtils.clamp(v.length() + a, 0.6, 6));
              camera.position.copy(controls.target).add(v);
              controls.update();
            },
          };
          const draw = (now: number) => {
            frame = requestAnimationFrame(draw);
            if (!visible || document.hidden) {
              last = now;
              return;
            }
            if (now - last < 32) return;
            const dt = Math.min((now - last) / 1000, 0.06);
            last = now;
            if (activeInspection !== latest.current.inspection) {
              activeInspection = latest.current.inspection;
              chooseView(activeInspection);
              settling = 1.6;
            }
            if (settling > 0) {
              const alpha = 1 - Math.exp(-dt * 5);
              camera.position.lerp(position, alpha);
              controls.target.lerp(target, alpha);
              settling -= dt;
            }
            controls.autoRotate =
              latest.current.rotate &&
              activeInspection === 'whole' &&
              settling <= 0;
            controls.update(dt);
            (paint.value as Color).set(latest.current.color);
            renderer.render(scene, camera);
          };
          frame = requestAnimationFrame(draw);
          setReady(true);
          setFailed(false);
          const lost = (e: Event) => {
            e.preventDefault();
            cancelAnimationFrame(frame);
            setReady(false);
            setFailed(true);
          };
          renderer.domElement.addEventListener('webglcontextlost', lost);
          cleanup = () => {
            cancelAnimationFrame(frame);
            resizeObserver.disconnect();
            observer.disconnect();
            controls.dispose();
            disposeModel();
            environment.dispose();
            floor.geometry.dispose();
            floor.material.dispose();
            renderer.domElement.removeEventListener('webglcontextlost', lost);
            renderer.dispose();
            renderer.domElement.remove();
            commands.current = null;
          };
        },
      )
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [mode]);
  return (
    <div className="rapid-bike-view">
      <div className="rapid-studio-mode" aria-label="Product view">
        <button
          onClick={() => onModeChange('photo')}
          aria-pressed={mode === 'photo'}
        >
          Studio
        </button>
        <button onClick={() => onModeChange('3d')} aria-pressed={mode === '3d'}>
          Explore in 3D
        </button>
      </div>
      {mode === '3d' && (
        <section
          ref={host}
          className="rapid-render"
          aria-label="Detailed interactive racing bicycle. Drag to rotate or use the view buttons."
        />
      )}
      {(mode === 'photo' || !ready || failed) && (
        <div className="rapid-photo-gallery">
          <Image
            unoptimized
            src="/images/rapid-aeris.webp"
            alt="Rapid AERIS R1 graphite racing bicycle with detailed carbon frame, drivetrain and aero wheels"
            width={1536}
            height={1024}
            priority
          />
          {mode === 'photo' && (
            <button onClick={() => onModeChange('3d')}>
              <Box size={18} />
              Explore the engineering in 3D
            </button>
          )}
        </div>
      )}
      <span className="rapid-view-note">IMAPRO / SIGNATURE EXPERIENCE</span>
      {mode === '3d' && (
        <div className="rapid-view-label">
          {failed
            ? '3D unavailable here · studio photograph retained'
            : ready
              ? 'DRAG TO ROTATE / SCROLL THE PAGE NORMALLY'
              : `Loading the detailed model${progress ? ' · ' + progress + '%' : '…'}`}
        </div>
      )}
      {mode === '3d' && ready && !failed && (
        <div className="rapid-view-controls">
          <button
            aria-label="Rotate left"
            onClick={() => commands.current?.turn(-0.25)}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            aria-label="Rotate right"
            onClick={() => commands.current?.turn(0.25)}
          >
            <ChevronRight size={17} />
          </button>
          <button
            aria-label="Zoom in"
            onClick={() => commands.current?.zoom(-0.18)}
          >
            <ZoomIn size={17} />
          </button>
          <button
            aria-label="Zoom out"
            onClick={() => commands.current?.zoom(0.18)}
          >
            <ZoomOut size={17} />
          </button>
          <button
            aria-label="Reset camera"
            onClick={() => {
              onResetView();
              commands.current?.reset();
            }}
          >
            <RotateCcw size={17} />
          </button>
          <button
            aria-label={rotate ? 'Pause rotation' : 'Start rotation'}
            disabled={reduced}
            aria-pressed={rotate && !reduced}
            onClick={() => setRotate(!rotate)}
          >
            {rotate && !reduced ? <Pause size={17} /> : <Play size={17} />}
          </button>
        </div>
      )}
    </div>
  );
}
