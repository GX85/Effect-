/**
 * One icon set for the Effect landing and both studios: 24px grid, 1.8 stroke, round caps
 * and joins, outline only. Rendered at 16 or 20 px.
 */
export const ICON_STROKE = 1.8;

const sq = (x: number, y: number) => `M${x + 2} ${y}h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z`;

export const ICONS = {
  // Project kinds
  website: ['M6 4h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z', 'M3 9h18', 'M7 6.5h.01M10 6.5h.01'],
  landing: ['M12 3c3.5 2.2 5 6 5 10l-2 3H9l-2-3c0-4 1.5-7.8 5-10z', 'M9 16l-2 4M15 16l2 4M12 9.5h.01'],
  presentation: ['M5.5 4h13A2.5 2.5 0 0 1 21 6.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 13.5v-7A2.5 2.5 0 0 1 5.5 4z', 'M12 16v4M8 20h8', 'M8 12l2.5-2.5L13 11l3-3'],
  game: [
    'M7 8h10a5 5 0 0 1 4.6 7l-.5 1.2a2.6 2.6 0 0 1-4.3.6L15 15H9l-1.8 1.8a2.6 2.6 0 0 1-4.3-.6L2.4 15A5 5 0 0 1 7 8z',
    'M7.5 11v2.5M6.2 12.2h2.6M16 11.5h.01M18 13h.01',
  ],
  app: [sq(3, 3), sq(14, 3), sq(3, 14), 'M17.5 14v7M14 17.5h7'],
  dashboard: ['M4 20V10M10 20V4M16 20v-7M22 20H2'],
  other: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 17v4M17 19h4'],
  // Agents
  architect: ['M12 3v3', 'M12 6l-6 15', 'M12 6l6 15', 'M7.5 16.5h9', 'M12 6a1.5 1.5 0 1 0 0-.01'],
  designer: ['M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.2 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z', 'M7.5 11h.01M10 7.5h.01M14.5 7.5h.01'],
  developer: ['M8 8l-5 4 5 4', 'M16 8l5 4-5 4', 'M13.5 5l-3 14'],
  tester: ['M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z', 'M9 12l2 2 4-4'],
  reviewer: ['M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z'],
  answer: ['M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4V6a2 2 0 0 1 1-2z', 'M8 9.5h8M8 13h5'],
  router: ['M4 12h6', 'M10 12l4-6h6', 'M10 12l4 6h6'],
  // Devices
  desktop: ['M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M8 21h8M12 17v4'],
  tablet: ['M6.5 2h11A2.5 2.5 0 0 1 20 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z', 'M11 18h2'],
  phone: ['M9.5 2h5A2.5 2.5 0 0 1 17 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 19.5v-15A2.5 2.5 0 0 1 9.5 2z', 'M11 18h2'],
  // Actions
  text: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  undo: ['M9 14 4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-3'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  download: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
  copy: ['M10.5 8h7A2.5 2.5 0 0 1 20 10.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 8 17.5v-7A2.5 2.5 0 0 1 10.5 8z', 'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2'],
  projects: [sq(3, 3), sq(14, 3), sq(3, 14), sq(14, 14)],
  back: ['M15 5l-7 7 7 7'],
  send: ['M12 19V5', 'M5.5 11.5 12 5l6.5 6.5'],
  stop: ['M8 7h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  plus: ['M12 5v14M5 12h14'],
  close: ['M6 6l12 12M18 6 6 18'],
  bolt: ['M13 2 4 14h7l-1 8 9-12h-7z'],
  spark: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 17v4M17 19h4'],
  chat: ['M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4V6a2 2 0 0 1 1-2z'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  code: ['M8 8l-5 4 5 4', 'M16 8l5 4-5 4', 'M13.5 5l-3 14'],
  chevron: ['M6 9l6 6 6-6'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  retry: ['M20 12a8 8 0 1 1-2.3-5.6', 'M20 4v5h-5'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-4-4'],
  more: ['M5 12h.01M12 12h.01M19 12h.01'],
  edit: ['M4 20h4L19 9l-4-4L4 16z'],
  duplicate: ['M9 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5', 'M12 7v5l3 2'],
  compare: ['M12 3v18', 'M5 7h4v10H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', 'M15 7h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-4'],
  expand: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
  sidebar: ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M9 4v16'],
  key: ['M15 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', 'M10.5 13.5 3 21', 'M6 18l2 2', 'M8 16l2 2', 'M15.5 8.5h.01'],
  shield: ['M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z'],
  users: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M2 21a7 7 0 0 1 14 0', 'M16 3.5a4 4 0 0 1 0 7.5', 'M22 21a7 7 0 0 0-4-6.3'],
  layers: ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5'],
  lock: ['M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  globe: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18', 'M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z'],
  cursor: ['M5 3l14 7-6 2-2 6z', 'M13 13l6 6'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5', 'M12 7.5h.01'],
  cpu: ['M7 7h10v10H7z', 'M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4'],
} as const;

export type IconName = keyof typeof ICONS;

/** SVG markup for places that build DOM from strings. */
export function iconSvg(name: IconName, size = 20): string {
  return (
    `<svg class="fx-ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${ICON_STROKE}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    ICONS[name].map((d) => `<path d="${d}"/>`).join('') +
    '</svg>'
  );
}
