/** ⌘K palette data: commands and the search over them. */
import type { IconName } from './icons.ts';

export type Command = {
  id: string;
  group: string;
  label: string;
  icon: IconName;
  hint?: string;
  /** Extra words the search matches. */
  keywords?: string;
  run: () => void;
};

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Every query word must appear in the label, group or keywords. Label hits rank first. */
export function filterCommands(list: Command[], q: string): Command[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  const scored: [Command, number][] = [];
  for (const c of list) {
    const label = norm(c.label);
    const hay = label + ' ' + norm(c.group) + ' ' + norm(c.keywords ?? '');
    if (!words.every((w) => hay.includes(w))) continue;
    scored.push([c, (label.startsWith(words[0]) ? 0 : label.includes(words[0]) ? 1 : 2) * 1000 + list.indexOf(c)]);
  }
  return scored.sort((a, b) => a[1] - b[1]).map(([c]) => c);
}

