import type { Kind } from '@/lib/effect/agent/types';
import { ICONS, ICON_STROKE, type IconName } from '@/lib/effect/icons';
import { useId } from 'react';
import { LOGO } from '@/lib/effect/logo';

export { KIND_LABELS as kindLabels } from '@/lib/effect/agent/models';

/** The Effect mark: a triangle with a glowing rainbow outline. `live` adds a slow glow breath. */
export function EffectLogo({ size = 28, title, live = false }: { size?: number; title?: string; live?: boolean }) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, '');
  const g = 'fxRainbow' + u;
  const f = 'fxGlow' + u;
  return (
    <svg
      className={live ? 'fx-logo live' : 'fx-logo'}
      width={size}
      height={size}
      viewBox={LOGO.viewBox}
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={g} {...LOGO.gradient} gradientUnits="userSpaceOnUse">
          {LOGO.stops.map(([o, c]) => (
            <stop key={o} offset={o} stopColor={c} />
          ))}
        </linearGradient>
        <filter id={f} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={LOGO.glow.blur} />
        </filter>
      </defs>
      <path className="fx-logo-glow" d={LOGO.path} stroke={`url(#${g})`} strokeWidth={LOGO.glow.width} strokeLinejoin="round" filter={`url(#${f})`} opacity={LOGO.glow.opacity} />
      <path d={LOGO.path} stroke={`url(#${g})`} strokeWidth={LOGO.stroke} strokeLinejoin="round" />
    </svg>
  );
}

export function Icon({ name, size = 20 }: { name: IconName; size?: 16 | 20 | 24 }) {
  return (
    <svg
      className="fx-ic"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function KindIcon({ kind, size = 16 }: { kind: Kind; size?: 16 | 20 | 24 }) {
  return <Icon name={kind} size={size} />;
}
