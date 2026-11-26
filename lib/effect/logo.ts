/**
 * The Effect mark: only a triangle whose outline is a glowing rainbow — no fill, no tile,
 * no beam. Geometry is fixed (64×64 viewBox): a rounded-join triangle stroked with a
 * red → orange → yellow → green → cyan → blue → violet gradient over a blurred copy.
 * Gradient and filter ids get a per-instance suffix so copies never clash on one page.
 */
export const LOGO = {
  viewBox: '0 0 64 64',
  path: 'M32 9.5 55.5 51.5H8.5Z',
  gradient: { x1: '8', y1: '54', x2: '56', y2: '10' },
  stops: [
    ['0', '#ff375f'],
    ['.18', '#ff9f0a'],
    ['.34', '#ffd60a'],
    ['.5', '#30d158'],
    ['.66', '#64d2ff'],
    ['.82', '#0a84ff'],
    ['1', '#bf5af2'],
  ] as [string, string][],
  glow: { blur: '2.6', width: '6', opacity: '.75' },
  stroke: '3.8',
};

let counter = 0;

/** Standalone SVG markup (favicon, places without React). */
export function logoSvg(size = 64, opts: { title?: string; uid?: string } = {}): string {
  const u = opts.uid ?? (++counter).toString(36);
  const g = 'fxRainbow' + u;
  const f = 'fxGlow' + u;
  const { x1, y1, x2, y2 } = LOGO.gradient;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO.viewBox}" width="${size}" height="${size}" fill="none"${opts.title ? ' role="img" aria-label="' + opts.title + '"' : ' aria-hidden="true"'}>` +
    `<defs><linearGradient id="${g}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">` +
    LOGO.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('') +
    `</linearGradient><filter id="${f}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${LOGO.glow.blur}"/></filter></defs>` +
    `<path d="${LOGO.path}" stroke="url(#${g})" stroke-width="${LOGO.glow.width}" stroke-linejoin="round" filter="url(#${f})" opacity="${LOGO.glow.opacity}"/>` +
    `<path d="${LOGO.path}" stroke="url(#${g})" stroke-width="${LOGO.stroke}" stroke-linejoin="round"/>` +
    '</svg>'
  );
}
