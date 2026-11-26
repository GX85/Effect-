import type { Kind } from '@/lib/effect/agent/types';
import { ICONS, ICON_STROKE, type IconName } from '@/lib/effect/icons';
import { LOGO } from '@/lib/effect/logo';

export { KIND_LABELS as kindLabels } from '@/lib/effect/agent/models';

/** The Effect mark. `tile` false draws the prism and spectrum without the squircle tile. */
export function EffectLogo({ size = 28, tile = true, title }: { size?: number; tile?: boolean; title?: string }) {
  return (
    <svg
      className={tile ? 'fx-logo' : 'fx-logo bare'}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {tile && <path className="fx-logo-tile" d={LOGO.tile} />}
      {tile && <path className="fx-logo-ring" d={LOGO.tile} transform="translate(.4 .4) scale(.975)" />}
      {LOGO.bands.map(([d, c]) => (
        <path key={d} d={d} fill={c} />
      ))}
      <path className="fx-logo-glass" d={LOGO.beam} />
      <path className="fx-logo-glass" d={LOGO.left} fillOpacity={0.94} />
      <path className="fx-logo-glass" d={LOGO.right} fillOpacity={0.52} />
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
