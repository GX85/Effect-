/**
 * The Effect mark: a faceted glass prism splitting a white beam into a spectrum, on a
 * continuous-corner (squircle) tile. Solid fills only (no gradients or ids), so it stays
 * crisp from 16 to 128 px and any number of copies can live on one page.
 */
export const LOGO = {
  /** Superellipse tile, 32×32. */
  tile: 'M16 0C27.6 0 32 4.4 32 16s-4.4 16-16 16S0 27.6 0 16 4.4 0 16 0z',
  /** Incoming beam (filled wedge, wider where it meets the glass). */
  beam: 'M1.6 18.2 11.6 14.6l.5 1.7L1.9 19.4z',
  /** Prism facets: left (lit), right (shade), base edge. */
  left: 'M15.2 6.4 7 23.6h9.2z',
  right: 'M15.2 6.4l1 17.2h7.2z',
  /** Spectrum fan leaving the right face, five bands. */
  bands: [
    ['M19.6 15.1 30.6 9.6v2.6z', '#ff4f6d'],
    ['M19.6 15.1 30.6 12.2v2.6z', '#ffab2e'],
    ['M19.6 15.1 30.6 14.8v2.6z', '#3ddc84'],
    ['M19.6 15.1 30.6 17.4v2.6z', '#3fa9ff'],
    ['M19.6 15.1 30.6 20v2.6z', '#9a6bff'],
  ] as [string, string][],
};

/** Standalone SVG markup (favicon, artifact, places without React). */
export function logoSvg(size = 32, opts: { tile?: string; title?: string } = {}): string {
  const tile = opts.tile ?? '#0d0d12';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"${opts.title ? ' role="img" aria-label="' + opts.title + '"' : ' aria-hidden="true"'}>` +
    `<path d="${LOGO.tile}" fill="${tile}"/>` +
    `<path d="${LOGO.tile}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width=".8" transform="translate(.4 .4) scale(.975)"/>` +
    LOGO.bands.map(([d, c]) => `<path d="${d}" fill="${c}"/>`).join('') +
    `<path d="${LOGO.beam}" fill="#fff"/>` +
    `<path d="${LOGO.left}" fill="#fff" fill-opacity=".94"/>` +
    `<path d="${LOGO.right}" fill="#fff" fill-opacity=".52"/>` +
    '</svg>'
  );
}
