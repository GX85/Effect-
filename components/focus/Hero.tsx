'use client';
import Image from 'next/image';
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  CloudLightning,
  CloudRain,
  Sun,
  Volume2,
  VolumeX,
  Pause,
  Play,
} from 'lucide-react';
import { RadioGroup } from '@/components/ui/radio-group';
import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import type { Weather } from './Scene3D';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import {
  WEATHER_DELAY_MS,
  WEATHER_FADE_MS,
  WEATHER_ASSETS,
} from '@/lib/weather';
import { createThunderBuffer } from '@/lib/thunder';
const Scene3D = lazy(() => import('./Scene3D'));
const CloudMotion = lazy(() => import('./CloudMotion'));
export default function Hero() {
  const [weather, setWeather] = useState<Weather>('storm'),
    [requestedWeather, setRequestedWeather] = useState<Weather>('storm'),
    [weatherPhase, setWeatherPhase] = useState<'idle' | 'waiting' | 'changing'>(
      'idle',
    ),
    [sound, setSound] = useState(false),
    [motionPaused, setPaused] = useState(false),
    [audioError, setAudioError] = useState('');
  const audioRef = useRef<AudioContext | null>(null),
    heroRef = useRef<HTMLElement>(null),
    photoRef = useRef<HTMLDivElement>(null),
    flashRef = useRef<HTMLImageElement>(null),
    thunderRef = useRef<(() => void) | null>(null);
  const transitionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audioWeatherRef = useRef(weather);
  const rainAudioRef = useRef<{
    filter: BiquadFilterNode;
    gain: GainNode;
  } | null>(null);
  const reducedMotion = useReducedMotion();
  const paused = motionPaused || reducedMotion;
  function changeWeather(next: Weather) {
    transitionTimers.current.forEach(clearTimeout);
    setRequestedWeather(next);
    if (next === weather) {
      setWeatherPhase('idle');
      return;
    }
    setWeatherPhase('waiting');
    const delay = reducedMotion ? 0 : WEATHER_DELAY_MS;
    transitionTimers.current = [
      setTimeout(() => {
        setWeather(next);
        setWeatherPhase('changing');
      }, delay),
      setTimeout(
        () => setWeatherPhase('idle'),
        delay + (reducedMotion ? 150 : WEATHER_FADE_MS),
      ),
    ];
  }
  useEffect(() => () => transitionTimers.current.forEach(clearTimeout), []);
  useEffect(() => {
    audioWeatherRef.current = weather;
    const ctx = audioRef.current,
      rain = rainAudioRef.current;
    if (!ctx || !rain) return;
    rain.filter.frequency.setTargetAtTime(
      weather === 'rain' ? 2600 : 1100,
      ctx.currentTime,
      0.8,
    );
    rain.gain.gain.cancelScheduledValues(ctx.currentTime);
    rain.gain.gain.setTargetAtTime(
      weather === 'sun' ? 0 : weather === 'rain' ? 0.1 : 0.06,
      ctx.currentTime,
      0.8,
    );
  }, [weather]);
  useEffect(() => {
    if (paused) return;
    const hero = heroRef.current,
      photo = photoRef.current;
    if (!hero || !photo) return;
    let frame = 0,
      last = 0,
      elapsed = 0,
      visible = true;
    let targetX = 0,
      targetY = 0,
      x = 0,
      y = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const rect = hero.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * -34;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * -23;
    };
    const leave = () => {
      targetX = 0;
      targetY = 0;
    };
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden) {
        last = now;
        return;
      }
      if (now - last < 33) return;
      const dt = Math.min((now - last) / 1000, 0.07);
      last = now;
      elapsed += dt;
      x += (targetX - x) * Math.min(1, dt * 2);
      y += (targetY - y) * Math.min(1, dt * 2);
      const scroll = Math.max(
        -1,
        Math.min(1, -hero.getBoundingClientRect().top / hero.clientHeight),
      );
      photo.style.transform = `scale(1.09) translate3d(${x + Math.sin(elapsed * 0.07) * 8}px,${y + Math.cos(elapsed * 0.05) * 4 + scroll * 32}px,0)`;
      hero.style.setProperty('--fog-shift-x', `${x * 1.8}px`);
      hero.style.setProperty('--fog-shift-y', `${y * 1.4 + scroll * 54}px`);
    };
    frame = requestAnimationFrame(draw);
    const observer = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    observer.observe(hero);
    hero.addEventListener('pointermove', move);
    hero.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerleave', leave);
      photo.style.transform = 'none';
      hero.style.removeProperty('--fog-shift-x');
      hero.style.removeProperty('--fog-shift-y');
    };
  }, [paused]);
  useEffect(() => {
    const ctx = audioRef.current;
    if (!sound || !ctx) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * 0.65;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = audioWeatherRef.current === 'rain' ? 2600 : 1100;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(
      audioWeatherRef.current === 'sun'
        ? 0
        : audioWeatherRef.current === 'rain'
          ? 0.1
          : 0.06,
      ctx.currentTime,
      0.5,
    );
    rainAudioRef.current = { filter, gain };
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    const nodes = new Set<AudioBufferSourceNode>();
    const thunderBuffer = createThunderBuffer(ctx);
    const rumble = () => {
      if (
        document.hidden ||
        ctx.state !== 'running' ||
        audioWeatherRef.current !== 'storm'
      )
        return;
      const node = ctx.createBufferSource();
      node.buffer = thunderBuffer;
      node.playbackRate.value = 0.91 + Math.random() * 0.15;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.setValueAtTime(1700, ctx.currentTime);
      low.frequency.exponentialRampToValueAtTime(170, ctx.currentTime + 5);
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, ctx.currentTime);
      envelope.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.08);
      envelope.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 8.7);
      node.connect(low).connect(envelope).connect(ctx.destination);
      node.start();
      nodes.add(node);
      node.onended = () => {
        nodes.delete(node);
        node.disconnect();
        low.disconnect();
        envelope.disconnect();
      };
    };
    thunderRef.current = rumble;
    const visibility = () => {
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      source.stop();
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      thunderRef.current = null;
      rainAudioRef.current = null;
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          /* Already ended. */
        }
      }
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [sound]);
  // One shared strike schedule keeps the visible lightning and delayed thunder together.
  useEffect(() => {
    const hero = heroRef.current;
    const flash = flashRef.current;
    if (!hero || !flash || weather !== 'storm' || paused) return;
    let visible = false;
    let strikeTimer: ReturnType<typeof setTimeout>;
    let thunderTimer: ReturnType<typeof setTimeout>;
    let animation: Animation | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) {
          animation?.cancel();
          clearTimeout(thunderTimer);
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(hero);
    const strike = () => {
      if (
        visible &&
        !document.hidden &&
        flash.complete &&
        flash.naturalWidth > 0
      ) {
        animation?.cancel();
        animation = flash.animate(
          [
            { opacity: 0, offset: 0 },
            { opacity: 0.9, offset: 0.12 },
            { opacity: 0.65, offset: 0.26 },
            { opacity: 0.2, offset: 0.58 },
            { opacity: 0, offset: 1 },
          ],
          { duration: 1000, easing: 'ease-out' },
        );
        thunderTimer = setTimeout(
          () => {
            if (visible && !document.hidden) thunderRef.current?.();
          },
          950 + Math.random() * 450,
        );
      }
      strikeTimer = setTimeout(strike, 9000 + Math.random() * 6000);
    };
    strikeTimer = setTimeout(strike, WEATHER_FADE_MS + 600);
    return () => {
      observer.disconnect();
      clearTimeout(strikeTimer);
      clearTimeout(thunderTimer);
      animation?.cancel();
    };
  }, [weather, paused, sound]);
  useEffect(
    () => () => {
      void audioRef.current?.close();
    },
    [],
  );
  async function toggleSound() {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      await audioRef.current.resume();
      setSound((s) => !s);
      setAudioError('');
    } catch {
      setAudioError('Audio isn’t available in this browser.');
    }
  }
  return (
    <section className={'hero weather-' + weather} id="top" ref={heroRef}>
      <div className="hero-atmosphere-images" ref={photoRef}>
        <Image
          unoptimized
          className="pro-mountain"
          src="/images/focus-pro-mountains.jpg"
          alt="Storm light breaking over a fogged mountain valley"
          width={1920}
          height={1088}
          fetchPriority="high"
        />
        {(Object.entries(WEATHER_ASSETS) as [Weather, string][]).map(
          ([mode, src]) => (
            <Image
              key={mode}
              unoptimized
              className={
                'weather-photo ' + (weather === mode ? 'is-active' : '')
              }
              src={src}
              alt={
                weather === mode
                  ? `${mode === 'sun' ? 'Sunlit' : mode === 'rain' ? 'Rain-filled' : 'Thunderstorm'} clouds above a misty horizon`
                  : ''
              }
              aria-hidden={weather !== mode}
              fetchPriority={mode === 'storm' ? 'high' : 'auto'}
              width="1672"
              height="941"
            />
          ),
        )}
        <Suspense fallback={null}>
          <CloudMotion
            weather={weather}
            paused={paused}
            reducedMotion={reducedMotion}
          />
        </Suspense>
        <Image
          unoptimized
          ref={flashRef}
          className="storm-flash"
          src="/images/focus-pro-mountains.jpg"
          alt=""
          aria-hidden="true"
          width="1672"
          height="941"
        />
      </div>
      <Suspense fallback={null}>
        <Scene3D weather={weather} paused={paused} />
      </Suspense>
      <div className="hero-shade" />
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="status-dot" /> Website design &amp; development
          studio
        </p>
        <h1>
          Your idea.
          <br />
          <span>Our craft.</span>
        </h1>
        <p className="hero-description">
          Focus turns ambitious ideas from small businesses into exceptional
          digital experiences.
        </p>
        <div className="hero-actions">
          <a href="#project" className="button primary">
            Start a project <ArrowUpRight size={18} />
          </a>
          <a href="#work" className="text-link">
            Explore our work <ArrowDown size={16} />
          </a>
        </div>
        <div className="pro-hero-facts">
          <div>
            <p className="eyebrow">Design → build</p>
            <p>One studio, end to end</p>
          </div>
          <div>
            <p className="eyebrow">Handover</p>
            <p>Full project files &amp; code</p>
          </div>
          <div>
            <p className="eyebrow">Made for</p>
            <p>Small &amp; local businesses</p>
          </div>
        </div>
      </div>
      <div className="atmosphere">
        <p className="eyebrow">Set the atmosphere</p>
        <output className="weather-status" aria-live="polite">
          {weatherPhase === 'waiting'
            ? 'A change is in the air…'
            : weatherPhase === 'changing'
              ? `Easing into ${requestedWeather === 'sun' ? 'sunshine' : requestedWeather === 'rain' ? 'rain' : 'the storm'}…`
              : 'Clouds in motion. A moment to breathe.'}
        </output>
        <div className="weather-controls">
          <RadioGroup
            className="weather-options"
            aria-label="Weather"
            value={requestedWeather}
            onValueChange={(v) => changeWeather(v as Weather)}
          >
            {(
              [
                { id: 'storm', label: 'Storm', Icon: CloudLightning },
                { id: 'rain', label: 'Rain', Icon: CloudRain },
                { id: 'sun', label: 'Sun', Icon: Sun },
              ] as const
            ).map(({ id, label, Icon }) => (
              <RadioPrimitive.Root
                value={id}
                className="weather-option"
                key={id}
                aria-label={label}
              >
                <Icon size={16} />
                <span>{label}</span>
              </RadioPrimitive.Root>
            ))}
          </RadioGroup>
          <span className="control-divider" />
          <button
            className="icon-button sound-button"
            onClick={toggleSound}
            aria-label={sound ? 'Mute ambient sound' : 'Enable ambient sound'}
            aria-pressed={sound}
            title={
              weather === 'sun'
                ? 'Sunshine is quiet'
                : 'Ambient rain and thunder'
            }
          >
            {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            <span>{sound ? 'Sound on' : 'Sound off'}</span>
          </button>
          <button
            className="icon-button"
            aria-label={
              reducedMotion
                ? 'Reduced motion is enabled on your device'
                : paused
                  ? 'Play visual effects'
                  : 'Pause visual effects'
            }
            disabled={reducedMotion}
            onClick={() => setPaused(!motionPaused)}
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
        </div>
        {audioError && <output className="audio-note">{audioError}</output>}
      </div>
      <div className="hero-foot">
        <span>Small businesses. Extraordinary presence.</span>
        <a href="#work">
          Scroll to discover <ArrowDown size={15} />
        </a>
        <span>Design with intention. Build with focus.</span>
      </div>
    </section>
  );
}
